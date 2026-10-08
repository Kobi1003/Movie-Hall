import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/errors.js';

export class AnalyticsService {
  static async getShowOccupancy(showId) {
    const { data: seats, error } = await supabaseAdmin.from('show_seats').select('status, held_until').eq('show_id', showId);
    if (error) throw new AppError('Could not load show occupancy', 503, 'DATABASE_UNAVAILABLE');
    const now = Date.now();
    let booked = 0, held = 0, available = 0;
    for (const seat of seats || []) {
      if (seat.status === 'BOOKED') booked++;
      else if (seat.status === 'HELD' && (!seat.held_until || new Date(seat.held_until).getTime() > now)) held++;
      else available++;
    }
    const capacity = (seats || []).length;
    return { capacity, booked, held, available, occupancyPercent: capacity ? Number(((booked / capacity) * 100).toFixed(2)) : 0 };
  }

  static async getAdminDashboard() {
    const results = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('cinemas').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('cinemas').select('*', { count: 'exact', head: true }).eq('verification_status', 'VERIFIED'),
      supabaseAdmin.from('cinemas').select('*', { count: 'exact', head: true }).in('verification_status', ['SUBMITTED', 'UNDER_REVIEW']),
      supabaseAdmin.from('movies').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('movies').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabaseAdmin.from('shows').select('*', { count: 'exact', head: true }).eq('status', 'PUBLISHED'),
      supabaseAdmin.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'CONFIRMED'),
      supabaseAdmin.from('exhibition_authorizations').select('*', { count: 'exact', head: true }).in('status', ['SUBMITTED', 'UNDER_REVIEW']),
      supabaseAdmin.from('bookings').select('total_amount').eq('status', 'CONFIRMED')
    ]);
    if (results.some(result => result.error)) throw new AppError('Could not load dashboard metrics', 503, 'DATABASE_UNAVAILABLE');
    const [users, cinemas, verified, pending, movies, activeMovies, shows, bookings, authorizations, revenue] = results;
    return {
      totalUsers: users.count || 0,
      totalCinemas: cinemas.count || 0,
      verifiedCinemas: verified.count || 0,
      pendingCinemas: pending.count || 0,
      totalMovies: movies.count || 0,
      activeMovies: activeMovies.count || 0,
      activeShows: shows.count || 0,
      totalBookings: bookings.count || 0,
      grossBookingValue: (revenue.data || []).reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0),
      pendingAuthorizations: authorizations.count || 0
    };
  }
}
