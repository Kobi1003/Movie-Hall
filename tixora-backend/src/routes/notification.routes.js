import { Router } from 'express';
import { NotificationService } from '../services/notification.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

router.use(authenticateUser);

router.get('/notifications', async (req, res, next) => {
  try {
    const list = await NotificationService.getUserNotifications(req.user.id);
    return ApiResponse.success(res, list);
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/read-all', async (req, res, next) => {
  try {
    await NotificationService.markAllAsRead(req.user.id);
    return ApiResponse.success(res, { success: true }, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    const updated = await NotificationService.markAsRead(req.params.id, req.user.id);
    return ApiResponse.success(res, updated);
  } catch (err) {
    next(err);
  }
});

export default router;
