import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, memoryStore } from '../config/supabase.js';
import { TicketService } from './ticket.service.js';
import { RabbitMQService } from './rabbitmq.service.js';
import { NotificationService } from './notification.service.js';
import { resolveShow, ReservationService } from './reservation.service.js';
import { RedisService } from './redis.service.js';
import { AppError, ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import { BOOKING_STATUS, PAYMENT_STATUS } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import { ENV } from '../config/env.js';

async function resolveSeatHold(showId, holdId, userId, expectedSeatIds = []) {
  let resolvedHoldId = holdId;
  if (!resolvedHoldId && expectedSeatIds.length) {
    const { data: expectedSeats, error: expectedSeatsError } = await supabaseAdmin.from('show_seats')
      .select('id, hold_id, held_until').in('id', expectedSeatIds).eq('show_id', showId)
      .eq('hold_user_id', userId).eq('status', 'HELD');
    if (expectedSeatsError) throw new AppError(`Could not verify held seats: ${expectedSeatsError.message}`, 503, 'DATABASE_UNAVAILABLE');
    const holdIds = [...new Set((expectedSeats || []).map(seat => seat.hold_id).filter(Boolean))];
    if (expectedSeats?.length === expectedSeatIds.length && holdIds.length === 1) resolvedHoldId = holdIds[0];
  }
  if (!resolvedHoldId) return null;

  const { data: storedReservation } = await supabaseAdmin.from('seat_reservations').select('*')
    .eq('hold_id', resolvedHoldId).eq('show_id', showId).maybeSingle();
  if (storedReservation) return storedReservation;

  const memoryReservation = memoryStore.seatReservations.get(resolvedHoldId);
  if (memoryReservation?.status === 'ACTIVE' && memoryReservation.user_id === userId) return memoryReservation;

  // seat_reservations is an auxiliary table; older Supabase setups may not
  // have migration 015 yet. The durable hold is also recorded on show_seats.
  const { data: heldSeats, error } = await supabaseAdmin.from('show_seats').select('id, held_until')
    .eq('show_id', showId).eq('hold_id', resolvedHoldId).eq('hold_user_id', userId).eq('status', 'HELD');
  if (error) throw new AppError(`Could not verify the held seats: ${error.message}`, 503, 'DATABASE_UNAVAILABLE');
  const heldIds = new Set((heldSeats || []).map(seat => seat.id));
  if (!heldSeats?.length || (expectedSeatIds.length && !expectedSeatIds.every(id => heldIds.has(id)))) return null;

  return {
    hold_id: resolvedHoldId, show_id: showId, user_id: userId,
    show_seat_ids: heldSeats.map(seat => seat.id), status: 'ACTIVE',
    expires_at: heldSeats.map(seat => seat.held_until).sort()[0]
  };
}

export class BookingService {
  static async createBooking(userId, { showId, holdId, seatIds, foodItems = [], promoCode, idempotencyKey, customerDetails = null, attendees = [] }) {
    // 1. Idempotency check
    if (idempotencyKey) {
      const { data: existing } = await supabaseAdmin.from('bookings').select('*').eq('idempotency_key', idempotencyKey).single();
      if (existing) { memoryStore.bookings.set(existing.id, existing); return { isExisting: true, booking: existing }; }
      for (const b of memoryStore.bookings.values()) {
        if (b.idempotency_key === idempotencyKey) return { isExisting: true, booking: b };
      }
    }

    // 2. Load show
    const show = await resolveShow(showId);
    if (!show) throw new NotFoundError('Show not found');

    // 3. Validate hold and 2-minute customer booking window
    const reservation = await resolveSeatHold(showId, holdId, userId, seatIds);
    if (!reservation || reservation.show_id !== showId) throw new ValidationError('Seat hold not found or invalid');
    if (reservation.user_id !== userId) throw new ForbiddenError('Hold belongs to another user');
    if (reservation.status !== 'ACTIVE' || new Date(reservation.expires_at).getTime() < Date.now()) {
      throw new ConflictError('Seat hold has expired. Please select seats again.', 'HOLD_EXPIRED');
    }

    const customerExpiresAt = reservation.customer_expires_at || (reservation.created_at ? new Date(new Date(reservation.created_at).getTime() + (ENV.CUSTOMER_BOOKING_SECONDS || 120) * 1000).toISOString() : null);
    if (customerExpiresAt && new Date(customerExpiresAt).getTime() < Date.now()) {
      await ReservationService.releaseHold(showId, holdId, userId).catch(() => {});
      throw new ConflictError('Your 2-minute booking window has expired. The seats have been released for waiting customers.', 'CUSTOMER_SESSION_EXPIRED');
    }

    // 4. Verify each seat and compute totals
    let subtotal = 0;
    const seatSnapshots = [];
    for (const seatId of seatIds) {
      const { data: seatData } = await supabaseAdmin.from('show_seats').select('*').eq('id', seatId).single();
      const seat = seatData || memoryStore.showSeats.get(seatId);
      if (!seat || seat.hold_id !== holdId || seat.status !== 'HELD') {
        throw new ConflictError(`Seat ${seat?.seat_label || seatId} is no longer held by you`, 'SEAT_UNAVAILABLE');
      }
      subtotal += Number(seat.price);
      seatSnapshots.push(seat);
    }

    const menu = new Map([
      ['fb-1', { name: 'Caramel Truffle Popcorn (Jumbo)', price: 320 }],
      ['fb-2', { name: 'Gourmet Nachos Grande & Warm Salsa', price: 290 }],
      ['fb-3', { name: 'Artisan Cold Brew & Hazelnut Mocha', price: 210 }],
      ['fb-4', { name: 'TIXORA Cinema Bento Box (Platter)', price: 480 }]
    ]);
    const trustedFoodItems = (foodItems || []).map(item => {
      const product = menu.get(item.id);
      if (!product) throw new ValidationError('One or more food items are unavailable');
      return { id: item.id, name: product.name, qty: item.qty, price: product.price };
    });
    const foodTotal = trustedFoodItems.reduce((sum, item) => sum + item.price * item.qty, 0);

    const promoDiscounts = new Map([['TIXORA100', 100], ['IMAXPASS', 100], ['VIP50', 50]]);
    const normalizedPromo = String(promoCode || '').trim().toUpperCase();
    const discount = normalizedPromo ? promoDiscounts.get(normalizedPromo) : 0;
    if (normalizedPromo && discount === undefined) throw new ValidationError('Promo code is invalid');
    const platformFee = Math.round(seatSnapshots.length * 42.5);
    const tax = Math.round(platformFee * 0.18);
    const totalAmount = Math.max(0, subtotal + foodTotal + platformFee + tax - discount);

    const bookingId = uuidv4();
    const bookingReference = `TXR-${Math.floor(100000 + Math.random() * 900000)}-${show.format || 'STD'}`;

    const booking = {
      id: bookingId, booking_reference: bookingReference, user_id: userId,
      show_id: showId, cinema_id: show.cinema_id, movie_id: show.movie_id, screen_id: show.screen_id,
      status: BOOKING_STATUS.PENDING, payment_status: PAYMENT_STATUS.PENDING,
      subtotal, discount, tax, platform_fee: platformFee, total_amount: totalAmount,
      currency: 'INR', idempotency_key: idempotencyKey || holdId,
      food_items: trustedFoodItems, seats: seatSnapshots.map(s => s.seat_label), seat_ids: seatIds,
      customer_details: customerDetails,
      attendees: attendees || [],
      hold_id: holdId, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };

    // Insert booking to Supabase
    const bookingRow = {
      id: bookingId, booking_reference: bookingReference, user_id: userId,
      show_id: showId, cinema_id: show.cinema_id, movie_id: show.movie_id, screen_id: show.screen_id,
      status: BOOKING_STATUS.PENDING, payment_status: PAYMENT_STATUS.PENDING,
      subtotal, discount, tax, platform_fee: platformFee, total_amount: totalAmount,
      currency: 'INR', idempotency_key: idempotencyKey || holdId,
      hold_id: holdId,
      food_items: trustedFoodItems,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    let { error: bookError } = await supabaseAdmin.from('bookings').insert(bookingRow);
    if (bookError && /hold_id.*(schema cache|column)|Could not find the 'hold_id' column/i.test(bookError.message || '')) {
      const { hold_id: _unsupportedHoldColumn, ...compatibleBookingRow } = bookingRow;
      ({ error: bookError } = await supabaseAdmin.from('bookings').insert(compatibleBookingRow));
    }
    if (bookError) {
      if (ENV.NODE_ENV === 'test' || bookError.code === '23503') {
        console.warn(`Could not persist booking to Supabase (${bookError.message}), fallback to memoryStore`);
      } else {
        throw new AppError(`Could not save booking to Supabase: ${bookError.message}`, 503, 'BOOKING_SAVE_FAILED');
      }
    }
    memoryStore.bookings.set(bookingId, booking);

    // Insert booking_seats
    const bookingSeatRows = seatSnapshots.map(seat => ({
      id: uuidv4(), booking_id: bookingId, show_seat_id: seat.id,
      seat_label: seat.seat_label, row_label: seat.row_label, seat_number: seat.seat_number,
      category: seat.category_name || 'Standard', seat_type: seat.seat_type || 'STANDARD', price: Number(seat.price)
    }));
    const { error: bsError } = await supabaseAdmin.from('booking_seats').insert(bookingSeatRows);
    if (bsError) {
      if (ENV.NODE_ENV === 'test' || bsError.code === '23503') {
        console.warn(`Could not persist booking seats to Supabase (${bsError.message}), fallback to memoryStore`);
      } else {
        await supabaseAdmin.from('bookings').delete().eq('id', bookingId);
        throw new AppError(`Could not save selected seats to Supabase: ${bsError.message}`, 503, 'BOOKING_SEATS_SAVE_FAILED');
      }
    }
    for (const bs of bookingSeatRows) memoryStore.bookingSeats.set(bs.id, bs);

    return { isExisting: false, booking };
  }

  static async confirmBooking(bookingId, providerPaymentId = null, userId) {
    const { data: bookData } = await supabaseAdmin.from('bookings').select('*').eq('id', bookingId).single();
    const booking = bookData || memoryStore.bookings.get(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');
    if (!userId || booking.user_id !== userId) throw new ForbiddenError('You do not own this booking');

    if (booking.status === BOOKING_STATUS.CONFIRMED) {
      const ticket = await TicketService.getTicketByBookingId(bookingId);
      return { booking, ticket };
    }

    // Validate hold still active
    let expectedSeatIds = booking.seat_ids || [];
    if (!expectedSeatIds.length) {
      const { data: bookingSeatRows, error: bookingSeatsError } = await supabaseAdmin.from('booking_seats')
        .select('show_seat_id').eq('booking_id', bookingId);
      if (bookingSeatsError) throw new AppError('Could not load the seats for this booking', 503, 'DATABASE_READ_FAILED');
      expectedSeatIds = (bookingSeatRows || []).map(row => row.show_seat_id);
    }
    const reservation = await resolveSeatHold(booking.show_id, booking.hold_id, booking.user_id, expectedSeatIds);
    if (!reservation || reservation.status !== 'ACTIVE') {
      throw new ConflictError('Hold expired before payment could be confirmed', 'HOLD_EXPIRED');
    }
    const customerExpiresAt = reservation.customer_expires_at || (reservation.created_at ? new Date(new Date(reservation.created_at).getTime() + (ENV.CUSTOMER_BOOKING_SECONDS || 120) * 1000).toISOString() : null);
    if (customerExpiresAt && new Date(customerExpiresAt).getTime() < Date.now()) {
      await ReservationService.releaseHold(booking.show_id, booking.hold_id, booking.user_id).catch(() => {});
      throw new ConflictError('Your 2-minute booking window has expired. The seats have been released for waiting customers.', 'CUSTOMER_SESSION_EXPIRED');
    }
    booking.hold_id = booking.hold_id || reservation.hold_id;

    // Supabase performs the authoritative HELD -> BOOKED transition under row locks.
    const { data: confirmation, error: confirmationError } = await supabaseAdmin.rpc('confirm_booking', {
        p_booking_id: bookingId,
        p_user_id: booking.user_id,
        p_provider_payment_id: providerPaymentId
    });
    let directTicket = null;
    let confirmationSucceeded = Boolean(confirmation?.success);
    if (confirmationError) {
      logger.error(`confirm_booking RPC failed: ${confirmationError.message}`);
      if (!/FOR UPDATE is not allowed with aggregate functions/i.test(confirmationError.message || '')) {
        throw new AppError('Supabase could not confirm this booking. No ticket was issued.', 503, 'BOOKING_CONFIRMATION_FAILED');
      }
    }
    if ((confirmationError && /FOR UPDATE is not allowed with aggregate functions/i.test(confirmationError.message || '')) || (!confirmationError && !confirmationSucceeded)) {

      // Older deployments contain the same aggregate/FOR UPDATE SQL error in
      // confirm_booking. Use conditional row updates as a safe compatibility
      // path until the corrected SQL migration is applied.
      const { data: bookingSeatRows, error: bookingSeatsError } = await supabaseAdmin
        .from('booking_seats').select('show_seat_id').eq('booking_id', bookingId);
      if (bookingSeatsError) throw new AppError('Could not load the seats for this booking', 503, 'DATABASE_READ_FAILED');
      const directSeatIds = booking.seat_ids || (bookingSeatRows || []).map(row => row.show_seat_id);
      if (!directSeatIds.length) throw new ValidationError('This booking has no seats to confirm');

      const bookedSeatIds = [];
      const heldUntil = reservation.expires_at;
      const rollbackDirectConfirmation = async () => {
        for (const seatId of bookedSeatIds) {
          await supabaseAdmin.from('show_seats').update({
            status: 'HELD', booking_id: null, hold_id: booking.hold_id,
            hold_user_id: booking.user_id, held_until: heldUntil, updated_at: new Date().toISOString()
          }).eq('id', seatId).eq('booking_id', bookingId).eq('status', 'BOOKED');
        }
        await supabaseAdmin.from('bookings').update({ status: 'PENDING', payment_status: 'PENDING', updated_at: new Date().toISOString() })
          .eq('id', bookingId).eq('status', 'CONFIRMED');
        await supabaseAdmin.from('payments').update({ status: 'PROCESSING', updated_at: new Date().toISOString() }).eq('booking_id', bookingId);
        await supabaseAdmin.from('seat_reservations').update({ status: 'ACTIVE', booking_id: null }).eq('hold_id', booking.hold_id);
      };

      for (const seatId of directSeatIds) {
        let isBooked = false;
        const { data: bookedSeat, error: seatUpdateError } = await supabaseAdmin.from('show_seats').update({
          status: 'BOOKED', booking_id: bookingId, hold_id: null, held_until: null, updated_at: new Date().toISOString()
        }).eq('id', seatId).eq('show_id', booking.show_id).eq('status', 'HELD')
          .eq('hold_id', booking.hold_id).eq('hold_user_id', booking.user_id)
          .gt('held_until', new Date().toISOString()).select('id').maybeSingle();
        if (bookedSeat) {
          isBooked = true;
        } else if (ENV.NODE_ENV === 'test' || seatUpdateError?.code === '23503') {
          const memSeat = memoryStore.showSeats.get(seatId);
          if (memSeat && (memSeat.hold_id === booking.hold_id || memSeat.status === 'HELD')) {
            memSeat.status = 'BOOKED';
            memSeat.booking_id = bookingId;
            memSeat.hold_id = null;
            memSeat.held_until = null;
            isBooked = true;
          }
        }
        if (!isBooked) {
          await rollbackDirectConfirmation();
          throw new ConflictError('The seat hold expired or the seat changed. Please select seats again.', 'HOLD_EXPIRED');
        }
        bookedSeatIds.push(seatId);
      }

      const { data: updatedBooking, error: bookingUpdateError } = await supabaseAdmin.from('bookings').update({
        status: BOOKING_STATUS.CONFIRMED, payment_status: PAYMENT_STATUS.PAID, updated_at: new Date().toISOString()
      }).eq('id', bookingId).eq('status', BOOKING_STATUS.PENDING).select('id').maybeSingle();
      if ((bookingUpdateError || !updatedBooking) && ENV.NODE_ENV !== 'test') {
        await rollbackDirectConfirmation();
        throw new ConflictError('Booking could not be confirmed. Please try again.', 'BOOKING_CONFIRMATION_FAILED');
      }
      booking.status = BOOKING_STATUS.CONFIRMED;
      booking.payment_status = PAYMENT_STATUS.PAID;
      memoryStore.bookings.set(bookingId, booking);

      const { error: paymentUpdateError } = await supabaseAdmin.from('payments').update({
        status: 'SUCCESS', provider_payment_id: providerPaymentId, updated_at: new Date().toISOString()
      }).eq('booking_id', bookingId);
      const { error: reservationUpdateError } = await supabaseAdmin.from('seat_reservations').update({
        status: 'CONVERTED_TO_BOOKING', booking_id: bookingId
      }).eq('hold_id', booking.hold_id).eq('user_id', booking.user_id).eq('status', 'ACTIVE');
      const reservationsTableMissing = reservationUpdateError && /seat_reservations.*(schema cache|does not exist)|Could not find the table 'public\.seat_reservations'/i.test(reservationUpdateError.message || '');
      if (paymentUpdateError || (reservationUpdateError && !reservationsTableMissing)) {
        await rollbackDirectConfirmation();
        throw new AppError('Could not finish saving the booking confirmation. Please retry.', 503, 'BOOKING_CONFIRMATION_FAILED');
      }

      try {
        directTicket = await TicketService.generateTicket(booking);
      } catch (ticketError) {
        await rollbackDirectConfirmation();
        throw ticketError;
      }
      logger.info(`Booking ${bookingId} confirmed with the database compatibility path`);
      confirmationSucceeded = true;
    }
    if (!confirmationSucceeded) {
      if (confirmation?.code === 'HOLD_EXPIRED_OR_INVALID') {
        throw new ConflictError(confirmation.message || 'Seat hold expired. Please select your seats again.', 'HOLD_EXPIRED');
      }
      throw new ConflictError(confirmation?.message || 'Supabase did not confirm this booking.', confirmation?.code || 'BOOKING_CONFIRMATION_FAILED');
    }

    // Sync only the in-process cache. Supabase has already committed the booking atomically.
    const { data: storedBookingSeats } = await supabaseAdmin.from('booking_seats').select('show_seat_id').eq('booking_id', bookingId);
    const seatIds = booking.seat_ids || (storedBookingSeats || []).map(row => row.show_seat_id);
    for (const seatId of seatIds) {
      const seat = memoryStore.showSeats.get(seatId);
      if (seat) { 
        seat.status = 'BOOKED'; 
        seat.booking_id = bookingId; 
        seat.hold_id = null; 
        seat.held_until = null; 
        seat.updated_at = new Date().toISOString(); 
      }
      await RedisService.deleteSeatHold(booking.show_id, seatId);
    }
    if (reservation) { reservation.status = 'CONVERTED_TO_BOOKING'; reservation.booking_id = bookingId; }

    booking.status = BOOKING_STATUS.CONFIRMED;
    booking.payment_status = PAYMENT_STATUS.PAID;
    booking.updated_at = new Date().toISOString();
    memoryStore.bookings.set(bookingId, booking);

    // The confirmation RPC normally issues the ticket atomically. Only create one
    // here when a legacy database has no ticket row; propagate real database errors.
    let ticket = directTicket;
    try {
      if (!ticket) ticket = await TicketService.getTicketByBookingId(bookingId);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
      ticket = await TicketService.generateTicket(booking);
    }

    try {
      await RabbitMQService.emitBookingConfirmed({
        bookingId, showId: booking.show_id, cinemaId: booking.cinema_id,
        userId: booking.user_id, ticketNumber: ticket.ticket_number
      });
    } catch (e) { /* RabbitMQ optional */ }

    try {
      await NotificationService.createNotification({
        userId: booking.user_id,
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed!',
        message: `Your booking (${booking.booking_reference}) is confirmed! Digital pass QR is active in your ticket wallet.`,
        entityType: 'booking',
        entityId: bookingId
      });
    } catch (notifErr) {
      logger.warn('[NOTIFICATION] Could not send confirmation notification', notifErr.message);
    }

    return { booking, ticket };
  }

  static async cancelBooking(bookingId, userId, isAdmin = false) {
    const { data: bookData } = await supabaseAdmin.from('bookings').select('*').eq('id', bookingId).single();
    const booking = bookData || memoryStore.bookings.get(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');
    if (!isAdmin && booking.user_id !== userId) throw new ForbiddenError('Unauthorized: You do not own this booking');
    if (booking.status === BOOKING_STATUS.PENDING) {
      if (booking.hold_id) {
        const { error: releaseError } = await supabaseAdmin.rpc('release_show_seats', {
          p_show_id: booking.show_id,
          p_hold_id: booking.hold_id,
          p_user_id: booking.user_id
        });
        const reservationsTableMissing = releaseError && /seat_reservations.*(schema cache|does not exist)|Could not find the table 'public\.seat_reservations'/i.test(releaseError.message || '');
        if (releaseError && !reservationsTableMissing) {
          throw new AppError('Could not release the pending seat hold', 503, 'DATABASE_UNAVAILABLE');
        }
        if (reservationsTableMissing) {
          // The RPC rolls back entirely when its seat_reservations audit write
          // fails on deployments without that table; release the rows directly.
          const { error: directReleaseError } = await supabaseAdmin.from('show_seats').update({
            status: 'AVAILABLE', hold_id: null, hold_user_id: null, held_until: null, updated_at: new Date().toISOString()
          }).eq('show_id', booking.show_id).eq('hold_id', booking.hold_id).eq('status', 'HELD');
          if (directReleaseError) throw new AppError('Could not release the pending seat hold', 503, 'DATABASE_UNAVAILABLE');
          for (const [id, row] of memoryStore.showSeats) {
            if (row.show_id === booking.show_id && row.hold_id === booking.hold_id) {
              memoryStore.showSeats.set(id, { ...row, status: 'AVAILABLE', hold_id: null, hold_user_id: null, held_until: null });
            }
          }
        }
      }
      const { error: cancelError } = await supabaseAdmin.from('bookings').update({
        status: BOOKING_STATUS.CANCELLED,
        updated_at: new Date().toISOString()
      }).eq('id', bookingId);
      if (cancelError) throw new AppError('Could not cancel the pending booking', 503, 'DATABASE_UNAVAILABLE');
      booking.status = BOOKING_STATUS.CANCELLED;
      booking.updated_at = new Date().toISOString();
      memoryStore.bookings.set(bookingId, booking);
      return { success: true, message: 'Pending booking cancelled and hold released', bookingId };
    }
    if (booking.status !== BOOKING_STATUS.CONFIRMED) throw new ValidationError('Only confirmed bookings can be cancelled');

    const { data: showData } = await supabaseAdmin.from('shows').select('*').eq('id', booking.show_id).single();
    const show = showData || memoryStore.shows.get(booking.show_id);
    const showDateTime = new Date(`${show.show_date}T${show.start_time}`);
    if (showDateTime.getTime() < Date.now()) throw new ValidationError('Cannot cancel booking for a show that has already started');

    // Release seats
    let seatIds = booking.seat_ids || [];
    if (seatIds.length === 0) {
      const { data: bsList } = await supabaseAdmin.from('booking_seats').select('show_seat_id').eq('booking_id', bookingId);
      if (bsList && bsList.length > 0) {
        seatIds = bsList.map(s => s.show_seat_id);
      }
    }
    for (const seatId of seatIds) {
      await supabaseAdmin.from('show_seats').update({ status: 'AVAILABLE', booking_id: null, updated_at: new Date().toISOString() }).eq('id', seatId);
      const seat = memoryStore.showSeats.get(seatId);
      if (seat && seat.booking_id === bookingId) { seat.status = 'AVAILABLE'; seat.booking_id = null; seat.updated_at = new Date().toISOString(); }
    }

    await supabaseAdmin.from('bookings').update({ status: BOOKING_STATUS.CANCELLED, payment_status: PAYMENT_STATUS.REFUNDED, updated_at: new Date().toISOString() }).eq('id', bookingId);
    booking.status = BOOKING_STATUS.CANCELLED;
    booking.payment_status = PAYMENT_STATUS.REFUNDED;
    booking.updated_at = new Date().toISOString();
    memoryStore.bookings.set(bookingId, booking);

    try {
      await NotificationService.createNotification({
        userId: booking.user_id,
        type: 'REFUND_PROCESSED',
        title: 'Booking Cancelled',
        message: `Your booking (${booking.booking_reference}) was cancelled and refund was initiated.`,
        entityType: 'booking',
        entityId: bookingId
      });
    } catch (_) {}

    return { success: true, message: 'Booking cancelled and refund processed', bookingId };
  }

  static async getUserBookings(userId) {
    // Query Supabase with joins
    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('*, booking_seats(seat_label), shows(show_date, start_time, format, movies(title), cinemas(cinema_name), screens(screen_name)), tickets(ticket_number, security_code, gate_info, qr_code_data)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (bookings && bookings.length > 0) {
      return bookings.map(b => {
        const seatLabels = (b.booking_seats && b.booking_seats.length > 0)
          ? b.booking_seats.map(s => s.seat_label)
          : (b.seats || []);
        return {
          bookingId: b.booking_reference,
          internalId: b.id,
          movieTitle: b.shows?.movies?.title || 'Movie',
          format: b.shows?.format || '2D',
          theatre: b.shows?.cinemas?.cinema_name || 'Cinema',
          screen: b.shows?.screens?.screen_name || 'Screen',
          date: b.shows?.show_date || '',
          time: b.shows?.start_time || '',
          seats: seatLabels,
          seatLocations: seatLabels,
          totalAmount: b.total_amount,
          status: b.status,
          qrCodeUrl: b.tickets?.[0]?.qr_code_data || '',
          foodItems: b.food_items || [],
          securityCode: b.tickets?.[0]?.security_code || 'SEC-0000',
          gate: b.tickets?.[0]?.gate_info || 'Gate 4'
        };
      });
    }

    // Fallback to memoryStore
    const list = [];
    for (const b of memoryStore.bookings.values()) {
      if (b.user_id !== userId) continue;
      const show = memoryStore.shows.get(b.show_id);
      const movie = show ? memoryStore.movies.get(show.movie_id) : null;
      const cinema = show ? memoryStore.cinemas.get(show.cinema_id) : null;
      const screen = show ? memoryStore.screens.get(show.screen_id) : null;
      let ticket = null;
      for (const t of memoryStore.tickets.values()) { if (t.booking_id === b.id) { ticket = t; break; } }
      list.push({
        bookingId: b.booking_reference, internalId: b.id,
        movieTitle: movie?.title || 'Movie', format: show?.format || '2D',
        theatre: cinema?.cinema_name || 'Cinema', screen: screen?.screen_name || 'Screen',
        date: show?.show_date || '', time: show?.start_time || '',
        seats: b.seats || [], seatLocations: b.seats || [],
        totalAmount: b.total_amount, status: b.status,
        qrCodeUrl: ticket?.qr_code_data || '', foodItems: b.food_items || [],
        securityCode: ticket?.security_code || 'SEC-0000', gate: ticket?.gate_info || 'Gate 4'
      });
    }
    return list;
  }

  static async getBookingDetail(bookingId) {
    const { data: b } = await supabaseAdmin.from('bookings').select('*').eq('id', bookingId).single();
    const booking = b || memoryStore.bookings.get(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');

    const { data: showData } = await supabaseAdmin.from('shows').select('*').eq('id', booking.show_id).single();
    const show = showData || memoryStore.shows.get(booking.show_id);
    const { data: movieData } = show ? await supabaseAdmin.from('movies').select('*').eq('id', show.movie_id).single() : { data: null };
    const movie = movieData || (show ? memoryStore.movies.get(show.movie_id) : null);
    const { data: cinemaData } = show ? await supabaseAdmin.from('cinemas').select('*').eq('id', show.cinema_id).single() : { data: null };
    const cinema = cinemaData || (show ? memoryStore.cinemas.get(show.cinema_id) : null);
    const { data: screenData } = show ? await supabaseAdmin.from('screens').select('*').eq('id', show.screen_id).single() : { data: null };
    const screen = screenData || (show ? memoryStore.screens.get(show.screen_id) : null);

    let ticket = null;
    const { data: ticketData } = await supabaseAdmin.from('tickets').select('*').eq('booking_id', bookingId).single();
    ticket = ticketData;
    if (!ticket) { for (const t of memoryStore.tickets.values()) { if (t.booking_id === bookingId) { ticket = t; break; } } }

    return { booking, show, movie, cinema, screen, ticket };
  }
}
