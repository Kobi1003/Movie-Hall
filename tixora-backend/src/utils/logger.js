import { ENV } from '../config/env.js';

export const logger = {
  info: (msg, meta = {}) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },
  warn: (msg, meta = {}) => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },
  error: (msg, err = {}) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${msg}`, err);
  },
  reservation: (action, data = {}) => {
    console.log(`[RESERVATION] [${action}]`, JSON.stringify(data));
  }
};
