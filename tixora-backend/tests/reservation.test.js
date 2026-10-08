import { runSeed } from '../scripts/seed.js';
import { ReservationService } from '../src/services/reservation.service.js';
import { BookingService } from '../src/services/booking.service.js';
import { PaymentService } from '../src/services/payment.service.js';
import { processSeatExpiryEvent } from '../src/workers/seatExpiry.worker.js';
import { supabaseAdmin, memoryStore } from '../src/config/supabase.js';

import { v4 as uuidv4 } from 'uuid';

describe('Advanced Seat Reservation & FIFO Queue Lifecycle', () => {
  let showId;
  let seatId;
  let userA = uuidv4();
  let userB = uuidv4();
  let userC = uuidv4();

  beforeAll(async () => {
    const seed = await runSeed();
    showId = seed.show.id;
    const { data: existingProfiles } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (existingProfiles && existingProfiles.length > 0) {
      userB = existingProfiles[0].id;
    } else {
      userB = seed.customer?.id || seed.customer?.user?.id || userB;
    }

    // Pick a fresh seat: Row B Seat 1
    const { data: dbSeats } = await supabaseAdmin.from('show_seats').select('*').eq('show_id', showId).eq('status', 'AVAILABLE').limit(1);
    if (dbSeats && dbSeats.length > 0) {
      seatId = dbSeats[0].id;
      memoryStore.showSeats.set(seatId, dbSeats[0]);
    } else {
      for (const seat of memoryStore.showSeats.values()) {
        if (seat.show_id === showId) {
          seatId = seat.id;
          break;
        }
      }
      if (!seatId) {
        seatId = uuidv4();
        const newSeat = {
          id: seatId,
          show_id: showId,
          seat_label: 'B1',
          row_label: 'B',
          seat_number: 1,
          category_name: 'Premium',
          seat_type: 'STANDARD',
          price: 350,
          status: 'AVAILABLE'
        };
        memoryStore.showSeats.set(seatId, newSeat);
      }
      const sObj = memoryStore.showSeats.get(seatId);
      await supabaseAdmin.from('show_seats').upsert({
        id: seatId,
        show_id: showId,
        seat_label: sObj.seat_label || 'B1',
        row_label: sObj.row_label || 'B',
        seat_number: sObj.seat_number || 1,
        category_name: sObj.category_name || 'Premium',
        seat_type: sObj.seat_type || 'STANDARD',
        price: Number(sObj.price || 350),
        status: 'AVAILABLE'
      });
    }
  }, 60000);

  test('User A holds seat B1 for 2 minutes (120s)', async () => {
    const hold = await ReservationService.holdSeats(showId, [seatId], userA);
    expect(hold.holdId).toBeDefined();
    expect(hold.seats[0].status).toBe('HELD');

    const seat = memoryStore.showSeats.get(seatId);
    expect(seat.status).toBe('HELD');
    expect(seat.hold_user_id).toBe(userA);
  });

  test('User B and User C join waiting queue in strict FIFO order', async () => {
    const qB = await ReservationService.joinQueue(showId, seatId, userB);
    expect(qB.status).toBe('WAITING');
    expect(qB.position).toBe(1);

    const qC = await ReservationService.joinQueue(showId, seatId, userC);
    expect(qC.status).toBe('WAITING');
    expect(qC.position).toBe(2);

    const statusB = await ReservationService.getQueueStatus(showId, seatId, userB);
    expect(statusB.queue.position).toBe(1);
    expect(statusB.queue.ahead).toBe(0);

    const statusC = await ReservationService.getQueueStatus(showId, seatId, userC);
    expect(statusC.queue.position).toBe(2);
    expect(statusC.queue.ahead).toBe(1);
  });

  test('User A hold expires: User B is promoted automatically with 2-minute hold', async () => {
    const seat = memoryStore.showSeats.get(seatId);
    const holdId = seat.hold_id;

    // Trigger expiration worker
    await processSeatExpiryEvent({
      showId,
      showSeatIds: [seatId],
      holdId,
      userId: userA
    });

    // Worker triggers queue promotion
    await ReservationService.promoteNextCustomer(showId, seatId);

    // Seat should now be held by User B
    const updatedSeat = memoryStore.showSeats.get(seatId);
    expect(updatedSeat.status).toBe('HELD');
    expect(updatedSeat.hold_user_id).toBe(userB);

    // User B receives notification
    let userBNotified = false;
    for (const notif of memoryStore.notifications.values()) {
      if (notif.user_id === userB && notif.type === 'YOUR_TURN') {
        userBNotified = true;
        break;
      }
    }
    expect(userBNotified).toBe(true);
  });

  test('User B creates booking and completes payment -> Seat transitions to BOOKED', async () => {
    const seat = memoryStore.showSeats.get(seatId);
    const holdId = seat.hold_id;

    // Create booking
    const { booking } = await BookingService.createBooking(userB, {
      showId,
      holdId,
      seatIds: [seatId]
    });
    expect(booking.status).toBe('PENDING');

    // Create & confirm payment
    const payment = await PaymentService.createPayment({
      bookingId: booking.id,
      userId: userB,
      paymentMethod: 'upi',
      amount: booking.total_amount
    });

    const confirmRes = await PaymentService.confirmPayment({
      paymentId: payment.paymentId,
      userId: userB
    });

    expect(confirmRes.paymentStatus).toBe('SUCCESS');
    expect(confirmRes.booking.booking.status).toBe('CONFIRMED');
    expect(confirmRes.booking.ticket.ticket_number).toBeDefined();

    // Verify seat is permanently BOOKED
    const finalSeat = memoryStore.showSeats.get(seatId);
    expect(finalSeat.status).toBe('BOOKED');
    expect(finalSeat.booking_id).toBe(booking.id);
  });

  test('Customer 2-minute booking window: hold has 120s Redis TTL, customer gets 120s booking window', async () => {
    // Pick another available seat for testing
    let seat2Id = null;
    for (const seat of memoryStore.showSeats.values()) {
      if (seat.show_id === showId && seat.status === 'AVAILABLE') {
        seat2Id = seat.id;
        break;
      }
    }
    if (!seat2Id) {
      seat2Id = uuidv4();
      memoryStore.showSeats.set(seat2Id, {
        id: seat2Id, show_id: showId, seat_label: 'C1', row_label: 'C', seat_number: 1,
        category_name: 'Standard', seat_type: 'STANDARD', price: 250, status: 'AVAILABLE'
      });
    }

    const hold = await ReservationService.holdSeats(showId, [seat2Id], userA);
    expect(hold.durationSeconds).toBe(120);
    expect(hold.customerDurationSeconds).toBe(120);
    expect(hold.customerExpiresAt).toBeDefined();

    // User C queues for seat2
    await ReservationService.joinQueue(showId, seat2Id, userC);

    // Simulate customer 2-minute timer expiration (customer took > 2 minutes)
    const res = memoryStore.seatReservations.get(hold.holdId);
    res.customer_expires_at = new Date(Date.now() - 1000).toISOString();

    // User A attempts to book after 2-minute window has elapsed
    await expect(
      BookingService.createBooking(userA, {
        showId,
        holdId: hold.holdId,
        seatIds: [seat2Id],
        customerDetails: { name: 'Late Customer', age: 30 }
      })
    ).rejects.toThrow(/2-minute booking window has expired/i);

    // Promote queue
    await ReservationService.promoteNextCustomer(showId, seat2Id);

    // Seat should now be promoted to User C!
    const seat2 = memoryStore.showSeats.get(seat2Id);
    expect(seat2.status).toBe('HELD');
    expect(seat2.hold_user_id).toBe(userC);
  });
});
