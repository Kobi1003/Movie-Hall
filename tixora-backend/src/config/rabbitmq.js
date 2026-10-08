import amqp from 'amqplib';
import { ENV } from './env.js';
import { RABBITMQ_EXCHANGE, RABBITMQ_QUEUES, RABBITMQ_ROUTING_KEYS } from './constants.js';
import { logger } from '../utils/logger.js';

let rabbitConnection = null;
let rabbitChannel = null;
let isRabbitConnected = false;

// In-memory mock broker for testing
class MockRabbitMQ {
  constructor() {
    this.handlers = new Map();
  }

  async publish(routingKey, message) {
    logger.info(`[MOCK RABBITMQ] Event published: ${routingKey}`, { messageId: message.eventId });
    const handlers = this.handlers.get(routingKey) || [];
    for (const fn of handlers) {
      setTimeout(() => fn(message), 10);
    }
    return true;
  }

  subscribe(routingKey, fn) {
    const handlers = this.handlers.get(routingKey) || [];
    handlers.push(fn);
    this.handlers.set(routingKey, handlers);
  }
}

export const mockRabbit = new MockRabbitMQ();

export async function connectRabbitMQ() {
  if (rabbitConnection && rabbitChannel) {
    return { connection: rabbitConnection, channel: rabbitChannel };
  }

  try {
    const conn = await amqp.connect(ENV.RABBITMQ_URL);
    const channel = await conn.createChannel();

    // Assert main exchange
    await channel.assertExchange(RABBITMQ_EXCHANGE, 'topic', { durable: true });

    // Assert dead letter exchange
    const dlx = `${RABBITMQ_EXCHANGE}.dlx`;
    await channel.assertExchange(dlx, 'topic', { durable: true });

    // Setup queues with dead letter exchange routing
    for (const [key, queueName] of Object.entries(RABBITMQ_QUEUES)) {
      const dlqName = `${queueName}.dlq`;
      await channel.assertQueue(dlqName, { durable: true });
      await channel.bindQueue(dlqName, dlx, '#');

      await channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': dlx
        }
      });
    }

    // Bind queues to topics
    await channel.bindQueue(RABBITMQ_QUEUES.SEAT_EXPIRY, RABBITMQ_EXCHANGE, 'seat.hold.*');
    await channel.bindQueue(RABBITMQ_QUEUES.SEAT_QUEUE, RABBITMQ_EXCHANGE, 'seat.queue.*');
    await channel.bindQueue(RABBITMQ_QUEUES.BOOKING, RABBITMQ_EXCHANGE, 'booking.*');
    await channel.bindQueue(RABBITMQ_QUEUES.PAYMENT, RABBITMQ_EXCHANGE, 'payment.*');
    await channel.bindQueue(RABBITMQ_QUEUES.NOTIFICATION, RABBITMQ_EXCHANGE, '*.notification');

    conn.on('close', () => {
      isRabbitConnected = false;
      rabbitConnection = null;
      rabbitChannel = null;
    });

    conn.on('error', () => {
      isRabbitConnected = false;
    });

    rabbitConnection = conn;
    rabbitChannel = channel;
    isRabbitConnected = true;
    logger.info('Connected to RabbitMQ');
    return { connection: conn, channel };
  } catch (err) {
    isRabbitConnected = false;
    return { connection: null, channel: null };
  }
}

export async function publishRabbitEvent(routingKey, message) {
  if (isRabbitConnected && rabbitChannel) {
    try {
      const buffer = Buffer.from(JSON.stringify(message));
      return rabbitChannel.publish(RABBITMQ_EXCHANGE, routingKey, buffer, {
        persistent: true,
        messageId: message.eventId || undefined,
        timestamp: Date.now()
      });
    } catch (err) {
      logger.error('Failed to publish RabbitMQ event, routing to local broker', err);
    }
  }
  return mockRabbit.publish(routingKey, message);
}

export function isRabbitLive() {
  return isRabbitConnected;
}
