-- current_user_role() previously queried profiles as the calling user. Since
-- the profiles SELECT policy also called current_user_role(), Postgres recursed
-- until it exceeded max_stack_depth. Keep the role lookup in a non-exposed
-- schema and restrict it to the current Supabase Auth user.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role::text
  FROM public.profiles
  WHERE auth_user_id = (SELECT auth.uid())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_user_role() TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = auth_user_id OR (SELECT private.current_user_role()) = 'PLATFORM_ADMIN');

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = auth_user_id)
  WITH CHECK ((SELECT auth.uid()) = auth_user_id);

DROP POLICY IF EXISTS "Owners can manage own cinemas" ON public.cinemas;
CREATE POLICY "Owners can manage own cinemas" ON public.cinemas
  FOR ALL TO authenticated
  USING (owner_user_id = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid())) OR (SELECT private.current_user_role()) = 'PLATFORM_ADMIN')
  WITH CHECK (owner_user_id = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid())) OR (SELECT private.current_user_role()) = 'PLATFORM_ADMIN');

DROP POLICY IF EXISTS "Providers can manage own movies" ON public.movies;
CREATE POLICY "Providers can manage own movies" ON public.movies
  FOR ALL TO authenticated
  USING (created_by_provider = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid())) OR (SELECT private.current_user_role()) = 'PLATFORM_ADMIN')
  WITH CHECK (created_by_provider = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid())) OR (SELECT private.current_user_role()) = 'PLATFORM_ADMIN');

DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM public.profiles WHERE auth_user_id = (SELECT auth.uid())) OR (SELECT private.current_user_role()) = 'PLATFORM_ADMIN');

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING ((SELECT private.current_user_role()) = 'PLATFORM_ADMIN');

DROP FUNCTION IF EXISTS public.current_user_role();

-- The original claim function used SELECT aggregates with FOR UPDATE, which
-- PostgreSQL rejects at execution time. Lock the requested inventory rows
-- first, then validate their current state before changing any of them.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS hold_id UUID;
CREATE INDEX IF NOT EXISTS idx_bookings_hold_id ON public.bookings(hold_id);

