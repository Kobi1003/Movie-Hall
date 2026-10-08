import { useState, useMemo } from 'react';
import {
  X,
  Building2,
  MapPin,
  Navigation,
  ExternalLink,
  Search,
  LocateFixed,
  ShieldCheck,
  Check,
  Sparkles,
  Compass,
  ArrowUpDown,
  Phone,
  Film
} from 'lucide-react';
import { getGoogleMapsUrl } from '../utils/location.js';

export default function CinemaHallsDirectoryModal({
  isOpen,
  onClose,
  cinemas = [],
  userLocation,
  onSelectCinema,
  onRequestLocation,
  selectedCinemaId = 'ALL'
}) {
  const [search, setSearch] = useState('');
  const [selectedCityTab, setSelectedCityTab] = useState('ALL');
  const [sortBy, setSortBy] = useState('closest'); // 'closest' | 'name' | 'city'
  const [locating, setLocating] = useState(false);

  // Extract unique cities
  const cities = useMemo(() => {
    const list = Array.from(new Set(cinemas.map(c => c.city).filter(Boolean)));
    return list.sort();
  }, [cinemas]);

  // Filter and sort cinemas
  const processedCinemas = useMemo(() => {
    let filtered = cinemas;

    if (selectedCityTab !== 'ALL') {
      filtered = filtered.filter(c => (c.city || '').toLowerCase() === selectedCityTab.toLowerCase());
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(c =>
        (c.name || c.cinema_name || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.address || c.area || '').toLowerCase().includes(q)
      );
    }

    return [...filtered].sort((a, b) => {
      if (sortBy === 'closest') {
        if (a.distanceKm != null && b.distanceKm != null) {
          if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
        } else if (a.distanceKm != null) return -1;
        else if (b.distanceKm != null) return 1;
      }

      const cityA = (a.city || '').toLowerCase();
      const cityB = (b.city || '').toLowerCase();
      if (cityA !== cityB) return cityA.localeCompare(cityB);

      const nameA = (a.name || a.cinema_name || '').toLowerCase();
      const nameB = (b.name || b.cinema_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [cinemas, selectedCityTab, search, sortBy]);

  // Group by City
  const groupedByCity = useMemo(() => {
    const map = new Map();
    for (const c of processedCinemas) {
      const city = c.city || 'Other Locations';
      if (!map.has(city)) map.set(city, []);
      map.get(city).push(c);
    }
    return Array.from(map.entries());
  }, [processedCinemas]);

  const handleLocateClick = async () => {
    if (!onRequestLocation) return;
    setLocating(true);
    try {
      await onRequestLocation();
    } catch (_) {}
    finally {
      setLocating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-[#12151e] border border-[#232938] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#232938] bg-gradient-to-r from-[#181c26] to-[#12151e] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8b5cf6]/30 via-[#03b5d3]/20 to-[#4edea3]/20 border border-[#8b5cf6]/40 flex items-center justify-center text-[#d0bcff] shadow-[0_0_20px_rgba(139,92,246,0.3)]">
              <Building2 className="w-6 h-6 text-[#4cd7f6]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-white">Cinema Halls by City & Proximity</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#4edea3]/15 text-[#4edea3] border border-[#4edea3]/30 font-bold uppercase">
                  Google Maps Ready
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] font-mono mt-0.5">
                Explore theatres organized by cities, sorted with the closest locations nearest to you.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-[#1a1b20] hover:bg-[#292a2e] text-[#94a3b8] hover:text-white transition-colors cursor-pointer border border-[#292a2e]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Bar: Search, GPS Detect, Sort */}
        <div className="p-4 sm:p-5 border-b border-[#232938] bg-[#0d0e12]/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {/* Search */}
          <div className="flex-1 flex items-center gap-2 bg-[#12151e] border border-[#232938] px-3.5 py-2 rounded-xl focus-within:border-[#8b5cf6] transition-colors">
            <Search className="w-4 h-4 text-[#64748b]" />
            <input
              type="text"
              placeholder="Search cinema hall name, city, locality..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm text-white placeholder-[#64748b] outline-none w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[#64748b] hover:text-white text-xs">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* GPS Locate Button */}
          <button
            type="button"
            disabled={locating}
            onClick={handleLocateClick}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold border transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer ${
              userLocation
                ? 'bg-[#4edea3]/15 text-[#4edea3] border-[#4edea3]/40 shadow-[0_0_12px_rgba(78,222,163,0.2)]'
                : 'bg-[#03b5d3]/15 text-[#4cd7f6] hover:bg-[#03b5d3]/25 border-[#03b5d3]/40'
            }`}
          >
            <LocateFixed className={`w-4 h-4 ${locating ? 'animate-spin' : ''}`} />
            <span>{locating ? 'Locating...' : userLocation ? 'GPS Calibrated' : 'Detect My Location'}</span>
          </button>

          {/* Sort By Toggle */}
          <div className="flex items-center gap-1.5 bg-[#12151e] border border-[#232938] px-2.5 py-1.5 rounded-xl text-xs font-mono shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#958ea0]" />
            <span className="text-[#958ea0] hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-white font-semibold outline-none cursor-pointer"
            >
              <option value="closest" className="bg-[#181c26] text-white">Closest Locations 📍</option>
              <option value="city" className="bg-[#181c26] text-white">City (A-Z)</option>
              <option value="name" className="bg-[#181c26] text-white">Cinema Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* City Filter Pills Strip */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-[#232938] bg-[#0d0e12]/40 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
          <span className="text-[10px] font-mono uppercase font-bold text-[#958ea0] shrink-0 mr-1">Cities:</span>
          <button
            onClick={() => setSelectedCityTab('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
              selectedCityTab === 'ALL'
                ? 'bg-[#8b5cf6] text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]'
                : 'bg-[#181c26] text-[#94a3b8] hover:text-white border border-[#232938]'
            }`}
          >
            All Cities ({cinemas.length})
          </button>
          {cities.map((city) => {
            const count = cinemas.filter(c => c.city === city).length;
            const isSelected = selectedCityTab.toLowerCase() === city.toLowerCase();
            return (
              <button
                key={city}
                onClick={() => setSelectedCityTab(city)}
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#03b5d3] text-[#001f26] shadow-[0_0_12px_rgba(3,181,211,0.5)]'
                    : 'bg-[#181c26] text-[#94a3b8] hover:text-white border border-[#232938]'
                }`}
              >
                <span>{city}</span>
                <span className="text-[10px] opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {processedCinemas.length === 0 ? (
            <div className="py-16 text-center bg-[#0d0e12] border border-[#232938] rounded-2xl p-6">
              <Building2 className="w-12 h-12 text-[#494454] mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No cinema halls match your search</h3>
              <p className="text-xs font-mono text-[#94a3b8] mt-1">Try resetting the city tab or keyword filter.</p>
              <button
                onClick={() => { setSearch(''); setSelectedCityTab('ALL'); }}
                className="mt-4 px-4 py-2 rounded-xl bg-[#292a2e] text-white text-xs font-mono font-bold cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            groupedByCity.map(([city, hallList]) => (
              <div key={city} className="space-y-3">
                {/* City Section Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#232938]/60">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#4cd7f6]" />
                    <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                      {city}
                    </h3>
                    <span className="text-[11px] font-mono text-[#94a3b8] bg-[#1a1b20] px-2 py-0.5 rounded-full border border-[#232938]">
                      {hallList.length} Hall{hallList.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {userLocation && hallList[0]?.distanceText && (
                    <span className="text-[11px] font-mono text-[#4edea3]">
                      Closest in city: {hallList[0].distanceText}
                    </span>
                  )}
                </div>

                {/* Cinema Cards in this City */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {hallList.map((hall) => {
                    const id = hall.cinemaId || hall.id;
                    const name = hall.name || hall.cinema_name;
                    const isSelected = selectedCinemaId === id;
                    const mapsUrl = hall.directionsUrl || hall.mapsUrl || getGoogleMapsUrl(hall, userLocation);

                    return (
                      <div
                        key={id}
                        className={`p-4 rounded-2xl bg-[#0d0e12] border transition-all duration-200 flex flex-col justify-between gap-3 group ${
                          isSelected
                            ? 'border-[#8b5cf6] shadow-[0_0_20px_rgba(139,92,246,0.25)] bg-[#14121d]'
                            : 'border-[#232938] hover:border-[#4cd7f6]/50 hover:bg-[#12151e]'
                        }`}
                      >
                        <div>
                          {/* Top row: Name & Distance Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-sm font-bold text-white group-hover:text-[#4cd7f6] transition-colors">
                                  {name}
                                </h4>
                                {hall.type && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1e1f24] text-[#d0bcff] border border-[#292a2e] uppercase font-bold">
                                    {hall.type}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#94a3b8] font-mono mt-1 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-[#4cd7f6] shrink-0" />
                                <span className="line-clamp-2">{hall.address || hall.area || hall.city}</span>
                              </p>
                            </div>

                            {hall.distanceText ? (
                              <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#4edea3]/10 border border-[#4edea3]/30 text-[#4edea3] text-[11px] font-mono font-bold shadow-[0_0_10px_rgba(78,222,163,0.15)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
                                <span>{hall.distanceText}</span>
                              </div>
                            ) : (
                              <div className="shrink-0 px-2 py-0.5 rounded-lg bg-[#1e1f24] text-[#958ea0] text-[10px] font-mono">
                                {hall.city}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions Row: Google Maps Directions & Select Hall */}
                        <div className="pt-2 border-t border-[#232938]/60 flex items-center justify-between gap-2">
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#03b5d3]/15 hover:bg-[#03b5d3]/30 border border-[#03b5d3]/30 text-[#4cd7f6] text-xs font-mono font-bold transition-all"
                            title="Open in Google Maps for directions"
                          >
                            <Navigation className="w-3.5 h-3.5 text-[#4cd7f6]" />
                            <span>Directions (Google Maps)</span>
                            <ExternalLink className="w-3 h-3 text-[#4cd7f6] opacity-70" />
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              onSelectCinema(id, hall.city);
                              onClose();
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-[#8b5cf6] text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]'
                                : 'bg-[#1e1f24] hover:bg-[#292a2e] text-[#cbc3d7] hover:text-white border border-[#292a2e]'
                            }`}
                          >
                            <Film className="w-3.5 h-3.5" />
                            <span>{isSelected ? 'Selected' : 'View Shows'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-[#232938] bg-[#0d0e12] flex items-center justify-between text-xs font-mono text-[#94a3b8] shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4edea3]" />
            <span>Showing {processedCinemas.length} cinema hall{processedCinemas.length !== 1 ? 's' : ''} across {cities.length} city{cities.length !== 1 ? 'ies' : ''}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#1e1f24] hover:bg-[#292a2e] text-white text-xs font-mono font-bold transition-all cursor-pointer border border-[#292a2e]"
          >
            Close Directory
          </button>
        </div>
      </div>
    </div>
  );
}
