import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, memoryStore } from '../config/supabase.js';
import { AnalyticsService } from '../services/analytics.service.js';
import { AuditService } from '../services/audit.service.js';
import { ShowService } from '../services/show.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { authenticateUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roles.js';
import { CINEMA_VERIFICATION_STATUS, EXHIBITION_AUTHORIZATION_STATUS } from '../config/constants.js';
import { AppError, NotFoundError } from '../utils/errors.js';

const router = Router();

// Enforce PLATFORM_ADMIN role on all admin routes
router.use(authenticateUser, requireAdmin());

// Dashboard Metrics
router.get('/dashboard', async (req, res, next) => {
  try {
    const stats = await AnalyticsService.getAdminDashboard();
    return ApiResponse.success(res, stats);
  } catch (err) {
    next(err);
  }
});

// Users
router.get('/users', async (req, res, next) => {
  try {
    const { data: users, error } = await supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw new AppError('Could not load users', 503, 'DATABASE_UNAVAILABLE');
    return ApiResponse.success(res, users || []);
  } catch (err) { next(err); }
});

// Database overview: comprehensive movie providers and customers directory
router.get('/database', async (req, res, next) => {
  try {
    const [profilesResult, moviesResult, showsResult, cinemasResult, bookingsResult] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('movies').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('shows').select('id,movie_id,cinema_id,screen_id,show_date,start_time,end_time,language,format,status,cinemas(cinema_name,city),screens(screen_name)').order('show_date', { ascending: true }),
      supabaseAdmin.from('cinemas').select('id,owner_user_id,cinema_name,city,address,verification_status,screens(id,screen_name,capacity)').order('created_at', { ascending: false }),
      supabaseAdmin.from('bookings').select('id,booking_reference,user_id,movie_id,cinema_id,show_id,total_amount,status,created_at,movies(title),cinemas(cinema_name)').order('created_at', { ascending: false })
    ]);
    if (profilesResult.error || moviesResult.error || showsResult.error) {
      throw new AppError('Could not load database overview', 503, 'DATABASE_UNAVAILABLE');
    }
    const profiles = profilesResult.data || [];
    const movies = moviesResult.data || [];
    const shows = showsResult.data || [];
    const cinemas = cinemasResult.data || [];
    const bookings = bookingsResult.data || [];

    const providerUserIds = new Set([
      ...profiles.filter(pr => ['MOVIE_PROVIDER', 'CINEMA_OWNER', 'EXHIBITOR'].includes(pr.role)).map(pr => pr.id),
      ...movies.map(mo => mo.created_by_provider).filter(Boolean),
      ...cinemas.map(ci => ci.owner_user_id).filter(Boolean)
    ]);

    const providers = profiles
      .filter(profile => providerUserIds.has(profile.id))
      .map(profile => {
        const providerMovies = movies.filter(movie => movie.created_by_provider === profile.id).map(movie => ({
          ...movie,
          screenings: shows.filter(show => show.movie_id === movie.id)
        }));
        const providerCinemas = cinemas.filter(cinema => cinema.owner_user_id === profile.id);
        return {
          ...profile,
          role: profile.role || 'MOVIE_PROVIDER',
          movies: providerMovies,
          cinemas: providerCinemas,
          totalMovies: providerMovies.length,
          activeMovies: providerMovies.filter(m => m.status === 'ACTIVE').length,
          pendingMovies: providerMovies.filter(m => m.status === 'PENDING_REVIEW').length,
          totalCinemas: providerCinemas.length
        };
      });

    const customers = profiles
      .filter(profile => profile.role === 'CUSTOMER' || (!providerUserIds.has(profile.id) && profile.role !== 'PLATFORM_ADMIN'))
      .map(profile => {
        const userBookings = bookings.filter(b => b.user_id === profile.id);
        const totalSpend = userBookings.filter(b => b.status === 'CONFIRMED').reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
        return {
          ...profile,
          role: 'CUSTOMER',
          bookings: userBookings,
          totalBookings: userBookings.length,
          confirmedBookings: userBookings.filter(b => b.status === 'CONFIRMED').length,
          totalSpend,
          lastActive: userBookings[0]?.created_at || profile.updated_at || profile.created_at
        };
      });

    return ApiResponse.success(res, { providers, customers, users: customers });
  } catch (err) { next(err); }
});

