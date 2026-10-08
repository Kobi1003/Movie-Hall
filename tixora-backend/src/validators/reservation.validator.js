import { z } from 'zod';

export const holdSeatsSchema = z.object({
  seatIds: z.array(z.string().min(1)).min(1).max(10)
});

export const joinQueueSchema = z.object({
  idempotencyKey: z.string().optional()
});
