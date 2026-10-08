import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, memoryStore } from '../config/supabase.js';
import { RedisService } from './redis.service.js';
import { RabbitMQService } from './rabbitmq.service.js';
import { ENV } from '../config/env.js';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { SeatPlanService } from './seatPlan.service.js';
import { logger } from '../utils/logger.js';

export async function resolveShow(showId) {
  let show = memoryStore.shows.get(showId);
  if (show) return show;

  const { data } = await supabaseAdmin.from('shows').select('*').eq('id', showId).maybeSingle();
  if (data) {
    memoryStore.shows.set(data.id, data);
    return data;
  }

  if (typeof showId === 'string' && showId.startsWith('SHOW-')) {
    const parts = showId.split('-');
    const moviePrefix = parts[1];
    const cinemaPrefix = parts[2];
    const dayStr = parts[3];
    const slotIdx = parseInt(parts[4] || '1', 10) - 1;
    const defaultTimes = ['10:30 AM', '02:15 PM', '06:45 PM', '09:30 PM'];
    const formattedDay = dayStr?.length === 8 ? `${dayStr.slice(0,4)}-${dayStr.slice(4,6)}-${dayStr.slice(6,8)}` : (dayStr || new Date().toISOString().slice(0, 10));

    const { data: mList } = await supabaseAdmin.from('movies').select('*');
    const { data: cList } = await supabaseAdmin.from('cinemas').select('*, screens(*)');
    const movie = mList?.find(m => m.id?.startsWith(moviePrefix)) || [...memoryStore.movies.values()].find(m => m.id?.startsWith(moviePrefix));
    const cinema = cList?.find(c => c.id?.startsWith(cinemaPrefix)) || [...memoryStore.cinemas.values()].find(c => c.id?.startsWith(cinemaPrefix));

    if (cinema) {
      const screens = cinema.screens || [];
      const screen = screens[0] || { id: uuidv4(), screen_name: 'Auditorium 1 (Laser XE)' };
      show = {
        id: showId,
        movie_id: movie?.id || moviePrefix,
        cinema_id: cinema.id,
        screen_id: screen.id,
        show_date: formattedDay,
        start_time: defaultTimes[slotIdx] || '10:30 AM',
        format: movie?.formats?.[0] || 'Standard 2D',
        status: 'PUBLISHED'
      };
      memoryStore.shows.set(showId, show);
      return show;
    }
  }

  return null;
}

