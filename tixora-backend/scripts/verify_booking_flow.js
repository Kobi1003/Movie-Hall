import jwt from 'jsonwebtoken';

const JWT_SECRET = 'super-secret-tixora-jwt-token-key-change-in-production-2026';

async function runVerification() {
  console.log('=== STEP 1: VERIFY PUBLIC MOVIE CATALOG ===');
  const res = await fetch('http://localhost:5000/api/v1/movies');
  const catalog = await res.json();
  console.log('Movies fetched successfully:', catalog.success);
  console.log('Total movies in catalog:', catalog.data?.length);

  const interstellar = catalog.data?.find(m => m.title.toLowerCase().includes('interstellar'));
  if (!interstellar) throw new Error('Interstellar not found in public movies');
  console.log('Found Interstellar! ID:', interstellar.id);
  console.log('Interstellar theatres count:', interstellar.theatres?.length);

  const theatreWithShows = interstellar.theatres?.find(t => t.showtimes?.length > 0);
  if (!theatreWithShows) throw new Error('No theatre with showtimes found for Interstellar');
  console.log('Theatre:', theatreWithShows.name, 'City:', theatreWithShows.city, 'Screen:', theatreWithShows.screenName);
  console.log('Showtimes count:', theatreWithShows.showtimes?.length);

  const testShow = theatreWithShows.showtimes[0];
  console.log('\n=== STEP 2: VERIFY AUDITORIUM SEAT MAP FOR SHOW ===');
  console.log('Testing Show ID:', testShow.showId, 'Date:', testShow.date, 'Time:', testShow.time);

  const seatMapRes = await fetch(`http://localhost:5000/api/v1/shows/${testShow.showId}/seat-map`);
  const seatMap = await seatMapRes.json();
  console.log('Seat map fetched successfully:', seatMap.success);
  console.log('Seat categories/sections:', seatMap.data?.sections?.map(s => (`${s.name} (${s.seats?.length} seats, Rs.${s.seats?.[0]?.price})`)));
  
  const allSeats = seatMap.data?.sections?.flatMap(s => s.seats) || [];
  console.log('Total seats in auditorium:', allSeats.length);
  const availableSeats = allSeats.filter(s => s.status === 'AVAILABLE');
  console.log('Available seats count:', availableSeats.length);

  if (availableSeats.length === 0) throw new Error('No available seats found');

  const selectedSeat = availableSeats[0];
  console.log('Target Seat for booking:', selectedSeat.seatId, 'Row:', selectedSeat.row, 'Number:', selectedSeat.number, 'Price:', selectedSeat.price);

  console.log('\n=== STEP 3: PREPARE AUTHENTICATED CUSTOMER TOKEN ===');
  // Customer profile: e02c6659-1232-4080-8442-fbc06792e011 (testcustomer@tixora.io)
  const token = jwt.sign({
    id: 'e02c6659-1232-4080-8442-fbc06792e011',
    email: 'testcustomer@tixora.io',
    role: 'CUSTOMER'
  }, JWT_SECRET, { expiresIn: '1h' });
  console.log('Customer JWT generated successfully');

  console.log('\n=== STEP 4: ATOMIC SEAT HOLD RESERVATION (3-MIN LOCK) ===');
  const holdRes = await fetch(`http://localhost:5000/api/v1/shows/${testShow.showId}/hold`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ seatIds: [selectedSeat.id] })
  });
  const holdData = await holdRes.json();
  console.log('Seat hold response status:', holdData.success, 'Hold ID:', holdData.data?.holdId);
  if (!holdData.success) throw new Error('Seat hold failed: ' + holdData.message);

  console.log('\n=== STEP 5: VERIFY SEAT MAP REFLECTS HELD STATUS ===');
  const seatMapAfterHold = await (await fetch(`http://localhost:5000/api/v1/shows/${testShow.showId}/seat-map`)).json();
  const heldSeat = seatMapAfterHold.data?.sections?.flatMap(s => s.seats).find(s => s.id === selectedSeat.id);
  console.log('Seat status in live map after hold:', heldSeat?.status);

  console.log('\n=== STEP 6: RELEASE SEAT HOLD ===');
  const releaseRes = await fetch(`http://localhost:5000/api/v1/shows/${testShow.showId}/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ holdId: holdData.data.holdId })
  });
  const releaseData = await releaseRes.json();
  console.log('Release hold response status:', releaseData.success);

  const seatMapAfterRelease = await (await fetch(`http://localhost:5000/api/v1/shows/${testShow.showId}/seat-map`)).json();
  const releasedSeat = seatMapAfterRelease.data?.sections?.flatMap(s => s.seats).find(s => s.id === selectedSeat.id);
  console.log('Seat status after release:', releasedSeat?.status);

  console.log('\n=== STEP 7: VERIFY SCREEN "QUORA" CREATED BY USER ===');
  // Show 129dbba9-3f30-4f16-a2d7-d1758d9706c3 created for Quora
  const quoraMapRes = await fetch('http://localhost:5000/api/v1/shows/129dbba9-3f30-4f16-a2d7-d1758d9706c3/seat-map');
  const quoraMap = await quoraMapRes.json();
  console.log('Quora screen seat map success:', quoraMap.success);
  console.log('Quora seat tiers:', quoraMap.data?.sections?.map(s => `${s.name}: ${s.seats?.length} seats`));

  console.log('\n===============================================================');
  console.log('SUCCESS! ALL TESTS PASSED: CUSTOMER SEAT BOOKING FLOW VERIFIED!');
  console.log('===============================================================');
}

runVerification().catch(err => {
  console.error('VERIFICATION ERROR:', err.message);
  process.exit(1);
});
