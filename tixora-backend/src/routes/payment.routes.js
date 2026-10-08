import { Router } from 'express';
import { PaymentService } from '../services/payment.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { authenticateUser } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { createPaymentSchema, confirmPaymentSchema } from '../validators/booking.validator.js';

const router = Router();

router.use(authenticateUser);

router.post('/payments/create', validateRequest({ body: createPaymentSchema }), async (req, res, next) => {
  try {
    const payment = await PaymentService.createPayment({ ...req.body, userId: req.user.id });
    return ApiResponse.created(res, payment, 'Payment initiated');
  } catch (err) {
    next(err);
  }
});

router.post('/payments', validateRequest({ body: createPaymentSchema }), async (req, res, next) => {
  try {
    const payment = await PaymentService.createPayment({ ...req.body, userId: req.user.id });
    return ApiResponse.created(res, payment, 'Payment initiated');
  } catch (err) {
    next(err);
  }
});

router.post('/payments/confirm', validateRequest({ body: confirmPaymentSchema }), async (req, res, next) => {
  try {
    const result = await PaymentService.confirmPayment({ ...req.body, userId: req.user.id });
    return ApiResponse.success(res, result, 'Payment verified and booking confirmed');
  } catch (err) {
    next(err);
  }
});

router.get('/payments/:paymentId/status', async (req, res, next) => {
  try {
    const status = await PaymentService.getPaymentStatus(req.params.paymentId, req.user.id);
    return ApiResponse.success(res, status);
  } catch (err) {
    next(err);
  }
});

export default router;