export class ReservationService {
  // Hold multiple seats atomically (all or nothing)
  static async holdSeats(showId, seatIds, userId) {
    if (!seatIds.length) {
      throw new ValidationError('At least one seat must be selected');
    }
    if (seatIds.length > ENV.MAX_SEAT_SELECTION) {
      throw new ValidationError(`Cannot select more than ${ENV.MAX_SEAT_SELECTION} seats`);
    }

    const show = await resolveShow(showId);
    if (!show) throw new NotFoundError('Show not found');

    const { data: movieData } = await supabaseAdmin.from('movies').select('status').eq('id', show.movie_id).single();
    const movie = movieData || memoryStore.movies.get(show.movie_id);
    if (movie && movie.status !== 'ACTIVE') {
      throw new ForbiddenError('Tickets cannot be reserved until this film has been approved by the platform administrator.');
    }

    const now = Date.now();
    const holdDurationMs = ENV.SEAT_HOLD_SECONDS * 1000;
    const customerDurationMs = (ENV.CUSTOMER_BOOKING_SECONDS || 120) * 1000;
    const expiresAt = new Date(now + holdDurationMs).toISOString();
    const customerExpiresAt = new Date(now + customerDurationMs).toISOString();
    const holdId = uuidv4();
    const lockToken = uuidv4();

    // 1. Acquire distributed lock for requested seats
    const lockedSeats = [];
    for (const seatId of seatIds) {
      const acquired = await RedisService.acquireSeatLock(showId, seatId, lockToken, 5);
      if (acquired) {
        lockedSeats.push(seatId);
      } else {
        // Release any partially acquired locks
        for (const locked of lockedSeats) {
          await RedisService.releaseSeatLock(showId, locked, lockToken);
        }
        throw new ConflictError('One or more selected seats are currently being processed. Please retry.', 'SEAT_UNAVAILABLE');
      }
    }

    try {
      // 2. Authoritative PostgreSQL / memoryStore state verification
      const candidateSeats = [];
      const conflicts = [];

      for (const seatId of seatIds) {
        // Check Supabase first, fallback to memoryStore
        const { data: seatData } = await supabaseAdmin.from('show_seats').select('*').eq('id', seatId).single();
        const seat = seatData || memoryStore.showSeats.get(seatId);
        if (!seat || seat.show_id !== showId) {
          conflicts.push({ seatId, reason: 'NOT_FOUND' });
          continue;
        }

        const isExpired = seat.status === 'HELD' && seat.held_until && new Date(seat.held_until).getTime() <= now;
        const isHeldByMe = seat.status === 'HELD' && seat.hold_user_id === userId;

        if (seat.status === 'AVAILABLE' || isExpired || isHeldByMe) {
          candidateSeats.push(seat);
        } else {
          conflicts.push({
            seatId,
            seatLabel: seat.seat_label,
            status: seat.status,
            reason: seat.status === 'BOOKED' ? 'SEAT_BOOKED' : 'HELD_BY_ANOTHER_USER'
          });
        }
      }

      if (conflicts.length > 0) {
        throw new ConflictError('One or more selected seats are no longer available.', 'SEAT_UNAVAILABLE');
      }

      let claimResult = null;
      let claimedDirectly = false;
      if (ENV.NODE_ENV !== 'test') {
        try {
          const { data, error } = await supabaseAdmin.rpc('claim_show_seats', {
            p_show_id: showId,
            p_seat_ids: seatIds,
            p_user_id: userId,
            p_hold_id: holdId,
            p_hold_seconds: ENV.SEAT_HOLD_SECONDS
          });
          if (!error && data?.success) {
            claimResult = data;
          } else if (data && !data.success) {
            throw new ConflictError(data.message || 'One or more seats are unavailable', data.code || 'SEAT_UNAVAILABLE');
          } else if (error && /FOR UPDATE is not allowed with aggregate functions/i.test(error.message || '')) {
            // Compatibility path for databases that still have the older broken
            // claim_show_seats function. Conditional updates are the per-seat
            // compare-and-set, so concurrent customers cannot claim the same row.
            const claimedRows = [];
            for (const seat of candidateSeats) {
              const holdValues = {
                status: 'HELD', hold_id: holdId, hold_user_id: userId,
                held_until: expiresAt, updated_at: new Date().toISOString()
              };
              let { data: claimed, error: claimError } = await supabaseAdmin.from('show_seats')
                .update(holdValues).eq('id', seat.id).eq('show_id', showId).eq('status', 'AVAILABLE')
                .select('*').maybeSingle();
              if (!claimError && !claimed) {
                ({ data: claimed, error: claimError } = await supabaseAdmin.from('show_seats')
                  .update(holdValues).eq('id', seat.id).eq('show_id', showId).eq('status', 'HELD')
                  .eq('hold_user_id', userId).lte('held_until', new Date(now).toISOString())
                  .select('*').maybeSingle());
              }
              if (!claimError && !claimed) {
                ({ data: claimed, error: claimError } = await supabaseAdmin.from('show_seats')
                  .update(holdValues).eq('id', seat.id).eq('show_id', showId).eq('status', 'HELD')
                  .eq('hold_user_id', userId).gt('held_until', new Date(now).toISOString())
                  .select('*').maybeSingle());
              }
              if (claimError || !claimed) {
                await supabaseAdmin.from('show_seats').update({
                  status: 'AVAILABLE', hold_id: null, hold_user_id: null, held_until: null, updated_at: new Date().toISOString()
                }).eq('show_id', showId).eq('hold_id', holdId).eq('status', 'HELD');
                if (claimError) throw new AppError(`Could not reserve seats in Supabase: ${claimError.message}`, 503, 'SEAT_RESERVATION_FAILED');
                throw new ConflictError('One or more selected seats were just taken. Please choose another seat.', 'SEAT_UNAVAILABLE');
              }
              claimedRows.push(claimed);
            }
            claimedDirectly = true;
            claimResult = { success: true, expiresAt };
            for (const row of claimedRows) memoryStore.showSeats.set(row.id, row);
          } else if (error) {
            throw new AppError(`Could not reserve seats in Supabase: ${error.message}`, 503, 'SEAT_RESERVATION_FAILED');
          } else {
            throw new AppError('Supabase did not confirm the seat reservation.', 503, 'SEAT_RESERVATION_FAILED');
          }
        } catch (rpcErr) {
          if (rpcErr instanceof ConflictError || rpcErr instanceof AppError) throw rpcErr;
          logger.error(`claim_show_seats RPC failed: ${rpcErr.message}`);
          throw new AppError('Could not reserve these seats. Please try again.', 503, 'SEAT_RESERVATION_FAILED');
        }
      }
      const persistedExpiresAt = claimResult?.expiresAt || expiresAt;

      // 3. Atomically transition seats to HELD in Supabase and memoryStore
      for (const seat of candidateSeats) {
        if (ENV.NODE_ENV === 'test') {
          await supabaseAdmin.from('show_seats').update({
            status: 'HELD', hold_id: holdId, hold_user_id: userId,
            held_until: expiresAt, updated_at: new Date().toISOString()
          }).eq('id', seat.id);
        }
        // Update memoryStore
        const memSeat = memoryStore.showSeats.get(seat.id) || seat;
        memSeat.status = 'HELD';
        memSeat.hold_id = holdId;
        memSeat.hold_user_id = userId;
        memSeat.held_until = persistedExpiresAt;
        memSeat.updated_at = new Date().toISOString();
        memoryStore.showSeats.set(seat.id, memSeat);

        // Sync Redis TTL hold (3-minute hard hold in Redis)
        await RedisService.setSeatHold(
          showId,
          seat.id,
          { holdId, userId, expiresAt: persistedExpiresAt, customerExpiresAt },
          ENV.SEAT_HOLD_SECONDS
        );
      }

      const reservationRecord = {
        id: uuidv4(), hold_id: holdId, show_id: showId, user_id: userId,
        show_seat_ids: seatIds, status: 'ACTIVE', expires_at: persistedExpiresAt,
        customer_expires_at: customerExpiresAt,
        created_at: new Date().toISOString()
      };
      if (ENV.NODE_ENV === 'test' || claimedDirectly) {
        const { error: reservationInsertError } = await supabaseAdmin.from('seat_reservations').insert({
          id: reservationRecord.id, hold_id: holdId, show_id: showId, user_id: userId,
          show_seat_ids: seatIds, status: 'ACTIVE', expires_at: expiresAt, created_at: reservationRecord.created_at
        });
        const reservationsTableMissing = reservationInsertError && /seat_reservations.*(schema cache|does not exist)|Could not find the table 'public\.seat_reservations'/i.test(reservationInsertError.message || '');
        if (reservationInsertError && !reservationsTableMissing) {
          if (claimedDirectly) await supabaseAdmin.from('show_seats').update({
            status: 'AVAILABLE', hold_id: null, hold_user_id: null, held_until: null, updated_at: new Date().toISOString()
          }).eq('show_id', showId).eq('hold_id', holdId).eq('status', 'HELD');
          throw new AppError(`Could not save the seat hold: ${reservationInsertError.message}`, 503, 'SEAT_RESERVATION_FAILED');
        }
      }
      memoryStore.seatReservations.set(holdId, reservationRecord);

      // 4. Emit async RabbitMQ event
      await RabbitMQService.emitSeatHoldCreated({
        showId,
        showSeatIds: seatIds,
        holdId,
        userId,
        expiresAt: persistedExpiresAt,
        customerExpiresAt
      });

      return {
        holdId,
        showId,
        seats: candidateSeats.map(s => ({
          id: s.id,
          label: s.seat_label,
          row: s.row_label,
          number: s.seat_number,
          tier: s.category_name,
          price: s.price,
          status: 'HELD'
        })),
        expiresAt: persistedExpiresAt,
        customerExpiresAt,
        durationSeconds: ENV.SEAT_HOLD_SECONDS,
        customerDurationSeconds: ENV.CUSTOMER_BOOKING_SECONDS || 120
      };
    } finally {
      // Always release distributed coordination locks
      for (const seatId of lockedSeats) {
        await RedisService.releaseSeatLock(showId, seatId, lockToken);
      }
    }
  }

