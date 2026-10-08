import { Router } from 'express';
import { MovieService } from '../services/movie.service.js';
import { AuthorizationService } from '../services/authorization.service.js';
import { CinemaService } from '../services/cinema.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { authenticateUser } from '../middleware/auth.js';
import { requireExhibitor } from '../middleware/roles.js';
import { validateRequest } from '../middleware/validation.js';
import { createMovieSchema, updateMovieSchema } from '../validators/movie.validator.js';
import { createAuthorizationSchema } from '../validators/authorization.validator.js';
import { uploadDocument } from '../middleware/upload.js';

const router = Router();

// Require Movie Provider role for all routes in this router
router.use(authenticateUser, requireExhibitor());

// --- MOVIES ---
router.get('/movies', async (req, res, next) => {
  try {
    const movies = await MovieService.getProviderMovies(req.user.id);
    return ApiResponse.success(res, movies);
  } catch (err) {
    next(err);
  }
});

router.post('/movies', validateRequest({ body: createMovieSchema }), async (req, res, next) => {
  try {
    const movie = await MovieService.createMovie(req.user.id, req.body);
    return ApiResponse.created(res, movie, 'Movie created successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/movies/upload-poster', uploadDocument.single('poster'), async (req, res, next) => {
  try {
    const result = await MovieService.uploadPoster(req.user.id, req.file);
    return ApiResponse.created(res, result, 'Movie poster uploaded successfully');
  } catch (err) {
    next(err);
  }
});

router.get('/movies/:movieId', async (req, res, next) => {
  try {
    const movie = await MovieService.getMovieById(req.params.movieId);
    return ApiResponse.success(res, movie);
  } catch (err) {
    next(err);
  }
});

router.patch('/movies/:movieId', validateRequest({ body: updateMovieSchema }), async (req, res, next) => {
  try {
    const movie = await MovieService.updateMovie(req.user.id, req.params.movieId, req.body);
    return ApiResponse.success(res, movie, 'Movie updated successfully');
  } catch (err) {
    next(err);
  }
});

router.get('/movies/:movieId/documents', async (req, res, next) => {
  try {
    const docs = await MovieService.getMovieDocuments(req.user.id, req.params.movieId);
    return ApiResponse.success(res, docs);
  } catch (err) {
    next(err);
  }
});

router.post('/movies/:movieId/documents', uploadDocument.single('document'), async (req, res, next) => {
  try {
    const doc = await MovieService.uploadDocument(req.user.id, req.params.movieId, req.body, req.file);
    return ApiResponse.created(res, doc, 'Document uploaded successfully');
  } catch (err) {
    next(err);
  }
});

// --- CINEMA DISCOVERY ---
router.get('/cinemas', async (req, res, next) => {
  try {
    const cinemas = await CinemaService.getPublicCinemas({});
    return ApiResponse.success(res, cinemas);
  } catch (err) {
    next(err);
  }
});

router.get('/cinemas/:cinemaId', async (req, res, next) => {
  try {
    const cinema = await CinemaService.getPublicCinemaById(req.params.cinemaId);
    return ApiResponse.success(res, cinema);
  } catch (err) {
    next(err);
  }
});

// --- EXHIBITION AUTHORIZATIONS ---
router.get('/authorizations', async (req, res, next) => {
  try {
    const authorizations = await AuthorizationService.getProviderAuthorizations(req.user.id);
    return ApiResponse.success(res, authorizations);
  } catch (err) {
    next(err);
  }
});

router.post('/authorizations', validateRequest({ body: createAuthorizationSchema }), async (req, res, next) => {
  try {
    const authorization = await AuthorizationService.createAuthorization(req.user.id, req.body);
    return ApiResponse.created(res, authorization, 'Exhibition authorization drafted');
  } catch (err) {
    next(err);
  }
});

router.post('/authorizations/:id/submit', async (req, res, next) => {
  try {
    const result = await AuthorizationService.submitAuthorization(req.user.id, req.params.id);
    return ApiResponse.success(res, result, 'Authorization submitted for admin review');
  } catch (err) {
    next(err);
  }
});

export default router;