// Cinemas
router.get('/cinemas', async (req, res, next) => {
  try {
    const { data: cinemas, error } = await supabaseAdmin.from('cinemas').select('*, screens(*)').order('created_at', { ascending: false });
    if (error) throw new AppError('Could not load cinemas', 503, 'DATABASE_UNAVAILABLE');
    const ids = (cinemas || []).map(c => c.id);
    const { data: docs, error: docsError } = ids.length ? await supabaseAdmin.from('cinema_documents').select('*').in('cinema_id', ids) : { data: [], error: null };
    if (docsError) throw new AppError('Could not load cinema documents', 503, 'DATABASE_UNAVAILABLE');
    const links = await Promise.all((docs || []).map(async doc => {
      const { data } = await supabaseAdmin.storage.from('private-cinema-documents').createSignedUrl(doc.storage_path, 300);
      return { ...doc, review_url: data?.signedUrl || null };
    }));
    return ApiResponse.success(res, (cinemas || []).map(c => ({ ...c, documents: links.filter(doc => doc.cinema_id === c.id) })));
  } catch (err) { next(err); }
});

router.get('/movies', async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = supabaseAdmin.from('movies').select('*, movie_documents(*)').order('created_at', { ascending: false });
    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) throw new AppError('Could not load films', 503, 'DATABASE_UNAVAILABLE');

    const ids = [...new Set((data || []).map(movie => movie.created_by_provider).filter(Boolean))];
    const { data: profiles, error: profileError } = ids.length
      ? await supabaseAdmin.from('profiles').select('id,full_name,email,role,organization_name').in('id', ids)
      : { data: [], error: null };
    if (profileError) throw new AppError('Could not load film providers', 503, 'DATABASE_UNAVAILABLE');

    const moviesWithLinks = await Promise.all((data || []).map(async movie => ({
      ...movie,
      provider: (profiles || []).find(profile => profile.id === movie.created_by_provider) || null,
      movie_documents: await Promise.all((movie.movie_documents || []).map(async document => {
        const { data: signed } = await supabaseAdmin.storage.from('private-provider-documents').createSignedUrl(document.storage_path, 3600);
        return { ...document, review_url: signed?.signedUrl || null };
      }))
    })));
    return ApiResponse.success(res, moviesWithLinks);
  } catch (err) { next(err); }
});

router.get('/movies/pending', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('movies').select('*, movie_documents(*)').eq('status', 'PENDING_REVIEW').order('created_at', { ascending: true });
    if (error) throw new AppError('Could not load films awaiting review', 503, 'DATABASE_UNAVAILABLE');
    const ids = [...new Set((data || []).map(movie => movie.created_by_provider).filter(Boolean))];
    const { data: profiles, error: profileError } = ids.length ? await supabaseAdmin.from('profiles').select('id,full_name,email,role,organization_name').in('id', ids) : { data: [], error: null };
    if (profileError) throw new AppError('Could not load film providers', 503, 'DATABASE_UNAVAILABLE');
    const moviesWithLinks = await Promise.all((data || []).map(async movie => ({
      ...movie,
      provider: (profiles || []).find(profile => profile.id === movie.created_by_provider) || null,
      movie_documents: await Promise.all((movie.movie_documents || []).map(async document => {
        const { data: signed } = await supabaseAdmin.storage.from('private-provider-documents').createSignedUrl(document.storage_path, 3600);
        return { ...document, review_url: signed?.signedUrl || null };
      }))
    })));
    return ApiResponse.success(res, moviesWithLinks);
  } catch (err) { next(err); }
});

