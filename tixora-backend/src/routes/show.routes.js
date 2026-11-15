import { Router } from 'express';
import { ShowService } from '../services/show.service.js';
import { AuthorizationService } from '../services/authorization.service.js';
import { CinemaService } from '../services/cinema.service.js';
import { SeatPlanService } from '../services/seatPlan.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { authenticateUser } from '../middleware/auth.js';
import { requireCinemaOwner, requireCinemaManager } from '../middleware/roles.js';
import { validateRequest } from '../middleware/validation.js';
import { createDemoShowSchema, createShowSchema } from '../validators/show.validator.js';
import { supabaseAdmin, memoryStore } from '../config/supabase.js';

const router = Router();

// --- PUBLIC SHOW ROUTES ---
router.get('/movies/:movieId/shows', async (req, res, next) => {
  try {
    const { date, format } = req.query;
    const shows = await ShowService.getPublicShows({
      movieId: req.params.movieId,
      date,
      format
    });
    return ApiResponse.success(res, shows);
  } catch (err) {
    next(err);
  }
});

router.get('/cinemas/:cinemaId/shows', async (req, res, next) => {
  try {
    const { date } = req.query;
    const shows = await ShowService.getPublicShows({
      cinemaId: req.params.cinemaId,
      date
    });
    return ApiResponse.success(res, shows);
  } catch (err) {
    next(err);
  }
});

router.get('/shows', async (req, res, next) => {
  try {
    const { movieId, cinemaId, date, format } = req.query;
    const shows = await ShowService.getPublicShows({ movieId, cinemaId, date, format });
    return ApiResponse.success(res, shows);
  } catch (err) {
    next(err);
  }
});

router.get('/shows/:showId', async (req, res, next) => {
  try {
    const show = await ShowService.getShowDetail(req.params.showId);
    return ApiResponse.success(res, show);
  } catch (err) {
    next(err);
  }
});

// --- CINEMA OWNER / EXHIBITOR SHOW SCHEDULING ROUTES ---
// Get approved movie authorizations available for this cinema owner
router.get('/cinema/authorized-movies', authenticateUser, requireCinemaManager(), async (req, res, next) => {
  try {
    const cinema = await CinemaService.getMyCinema(req.user.id);
    const authorizations = await AuthorizationService.getApprovedAuthorizationsForCinema(cinema.id);
    return ApiResponse.success(res, authorizations);
  } catch (err) {
    next(err);
  }
});

// Create eligible show (Strictly guarded by authorization, cinema verification, format, screen, date)
router.post('/cinema/shows', authenticateUser, requireCinemaManager(), validateRequest({ body: createShowSchema }), async (req, res, next) => {
  try {
    const result = await ShowService.createShow(req.user.id, req.body);
    return ApiResponse.created(res, result, 'Show scheduled and seat inventory initialized');
  } catch (err) {
    next(err);
  }
});

router.post('/cinema/demo-shows', authenticateUser, requireCinemaManager(), validateRequest({ body: createDemoShowSchema }), async (req, res, next) => {
  try {
    const result = await ShowService.createDemoShow(req.user.id, req.body);
    return ApiResponse.created(res, result, 'Demo screening created with the saved seat plan');
  } catch (err) {
    next(err);
  }
});

router.post('/cinema/shows/:showId/cancel', authenticateUser, requireCinemaManager(), async (req, res, next) => {
  try {
    const reason = req.body?.reason || 'Cancelled by cinema manager';
    const result = await ShowService.cancelShow(req.params.showId, req.user.id, reason, false);
    return ApiResponse.success(res, result, 'Show cancelled successfully');
  } catch (err) {
    next(err);
  }
});

// Note: GET /cinema/shows is handled in cinema.routes.js (supports both CINEMA_OWNER and MOVIE_PROVIDER)