  // Release hold voluntarily and trigger immediate promotion of waiting queue
  static async releaseHold(showId, holdId, userId) {
    const { data: storedReservation, error: reservationError } = await supabaseAdmin.from('seat_reservations')
      .select('*').eq('hold_id', holdId).eq('show_id', showId).maybeSingle();
    const reservation = storedReservation || memoryStore.seatReservations.get(holdId);
    let resolvedReservation = reservation;
    if (!resolvedReservation && reservationError && /seat_reservations.*(schema cache|does not exist)|Could not find the table 'public\.seat_reservations'/i.test(reservationError.message || '')) {
      const { data: heldRows, error: heldRowsError } = await supabaseAdmin.from('show_seats').select('*')
        .eq('show_id', showId).eq('hold_id', holdId).eq('hold_user_id', userId).eq('status', 'HELD');
      if (heldRowsError) throw new AppError('Could not load the held seats', 503, 'DATABASE_UNAVAILABLE');
      if (heldRows?.length) resolvedReservation = {
        hold_id: holdId, show_id: showId, user_id: userId, show_seat_ids: heldRows.map(row => row.id),
        status: 'ACTIVE', expires_at: heldRows.map(row => row.held_until).sort()[0]
      };
    }
    if (reservationError && !resolvedReservation && !/PGRST116/.test(reservationError.code || '')) throw new AppError('Could not load reservation hold', 503, 'DATABASE_UNAVAILABLE');
    if (!resolvedReservation || resolvedReservation.show_id !== showId) {
      throw new NotFoundError('Reservation hold not found');
    }

    if (userId && resolvedReservation.user_id !== userId) {
      throw new ConflictError('Hold does not belong to this user');
    }

    const heldSeats = await Promise.all((resolvedReservation.show_seat_ids || []).map(async seatId => {
      const { data } = await supabaseAdmin.from('show_seats').select('*').eq('id', seatId).maybeSingle();
      return data || memoryStore.showSeats.get(seatId);
    }));
    if (ENV.NODE_ENV !== 'test') {
      const { error } = await supabaseAdmin.rpc('release_show_seats', {
        p_show_id: showId, p_hold_id: holdId, p_user_id: userId || null
      });
      if (error && !/seat_reservations.*(schema cache|does not exist)|Could not find the table 'public\.seat_reservations'/i.test(error.message || '')) {
        throw new AppError('Could not release reservation hold', 503, 'DATABASE_UNAVAILABLE');
      }
    }

    const releasedSeats = [];
    for (const seat of heldSeats) {
      const seatId = seat?.id;
      if (seat && seat.hold_id === holdId && seat.status === 'HELD') {
        // Update memoryStore explicitly
        const memorySeat = memoryStore.showSeats.get(seatId);
        if (memorySeat) {
          memorySeat.status = 'AVAILABLE';
          memorySeat.hold_id = null;
          memorySeat.hold_user_id = null;
          memorySeat.held_until = null;
          memorySeat.updated_at = new Date().toISOString();
        }
        if (seat) {
          seat.status = 'AVAILABLE';
          seat.hold_id = null;
          seat.hold_user_id = null;
          seat.held_until = null;
          seat.updated_at = new Date().toISOString();
        }
        releasedSeats.push(memorySeat || seat);

        const { error: releaseSeatError } = await supabaseAdmin.from('show_seats').update({
          status: 'AVAILABLE', hold_id: null, hold_user_id: null, held_until: null, updated_at: new Date().toISOString()
        }).eq('id', seatId).eq('show_id', showId).eq('hold_id', holdId).eq('status', 'HELD');
        if (releaseSeatError) throw new AppError('Could not release held seats', 503, 'DATABASE_UNAVAILABLE');

        await RedisService.deleteSeatHold(showId, seatId);

        // Immediately promote next waiting customer in the queue with zero latency
        try {
          await ReservationService.promoteNextCustomer(showId, seatId);
        } catch (promoteErr) {
          logger.warn('Immediate promoteNextCustomer error in releaseHold:', promoteErr?.message);
        }

        // Also trigger queue promotion event for async consumers
        await RabbitMQService.emitQueuePromote({
          showId,
          showSeatId: seatId
        });
      }
    }

    if (resolvedReservation) {
      resolvedReservation.status = 'RELEASED';
      resolvedReservation.released_at = new Date().toISOString();
      memoryStore.seatReservations.set(holdId, resolvedReservation);
    }

    return {
      success: true,
      releasedSeatsCount: releasedSeats.length
    };
  }

