import { z } from 'zod';
import { ROLES } from '../config/constants.js';

const ROLE_ALIASES = {
  customer: ROLES.CUSTOMER,
  partner: ROLES.CINEMA_OWNER,
  CUSTOMER: ROLES.CUSTOMER,
  CINEMA_OWNER: ROLES.CINEMA_OWNER
};

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.preprocess(
    (val) => ROLE_ALIASES[val] || val || ROLES.CUSTOMER,
    z.enum([ROLES.CUSTOMER, ROLES.CINEMA_OWNER])
  ).default(ROLES.CUSTOMER),
  phone: z.string().optional(),
  location: z.string().optional(),
  // Profile extensions
  organizationName: z.string().optional(),
  companyName: z.string().optional(),
  registrationIdentifier: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  preferredCity: z.string().optional(),
  preferredLanguages: z.array(z.string()).optional(),
  preferredGenres: z.array(z.string()).optional()
});
