import { memoryStore } from '../config/supabase.js';
import { RedisService } from '../services/redis.service.js';
import { RabbitMQService } from '../services/rabbitmq.service.js';
import { logger } from '../utils/logger.js';

export async function processSeatExpiryEvent(event) {
  const { showId, showSeatIds, holdId } = event;
  logger.info('[WORKER: SeatExpiry] Processing hold expiry', { holdId, showId });

  // 1. Verify authoritative DB reservation state
  const reservation = memoryStore.seatReservations.get(holdId);
  if (!reservation || reservation.status !== 'ACTIVE') {
    // Already confirmed, released, or cancelled
    return;
  }

  // 2. Check if booking completed
  if (reservation.booking_id) {
    const booking = memoryStore.bookings.get(reservation.booking_id);
    if (booking && booking.status === 'CONFIRMED') {
      logger.info('[WORKER: SeatExpiry] Booking already confirmed, preserving seat', { holdId });
      return;
    }
  }

  // 3. Release genuinely expired hold
  reservation.status = 'EXPIRED';

  for (const seatId of showSeatIds || reservation.show_seat_ids) {
    const seat = memoryStore.showSeats.get(seatId);
    if (seat && seat.hold_id === holdId && seat.status === 'HELD') {
      seat.status = 'AVAILABLE';
      seat.hold_id = null;
      seat.hold_user_id = null;
      seat.held_until = null;
      seat.updated_at = new Date().toISOString();

      await RedisService.deleteSeatHold(showId, seatId);

      // Trigger promotion for next in queue
      await RabbitMQService.emitQueuePromote({
        showId,
        showSeatId: seatId
      });
    }
  }
}