  // Join FIFO queue for a contested seat
  static async joinQueue(showId, showSeatId, userId, idempotencyKey) {
    const seat = memoryStore.showSeats.get(showSeatId);
    if (!seat || seat.show_id !== showId) {
      throw new NotFoundError('Show seat not found');
    }

    if (seat.status === 'BLOCKED') {
      throw new ConflictError('Seat is blocked and not eligible for waiting queue', 'SEAT_BLOCKED');
    }

    if (seat.status === 'AVAILABLE') {
      // Seat is available, direct hold should be used
      return {
        isAvailable: true,
        message: 'Seat is currently available, hold directly'
      };
    }

    // Check if user already waiting
    for (const req of memoryStore.seatQueueRequests.values()) {
      if (req.show_seat_id === showSeatId && req.user_id === userId && req.status === 'WAITING') {
        return {
          queueRequestId: req.request_id,
          position: req.queue_position,
          status: 'WAITING',
          message: 'Already in queue for this seat'
        };
      }
    }

    // Determine FIFO position
    let queueLength = 0;
    for (const req of memoryStore.seatQueueRequests.values()) {
      if (req.show_seat_id === showSeatId && req.status === 'WAITING') {
        queueLength++;
      }
    }
    const position = queueLength + 1;
    const requestId = `REQ_${uuidv4().substring(0, 8)}`;

    const queueItem = {
      requestId,
      userId,
      showId,
      showSeatId,
      joinedAt: new Date().toISOString(),
      status: 'WAITING'
    };

    // Add to Redis FIFO queue
    await RedisService.enqueueSeatRequest(showId, showSeatId, queueItem);

    // Save durable DB record
    const dbRecord = {
      id: uuidv4(),
      request_id: requestId,
      show_id: showId,
      show_seat_id: showSeatId,
      user_id: userId,
      status: 'WAITING',
      queue_position: position,
      idempotency_key: idempotencyKey || null,
      joined_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryStore.seatQueueRequests.set(requestId, dbRecord);

    await RabbitMQService.emitQueueJoined({
      showId,
      showSeatId,
      queueRequestId: requestId,
      userId,
      position
    });

    return {
      queueRequestId: requestId,
      position,
      status: 'WAITING',
      estimatedState: 'WAITING'
    };
  }

  // Inspect queue position for requesting user
  static async getQueueStatus(showId, showSeatId, userId) {
    const seat = memoryStore.showSeats.get(showSeatId);
    if (!seat) throw new NotFoundError('Seat not found');

    let myRequest = null;
    let totalWaiting = 0;
    let ahead = 0;

    for (const req of memoryStore.seatQueueRequests.values()) {
      if (req.show_seat_id === showSeatId && req.status === 'WAITING') {
        totalWaiting++;
        if (req.user_id === userId) {
          myRequest = req;
        } else if (!myRequest) {
          ahead++;
        }
      }
    }

    return {
      seatId: seat.seat_label,
      status: seat.status,
      queue: {
        isEnabled: seat.status !== 'BLOCKED',
        position: myRequest ? ahead + 1 : null,
        ahead: myRequest ? ahead : null,
        totalInQueue: totalWaiting
      }
    };
  }

  // Cancel waiting queue entry
  static async cancelQueue(requestId, userId) {
    const req = memoryStore.seatQueueRequests.get(requestId);
    if (!req) throw new NotFoundError('Queue request not found');
    if (userId && req.user_id !== userId) {
      throw new ConflictError('Queue request belongs to another user');
    }

    req.status = 'CANCELLED';
    req.updated_at = new Date().toISOString();

    await RedisService.removeQueueRequest(req.show_id, req.show_seat_id, req.user_id);
    return { success: true, message: 'Removed from queue' };
  }

  // Promote next FIFO waiting customer
  static async promoteNextCustomer(showId, showSeatId) {
    const seat = memoryStore.showSeats.get(showSeatId);
    if (!seat) return null;

    // Must not be already booked or blocked
    if (seat.status === 'BOOKED' || seat.status === 'BLOCKED') {
      return null;
    }

    // Find next valid WAITING request
    const waitingRequests = [];
    for (const req of memoryStore.seatQueueRequests.values()) {
      if (req.show_seat_id === showSeatId && req.status === 'WAITING') {
        waitingRequests.push(req);
      }
    }
    waitingRequests.sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));

