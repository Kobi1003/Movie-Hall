-- 017_functions_and_rpc.sql

-- 1. Atomic claim of one or multiple seats for a show (3-minute hold)
CREATE OR REPLACE FUNCTION claim_show_seats(
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
    v_locked_count INT;
    v_expires_at TIMESTAMPTZ;
    v_conflicting_labels TEXT[];
BEGIN
    v_seat_count := array_length(p_seat_ids, 1);
    IF v_seat_count IS NULL OR v_seat_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'code', 'EMPTY_SEAT_SELECTION', 'message', 'No seats specified');
    END IF;

    -- Calculate expiration timestamp
    v_expires_at := NOW() + (p_hold_seconds || ' seconds')::INTERVAL;

    -- Lock requested rows separately; PostgreSQL does not allow FOR UPDATE
    -- on an aggregate query.
    PERFORM id
    FROM show_seats
    WHERE show_id = p_show_id AND id = ANY(p_seat_ids)
    FOR UPDATE;

    -- Collect conflicting seat labels after locking the rows
    SELECT array_agg(seat_label)
    INTO v_conflicting_labels
    FROM show_seats
    WHERE show_id = p_show_id
      AND id = ANY(p_seat_ids)
      AND (
          status = 'BOOKED' 
          OR status = 'BLOCKED' 
          OR (status = 'HELD' AND held_until > NOW() AND hold_user_id <> p_user_id)
      )
    ;

    IF v_conflicting_labels IS NOT NULL AND array_length(v_conflicting_labels, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'SEAT_UNAVAILABLE',
            'message', 'One or more selected seats are no longer available.',
            'conflictingSeats', v_conflicting_labels
        );
    END IF;

    -- Check how many target seats exist for this show
    SELECT COUNT(*)
    INTO v_locked_count
    FROM show_seats
    WHERE show_id = p_show_id
      AND id = ANY(p_seat_ids)
      AND (status = 'AVAILABLE' OR (status = 'HELD' AND (held_until <= NOW() OR hold_user_id = p_user_id)))
    ;

    IF v_locked_count <> v_seat_count THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'SEAT_NOT_FOUND_OR_UNAVAILABLE',
            'message', 'Mismatch between requested seats and available inventory'
        );
    END IF;

    -- Perform atomic state transition to HELD
    UPDATE show_seats
    SET status = 'HELD',
        hold_id = p_hold_id,
        hold_user_id = p_user_id,
        held_until = v_expires_at,
        updated_at = NOW()
    WHERE show_id = p_show_id
      AND id = ANY(p_seat_ids);

    -- Record durable seat reservation entry
    INSERT INTO seat_reservations (
        hold_id,
        show_id,
        user_id,
        show_seat_ids,
        status,
        expires_at
    ) VALUES (
        p_hold_id,
        p_show_id,
        p_user_id,
        p_seat_ids,
        'ACTIVE',
        v_expires_at
    );

    RETURN jsonb_build_object(
        'success', true,
        'holdId', p_hold_id,
        'showId', p_show_id,
        'seatsClaimed', v_seat_count,
        'expiresAt', v_expires_at
    );
END;
$$;


