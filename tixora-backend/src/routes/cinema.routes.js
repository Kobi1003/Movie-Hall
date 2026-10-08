import { Router } from 'express';
import { CinemaService } from '../services/cinema.service.js';
import { SeatPlanService } from '../services/seatPlan.service.js';
import { MovieService } from '../services/movie.service.js';
import { ShowService } from '../services/show.service.js';
import { AnalyticsService } from '../services/analytics.service.js';
import { GeoService } from '../services/geo.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { authenticateUser } from '../middleware/auth.js';
import { requireCinemaOwner, requireCinemaManager, requireExhibitor } from '../middleware/roles.js';
import { validateRequest } from '../middleware/validation.js';
import { createCinemaSchema, updateCinemaSchema, createScreenSchema, updateScreenSchema } from '../validators/cinema.validator.js';
import { createMovieSchema, updateMovieSchema } from '../validators/movie.validator.js';
import { saveSeatPlanSchema } from '../validators/seatPlan.validator.js';
import { uploadDocument } from '../middleware/upload.js';

const router = Router();

router.get('/cinema/movies', authenticateUser, requireExhibitor(), async (req, res, next) => {
  try {
    const movies = await MovieService.getProviderMovies(req.user.id, req.user.role);
    return ApiResponse.success(res, movies);
  } catch (err) {
    next(err);
  }
});

// Provider's shows — returns shows for movies owned by this provider
router.get('/cinema/shows', authenticateUser, requireExhibitor(), async (req, res, next) => {
  try {
    const { date } = req.query;
    let shows = [];
    if (req.user.role === 'CINEMA_OWNER') {
      try {
        const cinema = await CinemaService.getMyCinema(req.user.id);
        shows = await ShowService.getPublicShows({ cinemaId: cinema.id, date });
      } catch (_) {
        shows = [];
      }
      // If user is also a movie provider or has registered movies, merge those shows
      try {
        const myMovies = await MovieService.getProviderMovies(req.user.id, req.user.role);
        const movieIds = (myMovies || []).map(m => m.id);
        if (movieIds.length > 0) {
          const allShows = await Promise.all(
            movieIds.map(id => ShowService.getPublicShows({ movieId: id, date }).catch(() => []))
          );
          const existingIds = new Set(shows.map(s => s.id));
          for (const s of allShows.flat()) {
            if (!existingIds.has(s.id)) {
              shows.push(s);
              existingIds.add(s.id);
            }
          }
        }
      } catch (_) {}
    } else {
      // Movie providers see shows for their movies
      const myMovies = await MovieService.getProviderMovies(req.user.id, req.user.role);
      const movieIds = (myMovies || []).map(m => m.id);
      if (movieIds.length === 0) { return ApiResponse.success(res, []); }
      // Fetch shows for all provider movies
      const allShows = await Promise.all(
        movieIds.map(id => ShowService.getPublicShows({ movieId: id, date }).catch(() => []))
      );
      shows = allShows.flat();
    }
    shows = await ShowService.attachPerformanceMetrics(shows);
    return ApiResponse.success(res, shows);
  } catch (err) {
    next(err);
  }
});

router.post('/cinema/movies', authenticateUser, requireExhibitor(), validateRequest({ body: createMovieSchema }), async (req, res, next) => {
  try {
    const movie = await MovieService.createMovie(req.user.id, req.body);
    return ApiResponse.created(res, movie, 'Movie created successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/cinema/movies/upload-poster', authenticateUser, requireExhibitor(), uploadDocument.single('poster'), async (req, res, next) => {
  try {
    const result = await MovieService.uploadPoster(req.user.id, req.file);
    return ApiResponse.created(res, result, 'Movie poster uploaded successfully');
  } catch (err) {
    next(err);
  }
});

router.patch('/cinema/movies/:movieId', authenticateUser, requireExhibitor(), validateRequest({ body: updateMovieSchema }), async (req, res, next) => {
  try {
    const movie = await MovieService.updateMovie(req.user.id, req.params.movieId, req.body);
    return ApiResponse.success(res, movie, 'Movie updated successfully');
  } catch (err) {
    next(err);
  }
});

// --- PUBLIC ROUTES ---
router.get('/cinemas', async (req, res, next) => {
  try {
    const { city, lat, lng, sortBy, userCity } = req.query;
    const cinemas = await CinemaService.getPublicCinemas({ city, lat, lng, sortBy, userCity });
    return ApiResponse.success(res, cinemas);
  } catch (err) {
    next(err);
  }
});

router.get('/cinemas/cities', async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    const cities = await CinemaService.getCitiesWithCinemas({ lat, lng });
    return ApiResponse.success(res, cities);
  } catch (err) {
    next(err);
  }
});

router.get('/cinemas/:cinemaId', async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    const cinema = await CinemaService.getPublicCinemaById(req.params.cinemaId, { lat, lng });
    return ApiResponse.success(res, cinema);
  } catch (err) {
    next(err);
  }
});