    const nextReq = waitingRequests[0];
    if (!nextReq) {
      // If seat is already actively held and not expired, preserve current hold
      if (seat.status === 'HELD' && seat.held_until && new Date(seat.held_until).getTime() > Date.now()) {
        return null;
      }
      // Queue is empty, seat returns to AVAILABLE
      seat.status = 'AVAILABLE';
      seat.hold_id = null;
      seat.hold_user_id = null;
      seat.held_until = null;
      return null;
    }

    const holdId = uuidv4();
    const expiresAt = new Date(Date.now() + ENV.SEAT_HOLD_SECONDS * 1000).toISOString();
    const customerDurationMs = (ENV.CUSTOMER_BOOKING_SECONDS || 120) * 1000;
    const customerExpiresAt = new Date(Date.now() + customerDurationMs).toISOString();

    // Promote customer
    nextReq.status = 'PROMOTED';
    nextReq.promoted_at = new Date().toISOString();
    nextReq.expires_at = expiresAt;

    seat.status = 'HELD';
    seat.hold_id = holdId;
    seat.hold_user_id = nextReq.user_id;
    seat.held_until = expiresAt;
    seat.updated_at = new Date().toISOString();

    await supabaseAdmin.from('show_seats').update({
      status: 'HELD',
      hold_id: holdId,
      hold_user_id: nextReq.user_id,
      held_until: expiresAt,
      updated_at: new Date().toISOString()
    }).eq('id', showSeatId);

