import { z } from 'zod';

export const createCinemaSchema = z.object({
  cinemaName: z.string().min(2),
  legalBusinessName: z.string().min(2),
  cinemaType: z.enum(['MULTIPLEX', 'SINGLE_SCREEN', 'PREMIUM', 'IMAX', '4DX', 'DRIVE_IN', 'OTHER']).default('MULTIPLEX'),
  description: z.string().optional(),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().min(4),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  phone: z.string().min(6),
  email: z.string().email(),
  website: z.string().url().optional()
});

export const updateCinemaSchema = createCinemaSchema.partial();

export const createScreenSchema = z.object({
  screenName: z.string().min(2),
  screenNumber: z.number().int().positive(),
  screenType: z.string().default('STANDARD'),
  capacity: z.number().int().nonnegative().default(0),
  projectionType: z.string().default('Laser 4K'),
  audioFormat: z.string().default('Dolby Atmos'),
  supportedFormats: z.array(z.string()).default(['2D', '3D']),
  isActive: z.boolean().optional()
});

export const updateScreenSchema = createScreenSchema.partial();
