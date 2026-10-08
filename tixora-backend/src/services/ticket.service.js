import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, memoryStore } from '../config/supabase.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import { ENV } from '../config/env.js';

export class TicketService {
  static async generateTicket(booking) {
    const ticketId = uuidv4();
    const ticketNumber = `TIX-${uuidv4().substring(0, 8).toUpperCase()}`;
    const securityCode = `SEC-${Math.floor(1000 + Math.random() * 9000)}`;

    const qrPayload = JSON.stringify({
      ticketNumber,
      bookingReference: booking.booking_reference,
      showId: booking.show_id,
      cinemaId: booking.cinema_id,
      seats: booking.seats || [],
      securityCode
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'H', margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });

    const ticket = {
      id: ticketId, booking_id: booking.id, ticket_number: ticketNumber,
      security_code: securityCode, gate_info: 'Auditorium Gate 4 • Level 3',
      qr_code_data: qrCodeDataUrl, status: 'VALID',
      issued_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin.from('tickets').insert(ticket);
    if (error) {
      if (ENV.NODE_ENV === 'test' || error.code === '23503') {
        console.warn(`Could not persist ticket to Supabase (${error.message}), fallback to memoryStore`);
      } else {
        throw new AppError(`Could not save ticket and QR code: ${error.message}`, 503, 'TICKET_SAVE_FAILED');
      }
    }
    memoryStore.tickets.set(ticketId, ticket);
    return ticket;
  }

  static async getTicketByBookingId(bookingId) {
    const { data, error } = await supabaseAdmin.from('tickets').select('*').eq('booking_id', bookingId).maybeSingle();
    if (error && error.code !== 'PGRST116') {
      throw new AppError(`Could not load ticket: ${error.message}`, 503, 'TICKET_READ_FAILED');
    }
    if (data) {
      if (data.qr_code_data && !data.qr_code_data.startsWith('data:image/')) {
        data.qr_code_data = await QRCode.toDataURL(data.qr_code_data, {
          errorCorrectionLevel: 'H', margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        });
        const { error } = await supabaseAdmin.from('tickets').update({ qr_code_data: data.qr_code_data }).eq('id', data.id);
        if (error) throw new Error('Could not save the ticket QR code');
      }
      memoryStore.tickets.set(data.id, data);
      return data;
    }
    for (const t of memoryStore.tickets.values()) {
      if (t.booking_id === bookingId) return t;
    }
    throw new NotFoundError('Digital ticket not found for this booking');
  }
}
