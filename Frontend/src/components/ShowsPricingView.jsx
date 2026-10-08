import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Plus, TrendingUp, DollarSign, Users, X, AlertTriangle, RefreshCw, LayoutGrid,
  Ban, CheckCircle2, Search, Filter, Check
} from 'lucide-react';
import { moviesApi, cinemasApi, showsApi, seatPlansApi, providerApi } from '../api.js';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString()}`;
};

const fmt12h = (t) => {
  if (!t) return '—';
  const str = String(t);
  if (/AM|PM/i.test(str)) return str; // already formatted
  const [h, m] = str.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${(m || 0).toString().padStart(2, '0')} ${ampm}`;
};

const STATUS_STYLE = {
  ON_SALE:    'bg-[#4edea3]/15 text-[#4edea3] border-[#4edea3]/40',
  PUBLISHED:  'bg-[#4edea3]/15 text-[#4edea3] border-[#4edea3]/40',
  HIGH_DEMAND:'bg-[#fbbf24]/15 text-[#fbbf24] border-[#fbbf24]/40',
  PRIME_SURGE:'bg-[#f97316]/15 text-[#f97316] border-[#f97316]/40',
  SOLD_OUT:   'bg-[#f87171]/15 text-[#f87171] border-[#f87171]/40',
  CANCELLED:  'bg-[#64748b]/15 text-[#64748b] border-[#64748b]/40',
  DRAFT:      'bg-[#94a3b8]/15 text-[#94a3b8] border-[#94a3b8]/30',
};

