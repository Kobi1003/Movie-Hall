import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { validateRequest } from '../middleware/validation.js';
import { signupSchema, loginSchema } from '../validators/auth.validator.js';
import { authenticateUser } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/signup', authLimiter, validateRequest({ body: signupSchema }), async (req, res, next) => {
  try {
    const result = await AuthService.signup(req.body);
    return ApiResponse.created(res, result, 'User registered successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, validateRequest({ body: loginSchema }), async (req, res, next) => {
  try {
    const result = await AuthService.login(req.body);
    return ApiResponse.success(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password/otp', authLimiter, async (req, res, next) => {
  try {
    const result = await AuthService.requestPasswordOtp(req.body);
    return ApiResponse.success(res, result, result.message);
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password/verify', authLimiter, async (req, res, next) => {
  try {
    const result = await AuthService.verifyPasswordOtp(req.body);
    return ApiResponse.success(res, result, result.message);
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authenticateUser, (req, res) => {
  return ApiResponse.success(res, {}, 'Logout successful');
});

router.get('/me', authenticateUser, async (req, res, next) => {
  try {
    const profile = await AuthService.getProfile(req.user.id);
    return ApiResponse.success(res, profile);
  } catch (err) {
    next(err);
  }
});

export default router;
