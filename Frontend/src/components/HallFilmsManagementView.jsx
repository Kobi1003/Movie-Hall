import React, { useState, useEffect } from 'react';
import {
  Film,
  Plus,
  Search,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Building2,
  ShieldCheck,
  Upload,
  Edit3,
  Eye,
  Layers,
  Users,
  TrendingUp,
  ArrowUpRight,
  Activity,
  Globe,
  Award,
  Lock,
  AlertTriangle,
  Tv,
  Image as ImageIcon,
  Calendar,
  Sparkles,
  Clapperboard,
  Trash2,
  Link as LinkIcon,
  UploadCloud,
} from 'lucide-react';
import { cinemasApi, moviesApi, seatPlansApi, showsApi } from '../api.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  AUTHORIZED: { label: 'Authorized', color: 'text-[#4edea3]', bg: 'bg-[#4edea3]/15', border: 'border-[#4edea3]/40', icon: CheckCircle2 },
  ACTIVE:     { label: 'Active',      color: 'text-[#4edea3]', bg: 'bg-[#4edea3]/15', border: 'border-[#4edea3]/40', icon: Activity },
  PENDING:    { label: 'Pending',     color: 'text-[#fbbf24]', bg: 'bg-[#fbbf24]/15', border: 'border-[#fbbf24]/40', icon: Clock },
  PENDING_REVIEW: { label: 'Awaiting Admin Review', color: 'text-[#fbbf24]', bg: 'bg-[#fbbf24]/15', border: 'border-[#fbbf24]/40', icon: Clock },
  DRAFT:      { label: 'Draft',       color: 'text-[#94a3b8]', bg: 'bg-[#94a3b8]/10', border: 'border-[#94a3b8]/30', icon: Edit3 },
  REVOKED:    { label: 'Revoked',     color: 'text-[#f87171]', bg: 'bg-[#f87171]/15', border: 'border-[#f87171]/40', icon: XCircle },
  APPROVED:   { label: 'Approved',    color: 'text-[#4edea3]', bg: 'bg-[#4edea3]/15', border: 'border-[#4edea3]/40', icon: CheckCircle2 },
  EXPIRED:    { label: 'Expired',     color: 'text-[#64748b]', bg: 'bg-[#64748b]/15', border: 'border-[#64748b]/30', icon: XCircle },
};

function StatusBadge({ status, sm }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-mono font-bold uppercase tracking-wide ${cfg.bg} ${cfg.color} ${cfg.border} ${sm ? 'text-[9px]' : 'text-[10px]'}`}>
      <Icon className={sm ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {cfg.label}
    </span>
  );
}

function VerificationNoticeModal({ isOpen, onClose, title = "Movie-Hall Verification In Progress", message = "Your movie-hall is under verification... it will be approved if properly verified" }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 animate-in fade-in duration-200">
      <div className="bg-[#12151e] border border-[#fbbf24]/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-[0_0_50px_rgba(251,191,36,0.15)] space-y-5 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-2 bg-gradient-to-r from-transparent via-[#fbbf24] to-transparent" />
        
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#fbbf24]/15 border border-[#fbbf24]/30 flex items-center justify-center text-[#fbbf24]">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-3 py-1 rounded-full bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/30">
            Official Compliance & Verification
          </span>
          <h3 className="text-xl font-extrabold text-white mt-3">
            {title}
          </h3>
          <p className="text-sm font-semibold text-[#fbbf24] mt-3 leading-relaxed">
            "{message}"
          </p>
          <p className="text-xs text-[#958ea0] mt-2 font-mono leading-relaxed">
            Our Super Admin compliance team is reviewing the submitted details and statutory certificates. Once verified and approved on the Admin Console, your movie-hall and films will be live for customer booking.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] hover:brightness-110 text-[#1e1300] font-bold text-xs font-mono tracking-wider shadow-[0_0_20px_rgba(251,191,36,0.3)] transition-all cursor-pointer"
          >
            Understood & Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

function fmt(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString()}`;
}

const TABS = [
  { id: 'catalog',       label: 'Film Catalog',                icon: Film },
  { id: 'add-film',      label: 'Add / Edit Film',              icon: Plus },
  { id: 'authorization', label: 'Cinema Screen Authorization',  icon: Building2 },
];

