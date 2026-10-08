// Universal API Client for Tixora Frontend
const BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

export function getAuthToken() {
  return localStorage.getItem('tixora_token') || null;
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('tixora_token', token);
  } else {
    localStorage.removeItem('tixora_token');
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('tixora_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) {
    localStorage.setItem('tixora_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('tixora_user');
  }
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const isMultipart = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(!isMultipart ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = `${BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const responseText = await res.text();
    let data = null;
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        const err = new Error(`API returned a non-JSON response (HTTP ${res.status})`);
        err.status = res.status;
        err.body = responseText.slice(0, 500);
        throw err;
      }
    }
    if (!responseText && !res.ok) {
      const err = new Error(`API returned an empty response (HTTP ${res.status}). Check that the backend is running.`);
      err.status = res.status;
      throw err;
    }
    if (!res.ok) {
      const errorMsg = data?.error?.message || data?.message || `HTTP Error ${res.status}`;
      const err = new Error(errorMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data?.data !== undefined ? data.data : data;
  } catch (err) {
    console.error(`[API Error] ${options.method || 'GET'} ${url}:`, err);
    throw err;
  }
}

export const authApi = {
  signup: (payload) => request('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
};

export const moviesApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/movies${query ? `?${query}` : ''}`);
  },
  getById: (id) => request(`/movies/${id}`),
  listMine: () => request('/cinema/movies'),
  create: (data) => request('/cinema/movies', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/cinema/movies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  uploadDocument: (id, file, documentType) => {
    const body = new FormData();
    body.append('document', file);
    body.append('documentType', documentType);
    return request(`/provider/movies/${id}/documents`, { method: 'POST', body });
  },
  uploadPoster: (file) => {
    const body = new FormData();
    body.append('poster', file);
    return request('/cinema/movies/upload-poster', { method: 'POST', body });
  },
  getDocuments: (id) => request(`/provider/movies/${id}/documents`),
};

export const cinemasApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))).toString();
    return request(`/cinemas${query ? `?${query}` : ''}`);
  },
  cities: (params = {}) => {
    const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))).toString();
    return request(`/cinemas/cities${query ? `?${query}` : ''}`);
  },
  getById: (id, params = {}) => {
    const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))).toString();
    return request(`/cinemas/${id}${query ? `?${query}` : ''}`);
  },
  geocode: (params = {}) => {
    const query = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))).toString();
    return request(`/location/geocode${query ? `?${query}` : ''}`);
  },
  calculateDistance: (origin, destination) => request('/location/distance', { method: 'POST', body: JSON.stringify({ origin, destination }) }),
  mine: () => request('/cinema'),
  getMyCinema: () => request('/cinema'),
  screens: () => request('/cinema/screens'),
  getScreens: () => request('/cinema/screens'),
  documents: () => request('/cinema/documents'),
  getDocuments: () => request('/cinema/documents'),
  uploadDocument: (file, documentType) => {
    const body = new FormData();
    body.append('document', file);
    body.append('documentType', documentType);
    return request('/cinema/documents', { method: 'POST', body });
  },
  submitVerification: () => request('/cinema/verification', { method: 'POST' }),
  createScreen: (data) => request('/cinema/screens', { method: 'POST', body: JSON.stringify(data) }),
  updateScreen: (id, data) => request(`/cinema/screens/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  create: (data) => request('/cinema', { method: 'POST', body: JSON.stringify(data) }),
  update: (data) => request('/cinema', { method: 'PATCH', body: JSON.stringify(data) }),
  addReview: (cinemaId, data) => request(`/cinemas/${cinemaId}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  getMyReviews: () => request('/cinemas/reviews/my'),
};