// ── Add Show Form ──────────────────────────────────────────────────────────────
function AddShowForm({ myMovies, cinemas, onAdd, onClose }) {
  const [cinemaId, setCinemaId] = useState(cinemas[0]?.id || '');
  const [screenId, setScreenId] = useState('');
  const [movieId, setMovieId] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('21:30');
  const [format, setFormat] = useState('2D');
  const [language, setLanguage] = useState('Hindi');
  const [priceTiers, setPriceTiers] = useState([]);
  const [seatCount, setSeatCount] = useState(0);
  const [categorySeatCounts, setCategorySeatCounts] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const selectedCinema = cinemas.find(c => c.id === cinemaId);
  const selectedMovie = myMovies.find(movie => movie.id === movieId);
  const screens = (selectedCinema?.screens || []).filter(screen =>
    !selectedMovie?.screenIds?.length || selectedMovie.screenIds.includes(screen.id)
  );

  useEffect(() => {
    if (screens.length > 0 && !screens.some(screen => screen.id === screenId)) setScreenId(screens[0].id);
  }, [cinemaId, screens]);

  useEffect(() => {
    let cancelled = false;
    setPriceTiers([]);
    setSeatCount(0);
    setCategorySeatCounts({});
    if (!screenId) return undefined;
    seatPlansApi.getByScreen(screenId).then(plan => {
      if (cancelled) return;
      const categories = (plan.categories || []).filter(category => category.is_active !== false);
      const seats = plan.seats || [];
      setSeatCount(seats.length);
      setCategorySeatCounts(seats.reduce((counts, seat) => {
        const categoryName = seat.categoryName || 'Standard';
        counts[categoryName] = (counts[categoryName] || 0) + 1;
        return counts;
      }, {}));
      setPriceTiers(categories.map(category => ({
        tierName: category.display_name || category.name,
        price: Number(category.base_price || 0),
      })));
    }).catch(err => {
      if (!cancelled) setError(err.message || 'Could not load this screen seat plan.');
    });
    return () => { cancelled = true; };
  }, [screenId]);

  const updateTier = (i, field, val) =>
    setPriceTiers(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));
  const estimatedTicketSales = priceTiers.reduce((sum, tier) =>
    sum + (categorySeatCounts[tier.tierName] || 0) * Number(tier.price || 0), 0);

  const to24 = (t) => {
    if (/^\d{2}:\d{2}/.test(t)) return t.length === 5 ? `${t}:00` : t;
    const m = String(t).match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return '19:00:00';
    let h = parseInt(m[1], 10);
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m[2]}:00`;
  };

  const selectMovie = (nextMovieId) => {
    setMovieId(nextMovieId);
    const movie = myMovies.find(item => item.id === nextMovieId);
    const release = movie?.releaseDate || movie?.release_date;
    const today = new Date();
    const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (release && release >= todayLocal) setDate(release);
    if (movie?.formats?.length) setFormat(movie.formats[0]);
    if (movie?.languages?.length) setLanguage(movie.languages[0]);
    const suggestedTime = movie?.defaultStartTime || movie?.default_start_time;
    const start = String(suggestedTime || startTime).slice(0, 5);
    setStartTime(start);
    const durationText = String(movie?.duration || '');
    const hours = Number(durationText.match(/(\d+)\s*h/i)?.[1] || 0);
    const minutes = Number(durationText.match(/(\d+)\s*m/i)?.[1] || 0);
    const duration = Number(movie?.durationMinutes) || (hours * 60 + minutes) || 150;
    const [startHour, startMinute] = start.split(':').map(Number);
    const endTotalMinutes = (startHour * 60 + startMinute + duration + 15) % (24 * 60);
    setEndTime(`${String(Math.floor(endTotalMinutes / 60)).padStart(2, '0')}:${String(endTotalMinutes % 60).padStart(2, '0')}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cinemaId || !screenId || !movieId || !priceTiers.length) {
      setError('Please select a cinema, screen and movie.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        movieId,
        cinemaId,
        screenId,
        authorizationId: selectedMovie?.authorizationId,
        showDate: date,
        startTime: to24(startTime),
        endTime: to24(endTime),
        language,
        format,
        priceTiers: priceTiers.filter(t => t.tierName && Number.isFinite(Number(t.price)) && t.price >= 0),
      };
      await showsApi.create(payload);
      await onAdd();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to schedule show. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'bg-[#0d0e12] border border-[#232938] rounded-xl px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-[#03b5d3] transition-colors cursor-pointer w-full';

  return (
    <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-[#12151e] border border-[#03b5d3]/40 shadow-[0_0_40px_rgba(3,181,211,0.12)] flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#03b5d3]" />
          Schedule New Show
        </h3>
        <button type="button" onClick={onClose}
          className="p-1.5 rounded-lg bg-[#232938] text-[#64748b] hover:text-white transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#f87171]/10 border border-[#f87171]/40 text-[#f87171] text-xs font-mono">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Row 1: Cinema + Screen + Movie */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8] uppercase text-[10px]">Cinema / Venue</label>
          <select value={cinemaId} onChange={e => { setCinemaId(e.target.value); setScreenId(''); }} className={inputCls}>
            {cinemas.length === 0 ? (
              <option value="" className="bg-[#12151e]">No cinemas available</option>
            ) : cinemas.map(c => (
              <option key={c.id} value={c.id} className="bg-[#12151e]">
                {c.cinema_name || c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8] uppercase text-[10px]">Screen</label>
          <select value={screenId} onChange={e => setScreenId(e.target.value)} className={inputCls}>
            {screens.length === 0 ? (
              <option value="" className="bg-[#12151e]">No screens</option>
            ) : screens.map(scr => (
              <option key={scr.id} value={scr.id} className="bg-[#12151e]">
                {scr.screenName || scr.screen_name || scr.name} ({scr.capacity} seats)
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8] uppercase text-[10px]">Your Movie</label>
          <select required value={movieId} onChange={e => selectMovie(e.target.value)} className={inputCls}>
            <option value="" className="bg-[#12151e]">Select movie...</option>
            {myMovies.map(m => (
              <option key={m.id} value={m.id} className="bg-[#12151e]">{m.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-[11px] font-mono text-[#94a3b8]">
        Published layout: <span className="text-white">{seatCount} seats</span>. Seat count and category names come from this hall’s saved layout.
      </div>

      {/* Row 2: Date + Start + End + Format + Language */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-mono">
        <div className="flex flex-col gap-1.5 md:col-span-1">
          <label className="text-[#94a3b8] uppercase text-[10px]">Movie Date</label>
          <input required type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8] uppercase text-[10px]">Movie Start Time</label>
          <input required type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8] uppercase text-[10px]">End Time</label>
          <input required type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8] uppercase text-[10px]">Format</label>
          <select value={format} onChange={e => setFormat(e.target.value)} className={inputCls}>
            {(selectedMovie?.formats?.length ? selectedMovie.formats : ['2D', '3D', 'IMAX', 'IMAX 3D', '4DX', 'Dolby']).map(f => (
              <option key={f} value={f} className="bg-[#12151e]">{f}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8] uppercase text-[10px]">Language</label>
          <select value={language} onChange={e => setLanguage(e.target.value)} className={inputCls}>
            {(selectedMovie?.languages?.length ? selectedMovie.languages : ['Hindi', 'English', 'Telugu', 'Tamil', 'Malayalam', 'Kannada']).map(l => (
              <option key={l} value={l} className="bg-[#12151e]">{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pricing Tiers */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-[#94a3b8] uppercase text-[10px] font-mono tracking-wider">
            Ticket Prices by Hall Seat Category
          </label>
        </div>
        {priceTiers.length === 0 ? (
          <div className="p-3 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/30 text-xs text-[#fbbf24] font-mono">
            Select a screen with a published seat layout to set ticket prices.
          </div>
        ) : priceTiers.map((tier, i) => (
          <div key={tier.tierName} className="flex items-center gap-3 p-3 rounded-xl bg-[#0d0e12] border border-[#232938]">
            <span className="text-xs font-mono font-bold text-white flex-1">{tier.tierName}</span>
            <span className="text-[10px] font-mono text-[#94a3b8]">{categorySeatCounts[tier.tierName] || 0} seats</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[#4edea3] text-xs font-mono font-bold">₹</span>
              <input
                type="number" min="0" value={tier.price}
                onChange={e => updateTier(i, 'price', Number(e.target.value))}
                className="w-24 bg-[#12151e] border border-[#232938] rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#03b5d3] transition-colors"
              />
            </div>
          </div>
        ))}
        {seatCount > 0 && <p className="text-[11px] font-mono text-[#4edea3]">Maximum ticket sales at these prices: {fmt(estimatedTicketSales)}</p>}
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-[#232938]">
        <button type="submit" disabled={submitting || !movieId || !cinemaId || !screenId}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#03b5d3] to-[#0ea5e9] text-[#001f26] font-bold text-xs font-mono shadow-[0_0_20px_rgba(3,181,211,0.35)] hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
          {submitting ? 'Scheduling...' : 'Publish Show to Schedule'}
        </button>
        <button type="button" onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-[#181c26] text-[#94a3b8] hover:text-white font-bold text-xs font-mono border border-[#232938] transition-colors cursor-pointer">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ExhibitionAuthorizationForm({ movies, cinema, screens, onSubmitted, onClose }) {
  const [movieId, setMovieId] = useState(movies[0]?.id || '');
  const [screenId, setScreenId] = useState(screens[0]?.id || '');
  const movie = movies.find(item => item.id === movieId);
  const screen = screens.find(item => item.id === screenId);
  const formats = screen?.supported_formats || screen?.supportedFormats || [];
  const languages = movie?.languages || [];
  const release = movie?.releaseDate || movie?.release_date || '';
  const [startDate, setStartDate] = useState(release);
  const [endDate, setEndDate] = useState(release);
  const [format, setFormat] = useState(formats[0] || '');
  const [language, setLanguage] = useState(languages[0] || '');
  const [agreementReference, setAgreementReference] = useState('');
  const [providerShare, setProviderShare] = useState(0);
  const [cinemaShare, setCinemaShare] = useState(100);
  const [terms, setTerms] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setStartDate(release);
    setEndDate(release);
  }, [release]);
  useEffect(() => { setFormat(formats[0] || ''); }, [screenId]);
  useEffect(() => { setLanguage(languages[0] || ''); }, [movieId]);

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const draft = await providerApi.createAuthorization({
        movieId, cinemaId: cinema.id, screenIds: [screenId], startDate, endDate,
        authorizedFormats: [format], authorizedLanguages: [language],
        agreementReference: agreementReference.trim() || undefined,
        commercialModel: 'REVENUE_SHARE', revenueShareProvider: Number(providerShare),
        revenueShareCinema: Number(cinemaShare), additionalTerms: terms.trim() || undefined,
      });
      await providerApi.submitAuthorization(draft.id);
      onSubmitted();
    } catch (err) {
      setError(err.message || 'Could not submit the exhibition authorization.');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'bg-[#0d0e12] border border-[#232938] rounded-xl px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-[#03b5d3] w-full';
  return <form onSubmit={submit} className="p-6 rounded-2xl bg-[#12151e] border border-[#a078ff]/40 flex flex-col gap-4">
    <div className="flex items-center justify-between"><div><h3 className="text-sm font-bold text-white">Request exhibition authorization</h3><p className="text-[11px] text-[#94a3b8] mt-1">Submitted requests require admin review before shows can be published.</p></div><button type="button" onClick={onClose} className="p-2 text-[#94a3b8]"><X className="w-4 h-4" /></button></div>
    {error && <div role="alert" className="p-3 rounded-xl bg-[#f87171]/10 border border-[#f87171]/40 text-xs text-[#fca5a5]">{error}</div>}
    <div className="grid md:grid-cols-3 gap-3 text-xs font-mono">
      <label className="text-[#94a3b8]">Movie<select required value={movieId} onChange={e => setMovieId(e.target.value)} className={inputCls}>{movies.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className="text-[#94a3b8]">Hall screen<select required value={screenId} onChange={e => setScreenId(e.target.value)} className={inputCls}>{screens.map(item => <option key={item.id} value={item.id}>{item.screen_name || item.screenName}</option>)}</select></label>
      <label className="text-[#94a3b8]">Format requested<select required value={format} onChange={e => setFormat(e.target.value)} className={inputCls}>{formats.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="text-[#94a3b8]">Language<select required value={language} onChange={e => setLanguage(e.target.value)} className={inputCls}>{languages.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="text-[#94a3b8]">Authorization start<input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} /></label>
      <label className="text-[#94a3b8]">Authorization end<input required type="date" min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} /></label>
      <label className="text-[#94a3b8]">Agreement reference<input value={agreementReference} onChange={e => setAgreementReference(e.target.value)} placeholder="Optional real contract reference" className={inputCls} /></label>
      <label className="text-[#94a3b8]">Movie rights-holder share (%)<input required type="number" min="0" max="100" value={providerShare} onChange={e => { const value = Number(e.target.value); setProviderShare(value); setCinemaShare(100 - value); }} className={inputCls} /></label>
      <label className="text-[#94a3b8]">Cinema share (%)<input readOnly value={cinemaShare} className={inputCls} /></label>
    </div>
    <label className="text-xs font-mono text-[#94a3b8]">Additional agreement terms<textarea rows={2} value={terms} onChange={e => setTerms(e.target.value)} className={inputCls} placeholder="Optional terms from your agreement" /></label>
    <div className="flex items-center gap-2"><button disabled={busy || !formats.length || !languages.length} className="px-5 py-2.5 rounded-xl bg-[#a078ff] text-[#16002f] text-xs font-bold disabled:opacity-40">{busy ? 'Submitting…' : 'Submit for review'}</button><button type="button" onClick={onClose} className="px-4 py-2.5 text-xs text-[#94a3b8]">Cancel</button></div>
  </form>;
}

function DemoScreeningForm({ cinema, onCreated, onClose }) {
  const [movies, setMovies] = useState([]);
  const [movieId, setMovieId] = useState('');
  const [screenId, setScreenId] = useState(cinema.screens?.[0]?.id || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    moviesApi.list().then(rows => {
      const active = (rows || []).filter(movie => ['ACTIVE', 'UPCOMING'].includes(movie.status));
      setMovies(active);
      setMovieId(active[0]?.id || '');
    }).catch(err => setError(err.message || 'Could not load approved movies.'));
  }, []);

  const submit = async event => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await showsApi.createDemo({ movieId, cinemaId: cinema.id, screenId });
      await onCreated();
    } catch (err) {
      setError(err.message || 'Could not create a demo screening.');
    } finally {
      setSubmitting(false);
    }
  };

  return <form onSubmit={submit} className="p-5 rounded-2xl bg-[#12151e] border border-[#a078ff]/40 flex flex-col gap-4">
    <div><h3 className="font-bold text-white">Create a demo screening</h3><p className="text-xs text-[#94a3b8] mt-1">Development only. Uses this hall’s saved seat layout and prices. No real payment or exhibition agreement is created.</p></div>
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="text-xs text-[#94a3b8]">Approved movie<select required value={movieId} onChange={event => setMovieId(event.target.value)} className="mt-1 bg-[#0d0e12] border border-[#232938] rounded-lg p-2 text-white w-full">{movies.map(movie => <option key={movie.id} value={movie.id}>{movie.title}</option>)}</select></label>
      <label className="text-xs text-[#94a3b8]">Screen<select required value={screenId} onChange={event => setScreenId(event.target.value)} className="mt-1 bg-[#0d0e12] border border-[#232938] rounded-lg p-2 text-white w-full">{(cinema.screens || []).filter(screen => screen.is_active !== false).map(screen => <option key={screen.id} value={screen.id}>{screen.screen_name || screen.screenName}</option>)}</select></label>
    </div>
    {error && <p role="alert" className="text-sm text-[#ffb4ab]">{error}</p>}
    <div className="flex gap-2"><button type="submit" disabled={submitting || !movieId || !screenId} className="px-4 py-2 rounded-lg bg-[#a078ff] text-white text-xs font-bold disabled:opacity-50">{submitting ? 'Creating…' : 'Create tomorrow’s 7 PM screening'}</button><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-[#232938] text-white text-xs">Close</button></div>
  </form>;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ShowsPricingView({ currentUser }) {
  const navigate = useNavigate();
  const [shows, setShows] = useState([]);
  const [myMovies, setMyMovies] = useState([]);
  const [providerMovies, setProviderMovies] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [authorizationForm, setAuthorizationForm] = useState(false);
  const [demoForm, setDemoForm] = useState(false);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Cancel Modal states
  const [cancelModalShow, setCancelModalShow] = useState(null);
  const [selectedReason, setSelectedReason] = useState("Schedule overlap / Screen conflict");
  const [customReason, setCustomReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [moviesResult, cinemaResult, showsResult] = await Promise.allSettled([
        moviesApi.listMine(),
        cinemasApi.mine(),
        showsApi.listMine(),
      ]);
      const allMovies = moviesResult.status === 'fulfilled' && Array.isArray(moviesResult.value)
        ? moviesResult.value : [];
      setProviderMovies(allMovies);

      let ownedCinemas = [];
      if (cinemaResult.status === 'fulfilled' && cinemaResult.value?.id) {
        const cinema = cinemaResult.value;
        try {
          const screens = await cinemasApi.screens();
          ownedCinemas = [{ ...cinema, screens: Array.isArray(screens) ? screens : [] }];
        } catch {
          ownedCinemas = [{ ...cinema, screens: [] }];
        }
      }
      setCinemas(ownedCinemas);

      const authorizations = ownedCinemas.length
        ? await showsApi.authorizedMovies().catch(() => [])
        : [];
      const approvedMovies = Array.isArray(authorizations) ? authorizations.filter(authorization => authorization.screenIds?.length).map(authorization => {
        const movie = allMovies.find(item => item.id === authorization.movieId) || {};
        return {
          ...movie,
          id: authorization.movieId,
          title: authorization.movieTitle || movie.title || 'Movie',
          authorizationId: authorization.authorizationId,
          screenIds: authorization.screenIds || [],
          releaseDate: authorization.startDate || movie.releaseDate,
          formats: authorization.authorizedFormats || movie.formats || [],
          languages: authorization.authorizedLanguages || movie.languages || [],
        };
      }) : [];
      setMyMovies(approvedMovies);

      if (showsResult.status === 'rejected') throw showsResult.reason;
      const rows = Array.isArray(showsResult.value) ? showsResult.value : [];
      setShows(rows.map(show => ({
        id: show.id,
        movieTitle: show.movieTitle || show.movie_title || allMovies.find(movie => movie.id === show.movieId || movie.id === show.movie_id)?.title || 'Movie',
        cinemaName: show.cinemaName || show.cinema_name || ownedCinemas[0]?.cinema_name || 'Cinema',
        screenName: show.screenName || show.screen_name || 'Screen',
        date: show.showDate || show.show_date || show.date || '',
        startTime: fmt12h(show.startTime || show.start_time),
        endTime: fmt12h(show.endTime || show.end_time),
        format: show.format || '2D',
        language: show.language || '',
        totalSeats: Number(show.totalSeats ?? show.total_seats ?? 0),
        seatsBooked: Number(show.seatsBooked ?? show.seats_booked ?? 0),
        revenue: Number(show.revenue || 0),
        status: show.status || (show.is_cancelled ? 'CANCELLED' : 'PUBLISHED'),
        cancellationReason: show.cancellationReason || show.cancellation_reason || '',
      })).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)));
    } catch (error) {
      console.error('Shows dashboard could not load:', error);
      setLoadError(error.message || 'Could not load show data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const confirmCancelShow = async () => {
    if (!cancelModalShow) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const finalReason = selectedReason === "Other (Specify below)"
        ? (customReason.trim() || 'Cancelled by provider/cinema manager')
        : (customReason.trim() ? `${selectedReason} - ${customReason.trim()}` : selectedReason);

      await showsApi.cancel(cancelModalShow.id, { reason: finalReason });
      
      setFeedbackNotice(`Screening of "${cancelModalShow.movieTitle}" on ${cancelModalShow.date} (${cancelModalShow.startTime}) cancelled successfully.`);
      setTimeout(() => setFeedbackNotice(null), 6000);
      setCancelModalShow(null);
      await fetchData();
    } catch (err) {
      console.error('Cancellation failed:', err);
      setCancelError(err.message || 'Could not cancel show. Ensure you are authorized for this film or cinema.');
    } finally {
      setCancelling(false);
    }
  };

  const availableDates = useMemo(() => {
    const set = new Set();
    shows.forEach(s => { if (s.date) set.add(s.date); });
    return Array.from(set).sort();
  }, [shows]);

  const filteredShows = useMemo(() => {
    return shows.filter(show => {
      if (statusFilter !== 'ALL' && show.status !== statusFilter) return false;
      if (dateFilter !== 'ALL' && show.date !== dateFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesMovie = (show.movieTitle || '').toLowerCase().includes(q);
        const matchesCinema = (show.cinemaName || '').toLowerCase().includes(q);
        const matchesScreen = (show.screenName || '').toLowerCase().includes(q);
        const matchesDate = (show.date || '').toLowerCase().includes(q);
        const matchesTime = (show.startTime || '').toLowerCase().includes(q);
        if (!matchesMovie && !matchesCinema && !matchesScreen && !matchesDate && !matchesTime) return false;
      }
      return true;
    });
  }, [shows, statusFilter, dateFilter, searchQuery]);

  const totals = shows.reduce((sum, show) => ({
    revenue: sum.revenue + show.revenue,
    booked: sum.booked + show.seatsBooked,
    capacity: sum.capacity + show.totalSeats,
  }), { revenue: 0, booked: 0, capacity: 0 });
  const occupancy = totals.capacity ? Math.round((totals.booked / totals.capacity) * 100) : 0;
  const cinema = cinemas[0];
  const canSchedule = Boolean(cinema && myMovies.length);

  return (
    <div className="w-full min-h-screen bg-[#08090d] pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#232938]">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#06b6d4] font-bold">{cinema?.cinema_name || currentUser?.venueName || 'Partner Dashboard'}</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Shows & Pricing</h1>
            <p className="text-xs text-[#94a3b8] mt-1">Live schedule and confirmed ticket performance for your cinema and movie screenings.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => navigate('/partner/seat-planner')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ec4899]/15 border border-[#ec4899]/40 text-[#f43f5e] hover:bg-[#ec4899]/25 font-bold text-xs cursor-pointer transition-colors"
            >
              <LayoutGrid className="w-4 h-4" /> Seat Layout Studio
            </button>
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#181c26] text-[#94a3b8] hover:text-white font-bold text-xs border border-[#232938] cursor-pointer">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            {canSchedule && <button onClick={() => setShowForm(value => !value)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#03b5d3] to-[#0ea5e9] text-[#001f26] font-bold text-xs cursor-pointer">
              <Plus className="w-4 h-4" /> Schedule a show
            </button>}
            {cinema?.verification_status === 'VERIFIED' && <button onClick={() => setDemoForm(value => !value)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#a078ff]/15 border border-[#a078ff]/40 text-[#d0bcff] font-bold text-xs cursor-pointer">
              <Plus className="w-4 h-4" /> Create demo screening
            </button>}
            {cinema?.verification_status === 'VERIFIED' && providerMovies.length > 0 && <button onClick={() => setAuthorizationForm(value => !value)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#a078ff]/15 border border-[#a078ff]/40 text-[#d0bcff] font-bold text-xs cursor-pointer">
              <Plus className="w-4 h-4" /> Request exhibition authorization
            </button>}
          </div>
        </header>

        {feedbackNotice && (
          <div className="p-3.5 rounded-xl bg-[#4edea3]/15 border border-[#4edea3]/40 text-xs font-mono text-[#4edea3] flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedbackNotice}</span>
            </div>
            <button onClick={() => setFeedbackNotice(null)} className="text-[#4edea3] hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loadError && <div role="alert" className="p-4 rounded-xl bg-[#f87171]/10 border border-[#f87171]/40 text-sm text-[#fca5a5]">{loadError}</div>}
        {showForm && <AddShowForm myMovies={myMovies} cinemas={cinemas} onAdd={() => fetchData()} onClose={() => setShowForm(false)} />}
        {demoForm && cinema && <DemoScreeningForm cinema={cinema} onCreated={async () => { setDemoForm(false); await fetchData(); }} onClose={() => setDemoForm(false)} />}
        {authorizationForm && cinema && <ExhibitionAuthorizationForm movies={providerMovies} cinema={cinema} screens={cinema.screens || []} onSubmitted={async () => { setAuthorizationForm(false); await fetchData(); }} onClose={() => setAuthorizationForm(false)} />}

        {loading ? <div className="py-20 text-center text-[#94a3b8]">Loading your cinema data…</div> : <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Scheduled shows', value: shows.length.toLocaleString(), icon: Calendar, color: '#03b5d3' },
              { label: 'Seats booked', value: totals.booked.toLocaleString(), icon: Users, color: '#a78bfa' },
              { label: 'Confirmed ticket revenue', value: fmt(totals.revenue), icon: DollarSign, color: '#4edea3' },
              { label: 'Seat occupancy', value: `${occupancy}%`, icon: TrendingUp, color: '#fbbf24' },
            ].map(card => <div key={card.label} className="p-4 rounded-2xl bg-[#12151e] border border-[#232938]">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#94a3b8]"><span>{card.label}</span><card.icon className="w-4 h-4" style={{ color: card.color }} /></div>
              <p className="mt-2 text-2xl font-extrabold text-white">{card.value}</p>
            </div>)}
          </section>

          {!cinema && currentUser?.role === 'partner' && <div className="p-4 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/30 text-sm text-[#fcd34d]">No cinema hall is linked to this account. Show data is limited to your authorized movies.</div>}
          {myMovies.length === 0 && <div className="p-4 rounded-xl bg-[#12151e] border border-[#232938] text-sm text-[#94a3b8]">
            {cinema?.verification_status !== 'VERIFIED'
              ? `This cinema is ${cinema?.verification_status || 'not verified'}. The admin must verify the cinema before an exhibition authorization or customer-bookable show can be approved.`
              : 'No approved exhibition authorization is linked to this cinema yet. An approved movie-to-cinema authorization is required before scheduling a customer-bookable show.'}
          </div>}

          <section className="rounded-2xl bg-[#12151e] border border-[#232938] overflow-hidden">
            {/* Header & Filter Controls */}
            <div className="px-5 py-4 border-b border-[#232938] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-white text-base">Show Schedule & Cancellation Controls</h2>
                <p className="text-xs text-[#64748b] mt-0.5">Filter by date or time to inspect screenings and cancel shows whenever needed.</p>
              </div>

              {/* Filters toolbar */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <div className="flex items-center gap-2 bg-[#0d0e12] border border-[#232938] rounded-xl px-3 py-1.5 focus-within:border-[#03b5d3] transition-colors">
                  <Search className="w-3.5 h-3.5 text-[#958ea0]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search movie, screen..."
                    className="bg-transparent text-xs text-white placeholder-[#64748b] outline-none w-28 sm:w-36"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-[#64748b] hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-1.5 bg-[#0d0e12] border border-[#232938] rounded-xl px-2.5 py-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#03b5d3]" />
                  <select
                    value={dateFilter}
                    onChange={e => setDateFilter(e.target.value)}
                    className="bg-transparent text-xs text-white outline-none font-mono cursor-pointer"
                  >
                    <option value="ALL" className="bg-[#12151e]">All Dates</option>
                    {availableDates.map(d => (
                      <option key={d} value={d} className="bg-[#12151e]">{d}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 bg-[#0d0e12] border border-[#232938] rounded-xl px-2.5 py-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#a078ff]" />
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-transparent text-xs text-white outline-none font-mono cursor-pointer"
                  >
                    <option value="ALL" className="bg-[#12151e]">All Status</option>
                    <option value="ON_SALE" className="bg-[#12151e]">Active / On Sale</option>
                    <option value="PUBLISHED" className="bg-[#12151e]">Published</option>
                    <option value="CANCELLED" className="bg-[#12151e]">Cancelled</option>
                  </select>
                </div>

                <span className="text-xs text-[#94a3b8] font-mono whitespace-nowrap pl-1">
                  {filteredShows.length} of {shows.length} shows
                </span>
              </div>
            </div>

            {/* Table */}
            {filteredShows.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#64748b] font-mono">
                {shows.length === 0 ? "No shows scheduled yet." : "No shows match the selected date or search filter."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-[#64748b] border-b border-[#232938] bg-[#0d0e12]/60">
                      {['Movie Title', 'Screening Date', 'Screen & Timing', 'Format', 'Seat Sales', 'Revenue', 'Status', 'Cancellation Action'].map(label => (
                        <th key={label} className="px-5 py-3 font-semibold">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232938]/60">
                    {filteredShows.map(show => (
                      <tr key={show.id} className="hover:bg-[#181c26]/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-bold text-white text-sm">{show.movieTitle}</div>
                          <div className="text-[10px] text-[#64748b] mt-0.5">{show.language || 'Original'}</div>
                        </td>
                        <td className="px-5 py-4 text-[#cbc3d7] whitespace-nowrap font-bold">
                          {show.date}
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-white font-semibold">{show.screenName}</div>
                          <div className="text-[10px] text-[#94a3b8] mt-0.5 font-bold text-[#4cd7f6]">
                            {show.startTime} – {show.endTime}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[#fbbf24] font-semibold">{show.format}</td>
                        <td className="px-5 py-4">
                          <span className="text-white font-bold">{show.seatsBooked}</span>
                          <span className="text-[#64748b]"> / {show.totalSeats}</span>
                        </td>
                        <td className="px-5 py-4 font-bold text-[#4edea3]">{fmt(show.revenue)}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {show.status === 'CANCELLED' ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="px-2 py-0.5 rounded-full border text-[10px] font-bold bg-[#ffb4ab]/15 text-[#ffb4ab] border-[#ffb4ab]/40 inline-flex items-center gap-1 w-fit">
                                <Ban className="w-2.5 h-2.5" /> CANCELLED
                              </span>
                              {show.cancellationReason && (
                                <span className="text-[9px] text-[#958ea0] max-w-[130px] truncate" title={show.cancellationReason}>
                                  {show.cancellationReason}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS_STYLE[show.status] || STATUS_STYLE.PUBLISHED}`}>
                              {show.status.replaceAll('_', ' ')}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {show.status !== 'CANCELLED' ? (
                            <button
                              onClick={() => {
                                setCancelModalShow(show);
                                setSelectedReason("Schedule overlap / Screen conflict");
                                setCustomReason("");
                                setCancelError(null);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#ffb4ab]/15 hover:bg-[#ffb4ab]/25 border border-[#ffb4ab]/40 text-[#ffb4ab] text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                              title={`Cancel screening on ${show.date} at ${show.startTime}`}
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Cancel Show</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#64748b] italic">
                              Show Cancelled
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>}

        {/* ── Cancellation Modal ────────────────────────────────────────────── */}
        {cancelModalShow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-[#12151e] border border-[#ffb4ab]/40 rounded-3xl p-6 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.95)] relative flex flex-col gap-4">
              
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-[#232938] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#ffb4ab]/15 border border-[#ffb4ab]/30 flex items-center justify-center text-[#ffb4ab]">
                    <Ban className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#ffb4ab] px-2 py-0.5 rounded bg-[#ffb4ab]/10 border border-[#ffb4ab]/20">
                      Screening Cancellation
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1">Cancel Screening</h3>
                  </div>
                </div>
                <button
                  onClick={() => { setCancelModalShow(null); setCancelError(null); }}
                  className="text-[#94a3b8] hover:text-white p-1 rounded-lg hover:bg-[#1a1d26] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Show specifics card */}
              <div className="p-3.5 rounded-xl bg-[#0d0e12] border border-[#232938] text-xs font-mono space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#958ea0]">Movie Title:</span>
                  <span className="text-white font-bold">{cancelModalShow.movieTitle}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#958ea0]">Screening Date:</span>
                  <span className="text-[#fbbf24] font-semibold">{cancelModalShow.date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#958ea0]">Show Timing:</span>
                  <span className="text-[#4cd7f6] font-semibold">{cancelModalShow.startTime} – {cancelModalShow.endTime}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#958ea0]">Auditorium & Screen:</span>
                  <span className="text-white">{cancelModalShow.screenName} ({cancelModalShow.format})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#958ea0]">Seats Reserved:</span>
                  <span className="text-[#4edea3] font-bold">{cancelModalShow.seatsBooked} / {cancelModalShow.totalSeats} booked</span>
                </div>
              </div>

              {/* Reason selector */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-semibold text-[#cbc3d7]">
                  Select Cancellation Reason:
                </label>
                <div className="grid grid-cols-1 gap-1.5 text-xs font-mono">
                  {[
                    "Schedule overlap / Screen conflict",
                    "Technical or projector malfunction",
                    "Distributor schedule adjustment / Recall",
                    "Auditorium maintenance & deep cleaning",
                    "Other (Specify below)"
                  ].map(r => (
                    <label
                      key={r}
                      onClick={() => setSelectedReason(r)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        selectedReason === r
                          ? "bg-[#ffb4ab]/10 border-[#ffb4ab]/50 text-white"
                          : "bg-[#181c26] border-[#232938] text-[#94a3b8] hover:text-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancelReason"
                        checked={selectedReason === r}
                        onChange={() => setSelectedReason(r)}
                        className="accent-[#ffb4ab]"
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-[#958ea0]">
                  Additional Details or Customer Notice (Optional):
                </label>
                <textarea
                  rows={2}
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  placeholder="Provide specific notes regarding this date/time cancellation..."
                  className="w-full bg-[#0d0e12] border border-[#232938] rounded-xl p-2.5 text-xs text-white placeholder-[#64748b] outline-none focus:border-[#ffb4ab]"
                />
              </div>

              {cancelError && (
                <div className="p-3 rounded-xl bg-[#ffb4ab]/15 border border-[#ffb4ab]/30 text-xs text-[#ffb4ab] font-mono">
                  {cancelError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setCancelModalShow(null); setCancelError(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-[#181c26] hover:bg-[#202534] border border-[#232938] text-xs font-mono font-bold text-[#cbc3d7] transition-colors cursor-pointer"
                >
                  Keep Show Active
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={confirmCancelShow}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#f87171] to-[#ef4444] hover:brightness-110 text-white text-xs font-mono font-bold shadow-[0_0_20px_rgba(239,68,68,0.4)] disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {cancelling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{cancelling ? "Cancelling..." : "Confirm Show Cancellation"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
