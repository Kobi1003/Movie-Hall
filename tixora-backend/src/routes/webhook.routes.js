import { Router } from 'express';
import { BookingService } from '../services/booking.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';
import { ENV } from '../config/env.js';

const router = Router();

router.post('/payment', async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const { event, data } = req.body;

  // Verify webhook signature
  if (ENV.NODE_ENV === 'production' && signature !== ENV.PAYMENT_WEBHOOK_SECRET) {
    logger.warn('[WEBHOOK] Invalid webhook signature received');
    return ApiResponse.error(res, 'Invalid webhook signature', 401, 'INVALID_SIGNATURE');
  }

  logger.info(`[WEBHOOK] Received payment event: ${event}`, data);

  if (event === 'payment.captured' || event === 'payment.success') {
    const bookingId = data.bookingId;
    const providerPaymentId = data.paymentId || data.providerPaymentId;

    try {
      const result = await BookingService.confirmBooking(bookingId, providerPaymentId);
      return ApiResponse.success(res, result, 'Webhook processed successfully');
    } catch (err) {
      logger.error('[WEBHOOK] Failed to confirm booking via webhook', err);
      // Still return 200 to prevent infinite vendor retries on permanent logic errors
      return res.status(200).json({ success: false, error: err.message });
    }
  }

  return ApiResponse.success(res, {}, 'Event acknowledged');
});

export default router;
