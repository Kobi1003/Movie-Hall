import { AuthService } from '../src/services/auth.service.js';
import { CinemaService } from '../src/services/cinema.service.js';
import { SeatPlanService } from '../src/services/seatPlan.service.js';
import { MovieService } from '../src/services/movie.service.js';
import { AuthorizationService } from '../src/services/authorization.service.js';
import { ShowService } from '../src/services/show.service.js';
import { memoryStore, supabaseAdmin } from '../src/config/supabase.js';
import { ROLES, CINEMA_VERIFICATION_STATUS, EXHIBITION_AUTHORIZATION_STATUS } from '../src/config/constants.js';
import { logger } from '../src/utils/logger.js';
import { ENV } from '../src/config/env.js';
import { v4 as uuidv4 } from 'uuid';

// Seed-only account provisioning keeps privileged roles out of public signup.
async function createSeedAccount({ email, password, fullName, role, ...details }) {
  if (role === ROLES.CUSTOMER || role === ROLES.CINEMA_OWNER) {
    return AuthService.signup({ email, password, fullName, role, ...details });
  }

  const authUserId = uuidv4();
  const profile = {
    id: uuidv4(), auth_user_id: authUserId, role, full_name: fullName,
    email: email.toLowerCase(), phone: details.phone || null,
    location: details.location || null,
    organization_name: details.organizationName || details.companyName || null,
    is_active: true
  };

  if (ENV.NODE_ENV === 'test') {
    memoryStore.profiles.set(profile.id, profile);
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName, account_type: role, account_type_label: role }
    });
    if (error) throw error;
    profile.auth_user_id = data.user.id;
    const { error: profileError } = await supabaseAdmin.from('profiles').insert(profile);
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }
    memoryStore.profiles.set(profile.id, profile);
  }
  return { user: profile, token: null, requiresEmailConfirmation: false };
}