// ─── PUBLIC: Customer Seat Map for a Show ────────────────────────────────────
// GET /shows/:showId/seat-map
// Returns the live seat map for a specific show with per-seat availability status.
// This is what SeatBookingView calls when a customer opens the booking page.
router.get('/shows/:showId/seat-map', async (req, res, next) => {
  try {
    const { showId } = req.params;

    // 1. Load the show record
    const { data: showData } = await supabaseAdmin
      .from('shows')
      .select('*, cinemas(cinema_name, city, address), screens(screen_name)')
      .eq('id', showId)
      .maybeSingle();
    const show = showData || memoryStore.shows.get(showId);
    if (!show) return ApiResponse.error(res, 'Show not found', 404, 'NOT_FOUND');

    // 2. Get the screen's active seat plan (creates default if none exists)
    const seatPlanData = await SeatPlanService.getActiveSeatPlan(show.screen_id);
    const { seatPlan, version, sections: rawSections, categories, seats: planSeats } = seatPlanData;

    // 3. Load live show_seats inventory (has per-seat AVAILABLE/HELD/BOOKED status)
    const { data: showSeatsDb } = await supabaseAdmin
      .from('show_seats')
      .select('*')
      .eq('show_id', showId);

    // Fall back to memoryStore if DB returned nothing
    const showSeatsRaw = showSeatsDb?.length
      ? showSeatsDb
      : [...memoryStore.showSeats.values()].filter(s => s.show_id === showId);

    // Build a quick lookup: seat_id (from seat_plan) → show_seat status/price
    // show_seats uses seat_label = row_label + seat_number  e.g. "A1", "B12"
    const seatStatusMap = new Map(); // key: seat_label  → show_seat row
    for (const ss of showSeatsRaw) {
      const label = ss.seat_label || `${ss.row_label}${ss.seat_number}`;
      seatStatusMap.set(label, ss);
    }

    // 4. Build sections with live seat status
    // Group plan seats by their section
    const sectionMap = new Map(); // section_id → section record
    for (const sec of (rawSections || [])) {
      sectionMap.set(sec.id, sec);
    }

    // Build category lookup
    const categoryMap = new Map();
    for (const cat of (categories || [])) {
      categoryMap.set(cat.id, cat);
    }

    // Group plan seats by section
    const seatsBySection = new Map(); // section_id → seats[]
    for (const seat of (planSeats || [])) {
      const secId = seat.section_id;
      if (!seatsBySection.has(secId)) seatsBySection.set(secId, []);
      seatsBySection.get(secId).push(seat);
    }

    // Build the sections array in the format SeatBookingView expects
    const sections = [];
    for (const [secId, secSeats] of seatsBySection) {
      const sec = sectionMap.get(secId) || {};
      const mappedSeats = secSeats.map(seat => {
        const cat = categoryMap.get(seat.category_id);
        const seatLabel = `${seat.row_label}${seat.seat_number}`;
        const showSeat = seatStatusMap.get(seatLabel);

        const price = showSeat
          ? Number(showSeat.price || (cat?.base_price) || 250)
          : Number(seat.price || (cat?.base_price) || 250);

        const rawStatus = showSeat?.status || 'AVAILABLE';
        const isBooked = rawStatus === 'BOOKED';
        const isHeld = rawStatus === 'HELD' || rawStatus === 'ON_HOLD';

        return {
          id: showSeat?.id || seat.id,           // show_seat id (for booking)
          seatPlanSeatId: seat.id,
          seatId: seatLabel,                       // "A1", "B7" etc — display label
          row: seat.row_label,
          number: seat.seat_number,
          seatType: seat.seat_type || cat?.seat_type || 'STANDARD',
          categoryName: cat?.display_name || cat?.name || 'Standard',
          tier: sec.display_name || sec.name || 'Main Hall',
          price,
          xPosition: seat.x_position,
          yPosition: seat.y_position,
          width: seat.width || 32,
          height: seat.height || 32,
          status: rawStatus,
          isAvailable: !isBooked && !isHeld,
          isBooked,
          isHeld,
          heldByCurrentUser: false,  // server-side: no session context here
          isAccessible: seat.is_accessible || false,
          isWheelchairSpace: seat.is_wheelchair_space || false,
        };
      });

      sections.push({
        id: secId,
        name: sec.display_name || sec.name || 'Main Hall',
        displayName: sec.display_name || sec.name || 'Main Hall',
        sortOrder: sec.sort_order || 0,
        seats: mappedSeats,
      });
    }

    // Sort sections by sortOrder
    sections.sort((a, b) => a.sortOrder - b.sortOrder);

    // If no sections built from seat plan (edge case), try building from show_seats directly
    if (sections.length === 0 && showSeatsRaw.length > 0) {
      const fallbackByCategory = new Map();
      for (const ss of showSeatsRaw) {
        const cat = ss.category_name || 'Standard';
        if (!fallbackByCategory.has(cat)) fallbackByCategory.set(cat, []);
        fallbackByCategory.get(cat).push({
          id: ss.id,
          seatId: ss.seat_label || `${ss.row_label}${ss.seat_number}`,
          row: ss.row_label,
          number: ss.seat_number,
          seatType: ss.seat_type || 'STANDARD',
          categoryName: cat,
          tier: cat,
          price: Number(ss.price || 250),
          status: ss.status || 'AVAILABLE',
          isAvailable: (ss.status || 'AVAILABLE') === 'AVAILABLE',
          isBooked: ss.status === 'BOOKED',
          isHeld: ss.status === 'HELD' || ss.status === 'ON_HOLD',
          heldByCurrentUser: false,
          isAccessible: false,
          isWheelchairSpace: false,
        });
      }
      for (const [catName, catSeats] of fallbackByCategory) {
        sections.push({ id: catName, name: catName, displayName: catName, sortOrder: 0, seats: catSeats });
      }
    }

    const totalSeats = sections.reduce((sum, s) => sum + s.seats.length, 0);
    const availableSeats = sections.reduce((sum, s) => sum + s.seats.filter(seat => seat.isAvailable).length, 0);

    return ApiResponse.success(res, {
      showId,
      show: {
        movieId: show.movie_id,
        cinemaId: show.cinema_id,
        screenId: show.screen_id,
        cinemaName: show.cinemas?.cinema_name || '',
        city: show.cinemas?.city || '',
        address: show.cinemas?.address || '',
        screenName: show.screens?.screen_name || '',
        showDate: show.show_date,
        startTime: show.start_time,
        endTime: show.end_time,
        format: show.format,
        language: show.language,
        status: show.status,
      },
      seatPlan: {
        id: seatPlan?.id,
        screenPosition: version?.screen_position || 'TOP',
        canvasWidth: version?.canvas_width || 1000,
        canvasHeight: version?.canvas_height || 600,
      },
      sections,
      totalSeats,
      availableSeats,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
