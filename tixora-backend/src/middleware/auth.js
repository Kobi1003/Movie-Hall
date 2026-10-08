import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { supabaseAdmin, memoryStore } from '../config/supabase.js';
import { AppError, UnauthorizedError } from '../utils/errors.js';

export async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token missing or invalid format');
    }

    const token = authHeader.split(' ')[1];

    // 1. Try Supabase Auth Token verification
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (user && !error) {
        // Look up profile in Supabase DB or memory store
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('auth_user_id', user.id)
          .single();

        if (profile) {
          if (!profile.is_active) throw new UnauthorizedError('This account is disabled');
          req.user = profile;
          req.authUserId = user.id;
          return next();
        }
      }
    } catch (e) {
      // Fall through to JWT verification
    }

    // 2. Verify application JWTs issued after Supabase authentication.
    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET);
      if (decoded && decoded.id) {
        let profile;
        if (ENV.NODE_ENV === 'test') {
          profile = memoryStore.profiles.get(decoded.id);
        } else {
          const { data, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', decoded.id)
            .single();
          if (profileError) throw new AppError('Could not verify account status', 503, 'DATABASE_UNAVAILABLE');
          profile = data;
        }

        if (!profile) throw new UnauthorizedError('User profile not found');
        if (!profile.is_active) throw new UnauthorizedError('This account is disabled');
        memoryStore.profiles.set(profile.id, profile);
        req.user = profile;
        req.authUserId = decoded.auth_user_id || decoded.id;
        return next();
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    throw new UnauthorizedError('User profile not found');
  } catch (err) {
    next(err);
  }
}

// Optional authentication: sets req.user if token provided, but doesn't block if missing
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  return authenticateUser(req, res, (err) => {
    // Silently ignore auth failure on optional routes
    next();
  });
}
