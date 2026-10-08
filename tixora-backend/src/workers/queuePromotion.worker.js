import { ReservationService } from '../services/reservation.service.js';
import { RedisService } from '../services/redis.service.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

export async function processQueuePromotionEvent(event) {
  const { showId, showSeatId } = event;
  const lockToken = uuidv4();

  // Acquire short coordination lock
  const acquired = await RedisService.acquireSeatLock(showId, showSeatId, lockToken, 5);
  if (!acquired) {
    logger.warn('[WORKER: QueuePromotion] Promotion lock busy, skipping simultaneous promotion', { showId, showSeatId });
    return;
  }

  try {
    const result = await ReservationService.promoteNextCustomer(showId, showSeatId);
    if (result && result.promoted) {
      logger.info('[WORKER: QueuePromotion] Successfully promoted customer for seat', {
        seatLabel: result.seatLabel,
        userId: result.userId,
        holdId: result.holdId
      });
    }
  } finally {
    await RedisService.releaseSeatLock(showId, showSeatId, lockToken);
  }
}
