import { z } from 'zod';

const authorizationSchema = z.object({
  movieId: z.string().uuid(),
  cinemaId: z.string().uuid(),
  screenIds: z.array(z.string().uuid()).min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected'),
  authorizedFormats: z.array(z.string()).min(1),
  authorizedLanguages: z.array(z.string()).min(1),
  maxShowsPerDay: z.number().int().positive().optional(),
  minShowsPerDay: z.number().int().positive().optional(),
  earliestShowTime: z.string().optional(),
  latestShowTime: z.string().optional(),
  agreementReference: z.string().optional(),
  commercialModel: z.enum(['REVENUE_SHARE', 'FIXED_HIRE', 'MINIMUM_GUARANTEE', 'HYBRID']).default('REVENUE_SHARE'),
  revenueShareProvider: z.number().min(0).max(100).optional(),
  revenueShareCinema: z.number().min(0).max(100).optional(),
  fixedHire: z.number().min(0).optional(),
  minimumGuarantee: z.number().min(0).optional(),
  additionalTerms: z.string().optional()
});

export const createAuthorizationSchema = authorizationSchema.superRefine((value, context) => {
  if (value.commercialModel === 'REVENUE_SHARE') {
    if (value.revenueShareProvider === undefined || value.revenueShareCinema === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['revenueShareProvider'], message: 'Enter both revenue shares for the agreement.' });
    } else if (value.revenueShareProvider + value.revenueShareCinema !== 100) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['revenueShareCinema'], message: 'Revenue shares must total 100%.' });
    }
  }
});

export const updateAuthorizationSchema = authorizationSchema.partial();
