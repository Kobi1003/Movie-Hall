import { createClient } from '@supabase/supabase-js';
import { ENV } from './env.js';
import { logger } from '../utils/logger.js';

// Server-side Supabase client with elevated Service Role Key (NEVER exposed to frontend)
export const supabaseAdmin = createClient(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Public anon client for public queries / auth token validation
export const supabasePublic = createClient(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_PUBLISHABLE_KEY
);

// In-Memory Data Store fallback for offline / test environments
export class MemoryStore {
  constructor() {
    this.profiles = new Map();
    this.customerProfiles = new Map();
    this.cinemaOwnerProfiles = new Map();
    this.movieProviderProfiles = new Map();
    this.adminProfiles = new Map();
    this.cinemas = new Map();
    this.cinemaVerifications = new Map();
    this.cinemaDocuments = new Map();
    this.screens = new Map();
    this.seatPlans = new Map();
    this.seatPlanVersions = new Map();
    this.seatSections = new Map();
    this.seatCategories = new Map();
    this.seats = new Map();
    this.movies = new Map();
    this.movieDocuments = new Map();
    this.exhibitionAuthorizations = new Map();
    this.exhibitionAuthorizedScreens = new Map();
    this.shows = new Map();
    this.showSeats = new Map();
    this.seatReservations = new Map();
    this.seatQueueRequests = new Map();
    this.bookings = new Map();
    this.bookingSeats = new Map();
    this.payments = new Map();
    this.tickets = new Map();
    this.notifications = new Map();
    this.auditLogs = new Map();
    this.cinemaReviews = new Map();
  }
}

export const memoryStore = new MemoryStore();