-- 2. Atomic voluntary release of held seats
CREATE OR REPLACE FUNCTION release_show_seats(
    p_show_id UUID,
    p_hold_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_released_count INT;
BEGIN
    UPDATE show_seats
    SET status = 'AVAILABLE',
        hold_id = NULL,
        hold_user_id = NULL,
        held_until = NULL,
        updated_at = NOW()
    WHERE show_id = p_show_id
      AND hold_id = p_hold_id
      AND (hold_user_id = p_user_id OR p_user_id IS NULL)
      AND status = 'HELD';

    GET DIAGNOSTICS v_released_count = ROW_COUNT;

    UPDATE seat_reservations
    SET status = 'RELEASED',
        released_at = NOW()
    WHERE hold_id = p_hold_id;

    RETURN jsonb_build_object(
        'success', true,
        'releasedCount', v_released_count
    );
END;
$$;


-- 3. Atomic confirmation of booking on payment verification
CREATE OR REPLACE FUNCTION confirm_booking(
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
    -- Retrieve and lock booking
    SELECT * INTO v_booking
    FROM bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'BOOKING_NOT_FOUND', 'message', 'Booking does not exist');
    END IF;

    IF v_booking.status = 'CONFIRMED' THEN
        -- Already confirmed (idempotent call)
        SELECT ticket_number, qr_code_data INTO v_ticket_number, v_qr_code_data
        FROM tickets WHERE booking_id = p_booking_id LIMIT 1;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Booking already confirmed',
            'bookingId', p_booking_id,
            'ticketNumber', v_ticket_number,
            'qrCodeData', v_qr_code_data
        );
    END IF;

    IF v_booking.status <> 'PENDING' THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_BOOKING_STATUS', 'message', 'Booking is not pending');
    END IF;

    -- Collect seats associated with booking
    SELECT array_agg(show_seat_id)
    INTO v_seat_ids
    FROM booking_seats
    WHERE booking_id = p_booking_id;

    -- Verify that every seat is currently HELD by the user and not expired
    PERFORM id
    FROM show_seats
    WHERE id = ANY(v_seat_ids)
    FOR UPDATE;

    SELECT COUNT(*)
    INTO v_unheld_count
    FROM show_seats
    WHERE id = ANY(v_seat_ids)
      AND (
          status <> 'HELD' 
          OR hold_user_id <> p_user_id 
          OR held_until < NOW()
      )
    ;

    IF v_unheld_count > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'HOLD_EXPIRED_OR_INVALID',
            'message', 'Seat hold has expired or belongs to another user.'
        );
    END IF;

    -- Transition show_seats to BOOKED
    UPDATE show_seats
    SET status = 'BOOKED',
        booking_id = p_booking_id,
        hold_id = NULL,
        held_until = NULL,
        updated_at = NOW()
    WHERE id = ANY(v_seat_ids);

    -- Mark booking CONFIRMED and PAID
    UPDATE bookings
    SET status = 'CONFIRMED',
        payment_status = 'PAID',
        updated_at = NOW()
    WHERE id = p_booking_id;

    -- Update payments table
    UPDATE payments
    SET status = 'SUCCESS',
        provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
        updated_at = NOW()
    WHERE booking_id = p_booking_id;

    -- Mark reservations converted
    UPDATE seat_reservations
    SET status = 'CONVERTED_TO_BOOKING',
        booking_id = p_booking_id
    WHERE user_id = p_user_id AND show_id = v_booking.show_id AND status = 'ACTIVE';

    -- Generate digital ticket
    v_ticket_id := gen_random_uuid();
    v_ticket_number := 'TIX-' || UPPER(SUBSTRING(REPLACE(v_booking.id::text, '-', ''), 1, 8));
    v_security_code := 'SEC-' || (1000 + FLOOR(RANDOM() * 9000))::INT;
    v_qr_code_data := jsonb_build_object(
        'ticketNumber', v_ticket_number,
        'bookingReference', v_booking.booking_reference,
        'showId', v_booking.show_id,
        'cinemaId', v_booking.cinema_id,
        'seats', v_seat_ids,
        'securityCode', v_security_code
    )::text;

    INSERT INTO tickets (
        id,
        booking_id,
        ticket_number,
        security_code,
        gate_info,
        qr_code_data,
        status,
        issued_at
    ) VALUES (
        v_ticket_id,
        p_booking_id,
        v_ticket_number,
        v_security_code,
        'Auditorium Gate 4 • Level 3',
        v_qr_code_data,
        'VALID',
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'bookingId', p_booking_id,
        'ticketId', v_ticket_id,
        'ticketNumber', v_ticket_number,
        'securityCode', v_security_code,
        'qrCodeData', v_qr_code_data
    );
END;
$$;


