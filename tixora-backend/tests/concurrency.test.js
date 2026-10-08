import { runSeed } from '../scripts/seed.js';
import { ReservationService } from '../src/services/reservation.service.js';
import { memoryStore, supabaseAdmin } from '../src/config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

describe('Requirement 91: Concurrency & Double-Hold Prevention', () => {
  let showId;
  let targetSeatId;
  let customerAId;
  let customerBId;

  beforeAll(async () => {
    const seed = await runSeed();
    showId = seed.show.id;
    customerAId = seed.customer.id;

    // Create Customer B
    customerBId = 'cust-b-' + Date.now();
    memoryStore.profiles.set(customerBId, {
      id: customerBId,
      role: 'CUSTOMER',
      full_name: 'Customer B',
      email: 'customerB@gmail.com'
    });

    // Find Seat A1 (or first seat in inventory)
    let foundSeat = null;
    for (const seat of memoryStore.showSeats.values()) {
      if (seat.show_id === showId && (seat.seat_label === 'A1' || seat.status === 'AVAILABLE')) {
        foundSeat = seat;
        break;
      }
    }
    if (!foundSeat) {
      const { data } = await supabaseAdmin.from('show_seats').select('*').eq('show_id', showId).limit(1);
      if (data && data.length > 0) {
        foundSeat = data[0];
        memoryStore.showSeats.set(foundSeat.id, foundSeat);
      }
    }
    if (!foundSeat) {
      targetSeatId = uuidv4();
      foundSeat = {
        id: targetSeatId,
        show_id: showId,
        seat_label: 'A1',
        row_label: 'A',
        seat_number: 1,
        category_name: 'Standard',
        seat_type: 'STANDARD',
        price: 250,
        status: 'AVAILABLE'
      };
      memoryStore.showSeats.set(targetSeatId, foundSeat);
    } else {
      targetSeatId = foundSeat.id;
    }
  }, 60000);

  test('Two customers attempting to hold the same seat simultaneously: exactly one succeeds, other gets 409 SEAT_UNAVAILABLE', async () => {
    // Fire two requests concurrently using Promise.allSettled
    const [resA, resB] = await Promise.allSettled([
      ReservationService.holdSeats(showId, [targetSeatId], customerAId),
      ReservationService.holdSeats(showId, [targetSeatId], customerBId)
    ]);

    const successes = [resA, resB].filter(r => r.status === 'fulfilled');
    const failures = [resA, resB].filter(r => r.status === 'rejected');

    // Exactly 1 must succeed
    expect(successes.length).toBe(1);
    expect(successes[0].value.holdId).toBeDefined();
    expect(successes[0].value.seats.length).toBe(1);
    expect(successes[0].value.durationSeconds).toBe(120);

    // Exactly 1 must fail with 409 SEAT_UNAVAILABLE
    expect(failures.length).toBe(1);
    expect(failures[0].reason.statusCode).toBe(409);
    expect(failures[0].reason.code).toBe('SEAT_UNAVAILABLE');

    // Authoritative show_seat state must be HELD by the winner
    const seat = memoryStore.showSeats.get(targetSeatId);
    expect(seat.status).toBe('HELD');
    expect([customerAId, customerBId]).toContain(seat.hold_user_id);
  });
});
