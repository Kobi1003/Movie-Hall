import { supabaseAdmin } from '../src/config/supabase.js';

async function main() {
  const targetMovieTitles = ['Sholay', 'Se7en', 'Dhurandhar: The Revenge', 'Bongaon er Itihas'];

  const { data: movies } = await supabaseAdmin
    .from('movies')
    .select('*')
    .in('title', targetMovieTitles);

  console.log('Target Movies:', movies?.map(m => ({ id: m.id, title: m.title, provider: m.created_by_provider })));
  const movieIds = (movies || []).map(m => m.id);

  console.log('\n--- Shows for these movies ---');
  const { data: shows } = await supabaseAdmin.from('shows').select('*').in('movie_id', movieIds);
  console.log('Shows count:', shows?.length);
  console.log('Shows:', shows?.map(s => ({ id: s.id, movie_id: s.movie_id, cinema_id: s.cinema_id, status: s.status })));
  const showIds = (shows || []).map(s => s.id);

  console.log('\n--- Bookings for these movies or shows ---');
  let bookings = [];
  if (showIds.length > 0) {
    const { data: bByShow } = await supabaseAdmin.from('bookings').select('*').in('show_id', showIds);
    bookings = bByShow || [];
  }
  const { data: bByMovie } = await supabaseAdmin.from('bookings').select('*').in('movie_id', movieIds);
  for (const b of bByMovie || []) {
    if (!bookings.some(x => x.id === b.id)) bookings.push(b);
  }
  console.log('Bookings count:', bookings.length);
  console.log('Bookings:', bookings.map(b => ({ id: b.id, show_id: b.show_id, movie_id: b.movie_id, status: b.status })));
  const bookingIds = bookings.map(b => b.id);

  console.log('\n--- Tickets ---');
  if (bookingIds.length > 0) {
    const { data: tickets } = await supabaseAdmin.from('tickets').select('id, booking_id').in('booking_id', bookingIds);
    console.log('Tickets count:', tickets?.length);
  }

  console.log('\n--- Payments ---');
  if (bookingIds.length > 0) {
    const { data: payments } = await supabaseAdmin.from('payments').select('id, booking_id').in('booking_id', bookingIds);
    console.log('Payments count:', payments?.length);
  }

  console.log('\n--- Booking Seats ---');
  if (bookingIds.length > 0) {
    const { data: bSeats } = await supabaseAdmin.from('booking_seats').select('id, booking_id').in('booking_id', bookingIds);
    console.log('Booking Seats count:', bSeats?.length);
  }

  console.log('\n--- Show Seats ---');
  if (showIds.length > 0) {
    const { data: sSeats } = await supabaseAdmin.from('show_seats').select('id, show_id').in('show_id', showIds);
    console.log('Show Seats count:', sSeats?.length);
  }

  console.log('\n--- Seat Reservations ---');
  if (showIds.length > 0) {
    const { data: sRes } = await supabaseAdmin.from('seat_reservations').select('id, show_id').in('show_id', showIds);
    console.log('Seat Reservations count:', sRes?.length);
  }

  console.log('\n--- Movie Authorizations ---');
  const { data: auths } = await supabaseAdmin.from('movie_authorizations').select('id, movie_id, cinema_id').in('movie_id', movieIds);
  console.log('Movie Authorizations count:', auths?.length);
  console.log('Movie Authorizations:', auths);

  console.log('\n--- Movie Documents ---');
  const { data: docs } = await supabaseAdmin.from('movie_documents').select('id, movie_id').in('movie_id', movieIds);
  console.log('Movie Documents count:', docs?.length);
}

main().catch(console.error);
