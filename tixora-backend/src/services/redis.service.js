import { redis } from '../config/redis.js';
import { ENV } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class RedisService {
  static getHoldKey(showId, showSeatId) {
    return `show:${showId}:seat:${showSeatId}:hold`;
  }

  static getQueueKey(showId, showSeatId) {
    return `queue:show:${showId}:seat:${showSeatId}`;
  }

  static getQueueMembersKey(showId, showSeatId) {
    return `queue-members:${showId}:${showSeatId}`;
  }

  static getLockKey(showId, showSeatId) {
    return `lock:show:${showId}:seat:${showSeatId}`;
  }

  static getPromotionLockKey(showId, showSeatId) {
    return `promotion-lock:${showId}:${showSeatId}`;
  }

  // Acquire distributed lock for seat operations
  static async acquireSeatLock(showId, showSeatId, lockToken, ttlSeconds = 5) {
    const key = this.getLockKey(showId, showSeatId);
    const result = await redis.client.set(key, lockToken, 'EX', ttlSeconds);
    return result === 'OK';
  }

  static async releaseSeatLock(showId, showSeatId, lockToken) {
    const key = this.getLockKey(showId, showSeatId);
    const current = await redis.client.get(key);
    if (current === lockToken) {
      await redis.client.del(key);
      return true;
    }
    return false;
  }

  // Store seat hold in Redis with TTL (default 120 seconds)
  static async setSeatHold(showId, showSeatId, holdData, ttlSeconds = ENV.SEAT_HOLD_SECONDS) {
    const key = this.getHoldKey(showId, showSeatId);
    const value = JSON.stringify(holdData);
    await redis.client.set(key, value, 'EX', ttlSeconds);
    logger.reservation('REDIS_HOLD_SET', { showId, showSeatId, ttlSeconds });
  }

  static async getSeatHold(showId, showSeatId) {
    const key = this.getHoldKey(showId, showSeatId);
    const raw = await redis.client.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  static async deleteSeatHold(showId, showSeatId) {
    const key = this.getHoldKey(showId, showSeatId);
    await redis.client.del(key);
    logger.reservation('REDIS_HOLD_DELETED', { showId, showSeatId });
  }

  static async getSeatHoldTTL(showId, showSeatId) {
    const key = this.getHoldKey(showId, showSeatId);
    return await redis.client.ttl(key);
  }

  // FIFO Queue per seat
  static async enqueueSeatRequest(showId, showSeatId, queueItem) {
    const queueKey = this.getQueueKey(showId, showSeatId);
    const membersKey = this.getQueueMembersKey(showId, showSeatId);

    // Prevent same user from joining duplicate active queue
    const isMember = await redis.client.sismember(membersKey, queueItem.userId);
    if (isMember) {
      return { duplicate: true };
    }

    await redis.client.sadd(membersKey, queueItem.userId);
    const position = await redis.client.rpush(queueKey, JSON.stringify(queueItem));
    logger.reservation('QUEUE_JOINED', { showId, showSeatId, userId: queueItem.userId, position });
    return { duplicate: false, position };
  }

  static async dequeueSeatRequest(showId, showSeatId) {
    const queueKey = this.getQueueKey(showId, showSeatId);
    const raw = await redis.client.lpop(queueKey);
    if (!raw) return null;

    const item = JSON.parse(raw);
    const membersKey = this.getQueueMembersKey(showId, showSeatId);
    await redis.client.srem(membersKey, item.userId);
    return item;
  }

  static async getQueuePosition(showId, showSeatId, userId) {
    const queueKey = this.getQueueKey(showId, showSeatId);
    const items = await redis.client.lrange(queueKey, 0, -1);
    for (let i = 0; i < items.length; i++) {
      const parsed = JSON.parse(items[i]);
      if (parsed.userId === userId) {
        return { position: i + 1, ahead: i, total: items.length };
      }
    }
    return null;
  }

  static async removeQueueRequest(showId, showSeatId, userId) {
    const queueKey = this.getQueueKey(showId, showSeatId);
    const items = await redis.client.lrange(queueKey, 0, -1);
    for (const raw of items) {
      const parsed = JSON.parse(raw);
      if (parsed.userId === userId) {
        await redis.client.lrem(queueKey, 1, raw);
        const membersKey = this.getQueueMembersKey(showId, showSeatId);
        await redis.client.srem(membersKey, userId);
        return true;
      }
    }
    return false;
  }
}
