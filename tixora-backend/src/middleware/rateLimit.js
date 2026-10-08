import rateLimit from 'express-rate-limit';
import { ApiResponse } from '../utils/apiResponse.js';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(res, 'Too many requests, please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  handler: (req, res) => {
    return ApiResponse.error(res, 'Too many authentication attempts, please try again later.', 429, 'AUTH_RATE_LIMIT');
  }
});

export const holdLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  handler: (req, res) => {
    return ApiResponse.error(res, 'Too many seat hold attempts. Please slow down.', 429, 'HOLD_RATE_LIMIT');
  }
});

export const queueLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  handler: (req, res) => {
    return ApiResponse.error(res, 'Too many queue operations. Please wait.', 429, 'QUEUE_RATE_LIMIT');
  }
});
