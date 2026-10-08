import { ApiResponse } from '../utils/apiResponse.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { ENV } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, err);

  if (err instanceof AppError) {
    return ApiResponse.error(res, err.message, err.statusCode, err.code, err.fields);
  }

  // Generic unhandled exception
  const statusCode = err.status || 500;
  const message = ENV.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error');
  return ApiResponse.error(res, message, statusCode, 'INTERNAL_SERVER_ERROR');
}
