import { z } from 'zod';

export const seatItemSchema = z.object({
  id: z.string().optional(),
  rowLabel: z.string().min(1).max(5),
  seatNumber: z.number().int().positive(),
  categoryName: z.string().min(1),
  seatType: z.enum(['STANDARD', 'PREMIUM', 'RECLINER', 'COUPLE', 'VIP', 'WHEELCHAIR', 'COMPANION', 'ACCESSIBLE']).default('STANDARD'),
  xPosition: z.number(),
  yPosition: z.number(),
  rotation: z.number().default(0),
  width: z.number().default(32),
  height: z.number().default(32),
  isAccessible: z.boolean().default(false),
  isWheelchairSpace: z.boolean().default(false),
  isCompanionSeat: z.boolean().default(false)
});

export const seatCategorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  displayName: z.string().min(1),
  basePrice: z.number().nonnegative(),
  seatType: z.enum(['STANDARD', 'PREMIUM', 'RECLINER', 'COUPLE', 'VIP', 'WHEELCHAIR', 'COMPANION', 'ACCESSIBLE']).default('STANDARD')
});

export const seatSectionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  displayName: z.string().min(1),
  sortOrder: z.number().default(0)
});

export const saveSeatPlanSchema = z.object({
  name: z.string().default('Main Layout'),
  canvasWidth: z.number().default(1200),
  canvasHeight: z.number().default(800),
  screenPosition: z.string().default('TOP'),
  entrancePosition: z.string().default('BOTTOM'),
  sections: z.array(seatSectionSchema).min(1),
  categories: z.array(seatCategorySchema).min(1),
  seats: z.array(seatItemSchema).min(1)
});
