import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, memoryStore } from '../config/supabase.js';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { BookingService } from './booking.service.js';
import { ENV } from '../config/env.js';

export class PaymentService {
  static async createPayment({ bookingId, userId, paymentMethod = 'simulated', currency = 'INR', metadata = {}, ...gatewayDetails }) {
    const { data: bookData } = await supabaseAdmin.from('bookings').select('*').eq('id', bookingId).maybeSingle();
    const booking = bookData || memoryStore.bookings.get(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');
    if (booking.user_id !== userId) throw new ForbiddenError('You do not own this booking');
    if (booking.status !== 'PENDING') throw new ValidationError('Payment can only be started for a pending booking');

    const paymentId = uuidv4();
    const providerPaymentId = `PAY_${uuidv4().substring(0, 12)}`;
    const payAmount = Number(booking.total_amount);
    const enrichedMetadata = { ...metadata, ...gatewayDetails, gateway: paymentMethod };

    const payment = {
      id: paymentId, booking_id: bookingId, provider: paymentMethod || 'simulated',
      provider_payment_id: providerPaymentId, payment_method: paymentMethod,
      amount: payAmount, currency, status: 'PROCESSING', metadata: enrichedMetadata,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin.from('payments').insert({
      id: paymentId, booking_id: bookingId, provider: 'simulated',
      provider_payment_id: providerPaymentId, payment_method: paymentMethod,
      amount: payAmount, currency, status: 'PROCESSING',
      metadata,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    });
    if (error) {
      if (ENV.NODE_ENV === 'test' || error.code === '23503') {
        console.warn(`Could not persist payment record to Supabase (${error.message}), fallback to memoryStore`);
      } else {
        throw new AppError(`Could not save payment record: ${error.message}`, 503, 'PAYMENT_SAVE_FAILED');
      }
    }
    memoryStore.payments.set(paymentId, payment);

    return { paymentId, providerPaymentId, amount: payAmount, currency, status: 'PROCESSING' };
  }

  static async confirmPayment({ paymentId, providerPaymentId, userId }) {
    const { data: payData } = await supabaseAdmin.from('payments').select('*').eq('id', paymentId).maybeSingle();
    const payment = payData || memoryStore.payments.get(paymentId);
    if (!payment) throw new NotFoundError('Payment record not found');
    const { data: bookingData } = await supabaseAdmin.from('bookings').select('user_id').eq('id', payment.booking_id).maybeSingle();
    const booking = bookingData || memoryStore.bookings.get(payment.booking_id);
    if (!booking) throw new NotFoundError('Booking not found');
    if (booking.user_id !== userId) throw new ForbiddenError('You do not own this payment');
    if (providerPaymentId && providerPaymentId !== payment.provider_payment_id) throw new ValidationError('Payment reference does not match');
    if (payment.status === 'SUCCESS') {
      const detail = await BookingService.getBookingDetail(payment.booking_id);
      return { paymentStatus: 'SUCCESS', booking: { booking: detail.booking, ticket: detail.ticket } };
    }

    const bookingResult = await BookingService.confirmBooking(payment.booking_id, payment.provider_payment_id, userId);

    const { error: paymentError } = await supabaseAdmin.from('payments').update({ status: 'SUCCESS', updated_at: new Date().toISOString() }).eq('id', paymentId);
    if (paymentError && ENV.NODE_ENV !== 'test' && paymentError.code !== '23503') {
      throw new AppError(`Booking was confirmed but payment status could not be saved: ${paymentError.message}`, 503, 'PAYMENT_UPDATE_FAILED');
    }
    payment.status = 'SUCCESS';
    payment.updated_at = new Date().toISOString();
    memoryStore.payments.set(paymentId, payment);

    return { paymentStatus: 'SUCCESS', booking: bookingResult };
  }

  static async getPaymentStatus(paymentId, userId) {
    const { data } = await supabaseAdmin.from('payments').select('*').eq('id', paymentId).maybeSingle();
    const payment = data || memoryStore.payments.get(paymentId);
    if (!payment) throw new NotFoundError('Payment record not found');
    const { data: bookingData } = await supabaseAdmin.from('bookings').select('user_id').eq('id', payment.booking_id).maybeSingle();
    const booking = bookingData || memoryStore.bookings.get(payment.booking_id);
    if (!booking || booking.user_id !== userId) throw new ForbiddenError('You do not own this payment');
    memoryStore.payments.set(paymentId, payment);
    return payment;
  }

  static async refundPayment(paymentId, reason = 'Customer Cancellation') {
    const { data: payData } = await supabaseAdmin.from('payments').select('*').eq('id', paymentId).single();
    const payment = payData || memoryStore.payments.get(paymentId);
    if (!payment) throw new NotFoundError('Payment not found');
    await supabaseAdmin.from('payments').update({ status: 'REFUNDED', updated_at: new Date().toISOString() }).eq('id', paymentId);
    payment.status = 'REFUNDED';
    payment.updated_at = new Date().toISOString();
    memoryStore.payments.set(paymentId, payment);
    return { success: true, paymentId, status: 'REFUNDED' };
  }
}
