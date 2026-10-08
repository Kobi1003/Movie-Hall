import { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  MapPin,
  Search,
  Calendar,
  ArrowRight,
  ShieldCheck,
  Zap,
  Ticket,
  Tv,
  User,
  Building2,
  Lock,
  CheckCircle2,
  ChevronRight,
  Star,
  Clock,
  Volume2,
  Film,
  Tag,
  X,
  Shield,
  Info,
  Navigation,
  LocateFixed,
  ExternalLink,
  Compass,
  ArrowUpDown,
  Layers
} from 'lucide-react';
import { moviesApi, cinemasApi } from '../api.js';
import CinemaHallsDirectoryModal from './CinemaHallsDirectoryModal';
import { requestBrowserLocation, findClosestCity, getGoogleMapsUrl } from '../utils/location.js';

const localToday = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function DiscoverView({
  currentUser,
  onSelectMovie,
  selectedCity,
  setSelectedCity,
  userLocation,
  setUserLocation,
  searchQuery,
  setSearchQuery,
  onOpenAuth,
  onNavigateToBookings
}) {
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('ALL');
  const [selectedCinemaId, setSelectedCinemaId] = useState('ALL');
  const [cinemaSortBy, setCinemaSortBy] = useState('closest'); // 'closest' | 'city' | 'date'
  const [catalog, setCatalog] = useState([]);
  const [allCinemas, setAllCinemas] = useState([]);
  const [dbCities, setDbCities] = useState([]);
  const [cinemasModalOpen, setCinemasModalOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  // Fetch all verified cinema halls and cities with location enrichment
  useEffect(() => {
    const params = {
      ...(userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : {}),
      sortBy: cinemaSortBy
    };
    cinemasApi.list(params)
      .then((res) => { if (Array.isArray(res)) setAllCinemas(res); })
      .catch(() => {});

    cinemasApi.cities(params)
      .then((res) => { if (Array.isArray(res)) setDbCities(res); })
      .catch(() => {});
  }, [userLocation, cinemaSortBy]);

  // Merge cinema halls from both movie catalog and verified database
  const availableCinemas = useMemo(() => {
    const fromMovies = catalog.flatMap(movie => movie.theatres || []);
    const cinemaMap = new Map();

    for (const t of fromMovies) {
      if (!t.cinemaId) continue;
      cinemaMap.set(t.cinemaId, {
        cinemaId: t.cinemaId,
        name: t.name,
        city: t.city,
        area: t.area,
        latitude: t.latitude,
        longitude: t.longitude,
        distanceKm: t.distanceKm,
        distanceText: t.distanceText,
        mapsUrl: t.mapsUrl,
        directionsUrl: t.directionsUrl,
        hasScreenings: true
      });
    }

    for (const c of allCinemas) {
      const id = c.id || c.cinemaId;
      if (!cinemaMap.has(id)) {
        cinemaMap.set(id, {
          cinemaId: id,
          name: c.name || c.cinema_name,
          city: c.city,
          area: c.address || c.area,
          latitude: c.latitude,
          longitude: c.longitude,
          distanceKm: c.distanceKm,
          distanceText: c.distanceText,
          mapsUrl: c.mapsUrl,
          directionsUrl: c.directionsUrl,
          hasScreenings: false
        });
      }
    }

    const list = Array.from(cinemaMap.values());
    const allCities = !selectedCity || selectedCity === 'All Locations' || selectedCity === 'All Locations / Metro';
    const cityFilter = (selectedCity || '').toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();

    const filtered = allCities
      ? list
      : list.filter(theatre => (theatre.city || '').toLowerCase().replace(/\s*\([^)]*\)/g, '').trim().includes(cityFilter));

    // Sort according to city name with closest locations first!
    return filtered.sort((a, b) => {
      if (cinemaSortBy === 'closest' || cinemaSortBy === 'distance') {
        if (a.distanceKm != null && b.distanceKm != null) {
          if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
        } else if (a.distanceKm != null) return -1;
        else if (b.distanceKm != null) return 1;
      }

      const cityA = (a.city || '').toLowerCase();
      const cityB = (b.city || '').toLowerCase();
      if (cityA !== cityB) return cityA.localeCompare(cityB);

      if (a.distanceKm != null && b.distanceKm != null) {
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      }

      return (a.name || '').localeCompare(b.name || '');
    });
  }, [catalog, allCinemas, selectedCity, cinemaSortBy]);

  // Group available cinemas by city for optgroup
  const cinemasGroupedByCity = useMemo(() => {
    const map = new Map();
    for (const c of availableCinemas) {
      const city = c.city || 'Other Locations';
      if (!map.has(city)) map.set(city, []);
      map.get(city).push(c);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [availableCinemas]);

  const handleDetectLocation = async () => {
    setLocating(true);
    try {
      const coords = await requestBrowserLocation();
      if (setUserLocation) setUserLocation(coords);

      const citiesList = dbCities.length > 0 ? dbCities : [
        { city: 'Kolkata', latitude: 22.5726, longitude: 88.3639 },
        { city: 'Hooghly', latitude: 22.8988, longitude: 88.3970 },
        { city: 'Mumbai (MMR)', latitude: 19.0760, longitude: 72.8777 },
        { city: 'Delhi NCR', latitude: 28.6139, longitude: 77.2090 },
        { city: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 },
        { city: 'Hyderabad', latitude: 17.3850, longitude: 78.4867 },
        { city: 'Chennai', latitude: 13.0827, longitude: 80.2707 },
        { city: 'Pune', latitude: 18.5204, longitude: 73.8567 },
      ];

      const closest = findClosestCity(coords, citiesList);
      if (closest?.city) {
        setSelectedCity(closest.city);
      }
    } catch (err) {
      alert(err.message || 'Unable to access your GPS position. Please check your browser location permissions.');
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (selectedCinemaId !== 'ALL' && !availableCinemas.some(cinema => cinema.cinemaId === selectedCinemaId)) {
      setSelectedCinemaId('ALL');
    }
  }, [selectedCinemaId, availableCinemas]);

  useEffect(() => {
    let cancelled = false;
    const effectiveCity = (!selectedCity || selectedCity === 'All Locations' || selectedCity === 'All Locations / Metro') ? undefined : selectedCity;
    moviesApi.list({
      ...(effectiveCity ? { city: effectiveCity } : {}),
      ...(selectedDateFilter ? { date: selectedDateFilter } : {}),
      ...(userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : {}),
      sortBy: cinemaSortBy
    }).then((data) => {
      if (cancelled || !Array.isArray(data)) return;
      const mapped = data
        .filter(m => m.status === 'ACTIVE' || m.status === 'AUTHORIZED' || m.isSuperAdminAuthorized)
        .map((m) => {
        const prices = (m.theatres || []).flatMap(t => (t.ticketPrices || []).map(p => Number(p.price))).filter(Number.isFinite);
        return {
          ...m,
          banner: m.banner || m.poster || '',
          theatres: m.theatres || [],
          formats: m.formats || [],
          format: m.format || m.formats?.[0] || '2D Standard',
          genre: m.genre || 'Action / Drama',
          language: m.language || 'English',
          rating: m.rating || '4.5',
          votes: m.votes || 0,
          priceFrom: m.priceFrom ?? (prices.length ? Math.min(...prices) : 0),
          ageRating: m.cbfcCertification || 'UA',
          tags: Array.isArray(m.genres) ? m.genres : [],
        };
      });
      setCatalog(mapped);
    }).catch(() => { if (!cancelled) setCatalog([]); });
    return () => { cancelled = true; };
  }, [selectedCity, selectedDateFilter, userLocation, cinemaSortBy]);

  // Filter movies
  const filteredMovies = catalog.filter(movie => {
    const isAllLocations = !selectedCity || selectedCity === 'All Locations' || selectedCity === 'All Locations / Metro';
    const normalizedCity = (selectedCity || '').toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
    const scheduledTheatres = (movie.theatres || []).filter(theatre => {
      const matchesCity = isAllLocations || (theatre.city || '').toLowerCase().replace(/\s*\([^)]*\)/g, '').trim().includes(normalizedCity);
      const matchesCinema = selectedCinemaId === 'ALL' || theatre.cinemaId === selectedCinemaId;
      const hasSelectedDateShow = (theatre.showtimes || []).some(show =>
        show.date >= localToday() && (!selectedDateFilter || show.date === selectedDateFilter));
      return matchesCity && matchesCinema && hasSelectedDateShow;
    });
    // Keep approved/active catalogue entries discoverable before the provider
    // publishes a show. Selecting a specific cinema remains show-only so a
    // title is never attributed to a hall without an actual screening there.
    const catalogueOnly = scheduledTheatres.length === 0;
    if (catalogueOnly && selectedCinemaId !== 'ALL') return false;

    const q = (searchQuery || '').toLowerCase();
    const matchesQuery = !q ||
      movie.title.toLowerCase().includes(q) ||
      movie.genre.toLowerCase().includes(q) ||
      movie.language.toLowerCase().includes(q) ||
      scheduledTheatres.some(t => (t.name || '').toLowerCase().includes(q) || (t.area || '').toLowerCase().includes(q));

    const matchesFormat = selectedFormat === 'ALL' ||
      movie.formats.some(format => format.toLowerCase().includes(selectedFormat.toLowerCase())) ||
      scheduledTheatres.some(theatre => theatre.screenFormat?.toLowerCase().includes(selectedFormat.toLowerCase()));

    return matchesQuery && matchesFormat;
  });

  const sortedMovies = [...filteredMovies].sort((a, b) => {
    const nextDate = movie => (movie.theatres || [])
      .flatMap(theatre => theatre.showtimes || [])
      .map(show => show.date)
      .filter(date => date >= localToday() && (!selectedDateFilter || date === selectedDateFilter))
      .sort()[0] || '9999-12-31';
    return nextDate(a).localeCompare(nextDate(b)) || a.title.localeCompare(b.title);
  });

  return (
    <div className="w-full flex flex-col bg-[#08090d]">

      {/* HERO SECTION */}
      <section className="relative w-full overflow-hidden bg-[#0d0e12] pt-28 pb-14 px-4 sm:px-6 lg:px-8 border-b border-[#232938]">
        {/* Ambient Neon Atmosphere Orbs */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[680px] h-[340px] bg-gradient-to-tr from-[#8b5cf6]/20 via-[#06b6d4]/15 to-transparent rounded-full blur-3xl pointer-events-none -z-0"></div>
        <div className="absolute top-36 -left-20 w-96 h-96 bg-[#8b5cf6]/10 rounded-full blur-[110px] pointer-events-none -z-0"></div>
        <div className="absolute top-36 -right-20 w-96 h-96 bg-[#06b6d4]/10 rounded-full blur-[110px] pointer-events-none -z-0"></div>

        <div className="relative z-10 max-w-6xl mx-auto flex flex-col items-center text-center">

          {/* Live Status Eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1e1f24] border border-[#292a2e] shadow-[0_0_16px_rgba(0,0,0,0.5)] mb-5">
            <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#4edea3]">
              Real-time Seat Concurrency Active
            </span>
            <span className="text-[#958ea0] text-xs">/</span>
            <span className="text-[11px] font-mono text-[#cbc3d7]">TIXORA Cinema Engine</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15] mb-4">
            {currentUser?.role === 'customer' ? (
              <>
                Welcome back,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d0bcff] via-[#4cd7f6] to-[#4edea3]">
                  {currentUser.name}
                </span>
              </>
            ) : (
              <>
                Your next{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d0bcff] via-[#4cd7f6] to-[#4edea3]">
                  unforgettable
                </span>{' '}
                experience starts here.
              </>
            )}
          </h1>

          <p className="text-sm sm:text-base text-[#94a3b8] max-w-2xl mb-8 font-normal">
            Explore live theatrical movies, showtimings, and cinema halls. Pick your exact seat location visually in real-time with zero double-booking latency.
          </p>

          {/* Glassmorphic Global Command Search Rig */}
          <div className="w-full max-w-5xl bg-[#181c26]/90 backdrop-blur-2xl rounded-2xl p-2 border border-[#232938] shadow-[0_16px_40px_rgba(0,0,0,0.8)] mb-6 flex flex-col lg:flex-row items-stretch gap-2">

            {/* City */}
            <div className="flex items-center px-4 py-3 bg-[#12151e] rounded-xl border border-[#232938]/60 min-w-[210px]">
              <MapPin className={`w-5 h-5 ${userLocation ? 'text-[#4edea3]' : 'text-[#4cd7f6]'} mr-3 shrink-0`} />
              <div className="flex flex-col text-left w-full">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-[#958ea0]">City & Metro</span>
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={locating}
                    title="Detect closest city via GPS"
                    className="text-[10px] font-mono text-[#4edea3] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <LocateFixed className={`w-3 h-3 ${locating ? 'animate-spin' : ''}`} />
                    <span>{locating ? 'GPS...' : userLocation ? 'GPS Calibrated' : 'Detect'}</span>
                  </button>
                </div>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-white outline-none cursor-pointer pr-2"
                >
                  <option className="bg-[#181c26] text-white" value="All Locations">All Locations / Metro</option>
                  {(() => {
                    const presetCities = ['Kolkata', 'Hooghly', 'Mumbai (MMR)', 'Delhi NCR', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune'];
                    const fromHalls = Array.from(new Set(availableCinemas.map(c => c.city).filter(Boolean)));
                    const combined = Array.from(new Set([...fromHalls, ...presetCities]));
                    return combined.map(city => (
                      <option key={city} className="bg-[#181c26] text-white" value={city}>{city}</option>
                    ));
                  })()}
                </select>
              </div>
            </div>

            {/* Cinema hall */}
            <div className="flex items-center px-4 py-3 bg-[#12151e] rounded-xl border border-[#232938]/60 min-w-[240px]">
              <Building2 className="w-5 h-5 text-[#d0bcff] mr-3 shrink-0" />
              <div className="flex flex-col text-left w-full">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-[#958ea0]">Cinema Hall</span>
                  <button
                    type="button"
                    onClick={() => setCinemasModalOpen(true)}
                    className="text-[10px] font-mono text-[#4cd7f6] hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="Browse all cinema halls with map directions"
                  >
                    <Compass className="w-3 h-3" />
                    <span>Map Directory</span>
                  </button>
                </div>
                <select
                  value={selectedCinemaId}
                  onChange={(e) => setSelectedCinemaId(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-white outline-none cursor-pointer pr-2 max-w-[210px] truncate"
                >
                  <option className="bg-[#181c26] text-white" value="ALL">All Cinema Halls ({availableCinemas.length})</option>
                  {cinemasGroupedByCity.map(([city, halls]) => (
                    <optgroup key={city} label={`📍 ${city}`} className="bg-[#12151e] text-[#4cd7f6] font-bold">
                      {halls.map(cinema => (
                        <option key={cinema.cinemaId} className="bg-[#181c26] text-white" value={cinema.cinemaId}>
                          {cinema.name} {cinema.distanceText ? `(${cinema.distanceText})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {/* Keyword */}
            <div className="flex-1 flex items-center px-4 py-3 bg-[#12151e] rounded-xl border border-[#232938]/60">
              <Search className="w-5 h-5 text-[#d0bcff] mr-3 shrink-0" />
              <div className="flex flex-col text-left w-full">
                <span className="text-[10px] font-mono uppercase font-bold text-[#958ea0]">Search Movie / Theatre / Genre</span>
                <input
                  type="text"
                  placeholder="e.g. Avatar, IMAX Laser, Interstellar, PVR Galleria..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-sm font-medium text-white placeholder-[#64748b] outline-none w-full"
                />
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center px-4 py-3 bg-[#12151e] rounded-xl border border-[#232938]/60 min-w-[210px]">
              <Calendar className="w-5 h-5 text-[#4edea3] mr-3 shrink-0" />
              <div className="flex flex-col text-left w-full">
                <label htmlFor="screening-date" className="text-[10px] font-mono uppercase font-bold text-[#958ea0]">Sort by screening date</label>
                <div className="relative">
                  {!selectedDateFilter && <span className="absolute left-0 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#94a3b8] pointer-events-none">Choose a date</span>}
                  <input
                    id="screening-date"
                    type="date"
                    value={selectedDateFilter}
                    min={localToday()}
                    onChange={(e) => setSelectedDateFilter(e.target.value)}
                    className={`bg-transparent text-sm font-semibold outline-none cursor-pointer pr-2 ${selectedDateFilter ? 'text-white' : 'text-transparent'}`}
                  />
                </div>
                {selectedDateFilter && <button type="button" onClick={() => setSelectedDateFilter('')} className="text-[10px] text-[#4cd7f6] hover:text-white">Clear</button>}
              </div>
            </div>

          </div>

          {/* Quick Format Filter Chips & Cinema Hall Location Sorting */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 w-full pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'ALL', label: 'All Formats' },
                { id: 'IMAX', label: 'IMAX 3D / 70mm' },
                { id: 'Dolby', label: 'Dolby Cinema' },
                { id: 'Laser', label: 'Laser 4K' },
                { id: 'Concert', label: 'Live Arena' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFormat(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${selectedFormat === f.id
                    ? 'bg-[#a078ff] text-[#120038] shadow-[0_0_12px_rgba(160,120,255,0.4)]'
                    : 'bg-[#181c26] text-[#94a3b8] hover:text-white border border-[#232938]'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Hall Sorting Dropdown & Browse Directory Button */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-[#12151e] border border-[#232938] px-3 py-1 rounded-full text-xs font-mono">
                <Compass className="w-3.5 h-3.5 text-[#4edea3]" />
                <span className="text-[#958ea0]">Sort Halls:</span>
                <select
                  value={cinemaSortBy}
                  onChange={(e) => setCinemaSortBy(e.target.value)}
                  className="bg-transparent text-[#4edea3] font-bold outline-none cursor-pointer"
                >
                  <option value="closest" className="bg-[#181c26] text-white">Closest Locations 📍</option>
                  <option value="city" className="bg-[#181c26] text-white">By City Name (A-Z)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setCinemasModalOpen(true)}
                className="px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-[#03b5d3]/15 hover:bg-[#03b5d3]/25 text-[#4cd7f6] border border-[#03b5d3]/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(3,181,211,0.2)]"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Browse All Halls by City</span>
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* MOVIES & THEATRES DASHBOARD */}
      <section className="w-full py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

        {/* Section Title & Status Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-[#232938]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
              <span className="text-[11px] font-mono uppercase text-[#d0bcff] font-bold">
                Movie Catalogue · {selectedCity}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Browse Movies
            </h2>
            <p className="text-xs text-[#94a3b8] font-mono mt-0.5">
              Active movies stay visible in the catalogue. Published showtimes appear only at the cinema halls where they are scheduled.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#958ea0] bg-[#12151e] px-3 py-1.5 rounded-xl border border-[#232938]">
              Showing <strong className="text-white">{filteredMovies.length}</strong> Movies
            </span>
          </div>
        </div>

        {/* Movie Cards Showcase */}
        {filteredMovies.length === 0 ? (
          <div className="py-16 text-center bg-[#12151e] border border-[#232938] rounded-3xl p-8">
            <Film className="w-12 h-12 text-[#494454] mx-auto mb-3" />
            <p className="text-base font-bold text-white">No movies match your criteria</p>
            <p className="text-xs font-mono text-[#94a3b8] mt-1">Try changing your city or search keyword.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedFormat('ALL'); }}
              className="mt-4 px-4 py-2 rounded-xl bg-[#292a2e] text-white text-xs font-mono font-bold cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedMovies.map(movie => {
              // Only show halls with a published screening for the selected city and date.
              const isAllLocations = !selectedCity || selectedCity === 'All Locations' || selectedCity === 'All Locations / Metro';
              const normalizedCity = (selectedCity || '').toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
              const allFutureTheatres = (movie.theatres || [])
                .map(theatre => ({
                  ...theatre,
                  showtimes: (theatre.showtimes || []).filter(show =>
                    show.date >= localToday() && (!selectedDateFilter || show.date === selectedDateFilter))
                }))
                .filter(theatre => theatre.showtimes.length > 0);

              const cityTheatres = isAllLocations
                ? (movie.theatres || [])
                : (movie.theatres?.filter(t => (t.city || '').toLowerCase().replace(/\s*\([^)]*\)/g, '').trim().includes(normalizedCity)) || []);
              const hallTheatres = selectedCinemaId === 'ALL'
                ? cityTheatres
                : cityTheatres.filter(theatre => theatre.cinemaId === selectedCinemaId);
              const matchedTheatres = hallTheatres
                .map(theatre => ({
                  ...theatre,
                  showtimes: (theatre.showtimes || []).filter(show =>
                    show.date >= localToday() && (!selectedDateFilter || show.date === selectedDateFilter))
                }))
                .filter(theatre => theatre.showtimes.length > 0);

              const hasCityMismatch = !isAllLocations && matchedTheatres.length === 0 && allFutureTheatres.length > 0;
              const rawDisplayTheatres = matchedTheatres.length > 0 ? matchedTheatres : allFutureTheatres;
              const displayTheatres = [...rawDisplayTheatres].sort((a, b) => {
                if (cinemaSortBy === 'closest' || cinemaSortBy === 'distance') {
                  if (a.distanceKm != null && b.distanceKm != null) {
                    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
                  } else if (a.distanceKm != null) return -1;
                  else if (b.distanceKm != null) return 1;
                }
                const cityA = (a.city || '').toLowerCase();
                const cityB = (b.city || '').toLowerCase();
                if (cityA !== cityB) return cityA.localeCompare(cityB);
                return (a.name || '').localeCompare(b.name || '');
              });
              const firstScreening = displayTheatres.flatMap(theatre =>
                theatre.showtimes.map(show => ({ theatre, show })))[0];

              return (
                <div
                  key={movie.id}
                  className="rounded-3xl bg-[#12151e] border border-[#232938] hover:border-[#8b5cf6]/50 transition-all duration-300 shadow-2xl overflow-hidden flex flex-col xl:flex-row"
                >
                  {/* Left: Movie Poster & Core Metadata */}
                  <div className="xl:w-[360px] p-6 sm:p-7 flex flex-col justify-between bg-gradient-to-b from-[#181c26] to-[#12151e] border-b xl:border-b-0 xl:border-r border-[#232938] shrink-0">
                    <div>
                      {/* Banner / Poster Thumbnail */}
                      <div className="relative rounded-2xl overflow-hidden aspect-[16/9] xl:aspect-[4/3] mb-4 group">
                        <img
                          src={movie.banner}
                          alt={movie.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>

                        {/* Rating Pill */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-xs font-bold font-mono text-[#fbbf24]">
                          <Star className="w-3.5 h-3.5 fill-[#fbbf24] text-[#fbbf24]" />
                          <span>{movie.rating}</span>
                          <span className="text-[10px] text-[#958ea0]">({movie.votes})</span>
                        </div>

                        {/* Format Tag */}
                        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#a078ff]/90 text-[#120038] text-[10px] font-mono font-extrabold uppercase">
                          {movie.format}
                        </div>

                        {/* Age Rating & Duration bottom overlay */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-white/90">
                          <span className="px-2 py-0.5 rounded bg-black/60 border border-white/10">{movie.ageRating}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-[#4cd7f6]" />{movie.duration}</span>
                        </div>
                      </div>

                      {/* Title & Genre */}
                      <h3 className="text-xl font-extrabold text-white tracking-tight">{movie.title}</h3>
                      <p className="text-xs font-mono text-[#a078ff] mt-0.5">{movie.genre}</p>
                      <p className="text-[11px] font-mono text-[#958ea0] mt-0.5">{movie.language}</p>
                      {movie.releaseDate && <p className="text-[11px] font-mono text-[#64748b] mt-1">Release date · {movie.releaseDate}</p>}

                      <p className="text-xs text-[#94a3b8] mt-3 line-clamp-3 leading-relaxed">
                        {movie.synopsis}
                      </p>

                      {/* Tech Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {movie.tags?.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-[#1a1b20] border border-[#292a2e] text-[10px] font-mono text-[#cbc3d7]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Formats & Audio Badges */}
                      <div className="mt-4 flex items-center gap-2 flex-wrap text-[10px] font-mono">
                        <span className="px-2.5 py-1 rounded-lg bg-[#181c26] border border-[#232938] text-[#4cd7f6] font-semibold">
                          {movie.format || 'Standard 2D'}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-[#181c26] border border-[#232938] text-[#a078ff] font-semibold">
                          {movie.language || 'Original Track'}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-[#181c26] border border-[#232938] text-[#cbc3d7]">
                          Rating: <strong className="text-white">{movie.ageRating || 'UA'}</strong>
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={!firstScreening}
                        onClick={() => firstScreening && onSelectMovie(movie, {
                          theatre: firstScreening.theatre.name,
                          screen: firstScreening.theatre.screenName,
                          day: firstScreening.show.date,
                          time: firstScreening.show.time,
                          showId: firstScreening.show.showId,
                          ticketPrices: firstScreening.theatre.ticketPrices,
                          format: firstScreening.theatre.screenFormat || movie.format
                        })}
                        className={`mt-5 w-full px-4 py-3 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 ${firstScreening
                          ? 'bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white shadow-[0_0_16px_rgba(160,120,255,0.35)] hover:brightness-110 cursor-pointer'
                          : 'bg-[#292a2e] text-[#958ea0] border border-[#3b3b43] cursor-not-allowed'}`}
                      >
                        <Ticket className="w-4 h-4" />
                        Book Tickets & Choose Seats
                      </button>
                      {!firstScreening && (
                        <p className="mt-2 text-[10px] font-mono text-[#958ea0] text-center">
                          Seat selection opens when this movie has a published screening.
                        </p>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#232938]/60 flex items-center justify-between text-xs font-mono">
                      <span className="text-[#958ea0]">{movie.priceFrom > 0 ? 'Tickets from' : 'Ticket pricing'}</span>
                      <span className="text-lg font-bold text-[#4edea3]">{movie.priceFrom > 0 ? `₹${movie.priceFrom}` : 'Check Showtimes'}</span>
                    </div>
                  </div>

                  {/* Right: Movie Theatres, Pricing Details, and Showtime Slots */}
                  <div className="flex-1 p-6 sm:p-7 flex flex-col justify-between gap-6">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[#4cd7f6]" />
                          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#cbc3d7]">
                            Movie Theatres & Showtimes ({selectedDateFilter || 'all upcoming dates'})
                          </h4>
                        </div>
                        <span className="text-[11px] font-mono text-[#4edea3]">
                          {displayTheatres.length > 0 ? `● ${displayTheatres.length} Cinema Hall${displayTheatres.length !== 1 ? 's' : ''} Showing` : 'No screenings listed for this date'}
                        </span>
                      </div>

                      {/* List of Theatres for this movie */}
                      <div className="space-y-4">
                        {hasCityMismatch && (
                          <div className="rounded-2xl border border-[#03b5d3]/40 bg-[#03b5d3]/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-[#4cd7f6]" />
                                Active screenings in {displayTheatres.map(t => t.city).filter(Boolean).join(', ')}
                              </span>
                              <p className="text-[11px] text-[#94a3b8] font-mono mt-0.5">
                                Showing verified screenings from other locations. You can choose seats and book below:
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedCity('All Locations')}
                              className="px-3 py-1.5 rounded-xl bg-[#03b5d3] text-[#001f26] font-mono text-[10px] font-bold shrink-0 hover:brightness-110 cursor-pointer"
                            >
                              Show All Locations
                            </button>
                          </div>
                        )}
                        {displayTheatres.length === 0 && (
                          <div className="rounded-2xl border border-[#232938] bg-[#0d0e12] p-5 space-y-2 text-center">
                            <p className="text-xs font-bold text-white">No published screenings yet</p>
                            <p className="text-xs text-[#94a3b8] leading-relaxed">
                              Upcoming screening dates and times will appear here after a cinema hall publishes its schedule.
                            </p>
                          </div>
                        )}
                        {displayTheatres.map(theatre => {
                          const displayShowtimes = theatre.showtimes || [];

                          return (
                            <div
                              key={theatre.id}
                              className="p-4 sm:p-5 rounded-2xl bg-[#0d0e12] border border-[#232938] hover:border-[#4cd7f6]/40 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                            >
                              {/* Theatre Info & Screen Details */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-base font-bold text-white hover:text-[#4cd7f6] transition-colors">
                                    {theatre.name}
                                  </span>
                                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#1e1f24] text-[#cbc3d7] border border-[#292a2e] flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-[#4cd7f6]" />
                                    {theatre.area ? `${theatre.area}, ` : ''}{theatre.city || 'Cinema Complex'}
                                  </span>
                                  {theatre.distanceText && (
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#4edea3]/15 text-[#4edea3] border border-[#4edea3]/30 shadow-[0_0_10px_rgba(78,222,163,0.15)]">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
                                      {theatre.distanceText}
                                    </span>
                                  )}
                                  <a
                                    href={theatre.directionsUrl || theatre.mapsUrl || getGoogleMapsUrl(theatre, userLocation)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open turn-by-turn directions in Google Maps"
                                    className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#03b5d3]/15 hover:bg-[#03b5d3]/30 text-[#4cd7f6] border border-[#03b5d3]/40 transition-all cursor-pointer"
                                  >
                                    <Navigation className="w-3 h-3 text-[#4cd7f6]" />
                                    <span>Directions</span>
                                    <ExternalLink className="w-2.5 h-2.5 text-[#4cd7f6] opacity-70" />
                                  </a>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#4edea3]/15 text-[#4edea3] border border-[#4edea3]/40 shadow-[0_0_10px_rgba(78,222,163,0.2)]">
                                    <ShieldCheck className="w-3.5 h-3.5 text-[#4edea3]" />
                                    Verified to Screen this Movie
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 text-xs font-mono text-[#94a3b8] mt-2 flex-wrap">
                                  <span className="text-[#4cd7f6] font-semibold">{theatre.screenName}</span>
                                  <span className="text-[#494454]">•</span>
                                  <span className="flex items-center gap-1 text-[#4edea3]">
                                    <Volume2 className="w-3.5 h-3.5" />
                                    {theatre.audioFormat || 'Dolby Atmos'}
                                  </span>
                                </div>

                                {/* 3-Tier Pricing Preview Bar */}
                                <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] font-mono">
                                  <span className="text-[#958ea0] font-bold">Ticket Pricing:</span>
                                  {theatre.ticketPrices?.map((tp, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2.5 py-1 rounded-lg bg-[#181c26] border border-[#232938] text-[#cbc3d7]"
                                    >
                                      {tp.tierName}: <strong className="text-[#4edea3] font-bold">₹{tp.price}</strong>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Timings Pills & Seat Booking CTA */}
                              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3 shrink-0">

                                {/* Showtime Pills */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {displayShowtimes.map((st, sIdx) => {
                                    const isAlmostFull = st.filling === 'almost_full';
                                    const isFast = st.filling === 'fast';

                                    return (
                                      <button
                                        key={sIdx}
                                        onClick={() => onSelectMovie(movie, {
                                          theatre: theatre.name,
                                          screen: theatre.screenName,
                                          day: st.date || selectedDateFilter,
                                          time: st.time,
                                          showId: st.showId,
                                          ticketPrices: theatre.ticketPrices,
                                          format: theatre.screenFormat || movie.format
                                        })}
                                        className={`group/time relative px-3 py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer flex flex-col items-center justify-center ${isAlmostFull
                                          ? 'bg-[#ffb4ab]/10 border-[#ffb4ab]/30 text-[#ffb4ab] hover:bg-[#ffb4ab]/20'
                                          : isFast
                                            ? 'bg-[#fbbf24]/10 border-[#fbbf24]/30 text-[#fbbf24] hover:bg-[#fbbf24]/20'
                                            : 'bg-[#181c26] border-[#232938] text-white hover:border-[#a078ff] hover:bg-[#201833]'
                                          }`}
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span className={`w-1.5 h-1.5 rounded-full ${isAlmostFull ? 'bg-[#ffb4ab]' : isFast ? 'bg-[#fbbf24]' : 'bg-[#4edea3]'
                                            }`} />
                                          <span>{st.time}</span>
                                        </div>
                                        <span className="text-[9px] font-normal opacity-70 mt-0.5">
                                          {new Date(`${st.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className="text-[9px] font-normal opacity-70">{st.status || 'Available'}</span>
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Direct Book CTA */}
                                <button
                                  onClick={() => onSelectMovie(movie, {
                                    theatre: theatre.name,
                                    screen: theatre.screenName,
                                    day: displayShowtimes[0]?.date || selectedDateFilter,
                                    time: displayShowtimes[0]?.time || '10:30 AM',
                                    showId: displayShowtimes[0]?.showId,
                                    ticketPrices: theatre.ticketPrices,
                                    format: theatre.screenFormat || movie.format
                                  })}
                                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white text-xs font-mono font-bold shadow-[0_0_16px_rgba(160,120,255,0.35)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                                >
                                  <span>Book Tickets · Choose Seats</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>

                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bottom Feature Guarantee Strip */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#958ea0] pt-2 border-t border-[#232938]/60">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#4edea3]" />
                        <span>Interactive Visual Seating • Zero Double-Booking Latency</span>
                      </div>
                      <span className="hidden sm:inline text-[#d0bcff]">Live Turnstile QR Pass</span>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </section>

      {/* USER ACCESS PORTAL & ROLE GATEWAYS (For visitors or role switching) */}
      <section className="w-full py-16 px-4 sm:px-6 lg:px-8 bg-[#0d0e12] border-t border-[#232938] mt-12">
        <div className="max-w-6xl mx-auto flex flex-col items-center">

          <div className="text-center mb-10 max-w-xl">
            <div className="inline-flex items-center gap-2 mb-2 text-xs font-mono uppercase text-[#a078ff] font-bold">
              <Sparkles className="w-4 h-4" />
              <span>Cinema Network Ecosystem</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">TIXORA Platform Access</h2>
            <p className="text-xs sm:text-sm text-[#94a3b8] font-mono mt-2">
              Join as a verified cinema exhibitor hall provider or access customer ticket passes with instant seating virtualization.
            </p>
          </div>

          {/* Gateway Access Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">

            {/* Card 1: Customer Access */}
            <div className="p-7 rounded-3xl bg-[#12151e] border border-[#232938] hover:border-[#8b5cf6] transition-all duration-300 shadow-2xl flex flex-col justify-between gap-6 relative group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8b5cf6] to-[#a078ff] flex items-center justify-center text-[#120038] shadow-[0_0_20px_rgba(139,92,246,0.4)]">
                    <User className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#8b5cf6]/15 text-[#d0bcff] border border-[#8b5cf6]/30 uppercase">
                    Moviegoer
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-white">Customer Portal</h3>
                <p className="text-xs text-[#94a3b8] font-mono mt-2 leading-relaxed">
                  Book tickets with live 0-latency seat selection, order gourmet popcorn to your seat, and unlock instant digital turnstile QR boarding passes.
                </p>

                <div className="mt-5 flex flex-col gap-2 text-xs font-mono text-[#cbc3d7]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4edea3]" />
                    <span>Real-time visual seat map hold concurrency</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4edea3]" />
                    <span>Instant Digital QR pass & turnstile check-in</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#232938] flex flex-col sm:flex-row items-center gap-3">
                {currentUser?.role === 'customer' ? (
                  <button
                    onClick={onNavigateToBookings}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white font-bold text-xs font-mono shadow-[0_0_20px_rgba(160,120,255,0.4)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>View My Bookings ({currentUser.name})</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onOpenAuth({ role: 'customer', isSignUp: true })}
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white font-bold text-xs font-mono shadow-[0_0_20px_rgba(160,120,255,0.4)] hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Customer Sign Up</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onOpenAuth({ role: 'customer', isSignUp: false })}
                      className="w-full sm:w-auto py-3 px-4 rounded-xl bg-[#181c26] hover:bg-[#292a2e] text-[#cbc3d7] hover:text-white font-bold text-xs font-mono border border-[#232938] transition-colors cursor-pointer"
                    >
                      Sign In
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Card 2: Cinema Hall Provider Access */}
            <div className="p-7 rounded-3xl bg-[#12151e] border border-[#232938] hover:border-[#03b5d3] transition-all duration-300 shadow-2xl flex flex-col justify-between gap-6 relative group">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#03b5d3] to-[#4cd7f6] flex items-center justify-center text-[#002b36] shadow-[0_0_20px_rgba(3,181,211,0.4)]">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#03b5d3]/15 text-[#4cd7f6] border border-[#03b5d3]/30 uppercase">
                    Cinema Hall Partner
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-white">Cinema Hall Provider Studio</h3>
                <p className="text-xs text-[#94a3b8] font-mono mt-2 leading-relaxed">
                  Design auditorium seat layouts in Visual Studio, authorize theatrical films for exhibition, adjust showtimings, and manage dynamic 3-tier pricing.
                </p>

                <div className="mt-5 flex flex-col gap-2 text-xs font-mono text-[#cbc3d7]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4cd7f6]" />
                    <span>Visual auditorium seat layout studio & tiering</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#4cd7f6]" />
                    <span>Show scheduling & 3-tier price customization</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#232938] flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={() => onOpenAuth({ role: 'partner', isSignUp: false })}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#03b5d3] to-[#0ea5e9] text-[#001f26] font-bold text-xs font-mono shadow-[0_0_20px_rgba(3,181,211,0.4)] hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Sign In as Partner</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

          {/* Admin Root Oversight Banner */}
          <div className="mt-8 w-full p-6 rounded-3xl bg-gradient-to-r from-[#14121e] via-[#1a1726] to-[#12151e] border border-[#d0bcff]/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#d0bcff] to-[#a078ff] flex items-center justify-center text-[#23005c] shadow-[0_0_20px_rgba(208,188,255,0.4)] shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#d0bcff]/20 text-[#d0bcff] border border-[#d0bcff]/40 uppercase tracking-wider">
                  Platform Administration
                </span>
                <h4 className="text-base sm:text-lg font-bold text-white mt-1">Admin Root Console</h4>
                <p className="text-xs text-[#94a3b8] font-mono">
                  Platform-wide oversight of listed shows, hall provider permissions, and booking volumes.
                </p>
              </div>
            </div>

            <button
              onClick={() => onOpenAuth({ role: 'admin', isSignUp: false })}
              className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-[#251d38] hover:bg-[#32274c] text-[#d0bcff] hover:text-white border border-[#d0bcff]/50 text-xs font-mono font-bold transition-all shadow-lg flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </button>
          </div>

        </div>
      </section>

      {/* Cinema Halls by City & Distance Directory Modal */}
      <CinemaHallsDirectoryModal
        isOpen={cinemasModalOpen}
        onClose={() => setCinemasModalOpen(false)}
        cinemas={availableCinemas}
        userLocation={userLocation}
        selectedCinemaId={selectedCinemaId}
        onSelectCinema={(id, city) => {
          setSelectedCinemaId(id);
          if (city) setSelectedCity(city);
        }}
        onRequestLocation={handleDetectLocation}
      />

    </div>
  );
}