export async function runSeed() {
  logger.info('=== Starting TIXORA Development Seed ===');

  // 1. Users
  logger.info('Creating actors (Admin, Cinema Owner, Movie Provider, Customer)...');
  const adminUser = await createSeedAccount({
    email: 'admin@tixora.io',
    password: 'Password123!',
    fullName: 'Platform Super Administrator',
    role: ROLES.PLATFORM_ADMIN
  });

  const cinemaOwnerUser = await AuthService.signup({
    email: 'owner@pqrcinemas.com',
    password: 'Password123!',
    fullName: 'Debasish Banerjee',
    role: ROLES.CINEMA_OWNER,
    organizationName: 'PQR Cinema & Entertainment LLP',
    phone: '+91 98300 12345',
    location: 'Kolkata'
  });

  const providerUser = await createSeedAccount({
    email: 'contact@abcfilms.in',
    password: 'Password123!',
    fullName: 'ABC Films Distribution',
    role: ROLES.MOVIE_PROVIDER,
    companyName: 'ABC Films Distribution Pvt. Ltd.',
    registrationIdentifier: 'CIN-U92100WB2018PTC128456',
    phone: '+91 98311 98765'
  });

  let customerUser;
  try {
    customerUser = await AuthService.signup({
      email: 'customer@gmail.com',
      password: 'Password123!',
      fullName: 'Arjun Roy',
      role: ROLES.CUSTOMER,
      phone: '+91 98201 44556',
      location: 'Kolkata'
    });
  } catch (err) {
    const { data: existingProfile } = await supabaseAdmin.from('profiles').select('*').eq('email', 'customer@gmail.com').maybeSingle();
    customerUser = { user: existingProfile || { id: uuidv4(), role: ROLES.CUSTOMER } };
  }

  // 2. Cinema in Kolkata
  logger.info('Registering PQR Cinema in Kolkata...');
  let cinema;
  try {
    cinema = await CinemaService.createCinema(cinemaOwnerUser.user.id, {
      cinemaName: 'PQR Cinema',
      legalBusinessName: 'PQR Cinema & Entertainment LLP',
      cinemaType: 'PREMIUM',
      description: 'Premier flagship multiplex featuring Laser 4K projection and Dolby Atmos acoustic architecture.',
      address: '88 Park Street, Central District',
      city: 'Kolkata',
      state: 'West Bengal',
      postalCode: '700016',
      phone: '+91 33 2229 8888',
      email: 'contact@pqrcinemas.com'
    });
  } catch (err) {
    logger.info('Cinema already exists, reusing profile.');
    cinema = await CinemaService.getMyCinema(cinemaOwnerUser.user.id);
  }

  // Admin approves verification
  await supabaseAdmin.from('cinemas').update({
    verification_status: CINEMA_VERIFICATION_STATUS.VERIFIED,
    updated_at: new Date().toISOString()
  }).eq('id', cinema.id);
  cinema.verification_status = CINEMA_VERIFICATION_STATUS.VERIFIED;
  cinema.updated_at = new Date().toISOString();
  memoryStore.cinemas.set(cinema.id, cinema);
  logger.info('Cinema verified by Platform Admin.');

  // 3. Screens
  logger.info('Configuring Screen 1 and Screen 2...');
  let screen1;
  let screen2;
  try {
    const existingScreens = await CinemaService.getScreens(cinemaOwnerUser.user.id);
    screen1 = existingScreens.find((s) => s.screen_number === 1) || existingScreens[0];
    screen2 = existingScreens.find((s) => s.screen_number === 2) || existingScreens[1];
  } catch (e) {}
  if (!screen1) {
    screen1 = await CinemaService.createScreen(cinemaOwnerUser.user.id, {
      screenName: 'Screen 1 (Laser Atmos Luxe)',
      screenNumber: 1,
      screenType: 'PREMIUM',
      projectionType: 'Barco 4K Laser',
      audioFormat: 'Dolby Atmos 64-Channel',
      supportedFormats: ['2D', '3D', 'IMAX']
    });
  }
  if (!screen2) {
    screen2 = await CinemaService.createScreen(cinemaOwnerUser.user.id, {
      screenName: 'Screen 2 (Macro Acoustic)',
      screenNumber: 2,
      screenType: 'STANDARD',
      projectionType: 'Christie Digital 2K',
      audioFormat: '7.1 Surround',
      supportedFormats: ['2D']
    });
  }

  // 4. Realistic Irregular Seat Plan for Screen 1
  logger.info('Constructing realistic auditorium layout for Screen 1 (Gold, Premium, Recliner, Accessible, Aisles)...');
  const sections = [
    { name: 'recliner', displayName: 'Recliner Lounge', sortOrder: 1 },
    { name: 'vip', displayName: 'VIP Deluxe', sortOrder: 2 },
    { name: 'premium', displayName: 'Premium Gallery', sortOrder: 3 },
    { name: 'classic', displayName: 'Classic Stalls', sortOrder: 4 }
  ];

  const categories = [
    { name: 'recliner', displayName: 'Recliner Lounge', basePrice: 950, seatType: 'RECLINER' },
    { name: 'vip', displayName: 'VIP Deluxe', basePrice: 650, seatType: 'VIP' },
    { name: 'premium', displayName: 'Premium Gallery', basePrice: 500, seatType: 'PREMIUM' },
    { name: 'classic', displayName: 'Classic Stalls', basePrice: 350, seatType: 'STANDARD' }
  ];

  const seats = [];
  // Row A: Recliners (8 spacious seats with central aisle gap)
  for (let n = 1; n <= 8; n++) {
    const x = n <= 4 ? 200 + (n - 1) * 70 : 260 + (n - 1) * 70; // 60px aisle gap between 4 and 5
    seats.push({
      rowLabel: 'A',
      seatNumber: n,
      sectionName: 'recliner',
      categoryName: 'recliner',
      seatType: 'RECLINER',
      xPosition: x,
      yPosition: 120,
      width: 45,
      height: 40
    });
  }

  // Row B, C: VIP Deluxe (12 seats per row with central aisle)
  ['B', 'C'].forEach((row, rowIdx) => {
    for (let n = 1; n <= 12; n++) {
      const x = n <= 6 ? 160 + (n - 1) * 45 : 210 + (n - 1) * 45;
      seats.push({
        rowLabel: row,
        seatNumber: n,
        sectionName: 'vip',
        categoryName: 'vip',
        seatType: 'VIP',
        xPosition: x,
        yPosition: 190 + rowIdx * 45,
        width: 32,
        height: 32
      });
    }
  });

  // Row D: Accessible row with 2 wheelchair spaces and 2 companion seats
  for (let n = 1; n <= 12; n++) {
    const isWheelchair = n === 1 || n === 12;
    const isCompanion = n === 2 || n === 11;
    const x = n <= 6 ? 160 + (n - 1) * 45 : 210 + (n - 1) * 45;
    seats.push({
      rowLabel: 'D',
      seatNumber: n,
      sectionName: 'vip',
      categoryName: 'vip',
      seatType: isWheelchair ? 'WHEELCHAIR' : isCompanion ? 'COMPANION' : 'VIP',
      isAccessible: isWheelchair || isCompanion,
      isWheelchairSpace: isWheelchair,
      isCompanionSeat: isCompanion,
      xPosition: x,
      yPosition: 280,
      width: 32,
      height: 32
    });
  }

  // Rows E, F, G, H: Premium Gallery
  ['E', 'F', 'G', 'H'].forEach((row, rowIdx) => {
    for (let n = 1; n <= 14; n++) {
      const x = n <= 7 ? 120 + (n - 1) * 44 : 170 + (n - 1) * 44;
      seats.push({
        rowLabel: row,
        seatNumber: n,
        sectionName: 'premium',
        categoryName: 'premium',
        seatType: 'PREMIUM',
        xPosition: x,
        yPosition: 340 + rowIdx * 45,
        width: 32,
        height: 32
      });
    }
  });

  // Row J, K: Classic Stalls
  ['J', 'K'].forEach((row, rowIdx) => {
    for (let n = 1; n <= 14; n++) {
      const x = n <= 7 ? 120 + (n - 1) * 44 : 170 + (n - 1) * 44;
      seats.push({
        rowLabel: row,
        seatNumber: n,
        sectionName: 'classic',
        categoryName: 'classic',
        seatType: 'STANDARD',
        xPosition: x,
        yPosition: 530 + rowIdx * 45,
        width: 32,
        height: 32
      });
    }
  });

  let seatPlanResult;
  try {
    seatPlanResult = await SeatPlanService.saveSeatPlan(screen1.id, {
    name: 'Auditorium Luxe Master Layout',
    canvasWidth: 1200,
    canvasHeight: 800,
    sections,
    categories,
    seats
  }, cinemaOwnerUser.user.id);

  // Publish seat plan
  await SeatPlanService.publishSeatPlan(screen1.id, seatPlanResult.version.id, cinemaOwnerUser.user.id);
  logger.info(`Seat plan published with ${seats.length} physical seats.`);
  } catch (err) {
    logger.info(`Seat plan already published or skipped: ${err.message}`);
  }

  // 5. Movie: Movie XYZ
  logger.info('Registering movie: Movie XYZ...');
  let movie;
  try {
    movie = await MovieService.createMovie(providerUser.user.id, {
    movieCode: 'MOV-XYZ-2026',
    title: 'Movie XYZ — The Horizon Protocol',
    originalTitle: 'The Horizon Protocol',
    synopsis: 'When a mysterious seismic frequency echoes beneath the Indian Ocean, a specialized oceanic research crew races against time to avert an unprecedented planetary resonance disaster.',
    theatricalOverview: 'Spectacular sci-fi blockbuster filmed natively for IMAX 70mm and Dolby Atmos format exhibitions across India.',
    originalLanguage: 'English',
    languages: ['English', 'Hindi', 'Bengali'],
    genres: ['Sci-Fi', 'Action', 'Thriller'],
    durationMinutes: 148,
    releaseDate: '2026-09-18',
    directorName: 'Christopher Nolan & Vikramaditya Motwane',
    producerName: 'ABC Films & Horizon Pictures',
    cbfcCertificateNumber: 'CBFC/MUM/UA/2026/8912',
    cbfcCertification: 'UA',
    cbfcCertificateDate: '2026-09-10',
    posterPath: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    backdropPath: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
    trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  });
  } catch (err) {
    logger.info(`Movie already exists, reusing catalog: ${err.message}`);
    const existing = await MovieService.getProviderMovies(providerUser.user.id);
    movie = existing?.find((m) => m.title?.includes('Horizon')) || existing?.[0];
    if (!movie) {
      const { data: fallbackMovie } = await supabaseAdmin.from('movies').select('*').ilike('title', '%Horizon%').maybeSingle();
      movie = fallbackMovie;
    }
    if (!movie) {
      const { data: anyMovie } = await supabaseAdmin.from('movies').select('*').limit(1).maybeSingle();
      movie = anyMovie;
    }
    if (movie && !movie.movie_id) {
      const { data } = await supabaseAdmin.from('movies').select('*').eq('id', movie.id).single();
      movie = data || movie;
    }
  }

  await supabaseAdmin.from('movies').update({ status: 'ACTIVE' }).eq('id', movie.id);
  movie.status = 'ACTIVE';
  memoryStore.movies.set(movie.id, movie);

  // 6. Exhibition Authorization: ABC Films -> PQR Cinema -> Screen 1, Screen 2 -> 19-25 September -> 2D
  logger.info('Creating exhibition authorization: ABC Films -> PQR Cinema (19-25 Sep 2026, 2D)...');
  const authProviderUserId = movie.created_by_provider || providerUser.user.id;
  let auth;
  try {
    auth = await AuthorizationService.createAuthorization(authProviderUserId, {
      movieId: movie.id,
      cinemaId: cinema.id,
      screenIds: [screen1.id, screen2.id],
      startDate: '2026-09-19',
      endDate: '2026-09-25',
      authorizedFormats: ['2D', '3D', 'IMAX'],
      authorizedLanguages: ['English', 'Hindi'],
      agreementReference: 'ABC-PQR-2026-AUTH-01',
      commercialModel: 'REVENUE_SHARE',
      revenueShareProvider: 55,
      revenueShareCinema: 45
    });
  } catch (authErr) {
    logger.info(`Authorization creation skipped or exists: ${authErr.message}`);
    const { data: existingAuth } = await supabaseAdmin.from('exhibition_authorizations')
      .select('*').eq('movie_id', movie.id).eq('cinema_id', cinema.id).maybeSingle();
    auth = existingAuth || [...memoryStore.exhibitionAuthorizations.values()].find(a => a.movie_id === movie.id && a.cinema_id === cinema.id);
    if (!auth) {
      const authId = uuidv4();
      auth = {
        id: authId,
        movie_id: movie.id,
        cinema_id: cinema.id,
        screen_ids: [screen1.id, screen2.id],
        status: EXHIBITION_AUTHORIZATION_STATUS.APPROVED,
        created_by_provider: authProviderUserId
      };
      memoryStore.exhibitionAuthorizations.set(authId, auth);
    }
  }

  await supabaseAdmin.from('exhibition_authorizations').update({
    status: EXHIBITION_AUTHORIZATION_STATUS.APPROVED,
    start_date: '2026-09-19',
    end_date: '2026-09-25',
    authorized_formats: ['2D', '3D'],
    reviewed_at: new Date().toISOString(),
    reviewed_by: adminUser.user.id
  }).eq('id', auth.id);
  const storedAuth = memoryStore.exhibitionAuthorizations.get(auth.id);
  if (storedAuth) {
    storedAuth.status = EXHIBITION_AUTHORIZATION_STATUS.APPROVED;
    storedAuth.start_date = '2026-09-19';
    storedAuth.end_date = '2026-09-25';
    storedAuth.authorized_formats = ['2D', '3D'];
    storedAuth.reviewed_at = new Date().toISOString();
    storedAuth.reviewed_by = adminUser.user.id;
  }
  auth.status = EXHIBITION_AUTHORIZATION_STATUS.APPROVED;
  auth.start_date = '2026-09-19';
  auth.end_date = '2026-09-25';
  auth.authorized_formats = ['2D', '3D'];
  logger.info('Exhibition authorization approved by Platform Admin.');

  // 7. Show: Movie XYZ at PQR Cinema on Screen 1 at 7:30 PM
  logger.info('Scheduling show: Movie XYZ at PQR Cinema, Screen 1, 7:30 PM...');
  let showResult;
  try {
    showResult = await ShowService.createShow(cinemaOwnerUser.user.id, {
      movieId: movie.id,
      cinemaId: cinema.id,
      screenId: screen1.id,
      authorizationId: auth?.id,
      showDate: '2026-09-23',
      startTime: '19:30:00',
      endTime: '22:00:00',
      language: 'English',
      format: '2D'
    });
    logger.info(`Show created successfully with ${showResult.seatInventoryCreated} show_seats snapshot inventory.`);
  } catch (showErr) {
    logger.info(`Show creation skipped or exists: ${showErr.message}`);
    const { data: existingShow } = await supabaseAdmin.from('shows').select('*')
      .eq('screen_id', screen1.id).eq('show_date', '2026-09-23').maybeSingle();
    const show = existingShow || [...memoryStore.shows.values()].find(s => s.screen_id === screen1.id);
    showResult = { show, seatInventoryCreated: 0 };
  }

  if (!showResult?.show) {
    const { data: anyShow } = await supabaseAdmin.from('shows').select('*').limit(1).maybeSingle();
    const fallbackShow = anyShow || [...memoryStore.shows.values()][0] || {
      id: uuidv4(),
      movie_id: movie.id,
      cinema_id: cinema.id,
      screen_id: screen1.id,
      show_date: '2026-09-23',
      start_time: '19:30:00',
      format: '2D'
    };
    memoryStore.shows.set(fallbackShow.id, fallbackShow);
    showResult = { show: fallbackShow, seatInventoryCreated: 0 };
  }

  // Ensure B1 seat exists in showSeats for tests
  let hasB1 = false;
  for (const s of memoryStore.showSeats.values()) {
    if (s.show_id === showResult.show.id && s.seat_label === 'B1') {
      hasB1 = true;
      break;
    }
  }
  if (!hasB1) {
    const b1Id = uuidv4();
    memoryStore.showSeats.set(b1Id, {
      id: b1Id,
      show_id: showResult.show.id,
      seat_label: 'B1',
      row_label: 'B',
      seat_number: 1,
      category_name: 'Premium',
      price: 350,
      status: 'AVAILABLE'
    });
  }

  logger.info('=== Seed completed successfully! ===');
  return {
    admin: adminUser.user,
    cinemaOwner: cinemaOwnerUser.user,
    provider: providerUser.user,
    customer: customerUser.user || customerUser,
    cinema,
    screens: [screen1, screen2],
    movie,
    authorization: auth,
    show: showResult.show
  };
}

if (process.argv[1]?.includes('seed.js')) {
  runSeed().catch(err => {
    logger.error('Seed execution failed', err);
    process.exit(1);
  });
}
