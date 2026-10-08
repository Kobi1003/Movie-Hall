import { memoryStore } from '../config/supabase.js';
import { RedisService } from '../services/redis.service.js';
import { RabbitMQService } from '../services/rabbitmq.service.js';
import { logger } from '../utils/logger.js';

export async function runReservationReconciliation() {
  const now = Date.now();
  let cleanedHolds = 0;

  for (const seat of memoryStore.showSeats.values()) {
    if (seat.status === 'HELD' && seat.held_until) {
      const oldHoldId = seat.hold_id;
      const res = oldHoldId ? memoryStore.seatReservations.get(oldHoldId) : null;
      let isExpired = new Date(seat.held_until).getTime() <= now;

      // Also check 2-minute customer booking session expiration
      if (!isExpired && res && res.status === 'ACTIVE' && res.customer_expires_at) {
        if (new Date(res.customer_expires_at).getTime() <= now) {
          const booking = res.booking_id ? memoryStore.bookings.get(res.booking_id) : null;
          if (!booking || booking.status !== 'CONFIRMED') {
            isExpired = true;
          }
        }
      }

      if (isExpired) {
        // Expired hold detected
        cleanedHolds++;
        seat.status = 'AVAILABLE';
        seat.hold_id = null;
        seat.hold_user_id = null;
        seat.held_until = null;
        seat.updated_at = new Date().toISOString();

        if (res && res.status === 'ACTIVE') {
          res.status = 'EXPIRED';
        }

        await RedisService.deleteSeatHold(seat.show_id, seat.id);

        // Trigger promotion
        await RabbitMQService.emitQueuePromote({
          showId: seat.show_id,
          showSeatId: seat.id
        });
      }
    }
  }

  if (cleanedHolds > 0) {
    logger.info(`[RECONCILIATION] Cleaned up ${cleanedHolds} expired holds`);
  }
}
