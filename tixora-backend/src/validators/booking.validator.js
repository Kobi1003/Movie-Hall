import { z } from 'zod';

export const createBookingSchema = z.object({
  showId: z.string().min(1),
  holdId: z.string().min(1),
  seatIds: z.array(z.string().min(1)).min(1),
  foodItems: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    qty: z.number().int().positive(),
    price: z.number().nonnegative()
  })).optional().default([]),
  promoCode: z.string().nullable().optional(),
  customerDetails: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    age: z.union([z.number().int().min(1).max(120), z.string()]).optional(),
    email: z.string().optional(),
    phone: z.string().optional()
  }).optional(),
  attendees: z.array(z.object({
    seatId: z.string().optional(),
    seatLabel: z.string().optional(),
    name: z.string().min(1).optional(),
    age: z.union([z.number().int().min(1).max(120), z.string()]).optional()
  })).optional().default([])
});

export const createPaymentSchema = z.object({
  bookingId: z.string().min(1),
  paymentMethod: z.preprocess(
    (val) => (typeof val === 'string' ? val.toLowerCase() : val),
    z.enum(['simulated', 'upi', 'card', 'netbanking', 'wallet'])
  ).default('simulated'),
  amount: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  upiId: z.string().optional(),
  upiApp: z.string().optional(),
  cardNumber: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvv: z.string().optional(),
  cardHolderName: z.string().optional(),
  bankName: z.string().optional(),
  walletProvider: z.string().optional()
});

export const confirmPaymentSchema = z.object({
  paymentId: z.string().min(1),
  providerPaymentId: z.string().optional(),
  signature: z.string().optional()
});
