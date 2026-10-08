import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { validateRequest } from '../middleware/validation.js';
import { updateProfileSchema } from '../validators/auth.validator.js';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

router.get('/me', authenticateUser, async (req, res, next) => {
  try {
    const profile = await AuthService.getProfile(req.user.id);
    return ApiResponse.success(res, profile);
  } catch (err) {
    next(err);
  }
});

router.patch('/me', authenticateUser, validateRequest({ body: updateProfileSchema }), async (req, res, next) => {
  try {
    const updated = await AuthService.updateProfile(req.user.id, req.body);
    return ApiResponse.success(res, updated, 'Profile updated successfully');
  } catch (err) {
    next(err);
  }
});

export default router;
