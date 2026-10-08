import { Router } from 'express';
import { BookingService } from '../services/booking.service.js';
import { TicketService } from '../services/ticket.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { authenticateUser } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { createBookingSchema } from '../validators/booking.validator.js';

const router = Router();

router.use(authenticateUser);

// Create Idempotent Booking
router.post('/bookings', validateRequest({ body: createBookingSchema }), async (req, res, next) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'];
    const result = await BookingService.createBooking(req.user.id, {
      ...req.body,
      idempotencyKey
    });

    if (result.isExisting) {
      return ApiResponse.success(res, result.booking, 'Retrieved existing booking (idempotent)', 200);
    }
    return ApiResponse.created(res, result.booking, 'Booking created pending payment confirmation');
  } catch (err) {
    next(err);
  }
});

// List Customer Bookings
router.get('/bookings', async (req, res, next) => {
  try {
    const bookings = await BookingService.getUserBookings(req.user.id);
    return ApiResponse.success(res, bookings);
  } catch (err) {
    next(err);
  }
});

router.get('/bookings/me', async (req, res, next) => {
  try {
    const bookings = await BookingService.getUserBookings(req.user.id);
    return ApiResponse.success(res, bookings);
  } catch (err) {
    next(err);
  }
});

// Get Booking Detail
router.get('/bookings/:bookingId', async (req, res, next) => {
  try {
    const detail = await BookingService.getBookingDetail(req.params.bookingId);
    return ApiResponse.success(res, detail);
  } catch (err) {
    next(err);
  }
});

// Cancel Booking
router.post('/bookings/:bookingId/cancel', async (req, res, next) => {
  try {
    const result = await BookingService.cancelBooking(req.params.bookingId, req.user.id, req.user.role === 'PLATFORM_ADMIN');
    return ApiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
});

// Get Digital Ticket
router.get('/bookings/:bookingId/ticket', async (req, res, next) => {
  try {
    const ticket = await TicketService.getTicketByBookingId(req.params.bookingId);
    return ApiResponse.success(res, ticket);
  } catch (err) {
    next(err);
  }
});

// Get Digital Ticket QR payload
router.get('/bookings/:bookingId/ticket/qr', async (req, res, next) => {
  try {
    const ticket = await TicketService.getTicketByBookingId(req.params.bookingId);
    return ApiResponse.success(res, {
      ticketNumber: ticket.ticket_number,
      qrCodeData: ticket.qr_code_data,
      securityCode: ticket.security_code
    });
  } catch (err) {
    next(err);
  }
});

export default router;