export const showsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/shows${query ? `?${query}` : ''}`);
  },
  listMy: () => request('/cinema/shows'),
  listMine: () => request('/cinema/shows'),
  authorizedMovies: () => request('/cinema/authorized-movies'),
  create: (data) => request('/cinema/shows', { method: 'POST', body: JSON.stringify(data) }),
  createDemo: (data) => request('/cinema/demo-shows', { method: 'POST', body: JSON.stringify(data) }),
  getSeatMap: (showId) => request(`/shows/${showId}/seat-map`),
  holdSeats: (showId, seatIds) => request(`/shows/${showId}/hold`, { method: 'POST', body: JSON.stringify({ seatIds }) }),
  releaseHold: (showId, holdId) => request(`/shows/${showId}/release`, { method: 'POST', body: JSON.stringify({ holdId }) }),
  joinQueue: (showId, seatId) => request(`/shows/${showId}/seats/${seatId}/queue`, { method: 'POST', body: JSON.stringify({}) }),
  getQueueStatus: (showId, seatId) => request(`/shows/${showId}/seats/${seatId}/queue`),
  cancelQueue: (requestId) => request(`/shows/queue/${requestId}`, { method: 'DELETE' }),
  cancel: (showId, reason) => request(`/cinema/shows/${showId}/cancel`, { method: 'POST', body: JSON.stringify(typeof reason === 'string' ? { reason } : (reason || {})) }),
  approve: (showId, reason) => request(`/admin/shows/${showId}/approve`, { method: 'POST', body: JSON.stringify(typeof reason === 'string' ? { reason } : (reason || {})) }),
};

export const providerApi = {
  getAuthorizations: () => request('/provider/authorizations'),
  createAuthorization: (data) => request('/provider/authorizations', { method: 'POST', body: JSON.stringify(data) }),
  submitAuthorization: (id) => request(`/provider/authorizations/${id}/submit`, { method: 'POST' }),
};

export const bookingsApi = {
  create: (payload) => request('/bookings', { method: 'POST', headers: { 'Idempotency-Key': payload.holdId }, body: JSON.stringify(payload) }),
  getMyBookings: () => request('/bookings/me'),
  getById: (bookingId) => request(`/bookings/${bookingId}`),
  cancel: (bookingId) => request(`/bookings/${bookingId}/cancel`, { method: 'POST' }),
};

export const paymentsApi = {
  create: (payload) => request('/payments', { method: 'POST', body: JSON.stringify(payload) }),
  confirm: (payload) => request('/payments/confirm', { method: 'POST', body: JSON.stringify(payload) }),
  getStatus: (paymentId) => request(`/payments/${paymentId}/status`),
};

export const adminApi = {
  getDashboard: () => request('/admin/dashboard'),
  getUsers: () => request('/admin/users'),
  getDatabase: () => request('/admin/database'),
  getCinemas: () => request('/admin/cinemas'),
  getMovies: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/movies${query ? `?${query}` : ''}`);
  },
  getPendingMovies: () => request('/admin/movies/pending'),
  approveMovie: (id, payload = {}) => request(`/admin/movies/${id}/approve`, { method: 'POST', body: JSON.stringify(typeof payload === 'string' ? { reason: payload } : payload) }),
  rejectMovie: (id, payload = {}) => request(`/admin/movies/${id}/reject`, { method: 'POST', body: JSON.stringify(typeof payload === 'string' ? { reason: payload } : payload) }),
  suspendMovie: (id, reason) => request(`/admin/movies/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getVerifications: () => request('/admin/cinema-verifications'),
  approveVerification: (id, reason) => request(`/admin/cinema-verifications/${id}/approve`, { method: 'POST', body: JSON.stringify({ reason }) }),
  rejectVerification: (id, reason) => request(`/admin/cinema-verifications/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getAuthorizations: () => request('/admin/authorizations'),
  approveAuthorization: (id, reason) => request(`/admin/authorizations/${id}/approve`, { method: 'POST', body: JSON.stringify({ reason }) }),
  rejectAuthorization: (id, reason) => request(`/admin/authorizations/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getAuditLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/audit-logs${query ? `?${query}` : ''}`);
  },
  getBookings: () => request('/admin/bookings'),
  checkInTicket: (code) => request('/admin/tickets/check-in', { method: 'POST', body: JSON.stringify({ code }) }),
  approveShow: (id, payload = {}) => request(`/admin/shows/${id}/approve`, { method: 'POST', body: JSON.stringify(typeof payload === 'string' ? { reason: payload } : payload) }),
  cancelShow: (id, payload = {}) => request(`/admin/shows/${id}/cancel`, { method: 'POST', body: JSON.stringify(typeof payload === 'string' ? { reason: payload } : payload) }),
  denyShow: (id, payload = {}) => request(`/admin/shows/${id}/deny`, { method: 'POST', body: JSON.stringify(typeof payload === 'string' ? { reason: payload } : payload) }),
};

export const seatPlansApi = {
  getByScreen: (screenId) => request(`/cinema/screens/${screenId}/seat-plan`),
  save: (screenId, layoutData) => request(`/cinema/screens/${screenId}/seat-plan`, { method: 'POST', body: JSON.stringify(layoutData) }),
  publish: (screenId, versionId) => request(`/cinema/screens/${screenId}/seat-plan/publish`, { method: 'POST', body: JSON.stringify({ versionId }) }),
};

export const notificationsApi = {
  list: () => request('/notifications'),
  markAsRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
};