    await RedisService.setSeatHold(showId, showSeatId, {
      holdId,
      userId: nextReq.user_id,
      expiresAt,
      customerExpiresAt
    }, ENV.SEAT_HOLD_SECONDS);

    // Save reservation
    memoryStore.seatReservations.set(holdId, {
      id: uuidv4(),
      hold_id: holdId,
      show_id: showId,
      user_id: nextReq.user_id,
      show_seat_ids: [showSeatId],
      status: 'ACTIVE',
      expires_at: expiresAt,
      customer_expires_at: customerExpiresAt,
      source: 'QUEUE_PROMOTION'
    });

    // Create promotion notification for user
    const notifId = uuidv4();
    memoryStore.notifications.set(notifId, {
      id: notifId,
      user_id: nextReq.user_id,
      type: 'YOUR_TURN',
      title: 'Seat Available!',
      message: `Seat ${seat.seat_label} is now available for you. You have 02:00 to complete your booking.`,
      entity_type: 'SEAT_HOLD',
      entity_id: holdId,
      is_read: false,
      created_at: new Date().toISOString()
    });

    return {
      promoted: true,
      userId: nextReq.user_id,
      holdId,
      seatLabel: seat.seat_label,
      expiresAt,
      customerExpiresAt
    };
  }

  static async getSeatMap(showId, currentUserId = null) {
    const show = await resolveShow(showId);
    if (!show) throw new NotFoundError('Show not found');

    const { data: movieData } = await supabaseAdmin.from('movies').select('title, status').eq('id', show.movie_id).single();
    const movie = movieData || memoryStore.movies.get(show.movie_id);
    if (movie && movie.status !== 'ACTIVE') {
      throw new ForbiddenError('This film is awaiting platform administrator approval and is not open for public booking.');
    }
    const { data: cinemaData } = await supabaseAdmin.from('cinemas').select('cinema_name').eq('id', show.cinema_id).single();
    const cinema = cinemaData || memoryStore.cinemas.get(show.cinema_id);
    const { data: screenData } = await supabaseAdmin.from('screens').select('screen_name').eq('id', show.screen_id).single();
    const screen = screenData || memoryStore.screens.get(show.screen_id);

    const now = Date.now();

    const version = show.seat_plan_version_id ? (memoryStore.seatPlanVersions.get(show.seat_plan_version_id) || (await supabaseAdmin.from('seat_plan_versions').select('*').eq('id', show.seat_plan_version_id).single()).data) : null;

    // Load show_seats from Supabase or memoryStore
    const { data: dbSeats } = await supabaseAdmin.from('show_seats').select('*').eq('show_id', showId);
    let rawShowSeats = dbSeats && dbSeats.length > 0 ? dbSeats : [...memoryStore.showSeats.values()].filter(s => s.show_id === showId);

    if (rawShowSeats.length === 0) {
      // Older shows may predate per-show inventory creation. Materialize real rows
      // from this screen's published plan so every seat shown can be held/booked.
      let effectiveScreenId = show.screen_id;
      if (!effectiveScreenId) {
        const { data: cScreens } = await supabaseAdmin.from('screens').select('id').eq('cinema_id', show.cinema_id).limit(1);
        effectiveScreenId = cScreens?.[0]?.id || [...memoryStore.screens.values()][0]?.id;
      }
      if (!effectiveScreenId) throw new ValidationError('This show has no auditorium assigned. Ask the cinema to update the show.');

      const activePlan = await SeatPlanService.getActiveSeatPlan(effectiveScreenId);
      if (!activePlan.seats?.length) throw new ValidationError('This screen has no published seat plan. Ask the cinema to publish its seat layout.');

      const inventoryRows = activePlan.seats.map(seat => {
        const defaultPrice = /reclin/i.test(seat.categoryName || '') ? 650 : (/vip|prem/i.test(seat.categoryName || '') ? 450 : 250);
        const effectivePrice = Number(seat.price) > 0 ? Number(seat.price) : defaultPrice;

        return {
          id: uuidv4(), show_id: showId, seat_id: seat.id,
          seat_label: seat.seat_label || `${seat.row_label}${seat.seat_number}`,
          row_label: seat.row_label, seat_number: seat.seat_number,
          category_name: seat.categoryName || 'Standard',
          seat_type: seat.seat_type || 'STANDARD', price: effectivePrice,
          status: 'AVAILABLE', hold_id: null, hold_user_id: null,
          held_until: null, booking_id: null,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        };
      });
      const { error: inventoryError } = await supabaseAdmin.from('show_seats').insert(inventoryRows);
      if (inventoryError) {
        // Another seat-map request may have initialized the same show at the same time.
        const { data: initializedSeats, error: reloadError } = await supabaseAdmin
          .from('show_seats').select('*').eq('show_id', showId);
        if (reloadError || !initializedSeats?.length) {
          throw new AppError(`Could not initialize seats for this show: ${inventoryError.message}`, 503, 'SEAT_INVENTORY_CREATE_FAILED');
        }
        rawShowSeats = initializedSeats;
      } else {
        rawShowSeats = inventoryRows;
      }
      for (const seat of rawShowSeats) memoryStore.showSeats.set(seat.id, seat);
    }

    // Load physical auditorium coordinates after a server restart as well as in-memory.
    const physicalSeatIds = [...new Set(rawShowSeats
      .map(seat => seat.seat_id)
      .filter(id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))];
    if (physicalSeatIds.length) {
      const { data: physicalSeats, error: physicalSeatsError } = await supabaseAdmin
        .from('seats')
        .select('id, x_position, y_position, rotation, width, height, is_accessible, is_wheelchair_space, is_companion_seat')
        .in('id', physicalSeatIds);
      if (physicalSeatsError) throw new AppError(`Could not load auditorium seat positions: ${physicalSeatsError.message}`, 503, 'SEAT_LAYOUT_READ_FAILED');
      for (const physicalSeat of physicalSeats || []) memoryStore.seats.set(physicalSeat.id, physicalSeat);
    }

    // Sync to memoryStore
    for (const s of rawShowSeats) { memoryStore.showSeats.set(s.id, s); }

    const sectionMap = new Map();
    for (const seat of rawShowSeats) {
      let effectiveStatus = seat.status;
      let heldByCurrentUser = false;

        let res = null;
        let queueCount = 0;
        for (const req of memoryStore.seatQueueRequests.values()) {
          if (req.show_seat_id === seat.id && req.status === 'WAITING') {
            queueCount++;
          }
        }

        if (seat.status === 'HELD') {
          res = seat.hold_id ? memoryStore.seatReservations.get(seat.hold_id) : null;
          const isHardExpired = seat.held_until && new Date(seat.held_until).getTime() <= now;
          const isCustomerExpired = res?.customer_expires_at && new Date(res.customer_expires_at).getTime() <= now;

          if (isHardExpired) {
            effectiveStatus = 'AVAILABLE';
          } else if (currentUserId && seat.hold_user_id === currentUserId) {
            if (isCustomerExpired) {
              effectiveStatus = 'AVAILABLE';
            } else {
              heldByCurrentUser = true;
            }
          }
        }

        const physicalSeat = memoryStore.seats.get(seat.seat_id);
        const item = {
          id: seat.id,
          seatId: seat.seat_label,
          row: seat.row_label,
          number: seat.seat_number,
          x: physicalSeat ? physicalSeat.x_position : 0,
          y: physicalSeat ? physicalSeat.y_position : 0,
          rotation: physicalSeat ? Number(physicalSeat.rotation || 0) : 0,
          width: physicalSeat ? Number(physicalSeat.width || 32) : 32,
          height: physicalSeat ? Number(physicalSeat.height || 32) : 32,
          isAccessible: Boolean(physicalSeat?.is_accessible || physicalSeat?.is_wheelchair_space),
          isCompanionSeat: Boolean(physicalSeat?.is_companion_seat),
          seatType: seat.seat_type,
          price: seat.price,
          status: effectiveStatus,
          heldByCurrentUser,
          holdId: heldByCurrentUser ? (seat.hold_id || res?.hold_id || res?.id || null) : null,
          heldUntil: seat.status === 'HELD' && heldByCurrentUser ? (res?.customer_expires_at || seat.held_until) : null,
          customerExpiresAt: res?.customer_expires_at || null,
          isContested: seat.status === 'HELD' && !heldByCurrentUser,
          queueCount
        };

        const secName = seat.category_name || 'Standard';
        if (!sectionMap.has(secName)) {
          sectionMap.set(secName, []);
        }
        sectionMap.get(secName).push(item);
    }

    const getTierRank = (secName) => {
      const name = String(secName || '').toLowerCase();
      if (name.includes('reclin') || name.includes('vip') || name.includes('box') || name.includes('lounge')) return 1;
      if (name.includes('prem') || name.includes('deluxe') || name.includes('exec') || name.includes('gold')) return 2;
      if (name.includes('standard') || name.includes('classic') || name.includes('silver') || name.includes('stall')) return 4;
      return 3;
    };

    const sections = [];
    for (const [name, seats] of sectionMap.entries()) {
      sections.push({ name, seats });
    }

    // Sort sections: VIP / Recliner first, Premium second, Standard at the back
    sections.sort((a, b) => {
      const rankDiff = getTierRank(a.name) - getTierRank(b.name);
      if (rankDiff !== 0) return rankDiff;
      const minRowA = (a.seats || []).map(s => s.row || '').filter(Boolean).sort()[0] || '';
      const minRowB = (b.seats || []).map(s => s.row || '').filter(Boolean).sort()[0] || '';
      return minRowA.localeCompare(minRowB);
    });

    return {
      show: {
        id: show.id,
        movie: movie ? movie.title : '',
        cinema: cinema ? cinema.cinema_name : '',
        screen: screen ? screen.screen_name : '',
        date: show.show_date,
        time: show.start_time,
        format: show.format
      },
      seatPlan: {
        version: version ? version.version_number : 1,
        screenPosition: version ? version.screen_position : 'TOP'
      },
      sections
    };
  }
}
