import Redis from 'ioredis';
import { ENV } from './env.js';
import { logger } from '../utils/logger.js';

let redisClientInstance = null;
let isRedisConnected = false;

// In-memory Mock Redis for standalone testing
class MockRedis {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
    this.lists = new Map();
    this.sets = new Map();
  }

  async set(key, value, ...args) {
    this.store.set(key, value);
    if (args[0] === 'EX' && args[1]) {
      this.ttls.set(key, Date.now() + args[1] * 1000);
    }
    return 'OK';
  }

  async get(key) {
    const expire = this.ttls.get(key);
    if (expire && Date.now() > expire) {
      this.store.delete(key);
      this.ttls.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  }

  async del(key) {
    this.store.delete(key);
    this.ttls.delete(key);
    this.lists.delete(key);
    this.sets.delete(key);
    return 1;
  }

  async ttl(key) {
    const expire = this.ttls.get(key);
    if (!expire) return -1;
    const remaining = Math.round((expire - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async rpush(key, ...values) {
    const list = this.lists.get(key) || [];
    list.push(...values);
    this.lists.set(key, list);
    return list.length;
  }

  async lpop(key) {
    const list = this.lists.get(key) || [];
    const item = list.shift();
    this.lists.set(key, list);
    return item || null;
  }

  async lrange(key, start, stop) {
    const list = this.lists.get(key) || [];
    const end = stop === -1 ? undefined : stop + 1;
    return list.slice(start, end);
  }

  async lrem(key, count, value) {
    let list = this.lists.get(key) || [];
    list = list.filter(item => item !== value);
    this.lists.set(key, list);
    return 1;
  }

  async sadd(key, ...members) {
    const set = this.sets.get(key) || new Set();
    members.forEach(m => set.add(m));
    this.sets.set(key, set);
    return members.length;
  }

  async sismember(key, member) {
    const set = this.sets.get(key);
    return set && set.has(member) ? 1 : 0;
  }

  async srem(key, ...members) {
    const set = this.sets.get(key);
    if (!set) return 0;
    members.forEach(m => set.delete(m));
    return 1;
  }

  async ping() {
    return 'PONG';
  }
}

export const mockRedis = new MockRedis();

export function getRedisClient() {
  if (redisClientInstance) return redisClientInstance;

  try {
    const client = new Redis(ENV.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => (times > 3 ? null : 200),
      lazyConnect: true
    });

    client.on('connect', () => {
      isRedisConnected = true;
      logger.info('Connected to Redis server');
    });

    client.on('error', (err) => {
      isRedisConnected = false;
      // In development / test, fallback silently to mock
    });

    client.connect().catch(() => {
      isRedisConnected = false;
    });

    redisClientInstance = client;
    return client;
  } catch (err) {
    isRedisConnected = false;
    return mockRedis;
  }
}

export function isRedisLive() {
  return isRedisConnected;
}

export const redis = {
  get client() {
    return isRedisConnected ? getRedisClient() : mockRedis;
  }
};
