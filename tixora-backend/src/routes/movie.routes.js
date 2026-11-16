import { Router } from 'express';
import { MovieService } from '../services/movie.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { authenticateUser } from '../middleware/auth.js';
import { requireExhibitor } from '../middleware/roles.js';
import { validateRequest } from '../middleware/validation.js';
import { createMovieSchema, updateMovieSchema } from '../validators/movie.validator.js';

const router = Router();

router.get('/movies', async (req, res, next) => {
  try {
    const { search, language, genre, city, date, lat, lng, sortBy } = req.query;
    const movies = await MovieService.getPublicMovies({ search, language, genre, city, date, lat, lng, sortBy });
    return ApiResponse.success(res, movies);
  } catch (err) {
    next(err);
  }
});

router.post('/movies', authenticateUser, requireExhibitor(), validateRequest({ body: createMovieSchema }), async (req, res, next) => {
  try {
    const movie = await MovieService.createMovie(req.user.id, req.body);
    return ApiResponse.created(res, movie, 'Movie created successfully');
  } catch (err) {
    next(err);
  }
});

router.patch('/movies/:movieId', authenticateUser, requireExhibitor(), validateRequest({ body: updateMovieSchema }), async (req, res, next) => {
  try {
    const movie = await MovieService.updateMovie(req.user.id, req.params.movieId, req.body);
    return ApiResponse.success(res, movie, 'Movie updated successfully');
  } catch (err) {
    next(err);
  }
});

router.get('/movies/:movieId', async (req, res, next) => {
  try {
    const movie = await MovieService.getPublicMovieDetail(req.params.movieId);
    return ApiResponse.success(res, movie);
  } catch (err) {
    next(err);
  }
});

export default router;
