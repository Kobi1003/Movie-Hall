import { z } from 'zod';

export const createShowSchema = z.object({
  movieId: z.string().uuid(),
  cinemaId: z.string().uuid(),
  screenId: z.string().uuid(),
  authorizationId: z.string().uuid().optional(),
  seatPlanVersionId: z.string().uuid().optional(),
  showDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected'),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'HH:MM or HH:MM:SS expected'),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'HH:MM or HH:MM:SS expected'),
  language: z.string().min(2),
  format: z.string().min(2),
  priceTiers: z.array(z.object({
    tierName: z.string().trim().min(1).max(80),
    price: z.coerce.number().finite().min(0).max(100000)
  })).min(1).max(10).optional()
});

export const createDemoShowSchema = z.object({
  movieId: z.string().uuid(),
  cinemaId: z.string().uuid(),
  screenId: z.string().uuid()
});

export const updateShowSchema = createShowSchema.partial();
