import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, memoryStore } from '../config/supabase.js';
import { AppError, NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';
import { GeoService } from './geo.service.js';

function parseDurationMinutes(movieData) {
  if (Number.isFinite(movieData.durationMinutes)) return movieData.durationMinutes;
  const raw = movieData.duration;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const text = String(raw || '');
  const hours = text.match(/(\d+)\s*h/i);
  const mins = text.match(/(\d+)\s*m/i);
  if (hours || mins) return (hours ? parseInt(hours[1], 10) * 60 : 0) + (mins ? parseInt(mins[1], 10) : 0);
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

function mapCertification(value) {
  return String(value || 'UA').trim() || 'UA';
}

function slugCode(title) {
  return String(title || 'MOVIE')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) + '-' + Date.now().toString().slice(-4);
}

export class MovieService {
  static normalizePayload(movieData) {
    const languages = Array.isArray(movieData.languages) && movieData.languages.length
      ? movieData.languages
      : String(movieData.language || movieData.originalLanguage || 'English')
          .split(/[•,]/)
          .map((s) => s.trim())
          .filter(Boolean);
    const genres = Array.isArray(movieData.genres) && movieData.genres.length
      ? movieData.genres
      : ['Drama'];
    const releaseDate = (movieData.releaseDate || '').match(/^\d{4}-\d{2}-\d{2}$/)
      ? movieData.releaseDate
      : new Date().toISOString().slice(0, 10);
    const synopsis = movieData.synopsis || movieData.theatricalOverview || `${movieData.title} theatrical exhibition title.`;
    return {
      movieCode: movieData.movieCode || slugCode(movieData.title),
      title: movieData.title,
      originalTitle: movieData.originalTitle || movieData.title,
      synopsis,
      theatricalOverview: movieData.theatricalOverview || synopsis,
      originalLanguage: movieData.originalLanguage || languages[0] || 'English',
      languages,
      genres,
      durationMinutes: parseDurationMinutes(movieData),
      releaseDate,
      directorName: movieData.directorName || movieData.director || 'TBA',
      producerName: movieData.producerName || movieData.producer || 'TBA',
      productionCompany: movieData.productionCompany || null,
      distributorName: movieData.distributorName || movieData.distributor || null,
      cbfcCertificateNumber: movieData.cbfcCertificateNumber || movieData.cbfcNumber || null,
      cbfcCertification: mapCertification(movieData.cbfcCertification || movieData.certification),
      cbfcCertificateDate: movieData.cbfcCertificateDate || null,
      posterPath: movieData.posterPath || movieData.posterUrl || null,
      backdropPath: movieData.backdropPath || null,
      trailerUrl: movieData.trailerUrl || null,
      defaultStartTime: movieData.defaultStartTime || movieData.default_start_time || null,
      formats: movieData.formats || []
    };
  }

  static toCatalogFilm(m, extra = {}) {
    const rawTime = m.default_start_time ? String(m.default_start_time).slice(0, 5) : '19:00';
    let formattedTime = rawTime;
    try {
      const [h, min] = rawTime.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      formattedTime = `${h12}:${(min || 0).toString().padStart(2, '0')} ${ampm}`;
    } catch (e) {}

    const availableSeats = extra.availableSeats ?? 0;
    const totalSeats = extra.totalSeats ?? 0;

    return {
      id: m.id,
      title: m.title,
      director: m.director_name,
      producer: m.producer_name,
      distributor: m.distributor_name || 'Independent',
      language: Array.isArray(m.languages) ? m.languages.join(' • ') : m.original_language,
      duration: `${Math.floor((m.duration_minutes || 0) / 60)}h ${(m.duration_minutes || 0) % 60}m`,
      certification: m.cbfc_certification,
      cbfcNumber: m.cbfc_certificate_number,
      releaseDate: m.release_date,
      showDate: extra.showDate || null,
      synopsis: m.synopsis,
      formats: m.formats && m.formats.length ? m.formats : ['Standard 2D'],
      defaultStartTime: rawTime,
      timings: extra.timings || [],
      scheduledScreenings: extra.scheduledScreenings || [],
      timingDisplay: extra.timingDisplay || formattedTime,
      availableSeats,
      totalSeats,
      seatAvailabilityText: `${availableSeats} / ${totalSeats} Seats Available`,
      status: m.status === 'ACTIVE' ? 'AUTHORIZED' : m.status,
      posterUrl: m.poster_path || m.posterUrl || m.poster || null,
      posterPath: m.poster_path || m.posterUrl || m.poster || null,
      poster_path: m.poster_path || m.posterUrl || m.poster || null,
      poster: m.poster_path || m.posterUrl || m.poster || null,
      assignedHalls: extra.assignedHalls ?? 0,
      totalScreens: extra.totalScreens ?? 0,
      weeklyOccupancy: extra.weeklyOccupancy ?? 0,
      totalRevenue: extra.totalRevenue ?? 0,
      genre: m.genres || []
    };
  }

  static async createMovie(providerUserId, movieData) {
    const payload = this.normalizePayload(movieData);
    const { data: existing } = await supabaseAdmin
      .from('movies')
      .select('id')
      .ilike('movie_code', payload.movieCode)
      .maybeSingle();
    if (existing) throw new ValidationError(`Movie code '${payload.movieCode}' already exists`);

    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', providerUserId).maybeSingle();
    const isAdmin = profile?.role === 'PLATFORM_ADMIN';
    const initialStatus = isAdmin ? 'ACTIVE' : 'PENDING_REVIEW';

    const movieId = uuidv4();
    const movie = {
      id: movieId,
      movie_code: payload.movieCode,
      title: payload.title,
      original_title: payload.originalTitle,
      synopsis: payload.synopsis,
      theatrical_overview: payload.theatricalOverview,
      original_language: payload.originalLanguage,
      languages: payload.languages,
      genres: payload.genres,
      duration_minutes: payload.durationMinutes,
      release_date: payload.releaseDate,
      director_name: payload.directorName,
      producer_name: payload.producerName,
      production_company: payload.productionCompany,
      distributor_name: payload.distributorName,
      cbfc_certificate_number: payload.cbfcCertificateNumber,
      cbfc_certification: payload.cbfcCertification,
      cbfc_certificate_date: payload.cbfcCertificateDate,
      poster_path: payload.posterPath,
      backdrop_path: payload.backdropPath,
      trailer_url: payload.trailerUrl,
      default_start_time: payload.defaultStartTime,
      formats: payload.formats,
      status: initialStatus,
      created_by_provider: providerUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin.from('movies').insert(movie);
    if (error) throw new ValidationError(`Failed to create movie: ${error.message}`);
    memoryStore.movies.set(movieId, movie);
    const catalogFilm = this.toCatalogFilm(movie);
    return {
      ...movie,
      ...catalogFilm,
      posterUrl: movie.poster_path,
      posterPath: movie.poster_path,
      poster_path: movie.poster_path,
      poster: movie.poster_path,
      formats: payload.formats
    };
  }

  static async getProviderMovies(providerUserId, userRole = null) {
    let query = supabaseAdmin.from('movies').select('*');
    // Enforce exclusivity: strictly filter by the logged-in provider's user id
    if (providerUserId && userRole !== 'PLATFORM_ADMIN') {
      query = query.eq('created_by_provider', providerUserId);
    }
    const { data: moviesData } = await query.order('created_at', { ascending: false });
    let rows = moviesData || [];
    if (!moviesData || moviesData.length === 0) {
      rows = [...memoryStore.movies.values()].filter(
        (m) => (userRole === 'PLATFORM_ADMIN') || (providerUserId && m.created_by_provider === providerUserId)
      );
    }

    if (rows.length === 0) {
      return [];
    }

    // Deduplicate by title if multiple rapid clicks created duplicate records
    const seenTitles = new Set();
    const uniqueRows = [];
    for (const r of rows) {
      const key = `${r.title?.toLowerCase()}_${r.created_by_provider}`;
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        uniqueRows.push(r);
      }
    }

    // Fetch any scheduled shows for these movies to populate live timings and dates
    let showsMap = new Map();
    try {
      const movieIds = uniqueRows.map((r) => r.id);
      const { data: showsData } = await supabaseAdmin
        .from('shows')
        .select('id, movie_id, show_date, start_time, screen_id, cinema_id, status, screens(capacity), show_seats(status)')
        .in('movie_id', movieIds)
        .neq('status', 'CANCELLED');

      if (showsData && showsData.length > 0) {
        for (const s of showsData) {
          if (!showsMap.has(s.movie_id)) showsMap.set(s.movie_id, []);
          showsMap.get(s.movie_id).push(s);
        }
      }
    } catch (e) {
      console.warn('Could not query shows for provider films:', e.message);
    }

    return uniqueRows.map((m) => {
      const movieShows = showsMap.get(m.id) || [];

      let timings = [];
      let showDate = null;
      let availableSeats = 0;
      let totalSeats = 0;
      let scheduledScreenings = [];

      if (movieShows.length > 0) {
        scheduledScreenings = movieShows.map(show => ({
          date: show.show_date,
          time: String(show.start_time || '').slice(0, 5),
          showId: show.id,
          screenId: show.screen_id,
          status: show.status
        }));
        timings = movieShows.map((s) => {
          const raw = String(s.start_time).slice(0, 5);
          const [h, min] = raw.split(':').map(Number);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 || 12;
          return `${h12}:${(min || 0).toString().padStart(2, '0')} ${ampm}`;
        });
        showDate = movieShows[0].show_date;
        const showSeats = movieShows[0].show_seats || [];
        totalSeats = showSeats.length || movieShows[0].screens?.capacity || 0;
        availableSeats = showSeats.length
          ? showSeats.filter(seat => seat.status === 'AVAILABLE').length
          : 0;
      }

      return this.toCatalogFilm(m, {
        timings,
        scheduledScreenings,
        timingDisplay: timings.join(', '),
        showDate,
        availableSeats,
        totalSeats,
        assignedHalls: new Set(movieShows.map(show => show.cinema_id)).size,
        totalScreens: new Set(movieShows.map(show => show.screen_id)).size,
      });
    });
  }

  static async getMovieById(movieId) {
    const { data } = await supabaseAdmin.from('movies').select('*').eq('id', movieId).single();
    if (data) { memoryStore.movies.set(data.id, data); return data; }
    const m = memoryStore.movies.get(movieId);
    if (!m) throw new NotFoundError('Movie not found');
    return m;
  }

  static async updateMovie(providerUserId, movieId, updateData) {
    const movie = await this.getMovieById(movieId);
    if (movie.created_by_provider !== providerUserId) throw new ForbiddenError('Unauthorized: You do not own this movie');
    const payload = this.normalizePayload({
      title: updateData.title || movie.title,
      originalTitle: updateData.originalTitle || movie.original_title,
      synopsis: updateData.synopsis || movie.synopsis,
      defaultStartTime: updateData.defaultStartTime ?? movie.default_start_time ?? null,
      ...updateData
    });
    const updated = {
      title: payload.title,
      original_title: payload.originalTitle,
      synopsis: payload.synopsis,
      theatrical_overview: payload.theatricalOverview,
      original_language: payload.originalLanguage,
      languages: payload.languages,
      genres: payload.genres,
      duration_minutes: payload.durationMinutes,
      release_date: payload.releaseDate,
      director_name: payload.directorName,
      producer_name: payload.producerName,
      production_company: payload.productionCompany,
      distributor_name: payload.distributorName,
      cbfc_certificate_number: payload.cbfcCertificateNumber,
      cbfc_certification: payload.cbfcCertification,
      poster_path: payload.posterPath,
      backdrop_path: payload.backdropPath,
      trailer_url: payload.trailerUrl,
      default_start_time: payload.defaultStartTime,
      formats: payload.formats,
      status: movie.status === 'ACTIVE' ? (updateData.status || 'ACTIVE') : 'PENDING_REVIEW',
      updated_at: new Date().toISOString()
    };
    const { data: savedMovie, error } = await supabaseAdmin.from('movies').update(updated).eq('id', movieId).select('*').single();
    if (error) throw new AppError(`Failed to update movie: ${error.message}`, 503, 'DATABASE_WRITE_FAILED');
    const merged = savedMovie || { ...movie, ...updated };
    memoryStore.movies.set(movieId, merged);
    const catalogFilm = this.toCatalogFilm(merged);
    return {
      ...merged,
      ...catalogFilm,
      posterUrl: merged.poster_path,
      posterPath: merged.poster_path,
      poster_path: merged.poster_path,
      poster: merged.poster_path
    };
  }

  static async getPublicMovies({ search, language, genre, city, date, lat, lng, sortBy = 'closest' } = {}) {
    // A film is ONLY shown on the customer side if and only if it has been approved by the platform admin (status = 'ACTIVE')
    let query = supabaseAdmin.from('movies').select('*').eq('status', 'ACTIVE');
    if (search) query = query.or(`title.ilike.%${search}%,director_name.ilike.%${search}%`);
    if (language) query = query.contains('languages', [language]);
    if (genre) query = query.contains('genres', [genre]);
    const { data, error: movieError } = await query;
    if (movieError) throw new AppError('Could not load movies from the database', 503, 'DATABASE_UNAVAILABLE');
    const rawMovies = data || [];
    // Deduplicate movies by normalized title to prevent identical movie entries
    const seenTitles = new Set();
    const movies = [];
    for (const m of rawMovies) {
      const norm = (m.title || '').trim().toLowerCase();
      if (!seenTitles.has(norm)) {
        seenTitles.add(norm);
        movies.push(m);
      }
    }

    // Fetch provider profiles for attribution
    const providerIds = [...new Set(movies.map(m => m.created_by_provider).filter(Boolean))];
    let providerMap = new Map();
    if (providerIds.length) {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id,full_name,organization_name').in('id', providerIds);
      for (const p of (profiles || [])) providerMap.set(p.id, p);
    }

    // Fetch document counts and types per movie for certification display
    const movieIds = movies.map(m => m.id);
    let docMap = new Map();
    if (movieIds.length) {
      const { data: docs } = await supabaseAdmin.from('movie_documents').select('movie_id, document_type, filename, status, created_at').in('movie_id', movieIds);
      for (const d of (docs || [])) {
        if (!docMap.has(d.movie_id)) docMap.set(d.movie_id, []);
        docMap.get(d.movie_id).push({
          type: d.document_type,
          filename: d.filename,
          status: d.status,
          createdAt: d.created_at
        });
      }
    }

    const { data: shows, error: showsError } = await supabaseAdmin
      .from('shows')
      .select('*, cinemas(id, cinema_name, city, address, latitude, longitude, verification_status), screens(id, screen_name, audio_format, supported_formats), show_seats(category_name, price, status)')
      .eq('status', 'PUBLISHED')
      .order('show_date', { ascending: true });
    if (showsError) throw new AppError('Could not load showtimes from the database', 503, 'DATABASE_UNAVAILABLE');

    const showsByMovie = new Map();
    for (const s of (shows || [])) {
      const list = showsByMovie.get(s.movie_id) || [];
      list.push(s);
      showsByMovie.set(s.movie_id, list);
    }

    const todayDate = date || new Date().toISOString().slice(0, 10);

    return movies.map(m => {
      const related = showsByMovie.get(m.id) || [];
      const theatreMap = new Map();

      for (const s of related) {
        const theatreKey = `${s.cinema_id}:${s.screen_id}`;
        if (!theatreMap.has(theatreKey)) {
          theatreMap.set(theatreKey, {
            id: theatreKey,
            cinemaId: s.cinema_id,
            name: s.cinemas?.cinema_name || 'Cinema',
            city: s.cinemas?.city || '',
            area: s.cinemas?.address || '',
            latitude: s.cinemas?.latitude != null ? Number(s.cinemas.latitude) : null,
            longitude: s.cinemas?.longitude != null ? Number(s.cinemas.longitude) : null,
            screenId: s.screen_id,
            screenName: s.screens?.screen_name || 'Screen 1',
            screenFormat: s.format || m.formats?.[0] || 'Standard 2D',
            audioFormat: s.screens?.audio_format || 'Dolby Atmos',
            isVerified: true,
            verificationBadge: 'Verified to Screen this Movie',
            ticketPrices: s.show_seats?.length
              ? [...new Map(s.show_seats.map(seat => [seat.category_name || 'Standard', Number(seat.price || 150)])).entries()]
                  .map(([tierName, price]) => ({ tierName, price }))
              : [
                  { tierName: 'Standard', price: 150 },
                  { tierName: 'Executive', price: 250 },
                  { tierName: 'VIP Recliner', price: 450 }
                ],
            availableDays: [],
            showtimes: []
          });
        }
        const theatre = theatreMap.get(theatreKey);
        const rawTime = String(s.start_time || '').slice(0, 5);
        let timeLabel = rawTime;
        if (rawTime.includes(':')) {
          const [h, min] = rawTime.split(':').map(Number);
          if (!isNaN(h)) {
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            timeLabel = `${h12}:${(min || 0).toString().padStart(2, '0')} ${ampm}`;
          }
        }
        const availableSeats = (s.show_seats || []).filter(seat => seat.status === 'AVAILABLE').length;
        const totalSeats = (s.show_seats || []).length || 100;
        theatre.showtimes.push({
          time: timeLabel,
          status: availableSeats ? `${availableSeats} seats` : 'Available',
          filling: availableSeats === 0 ? 'sold_out' : (totalSeats > 0 && availableSeats / totalSeats < 0.15 ? 'almost_full' : 'normal'),
          showId: s.id,
          date: s.show_date
        });
        if (!theatre.availableDays.includes(s.show_date)) theatre.availableDays.push(s.show_date);
      }

      const provider = providerMap.get(m.created_by_provider);
      const movieDocs = docMap.get(m.id) || [];
      const verifiedDocs = movieDocs.filter(d => d.status === 'VERIFIED' || d.status === 'APPROVED');
      const docTypes = [...new Set(movieDocs.map(d => d.type))];
      const rawTheatresList = Array.from(theatreMap.values());
      const theatresList = GeoService.enrichAndSortCinemas(rawTheatresList, {
        userLat: lat,
        userLng: lng,
        userCity: city,
        targetCity: city,
        sortBy
      });

      return {
        id: m.id,
        title: m.title,
        synopsis: m.synopsis,
        duration: `${Math.floor(m.duration_minutes / 60)}h ${m.duration_minutes % 60}m`,
        durationMinutes: m.duration_minutes,
        director: m.director_name,
        producer: m.producer_name,
        cbfcCertification: m.cbfc_certification,
        cbfcCertificateNumber: m.cbfc_certificate_number,
        releaseDate: m.release_date,
        languages: m.languages,
        language: Array.isArray(m.languages) ? m.languages.join(' • ') : m.original_language,
        genres: m.genres,
        formats: m.formats || [],
        genre: Array.isArray(m.genres) ? m.genres.join(' / ') : 'Drama',
        poster: m.poster_path,
        banner: m.backdrop_path || m.poster_path,
        backdrop: m.backdrop_path,
        format: theatresList[0]?.screenFormat || m.formats?.[0] || 'Standard 2D',
        audio: theatresList[0]?.audioFormat || 'Dolby Atmos',
        status: m.status,
        showId: theatresList[0]?.showtimes?.[0]?.showId || null,
        theatres: theatresList,
        providerName: provider?.full_name || 'Verified Provider',
        providerCompany: provider?.organization_name || null,
        productionCompany: m.production_company,
        distributorName: m.distributor_name,
        certifications: docTypes,
        certificationCount: movieDocs.length,
        verifiedCertCount: verifiedDocs.length,
        hasCBFC: docTypes.includes('CBFC_CERTIFICATE') || !!m.cbfc_certificate_number,
        hasDistributionDeed: docTypes.includes('DISTRIBUTION_DEED') || !!m.distributor_name,
        isSuperAdminAuthorized: m.status === 'ACTIVE' || m.status === 'UPCOMING',
      };
    });
  }

  static async getPublicMovieDetail(movieId) {
    const m = await this.getMovieById(movieId);
    if (m.status !== 'ACTIVE') throw new NotFoundError('This film is awaiting admin approval and cannot be exhibited yet.');
    return {
      id: m.id, title: m.title, theatricalOverview: m.theatrical_overview || m.synopsis,
      synopsis: m.synopsis, director: m.director_name, producer: m.producer_name,
      cbfcCertification: m.cbfc_certification,
      duration: `${Math.floor(m.duration_minutes / 60)}h ${m.duration_minutes % 60}m`,
      durationMinutes: m.duration_minutes, languages: m.languages, genres: m.genres,
      poster: m.poster_path, backdrop: m.backdrop_path, trailerUrl: m.trailer_url,
      releaseDate: m.release_date, status: m.status
    };
  }

  static async uploadDocument(providerUserId, movieId, docData, file) {
    const movie = await this.getMovieById(movieId);
    if (movie.created_by_provider !== providerUserId) throw new ForbiddenError('Unauthorized: You do not own this movie');
    if (!file?.buffer?.length) throw new ValidationError('Choose a certificate file to upload');
    const supportedDocumentTypes = new Set(['CBFC_CERTIFICATE', 'DISTRIBUTION_DEED', 'AUTHORIZATION_LETTER']);
    if (!supportedDocumentTypes.has(docData.documentType)) throw new ValidationError('Choose a valid certificate type');

    const docId = uuidv4();
    const safeFilename = String(file.originalname || 'certificate.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${providerUserId}/${movieId}/${docId}_${safeFilename}`;
    const bucket = 'private-provider-documents';
    const { error: storageError } = await supabaseAdmin.storage.from(bucket).upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });
    if (storageError) throw new AppError(`Certificate upload failed: ${storageError.message}`, 503, 'STORAGE_UPLOAD_FAILED');

    const doc = {
      id: docId, movie_id: movieId, document_type: docData.documentType,
      storage_path: storagePath,
      filename: safeFilename, mime_type: file.mimetype,
      uploaded_by: providerUserId, status: 'PENDING',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    const { error: insertError } = await supabaseAdmin.from('movie_documents').insert(doc);
    if (insertError) {
      await supabaseAdmin.storage.from(bucket).remove([storagePath]);
      throw new AppError(`Could not save certificate details: ${insertError.message}`, 503, 'DATABASE_WRITE_FAILED');
    }
    memoryStore.movieDocuments.set(docId, doc);
    return doc;
  }

  static async getMovieDocuments(providerUserId, movieId) {
    const movie = await this.getMovieById(movieId);
    if (movie.created_by_provider !== providerUserId) throw new ForbiddenError('Unauthorized: You do not own this movie');
    const { data, error } = await supabaseAdmin
      .from('movie_documents')
      .select('id, movie_id, document_type, filename, mime_type, status, created_at')
      .eq('movie_id', movieId)
      .order('created_at', { ascending: false });
    if (error) throw new AppError('Could not load film certificates', 503, 'DATABASE_UNAVAILABLE');
    return data || [...memoryStore.movieDocuments.values()].filter(doc => doc.movie_id === movieId);
  }

  static async uploadPoster(providerUserId, file) {
    if (!file?.buffer?.length) throw new ValidationError('Choose an image file for the movie poster');
    const mime = (file.mimetype || '').toLowerCase();
    if (!mime.startsWith('image/')) {
      throw new ValidationError('Only image files (JPG, PNG, WEBP, GIF) are supported for movie posters');
    }

    const rawExt = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
    const safeFilename = `poster_${Date.now()}_${uuidv4().slice(0, 8)}.${ext}`;
    const storagePath = `${providerUserId}/${safeFilename}`;

    let posterUrl = null;

    // 1. Save locally to disk for instant, lightweight HTTP serving
    try {
      const fs = await import('fs');
      const path = await import('path');
      const dir = path.join(process.cwd(), 'public', 'uploads', 'posters');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, safeFilename), file.buffer);
      posterUrl = `/uploads/posters/${safeFilename}`;
    } catch (e) {
      console.warn('Local disk save fallback warning:', e.message);
    }

    // 2. Also attempt Supabase storage
    try {
      const { error: storageError } = await supabaseAdmin.storage
        .from('public-posters')
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });
      if (!storageError) {
        const { data: pubData } = supabaseAdmin.storage
          .from('public-posters')
          .getPublicUrl(storagePath);
        if (pubData?.publicUrl) {
          posterUrl = pubData.publicUrl;
        }
      }
    } catch (_) {}

    // 3. In-memory data URL fallback
    if (!posterUrl) {
      const base64 = file.buffer.toString('base64');
      posterUrl = `data:${file.mimetype};base64,${base64}`;
    }

    return { posterUrl, filename: safeFilename };
  }
}

