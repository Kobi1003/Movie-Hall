import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, memoryStore } from '../config/supabase.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';
import { EXHIBITION_AUTHORIZATION_STATUS } from '../config/constants.js';

export class AuthorizationService {
  static async createAuthorization(providerUserId, data) {
    // 1. Movie exists & provider owns it
    const { data: movie } = await supabaseAdmin.from('movies').select('*').eq('id', data.movieId).single();
    const movieRecord = movie || memoryStore.movies.get(data.movieId);
    if (!movieRecord) throw new NotFoundError('Movie not found');

    // 2. Cinema exists and is VERIFIED
    const { data: cinema } = await supabaseAdmin.from('cinemas').select('*').eq('id', data.cinemaId).single();
    const cinemaRecord = cinema || memoryStore.cinemas.get(data.cinemaId);
    if (!cinemaRecord) throw new NotFoundError('Cinema not found');
    if (movieRecord.created_by_provider !== providerUserId) {
      throw new ForbiddenError('Only the movie rights holder can request exhibition authorization');
    }
    if (!['ACTIVE', 'UPCOMING'].includes(movieRecord.status)) {
      throw new ValidationError('Only an active, approved movie can be submitted for exhibition authorization');
    }

    const { data: movieDocuments, error: documentsError } = await supabaseAdmin
      .from('movie_documents')
      .select('document_type, status')
      .eq('movie_id', data.movieId);
    if (documentsError) throw new ValidationError(`Could not verify movie rights documents: ${documentsError.message}`);
    const hasVerifiedRightsDocument = (movieDocuments || []).some(document =>
      ['DISTRIBUTION_DEED', 'EXHIBITION_DEED', 'AUTHORIZATION_LETTER', 'RIGHTS_DOCUMENT'].includes(document.document_type)
      && ['VERIFIED', 'APPROVED'].includes(document.status)
    );
    if (!hasVerifiedRightsDocument) {
      throw new ValidationError('A verified distribution, exhibition, or rights document is required before requesting cinema authorization');
    }
    if (cinemaRecord.verification_status !== 'VERIFIED') {
      throw new ValidationError(`Cinema '${cinemaRecord.cinema_name}' is not verified. Current status: ${cinemaRecord.verification_status}`);
    }

    // 3. Screens belong to cinema, are active, and support formats
    for (const screenId of data.screenIds) {
      const { data: screen } = await supabaseAdmin.from('screens').select('*').eq('id', screenId).single();
      const screenRecord = screen || memoryStore.screens.get(screenId);
      if (!screenRecord) throw new NotFoundError(`Screen ${screenId} not found`);
      if (screenRecord.cinema_id !== cinemaRecord.id) throw new ValidationError(`Screen ${screenRecord.screen_name} does not belong to cinema ${cinemaRecord.cinema_name}`);
    if (!screenRecord.is_active) throw new ValidationError(`Screen ${screenRecord.screen_name} is inactive`);
      for (const fmt of data.authorizedFormats) {
        if (!screenRecord.supported_formats.includes(fmt)) {
          throw new ValidationError(`Screen '${screenRecord.screen_name}' does not support format '${fmt}'`);
        }
      }
    }

    const authId = uuidv4();
    if (data.startDate > data.endDate) throw new ValidationError('Authorization start date must be on or before its end date');
    const authorization = {
      id: authId,
      movie_id: data.movieId,
      movie_provider_id: providerUserId,
      cinema_id: data.cinemaId,
      status: EXHIBITION_AUTHORIZATION_STATUS.DRAFT,
      start_date: data.startDate,
      end_date: data.endDate,
      authorized_formats: data.authorizedFormats,
      authorized_languages: data.authorizedLanguages,
      max_shows_per_day: data.maxShowsPerDay || 10,
      min_shows_per_day: data.minShowsPerDay || 1,
      earliest_show_time: data.earliestShowTime || '08:00:00',
      latest_show_time: data.latestShowTime || '23:59:00',
      agreement_reference: data.agreementReference || null,
      commercial_model: data.commercialModel || 'REVENUE_SHARE',
      revenue_share_provider: data.revenueShareProvider ?? null,
      revenue_share_cinema: data.revenueShareCinema ?? null,
      fixed_hire: data.fixedHire ?? null,
      minimum_guarantee: data.minimumGuarantee ?? null,
      additional_terms: data.additionalTerms || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin.from('exhibition_authorizations').insert(authorization);
    if (error) throw new ValidationError(`Failed to create authorization: ${error.message}`);
    memoryStore.exhibitionAuthorizations.set(authId, authorization);

    // Save screen associations together; remove the draft if any association fails.
    const screenAssociations = data.screenIds.map(screenId => ({
      id: uuidv4(), authorization_id: authId, screen_id: screenId
    }));
    const { error: screensError } = await supabaseAdmin.from('exhibition_authorized_screens').insert(screenAssociations);
    if (screensError) {
      await supabaseAdmin.from('exhibition_authorizations').delete().eq('id', authId);
      memoryStore.exhibitionAuthorizations.delete(authId);
      throw new ValidationError(`Could not save authorized screens: ${screensError.message}`);
    }
    screenAssociations.forEach(screen => memoryStore.exhibitionAuthorizedScreens.set(screen.id, screen));

    return { ...authorization, screenIds: data.screenIds };
  }

  static async submitAuthorization(providerUserId, authId) {
    const { data: auth } = await supabaseAdmin.from('exhibition_authorizations').select('*').eq('id', authId).single();
    const authRecord = auth || memoryStore.exhibitionAuthorizations.get(authId);
    if (!authRecord) throw new NotFoundError('Authorization not found');
    if (authRecord.movie_provider_id !== providerUserId) throw new ForbiddenError('Unauthorized: You do not own this authorization');

    if (authRecord.status !== EXHIBITION_AUTHORIZATION_STATUS.DRAFT) {
      throw new ValidationError('Only draft exhibition authorizations can be submitted');
    }
    const updates = { status: EXHIBITION_AUTHORIZATION_STATUS.SUBMITTED, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const { error: updateError } = await supabaseAdmin.from('exhibition_authorizations').update(updates).eq('id', authId);
    if (updateError) throw new ValidationError(`Could not submit exhibition authorization: ${updateError.message}`);
    const updated = { ...authRecord, ...updates };
    memoryStore.exhibitionAuthorizations.set(authId, updated);
    return updated;
  }

  static async getProviderAuthorizations(providerUserId) {
    const { data } = await supabaseAdmin
      .from('exhibition_authorizations')
      .select('*, movies(title), cinemas(cinema_name), exhibition_authorized_screens(screen_id)')
      .eq('movie_provider_id', providerUserId);
    if (data && data.length > 0) {
      return data.map(a => ({
        ...a,
        movieTitle: a.movies?.title || 'Unknown',
        cinemaName: a.cinemas?.cinema_name || 'Unknown',
        screens: a.exhibition_authorized_screens?.map(s => s.screen_id) || []
      }));
    }
    // fallback
    const list = [];
    for (const a of memoryStore.exhibitionAuthorizations.values()) {
      if (a.movie_provider_id === providerUserId) {
        const movie = memoryStore.movies.get(a.movie_id);
        const cinema = memoryStore.cinemas.get(a.cinema_id);
        const screenIds = [];
        for (const s of memoryStore.exhibitionAuthorizedScreens.values()) {
          if (s.authorization_id === a.id) screenIds.push(s.screen_id);
        }
        list.push({ ...a, movieTitle: movie?.title || 'Unknown', cinemaName: cinema?.cinema_name || 'Unknown', screens: screenIds });
      }
    }
    return list;
  }

  static async getApprovedAuthorizationsForCinema(cinemaId) {
    const { data } = await supabaseAdmin
      .from('exhibition_authorizations')
      .select('*, movies(title), exhibition_authorized_screens(screen_id)')
      .eq('cinema_id', cinemaId)
      .eq('status', EXHIBITION_AUTHORIZATION_STATUS.APPROVED);
    if (data && data.length > 0) {
      return data.map(a => ({
        authorizationId: a.id, movieId: a.movie_id,
        movieTitle: a.movies?.title || 'Unknown',
        startDate: a.start_date, endDate: a.end_date,
        authorizedFormats: a.authorized_formats, authorizedLanguages: a.authorized_languages,
        screenIds: a.exhibition_authorized_screens?.map(s => s.screen_id) || []
      }));
    }
    // fallback
    const list = [];
    for (const a of memoryStore.exhibitionAuthorizations.values()) {
      if (a.cinema_id === cinemaId && a.status === EXHIBITION_AUTHORIZATION_STATUS.APPROVED) {
        const movie = memoryStore.movies.get(a.movie_id);
        const screenIds = [];
        for (const s of memoryStore.exhibitionAuthorizedScreens.values()) {
          if (s.authorization_id === a.id) screenIds.push(s.screen_id);
        }
        list.push({ authorizationId: a.id, movieId: a.movie_id, movieTitle: movie?.title || 'Unknown', startDate: a.start_date, endDate: a.end_date, authorizedFormats: a.authorized_formats, authorizedLanguages: a.authorized_languages, screenIds });
      }
    }
    return list;
  }
}
