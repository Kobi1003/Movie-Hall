import { Router } from 'express';
import { ShowService } from '../services/show.service.js';
import { AuthorizationService } from '../services/authorization.service.js';
import { CinemaService } from '../services/cinema.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { authenticateUser } from '../middleware/auth.js';
import { requireCinemaOwner, requireCinemaManager } from '../middleware/roles.js';
import { validateRequest } from '../middleware/validation.js';
import { createDemoShowSchema, createShowSchema } from '../validators/show.validator.js';

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

export default router;