// Geocoding and Distance Matrix Helpers (Backed by Google Maps API & Fallbacks)
router.get('/location/geocode', async (req, res, next) => {
  try {
    const { address, city, state, postalCode } = req.query;
    const result = await GeoService.geocode({ address, city, state, postalCode });
    return ApiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
});

router.post('/location/distance', async (req, res, next) => {
  try {
    const { origin, destination } = req.body;
    const result = await GeoService.calculateDistance(origin, destination);
    return ApiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
});

// --- CINEMA OWNER PROFILE & CINEMA ROUTES ---
router.post('/cinema', authenticateUser, requireCinemaManager(), validateRequest({ body: createCinemaSchema }), async (req, res, next) => {
  try {
    const cinema = await CinemaService.createCinema(req.user.id, req.body);
    return ApiResponse.created(res, cinema, 'Cinema profile created successfully');
  } catch (err) {
    next(err);
  }
});

router.get('/cinema', authenticateUser, requireCinemaManager(), async (req, res, next) => {
  try {
    const cinema = await CinemaService.getMyCinema(req.user.id);
    return ApiResponse.success(res, cinema);
  } catch (err) {
    next(err);
  }
});

router.patch('/cinema', authenticateUser, requireCinemaManager(), validateRequest({ body: updateCinemaSchema }), async (req, res, next) => {
  try {
    const cinema = await CinemaService.updateCinema(req.user.id, req.body);
    return ApiResponse.success(res, cinema, 'Cinema profile updated successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/cinema/verification', authenticateUser, requireCinemaManager(), async (req, res, next) => {
  try {
    const result = await CinemaService.submitVerification(req.user.id);
    return ApiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
});

router.post('/cinema/documents', authenticateUser, requireCinemaManager(), uploadDocument.single('document'), async (req, res, next) => {
  try {
    const doc = await CinemaService.uploadDocument(req.user.id, req.body, req.file);
    return ApiResponse.created(res, doc, 'Document uploaded successfully');
  } catch (err) {
    next(err);
  }
});

router.get('/cinema/documents', authenticateUser, requireCinemaManager(), async (req, res, next) => {
  try {
    const docs = await CinemaService.getDocuments(req.user.id);
    return ApiResponse.success(res, docs);
  } catch (err) {
    next(err);
  }
});

// --- SCREENS ---
router.get('/cinema/screens', authenticateUser, requireCinemaManager(), async (req, res, next) => {
  try {
    const screens = await CinemaService.getScreens(req.user.id);
    return ApiResponse.success(res, screens);
  } catch (err) {
    next(err);
  }
});

router.post('/cinema/screens', authenticateUser, requireCinemaManager(), validateRequest({ body: createScreenSchema }), async (req, res, next) => {
  try {
    const screen = await CinemaService.createScreen(req.user.id, req.body);
    return ApiResponse.created(res, screen, 'Screen created successfully');
  } catch (err) {
    next(err);
  }
});

router.patch('/cinema/screens/:screenId', authenticateUser, requireCinemaManager(), validateRequest({ body: updateScreenSchema }), async (req, res, next) => {
  try {
    const screen = await CinemaService.updateScreen(req.user.id, req.params.screenId, req.body);
    return ApiResponse.success(res, screen, 'Screen updated successfully');
  } catch (err) { next(err); }
});

router.get('/cinema/screens/:screenId', authenticateUser, requireCinemaManager(), async (req, res, next) => {
  try {
    const screen = await CinemaService.getScreenById(req.user.id, req.params.screenId);
    return ApiResponse.success(res, screen);
  } catch (err) {
    next(err);
  }
});

// --- SEAT PLAN MANAGEMENT ---
router.post('/cinema/screens/:screenId/seat-plan/validate', authenticateUser, requireCinemaManager(), async (req, res) => {
  const result = SeatPlanService.validateLayout(req.params.screenId, req.body);
  return res.json(result);
});

router.post('/cinema/screens/:screenId/seat-plan', authenticateUser, requireCinemaManager(), validateRequest({ body: saveSeatPlanSchema }), async (req, res, next) => {
  try {
    const result = await SeatPlanService.saveSeatPlan(req.params.screenId, req.body, req.user.id);
    // Auto-publish the new version so it is immediately available for show scheduling and customer booking.
    // Clients can still call the dedicated /publish endpoint to switch to a different version.
    try {
      if (result?.version?.id) {
        const publishResult = await SeatPlanService.publishSeatPlan(req.params.screenId, result.version.id, req.user.id);
        return ApiResponse.created(res, { ...result, published: true, capacity: publishResult.capacity }, 'Seat plan saved and published');
      }
    } catch (publishErr) {
      // Save succeeded; return the result with a warning if publish failed
      return ApiResponse.created(res, { ...result, published: false, publishWarning: publishErr.message }, 'Seat plan saved (publish failed: ' + publishErr.message + ')');
    }
    return ApiResponse.created(res, result, 'Seat plan saved as valid version');
  } catch (err) {
    next(err);
  }
});

router.post('/cinema/screens/:screenId/seat-plan/publish', authenticateUser, requireCinemaManager(), async (req, res, next) => {
  try {
    const versionId = req.body.versionId;
    const result = await SeatPlanService.publishSeatPlan(req.params.screenId, versionId, req.user.id);
    return ApiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
});

router.post('/seat-plans/screens/:screenId', authenticateUser, requireCinemaManager(), async (req, res, next) => {
  try {
    const cinema = await CinemaService.getMyCinema(req.user.id);
    const screens = await CinemaService.getScreens(req.user.id);
    const requested = screens.find((s) => s.id === req.params.screenId);
    const screen = requested || screens[0];
    if (!screen) throw new Error('No screen available for this cinema');
    const result = await SeatPlanService.saveSeatPlan(screen.id, req.body, req.user.id);
    await SeatPlanService.publishSeatPlan(screen.id, result.version.id, req.user.id);
    return ApiResponse.created(res, { ...result, cinemaId: cinema.id, screenId: screen.id }, 'Seat plan saved');
  } catch (err) {
    next(err);
  }
});

router.get('/cinema/screens/:screenId/seat-plan', authenticateUser, async (req, res, next) => {
  try {
    const plan = await SeatPlanService.getActiveSeatPlan(req.params.screenId);
    return ApiResponse.success(res, plan);
  } catch (err) {
    next(err);
  }
});

router.get('/cinema/shows/:showId/occupancy', authenticateUser, async (req, res, next) => {
  try {
    const occupancy = await AnalyticsService.getShowOccupancy(req.params.showId);
    return ApiResponse.success(res, occupancy);
  } catch (err) {
    next(err);
  }
});

// --- CINEMA REVIEWS & RATINGS (Customer Dashboard) ---
router.post('/cinemas/:cinemaId/reviews', authenticateUser, async (req, res, next) => {
  try {
    const { rating, reviewText, tags = [], bookingId = null, cinemaName = '' } = req.body;
    const review = await CinemaService.addReview(req.user.id, req.params.cinemaId, {
      rating,
      reviewText,
      tags,
      bookingId,
      cinemaName,
      userName: req.user.full_name || req.user.email?.split('@')[0] || 'Moviegoer'
    });
    return ApiResponse.created(res, review, 'Review submitted successfully');
  } catch (err) {
    next(err);
  }
});

router.get('/cinemas/reviews/my', authenticateUser, async (req, res, next) => {
  try {
    const reviews = await CinemaService.getUserReviews(req.user.id);
    return ApiResponse.success(res, reviews);
  } catch (err) {
    next(err);
  }
});

export default router;