-- 4. Expire single or batch of holds when timer elapses without payment
CREATE OR REPLACE FUNCTION expire_hold(
    p_show_id UUID,
    p_hold_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_expired_count INT;
BEGIN
    -- Check that seats are HELD and not already confirmed/booked
    UPDATE show_seats
    SET status = 'AVAILABLE',
        hold_id = NULL,
        hold_user_id = NULL,
        held_until = NULL,
        updated_at = NOW()
    WHERE show_id = p_show_id
      AND hold_id = p_hold_id
      AND status = 'HELD';

    GET DIAGNOSTICS v_expired_count = ROW_COUNT;

    UPDATE seat_reservations
    SET status = 'EXPIRED'
    WHERE hold_id = p_hold_id AND status = 'ACTIVE';

    RETURN jsonb_build_object(
        'success', true,
        'expiredCount', v_expired_count
    );
END;
$$;


-- 5. Promote the next customer in FIFO waiting queue for a specific seat
CREATE OR REPLACE FUNCTION promote_queue_request(
    p_show_id UUID,
    p_show_seat_id UUID,
    p_new_hold_id UUID,
    p_hold_seconds INT DEFAULT 180
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_request RECORD;
    v_seat RECORD;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Lock target show_seat
    SELECT * INTO v_seat
    FROM show_seats
    WHERE id = p_show_seat_id AND show_id = p_show_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'SEAT_NOT_FOUND');
    END IF;

    -- Seat must not be booked or blocked
    IF v_seat.status = 'BOOKED' OR v_seat.status = 'BLOCKED' THEN
        RETURN jsonb_build_object('success', false, 'code', 'SEAT_NOT_PROMOTABLE', 'status', v_seat.status);
    END IF;

    -- Find next active WAITING queue request
    SELECT * INTO v_next_request
    FROM seat_queue_requests
    WHERE show_seat_id = p_show_seat_id
      AND status = 'WAITING'
    ORDER BY queue_position ASC, joined_at ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Queue is empty; seat remains AVAILABLE
        UPDATE show_seats
        SET status = 'AVAILABLE', hold_id = NULL, hold_user_id = NULL, held_until = NULL, updated_at = NOW()
        WHERE id = p_show_seat_id;

        RETURN jsonb_build_object('success', true, 'promoted', false, 'message', 'Queue empty');
    END IF;

    v_expires_at := NOW() + (p_hold_seconds || ' seconds')::INTERVAL;

    -- Transition seat to HELD for the promoted customer
    UPDATE show_seats
    SET status = 'HELD',
        hold_id = p_new_hold_id,
        hold_user_id = v_next_request.user_id,
        held_until = v_expires_at,
        updated_at = NOW()
    WHERE id = p_show_seat_id;

    -- Update queue request status
    UPDATE seat_queue_requests
    SET status = 'PROMOTED',
        promoted_at = NOW(),
        expires_at = v_expires_at,
        updated_at = NOW()
    WHERE id = v_next_request.id;

    -- Create reservation record
    INSERT INTO seat_reservations (
        hold_id,
        show_id,
        user_id,
        show_seat_ids,
        status,
        expires_at,
        source
    ) VALUES (
        p_new_hold_id,
        p_show_id,
        v_next_request.user_id,
        ARRAY[p_show_seat_id],
        'ACTIVE',
        v_expires_at,
        'QUEUE_PROMOTION'
    );

    RETURN jsonb_build_object(
        'success', true,
        'promoted', true,
        'queueRequestId', v_next_request.request_id,
        'userId', v_next_request.user_id,
        'holdId', p_new_hold_id,
        'showSeatId', p_show_seat_id,
        'expiresAt', v_expires_at
    );
END;
$$;


-- 6. Clone physical layout of screen into show-specific show_seats inventory
CREATE OR REPLACE FUNCTION create_show_inventory(
    p_show_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_show RECORD;
    v_inserted_count INT;
BEGIN
    SELECT * INTO v_show FROM shows WHERE id = p_show_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'SHOW_NOT_FOUND');
    END IF;

    -- Insert seats from the specified seat_plan_version
    INSERT INTO show_seats (
        show_id,
        seat_id,
        seat_label,
        row_label,
        seat_number,
        category_name,
        seat_type,
        price,
        status
    )
    SELECT
        p_show_id,
        s.id,
        s.row_label || s.seat_number::text,
        s.row_label,
        s.seat_number,
        sc.display_name,
        s.seat_type::text,
        sc.base_price,
        'AVAILABLE'::show_seat_status_enum
    FROM seats s
    JOIN seat_categories sc ON s.category_id = sc.id
    WHERE s.seat_plan_version_id = v_show.seat_plan_version_id
      AND s.is_active = TRUE;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'showId', p_show_id,
        'seatsCreated', v_inserted_count
    );
END;
$$;
