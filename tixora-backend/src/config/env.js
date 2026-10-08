import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  SUPABASE_URL: process.env.SUPABASE_URL || 'https://mock.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || 'mock-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key',

  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key-tixora-change-in-prod',

  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',

  SEAT_HOLD_SECONDS: parseInt(process.env.SEAT_HOLD_SECONDS || '120', 10),
  CUSTOMER_BOOKING_SECONDS: parseInt(process.env.CUSTOMER_BOOKING_SECONDS || '120', 10),
  MAX_SEAT_SELECTION: parseInt(process.env.MAX_SEAT_SELECTION || '10', 10),

  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'mock',
  PAYMENT_API_KEY: process.env.PAYMENT_API_KEY || 'mock_key',
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET || 'mock_webhook_secret',

  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || ''
};

export function validateProductionEnv() {
  if (ENV.NODE_ENV !== 'production') return;
  const required = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
  const missing = required.filter(name => !process.env[name] || process.env[name].startsWith('mock-'));
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}`);
  if (ENV.JWT_SECRET.length < 32 || ENV.JWT_SECRET === 'dev-secret-key-tixora-change-in-prod') {
    throw new Error('JWT_SECRET must be a unique random value of at least 32 characters in production');
  }
  if (!/^https:\/\//.test(ENV.SUPABASE_URL)) throw new Error('SUPABASE_URL must use HTTPS in production');
  if (ENV.CORS_ORIGIN === '*') throw new Error('CORS_ORIGIN must be restricted to the deployed frontend in production');
}
