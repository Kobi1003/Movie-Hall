import { v4 as uuidv4 } from 'uuid';
import { memoryStore, supabaseAdmin } from '../config/supabase.js';
import { AppError, NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';
import { CINEMA_VERIFICATION_STATUS } from '../config/constants.js';
import { SeatPlanService } from './seatPlan.service.js';
import { GeoService } from './geo.service.js';

export class CinemaService {
  static async createCinema(ownerUserId, cinemaData) {
    // Check Supabase for existing cinema
    const { data: existing } = await supabaseAdmin
      .from('cinemas')
      .select('*')
      .eq('owner_user_id', ownerUserId)
      .maybeSingle();
    if (existing) {
      return await this.updateCinema(ownerUserId, cinemaData);
    }

    let lat = cinemaData.latitude || null;
    let lng = cinemaData.longitude || null;

    if (lat == null || lng == null) {
      try {
        const geocoded = await GeoService.geocode({
          address: cinemaData.address,
          city: cinemaData.city,
          state: cinemaData.state,
          postalCode: cinemaData.postalCode
        });
        if (geocoded) {
          lat = geocoded.latitude;
          lng = geocoded.longitude;
        }
      } catch (_) {}
    }

    const id = uuidv4();
    const cinema = {
      id,
      owner_user_id: ownerUserId,
      cinema_name: cinemaData.cinemaName,
      legal_business_name: cinemaData.legalBusinessName,
      cinema_type: cinemaData.cinemaType || 'MULTIPLEX',
      description: cinemaData.description || null,
      address: cinemaData.address,
      city: cinemaData.city,
      state: cinemaData.state,
      postal_code: cinemaData.postalCode,
      latitude: lat,
      longitude: lng,
      phone: cinemaData.phone,
      email: cinemaData.email,
      website: cinemaData.website || null,
      logo_path: cinemaData.logoPath || null,
      cover_image_path: cinemaData.coverImagePath || null,
      verification_status: CINEMA_VERIFICATION_STATUS.DRAFT,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin.from('cinemas').insert(cinema);
    if (error) {
      // In-memory fallback
      memoryStore.cinemas.set(id, cinema);
    } else {
      memoryStore.cinemas.set(id, cinema);
    }

    try {
      await supabaseAdmin.from('profiles').update({ role: 'CINEMA_OWNER', updated_at: new Date().toISOString() }).eq('id', ownerUserId);
      const profile = memoryStore.profiles.get(ownerUserId);
      if (profile) profile.role = 'CINEMA_OWNER';
    } catch (_) {}

    return cinema;
  }

  static async getMyCinema(ownerUserId) {
    const { data } = await supabaseAdmin
      .from('cinemas')
      .select('*')
      .eq('owner_user_id', ownerUserId)
      .single();
    if (data) { memoryStore.cinemas.set(data.id, data); return data; }

    // fallback to memoryStore
    for (const c of memoryStore.cinemas.values()) {
      if (c.owner_user_id === ownerUserId) return c;
    }
    throw new NotFoundError('Cinema profile not found for this user');
  }

  static async updateCinema(ownerUserId, updateData) {
    const cinema = await this.getMyCinema(ownerUserId);
    const columns = { cinemaName: 'cinema_name', legalBusinessName: 'legal_business_name', cinemaType: 'cinema_type', description: 'description', address: 'address', city: 'city', state: 'state', postalCode: 'postal_code', latitude: 'latitude', longitude: 'longitude', phone: 'phone', email: 'email', website: 'website' };
    const changes = Object.fromEntries(Object.entries(updateData).filter(([key]) => columns[key]).map(([key, value]) => [columns[key], value]));

    // Auto-geocode if address or city is updated and coordinates are missing
    if ((changes.address || changes.city) && (changes.latitude == null || changes.longitude == null)) {
      try {
        const geocoded = await GeoService.geocode({
          address: changes.address || cinema.address,
          city: changes.city || cinema.city,
          state: changes.state || cinema.state,
          postalCode: changes.postal_code || cinema.postal_code
        });
        if (geocoded) {
          changes.latitude = geocoded.latitude;
          changes.longitude = geocoded.longitude;
        }
      } catch (_) {}
    }

    const { data, error } = await supabaseAdmin.from('cinemas').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', cinema.id).select('*').single();
    if (error) throw new AppError(`Could not update cinema: ${error.message}`, 503, 'DATABASE_WRITE_FAILED');
    memoryStore.cinemas.set(cinema.id, data);
    return data;
  }

  static async getPublicCinemas({ city, lat, lng, userCity, sortBy = 'closest' } = {}) {
    let query = supabaseAdmin
      .from('cinemas')
      .select('id, cinema_name, cinema_type, city, state, address, description, phone, email, latitude, longitude, verification_status')
      .eq('verification_status', 'VERIFIED')
      .eq('is_active', true);
    if (city && city !== 'All Locations' && city !== 'All Locations / Metro') {
      const norm = city.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
      query = query.ilike('city', `%${norm}%`);
    }
    const { data } = await query;
    let list = [];
    if (data && data.length > 0) {
      list = data.map(c => ({
        id: c.id,
        name: c.cinema_name,
        type: c.cinema_type,
        city: c.city,
        state: c.state,
        address: c.address,
        description: c.description,
        phone: c.phone,
        email: c.email,
        latitude: c.latitude != null ? Number(c.latitude) : null,
        longitude: c.longitude != null ? Number(c.longitude) : null,
        verificationStatus: c.verification_status
      }));
    } else {
      // fallback
      for (const c of memoryStore.cinemas.values()) {
        if (c.is_active && c.verification_status === 'VERIFIED') {
          if (!city || city === 'All Locations' || city === 'All Locations / Metro' || c.city.toLowerCase().includes(city.toLowerCase())) {
            list.push({
              id: c.id,
              name: c.cinema_name,
              type: c.cinema_type,
              city: c.city,
              state: c.state,
              address: c.address,
              description: c.description,
              phone: c.phone,
              email: c.email,
              latitude: c.latitude != null ? Number(c.latitude) : null,
              longitude: c.longitude != null ? Number(c.longitude) : null,
              verificationStatus: c.verification_status
            });
          }
        }
      }
    }

    return GeoService.enrichAndSortCinemas(list, {
      userLat: lat,
      userLng: lng,
      userCity,
      targetCity: city,
      sortBy
    });
  }

  static async getCitiesWithCinemas({ lat, lng } = {}) {
    const cinemas = await this.getPublicCinemas({ lat, lng });
    const cityMap = new Map();
    for (const c of cinemas) {
      const cityName = c.city;
      if (!cityName) continue;
      if (!cityMap.has(cityName)) {
        const coords = GeoService.getKnownCityCoordinates(cityName) || { lat: c.latitude, lng: c.longitude };
        cityMap.set(cityName, {
          city: cityName,
          cinemaCount: 0,
          latitude: coords?.lat ?? c.latitude,
          longitude: coords?.lng ?? c.longitude,
          closestDistanceKm: c.distanceKm,
          closestDistanceText: c.distanceText,
          cinemas: []
        });
      }
      const entry = cityMap.get(cityName);
      entry.cinemaCount++;
      entry.cinemas.push(c);
      if (c.distanceKm != null && (entry.closestDistanceKm == null || c.distanceKm < entry.closestDistanceKm)) {
        entry.closestDistanceKm = c.distanceKm;
        entry.closestDistanceText = c.distanceText;
      }
    }
    const result = Array.from(cityMap.values());
    return result.sort((a, b) => {
      if (a.closestDistanceKm != null && b.closestDistanceKm != null) {
        return a.closestDistanceKm - b.closestDistanceKm;
      }
      return a.city.localeCompare(b.city);
    });
  }

  static async getPublicCinemaById(cinemaId, { lat, lng } = {}) {
    const { data: c } = await supabaseAdmin.from('cinemas').select('*').eq('id', cinemaId).single();
    const cinema = c || memoryStore.cinemas.get(cinemaId);
    if (!cinema || !cinema.is_active || cinema.verification_status !== 'VERIFIED') {
      throw new NotFoundError('Cinema not found or not currently active');
    }

    const { data: screensData } = await supabaseAdmin.from('screens').select('*').eq('cinema_id', cinemaId).eq('is_active', true);
    const screens = (screensData || []).map(s => ({
      id: s.id, screenName: s.screen_name, screenNumber: s.screen_number, screenType: s.screen_type,
      capacity: s.capacity, projectionType: s.projection_type, audioFormat: s.audio_format, supportedFormats: s.supported_formats
    }));

    const enrichedList = GeoService.enrichAndSortCinemas([cinema], { userLat: lat, userLng: lng });
    const enriched = enrichedList[0] || cinema;

    return {
      id: cinema.id,
      name: cinema.cinema_name,
      legalName: cinema.legal_business_name,
      type: cinema.cinema_type,
      city: cinema.city,
      state: cinema.state,
      address: cinema.address,
      description: cinema.description,
      latitude: enriched.latitude,
      longitude: enriched.longitude,
      distanceKm: enriched.distanceKm,
      distanceText: enriched.distanceText,
      mapsUrl: enriched.mapsUrl,
      directionsUrl: enriched.directionsUrl,
      screens
    };
  }

  static async submitVerification(ownerUserId) {
    const cinema = await this.getMyCinema(ownerUserId);
    const { data: documents, error: documentsError } = await supabaseAdmin.from('cinema_documents').select('document_type').eq('cinema_id', cinema.id);
    if (documentsError) throw new AppError('Could not check verification documents', 503, 'DATABASE_UNAVAILABLE');
    const types = new Set((documents || []).map(doc => doc.document_type));
    if (!types.has('FIRE_SAFETY') || !types.has('CINEMA_LICENCE')) throw new ValidationError('Upload both the Fire Safety NOC and CBFC Exhibitor Licence before submitting.');
    const now = new Date().toISOString();
    const { error: cinemaError } = await supabaseAdmin.from('cinemas').update({ verification_status: 'SUBMITTED', updated_at: now }).eq('id', cinema.id);
    if (cinemaError) throw new AppError('Could not submit cinema for verification', 503, 'DATABASE_WRITE_FAILED');
    const { data: existing } = await supabaseAdmin.from('cinema_verifications').select('id').eq('cinema_id', cinema.id).in('status', ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW']).maybeSingle();
    const result = existing
      ? await supabaseAdmin.from('cinema_verifications').update({ status: 'SUBMITTED', submitted_at: now, updated_at: now }).eq('id', existing.id)
      : await supabaseAdmin.from('cinema_verifications').insert({ id: uuidv4(), cinema_id: cinema.id, status: 'SUBMITTED', submitted_at: now });
    if (result.error) throw new AppError('Could not save verification submission', 503, 'DATABASE_WRITE_FAILED');
    return { success: true, status: 'SUBMITTED', message: 'Cinema verification submitted for administrator review.' };
  }

  static async uploadDocument(ownerUserId, docData, file) {
    const cinema = await this.getMyCinema(ownerUserId);
    if (!file?.buffer?.length) throw new ValidationError('Choose a document file to upload');
    const supported = new Set(['CINEMA_LICENCE', 'FIRE_SAFETY']);
    if (!supported.has(docData.documentType)) throw new ValidationError('Choose a supported verification document');
    const docId = uuidv4();
    const safeFilename = String(file.originalname || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${cinema.id}/documents/${docId}_${safeFilename}`;
    const bucket = 'private-cinema-documents';
    const { error: storageError } = await supabaseAdmin.storage.from(bucket).upload(storagePath, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream', upsert: false
    });
    if (storageError) throw new AppError(`Document upload failed: ${storageError.message}`, 503, 'STORAGE_UPLOAD_FAILED');
    const doc = {
      id: docId, cinema_id: cinema.id, document_type: docData.documentType,
      storage_path: storagePath, original_filename: safeFilename,
      mime_type: file.mimetype || 'application/octet-stream', file_size: file.size,
      document_number: docData.documentNumber || null, issue_date: docData.issueDate || null,
      expiry_date: docData.expiryDate || null, status: 'PENDING', uploaded_by: ownerUserId,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    const { error: insertError } = await supabaseAdmin.from('cinema_documents').insert(doc);
    if (insertError) {
      await supabaseAdmin.storage.from(bucket).remove([storagePath]);
      throw new AppError(`Could not save document details: ${insertError.message}`, 503, 'DATABASE_WRITE_FAILED');
    }
    memoryStore.cinemaDocuments.set(docId, doc);
    return doc;
  }

  static async getDocuments(ownerUserId) {
    let cinema;
    try {
      cinema = await this.getMyCinema(ownerUserId);
    } catch {
      return [];
    }
    const { data } = await supabaseAdmin.from('cinema_documents').select('*').eq('cinema_id', cinema.id);
    return data || [];
  }

  // Screens
  static async createScreen(ownerUserId, screenData) {
    const cinema = await this.getMyCinema(ownerUserId);

    const { data: existing } = await supabaseAdmin
      .from('screens')
      .select('id')
      .eq('cinema_id', cinema.id)
      .eq('screen_number', screenData.screenNumber)
      .single();
    if (existing) throw new ValidationError(`Screen number ${screenData.screenNumber} already exists in this cinema.`);

    const screenId = uuidv4();
    const screen = {
      id: screenId, cinema_id: cinema.id,
      screen_name: screenData.screenName, screen_number: screenData.screenNumber,
      screen_type: screenData.screenType || 'STANDARD', capacity: screenData.capacity || 0,
      projection_type: screenData.projectionType || 'Laser 4K',
      audio_format: screenData.audioFormat || 'Dolby Atmos',
      supported_formats: screenData.supportedFormats || ['2D', '3D'],
      is_active: screenData.isActive ?? true, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin.from('screens').insert(screen);
    if (error) {
      memoryStore.screens.set(screenId, screen);
    } else {
      memoryStore.screens.set(screenId, screen);
    }

    // Auto-generate and publish the initial seating arrangement for this screen
    try {
      await SeatPlanService.ensureDefaultPublishedSeatPlan(screenId, screenData.capacity || 100, ownerUserId);
    } catch (seatErr) {
      console.warn('Could not auto-generate initial seat layout for screen:', seatErr.message);
    }

    return screen;
  }

  static async getScreens(ownerUserId) {
    let cinema;
    try {
      cinema = await this.getMyCinema(ownerUserId);
    } catch {
      const { data: allScreens } = await supabaseAdmin.from('screens').select('*, cinemas(cinema_name, city)').eq('is_active', true).order('screen_number');
      return allScreens || [];
    }
    const { data, error } = await supabaseAdmin.from('screens').select('*, cinemas(cinema_name, city)').eq('cinema_id', cinema.id).order('screen_number');
    if (error) throw new AppError(`Could not load cinema screens: ${error.message}`, 503, 'DATABASE_UNAVAILABLE');
    return data || [];
  }

  static async updateScreen(ownerUserId, screenId, screenData) {
    const screen = await this.getScreenById(ownerUserId, screenId);
    const { data, error } = await supabaseAdmin.from('screens').update({
      screen_name: screenData.screenName ?? screen.screen_name,
      screen_number: screenData.screenNumber ?? screen.screen_number,
      screen_type: screenData.screenType ?? screen.screen_type,
      projection_type: screenData.projectionType ?? screen.projection_type,
      audio_format: screenData.audioFormat ?? screen.audio_format,
      supported_formats: screenData.supportedFormats ?? screen.supported_formats,
      capacity: screenData.capacity ?? screen.capacity,
      is_active: screenData.isActive ?? screen.is_active,
      updated_at: new Date().toISOString()
    }).eq('id', screenId).select('*').single();
    if (error) throw new AppError(`Could not update screen: ${error.message}`, 503, 'DATABASE_WRITE_FAILED');
    memoryStore.screens.set(screenId, data);
    return data;
  }

  static async getScreenById(ownerUserId, screenId) {
    const { data: screen } = await supabaseAdmin.from('screens').select('*').eq('id', screenId).single();
    if (!screen) throw new NotFoundError('Screen not found');
    const cinema = await this.getMyCinema(ownerUserId);
    if (screen.cinema_id !== cinema.id) throw new ForbiddenError('Unauthorized to access screen of another cinema');
    return screen;
  }

  static async addReview(userId, cinemaId, reviewData) {
    const id = uuidv4();
    const review = {
      id,
      user_id: userId,
      cinema_id: cinemaId,
      cinema_name: reviewData.cinemaName || 'Cinema Hall',
      user_name: reviewData.userName || 'Moviegoer',
      rating: Math.max(1, Math.min(5, Number(reviewData.rating) || 5)),
      review_text: reviewData.reviewText || '',
      tags: Array.isArray(reviewData.tags) ? reviewData.tags : [],
      booking_id: reviewData.bookingId || null,
      created_at: new Date().toISOString()
    };
    if (!memoryStore.cinemaReviews) memoryStore.cinemaReviews = new Map();
    memoryStore.cinemaReviews.set(id, review);

    try {
      await supabaseAdmin.from('cinema_reviews').insert(review);
    } catch (_) {
      // Memory store holds it gracefully if table does not exist
    }
    return review;
  }

  static async getUserReviews(userId) {
    if (!memoryStore.cinemaReviews) memoryStore.cinemaReviews = new Map();
    const reviewsMap = new Map();
    try {
      const { data } = await supabaseAdmin.from('cinema_reviews').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (data) {
        data.forEach(r => reviewsMap.set(r.id, r));
      }
    } catch (_) {}
    for (const r of memoryStore.cinemaReviews.values()) {
      if (r.user_id === userId) reviewsMap.set(r.id, r);
    }
    return Array.from(reviewsMap.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}
