import { ROLES } from '../config/constants.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Forbidden: Action requires one of [${allowedRoles.join(', ')}], current role is '${req.user.role || 'NONE'}'`
        )
      );
    }

    next();
  };
}

export const requireCustomer = () => requireRole(ROLES.CUSTOMER);
export const requireCinemaOwner = () => requireRole(ROLES.CINEMA_OWNER, ROLES.MOVIE_PROVIDER, ROLES.PLATFORM_ADMIN);
export const requireMovieProvider = () => requireRole(ROLES.MOVIE_PROVIDER, ROLES.CINEMA_OWNER, ROLES.PLATFORM_ADMIN);
export const requireExhibitor = () => requireRole(ROLES.CINEMA_OWNER, ROLES.MOVIE_PROVIDER, ROLES.PLATFORM_ADMIN);
export const requireAdmin = () => requireRole(ROLES.PLATFORM_ADMIN);
// Cinema manager: CINEMA_OWNER, MOVIE_PROVIDER, and PLATFORM_ADMIN
export const requireCinemaManager = () => requireRole(ROLES.CINEMA_OWNER, ROLES.MOVIE_PROVIDER, ROLES.PLATFORM_ADMIN);

