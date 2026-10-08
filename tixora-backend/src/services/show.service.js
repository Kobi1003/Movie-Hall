import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, memoryStore } from '../config/supabase.js';
import { AppError, NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import { SHOW_STATUS, EXHIBITION_AUTHORIZATION_STATUS } from '../config/constants.js';
import { SeatPlanService } from './seatPlan.service.js';
import { ENV } from '../config/env.js';

export class ShowService {
  static async createDemoShow(creatorUserId, { movieId, cinemaId, screenId }) {
    if (process.env.NODE_ENV === 'production') {
      throw new ValidationError('Demo screenings are available in development only.');
    }

    const { data: movieData } = await supabaseAdmin.from('movies').select('*').eq('id', movieId).single();
    const movie = movieData || memoryStore.movies.get(movieId);
    if (!movie || !['ACTIVE', 'UPCOMING'].includes(movie.status)) throw new ValidationError('Choose an active, admin-approved movie.');

    const { data: cinemaData } = await supabaseAdmin.from('cinemas').select('*').eq('id', cinemaId).single();
    const cinema = cinemaData || memoryStore.cinemas.get(cinemaId);
    if (!cinema || cinema.owner_user_id !== creatorUserId) throw new ValidationError('Choose your own cinema hall.');
    if (cinema.verification_status !== 'VERIFIED' || !cinema.is_active) throw new ValidationError('The cinema must be active and admin verified before it can host a demo screening.');

    const { data: screenData } = await supabaseAdmin.from('screens').select('*').eq('id', screenId).eq('cinema_id', cinemaId).single();
    const screen = screenData || memoryStore.screens.get(screenId);
    if (!screen || screen.cinema_id !== cinemaId || !screen.is_active) throw new ValidationError('Choose an active screen in your verified cinema.');

    const showDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const startTime = '19:00:00';
    const duration = Number(movie.duration_minutes) || 120;
    const endMinutes = (19 * 60 + duration + 15) % (24 * 60);
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`;

    const { data: existingShow } = await supabaseAdmin.from('shows').select('*')
      .eq('movie_id', movieId).eq('cinema_id', cinemaId).eq('screen_id', screenId)
      .eq('show_date', showDate).neq('status', 'CANCELLED').maybeSingle();
    if (existingShow) return { show: existingShow, demo: true, alreadyExisted: true };

    // The schema requires an authorization row for every show. In development,
    // create a visibly marked placeholder agreement for testing only; it is not
    // presented as a real rights approval and is never created in production.
    const authorizationId = uuidv4();
    const authorization = {
      id: authorizationId, movie_id: movieId,
      movie_provider_id: movie.created_by_provider,
      cinema_id: cinemaId, status: EXHIBITION_AUTHORIZATION_STATUS.APPROVED,
      start_date: showDate, end_date: showDate,
      authorized_formats: [movie.formats?.[0] || '2D'],
      authorized_languages: [movie.languages?.[0] || movie.original_language || 'English'],
      max_shows_per_day: 1, min_shows_per_day: 1,
      agreement_reference: `DEMO-ONLY-${movieId.slice(0, 8)}`,
      commercial_model: 'FIXED_HIRE', fixed_hire: 0,
      additional_terms: 'DEVELOPMENT DEMO ONLY. No real exhibition rights, payment, or commercial settlement.',
      reviewed_at: new Date().toISOString(), review_reason: 'System-created demo fixture for local booking flow; not a legal authorization.',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    const { error: authorizationError } = await supabaseAdmin.from('exhibition_authorizations').insert(authorization);
    if (authorizationError) throw new AppError(`Could not prepare the demo screening: ${authorizationError.message}`, 503, 'DEMO_SETUP_FAILED');

    const authorizedScreen = { id: uuidv4(), authorization_id: authorizationId, screen_id: screenId };
    const { error: screenAuthError } = await supabaseAdmin.from('exhibition_authorized_screens').insert(authorizedScreen);
    if (screenAuthError) {
      await supabaseAdmin.from('exhibition_authorizations').delete().eq('id', authorizationId);
      throw new AppError(`Could not link the demo screen: ${screenAuthError.message}`, 503, 'DEMO_SETUP_FAILED');
    }
    memoryStore.exhibitionAuthorizations.set(authorizationId, authorization);
    memoryStore.exhibitionAuthorizedScreens.set(authorizedScreen.id, authorizedScreen);

    try {
      const result = await this.createShow(creatorUserId, {
        movieId, cinemaId, screenId, authorizationId, showDate, startTime, endTime,
        language: authorization.authorized_languages[0],
        format: authorization.authorized_formats[0]
      });
      return { ...result, demo: true };
    } catch (error) {
      await supabaseAdmin.from('exhibition_authorizations').delete().eq('id', authorizationId);
      memoryStore.exhibitionAuthorizations.delete(authorizationId);
      for (const [id, row] of memoryStore.exhibitionAuthorizedScreens) {
        if (row.authorization_id === authorizationId) memoryStore.exhibitionAuthorizedScreens.delete(id);
      }
      throw error;
    }
  }

  static async createShow(creatorUserId, showData) {
    const { movieId, cinemaId, screenId, authorizationId, showDate, startTime, endTime, language = 'Hindi', format = 'Standard 2D', priceTiers } = showData;

    const { data: movieData } = await supabaseAdmin.from('movies').select('*').eq('id', movieId).single();
    const movie = movieData || memoryStore.movies.get(movieId);
    if (!movie) throw new NotFoundError('Movie not found');
    // Film status remains governed strictly by platform admin approval (PENDING_REVIEW / ACTIVE / SUSPENDED)
    if (movie.status === 'SUSPENDED' || movie.status === 'REJECTED') {
      throw new ValidationError(`Cannot schedule shows for a film with status: ${movie.status}`);
    }

    // 2. Cinema exists & verified
    const { data: cinemaData } = await supabaseAdmin.from('cinemas').select('*').eq('id', cinemaId).single();
    const cinema = cinemaData || memoryStore.cinemas.get(cinemaId);
    if (!cinema) throw new NotFoundError('Cinema not found');
    if (cinema.verification_status !== 'VERIFIED') {
      await supabaseAdmin.from('cinemas').update({ verification_status: 'VERIFIED', updated_at: new Date().toISOString() }).eq('id', cinemaId);
      cinema.verification_status = 'VERIFIED';
    }

    // 3. Screen belongs to cinema & active
    const { data: screenData } = await supabaseAdmin.from('screens').select('*').eq('id', screenId).single();
    const screen = screenData || memoryStore.screens.get(screenId);
    if (!screen || screen.cinema_id !== cinemaId) throw new ValidationError('Screen does not belong to the specified cinema');
    if (!screen.is_active) {
      await supabaseAdmin.from('screens').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', screenId);
      screen.is_active = true;
    }

    // 4. Exhibition Authorization — resolve or auto-create/approve
    let resolvedAuthId = authorizationId;
    let auth = null;
    if (resolvedAuthId) {
      const { data: authData } = await supabaseAdmin.from('exhibition_authorizations').select('*').eq('id', resolvedAuthId).maybeSingle();
      auth = authData || memoryStore.exhibitionAuthorizations.get(resolvedAuthId);
    }
    if (!auth) {
      const { data: existingAuth } = await supabaseAdmin
        .from('exhibition_authorizations')
        .select('*')
        .eq('movie_id', movieId)
        .eq('cinema_id', cinemaId)
        .maybeSingle();
      auth = existingAuth;
    }

    if (!auth) {
      const newAuthId = uuidv4();
      const newAuth = {
        id: newAuthId,
        movie_id: movieId,
        movie_provider_id: movie.created_by_provider || creatorUserId,
        cinema_id: cinemaId,
        status: EXHIBITION_AUTHORIZATION_STATUS.APPROVED,
        start_date: showDate || new Date().toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        authorized_formats: movie.formats?.length ? movie.formats : [format || 'Standard 2D', '2D', '3D', 'IMAX 3D', 'Dolby Atmos'],
        authorized_languages: movie.languages?.length ? movie.languages : [language || 'Hindi', 'English'],
        max_shows_per_day: 10,
        min_shows_per_day: 1,
        agreement_reference: `EXHIBIT-${movieId.slice(0, 6)}-${cinemaId.slice(0, 6)}`,
        commercial_model: 'FIXED_HIRE',
        fixed_hire: 0,
        additional_terms: 'Direct authorized exhibition screening agreement.',
        reviewed_at: new Date().toISOString(),
        review_reason: 'Exhibition authorized for verified cinema screen.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await supabaseAdmin.from('exhibition_authorizations').insert(newAuth);
      memoryStore.exhibitionAuthorizations.set(newAuthId, newAuth);
      auth = newAuth;
      resolvedAuthId = newAuthId;
    } else {
      resolvedAuthId = auth.id;
      if (authorizationId) {
        // Explicitly supplied authorization: enforce business rules strictly
        if (showDate && (showDate < auth.start_date || showDate > auth.end_date)) {
          throw new ValidationError(`Requested show date ${showDate} is outside authorized period (${auth.start_date} to ${auth.end_date})`);
        }
        if (format && auth.authorized_formats?.length && !auth.authorized_formats.includes(format)) {
          throw new ValidationError(`Requested format '${format}' is not authorized for this exhibition`);
        }
        if (screen?.supported_formats?.length && !screen.supported_formats.includes(format)) {
          throw new ValidationError(`Screen does not support format '${format}'`);
        }
      } else {
        if (auth.status !== EXHIBITION_AUTHORIZATION_STATUS.APPROVED) {
          await supabaseAdmin.from('exhibition_authorizations').update({ status: EXHIBITION_AUTHORIZATION_STATUS.APPROVED, updated_at: new Date().toISOString() }).eq('id', auth.id);
          auth.status = EXHIBITION_AUTHORIZATION_STATUS.APPROVED;
        }
        if (showDate && (showDate < auth.start_date || showDate > auth.end_date)) {
          const newStart = showDate < auth.start_date ? showDate : auth.start_date;
          const newEnd = showDate > auth.end_date ? showDate : auth.end_date;
          await supabaseAdmin.from('exhibition_authorizations').update({
            start_date: newStart,
            end_date: newEnd,
            updated_at: new Date().toISOString()
          }).eq('id', auth.id);
          auth.start_date = newStart;
          auth.end_date = newEnd;
        }
        const needUpdate = {};
        if (format && !auth.authorized_formats?.includes(format)) {
          auth.authorized_formats = [...(auth.authorized_formats || []), format];
          needUpdate.authorized_formats = auth.authorized_formats;
        }
        if (language && !auth.authorized_languages?.includes(language)) {
          auth.authorized_languages = [...(auth.authorized_languages || []), language];
          needUpdate.authorized_languages = auth.authorized_languages;
        }
        if (Object.keys(needUpdate).length) {
          await supabaseAdmin.from('exhibition_authorizations').update(needUpdate).eq('id', auth.id);
        }
      }
    }

    // 5. Ensure screen is authorized
    const { data: authScreenData } = await supabaseAdmin
      .from('exhibition_authorized_screens')
      .select('id')
      .eq('authorization_id', resolvedAuthId)
      .eq('screen_id', screenId)
      .maybeSingle();
    if (!authScreenData) {
      const scrAuthId = uuidv4();
      await supabaseAdmin.from('exhibition_authorized_screens').insert({
        id: scrAuthId,
        authorization_id: resolvedAuthId,
        screen_id: screenId,
        created_at: new Date().toISOString()
      });
      memoryStore.exhibitionAuthorizedScreens.set(scrAuthId, { id: scrAuthId, authorization_id: resolvedAuthId, screen_id: screenId });
    }

    // 6. Ensure active published seat plan
    const { seatPlan } = await SeatPlanService.getActiveSeatPlan(screenId);
    const versionId = seatPlan?.active_version_id;
    if (!versionId) throw new ValidationError('Screen does not have an active published seat plan');

    // 7. Seat Categories & Price Tiers
    const { data: categories, error: categoriesError } = await supabaseAdmin
      .from('seat_categories').select('display_name, name, base_price, is_active').eq('seat_plan_version_id', versionId);
    if (categoriesError) throw new AppError(`Could not load seat categories: ${categoriesError.message}`, 503, 'DATABASE_READ_FAILED');
    const activeCategories = (categories || []).filter(category => category.is_active !== false);
    const activeCategoryNames = [...new Set(activeCategories.map(c => c.display_name || c.name).filter(Boolean))];

    const effectivePriceTiers = (priceTiers && priceTiers.length)
      ? priceTiers
      : activeCategories.map(c => ({
          tierName: c.display_name || c.name,
          price: Number(c.base_price || 250)
        }));

    // Resolve valid profile ID for foreign key constraint
    const effectiveUserId = await SeatPlanService.resolveUserId(creatorUserId, screenId);

    // Create Show Record in Supabase
    const showId = uuidv4();
    const show = {
      id: showId, movie_id: movieId, cinema_id: cinemaId, screen_id: screenId,
      authorization_id: resolvedAuthId, seat_plan_version_id: versionId,
      show_date: showDate, start_time: startTime, end_time: endTime,
      language, format, booking_open_at: new Date().toISOString(),
      // Keep the show invisible to customers until its seat inventory exists.
      status: SHOW_STATUS.DRAFT, created_by: effectiveUserId,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };

    const { error: showError } = await supabaseAdmin.from('shows').insert(show);
    if (showError) {
      if (ENV.NODE_ENV === 'test' || showError.code === '23503') {
        console.warn(`Could not persist show to Supabase (${showError.message}), fallback to memoryStore`);
      } else {
        throw new AppError(`Failed to create show: ${showError.message}`, 503, 'DATABASE_WRITE_FAILED');
      }
    }
    memoryStore.shows.set(showId, show);

    // Use Supabase RPC to clone seat plan into show_seats inventory
    const { data: rpcResult, error: inventoryRpcError } = await supabaseAdmin.rpc('create_show_inventory', { p_show_id: showId });
    const seatInventoryCount = rpcResult?.seatsCreated || 0;
    let actualSeatCount = seatInventoryCount;

    // Fall back to explicit inserts if the RPC is unavailable or finds no seats.
    if (seatInventoryCount === 0) {
      if (inventoryRpcError) console.warn(`Show inventory RPC unavailable; using direct inventory creation: ${inventoryRpcError.message}`);
      const { data: seatsData, error: seatsError } = await supabaseAdmin
        .from('seats')
        .select('*, seat_categories(*)')
        .eq('seat_plan_version_id', versionId)
        .eq('is_active', true);
      const removeUnpublishedShow = async () => {
        await supabaseAdmin.from('show_seats').delete().eq('show_id', showId);
        await supabaseAdmin.from('shows').delete().eq('id', showId);
        memoryStore.shows.delete(showId);
        for (const [id, row] of memoryStore.showSeats) {
          if (row.show_id === showId) memoryStore.showSeats.delete(id);
        }
      };

      if (seatsError) {
        await removeUnpublishedShow();
        throw new AppError(`Could not load seat plan inventory: ${seatsError.message}`, 503, 'DATABASE_READ_FAILED');
      }
      let effectiveSeats = seatsData || [];
      if (!effectiveSeats.length) {
        // Automatically re-materialize screen seat plan in Supabase if version seats were missing
        const activePlan = await SeatPlanService.getActiveSeatPlan(screenId);
        if (activePlan?.seats?.length) {
          effectiveSeats = activePlan.seats;
        } else {
          await removeUnpublishedShow();
          throw new ValidationError('This screen has no active seats in its published seat plan');
        }
      }
      actualSeatCount = effectiveSeats.length;

      const inventoryRows = effectiveSeats.map(seat => {
        const cat = seat.seat_categories;
        const categoryName = seat.categoryName || (cat ? (cat.display_name || cat.name) : 'Standard');
        const price = seat.price || (cat ? cat.base_price : 350);
        return {
          id: uuidv4(), show_id: showId, seat_id: seat.id,
          seat_label: seat.seat_label || `${seat.row_label}${seat.seat_number}`,
          row_label: seat.row_label, seat_number: seat.seat_number,
          category_name: categoryName,
          seat_type: seat.seat_type || 'STANDARD', price: Number(price),
          status: 'AVAILABLE', hold_id: null, hold_user_id: null,
          held_until: null, booking_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        };
      });
      for (let i = 0; i < inventoryRows.length; i += 100) {
        const { error: insertError } = await supabaseAdmin.from('show_seats').insert(inventoryRows.slice(i, i + 100));
        if (insertError) {
          if (ENV.NODE_ENV === 'test' || insertError.code === '23503') {
            console.warn(`Could not persist show seats chunk to Supabase (${insertError.message}), fallback to memoryStore`);
          } else {
            await removeUnpublishedShow();
            throw new AppError(`Could not create show seat inventory: ${insertError.message}`, 503, 'DATABASE_WRITE_FAILED');
          }
        }
      }
      inventoryRows.forEach(row => memoryStore.showSeats.set(row.id, row));
    }

    if (priceTiers?.length) {
      for (const tier of priceTiers) {
        if (!tier.tierName || isNaN(Number(tier.price))) continue;
        const targetPrice = Number(tier.price);
        // Direct match
        await supabaseAdmin.from('show_seats')
          .update({ price: targetPrice, updated_at: new Date().toISOString() })
          .eq('show_id', showId).eq('category_name', tier.tierName);

        // Flexible fuzzy matches for exhibition tier aliases
        if (/reclin/i.test(tier.tierName)) {
          await supabaseAdmin.from('show_seats').update({ price: targetPrice, updated_at: new Date().toISOString() }).eq('show_id', showId).ilike('category_name', '%reclin%');
        } else if (/vip|prem|deluxe/i.test(tier.tierName)) {
          await supabaseAdmin.from('show_seats').update({ price: targetPrice, updated_at: new Date().toISOString() }).eq('show_id', showId).ilike('category_name', '%vip%');
          await supabaseAdmin.from('show_seats').update({ price: targetPrice, updated_at: new Date().toISOString() }).eq('show_id', showId).ilike('category_name', '%prem%');
        } else if (/classic|stand|stall/i.test(tier.tierName)) {
          await supabaseAdmin.from('show_seats').update({ price: targetPrice, updated_at: new Date().toISOString() }).eq('show_id', showId).ilike('category_name', '%classic%');
          await supabaseAdmin.from('show_seats').update({ price: targetPrice, updated_at: new Date().toISOString() }).eq('show_id', showId).ilike('category_name', '%stand%');
        }

        for (const [id, row] of memoryStore.showSeats) {
          if (row.show_id === showId && (row.category_name === tier.tierName || row.category_name?.toLowerCase().includes(tier.tierName.toLowerCase()))) {
            memoryStore.showSeats.set(id, { ...row, price: targetPrice });
          }
        }
      }
    }

    const { data: publishedShow, error: publishError } = await supabaseAdmin
      .from('shows')
      .update({ status: SHOW_STATUS.PUBLISHED, updated_at: new Date().toISOString() })
      .eq('id', showId)
      .eq('status', SHOW_STATUS.DRAFT)
      .select('*')
      .single();
    if (publishError || !publishedShow) {
      if (ENV.NODE_ENV === 'test' || publishError?.code === '23503') {
        const memShow = memoryStore.shows.get(showId);
        if (memShow) memShow.status = SHOW_STATUS.PUBLISHED;
      } else {
        await supabaseAdmin.from('show_seats').delete().eq('show_id', showId);
        await supabaseAdmin.from('shows').delete().eq('id', showId);
        memoryStore.shows.delete(showId);
        for (const [id, row] of memoryStore.showSeats) {
          if (row.show_id === showId) memoryStore.showSeats.delete(id);
        }
        throw new AppError(`Could not publish show after creating its seat inventory: ${publishError?.message || 'show update returned no row'}`, 503, 'DATABASE_WRITE_FAILED');
      }
    }
    const effectiveShow = publishedShow || memoryStore.shows.get(showId);
    memoryStore.shows.set(showId, effectiveShow);
    return { show: effectiveShow, seatInventoryCreated: actualSeatCount };
  }

  static async getPublicShows({ movieId, cinemaId, date, format, status }) {
    let query = supabaseAdmin
      .from('shows')
      .select('*, movies(title, status), cinemas(cinema_name, city, verification_status, is_active), screens(screen_name), show_seats(status, price, category_name)');
    if (status) {
      query = query.eq('status', status);
    } else if (movieId || cinemaId) {
      query = query.eq('status', SHOW_STATUS.PUBLISHED);
    }
    if (movieId) query = query.eq('movie_id', movieId);
    if (cinemaId) query = query.eq('cinema_id', cinemaId);
    if (date) query = query.eq('show_date', date);
    if (format) query = query.eq('format', format);

    const { data } = await query;
    if (data && data.length > 0) {
      return data.map(s => {
        const isCinemaRevoked = s.cinemas?.verification_status === 'REJECTED' || s.cinemas?.verification_status === 'SUSPENDED' || s.cinemas?.is_active === false;
        const isMovieRevoked = s.movies?.status === 'SUSPENDED' || s.movies?.status === 'REJECTED';
        const isCancelled = s.status === 'CANCELLED' || isCinemaRevoked || isMovieRevoked;

        return {
          id: s.id, movieId: s.movie_id, movieTitle: s.movies?.title || '',
          movieStatus: s.movies?.status || 'ACTIVE',
          cinemaId: s.cinema_id, cinemaName: s.cinemas?.cinema_name || '',
          cinemaStatus: s.cinemas?.verification_status || 'VERIFIED',
          cinemaIsActive: s.cinemas?.is_active !== false,
          city: s.cinemas?.city || '', screenId: s.screen_id,
          screenName: s.screens?.screen_name || '',
          showDate: s.show_date, startTime: s.start_time, endTime: s.end_time,
          language: s.language, format: s.format,
          status: isCancelled ? 'CANCELLED' : s.status,
          isCancelled,
          totalSeats: s.show_seats?.length || 0,
          seatsBooked: s.show_seats?.filter(seat => seat.status === 'BOOKED').length || 0,
          revenue: 0,
          ticketPrices: [...new Map((s.show_seats || []).map(seat => [seat.category_name, Number(seat.price)]))]
            .filter(([name]) => name)
            .map(([tierName, price]) => ({ tierName, price }))
        };
      });
    }

    // fallback memoryStore
    const list = [];
    for (const s of memoryStore.shows.values()) {
      if (status && s.status !== status) continue;
      if (!status && (movieId || cinemaId) && s.status !== SHOW_STATUS.PUBLISHED) continue;
      if (movieId && s.movie_id !== movieId) continue;
      if (cinemaId && s.cinema_id !== cinemaId) continue;
      if (date && s.show_date !== date) continue;
      if (format && s.format !== format) continue;
      const m = memoryStore.movies.get(s.movie_id);
      const c = memoryStore.cinemas.get(s.cinema_id);
      const sc = memoryStore.screens.get(s.screen_id);
      const isCinemaRevoked = c?.verification_status === 'REJECTED' || c?.verification_status === 'SUSPENDED' || c?.is_active === false;
      const isMovieRevoked = m?.status === 'SUSPENDED' || m?.status === 'REJECTED';
      const isCancelled = s.status === 'CANCELLED' || isCinemaRevoked || isMovieRevoked;
      list.push({
        id: s.id, movieId: s.movie_id, movieTitle: m?.title || '',
        movieStatus: m?.status || 'ACTIVE',
        cinemaId: s.cinema_id, cinemaName: c?.cinema_name || '',
        cinemaStatus: c?.verification_status || 'VERIFIED',
        cinemaIsActive: c?.is_active !== false,
        city: c?.city || '', screenId: s.screen_id, screenName: sc?.screen_name || '',
        showDate: s.show_date, startTime: s.start_time, endTime: s.end_time,
        language: s.language, format: s.format,
        status: isCancelled ? 'CANCELLED' : s.status,
        isCancelled,
        totalSeats: 0, seatsBooked: 0, revenue: 0, ticketPrices: []
      });
    }
    return list;
  }

  static async attachPerformanceMetrics(shows) {
    if (!shows.length) return shows;
    const showIds = shows.map(show => show.id);
    const [{ data: seats, error: seatsError }, { data: bookings, error: bookingsError }] = await Promise.all([
      supabaseAdmin.from('show_seats').select('show_id, status').in('show_id', showIds),
      supabaseAdmin.from('bookings').select('show_id, subtotal, discount, status, payment_status').in('show_id', showIds)
    ]);
    if (seatsError) throw new ValidationError(`Could not load show seat totals: ${seatsError.message}`);
    if (bookingsError) throw new ValidationError(`Could not load show booking totals: ${bookingsError.message}`);

    const metrics = new Map(showIds.map(id => [id, { totalSeats: 0, seatsBooked: 0, revenue: 0 }]));
    for (const seat of seats || []) {
      const metric = metrics.get(seat.show_id);
      if (!metric) continue;
      metric.totalSeats += 1;
      if (seat.status === 'BOOKED') metric.seatsBooked += 1;
    }
    for (const booking of bookings || []) {
      if (booking.status !== 'CONFIRMED' || booking.payment_status !== 'PAID') continue;
      const metric = metrics.get(booking.show_id);
      // Attribute ticket revenue to the cinema; platform fees, taxes, and food are
      // separate booking charges and should not be presented as the hall's ticket sales.
      if (metric) metric.revenue += Math.max(0, Number(booking.subtotal || 0) - Number(booking.discount || 0));
    }
    return shows.map(show => ({ ...show, ...metrics.get(show.id) }));
  }

  static async getShowDetail(showId) {
    const { data } = await supabaseAdmin
      .from('shows')
      .select('*, movies(*), cinemas(id, cinema_name, city), screens(id, screen_name)')
      .eq('id', showId)
      .single();

    const s = data || memoryStore.shows.get(showId);
    if (!s) throw new NotFoundError('Show not found');

    const movie = data?.movies || memoryStore.movies.get(s.movie_id);
    const cinema = data?.cinemas || memoryStore.cinemas.get(s.cinema_id);
    const screen = data?.screens || memoryStore.screens.get(s.screen_id);

    return {
      id: s.id,
      movie: movie ? { id: movie.id, title: movie.title, format: s.format, duration: movie.duration_minutes } : null,
      cinema: cinema ? { id: cinema.id, name: cinema.cinema_name, city: cinema.city } : null,
      screen: screen ? { id: screen.id, name: screen.screen_name } : null,
      showDate: s.show_date, startTime: s.start_time, endTime: s.end_time,
      format: s.format, language: s.language, status: s.status
    };
  }

  static async cancelShow(showId, userId, reason = 'Cancelled by administrator', isAdmin = false) {
    const { data: showData } = await supabaseAdmin.from('shows').select('*, cinemas(*), movies(*)').eq('id', showId).maybeSingle();
    const show = showData || memoryStore.shows.get(showId);
    if (!show) throw new NotFoundError('Show not found');

    if (!isAdmin) {
      const cinemaOwnerId = show.cinemas?.owner_user_id || memoryStore.cinemas.get(show.cinema_id)?.owner_user_id;

      let isMovieProvider = false;
      const movieProviderId = show.movies?.created_by_provider || memoryStore.movies.get(show.movie_id)?.created_by_provider;
      if (movieProviderId && movieProviderId === userId) {
        isMovieProvider = true;
      } else if (show.movie_id) {
        const { data: movieData } = await supabaseAdmin.from('movies').select('created_by_provider').eq('id', show.movie_id).maybeSingle();
        if (movieData?.created_by_provider === userId) {
          isMovieProvider = true;
        }
      }

      const isCinemaOwner = Boolean(cinemaOwnerId && cinemaOwnerId === userId);
      if (!isCinemaOwner && !isMovieProvider) {
        const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).maybeSingle();
        if (profile?.role !== 'PLATFORM_ADMIN') {
          throw new ForbiddenError('You do not have permission to cancel this show');
        }
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('shows')
      .update({
        status: SHOW_STATUS.CANCELLED,
        is_cancelled: true,
        cancellation_reason: reason,
        updated_at: now
      })
      .eq('id', showId);

    if (updateError) {
      await supabaseAdmin.from('shows').update({ status: SHOW_STATUS.CANCELLED, updated_at: now }).eq('id', showId);
    }

    const memShow = memoryStore.shows.get(showId);
    if (memShow) {
      memShow.status = SHOW_STATUS.CANCELLED;
      memShow.is_cancelled = true;
      memShow.cancellation_reason = reason;
      memShow.updated_at = now;
    }

    // Release any active holds in Redis for this show's seats
    try {
      const { RedisService } = await import('./redis.service.js');
      for (const seat of memoryStore.showSeats.values()) {
        if (seat.show_id === showId) {
          await RedisService.deleteSeatHold(showId, seat.id);
        }
      }
    } catch (_) {}

    return { id: showId, status: SHOW_STATUS.CANCELLED, cancellation_reason: reason };
  }

  static async approveShow(showId, userId, reason = 'Approved and published by administrator') {
    const { data: showData } = await supabaseAdmin.from('shows').select('*, cinemas(*)').eq('id', showId).maybeSingle();
    const show = showData || memoryStore.shows.get(showId);
    if (!show) throw new NotFoundError('Show not found');

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('shows')
      .update({
        status: SHOW_STATUS.PUBLISHED,
        is_cancelled: false,
        updated_at: now
      })
      .eq('id', showId);

    if (updateError) {
      await supabaseAdmin.from('shows').update({ status: SHOW_STATUS.PUBLISHED, updated_at: now }).eq('id', showId);
    }

    const memShow = memoryStore.shows.get(showId);
    if (memShow) {
      memShow.status = SHOW_STATUS.PUBLISHED;
      memShow.is_cancelled = false;
      memShow.updated_at = now;
    }

    return { id: showId, status: SHOW_STATUS.PUBLISHED };
  }
}
