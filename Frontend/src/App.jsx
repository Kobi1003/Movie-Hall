import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import DiscoverView from './components/DiscoverView';
import SeatBookingView from './components/SeatBookingView';
import ShowsPricingView from './components/ShowsPricingView';
import HallFilmsManagementView from './components/HallFilmsManagementView';
import MyBookingsView from './components/MyBookingsView';
import AdminRootConsole from './components/AdminRootConsole';
import SeatPlannerStudio from './components/SeatPlannerStudio';
import CheckoutModal from './components/CheckoutModal';
import TicketPassModal from './components/TicketPassModal';
import AuthModal from './components/AuthModal';
import { Lock, Building2, User, Film, AlertTriangle, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { getStoredUser, getAuthToken, setStoredUser, setAuthToken, authApi, bookingsApi, moviesApi, loginSuperAdmin, adminApi } from './api.js';
import { getSavedLocation } from './utils/location.js';

// ── Seat Booking Wrapper (Handles direct deep linking with /book/:movieId) ───
function SeatBookingWrapper({
  selectedMovie,
  setSelectedMovie,
  selectedSlot,
  currentUser,
  onOpenAuth,
  onCheckoutInitiate,
  navigate
}) {
  const { movieId } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If movie is already set and matches requested movieId (or no movieId given), retain it
    if (selectedMovie && (!movieId || selectedMovie.id === movieId)) {
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    moviesApi.list()
      .then((movies) => {
        if (!isMounted) return;
        const list = Array.isArray(movies) ? movies : [];
        let matched = null;
        if (movieId) {
          matched = list.find((m) => m.id === movieId);
        }
        if (!matched && list.length > 0) {
          matched = list.find(m => m.status === 'ACTIVE' || m.status === 'AUTHORIZED') || null;
        }
        if (matched && matched.status !== 'ACTIVE' && matched.status !== 'AUTHORIZED') {
          matched = null;
          setError('This film is currently under Super Admin review and cannot be booked until authorized.');
        }
        if (matched) {
          setSelectedMovie(matched);
        } else {
          setError('No authorized active movie found for customer booking.');
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load movie for seat booking.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [movieId, selectedMovie, setSelectedMovie]);

  if (loading && !selectedMovie) {
    return (
      <div className="pt-32 pb-20 px-4 text-center flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-mono text-[#94a3b8]">Initializing movie seat layout...</p>
      </div>
    );
  }

  if (error && !selectedMovie) {
    return (
      <div className="pt-32 pb-20 px-4 max-w-md mx-auto text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 flex items-center justify-center text-[#ffb4ab]">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Movie Not Found</h2>
        <p className="text-xs text-[#94a3b8] font-mono">{error}</p>
        <button
          onClick={() => navigate('/discover')}
          className="px-5 py-2.5 rounded-xl bg-[#181c26] text-white hover:bg-[#202534] border border-[#232938] text-xs font-mono font-bold flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Discover</span>
        </button>
      </div>
    );
  }

  return (
    <SeatBookingView
      movie={selectedMovie}
      initialSlot={selectedSlot}
      currentUser={currentUser}
      onBack={() => navigate('/discover')}
      onCheckoutComplete={onCheckoutInitiate}
      onOpenAuth={onOpenAuth}
    />
  );
}

// ── Customer Guard (Restricts wallet to customers or guests) ──────────────────
function CustomerGuard({ currentUser, onOpenAuth, children }) {
  if (currentUser?.role === 'customer' || currentUser === null) {
    return children;
  }
  return (
    <div className="pt-28 pb-16 px-4 max-w-xl mx-auto text-center flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 flex items-center justify-center text-[#d0bcff]">
        <User className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-white">Customer Account Required</h2>
      <p className="text-xs text-[#94a3b8] font-mono">
        You are currently signed in as {currentUser.role === 'partner' ? 'Cinema Partner' : 'Admin'}. Switch to a customer account to view your personal ticket wallet.
      </p>
      <button
        onClick={() => onOpenAuth({ role: 'customer', isSignUp: false })}
        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white font-bold text-xs font-mono shadow-lg cursor-pointer"
      >
        Sign In as Customer
      </button>
    </div>
  );
}

// ── Partner Guard (Restricts partner studio to verified partners or admins) ──
function PartnerGuard({ authReady, currentUser, onOpenAuth, navigate, children }) {
  if (!authReady) {
    return <div className="pt-32 pb-20 px-4 text-center text-sm text-[#94a3b8]">Checking your account access…</div>;
  }
  if (currentUser?.role === 'partner' || currentUser?.role === 'admin') {
    return children;
  }
  return (
    <div className="pt-32 pb-20 px-4 max-w-lg mx-auto text-center flex flex-col items-center gap-5">
      <div className="w-16 h-16 rounded-2xl bg-[#03b5d3]/20 border border-[#03b5d3]/40 flex items-center justify-center text-[#4cd7f6] shadow-[0_0_24px_rgba(3,181,211,0.3)]">
        <Building2 className="w-8 h-8" />
      </div>
      <div>
        <h2 className="text-2xl font-extrabold text-white">Cinema Partner Console</h2>
        <p className="text-xs text-[#94a3b8] font-mono mt-2">
          This account is signed in as <strong className="text-white">{currentUser?.role === 'customer' ? 'Customer' : currentUser?.role === 'admin' ? 'Administrator' : 'Guest'}</strong>. Movie submissions, showtimes, and screen management require a Cinema Provider account.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-2">
        <button
          onClick={() => onOpenAuth({ role: 'partner', isSignUp: true })}
          className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#03b5d3] to-[#0ea5e9] text-[#001f26] font-bold text-xs font-mono shadow-[0_0_20px_rgba(3,181,211,0.4)] hover:brightness-110 transition-all cursor-pointer"
        >
          Create Cinema Provider Account
        </button>
        <button
          onClick={() => onOpenAuth({ role: 'partner', isSignUp: false })}
          className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#181c26] text-white font-bold text-xs font-mono border border-[#232938] cursor-pointer"
        >
          Sign In as Provider
        </button>
        <button
          onClick={() => navigate('/discover')}
          className="w-full sm:w-auto py-3 px-4 rounded-xl bg-[#181c26] text-[#cbc3d7] hover:text-white font-bold text-xs font-mono border border-[#232938] cursor-pointer"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
}

// ── Admin Guard (Guarded strictly by Tixora Root Access Key: TIX-098-245) ─────────────
function AdminGuard({ authReady, currentUser, setCurrentUser, navigate, children }) {
  const [rootKeyInput, setRootKeyInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return (
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem('tixora_root_access_key') === 'TIX-098-245' &&
      currentUser?.role === 'admin'
    );
  });

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const key = rootKeyInput.trim();
    if (!key) {
      setErrorMsg('Please enter the Tixora Root Access Key.');
      return;
    }
    setIsVerifying(true);
    setErrorMsg('');
    try {
      const res = await adminApi.verifyRootKey(key);
      const token = res?.token || res?.data?.token;
      const user = res?.user || res?.data?.user;
      if (token && user) {
        setAuthToken(token);
        localStorage.setItem('tixora_admin_token', token);
        sessionStorage.setItem('tixora_root_access_key', key);
        setStoredUser(user);
        if (setCurrentUser) setCurrentUser(user);
        setIsUnlocked(true);
      } else {
        throw new Error(res?.message || 'Verification failed');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Invalid Tixora Root Access Key. Access Denied.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLockConsole = () => {
    sessionStorage.removeItem('tixora_root_access_key');
    localStorage.removeItem('tixora_admin_token');
    setIsUnlocked(false);
    setRootKeyInput('');
    setErrorMsg('');
    navigate('/discover');
  };

  if (!authReady) {
    return <div className="pt-32 pb-20 px-4 text-center text-sm text-[#94a3b8]">Checking security credentials…</div>;
  }

  // If unlocked with valid Root Access Key and authenticated as admin, show AdminRootConsole
  if (isUnlocked && currentUser?.role === 'admin') {
    return (
      <div className="relative">
        <div className="sticky top-16 z-30 bg-[#161224] border-b border-[#a078ff]/30 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
            <span className="text-[11px] font-mono text-[#d0bcff] font-bold tracking-wider">
              ROOT CLEARANCE ACTIVE • KEY: TIX-098-245
            </span>
          </div>
          <button
            onClick={handleLockConsole}
            className="px-3 py-1 rounded-lg bg-[#251d38] hover:bg-[#382b54] text-[#ffb4ab] border border-[#ffb4ab]/30 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            Lock & Exit Admin
          </button>
        </div>
        {children}
      </div>
    );
  }

  // Otherwise, display Root Access Key Challenge
  return (
    <div className="pt-32 pb-20 px-4 max-w-md mx-auto text-center flex flex-col items-center gap-6">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#3b122d] to-[#1e1329] border border-[#ffb4ab]/40 flex items-center justify-center text-[#ffb4ab] shadow-[0_0_35px_rgba(255,180,171,0.25)]">
        <KeyRound className="w-10 h-10 text-[#d0bcff]" />
      </div>

      <div>
        <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-[#ffb4ab]/15 text-[#ffb4ab] border border-[#ffb4ab]/30 uppercase tracking-widest">
          High-Security Platform Console
        </span>
        <h2 className="text-2xl font-black text-white mt-3">Root Access Key Required</h2>
        <p className="text-xs text-[#94a3b8] font-mono mt-2 leading-relaxed">
          The Admin Console is guarded by master platform authorization. Enter your assigned <strong className="text-[#d0bcff]">Tixora Root Access Key</strong> to unlock the console.
        </p>
      </div>

      <form onSubmit={handleVerify} className="w-full space-y-3 bg-[#11131a] p-5 rounded-2xl border border-[#232938] text-left">
        <div>
          <label className="block text-[11px] font-mono uppercase text-[#94a3b8] mb-1.5 font-bold">
            Tixora Root Access Key
          </label>
          <input
            type="password"
            autoFocus
            value={rootKeyInput}
            onChange={(e) => {
              setRootKeyInput(e.target.value);
              setErrorMsg('');
            }}
            placeholder="e.g. TIX-098-245"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090d] border border-[#232938] text-white font-mono text-sm tracking-wider focus:border-[#a078ff] focus:ring-1 focus:ring-[#a078ff] outline-none transition-all placeholder:text-[#494454]"
          />
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 text-xs font-mono text-[#ffb4ab] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isVerifying}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white font-bold text-xs font-mono shadow-[0_0_20px_rgba(160,120,255,0.4)] hover:brightness-110 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isVerifying ? (
            <span>Verifying Root Clearance…</span>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>Verify Root Access Key</span>
            </>
          )}
        </button>

        <p className="text-[10px] text-center text-[#64748b] font-mono pt-1">
          Root access keys are confidential and configured in project environment variables.
        </p>
      </form>

      <button
        type="button"
        onClick={() => navigate('/discover')}
        className="text-xs text-[#94a3b8] hover:text-white font-mono transition-colors cursor-pointer flex items-center gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Return to Customer Portal
      </button>
    </div>
  );
}

// ── 404 Route Fallback ────────────────────────────────────────────────────────
function NotFoundView({ onNavigateHome }) {
  return (
    <div className="pt-32 pb-24 px-4 max-w-md mx-auto text-center flex flex-col items-center gap-5">
      <div className="w-20 h-20 rounded-3xl bg-[#1a1b20] border border-[#232938] flex items-center justify-center text-[#8b5cf6] shadow-[0_0_30px_rgba(139,92,246,0.2)]">
        <Film className="w-10 h-10" />
      </div>
      <div>
        <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-3 py-1 rounded-full bg-[#ffb4ab]/10 text-[#ffb4ab] border border-[#ffb4ab]/30">
          404 • Reel Not Found
        </span>
        <h2 className="text-3xl font-extrabold text-white mt-3">Off-Screen Route</h2>
        <p className="text-xs text-[#94a3b8] font-mono mt-2 leading-relaxed">
          The requested cinema address does not exist or has been relocated to another auditorium.
        </p>
      </div>
      <button
        onClick={onNavigateHome}
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white font-bold text-xs font-mono shadow-[0_0_20px_rgba(160,120,255,0.4)] hover:brightness-110 transition-all cursor-pointer"
      >
        Return to Discover Movies
      </button>
    </div>
  );
}

// ── Main App Root Component ──────────────────────────────────────────────────
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation & Mode states
  const [currentMode, setCurrentMode] = useState('customer'); // 'customer' | 'partner' | 'admin'
  
  // Current Logged-in User State (restored from localStorage if available)
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [authReady, setAuthReady] = useState(() => !getAuthToken());

  // Selected Movie for booking
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  
  // Search & City filter
  const [selectedCity, setSelectedCity] = useState('All Locations');
  const [userLocation, setUserLocation] = useState(() => getSavedLocation());
  const [searchQuery, setSearchQuery] = useState('');

  // User Bookings
  const [userBookings, setUserBookings] = useState([]);

  // Modals state
  const [authModalConfig, setAuthModalConfig] = useState(null);
  const [checkoutModalData, setCheckoutModalData] = useState(null);
  const [ticketPassModalData, setTicketPassModalData] = useState(null);

  // Sync currentView from location pathname for Navbar backward compatibility
  const currentView = useMemo(() => {
    const p = location.pathname;
    if (p === '/' || p === '/discover') return 'discover';
    if (p.startsWith('/book')) return 'seat-booking';
    if (p === '/my-bookings') return 'my-bookings';
    if (p === '/partner' || p === '/partner/shows') return 'shows-pricing';
    if (p === '/partner/films') return 'film-catalog';
    if (p === '/partner/films/new') return 'add-edit-film';
    if (p === '/partner/authorizations') return 'cinema-auth';
    if (p.startsWith('/admin')) return 'admin-console';
    return 'discover';
  }, [location.pathname]);

  const handleSetCurrentView = (view) => {
    switch (view) {
      case 'discover':
        navigate('/discover');
        break;
      case 'seat-booking':
        navigate(selectedMovie?.id ? `/book/${selectedMovie.id}` : '/book');
        break;
      case 'my-bookings':
        navigate('/my-bookings');
        break;
      case 'shows-pricing':
        navigate('/partner/shows');
        break;
      case 'film-catalog':
        navigate('/partner/films');
        break;
      case 'add-edit-film':
        navigate('/partner/films/new');
        break;
      case 'cinema-auth':
        navigate('/partner/authorizations');
        break;
      case 'admin-console':
        navigate('/admin/console');
        break;
      default:
        navigate('/discover');
    }
  };

  // Sync mode with stored user role on initial load and keep cross-tab state in sync
  useEffect(() => {
    if (currentUser?.role) {
      setCurrentMode(currentUser.role);
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'tixora_user' || e.key === 'tixora_token') {
        const stored = getStoredUser();
        setCurrentUser(stored);
        if (stored?.role) setCurrentMode(stored.role);
      }
    };
    const handleCustomAuthChange = (e) => {
      if (e.detail) {
        setCurrentUser(e.detail);
        if (e.detail.role) setCurrentMode(e.detail.role);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tixora_auth_changed', handleCustomAuthChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tixora_auth_changed', handleCustomAuthChange);
    };
  }, []);

  useEffect(() => {
    if (!getAuthToken()) {
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    authApi.me().then((profile) => {
      if (cancelled) return;
      const role = profile.role === 'PLATFORM_ADMIN' ? 'admin' : (['CINEMA_OWNER', 'MOVIE_PROVIDER'].includes(profile.role) ? 'partner' : 'customer');
      const restoredUser = {
        id: profile.id,
        name: profile.full_name || profile.fullName || 'User',
        email: profile.email,
        role,
        venueName: profile.organization_name || profile.organizationName || currentUser?.venueName || getStoredUser()?.venueName
      };
      setStoredUser(restoredUser);
      setCurrentUser(restoredUser);
      setCurrentMode(role);
    }).catch(() => {
      if (cancelled) return;
      setAuthToken(null);
      setStoredUser(null);
      setCurrentUser(null);
      setUserBookings([]);
      setCurrentMode('customer');
    }).finally(() => {
      if (!cancelled) setAuthReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Fetch real user bookings from Supabase whenever user logs in or mounts
  useEffect(() => {
    const fetchBookings = async () => {
      if (!currentUser) return;
      try {
        const bookings = await bookingsApi.getMyBookings();
        setUserBookings(Array.isArray(bookings) ? bookings : []);
      } catch (err) {
        console.warn('Could not fetch user bookings from Supabase:', err.message);
      }
    };
    fetchBookings();
  }, [currentUser]);

  // Handlers
  const handleSelectMovieForBooking = (movie, slot = null) => {
    setSelectedMovie(movie);
    setSelectedSlot(slot);
    setCurrentMode('customer');
    navigate(movie?.id ? `/book/${movie.id}` : '/book');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAuth = ({ role = 'customer', isSignUp = true }) => {
    setAuthModalConfig({ role, isSignUp });
  };

  const handleAuthSuccess = async (userData) => {
    setCurrentUser(userData);
    setUserBookings([]);
    setCurrentMode(userData.role);
    if (userData.role === 'partner') {
      navigate('/partner/shows');
    } else if (userData.role === 'admin') {
      navigate('/admin/console');
    } else if (!location.pathname.startsWith('/book')) {
      navigate('/discover');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Fetch real bookings for this user from Supabase
    try {
      const bookings = await bookingsApi.getMyBookings();
      setUserBookings(Array.isArray(bookings) ? bookings : []);
    } catch (e) {
      console.warn('Could not load bookings:', e.message);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setStoredUser(null);
    setCurrentUser(null);
    setCurrentMode('customer');
    navigate('/discover');
    setUserBookings([]);
  };

  const handleCheckoutInitiate = (data) => {
    if (!currentUser) {
      handleOpenAuth({ role: 'customer', isSignUp: false });
      return;
    }
    setCheckoutModalData(data);
  };

  const handleCheckoutSuccess = (newBooking) => {
    setUserBookings(prev => [newBooking, ...prev]);
    setCheckoutModalData(null);
    setTicketPassModalData(newBooking);
  };

  const handleCancelBooking = async (booking) => {
    try {
      const bId = booking.internalId || booking.bookingId;
      await bookingsApi.cancel(bId);
      setUserBookings(prev => prev.map(b => (b.bookingId === booking.bookingId || (b.internalId && b.internalId === booking.internalId)) ? { ...b, status: 'CANCELLED' } : b));
    } catch (err) {
      console.warn('Backend cancellation error:', err.message);
      window.alert(err.message || 'Booking cancellation failed. Please try again.');
    }
  };

  const handlePartnerTabChange = (viewOrTab) => {
    if (viewOrTab === 'catalog' || viewOrTab === 'film-catalog') {
      navigate('/partner/films');
    } else if (viewOrTab === 'add-film' || viewOrTab === 'add-edit-film') {
      navigate('/partner/films/new');
    } else if (viewOrTab === 'authorization' || viewOrTab === 'cinema-auth') {
      navigate('/partner/authorizations');
    }
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-[#e3e2e8] flex flex-col selection:bg-[#a078ff] selection:text-[#340080]">
      
      {/* Top Universal Navbar with Mode Switcher & User State */}
      <Navbar
        currentView={currentView}
        setCurrentView={handleSetCurrentView}
        currentMode={currentMode}
        setCurrentMode={setCurrentMode}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        userLocation={userLocation}
        setUserLocation={setUserLocation}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        myBookingsCount={userBookings.length}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      {/* Main View Router with Access Control Guards */}
      <main className="flex-1 w-full">
        <Routes>
          {/* Customer / Discovery Routes */}
          <Route path="/" element={<Navigate to="/discover" replace />} />
          <Route
            path="/discover"
            element={
              <DiscoverView
                currentUser={currentUser}
                onSelectMovie={handleSelectMovieForBooking}
                selectedCity={selectedCity}
                setSelectedCity={setSelectedCity}
                userLocation={userLocation}
                setUserLocation={setUserLocation}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onOpenAuth={handleOpenAuth}
                onNavigateToBookings={() => {
                  if (!currentUser) {
                    handleOpenAuth({ role: 'customer', isSignUp: false });
                  } else {
                    navigate('/my-bookings');
                  }
                }}
              />
            }
          />

          {/* Seat Booking Routes with Deep Linking */}
          <Route
            path="/book"
            element={
              <SeatBookingWrapper
                selectedMovie={selectedMovie}
                setSelectedMovie={setSelectedMovie}
                selectedSlot={selectedSlot}
                currentUser={currentUser}
                onOpenAuth={handleOpenAuth}
                onCheckoutInitiate={handleCheckoutInitiate}
                navigate={navigate}
              />
            }
          />
          <Route
            path="/book/:movieId"
            element={
              <SeatBookingWrapper
                selectedMovie={selectedMovie}
                setSelectedMovie={setSelectedMovie}
                selectedSlot={selectedSlot}
                currentUser={currentUser}
                onOpenAuth={handleOpenAuth}
                onCheckoutInitiate={handleCheckoutInitiate}
                navigate={navigate}
              />
            }
          />

          {/* Customer Digital Passes */}
          <Route
            path="/my-bookings"
            element={
              <CustomerGuard
                currentUser={currentUser}
                onOpenAuth={handleOpenAuth}
              >
                <MyBookingsView
                  userBookings={userBookings}
                  onViewTicketPass={(booking) => setTicketPassModalData(booking)}
                  onExploreEvents={() => navigate('/discover')}
                  onCancelBooking={handleCancelBooking}
                />
              </CustomerGuard>
            }
          />

          {/* Cinema Partner / Movie Provider Routes */}
          <Route path="/partner" element={<Navigate to="/partner/films/new" replace />} />
          <Route
            path="/partner/shows"
            element={
              <PartnerGuard
                authReady={authReady}
                currentUser={currentUser}
                onOpenAuth={handleOpenAuth}
                navigate={navigate}
              >
                <ShowsPricingView currentUser={currentUser} />
              </PartnerGuard>
            }
          />
          <Route
            path="/partner/films"
            element={
              <PartnerGuard
                authReady={authReady}
                currentUser={currentUser}
                onOpenAuth={handleOpenAuth}
                navigate={navigate}
              >
                <HallFilmsManagementView
                  currentUser={currentUser}
                  initialTab="catalog"
                  onTabChange={handlePartnerTabChange}
                />
              </PartnerGuard>
            }
          />
          <Route
            path="/partner/films/new"
            element={
              <PartnerGuard
                authReady={authReady}
                currentUser={currentUser}
                onOpenAuth={handleOpenAuth}
                navigate={navigate}
              >
                <HallFilmsManagementView
                  currentUser={currentUser}
                  initialTab="add-film"
                  onTabChange={handlePartnerTabChange}
                />
              </PartnerGuard>
            }
          />
          <Route
            path="/partner/authorizations"
            element={
              <PartnerGuard
                authReady={authReady}
                currentUser={currentUser}
                onOpenAuth={handleOpenAuth}
                navigate={navigate}
              >
                <HallFilmsManagementView
                  currentUser={currentUser}
                  initialTab="authorization"
                  onTabChange={handlePartnerTabChange}
                />
              </PartnerGuard>
            }
          />
          <Route
            path="/partner/seat-planner"
            element={
              <PartnerGuard
                authReady={authReady}
                currentUser={currentUser}
                onOpenAuth={handleOpenAuth}
                navigate={navigate}
              >
                <SeatPlannerStudio currentUser={currentUser} />
              </PartnerGuard>
            }
          />
          <Route
            path="/partner/layout"
            element={<Navigate to="/partner/seat-planner" replace />}
          />

          {/* Platform Super Admin Routes */}
          <Route path="/admin" element={<Navigate to="/admin/console" replace />} />
          <Route path="/admin/settlements" element={<Navigate to="/admin/console" replace />} />
          <Route
            path="/admin/console"
            element={
              <AdminGuard
                authReady={authReady}
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
                onOpenAuth={handleOpenAuth}
                navigate={navigate}
              >
                <AdminRootConsole currentUser={currentUser} />
              </AdminGuard>
            }
          />

          {/* 404 Wildcard Fallback */}
          <Route
            path="*"
            element={<NotFoundView onNavigateHome={() => navigate('/discover')} />}
          />
        </Routes>
      </main>

      {/* FOOTER */}
      <footer className="w-full bg-[#0d0e12] border-t border-[#232938] py-12 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white">TIXORA</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#8b5cf6]/20 text-[#d0bcff] border border-[#8b5cf6]/30">CINEMA OS</span>
            </div>
            <p className="text-xs text-[#94a3b8] font-mono mt-1">
              Next-generation cinema seat virtualization, high-concurrency ticketing, and theatrical screen authorization.
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono text-[#958ea0]">
            <button 
              onClick={() => {
                if (currentUser?.role === 'partner') {
                  navigate('/partner/shows');
                } else if (currentUser?.role === 'admin') {
                  navigate('/admin/console');
                } else {
                  navigate('/discover');
                }
              }} 
              className="hover:text-white cursor-pointer"
            >
              Discover
            </button>
            <button 
              onClick={() => {
                if (currentUser?.role === 'partner' || currentUser?.role === 'admin') {
                  navigate('/partner/shows');
                } else {
                  handleOpenAuth({ role: 'partner', isSignUp: false });
                }
              }} 
              className="hover:text-white cursor-pointer"
            >
              Partner Studio
            </button>
          </div>
        </div>
      </footer>

      {/* AUTH SIGNUP / LOGIN MODAL */}
      {authModalConfig && (
        <AuthModal
          isOpen={!!authModalConfig}
          onClose={() => setAuthModalConfig(null)}
          onAuthSuccess={handleAuthSuccess}
          initialRole={authModalConfig.role}
          initialIsSignUp={authModalConfig.isSignUp}
        />
      )}

      {/* CHECKOUT MODAL */}
      {checkoutModalData && (
        <CheckoutModal
          checkoutData={checkoutModalData}
          currentUser={currentUser}
          onClose={() => setCheckoutModalData(null)}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {/* TICKET PASS MODAL */}
      {ticketPassModalData && (
        <TicketPassModal
          booking={ticketPassModalData}
          onClose={() => setTicketPassModalData(null)}
          onBookAnother={() => {
            setTicketPassModalData(null);
            navigate('/discover');
          }}
        />
      )}

    </div>
  );
}