async function reviewMovie(req, res, next, approved) {
  try {
    const { data: movie, error } = await supabaseAdmin.from('movies').select('*').eq('id', req.params.id).single();
    if (error || !movie) throw new NotFoundError('Film not found');
    let documentsForReview = [];

    if (approved) {
      const { data: documents, error: documentsError } = await supabaseAdmin.from('movie_documents').select('id, document_type, status, review_notes, reviewed_by, updated_at').eq('movie_id', movie.id);
      if (documentsError) throw new AppError('Could not verify film certificates', 503, 'DATABASE_UNAVAILABLE');
      documentsForReview = documents || [];
      const types = new Set((documents || []).map(document => document.document_type));

      if (!req.body.bypassDocumentCheck) {
        if (!types.has('CBFC_CERTIFICATE') && !movie.cbfc_certificate_number) {
          throw new AppError('Film authorization requires CBFC certification credentials.', 409, 'MISSING_CBFC_DOCUMENT');
        }
      }

    } else {
      const { data: documents, error: documentsError } = await supabaseAdmin.from('movie_documents').select('id, document_type, status, review_notes, reviewed_by, updated_at').eq('movie_id', movie.id);
      if (documentsError) throw new AppError('Could not load film documents for review', 503, 'DATABASE_UNAVAILABLE');
      documentsForReview = documents || [];
    }

    const now = new Date().toISOString();
    const { error: documentReviewError } = await supabaseAdmin.from('movie_documents')
      .update({
        status: approved ? 'VERIFIED' : 'REJECTED',
        reviewed_by: req.user.id,
        ...(approved ? {} : { review_notes: req.body.reason || 'Rejected by platform admin' }),
        updated_at: now
      })
      .eq('movie_id', movie.id);
    if (documentReviewError) throw new AppError('Could not save film document review', 503, 'DATABASE_WRITE_FAILED');

    const status = approved ? 'ACTIVE' : 'SUSPENDED';
    const { data, error: updateError } = await supabaseAdmin.from('movies').update({ status, updated_at: now }).eq('id', movie.id).select('*').single();
    if (updateError) {
      const restoreResults = await Promise.all(documentsForReview.map(document => supabaseAdmin.from('movie_documents')
        .update({ status: document.status, review_notes: document.review_notes, reviewed_by: document.reviewed_by, updated_at: document.updated_at })
        .eq('id', document.id)));
      if (restoreResults.some(result => result.error)) console.error('Could not restore film document statuses after a failed film review.');
      throw new AppError('Could not update film status', 503, 'DATABASE_WRITE_FAILED');
    }

    if (!approved) {
      await supabaseAdmin.from('shows').update({ status: 'CANCELLED', updated_at: now }).eq('movie_id', movie.id);
      for (const [id, s] of memoryStore.shows) {
        if (s.movie_id === movie.id) s.status = 'CANCELLED';
      }
    }
    await AuditService.log({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: approved ? 'MOVIE_APPROVED' : 'MOVIE_REJECTED',
      entityType: 'MOVIE',
      entityId: movie.id,
      previousValue: { status: movie.status },
      newValue: { status },
      reason: req.body.reason || null
    });
    return ApiResponse.success(res, data, approved ? 'Film approved and authorized for public release' : 'Film rejected');
  } catch (err) { next(err); }
}
router.post('/movies/:id/approve', (req, res, next) => reviewMovie(req, res, next, true));
router.post('/movies/:id/reject', (req, res, next) => reviewMovie(req, res, next, false));
router.post('/movies/:id/suspend', async (req, res, next) => {
  try {
    const { data: movie, error } = await supabaseAdmin.from('movies').select('*').eq('id', req.params.id).single();
    if (error || !movie) throw new NotFoundError('Film not found');
    const now = new Date().toISOString();
    const { data, error: updateError } = await supabaseAdmin.from('movies').update({ status: 'SUSPENDED', updated_at: now }).eq('id', movie.id).select('*').single();
    if (updateError) throw new AppError('Could not suspend film', 503, 'DATABASE_UNAVAILABLE');
    await supabaseAdmin.from('shows').update({ status: 'CANCELLED', updated_at: now }).eq('movie_id', movie.id);
    for (const [id, s] of memoryStore.shows) {
      if (s.movie_id === movie.id) s.status = 'CANCELLED';
    }
    await AuditService.log({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'MOVIE_SUSPENDED',
      entityType: 'MOVIE',
      entityId: movie.id,
      previousValue: { status: movie.status },
      newValue: { status: 'SUSPENDED' },
      reason: req.body.reason || 'Suspended by platform administrator'
    });
    return ApiResponse.success(res, data, 'Film exhibition rights suspended');
  } catch (err) { next(err); }
});

