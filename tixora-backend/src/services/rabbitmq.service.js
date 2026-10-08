import { v4 as uuidv4 } from 'uuid';
import { publishRabbitEvent } from '../config/rabbitmq.js';
import { RABBITMQ_ROUTING_KEYS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export class RabbitMQService {
  static async publishEvent(routingKey, payload) {
    const event = {
      eventId: `EVT_${uuidv4()}`,
      eventType: routingKey,
      createdAt: new Date().toISOString(),
      ...payload
    };

    logger.info(`[RABBITMQ] Publishing event ${routingKey}`, { eventId: event.eventId });
    await publishRabbitEvent(routingKey, event);
    return event;
  }

  static async emitSeatHoldCreated({ showId, showSeatIds, holdId, userId, expiresAt }) {
    return this.publishEvent(RABBITMQ_ROUTING_KEYS.SEAT_HOLD_CREATED, {
      showId,
      showSeatIds,
      holdId,
      userId,
      expiresAt
    });
  }

  static async emitSeatHoldExpired({ showId, showSeatIds, holdId, userId }) {
    return this.publishEvent(RABBITMQ_ROUTING_KEYS.SEAT_HOLD_EXPIRED, {
      showId,
      showSeatIds,
      holdId,
      userId
    });
  }

  static async emitQueueJoined({ showId, showSeatId, queueRequestId, userId, position }) {
    return this.publishEvent(RABBITMQ_ROUTING_KEYS.SEAT_QUEUE_JOINED, {
      showId,
      showSeatId,
      queueRequestId,
      userId,
      position
    });
  }

  static async emitQueuePromote({ showId, showSeatId, queueRequestId }) {
    return this.publishEvent(RABBITMQ_ROUTING_KEYS.SEAT_QUEUE_PROMOTE, {
      showId,
      showSeatId,
      queueRequestId
    });
  }

  static async emitBookingConfirmed({ bookingId, showId, cinemaId, userId, ticketNumber }) {
    return this.publishEvent(RABBITMQ_ROUTING_KEYS.BOOKING_CONFIRMED, {
      bookingId,
      showId,
      cinemaId,
      userId,
      ticketNumber
    });
  }
}
