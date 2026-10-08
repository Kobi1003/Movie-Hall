import { mockRabbit, connectRabbitMQ } from '../config/rabbitmq.js';
import { RABBITMQ_ROUTING_KEYS } from '../config/constants.js';
import { processSeatExpiryEvent } from './seatExpiry.worker.js';
import { processQueuePromotionEvent } from './queuePromotion.worker.js';
import { runReservationReconciliation } from './reconciliation.worker.js';
import { logger } from '../utils/logger.js';

let reconciliationTimer = null;

export async function startBackgroundWorkers() {
  logger.info('Initializing background workers...');

  // Subscribe in-memory broker handlers
  mockRabbit.subscribe(RABBITMQ_ROUTING_KEYS.SEAT_HOLD_EXPIRED, processSeatExpiryEvent);
  mockRabbit.subscribe(RABBITMQ_ROUTING_KEYS.SEAT_QUEUE_PROMOTE, processQueuePromotionEvent);

  // Connect to live RabbitMQ if available
  const { channel } = await connectRabbitMQ();
  if (channel) {
    logger.info('Connected to RabbitMQ consumers');
  }

  // Periodic reconciliation loop (every 30 seconds)
  if (!reconciliationTimer) {
    reconciliationTimer = setInterval(() => {
      runReservationReconciliation().catch(err => {
        logger.error('Error during reservation reconciliation', err);
      });
    }, 30000);
  }
}

export function stopBackgroundWorkers() {
  if (reconciliationTimer) {
    clearInterval(reconciliationTimer);
    reconciliationTimer = null;
  }
}