// ── Tab 1: Film Catalog Dashboard ──────────────────────────────────────────────
function FilmCatalog({ films, onSelectFilm, onAddFilm }) {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const statuses = ['ALL', 'AUTHORIZED', 'ACTIVE', 'PENDING_REVIEW', 'PENDING', 'DRAFT', 'REVOKED'];
  const filtered = films.filter(f =>
    (filter === 'ALL' || f.status === filter) &&
    (f.title.toLowerCase().includes(search.toLowerCase()) || f.distributor.toLowerCase().includes(search.toLowerCase()))
  );

  const totalRevenue = films.reduce((s, f) => s + f.totalRevenue, 0);
  const authorized = films.filter(f => ['AUTHORIZED', 'ACTIVE'].includes(f.status)).length;
  const pending = films.filter(f => ['PENDING', 'PENDING_REVIEW'].includes(f.status)).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Titles', value: films.length, icon: Film, color: '#03b5d3', glow: '#03b5d3' },
          { label: 'Active Authorizations', value: authorized, icon: CheckCircle2, color: '#4edea3', glow: '#4edea3' },
          { label: 'Pending Approval', value: pending, icon: Clock, color: '#fbbf24', glow: '#f59e0b' },
          { label: 'Total Box Office', value: fmt(totalRevenue), icon: TrendingUp, color: '#a78bfa', glow: '#8b5cf6' },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-2xl bg-[#12151e] border border-[#232938] flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl pointer-events-none" style={{ background: `${s.glow}18` }} />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#94a3b8]">{s.label}</span>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <span className="text-2xl font-extrabold text-white">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-1 bg-[#12151e] border border-[#232938] rounded-xl p-1 flex-wrap">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${filter === s ? 'bg-[#03b5d3] text-[#001f26]' : 'text-[#94a3b8] hover:text-white'}`}
            >
              {s === 'ALL' ? 'All' : STATUS_CONFIG[s]?.label}
            </button>
          ))}
        </div>
        <div className="flex-1 flex items-center gap-2 bg-[#12151e] border border-[#232938] rounded-xl px-3 py-2 focus-within:border-[#03b5d3] transition-colors w-full">
          <Search className="w-4 h-4 text-[#64748b]" />
          <input
            type="text"
            placeholder="Search films, directors, distributors…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-[#64748b] outline-none flex-1"
          />
        </div>
        <button
          onClick={onAddFilm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#03b5d3] to-[#0ea5e9] text-[#001f26] font-bold text-xs font-mono shadow-[0_0_20px_rgba(3,181,211,0.35)] hover:brightness-110 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add New Film
        </button>
      </div>

      {/* Film Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map(film => (
          <div
            key={film.id}
            className="group rounded-2xl bg-[#12151e] border border-[#232938] hover:border-[#03b5d3]/60 transition-all duration-300 overflow-hidden cursor-pointer shadow-lg flex flex-col"
            onClick={() => onSelectFilm(film)}
          >
            {/* Poster strip */}
            <div className="relative h-36 overflow-hidden bg-[#0d0e12]">
              <img
                src={film.posterUrl || film.poster_path || film.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80'}
                alt={film.title}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80';
                }}
                className="w-full h-full object-cover opacity-60 group-hover:opacity-85 group-hover:scale-105 transition-all duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#12151e] via-transparent to-transparent" />
              <div className="absolute top-2 right-2">
                <StatusBadge status={film.status} sm />
              </div>
              <div className="absolute bottom-2 left-3 flex gap-1 flex-wrap">
                {film.formats.slice(0, 3).map(f => (
                  <span key={f} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-[#4cd7f6] border border-[#03b5d3]/30 uppercase">{f}</span>
                ))}
              </div>
            </div>

            <div className="p-4 flex flex-col gap-3 flex-1 justify-between">
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">{film.title}</h3>
                <p className="text-[10px] text-[#64748b] font-mono mt-0.5">{film.director} • {film.duration} • {film.certification}</p>
                <p className="text-[10px] text-[#fbbf24] font-mono mt-0.5">Producer: {film.producer || film.producerName || '—'}</p>
                <p className="text-[10px] text-[#4cd7f6] font-mono mt-0.5">Distributor: {film.distributor}</p>
                <p className="text-[10px] text-[#64748b] font-mono mt-1">Release: {film.releaseDate || '—'} · Suggested time: {film.defaultStartTime || '—'}</p>
                <p className="text-[10px] text-[#4edea3] font-mono mt-0.5">{film.scheduledScreenings?.length ? `${film.scheduledScreenings.length} scheduled screening${film.scheduledScreenings.length === 1 ? '' : 's'} · ${film.scheduledScreenings.map(show => `${show.date} ${show.time}`).join(' · ')}` : 'No screenings scheduled yet'}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Halls', value: film.assignedHalls },
                  { label: 'Screens', value: film.totalScreens },
                  { label: 'Occupancy', value: film.weeklyOccupancy ? `${film.weeklyOccupancy}%` : '—' },
                ].map(m => (
                  <div key={m.label} className="bg-[#0d0e12] rounded-lg p-2">
                    <div className="text-xs font-extrabold text-white">{m.value}</div>
                    <div className="text-[9px] font-mono text-[#64748b] uppercase">{m.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#232938]">
                <span className="text-[10px] font-mono text-[#4edea3] font-bold">{film.totalRevenue > 0 ? fmt(film.totalRevenue) : 'Pending Schedule'}</span>
                <span className="text-xs text-[#64748b] group-hover:text-[#03b5d3] transition-colors flex items-center gap-1 font-mono">
                  Manage <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab 2: Add / Edit Film Metadata ────────────────────────────────────────────
function AddFilmTab({ selectedFilm, onSaveFilm, onPublish }) {
  const isEdit = !!selectedFilm;
  const [title, setTitle]           = useState(selectedFilm?.title || '');
  const [director, setDirector]     = useState(selectedFilm?.director || '');
  const [producer, setProducer]     = useState(selectedFilm?.producer || '');
  const [distributor, setDistributor] = useState(selectedFilm?.distributor || 'Astra Distribution India Pvt. Ltd.');
  const [duration, setDuration]     = useState(selectedFilm?.duration || '');
  const [cert, setCert]             = useState(selectedFilm?.certification || 'UA');
  const [cbfc, setCbfc]             = useState(selectedFilm?.cbfcNumber || '');
  const [lang, setLang]             = useState(selectedFilm?.language || '');
  const [synopsis, setSynopsis]     = useState(selectedFilm?.synopsis || '');
  const [releaseDate, setRelease]   = useState(selectedFilm?.releaseDate || '');
  const [defaultStartTime, setDefaultStartTime] = useState(selectedFilm?.defaultStartTime?.slice(0, 5) || '19:00');
  const initialPoster = selectedFilm?.posterUrl || selectedFilm?.poster_path || selectedFilm?.poster || '';
  const [posterUrl, setPosterUrl]   = useState(initialPoster);
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState(initialPoster);
  const [posterInputMode, setPosterInputMode] = useState('upload'); // 'upload' | 'url'
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [saved, setSaved]           = useState(false);
  const [saveError, setSaveError]   = useState('');
  const [screenWarning, setScreenWarning] = useState('');
  const [screens, setScreens]       = useState([]);
  const [selectedScreenId, setSelectedScreenId] = useState('');
  const [seatRows, setSeatRows] = useState(['A', 'B', 'C', 'D', 'E'].map((name, idx) => ({
    name,
    seats: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, active: true })),
    tier: idx === 0 ? 'VIP' : idx === 1 ? 'Premium' : 'Standard'
  })));
  const [isSaving, setIsSaving] = useState(false);
  const [seatPrices, setSeatPrices] = useState({ Standard: 350, Premium: 450, VIP: 650 });
  const [activeSeatTier, setActiveSeatTier] = useState('Standard');
  const [certificateFiles, setCertificateFiles] = useState({ cbfc: null, distribution: null });
  const [savedDocuments, setSavedDocuments] = useState([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(!selectedFilm?.id);

  const SAMPLE_POSTERS = [
    { label: 'Sci-Fi Action', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80' },
    { label: 'Cyberpunk Neon', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80' },
    { label: 'Cinematic Noir', url: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=800&q=80' },
    { label: 'Epic IMAX', url: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=800&q=80' },
  ];

  useEffect(() => {
    if (selectedFilm) {
      setTitle(selectedFilm.title || '');
      setDirector(selectedFilm.director || '');
      setProducer(selectedFilm.producer || '');
      setDistributor(selectedFilm.distributor || 'Astra Distribution India Pvt. Ltd.');
      setDuration(selectedFilm.duration || '');
      setCert(selectedFilm.certification || 'UA');
      setCbfc(selectedFilm.cbfcNumber || '');
      setLang(selectedFilm.language || '');
      setSynopsis(selectedFilm.synopsis || '');
      setRelease(selectedFilm.releaseDate || '');
      setDefaultStartTime(selectedFilm.defaultStartTime?.slice(0, 5) || '19:00');
      setFormats(selectedFilm.formats?.length ? selectedFilm.formats : ['Standard 2D']);
      const currentPoster = selectedFilm.posterUrl || selectedFilm.poster_path || selectedFilm.poster || '';
      setPosterUrl(currentPoster);
      setPosterPreview(currentPoster);
      setPosterFile(null);
    } else {
      setTitle('');
      setDirector('');
      setProducer('');
      setDistributor('Astra Distribution India Pvt. Ltd.');
      setDuration('');
      setCert('UA');
      setCbfc('');
      setLang('');
      setSynopsis('');
      setRelease('');
      setDefaultStartTime('19:00');
      setFormats(['Standard 2D']);
      setPosterUrl('');
      setPosterPreview('');
      setPosterFile(null);
    }
  }, [selectedFilm]);

  useEffect(() => {
    let cancelled = false;
    cinemasApi.screens().then(data => {
      if (cancelled || !Array.isArray(data)) return;
      setScreens(data.filter(screen => screen.is_active));
      if (!selectedScreenId && data[0]?.id) setSelectedScreenId(data[0].id);
    }).catch(err => {
      if (!cancelled) setScreenWarning(`No cinema screen is linked yet. The film can still be published; add a cinema hall before scheduling shows.`);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedFilm?.id) return;
    let cancelled = false;
    moviesApi.getDocuments(selectedFilm.id)
      .then(docs => { if (!cancelled) setSavedDocuments(Array.isArray(docs) ? docs : []); })
      .catch(err => { if (!cancelled) setSaveError(`Could not load saved certificates: ${err.message}`); })
      .finally(() => { if (!cancelled) setDocumentsLoaded(true); });
    return () => { cancelled = true; };
  }, [selectedFilm?.id]);

  const FORMAT_OPTIONS = ['IMAX 3D', 'IMAX 2D', 'IMAX 70mm', 'Dolby Atmos', '4DX', 'ScreenX', 'HFR 48fps', 'Standard 2D', 'Live Satellite 4K'];

  const toggleFormat = (f) => setFormats(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const handlePosterFileChange = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSaveError('Please select a valid image file (JPG, PNG, WEBP, or GIF).');
      return;
    }
    setPosterFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setPosterPreview(dataUrl);
      setPosterUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e, isDraft = false) => {
    if (e) e.preventDefault();
    setSaveError('');
    if (!documentsLoaded) {
      setSaveError('Please wait while the saved certificates load.');
      return;
    }
    const certificateRequirements = [
      { type: 'CBFC_CERTIFICATE', fileKey: 'cbfc', label: 'CBFC certificate' },
      { type: 'DISTRIBUTION_DEED', fileKey: 'distribution', label: 'distribution authorization certificate' },
    ];
    const missingCertificate = certificateRequirements.find(({ type, fileKey }) =>
      !certificateFiles[fileKey] && !savedDocuments.some(doc => doc.document_type === type)
    );
    if (!isDraft && missingCertificate) {
      setSaveError(`Upload the ${missingCertificate.label} before submitting for admin review. Or click 'Save as Draft' to save with the poster first.`);
      return;
    }

    setIsSaving(true);
    let finalPoster = posterUrl || posterPreview;
    if (posterFile) {
      try {
        setIsUploadingPoster(true);
        const uploadRes = await moviesApi.uploadPoster(posterFile);
        if (uploadRes?.posterUrl) {
          finalPoster = uploadRes.posterUrl;
          setPosterUrl(uploadRes.posterUrl);
          setPosterPreview(uploadRes.posterUrl);
        }
      } catch (uploadErr) {
        console.warn('Poster upload fallback to local preview/dataUrl:', uploadErr.message);
        if (!finalPoster) finalPoster = posterPreview;
      } finally {
        setIsUploadingPoster(false);
      }
    }

    if (!finalPoster) {
      finalPoster = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80';
    }

    const filmData = {
      id: selectedFilm?.id,
      title,
      director,
      producer,
      producerName: producer,
      distributor: distributor || 'PVR Inox Pictures Ltd.',
      language: lang,
      duration,
      certification: cert,
      cbfcNumber: cbfc,
      releaseDate,
      defaultStartTime: defaultStartTime || null,
      synopsis,
      formats: formats.length ? formats : ['Standard 2D'],
      status: isDraft ? 'DRAFT' : (selectedFilm?.status || 'PENDING_REVIEW'),
      posterUrl: finalPoster,
      posterPath: finalPoster,
      poster: finalPoster,
      assignedHalls: selectedFilm?.assignedHalls || 0,
      totalScreens: selectedFilm?.totalScreens || screens.length,
      weeklyOccupancy: selectedFilm?.weeklyOccupancy || 0,
      totalRevenue: selectedFilm?.totalRevenue || 0,
    };

    try {
      const storedFilm = await onSaveFilm(filmData);
      if (!storedFilm?.id) throw new Error('Film could not be saved to Supabase.');
      for (const { type, fileKey } of certificateRequirements) {
        const file = certificateFiles[fileKey];
        if (!file) continue;
        const uploaded = await moviesApi.uploadDocument(storedFilm.id, file, type);
        setSavedDocuments(prev => [uploaded, ...prev.filter(doc => doc.document_type !== type)]);
        setCertificateFiles(prev => ({ ...prev, [fileKey]: null }));
      }
      if (selectedScreenId) {
        const selectedScreen = screens.find(s => s.id === selectedScreenId);
        try {
          const layoutData = {
            name: `${title} Auditorium Layout`, canvasWidth: 1000, canvasHeight: Math.max(600, seatRows.length * 60 + 160),
            screenPosition: 'TOP',
            sections: [{ name: 'Main Hall', displayName: 'Main Auditorium', sortOrder: 0 }],
            categories: Object.entries(seatPrices).map(([name, basePrice]) => ({
              name, displayName: name, basePrice, seatType: name === 'Standard' ? 'STANDARD' : name.toUpperCase()
            })),
            seats: seatRows.flatMap((row, rowIndex) => row.seats.filter(seat => seat.active).map(seat => ({
              rowLabel: row.name, seatNumber: seat.number, categoryName: row.tier,
              sectionName: 'Main Hall', seatType: row.tier === 'Standard' ? 'STANDARD' : row.tier.toUpperCase(),
              xPosition: 60 + (seat.number - 1) * 48, yPosition: 120 + rowIndex * 60,
              width: 32, height: 32
            })))
          };
          const result = await seatPlansApi.save(selectedScreenId, layoutData);
          if (!result?.version?.id) throw new Error('Seat plan was not saved.');
          await seatPlansApi.publish(selectedScreenId, result.version.id);

          // Schedule screening so tickets are immediately bookable on this date and time
          if (selectedScreen?.cinema_id) {
            try {
              const todayStr = new Date().toISOString().slice(0, 10);
              const showDate = (!releaseDate || releaseDate < todayStr) ? todayStr : releaseDate;
              const startTime = (defaultStartTime || '19:00').slice(0, 5) + ':00';
              await showsApi.create({
                movieId: storedFilm.id,
                cinemaId: selectedScreen.cinema_id,
                screenId: selectedScreenId,
                showDate,
                startTime,
                endTime: '22:00:00',
                language: lang || 'Hindi',
                format: formats[0] || 'Standard 2D',
                priceTiers: Object.entries(seatPrices).map(([name, price]) => ({
                  tierName: name,
                  price: Number(price)
                }))
              });
            } catch (showErr) {
              console.warn('Auto show scheduling note:', showErr.message);
              setScreenWarning(`Screening scheduling notice: ${showErr.message}`);
            }
          }
        } catch (error) {
          setScreenWarning(`The film was saved, but the auditorium seat plan could not be updated: ${error.message}`);
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (!isEdit) onPublish?.(storedFilm);
    } catch (err) {
      setSaveError(err.message || 'Could not save the film and its certificates.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center gap-3 pb-4 border-b border-[#232938]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#03b5d3] to-[#0ea5e9] flex items-center justify-center text-[#001f26]">
          <Film className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-extrabold text-white">{isEdit ? 'Edit Theatrical Film' : 'Add New Film to Hall Catalog'}</h3>
          <p className="text-[10px] font-mono text-[#64748b]">Registered titles can be directly allotted to auditorium screens and show slots with custom poster art.</p>
        </div>
        {isEdit && <StatusBadge status={selectedFilm.status} />}
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#4edea3]/15 border border-[#4edea3]/40 text-[#4edea3] text-xs font-mono">
          <CheckCircle2 className="w-4 h-4" />
          Film changes and artwork saved successfully.
        </div>
      )}

      {/* ── SECTION 1: MOVIE POSTER & THEATRICAL KEY ARTWORK ── */}
      <div className="p-5 rounded-2xl bg-[#12151e] border border-[#232938] hover:border-[#03b5d3]/40 transition-all flex flex-col gap-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#232938]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#03b5d3]/15 text-[#4cd7f6] flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                Movie Poster & Key Artwork
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#03b5d3]/15 text-[#4cd7f6] border border-[#03b5d3]/30">Input & Live Card</span>
              </h4>
              <p className="text-[10px] font-mono text-[#64748b]">Upload an image file or provide a web URL. Displays across customer booking cards, passes, and schedule boards.</p>
            </div>
          </div>
          
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#0d0e12] p-1 rounded-xl border border-[#232938] self-start sm:self-auto text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setPosterInputMode('upload')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                posterInputMode === 'upload'
                  ? 'bg-[#03b5d3] text-[#001f26] shadow-[0_0_12px_rgba(3,181,211,0.4)]'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <Upload className="w-3 h-3" /> Upload File
            </button>
            <button
              type="button"
              onClick={() => setPosterInputMode('url')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                posterInputMode === 'url'
                  ? 'bg-[#03b5d3] text-[#001f26] shadow-[0_0_12px_rgba(3,181,211,0.4)]'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <LinkIcon className="w-3 h-3" /> Image URL
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          {/* Left: Upload / URL inputs */}
          <div className="md:col-span-7 flex flex-col justify-between gap-4">
            {posterInputMode === 'upload' ? (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="movie-poster-file-input"
                  className="group relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-[#232938] hover:border-[#03b5d3] bg-[#0d0e12]/80 hover:bg-[#03b5d3]/5 transition-all cursor-pointer text-center min-h-[160px]"
                >
                  <input
                    id="movie-poster-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => handlePosterFileChange(e.target.files?.[0])}
                  />
                  <div className="w-12 h-12 rounded-xl bg-[#03b5d3]/10 text-[#4cd7f6] group-hover:scale-110 flex items-center justify-center transition-transform mb-2">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-white group-hover:text-[#4cd7f6] transition-colors">
                    {posterFile ? posterFile.name : 'Click to select or drag & drop movie poster'}
                  </p>
                  <span className="text-[10px] text-[#64748b] font-mono mt-1">
                    Supports JPG, PNG, WEBP · Vertical 2:3 aspect ratio recommended (e.g. 600×900px)
                  </span>
                  {posterFile && (
                    <span className="mt-2 text-[10px] font-mono text-[#4edea3] flex items-center gap-1 bg-[#4edea3]/10 px-2.5 py-0.5 rounded-full border border-[#4edea3]/30">
                      <CheckCircle2 className="w-3 h-3" /> File ready ({(posterFile.size / 1024).toFixed(0)} KB)
                    </span>
                  )}
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-mono text-[#94a3b8] flex items-center justify-between">
                  <span>Direct Poster Image URL</span>
                  <span className="text-[10px] text-[#64748b]">HTTPS Web Link</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-[#0d0e12] border border-[#232938] rounded-xl px-3 py-2.5 focus-within:border-[#03b5d3] transition-colors">
                    <LinkIcon className="w-4 h-4 text-[#64748b] shrink-0" />
                    <input
                      type="url"
                      value={posterUrl}
                      onChange={(e) => {
                        setPosterUrl(e.target.value);
                        setPosterPreview(e.target.value);
                        setPosterFile(null);
                      }}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="bg-transparent text-xs text-white placeholder-[#64748b] outline-none flex-1 font-mono"
                    />
                  </div>
                  {posterUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setPosterUrl('');
                        setPosterPreview('');
                      }}
                      className="p-2.5 rounded-xl border border-[#232938] text-[#94a3b8] hover:text-[#ffb4ab] hover:border-[#ffb4ab]/40 bg-[#0d0e12] transition-colors cursor-pointer"
                      title="Clear URL"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-[#64748b] font-mono">
                  Paste any high-resolution promotional artwork URL or web hosted image.
                </p>
              </div>
            )}

            {/* Quick Sample Presets */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-[#232938]">
              <span className="text-[10px] font-mono text-[#64748b]">Quick Preset Artwork Samples:</span>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_POSTERS.map((sample) => (
                  <button
                    type="button"
                    key={sample.label}
                    onClick={() => {
                      setPosterUrl(sample.url);
                      setPosterPreview(sample.url);
                      setPosterFile(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono transition-all cursor-pointer ${
                      posterPreview === sample.url
                        ? 'bg-[#03b5d3]/20 border-[#03b5d3] text-[#4cd7f6] font-bold shadow-sm'
                        : 'bg-[#0d0e12] border-[#232938] text-[#94a3b8] hover:border-[#03b5d3]/40'
                    }`}
                  >
                    {sample.label}
                  </button>
                ))}
                {posterPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setPosterUrl('');
                      setPosterPreview('');
                      setPosterFile(null);
                    }}
                    className="px-2 py-1 rounded-lg border border-[#232938] text-[9px] font-mono text-[#ffb4ab] hover:bg-[#ffb4ab]/10 cursor-pointer"
                  >
                    Clear Art
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Live Interactive Theatrical Poster Preview Card */}
          <div className="md:col-span-5 flex flex-col">
            <div className="relative rounded-2xl overflow-hidden border border-[#232938] bg-[#090b0e] shadow-2xl flex flex-col h-full min-h-[250px] group">
              {posterPreview ? (
                <img
                  src={posterPreview}
                  alt="Movie poster live preview"
                  onError={() => {}}
                  className="w-full h-full object-cover absolute inset-0 opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500"
                />
              ) : (
                <div className="w-full h-full absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#12151e] via-[#0d0e12] to-[#181c26] p-4 text-center">
                  <Film className="w-10 h-10 text-[#232938] mb-2" />
                  <span className="text-[11px] font-mono text-[#64748b]">No poster selected yet</span>
                  <span className="text-[9px] font-mono text-[#475569] mt-0.5">Upload a poster or pick a sample</span>
                </div>
              )}

              {/* Gradient vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#090b0e] via-[#090b0e]/50 to-transparent pointer-events-none" />

              {/* Top Badges */}
              <div className="relative p-3 flex items-center justify-between z-10">
                <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[9px] font-mono font-bold text-[#4cd7f6] border border-[#03b5d3]/40">
                  {cert || 'UA'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#4edea3]/20 backdrop-blur-md text-[8px] font-mono font-bold text-[#4edea3] border border-[#4edea3]/40 uppercase">
                  Live Poster Card
                </span>
              </div>

              {/* Bottom Live Card Info: Title, Producer, Date & Time */}
              <div className="relative mt-auto p-3.5 flex flex-col gap-1.5 z-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
                <h5 className="text-xs font-extrabold text-white leading-tight line-clamp-1 drop-shadow">
                  {title || 'Untitled Theatrical Title'}
                </h5>

                {/* Live Producer Name Display */}
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#fbbf24]">
                  <Clapperboard className="w-3 h-3 shrink-0" />
                  <span className="truncate">Producer: <strong className="text-white">{producer || 'TBA'}</strong></span>
                </div>

                {/* Live Date and Time Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 text-[8px] font-mono text-[#4cd7f6] border border-[#03b5d3]/30">
                    <Calendar className="w-2.5 h-2.5" /> {releaseDate || 'YYYY-MM-DD'}
                  </span>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 text-[8px] font-mono text-[#4edea3] border border-[#4edea3]/30">
                    <Clock className="w-2.5 h-2.5" /> {defaultStartTime || '19:00'}
                  </span>
                  {lang && (
                    <span className="px-1.5 py-0.5 rounded bg-black/70 text-[8px] font-mono text-[#94a3b8] border border-white/10">
                      {lang}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: PRODUCTION & THEATRICAL METADATA ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        {/* Title */}
        <div className="md:col-span-2 flex flex-col gap-1.5">
          <label className="text-[#94a3b8] flex items-center justify-between">
            <span>Film Title *</span>
            <span className="text-[10px] text-[#64748b]">Official Exhibition Name</span>
          </label>
          <input required value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Avatar: Fire and Ash"
            className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2.5 text-white placeholder-[#64748b] outline-none focus:border-[#03b5d3] transition-colors" />
        </div>

        {/* Producer Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8] flex items-center gap-1.5">
            <Clapperboard className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span>Producer / Studio Name *</span>
          </label>
          <input required value={producer} onChange={e => setProducer(e.target.value)}
            placeholder="e.g. Dharma Productions / Christopher Nolan"
            className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2.5 text-white placeholder-[#64748b] outline-none focus:border-[#03b5d3] transition-colors" />
          <span className="text-[9px] text-[#64748b]">Credited producer or production studio.</span>
        </div>

        {/* Director */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8]">Director *</label>
          <input required value={director} onChange={e => setDirector(e.target.value)}
            placeholder="e.g. James Cameron"
            className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2.5 text-white placeholder-[#64748b] outline-none focus:border-[#03b5d3] transition-colors" />
        </div>

        {/* Distributor */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8]">Film Distributor / Rights Holder *</label>
          <input required value={distributor} onChange={e => setDistributor(e.target.value)}
            placeholder="e.g. Astra Distribution / Warner Bros."
            className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2.5 text-white placeholder-[#64748b] outline-none focus:border-[#03b5d3] transition-colors" />
        </div>

        {/* Primary Language */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8]">Primary Language *</label>
          <input required value={lang} onChange={e => setLang(e.target.value)}
            placeholder="e.g. English, Hindi, Telugu"
            className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2.5 text-white placeholder-[#64748b] outline-none focus:border-[#03b5d3] transition-colors" />
        </div>

        {/* Duration */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8]">Duration *</label>
          <input required value={duration} onChange={e => setDuration(e.target.value)}
            placeholder="e.g. 2h 49m"
            className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2.5 text-white placeholder-[#64748b] outline-none focus:border-[#03b5d3] transition-colors" />
        </div>

        {/* CBFC Certification */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8]">CBFC Certification</label>
          <select value={cert} onChange={e => setCert(e.target.value)}
            className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#03b5d3] transition-colors cursor-pointer">
            {['U', 'UA', 'UA 7+', 'UA 13+', 'UA 16+', 'A', 'S', 'Open All'].map(c => <option key={c} className="bg-[#12151e]">{c}</option>)}
          </select>
        </div>

        {/* CBFC Certificate Number */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8]">CBFC Certificate Number</label>
          <input value={cbfc} onChange={e => setCbfc(e.target.value)}
            placeholder="e.g. CBFC/MUM/2026/4821"
            className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2.5 text-white placeholder-[#64748b] outline-none focus:border-[#03b5d3] transition-colors" />
        </div>

        {/* Theatrical Release Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#4cd7f6]" />
            <span>Theatrical Release Date *</span>
          </label>
          <input required type="date" value={releaseDate} onChange={e => setRelease(e.target.value)}
            className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#03b5d3] transition-colors cursor-pointer" />
          <span className="text-[9px] text-[#64748b]">Exhibition start date in your cinema hall.</span>
        </div>

        {/* Suggested Movie Start Time */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#94a3b8] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#4edea3]" />
            <span>Suggested Screening / Show Start Time</span>
          </label>
          <input type="time" value={defaultStartTime} onChange={e => setDefaultStartTime(e.target.value)}
            className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#03b5d3] transition-colors cursor-pointer" />
          <span className="text-[9px] text-[#64748b]">Default slot time when scheduling shows in your hall screens.</span>
        </div>

        {/* Synopsis */}
        <div className="md:col-span-2 flex flex-col gap-1.5">
          <label className="text-[#94a3b8]">Synopsis / Theatrical Overview</label>
          <textarea value={synopsis} onChange={e => setSynopsis(e.target.value)} rows={3}
            placeholder="Brief overview for cinema audience and schedule displays…"
            className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2.5 text-white placeholder-[#64748b] outline-none focus:border-[#03b5d3] transition-colors resize-none" />
        </div>

        {/* Format Certifications */}
        <div className="md:col-span-2 flex flex-col gap-2">
          <label className="text-[#94a3b8]">Authorized Exhibition Formats</label>
          <div className="flex flex-wrap gap-2">
            {FORMAT_OPTIONS.map(f => (
              <button
                type="button"
                key={f}
                onClick={() => toggleFormat(f)}
                className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  formats.includes(f)
                    ? 'bg-[#03b5d3]/20 text-[#4cd7f6] border-[#03b5d3]/60'
                    : 'bg-[#0d0e12] text-[#64748b] border-[#232938] hover:border-[#03b5d3]/40'
                }`}
              >
                {formats.includes(f) && '✓ '}{f}
              </button>
            ))}
          </div>
        </div>

        {screens.length > 0 && <div className="md:col-span-2 p-4 rounded-2xl bg-[#12151e] border border-[#232938] flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[#94a3b8] font-bold">Auditorium Seat Planner</label>
          <span className="text-[10px] text-[#64748b]">Configure rows and seat tiers for a real screen. Click seats to include or remove them; the layout is saved to Supabase.</span>
          </div>
          <select value={selectedScreenId} onChange={e => setSelectedScreenId(e.target.value)}
            className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#03b5d3]">
            <option value="">Select an auditorium screen</option>
            {screens.map(screen => <option key={screen.id} value={screen.id}>{screen.screen_name} · {screen.capacity || 0} seats</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            {Object.keys(seatPrices).map(tier => (
              <button type="button" key={tier} onClick={() => setActiveSeatTier(tier)}
                className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono ${activeSeatTier === tier ? 'bg-[#03b5d3]/20 text-[#4cd7f6] border-[#03b5d3]/60' : 'text-[#94a3b8] border-[#232938]'}`}>
                {tier} · ₹{seatPrices[tier]}
              </button>
            ))}
            <label className="flex items-center gap-2 text-[10px] font-mono text-[#94a3b8]">Tier price
              <input type="number" min="1" value={seatPrices[activeSeatTier]} onChange={e => setSeatPrices(prev => ({ ...prev, [activeSeatTier]: Number(e.target.value) }))}
                className="w-24 bg-[#0d0e12] border border-[#232938] rounded-lg px-2 py-1.5 text-white" />
            </label>
          </div>
          <div className="flex flex-col gap-2">
            {seatRows.map((row, rowIndex) => (
              <div key={row.name} className="flex flex-wrap items-center gap-2">
                <span className="w-7 text-[10px] font-mono font-bold text-[#64748b]">{row.name}</span>
                <select value={row.tier} onChange={e => setSeatRows(prev => prev.map((item, index) => index === rowIndex ? { ...item, tier: e.target.value } : item))}
                  className="bg-[#0d0e12] border border-[#232938] rounded-lg px-2 py-1.5 text-[10px] text-white">
                  {Object.keys(seatPrices).map(tier => <option key={tier} value={tier}>{tier}</option>)}
                </select>
                <div className="flex flex-wrap gap-1">
                  {row.seats.map(seat => (
                    <button type="button" key={seat.number} title={`${row.name}${seat.number} · ${row.tier} · ${seat.active ? 'included' : 'removed'}`} onClick={() => setSeatRows(prev => prev.map((item, index) => index === rowIndex ? { ...item, seats: item.seats.map(existing => existing.number === seat.number ? { ...existing, active: !existing.active } : existing) } : item))}
                      className={`w-6 h-6 rounded-t-md border text-[8px] ${seat.active ? 'bg-[#232938] border-[#4cd7f6]/40 text-[#4cd7f6]' : 'bg-[#0d0e12] border-[#64748b]/30 text-[#64748b] line-through'}`} aria-label={`${row.name}${seat.number}`} aria-pressed={seat.active}>
                      {seat.number}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" disabled={seatRows.length >= 26} onClick={() => setSeatRows(prev => [...prev, { name: String.fromCharCode(65 + prev.length), seats: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, active: true })), tier: activeSeatTier }])}
              className="self-start px-3 py-1.5 rounded-lg border border-[#232938] text-[10px] text-[#94a3b8] hover:border-[#03b5d3]/50">+ Add row</button>
          </div>
        </div>}

        {/* Required private film certificates */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-[#12151e] border border-[#232938]">
          {[
            { key: 'cbfc', type: 'CBFC_CERTIFICATE', label: 'CBFC Certificate' },
            { key: 'distribution', type: 'DISTRIBUTION_DEED', label: 'Distribution Authorization Certificate' },
          ].map(doc => {
            const existing = savedDocuments.find(item => item.document_type === doc.type);
            return <div key={doc.key} className="flex flex-col gap-2">
              <label htmlFor={`film-document-${doc.key}`} className="text-xs text-[#94a3b8] font-bold">{doc.label} *</label>
              <input
                id={`film-document-${doc.key}`}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={event => setCertificateFiles(prev => ({ ...prev, [doc.key]: event.target.files?.[0] || null }))}
                className="w-full text-[11px] text-[#94a3b8] file:mr-3 file:rounded-lg file:border-0 file:bg-[#03b5d3]/15 file:px-3 file:py-2 file:text-[#4cd7f6] hover:file:bg-[#03b5d3]/25"
              />
              <span className="text-[10px] text-[#64748b]">PDF, JPG, PNG, DOC or DOCX · max 10 MB</span>
              {existing && <span className="text-[10px] text-[#4edea3]">Saved: {existing.filename} · {existing.status.replaceAll('_', ' ')}</span>}
            </div>;
          })}
        </div>
      </div>

      {screenWarning && <div className="p-3 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/30 text-[#fcd34d] text-xs font-mono">{screenWarning}</div>}
      {saveError && <div role="alert" className="p-3 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 text-[#ffb4ab] text-xs font-mono">{saveError}</div>}

      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-center gap-3">
          <button type="submit" disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#03b5d3] to-[#0ea5e9] text-[#001f26] font-bold text-xs font-mono shadow-[0_0_20px_rgba(3,181,211,0.35)] hover:brightness-110 transition-all cursor-pointer disabled:opacity-50">
            {isSaving ? (isUploadingPoster ? 'Uploading Poster Art…' : 'Submitting Film…') : isEdit ? 'Save Changes to Film Catalog' : 'Submit Film for Admin Approval'}
          </button>
          <button type="button" disabled={isSaving}
            onClick={(e) => handleSave(e, true)}
            className="px-5 py-2.5 rounded-xl bg-[#181c26] text-[#94a3b8] hover:text-white font-bold text-xs font-mono border border-[#232938] transition-colors cursor-pointer disabled:opacity-50">
            {isSaving ? 'Saving Draft…' : 'Save as Draft'}
          </button>
        </div>
        <span className="text-[11px] text-[#94a3b8] font-mono flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#4cd7f6]" />
          Films are submitted for platform administrator review and will only appear on the customer booking portal once approved by an admin.
        </span>
      </div>
    </form>
  );
}

// ── Verification Window ────────────────────────────────────────────────────────
// ── Tab 3: Cinema Screen Authorization ──────────────────────────────────────────
function CinemaAuthorizationTab({ currentUser, onShowVerification }) {
  const [cinema, setCinema] = useState(null);
  const [screens, setScreens] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ cinemaName: currentUser?.venueName || '', legalBusinessName: currentUser?.venueName || '', cinemaType: 'MULTIPLEX', address: '', city: '', state: '', postalCode: '', phone: currentUser?.phone || '', email: currentUser?.email || '' });
  const [screen, setScreen] = useState({ screenName: '', screenNumber: 1, screenType: 'STANDARD', capacity: 100, projectionType: 'Laser 4K', audioFormat: 'Dolby Atmos', supportedFormats: ['2D'], isActive: true });
  const [editingId, setEditingId] = useState(null);
  const [uploadingType, setUploadingType] = useState('');
  const load = async () => {
    try {
      // Fetch cinema profile separately so screens/docs don't fail if cinema doesn't exist yet
      const [cResult, sResult, dResult] = await Promise.allSettled([
        cinemasApi.mine(),
        cinemasApi.screens(),
        cinemasApi.documents()
      ]);
      const c = cResult.status === 'fulfilled' ? cResult.value : null;
      const s = sResult.status === 'fulfilled' ? (sResult.value || []) : [];
      const d = dResult.status === 'fulfilled' ? (dResult.value || []) : [];
      setCinema(c);
      setScreens(s);
      setDocuments(d);
      if (c) {
        setForm(prev => ({
          ...prev,
          cinemaName: c.cinema_name || prev.cinemaName,
          legalBusinessName: c.legal_business_name || prev.legalBusinessName,
          cinemaType: c.cinema_type || prev.cinemaType,
          address: c.address || '',
          city: c.city || '',
          state: c.state || '',
          postalCode: c.postal_code || '',
          phone: c.phone || prev.phone,
          email: c.email || prev.email
        }));
      }
      // Only show errors that are NOT 404-not-found
      if (cResult.status === 'rejected' && cResult.reason?.status !== 404) {
        setError(cResult.reason?.message || 'Could not load cinema settings.');
      }
    } catch (e) {
      if (e.status !== 404) setError(e.message || 'Could not load cinema settings.');
    }
  };
  useEffect(() => { load(); }, []);
  const input = 'w-full rounded-xl bg-[#0d0e12] border border-[#232938] px-3 py-2 text-sm text-white outline-none focus:border-[#03b5d3]';
  const saveCinema = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (cinema) await cinemasApi.update(form);
      else await cinemasApi.create(form);
      setMessage('Cinema profile saved.');
      if (onShowVerification) {
        onShowVerification({
          title: "Movie-Hall Details Submitted",
          message: "Your movie-hall is under verification... it will be approved if properly verified"
        });
      }
      await load();
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };
  const saveScreen = async e => { e.preventDefault(); setBusy(true); setError(''); const payload = { ...screen, screenNumber: Number(screen.screenNumber), capacity: Number(screen.capacity) }; try { if (editingId) await cinemasApi.updateScreen(editingId, payload); else await cinemasApi.createScreen(payload); setMessage(editingId ? 'Screen updated.' : 'Screen added.'); setEditingId(null); setScreen({ screenName: '', screenNumber: screens.length + 2, screenType: 'STANDARD', capacity: 100, projectionType: 'Laser 4K', audioFormat: 'Dolby Atmos', supportedFormats: ['2D'], isActive: true }); await load(); } catch (x) { setError(x.message); } finally { setBusy(false); } };
  const upload = async (type, file) => { if (!file) return; setUploadingType(type); setError(''); try { await cinemasApi.uploadDocument(file, type); setMessage(`${file.name} securely uploaded for administrator review.`); await load(); } catch (x) { setError(x.message); } finally { setUploadingType(''); } };
  const docs = [{ type: 'FIRE_SAFETY', label: 'Fire Safety NOC' }, { type: 'CINEMA_LICENCE', label: 'CBFC Exhibitor Licence' }];
  const isAuthorized = cinema?.verification_status === 'VERIFIED';
  const isSubmitted = cinema?.verification_status === 'SUBMITTED' || cinema?.verification_status === 'UNDER_REVIEW' || isAuthorized;

  return <div className="space-y-5">
    <div>
      <h2 className="text-lg font-bold text-white">Cinema, verification & screens</h2>
      <p className="mt-1 text-xs text-[#94a3b8]">Official compliance documents, statutory licences, and auditorium screen management.</p>
    </div>

    {cinema?.verification_status === 'VERIFIED' && (
      <div className="p-4 rounded-2xl bg-[#4edea3]/15 border border-[#4edea3]/40 text-[#4edea3] flex items-center gap-3 shadow-[0_0_20px_rgba(78,222,163,0.15)]">
        <CheckCircle2 className="w-6 h-6 shrink-0 text-[#4edea3]" />
        <div>
          <h3 className="text-sm font-extrabold text-white">Movie Hall Verified to Show Movies — Authorized by Super Admin</h3>
          <p className="text-xs text-[#a0e8c7] mt-0.5 font-mono">
            Your cinema complex ({cinema.cinema_name}) is officially verified and approved. Your scheduled screenings are active for customer ticket reservations.
          </p>
        </div>
      </div>
    )}

    {cinema?.verification_status === 'SUBMITTED' && (
      <div className="p-4 rounded-2xl bg-[#fbbf24]/15 border border-[#fbbf24]/40 text-[#fbbf24] flex items-center gap-3 shadow-[0_0_20px_rgba(251,191,36,0.15)]">
        <Clock className="w-6 h-6 shrink-0 text-[#fbbf24] animate-pulse" />
        <div>
          <h3 className="text-sm font-extrabold text-white">Movie-Hall Under Verification</h3>
          <p className="text-xs text-[#fde68a] mt-0.5 font-mono">
            Your movie-hall is under verification... it will be approved if properly verified by the Super Admin team.
          </p>
        </div>
      </div>
    )}

    {error && <div role="alert" className="p-3 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-sm text-[#ffb4ab]">{error}</div>}
    {message && <div role="status" className="p-3 rounded-xl border border-[#4edea3]/30 bg-[#4edea3]/10 text-sm text-[#4edea3]">{message}</div>}
    <form onSubmit={saveCinema} className="p-5 rounded-2xl bg-[#12151e] border border-[#232938] space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">{cinema ? 'Cinema details' : 'Register cinema'}</h3>
        {cinema && (
          <span className={`text-[10px] font-mono px-3 py-1 rounded-full font-bold uppercase tracking-wider border ${
            cinema.verification_status === 'VERIFIED'
              ? 'bg-[#4edea3]/15 text-[#4edea3] border-[#4edea3]/40'
              : 'bg-[#fbbf24]/15 text-[#fbbf24] border-[#fbbf24]/40'
          }`}>
            {cinema.verification_status === 'VERIFIED' ? '✓ Verified by Admin' : '⏳ ' + cinema.verification_status}
          </span>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          ['cinemaName','Cinema name'],
          ['legalBusinessName','Legal business name'],
          ['address','Address'],
          ['city','City'],
          ['state','State'],
          ['postalCode','Postal code'],
          ['phone','Phone'],
          ['email','Email']
        ].map(([key,label]) => (
          <label key={key} className="space-y-1 text-xs text-[#94a3b8]">
            {label}
            <input
              required
              disabled={isAuthorized}
              className={`${input} ${isAuthorized ? 'opacity-70 cursor-not-allowed bg-[#08090d]' : ''}`}
              value={form[key]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
            />
          </label>
        ))}
        <label className="space-y-1 text-xs text-[#94a3b8]">
          Cinema type
          <select
            disabled={isAuthorized}
            className={`${input} ${isAuthorized ? 'opacity-70 cursor-not-allowed bg-[#08090d]' : ''}`}
            value={form.cinemaType}
            onChange={e => setForm(p => ({ ...p, cinemaType: e.target.value }))}
          >
            {['MULTIPLEX','SINGLE_SCREEN','PREMIUM','IMAX','4DX','DRIVE_IN','OTHER'].map(x => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="submit"
        disabled={busy || isAuthorized}
        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
          isAuthorized
            ? 'bg-[#4edea3]/20 text-[#4edea3] border border-[#4edea3]/40 cursor-not-allowed opacity-90'
            : 'bg-[#03b5d3] text-[#001f26] cursor-pointer hover:brightness-110'
        }`}
      >
        {isAuthorized ? 'Saved' : cinema ? 'Save cinema details' : 'Create cinema profile'}
      </button>
    </form>
    {cinema && <>
      <section className="p-5 rounded-2xl bg-[#12151e] border border-[#232938] space-y-3">
        <h3 className="text-sm font-bold text-white">Required documents</h3>
        <p className="text-xs text-[#64748b]">PDF, JPG, PNG, DOC or DOCX · max 10 MB · private Supabase storage</p>
        {docs.map(d => {
          const saved = documents.find(x => x.document_type === d.type);
          return (
            <div key={d.type} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#232938]">
              <div>
                <p className="text-sm text-white">{d.label}</p>
                <p className="text-[10px] text-[#94a3b8]">{saved ? `${saved.original_filename} · ${saved.status}` : 'Not uploaded'}</p>
              </div>
              <label className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                isSubmitted
                  ? 'bg-[#232938] text-[#94a3b8] border border-[#2e3444] cursor-not-allowed'
                  : 'bg-[#03b5d3]/15 text-[#4cd7f6] cursor-pointer hover:brightness-110'
              }`}>
                {uploadingType === d.type ? 'Uploading…' : isSubmitted ? 'Submitted' : saved ? 'Replace' : 'Choose & upload'}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  disabled={!!uploadingType || isSubmitted}
                  onChange={e => { upload(d.type, e.target.files?.[0]); e.target.value = ''; }}
                />
              </label>
            </div>
          );
        })}
        <button
          type="button"
          disabled={busy || isSubmitted || docs.some(d => !documents.some(x => x.document_type === d.type))}
          onClick={async () => {
            setBusy(true);
            try {
              await cinemasApi.submitVerification();
              setMessage('Submitted for administrator review.');
              if (onShowVerification) {
                onShowVerification({
                  title: "Cinema Verification Submitted",
                  message: "Your movie-hall is under verification... it will be approved if properly verified"
                });
              }
              await load();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            isSubmitted
              ? 'bg-[#4edea3]/20 text-[#4edea3] border border-[#4edea3]/40 cursor-not-allowed opacity-90'
              : 'bg-[#fbbf24] text-[#201400] disabled:opacity-40 cursor-pointer hover:brightness-110'
          }`}
        >
          {isSubmitted ? 'Submitted' : 'Submit for admin review'}
        </button>
      </section>
      <section className="p-5 rounded-2xl bg-[#12151e] border border-[#232938] space-y-4"><div><h3 className="text-sm font-bold text-white">Auditorium screens ({screens.filter(s=>s.is_active).length} active of {screens.length})</h3><p className="text-xs text-[#64748b] mt-1">Add screens, edit their type and seating capacity, or deactivate a screen.</p></div>{screens.map(s=><div key={s.id} className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#0d0e12] border border-[#232938]"><div><p className="text-sm font-bold text-white">Screen {s.screen_number}: {s.screen_name}</p><p className="text-xs text-[#94a3b8]">{s.screen_type} · {s.capacity} seats · {s.projection_type} · {s.audio_format} · {s.is_active?'Active':'Inactive'}</p></div><button type="button" onClick={()=>{setEditingId(s.id);setScreen({screenName:s.screen_name,screenNumber:s.screen_number,screenType:s.screen_type,capacity:s.capacity,projectionType:s.projection_type||'',audioFormat:s.audio_format||'',supportedFormats:s.supported_formats||[],isActive:s.is_active});}} className="px-3 py-2 rounded-lg border border-[#03b5d3]/40 text-[#4cd7f6] text-xs">Edit</button></div>)}
      <form onSubmit={saveScreen} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-[#232938] pt-4">{[['screenName','Screen name','text'],['screenNumber','Screen number','number'],['screenType','Screen type','text'],['capacity','Number of seats','number'],['projectionType','Projection type','text'],['audioFormat','Audio format','text']].map(([key,label,type])=><label key={key} className="space-y-1 text-xs text-[#94a3b8]">{label}<input required type={type} min={type==='number'?1:undefined} className={input} value={screen[key]} onChange={e=>setScreen(p=>({...p,[key]:e.target.value}))}/></label>)}<label className="space-y-1 text-xs text-[#94a3b8]">Supported formats<input className={input} value={(screen.supportedFormats||[]).join(', ')} onChange={e=>setScreen(p=>({...p,supportedFormats:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))}/></label><label className="flex items-center gap-2 text-xs text-[#94a3b8]"><input type="checkbox" checked={screen.isActive!==false} onChange={e=>setScreen(p=>({...p,isActive:e.target.checked}))}/> Screen available for scheduling</label><div className="flex items-end gap-2"><button disabled={busy} className="px-4 py-2 rounded-lg bg-[#03b5d3] text-[#001f26] text-xs font-bold">{busy?'Saving…':editingId?'Save changes':'Add screen'}</button>{editingId&&<button type="button" onClick={()=>setEditingId(null)} className="px-3 py-2 rounded-lg border border-[#232938] text-xs text-[#94a3b8]">Cancel</button>}</div></form></section>
    </>}
  </div>;
}

// ── Main Hall Films Management View Component ──────────────────────────────────
const TAB_TO_VIEW = {
  catalog:       'film-catalog',
  'add-film':    'add-edit-film',
  authorization: 'cinema-auth',
};

export default function HallFilmsManagementView({ currentUser, initialTab = 'catalog', onTabChange }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [syncedTab, setSyncedTab] = useState(initialTab);
  const [selectedFilm, setSelectedFilm] = useState(null);
  const [films, setFilms] = useState([]);
  const [catalogFeedback, setCatalogFeedback] = useState('');
  const [verificationPopup, setVerificationPopup] = useState({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    let cancelled = false;
    moviesApi.listMine().then((data) => {
      if (cancelled || !Array.isArray(data)) return;
      setFilms(data.map((m) => {
        const p = m.posterUrl || m.poster_path || m.poster || '';
        return {
          ...m,
          id: m.id,
          title: m.title || 'Untitled movie',
          distributor: m.distributor || 'Independent',
          status: m.status || 'DRAFT',
          totalRevenue: Number(m.totalRevenue || 0),
          posterUrl: p,
          poster_path: p,
          poster: p,
        };
      }));
    }).catch(err => console.error('Could not load film catalog:', err));
    return () => { cancelled = true; };
  }, []);

  if (initialTab !== syncedTab) {
    setSyncedTab(initialTab);
    setActiveTab(initialTab);
  }

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    if (TAB_TO_VIEW[tabId] && onTabChange) {
      onTabChange(TAB_TO_VIEW[tabId]);
    }
  };

  const handleSelectFilm = (film) => {
    setSelectedFilm(film);
    selectTab('add-film');
  };

  const handleAddFilm = () => {
    setSelectedFilm(null);
    selectTab('add-film');
  };

  const handleSaveFilm = async (filmData) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(filmData.id || '');
    const saved = isUuid
      ? await moviesApi.update(filmData.id, filmData)
      : await moviesApi.create(filmData);
    if (!saved?.id) throw new Error('The backend did not return a saved film record.');
    
    const resolvedPoster = saved.posterUrl || saved.poster_path || saved.poster || filmData.posterUrl || filmData.posterPath;
    const normalized = {
      ...filmData,
      ...saved,
      id: saved.id,
      posterUrl: resolvedPoster,
      poster_path: resolvedPoster,
      poster: resolvedPoster,
    };
    setSelectedFilm(normalized);
    setFilms(prev => [normalized, ...prev.filter(f => f.id !== filmData.id && f.id !== saved.id)]);
    return normalized;
  };

  const showVerificationModal = ({ title, message } = {}) => {
    setVerificationPopup({
      isOpen: true,
      title: title || "Movie-Hall Verification In Progress",
      message: message || "Your movie-hall is under verification... it will be approved if properly verified"
    });
  };

  return (
    <div className="min-h-screen bg-[#08090d] pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      {/* Verification Notice Pop-up Modal */}
      <VerificationNoticeModal
        isOpen={verificationPopup.isOpen}
        title={verificationPopup.title}
        message={verificationPopup.message}
        onClose={() => setVerificationPopup({ isOpen: false, title: '', message: '' })}
      />

      <div className="max-w-7xl mx-auto flex flex-col gap-6">

        {/* Console Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-[#232938]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#03b5d3] to-[#0ea5e9] flex items-center justify-center text-[#001f26] shadow-[0_0_24px_rgba(3,181,211,0.4)]">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <h1 className="text-xl font-extrabold text-white">Cinema Hall Provider — Film & Exhibition Management</h1>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#03b5d3]/20 text-[#4cd7f6] border border-[#03b5d3]/40 uppercase font-bold">
                  CINEMA PARTNER CONSOLE • VERIFIED EXHIBITOR
                </span>
              </div>
              <p className="text-[11px] text-[#64748b] font-mono">
                {currentUser?.venueName || 'Cinema Partner'} • Registered Cinema Exhibitor Console
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#4edea3]/15 border border-[#4edea3]/40 text-[#4edea3] text-[10px] font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
              THEATRICAL SCREEN SYSTEM ACTIVE
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#232938] border border-[#232938] text-[#94a3b8] text-[10px] font-mono">
              <Lock className="w-3 h-3" />
              SEC-256 Verified
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-[#12151e] border border-[#232938] rounded-2xl p-1.5 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[#03b5d3] to-[#0ea5e9] text-[#001f26] font-bold shadow-[0_0_16px_rgba(3,181,211,0.35)]'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#1a1b20]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {catalogFeedback && activeTab === 'catalog' && <div role="status" className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#4edea3]/15 border border-[#4edea3]/40 text-[#4edea3] text-sm">
          <span><CheckCircle2 className="inline w-4 h-4 mr-2" />{catalogFeedback}</span>
          <button type="button" onClick={() => setCatalogFeedback('')} aria-label="Dismiss success message" className="text-[#94a3b8] hover:text-white">×</button>
        </div>}

        {/* Tab Content */}
        <div>
          {activeTab === 'catalog' && (
            <FilmCatalog films={films} onSelectFilm={handleSelectFilm} onAddFilm={handleAddFilm} />
          )}
          {activeTab === 'add-film' && (
            <AddFilmTab
              selectedFilm={selectedFilm}
              onSaveFilm={handleSaveFilm}
              onPublish={(film) => {
                showVerificationModal({
                  title: "Film Registration Submitted",
                  message: "Your movie-hall is under verification... it will be approved if properly verified"
                });
                setCatalogFeedback(`${film.title} was submitted and is now in your Film Catalog as awaiting administrator approval.`);
                selectTab('catalog');
              }}
            />
          )}
          {activeTab === 'authorization' && (
            <CinemaAuthorizationTab
              films={films}
              currentUser={currentUser}
              onShowVerification={showVerificationModal}
            />
          )}
        </div>

      </div>
    </div>
  );
}
