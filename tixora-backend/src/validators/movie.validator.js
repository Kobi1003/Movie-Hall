import { z } from 'zod';

export const createMovieSchema = z.object({
  movieCode: z.string().min(2).optional(),
  title: z.string().min(1),
  originalTitle: z.string().optional(),
  synopsis: z.string().optional(),
  theatricalOverview: z.string().optional(),
  originalLanguage: z.string().optional(),
  languages: z.array(z.string()).optional(),
  language: z.string().optional(),
  genres: z.array(z.string()).optional(),
  durationMinutes: z.number().int().positive().optional(),
  duration: z.union([z.string(), z.number()]).optional(),
  releaseDate: z.string().optional(),
  directorName: z.string().optional(),
  director: z.string().optional(),
  producerName: z.string().optional(),
  producer: z.string().optional(),
  productionCompany: z.string().optional(),
  distributorName: z.string().optional(),
  distributor: z.string().optional(),
  cbfcCertificateNumber: z.string().optional(),
  cbfcNumber: z.string().optional(),
  cbfcCertification: z.string().optional(),
  certification: z.string().optional(),
  cbfcCertificateDate: z.string().optional(),
  posterPath: z.string().optional(),
  posterUrl: z.string().optional(),
  backdropPath: z.string().optional(),
  trailerUrl: z.string().optional(),
  defaultStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  formats: z.array(z.string()).optional()
}).passthrough();

export const updateMovieSchema = createMovieSchema.partial();