// Cinema Verifications
router.get('/cinema-verifications', async (req, res, next) => {
  try {
    const { data: verifications, error } = await supabaseAdmin
      .from('cinema_verifications')
      .select('*, cinemas(id, cinema_name, city)')
      .order('submitted_at', { ascending: false });
    if (error) throw new AppError('Could not load cinema verifications', 503, 'DATABASE_UNAVAILABLE');
    const cinemaIds = [...new Set((verifications || []).map(v => v.cinema_id))];
    const { data: documents, error: documentsError } = cinemaIds.length
      ? await supabaseAdmin.from('cinema_documents').select('*').in('cinema_id', cinemaIds)
      : { data: [], error: null };
    if (documentsError) throw new AppError('Could not load verification documents', 503, 'DATABASE_UNAVAILABLE');
    const withLinks = await Promise.all((documents || []).map(async document => {
      const { data: signed } = await supabaseAdmin.storage.from('private-cinema-documents').createSignedUrl(document.storage_path, 300);
      return { ...document, review_url: signed?.signedUrl || null };
    }));
    return ApiResponse.success(res, (verifications || []).map(v => ({
      ...v,
      cinemaName: v.cinemas?.cinema_name || '',
      city: v.cinemas?.city || '',
      documents: withLinks.filter(d => d.cinema_id === v.cinema_id)
    })));
  } catch (err) { next(err); }
});

