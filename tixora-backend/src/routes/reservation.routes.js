import { Router } from 'express';
import { ReservationService } from '../services/reservation.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { authenticateUser, optionalAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { holdSeatsSchema, joinQueueSchema } from '../validators/reservation.validator.js';
import { holdLimiter, queueLimiter } from '../middleware/rateLimit.js';

const router = Router();

// --- SEAT MAP & AVAILABILITY ---
router.get('/shows/:showId/seat-map', optionalAuth, async (req, res, next) => {
  try {
    const seatMap = await ReservationService.getSeatMap(req.params.showId, req.user?.id);
    return ApiResponse.success(res, seatMap);
  } catch (err) {
    next(err);
  }
});

router.get('/shows/:showId/seatmap', optionalAuth, async (req, res, next) => {
  try {
    const seatMap = await ReservationService.getSeatMap(req.params.showId, req.user?.id);
    return ApiResponse.success(res, seatMap);
  } catch (err) {
    next(err);
  }
});

router.get('/shows/:showId/availability', optionalAuth, async (req, res, next) => {
  try {
    const seatMap = await ReservationService.getSeatMap(req.params.showId, req.user?.id);
    return ApiResponse.success(res, seatMap);
  } catch (err) {
    next(err);
  }
});

// --- 3-MINUTE SEAT HOLD ---
const handleHold = async (req, res, next) => {
  try {
    const result = await ReservationService.holdSeats(
      req.params.showId,
      req.body.seatIds,
      req.user.id
    );
    return ApiResponse.success(res, result, 'Seats held successfully for 3 minutes');
  } catch (err) {
    next(err);
  }
};

router.post('/shows/:showId/hold', authenticateUser, holdLimiter, validateRequest({ body: holdSeatsSchema }), handleHold);
router.post('/shows/:showId/holds', authenticateUser, holdLimiter, validateRequest({ body: holdSeatsSchema }), handleHold);

// --- VOLUNTARY HOLD RELEASE ---
const handleReleaseHold = async (req, res, next) => {
  try {
    const result = await ReservationService.releaseHold(
      req.params.showId,
      req.params.holdId,
      req.user.id
    );
    return ApiResponse.success(res, result, 'Seats released successfully');
  } catch (err) {
    next(err);
  }
};

router.delete('/shows/:showId/hold/:holdId', authenticateUser, handleReleaseHold);
router.delete('/shows/:showId/holds/:holdId', authenticateUser, handleReleaseHold);
router.post('/shows/:showId/release', authenticateUser, async (req, res, next) => {
  try {
    const holdId = req.body.holdId;
    const result = await ReservationService.releaseHold(req.params.showId, holdId, req.user.id);
    return ApiResponse.success(res, result, 'Seats released successfully');
  } catch (err) {
    next(err);
  }
});

// --- FIFO CONTESTED WAITING QUEUE ---
router.post('/shows/:showId/seats/:showSeatId/queue', authenticateUser, queueLimiter, validateRequest({ body: joinQueueSchema }), async (req, res, next) => {
  try {
    const result = await ReservationService.joinQueue(
      req.params.showId,
      req.params.showSeatId,
      req.user.id,
      req.body.idempotencyKey
    );
    return ApiResponse.success(res, result, 'Joined waiting queue');
  } catch (err) {
    next(err);
  }
});

router.get('/shows/:showId/seats/:showSeatId/queue', authenticateUser, async (req, res, next) => {
  try {
    const status = await ReservationService.getQueueStatus(
      req.params.showId,
      req.params.showSeatId,
      req.user.id
    );
    return ApiResponse.success(res, status);
  } catch (err) {
    next(err);
  }
});

router.delete(['/queue/:queueRequestId', '/shows/queue/:queueRequestId'], authenticateUser, async (req, res, next) => {
  try {
    const result = await ReservationService.cancelQueue(req.params.queueRequestId, req.user.id);
    return ApiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