CREATE OR REPLACE FUNCTION public.claim_show_seats(
  p_show_id UUID,
  p_seat_ids UUID[],
  p_user_id UUID,
  p_hold_id UUID,
  p_hold_seconds INT DEFAULT 180
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_seat_count INT;
  v_available_count INT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_seat_count := COALESCE(array_length(p_seat_ids, 1), 0);
  IF v_seat_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_SEAT_SELECTION', 'message', 'No seats specified');
  END IF;

  PERFORM 1
  FROM public.show_seats
  WHERE show_id = p_show_id AND id = ANY(p_seat_ids)
  ORDER BY id
  FOR UPDATE;

  SELECT COUNT(*) INTO v_available_count
  FROM public.show_seats
  WHERE show_id = p_show_id
    AND id = ANY(p_seat_ids)
    AND (status = 'AVAILABLE' OR (status = 'HELD' AND (held_until <= NOW() OR hold_user_id = p_user_id)));

  IF v_available_count <> v_seat_count THEN
    RETURN jsonb_build_object('success', false, 'code', 'SEAT_UNAVAILABLE', 'message', 'One or more seats are no longer available.');
  END IF;

  v_expires_at := NOW() + make_interval(secs => p_hold_seconds);
  UPDATE public.show_seats
  SET status = 'HELD', hold_id = p_hold_id, hold_user_id = p_user_id,
      held_until = v_expires_at, updated_at = NOW()
  WHERE show_id = p_show_id AND id = ANY(p_seat_ids);

  INSERT INTO public.seat_reservations (hold_id, show_id, user_id, show_seat_ids, status, expires_at)
  VALUES (p_hold_id, p_show_id, p_user_id, p_seat_ids, 'ACTIVE', v_expires_at);

  RETURN jsonb_build_object('success', true, 'holdId', p_hold_id, 'showId', p_show_id,
    'seatsClaimed', v_seat_count, 'expiresAt', v_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_booking(
  p_booking_id UUID,
  p_user_id UUID,
  p_provider_payment_id VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking RECORD;
  v_seat_ids UUID[];
  v_ticket_id UUID;
  v_ticket_number VARCHAR(100);
  v_security_code VARCHAR(50);
  v_qr_code_data TEXT;
  v_unheld_count INT;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'BOOKING_NOT_FOUND', 'message', 'Booking does not exist');
  END IF;
  IF v_booking.user_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'BOOKING_OWNER_MISMATCH', 'message', 'Booking owner does not match');
  END IF;
  IF v_booking.status = 'CONFIRMED' THEN
    SELECT ticket_number, qr_code_data INTO v_ticket_number, v_qr_code_data
    FROM public.tickets WHERE booking_id = p_booking_id LIMIT 1;
    RETURN jsonb_build_object('success', true, 'message', 'Booking already confirmed',
      'bookingId', p_booking_id, 'ticketNumber', v_ticket_number, 'qrCodeData', v_qr_code_data);
  END IF;
  IF v_booking.status <> 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_BOOKING_STATUS', 'message', 'Booking is not pending');
  END IF;

  SELECT array_agg(show_seat_id) INTO v_seat_ids
  FROM public.booking_seats WHERE booking_id = p_booking_id;
  IF COALESCE(array_length(v_seat_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'BOOKING_HAS_NO_SEATS', 'message', 'Booking has no reserved seats');
  END IF;

  PERFORM 1 FROM public.show_seats WHERE id = ANY(v_seat_ids) ORDER BY id FOR UPDATE;
  SELECT COUNT(*) INTO v_unheld_count FROM public.show_seats
  WHERE id = ANY(v_seat_ids)
    AND (status <> 'HELD' OR hold_user_id <> p_user_id OR held_until IS NULL OR held_until < NOW());
  IF v_unheld_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'HOLD_EXPIRED_OR_INVALID',
      'message', 'Seat hold has expired or belongs to another user.');
  END IF;

  UPDATE public.show_seats
  SET status = 'BOOKED', booking_id = p_booking_id, hold_id = NULL,
      held_until = NULL, updated_at = NOW()
  WHERE id = ANY(v_seat_ids);
  UPDATE public.bookings SET status = 'CONFIRMED', payment_status = 'PAID', updated_at = NOW()
  WHERE id = p_booking_id;
  UPDATE public.payments SET status = 'SUCCESS',
    provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id), updated_at = NOW()
  WHERE booking_id = p_booking_id;
  UPDATE public.seat_reservations SET status = 'CONVERTED_TO_BOOKING', booking_id = p_booking_id
  WHERE hold_id = v_booking.hold_id AND user_id = p_user_id AND show_id = v_booking.show_id AND status = 'ACTIVE';

  v_ticket_id := gen_random_uuid();
  v_ticket_number := 'TIX-' || UPPER(SUBSTRING(REPLACE(v_booking.id::text, '-', ''), 1, 8));
  v_security_code := 'SEC-' || (1000 + FLOOR(RANDOM() * 9000))::INT;
  v_qr_code_data := jsonb_build_object('ticketNumber', v_ticket_number,
    'bookingReference', v_booking.booking_reference, 'showId', v_booking.show_id,
    'cinemaId', v_booking.cinema_id, 'seats', v_seat_ids,
    'securityCode', v_security_code)::text;
  INSERT INTO public.tickets (id, booking_id, ticket_number, security_code, gate_info, qr_code_data, status, issued_at)
  VALUES (v_ticket_id, p_booking_id, v_ticket_number, v_security_code,
    'Auditorium Gate 4 • Level 3', v_qr_code_data, 'VALID', NOW());
  RETURN jsonb_build_object('success', true, 'bookingId', p_booking_id,
    'ticketId', v_ticket_id, 'ticketNumber', v_ticket_number,
    'securityCode', v_security_code, 'qrCodeData', v_qr_code_data);
END;
$$;

-- These state-changing RPCs are backend-only; never expose them to browser roles.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_show_seats(UUID, UUID[], UUID, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_show_seats(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_booking(UUID, UUID, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_hold(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_queue_request(UUID, UUID, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_show_inventory(UUID) TO service_role;
