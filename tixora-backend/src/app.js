import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ENV } from './config/env.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ApiResponse } from './utils/apiResponse.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import cinemaRoutes from './routes/cinema.routes.js';
import movieRoutes from './routes/movie.routes.js';
import providerRoutes from './routes/provider.routes.js';
import showRoutes from './routes/show.routes.js';
import reservationRoutes from './routes/reservation.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import adminRoutes from './routes/admin.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import healthRoutes from './routes/health.routes.js';

import path from 'path';

const app = express();

// Security & baseline middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: ENV.CORS_ORIGIN === '*' ? true : ENV.CORS_ORIGIN.split(','),
  credentials: true
}));
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (ENV.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Global rate limiting
app.use(globalLimiter);

// Root health check
app.use(healthRoutes);

// Webhooks
app.use('/webhooks', webhookRoutes);

// API v1 prefix routes
const apiRouter = express.Router();

apiRouter.use(healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use(cinemaRoutes);
apiRouter.use(movieRoutes);
apiRouter.use('/provider', providerRoutes);
apiRouter.use(showRoutes);
apiRouter.use(reservationRoutes);
apiRouter.use(bookingRoutes);
apiRouter.use(paymentRoutes);
apiRouter.use(notificationRoutes);
apiRouter.use('/admin', adminRoutes);

app.use(ENV.API_PREFIX, apiRouter);

// 404 handler
app.use((req, res) => {
  return ApiResponse.error(res, `Cannot ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND');
});

// Centralized error handler
app.use(errorHandler);

export default app;
