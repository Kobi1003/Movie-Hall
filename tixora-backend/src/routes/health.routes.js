import { Router } from 'express';
import { isRedisLive } from '../config/redis.js';
import { isRabbitLive } from '../config/rabbitmq.js';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiResponse } from '../utils/apiResponse.js';

const router = Router();

async function checkDatabase() {
  const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
  if (error) throw error;
}

router.get('/health', async (req, res) => {
  let database = 'healthy';
  try {
    await checkDatabase();
  } catch (error) {
    database = 'unavailable';
  }

  return ApiResponse.success(res, {
    status: database === 'healthy' ? 'healthy' : 'degraded',
    service: 'tixora-backend',
    timestamp: new Date().toISOString(),
    services: {
      database,
      redis: isRedisLive() ? 'healthy' : 'mock/standalone',
      rabbitmq: isRabbitLive() ? 'healthy' : 'mock/standalone'
    }
  });
});

router.get('/health/database', async (req, res) => {
  try {
    await checkDatabase();
    return ApiResponse.success(res, { status: 'healthy' });
  } catch (error) {
    return ApiResponse.error(res, 'Supabase database is unavailable', 503, 'DATABASE_UNAVAILABLE');
  }
});

router.get('/health/redis', (req, res) => {
  return ApiResponse.success(res, {
    status: isRedisLive() ? 'healthy' : 'mock_fallback'
  });
});

router.get('/health/rabbitmq', (req, res) => {
  return ApiResponse.success(res, {
    status: isRabbitLive() ? 'healthy' : 'mock_fallback'
  });
});

export default router;
