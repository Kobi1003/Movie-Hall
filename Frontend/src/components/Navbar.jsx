import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Film, 
  Search, 
  Bell, 
  MapPin, 
  Ticket, 
  ShieldCheck, 
  DollarSign, 
  ChevronDown,
  Building2,
  LogIn,
  LogOut,
  Lock,
  Plus,
  CheckCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  LayoutGrid,
  LocateFixed,
  Navigation
} from 'lucide-react';
import { notificationsApi, cinemasApi } from '../api.js';
import { requestBrowserLocation, findClosestCity } from '../utils/location.js';

export default function Navbar({ 
  currentView, 
  setCurrentView, 
  setCurrentMode, 
  selectedCity, 
  setSelectedCity, 
  userLocation,
  setUserLocation,
  searchQuery, 
  setSearchQuery,
  myBookingsCount = 0,
  currentUser,
  onOpenAuth,
  onLogout
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const navigateTo = (path, viewName) => {
    if (setCurrentView && viewName) setCurrentView(viewName);
    navigate(path);
  };

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [locating, setLocating] = useState(false);
  const [dbCities, setDbCities] = useState([]);

  // Fetch dynamic cities from backend
  useEffect(() => {
    cinemasApi.cities(userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : {})
      .then(res => {
        if (Array.isArray(res)) setDbCities(res);
      })
      .catch(() => {});
  }, [userLocation]);

  const handleDetectLocation = async () => {
    setLocating(true);
    try {
      const coords = await requestBrowserLocation();
      if (setUserLocation) setUserLocation(coords);

      // Check against database cities to pick the closest
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
      setCityDropdownOpen(false);
    } catch (err) {
      alert(err.message || 'Unable to access your GPS position. Please check your browser location permissions.');
    } finally {
      setLocating(false);
    }
  };

  const fetchNotifications = async () => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }
    try {
      const data = await notificationsApi.list();
      if (Array.isArray(data)) setNotifications(data);
    } catch (_) {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (_) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (_) {}
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return 'Just now';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#121317]/90 backdrop-blur-xl border-b border-[#232938] shadow-[0_4px_24px_rgba(0,0,0,0.7)] transition-all">
      <div className="max-w-7xl mx-auto h-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Active Platform Tag */}
        <div className="flex items-center gap-4 lg:gap-6">
          <button 
            onClick={() => { 
              if (currentUser?.role === 'partner') {
                navigateTo('/partner/shows', 'shows-pricing');
              } else if (currentUser?.role === 'admin') {
                navigateTo('/admin/console', 'admin-console');
              } else {
                navigateTo('/discover', 'discover');
              }
            }} 
            className="flex items-center gap-2.5 group text-left cursor-pointer focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#8b5cf6] via-[#a078ff] to-[#4cd7f6] p-[2px] shadow-[0_0_20px_rgba(139,92,246,0.5)] group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0d0e12] rounded-[10px] flex items-center justify-center">
                <Film className="w-5 h-5 text-[#d0bcff]" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5">
                TIXORA
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-[#8b5cf6]/20 text-[#d0bcff] border border-[#8b5cf6]/30">PRO</span>
              </span>
              <span className="text-[10px] text-[#94a3b8] font-mono tracking-wider">CINEMA OS</span>
            </div>
          </button>

          {/* Role Indicator Badge */}
          {currentUser ? (
            <div className="hidden md:flex items-center">
              {currentUser.role === 'customer' && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 text-[#d0bcff] text-[11px] font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
                  CUSTOMER PORTAL
                </div>
              )}
              {currentUser.role === 'partner' && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#03b5d3]/15 border border-[#03b5d3]/30 text-[#4cd7f6] text-[11px] font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#03b5d3] animate-pulse"></span>
                  CINEMA PARTNER CONSOLE
                </div>
              )}
              {currentUser.role === 'admin' && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d0bcff]/15 border border-[#d0bcff]/40 text-[#d0bcff] text-[11px] font-mono font-bold">
                  <Lock className="w-3 h-3 text-[#d0bcff]" />
                  ADMIN ROOT CONSOLE
                </div>
              )}
            </div>
          ) : (
            <div className="hidden md:flex items-center">
              {location.pathname.startsWith('/admin') && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d0bcff]/15 border border-[#d0bcff]/40 text-[#d0bcff] text-[11px] font-mono font-bold">
                  <Lock className="w-3 h-3 text-[#d0bcff]" />
                  ADMIN GATEWAY
                </div>
              )}
              {location.pathname.startsWith('/partner') && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#03b5d3]/15 border border-[#03b5d3]/30 text-[#4cd7f6] text-[11px] font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#03b5d3] animate-pulse"></span>
                  PARTNER GATEWAY
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Navigation according to Role & URL Route */}
        <nav className="hidden lg:flex items-center gap-1">
          {(!currentUser || currentUser.role === 'customer') && (
            <>
              <button
                onClick={() => navigateTo('/discover', 'discover')}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  (location.pathname === '/' || location.pathname === '/discover')
                    ? 'bg-[#292a2e] text-white shadow-sm border border-[#494454]'
                    : 'text-[#cbc3d7] hover:text-white hover:bg-[#1a1b20]'
                }`}
              >
                Discover & Movies
              </button>
              <button
                onClick={() => navigateTo('/book', 'seat-booking')}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  location.pathname.startsWith('/book')
                    ? 'bg-[#292a2e] text-white shadow-sm border border-[#494454]'
                    : 'text-[#cbc3d7] hover:text-white hover:bg-[#1a1b20]'
                }`}
              >
                Seat Booking
              </button>
              <button
                onClick={() => navigateTo('/my-bookings', 'my-bookings')}
                className={`relative px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  location.pathname === '/my-bookings'
                    ? 'bg-[#292a2e] text-white shadow-sm border border-[#494454]'
                    : 'text-[#cbc3d7] hover:text-white hover:bg-[#1a1b20]'
                }`}
              >
                <Ticket className="w-4 h-4 text-[#4cd7f6]" />
                My Bookings
                {myBookingsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#8b5cf6] text-white text-[10px] font-mono font-bold">
                    {myBookingsCount}
                  </span>
                )}
              </button>
            </>
          )}

          {currentUser?.role === 'partner' && (
            <>
              {[
                { path: '/partner/shows', view: 'shows-pricing', label: 'Shows & Pricing', icon: DollarSign, iconClass: 'text-[#4edea3]' },
                { path: '/partner/seat-planner', view: 'seat-planner', label: 'Seat Layout Studio', icon: LayoutGrid, iconClass: 'text-[#f43f5e]' },
                { path: '/partner/films', view: 'film-catalog', label: 'Film Catalog', icon: Film, iconClass: 'text-[#4cd7f6]' },
                { path: '/partner/films/new', view: 'add-edit-film', label: 'Add / Edit Film', icon: Plus, iconClass: 'text-[#a078ff]' },
                { path: '/partner/authorizations', view: 'cinema-auth', label: 'Cinema Authorization', icon: Building2, iconClass: 'text-[#fbbf24]' },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || (item.path === '/partner/shows' && location.pathname === '/partner');
                return (
                  <button
                    key={item.path}
                    onClick={() => navigateTo(item.path, item.view)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[#292a2e] text-white shadow-sm border border-[#494454]'
                        : 'text-[#cbc3d7] hover:text-white hover:bg-[#1a1b20]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${item.iconClass}`} />
                    {item.label}
                  </button>
                );
              })}
            </>
          )}

          {currentUser?.role === 'admin' && (
            <>
              <button
                onClick={() => navigateTo('/admin/console', 'admin-console')}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  location.pathname.startsWith('/admin')
                    ? 'bg-[#292a2e] text-white shadow-sm border border-[#494454]'
                    : 'text-[#cbc3d7] hover:text-white hover:bg-[#1a1b20]'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-[#d0bcff]" />
                Admin Console
              </button>
              <button
                onClick={() => navigateTo('/partner/shows', 'shows-pricing')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  location.pathname.startsWith('/partner')
                    ? 'bg-[#292a2e] text-white shadow-sm border border-[#494454]'
                    : 'text-[#cbc3d7] hover:text-white hover:bg-[#1a1b20]'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-[#4cd7f6]" />
                Partner Console
              </button>
              <button
                onClick={() => navigateTo('/discover', 'discover')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  (location.pathname === '/' || location.pathname === '/discover')
                    ? 'bg-[#292a2e] text-white shadow-sm border border-[#494454]'
                    : 'text-[#cbc3d7] hover:text-white hover:bg-[#1a1b20]'
                }`}
              >
                Consumer View
              </button>
            </>
          )}
        </nav>

        {/* Right Action Rig: Search, City, Notifications, Auth / Profile */}
        <div className="flex items-center gap-3">
          
          {/* Global Search Bar */}
          <div className="hidden sm:flex items-center gap-2 bg-[#0d0e12] border border-[#232938] px-3 py-1.5 rounded-lg focus-within:border-[#8b5cf6] focus-within:shadow-[0_0_16px_rgba(139,92,246,0.3)] transition-all">
            <Search className="w-4 h-4 text-[#958ea0]" />
            <input
              type="text"
              placeholder="Search movies, venues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-white placeholder-[#958ea0] outline-none w-28 md:w-44 focus:w-56 transition-all"
            />
            <span className="text-[10px] font-mono text-[#958ea0] bg-[#1e1f24] px-1.5 py-0.5 rounded border border-[#292a2e]">⌘K</span>
          </div>

          {/* City Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1b20] border border-[#232938] text-xs font-semibold text-[#e3e2e8] hover:bg-[#292a2e] transition-colors cursor-pointer"
            >
              <MapPin className={`w-3.5 h-3.5 ${userLocation ? 'text-[#4edea3]' : 'text-[#4cd7f6]'}`} />
              <span className="truncate max-w-[130px]">{selectedCity}</span>
              {userLocation && <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" title="GPS Location Active" />}
              <ChevronDown className="w-3.5 h-3.5 text-[#958ea0]" />
            </button>

            {cityDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#181c26] border border-[#232938] rounded-2xl shadow-2xl p-2 z-50 max-h-80 overflow-y-auto">
                {/* GPS Detect Location Trigger */}
                <button
                  type="button"
                  disabled={locating}
                  onClick={handleDetectLocation}
                  className="w-full text-left px-3 py-2.5 mb-1.5 rounded-xl text-xs font-semibold bg-[#03b5d3]/15 text-[#4cd7f6] hover:bg-[#03b5d3]/25 border border-[#03b5d3]/30 flex items-center justify-between transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <LocateFixed className={`w-4 h-4 ${locating ? 'animate-spin text-[#4edea3]' : 'text-[#4cd7f6]'}`} />
                    <span>{locating ? 'Detecting GPS...' : 'Use My Exact Location'}</span>
                  </span>
                  <span className="text-[10px] font-mono uppercase font-bold text-[#4edea3]">Nearest</span>
                </button>

                <div className="h-[1px] bg-[#232938] my-1" />

                <button
                  onClick={() => { setSelectedCity('All Locations'); setCityDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedCity === 'All Locations' ? 'bg-[#8b5cf6]/20 text-[#d0bcff]' : 'text-[#cbc3d7] hover:bg-[#292a2e] hover:text-white'
                  }`}
                >
                  All Locations / Metro
                </button>

                {/* Dynamic Cities from DB & Presets */}
                {(() => {
                  const presetCities = ['Kolkata', 'Hooghly', 'Mumbai (MMR)', 'Delhi NCR', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune'];
                  const dbCityNames = dbCities.map(c => c.city);
                  const combined = Array.from(new Set([...dbCityNames, ...presetCities]));

                  return combined.map((city) => {
                    const dbEntry = dbCities.find(c => c.city.toLowerCase() === city.toLowerCase());
                    const distText = dbEntry?.closestDistanceText;

                    return (
                      <button
                        key={city}
                        onClick={() => { setSelectedCity(city); setCityDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-between ${
                          selectedCity === city ? 'bg-[#8b5cf6]/20 text-[#d0bcff]' : 'text-[#cbc3d7] hover:bg-[#292a2e] hover:text-white'
                        }`}
                      >
                        <span className="truncate">{city}</span>
                        {distText && (
                          <span className="text-[10px] font-mono text-[#4edea3] shrink-0 ml-2">
                            {distText}
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Live In-App Notifications Trigger & Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                if (cityDropdownOpen) setCityDropdownOpen(false);
                if (profileDropdownOpen) setProfileDropdownOpen(false);
              }}
              title="Notifications"
              className="relative p-2 rounded-xl bg-[#1a1b20] border border-[#232938] text-[#cbc3d7] hover:text-white hover:bg-[#292a2e] transition-all cursor-pointer flex items-center justify-center"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#f87171] text-white text-[10px] font-mono font-bold flex items-center justify-center shadow-[0_0_10px_rgba(248,113,113,0.6)] animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#181c26] border border-[#232938] rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-[#232938] mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-mono text-[#f87171] bg-[#f87171]/15 border border-[#f87171]/30 px-2 py-0.5 rounded-full font-bold">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] font-mono text-[#4cd7f6] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-[#64748b] text-xs font-mono">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          !n.is_read
                            ? 'bg-[#1e2230] border-[#8b5cf6]/40 hover:border-[#8b5cf6]'
                            : 'bg-[#12151e] border-[#232938]/60 hover:border-[#384152] opacity-80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#8b5cf6] shrink-0" />}
                            <span className="text-xs font-bold text-white leading-tight">{n.title}</span>
                          </div>
                          <span className="text-[10px] font-mono text-[#958ea0] shrink-0">
                            {formatRelativeTime(n.created_at)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#94a3b8] mt-1 leading-relaxed">
                          {n.message || n.desc}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile / Auth Action */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 bg-[#1a1b20] border border-[#232938] p-1.5 pr-2.5 rounded-full hover:bg-[#292a2e] transition-colors cursor-pointer"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  currentUser.role === 'admin'
                    ? 'bg-gradient-to-tr from-[#d0bcff] to-[#a078ff] text-[#23005c]'
                    : currentUser.role === 'partner'
                    ? 'bg-gradient-to-tr from-[#03b5d3] to-[#4cd7f6] text-[#001f26]'
                    : 'bg-gradient-to-tr from-[#8b5cf6] to-[#06b6d4] text-[#120038]'
                }`}>
                  {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : 'US'}
                </div>
                <div className="hidden xl:flex flex-col text-left">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-white">{currentUser.name || 'User'}</span>
                    <ShieldCheck className="w-3 h-3 text-[#4edea3]" />
                  </div>
                  <span className="text-[9px] font-mono uppercase text-[#94a3b8]">
                    {currentUser.role === 'admin'
                      ? 'Platform Admin'
                      : currentUser.role === 'partner'
                      ? 'Cinema Partner'
                      : 'Customer'}
                  </span>
                </div>
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#181c26] border border-[#232938] rounded-xl shadow-2xl p-2 z-50">
                  <div className="px-3 py-2 border-b border-[#232938] mb-1">
                    <p className="text-xs font-bold text-white">{currentUser.name}</p>
                    <p className="text-[10px] text-[#94a3b8] font-mono">{currentUser.email}</p>
                    {currentUser.venueName && (
                      <p className="text-[10px] text-[#4cd7f6] font-mono mt-0.5">{currentUser.venueName}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#4edea3] bg-[#4edea3]/10 px-2 py-0.5 rounded">
                    <span>Access: {
                      currentUser.role === 'admin'
                        ? 'Platform Admin'
                        : currentUser.role === 'partner'
                        ? 'Cinema Hall Provider'
                        : 'Customer'
                    }</span>
                  </div>
                  </div>

                  {currentUser.role === 'customer' && (
                    <button
                      onClick={() => { navigateTo('/my-bookings', 'my-bookings'); setProfileDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-[#cbc3d7] hover:bg-[#292a2e] hover:text-white flex items-center gap-2 cursor-pointer"
                    >
                      <Ticket className="w-3.5 h-3.5 text-[#4cd7f6]" />
                      My Tickets & QR Passes
                    </button>
                  )}

                  {currentUser.role === 'partner' && (
                    <>
                      <button
                        onClick={() => { navigateTo('/partner/shows', 'shows-pricing'); setProfileDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-[#cbc3d7] hover:bg-[#292a2e] hover:text-white flex items-center gap-2 cursor-pointer"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-[#4edea3]" />
                        Shows & Pricing
                      </button>
                      <button
                        onClick={() => { navigateTo('/partner/seat-planner', 'seat-planner'); setProfileDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-[#cbc3d7] hover:bg-[#292a2e] hover:text-white flex items-center gap-2 cursor-pointer"
                      >
                        <LayoutGrid className="w-3.5 h-3.5 text-[#f43f5e]" />
                        Seat Layout Studio
                      </button>
                      <button
                        onClick={() => { navigateTo('/partner/films', 'film-catalog'); setProfileDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-[#cbc3d7] hover:bg-[#292a2e] hover:text-white flex items-center gap-2 cursor-pointer"
                      >
                        <Film className="w-3.5 h-3.5 text-[#4cd7f6]" />
                        Film Catalog
                      </button>
                      <button
                        onClick={() => { navigateTo('/partner/films/new', 'add-edit-film'); setProfileDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-[#cbc3d7] hover:bg-[#292a2e] hover:text-white flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#a078ff]" />
                        Add New Film
                      </button>
                      <button
                        onClick={() => { navigateTo('/partner/authorizations', 'cinema-auth'); setProfileDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-[#cbc3d7] hover:bg-[#292a2e] hover:text-white flex items-center gap-2 cursor-pointer"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#fbbf24]" />
                        Cinema Authorization
                      </button>
                    </>
                  )}

                  {currentUser.role === 'admin' && (
                    <>
                      <button
                        onClick={() => { navigateTo('/admin/console', 'admin-console'); setProfileDropdownOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-[#cbc3d7] hover:bg-[#292a2e] hover:text-white flex items-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[#d0bcff]" />
                        Admin Root Console
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      onOpenAuth({ 
                        role: currentUser.role === 'admin' ? 'customer' : currentUser.role === 'partner' ? 'admin' : 'partner', 
                        isSignUp: false 
                      });
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-[#cbc3d7] hover:bg-[#292a2e] hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <Building2 className="w-3.5 h-3.5 text-[#03b5d3]" />
                    Switch Platform / Role
                  </button>

                  <button
                    onClick={() => {
                      onLogout();
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-[#ffb4ab] hover:bg-[#292a2e] flex items-center gap-2 cursor-pointer pt-2 border-t border-[#232938]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth({ role: 'admin', isSignUp: false })}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#181c26] hover:bg-[#202534] border border-[#d0bcff]/30 text-[#d0bcff] font-bold text-xs font-mono transition-all cursor-pointer"
                title="Super Admin Portal Sign-In"
              >
                <Lock className="w-3.5 h-3.5 text-[#d0bcff]" />
                <span>Admin Portal</span>
              </button>
              <button
                onClick={() => onOpenAuth({ role: 'customer', isSignUp: false })}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white font-bold text-xs font-mono shadow-[0_0_16px_rgba(160,120,255,0.4)] hover:brightness-110 transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Join</span>
              </button>
            </div>
          )}

        </div>

      </div>
    </header>
  );
}