async function reviewCinemaVerification(req, res, next, status) {
  try {
    let { data: verification } = await supabaseAdmin
      .from('cinema_verifications')
      .select('*')
      .or(`id.eq.${req.params.id},cinema_id.eq.${req.params.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const cinemaId = verification ? verification.cinema_id : req.params.id;
    const { data: cinema, error: cinemaLookupError } = await supabaseAdmin
      .from('cinemas').select('*').eq('id', cinemaId).single();
    if (cinemaLookupError || !cinema) throw new NotFoundError('Cinema not found');

    const now = new Date().toISOString();
    const reason = req.body.reason || (status === CINEMA_VERIFICATION_STATUS.VERIFIED
      ? 'Verification documents validated by platform admin'
      : 'Insufficient legal credentials');

    const { data: cinemaDocuments, error: documentsError } = await supabaseAdmin
      .from('cinema_documents').select('id, document_type, status, reviewed_by, updated_at').eq('cinema_id', cinema.id);
    if (documentsError) throw new AppError('Could not load cinema documents for review', 503, 'DATABASE_UNAVAILABLE');
    if (status === CINEMA_VERIFICATION_STATUS.VERIFIED) {
      const documentTypes = new Set((cinemaDocuments || []).map(document => document.document_type));
      if (!documentTypes.has('CINEMA_LICENCE') || !documentTypes.has('FIRE_SAFETY')) {
        throw new AppError('Cinema approval requires both a cinema licence and fire safety document.', 409, 'MISSING_CINEMA_DOCUMENTS');
      }
    }

    const { error: documentReviewError } = await supabaseAdmin.from('cinema_documents')
      .update({ status: status === CINEMA_VERIFICATION_STATUS.VERIFIED ? 'VERIFIED' : 'REJECTED', reviewed_by: req.user.id, updated_at: now })
      .eq('cinema_id', cinema.id);
    if (documentReviewError) throw new AppError('Could not save cinema document review', 503, 'DATABASE_WRITE_FAILED');

    let updatedVerification = null;
    if (verification) {
      const { data: uv, error: verificationError } = await supabaseAdmin
        .from('cinema_verifications')
        .update({ status, reviewed_at: now, reviewed_by: req.user.id, review_reason: status === CINEMA_VERIFICATION_STATUS.REJECTED ? reason : null, updated_at: now })
        .eq('id', verification.id).select('*').single();
      if (verificationError) {
        await Promise.all((cinemaDocuments || []).map(document => supabaseAdmin.from('cinema_documents')
          .update({ status: document.status, reviewed_by: document.reviewed_by, updated_at: document.updated_at }).eq('id', document.id)));
        throw new AppError('Could not save the verification review', 503, 'DATABASE_UNAVAILABLE');
      }
      updatedVerification = uv;
    } else {
      const { data: nv, error: verificationError } = await supabaseAdmin
        .from('cinema_verifications')
        .insert({ id: uuidv4(), cinema_id: cinema.id, status, reviewed_at: now, reviewed_by: req.user.id, review_reason: reason })
        .select('*').single();
      if (verificationError) {
        await Promise.all((cinemaDocuments || []).map(document => supabaseAdmin.from('cinema_documents')
          .update({ status: document.status, reviewed_by: document.reviewed_by, updated_at: document.updated_at }).eq('id', document.id)));
        throw new AppError('Could not save the verification review', 503, 'DATABASE_UNAVAILABLE');
      }
      updatedVerification = nv;
    }

    const { data: updatedCinema, error: updateError } = await supabaseAdmin
      .from('cinemas')
      .update({ verification_status: status, updated_at: now })
      .eq('id', cinema.id).select('*').single();
    if (updateError) {
      await Promise.all((cinemaDocuments || []).map(document => supabaseAdmin.from('cinema_documents')
        .update({ status: document.status, reviewed_by: document.reviewed_by, updated_at: document.updated_at }).eq('id', document.id)));
      if (verification) {
        await supabaseAdmin.from('cinema_verifications').update({
          status: verification.status, reviewed_at: verification.reviewed_at,
          reviewed_by: verification.reviewed_by, review_reason: verification.review_reason
        }).eq('id', verification.id);
      } else if (updatedVerification?.id) {
        await supabaseAdmin.from('cinema_verifications').delete().eq('id', updatedVerification.id);
      }
      throw new AppError('Could not save cinema verification status', 503, 'DATABASE_WRITE_FAILED');
    }

    if (status !== CINEMA_VERIFICATION_STATUS.VERIFIED) {
      await supabaseAdmin.from('cinemas').update({ is_active: false, updated_at: now }).eq('id', cinema.id);
      await supabaseAdmin.from('shows').update({ status: 'CANCELLED', updated_at: now }).eq('cinema_id', cinema.id);
      for (const [id, s] of memoryStore.shows) {
        if (s.cinema_id === cinema.id) s.status = 'CANCELLED';
      }
    }

    await AuditService.log({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: status === CINEMA_VERIFICATION_STATUS.VERIFIED ? 'CINEMA_VERIFIED' : 'CINEMA_REJECTED',
      entityType: 'CINEMA',
      entityId: cinema.id,
      previousValue: { status: cinema.verification_status },
      newValue: { status },
      reason
    });
    return ApiResponse.success(res, { verification: updatedVerification, cinema: updatedCinema }, 'Cinema verification reviewed');
  } catch (err) { next(err); }
}

router.post('/cinema-verifications/:id/approve', (req, res, next) => reviewCinemaVerification(req, res, next, CINEMA_VERIFICATION_STATUS.VERIFIED));
router.post('/cinema-verifications/:id/reject', (req, res, next) => reviewCinemaVerification(req, res, next, CINEMA_VERIFICATION_STATUS.REJECTED));
router.post('/cinemas/:id/suspend', (req, res, next) => reviewCinemaVerification(req, res, next, CINEMA_VERIFICATION_STATUS.REJECTED));
router.post('/cinemas/:id/revoke', (req, res, next) => reviewCinemaVerification(req, res, next, CINEMA_VERIFICATION_STATUS.REJECTED));

// Exhibition Authorizations (includes CBFC Certificate and legal clearance documents)
router.get('/authorizations', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('exhibition_authorizations')
      .select('*, movies(id, title, cbfc_certification, cbfc_certificate_number, cbfc_certificate_date), cinemas(cinema_name), exhibition_authorized_screens(screen_id)')
      .order('created_at', { ascending: false });
    if (error) throw new AppError('Could not load exhibition authorizations', 503, 'DATABASE_UNAVAILABLE');

    const movieIds = [...new Set((data || []).map(a => a.movie_id).filter(Boolean))];
    const { data: docs } = movieIds.length
      ? await supabaseAdmin.from('movie_documents').select('*').in('movie_id', movieIds).eq('document_type', 'CBFC_CERTIFICATE')
      : { data: [] };

    const docsWithSigned = await Promise.all((docs || []).map(async doc => {
      const { data: signed } = await supabaseAdmin.storage.from('private-provider-documents').createSignedUrl(doc.storage_path, 3600);
      return { ...doc, review_url: signed?.signedUrl || null };
    }));

    return ApiResponse.success(res, (data || []).map(a => {
      const cbfcDoc = (docsWithSigned || []).find(d => d.movie_id === a.movie_id);
      return {
        ...a,
        movieTitle: a.movies?.title || '',
        cinemaName: a.cinemas?.cinema_name || '',
        cbfcCertification: a.movies?.cbfc_certification || 'UA',
        cbfcCertificateNumber: a.movies?.cbfc_certificate_number || null,
        cbfcCertificateDate: a.movies?.cbfc_certificate_date || null,
        cbfcDocument: cbfcDoc || null,
        authorizedScreenCount: a.exhibition_authorized_screens?.length || 0
      };
    }));
  } catch (err) { next(err); }
});

async function reviewAuthorization(req, res, next, status) {
  try {
    const { data: authorization, error: lookupError } = await supabaseAdmin
      .from('exhibition_authorizations').select('*').eq('id', req.params.id).single();
    if (lookupError || !authorization) throw new NotFoundError('Authorization not found');
    const now = new Date().toISOString();
    const reason = req.body.reason || (status === EXHIBITION_AUTHORIZATION_STATUS.APPROVED
      ? 'Required exhibition agreements verified'
      : 'Distribution rights criteria not met');
    const { data, error } = await supabaseAdmin.from('exhibition_authorizations').update({
      status,
      reviewed_at: now,
      reviewed_by: req.user.id,
      review_reason: status === EXHIBITION_AUTHORIZATION_STATUS.REJECTED ? reason : null,
      updated_at: now
    }).eq('id', authorization.id).select('*').single();
    if (error) throw new AppError('Could not save the authorization review', 503, 'DATABASE_UNAVAILABLE');

    if (status === EXHIBITION_AUTHORIZATION_STATUS.REJECTED) {
      await supabaseAdmin.from('shows').update({ status: 'CANCELLED', updated_at: now }).eq('authorization_id', authorization.id);
      for (const [id, s] of memoryStore.shows) {
        if (s.authorization_id === authorization.id) s.status = 'CANCELLED';
      }
    }

    await AuditService.log({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: status === EXHIBITION_AUTHORIZATION_STATUS.APPROVED ? 'AUTHORIZATION_APPROVED' : 'AUTHORIZATION_REJECTED',
      entityType: 'EXHIBITION_AUTHORIZATION',
      entityId: authorization.id,
      previousValue: { status: authorization.status },
      newValue: { status },
      reason
    });
    return ApiResponse.success(res, data, 'Exhibition authorization reviewed');
  } catch (err) { next(err); }
}

router.post('/authorizations/:id/approve', (req, res, next) => reviewAuthorization(req, res, next, EXHIBITION_AUTHORIZATION_STATUS.APPROVED));
router.post('/authorizations/:id/reject', (req, res, next) => reviewAuthorization(req, res, next, EXHIBITION_AUTHORIZATION_STATUS.REJECTED));

// Audit Logs
router.get('/audit-logs', async (req, res) => {
  const logs = await AuditService.getLogs({
    entityType: req.query.entityType,
    entityId: req.query.entityId,
    limit: req.query.limit ? Number(req.query.limit) : 50
  });
  return ApiResponse.success(res, logs);
});

router.get('/bookings', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('bookings')
      .select('*, movies(title), cinemas(cinema_name), screens(screen_name), shows(show_date, start_time), profiles(full_name), booking_seats(seat_label), tickets(ticket_number, security_code, status)')
      .order('created_at', { ascending: false });
    if (error) throw new AppError('Could not load bookings', 503, 'DATABASE_UNAVAILABLE');
    return ApiResponse.success(res, data || []);
  } catch (err) { next(err); }
});

router.post('/tickets/check-in', async (req, res, next) => {
  try {
    let code = String(req.body.code || '').trim();
    if (!code) throw new AppError('Ticket code is required', 400, 'VALIDATION_ERROR');
    // QR codes contain a small JSON payload; accept that decoded payload too.
    try {
      const qrPayload = JSON.parse(code);
      code = String(qrPayload.ticketNumber || qrPayload.securityCode || '').trim().toUpperCase();
    } catch { code = code.toUpperCase(); /* Plain ticket number/security code */ }
    if (!code) throw new AppError('QR code does not contain a valid ticket reference', 400, 'VALIDATION_ERROR');
    const { data: ticket, error: lookupError } = await supabaseAdmin.from('tickets')
      .select('id, ticket_number, security_code, status, booking_id, bookings(status)')
      .eq('ticket_number', code).maybeSingle();
    if (lookupError) throw new AppError('Could not verify ticket', 503, 'DATABASE_UNAVAILABLE');
    let matchedTicket = ticket;
    if (!matchedTicket) {
      const { data: bySecurityCode, error: securityLookupError } = await supabaseAdmin.from('tickets')
        .select('id, ticket_number, security_code, status, booking_id, bookings(status)')
        .eq('security_code', code).maybeSingle();
      if (securityLookupError) throw new AppError('Could not verify ticket', 503, 'DATABASE_UNAVAILABLE');
      matchedTicket = bySecurityCode;
    }
    if (!matchedTicket || matchedTicket.bookings?.status !== 'CONFIRMED') throw new NotFoundError('Valid confirmed ticket not found');
    if (matchedTicket.status !== 'VALID') throw new AppError('Ticket has already been used or cancelled', 409, 'TICKET_NOT_VALID');
    const { data, error } = await supabaseAdmin.from('tickets').update({ status: 'USED', checked_in_at: new Date().toISOString(), checked_in_by: req.user.id, updated_at: new Date().toISOString() })
      .eq('id', matchedTicket.id).eq('status', 'VALID').select('*').maybeSingle();
    if (error) throw new AppError('Could not record check-in', 503, 'DATABASE_UNAVAILABLE');
    if (!data) throw new AppError('Ticket was checked in by another scanner', 409, 'TICKET_NOT_VALID');
    return ApiResponse.success(res, data, 'Ticket checked in');
  } catch (err) { next(err); }
});

// Admin Live Reservation & Queue Monitor (Section 148)
router.get('/reservations', async (req, res, next) => {
  try {
    const activeHolds = [];
    const waitingQueues = [];

    const now = Date.now();
    const [{ data: seats, error: seatsError }, { data: queues, error: queuesError }] = await Promise.all([
      supabaseAdmin.from('show_seats').select('id, seat_label, show_id, hold_id, hold_user_id, held_until, status, shows(show_date, start_time)').eq('status', 'HELD'),
      supabaseAdmin.from('seat_queue_requests').select('request_id, show_id, show_seat_id, user_id, queue_position, joined_at, status').eq('status', 'WAITING').order('queue_position')
    ]);
    if (seatsError || queuesError) throw new AppError('Could not load live reservations', 503, 'DATABASE_UNAVAILABLE');
    for (const s of seats || []) {
      if (s.status === 'HELD' && (!s.held_until || new Date(s.held_until).getTime() > now)) {
        const remainingSec = s.held_until ? Math.max(0, Math.round((new Date(s.held_until).getTime() - now) / 1000)) : 0;
        activeHolds.push({
          showSeatId: s.id,
          seatLabel: s.seat_label,
          showId: s.show_id,
          showDate: s.shows?.show_date || '',
          showTime: s.shows?.start_time || '',
          userId: s.hold_user_id,
          holdId: s.hold_id,
          remainingSeconds: remainingSec,
          heldUntil: s.held_until
        });
      }
    }

    for (const q of queues || []) {
      {
        waitingQueues.push({
          requestId: q.request_id,
          seatLabel: seats?.find(s => s.id === q.show_seat_id)?.seat_label || '',
          showId: q.show_id,
          userId: q.user_id,
          queuePosition: q.queue_position,
          joinedAt: q.joined_at
        });
      }
    }

    return ApiResponse.success(res, {
      activeHoldsCount: activeHolds.length,
      activeHolds,
      waitingQueuesCount: waitingQueues.length,
      waitingQueues
    });
  } catch (err) { next(err); }
});

// --- SHOW MODERATION: APPROVE / DENY / CANCEL SHOWS ---
router.post('/shows/:id/approve', async (req, res, next) => {
  try {
    const reason = req.body?.reason || 'Approved by platform administrator';
    const result = await ShowService.approveShow(req.params.id, req.user.id, reason);
    await AuditService.log({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'SHOW_APPROVED',
      entityType: 'SHOW',
      entityId: req.params.id,
      previousValue: null,
      newValue: { status: 'PUBLISHED' },
      reason
    });
    return ApiResponse.success(res, result, 'Show approved and marked On Sale');
  } catch (err) { next(err); }
});

router.post('/shows/:id/cancel', async (req, res, next) => {
  try {
    const reason = req.body?.reason || 'Cancelled by platform administrator due to screen or schedule conflict';
    const result = await ShowService.cancelShow(req.params.id, req.user.id, reason, true);
    await AuditService.log({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'SHOW_CANCELLED',
      entityType: 'SHOW',
      entityId: req.params.id,
      previousValue: null,
      newValue: { status: 'CANCELLED' },
      reason
    });
    return ApiResponse.success(res, result, 'Show cancelled successfully');
  } catch (err) { next(err); }
});

router.post('/shows/:id/deny', async (req, res, next) => {
  try {
    const reason = req.body?.reason || 'Denied by platform administrator';
    const result = await ShowService.cancelShow(req.params.id, req.user.id, reason, true);
    await AuditService.log({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'SHOW_DENIED',
      entityType: 'SHOW',
      entityId: req.params.id,
      previousValue: null,
      newValue: { status: 'CANCELLED' },
      reason
    });
    return ApiResponse.success(res, result, 'Show denied and unscheduled');
  } catch (err) { next(err); }
});

export default router;
