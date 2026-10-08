import { useState, useEffect } from 'react';
import {
  Film,
  X,
  ShieldCheck,
  Sparkles,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  User,
  Building2,
  Shield,
  Lock
} from 'lucide-react';
import { authApi, setAuthToken, setStoredUser } from '../api.js';

export function SignupForm({
  role,
  setRole,
  isSignUp,
  setIsSignUp,
  onAuthSuccess
}) {
  const isInviteOnly = role === 'admin';
  const effectiveIsSignUp = isInviteOnly ? false : isSignUp;

  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role === 'admin') {
      setEmail('admin@tixora.io');
    } else {
      setEmail('');
    }
    setPassword('');
    setConfirmPassword('');
    setError(null);
  }, [role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (effectiveIsSignUp && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      let res;
      if (effectiveIsSignUp) {
        const backendRole = role === 'partner' ? 'CINEMA_OWNER' : 'CUSTOMER';
        res = await authApi.signup({
          email,
          password,
          fullName: name || (role === 'partner' ? 'Cinema Partner' : 'Movie Viewer'),
          role: backendRole,
          organizationName: venueName || undefined
        });
      } else {
        res = await authApi.login({
          email,
          password
        });
      }

      if (res?.requiresEmailConfirmation) {
        setError('Account created. Check your email to confirm your address, then sign in.');
        return;
      }

      const token = res?.token;
      const user = res?.user || {};
      if (token) setAuthToken(token);

      const mappedRole = user.role === 'PLATFORM_ADMIN' ? 'admin' : (['CINEMA_OWNER', 'MOVIE_PROVIDER'].includes(user.role) ? 'partner' : 'customer');
      const userData = {
        id: user.id,
        name: user.fullName || user.full_name || name || (role === 'admin' ? 'Super Administrator' : role === 'partner' ? 'Cinema Provider' : 'Movie Viewer'),
        email: user.email || email,
        role: mappedRole,
        venueName: venueName || user.organization_name || user.organizationName,
        token
      };

      setStoredUser(userData);
      onAuthSuccess(userData);
    } catch (err) {
      console.error('Authentication failed:', err);
      setError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full text-left">

      {/* 3-Section Role Tabs */}
      <div className="flex flex-col gap-1.5 pb-1">
        <label className="text-[10px] font-mono uppercase font-bold text-[#958ea0]">
          Account Section:
        </label>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0d0e12] border border-[#232938] rounded-2xl">
          {[
            { id: 'customer', label: 'Movie Viewer', icon: User, color: '#8b5cf6', badge: 'VIEWER' },
            { id: 'partner', label: 'Cinema Provider', icon: Building2, color: '#03b5d3', badge: 'EXHIBITOR' },
            { id: 'admin', label: 'Super Admin', icon: Shield, color: '#d0bcff', badge: 'ROOT' },
          ].map(t => {
            const Icon = t.icon;
            const isSelected = role === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setRole(t.id);
                  if (t.id === 'admin') setIsSignUp(false);
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#181c26] border-[#a078ff]/60 shadow-[0_0_16px_rgba(160,120,255,0.2)]'
                    : 'border-transparent text-[#958ea0] hover:bg-[#12151e] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" style={{ color: isSelected ? t.color : '#958ea0' }} />
                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-[#958ea0]'}`}>
                    {t.label}
                  </span>
                </div>
                <span className={`text-[8px] font-mono mt-0.5 px-1 rounded ${
                  isSelected ? 'bg-white/10 text-white' : 'text-[#64748b]'
                }`}>
                  {t.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
            {role === 'admin' ? (
              <>
                <Lock className="w-4 h-4 text-[#d0bcff]" />
                <span>Super Admin Root Sign In</span>
              </>
            ) : effectiveIsSignUp ? (
              role === 'partner' ? 'Register Cinema Provider' : 'Create Viewer Account'
            ) : (
              role === 'partner' ? 'Cinema Provider Sign In' : 'Movie Viewer Sign In'
            )}
          </h2>
          {role !== 'admin' && (
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs font-mono font-bold text-[#d0bcff] hover:underline"
            >
              {isSignUp ? 'Sign In Instead' : 'Register New'}
            </button>
          )}
        </div>
        <p className="text-xs text-[#94a3b8] font-mono leading-relaxed">
          {role === 'admin'
            ? 'Super Admin oversight for reviewing provider films and verifying statutory certificates.'
            : role === 'partner'
            ? 'Register cinema halls, upload titles with CBFC & distribution deeds, and manage auditoriums.'
            : 'Explore approved theatrical films, inspect verified credentials, and book seats in real-time.'}
        </p>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-[#ffb4ab]/15 border border-[#ffb4ab]/30 text-[#ffb4ab] text-xs font-mono">
          {error}
        </div>
      )}

      {/* Inputs */}
      <div className="flex flex-col gap-3 text-xs font-mono">
        {effectiveIsSignUp && (
          <div className="flex flex-col gap-1">
            <label className="text-[#958ea0]">Full Name</label>
            <input
              type="text"
              required
              placeholder={role === 'partner' ? "e.g. Debasish Banerjee" : "e.g. Arjun Roy"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2 text-white placeholder-[#64748b] outline-none focus:border-[#8b5cf6]"
            />
          </div>
        )}

        {isSignUp && role === 'partner' && (
          <div className="flex flex-col gap-1">
            <label className="text-[#958ea0]">Cinema Hall / Multiplex Name</label>
            <input
              type="text"
              required
              placeholder="e.g. PQR Cinema & Entertainment LLP"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2 text-white placeholder-[#64748b] outline-none focus:border-[#03b5d3]"
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-[#958ea0]">
            {role === 'admin' ? 'Super Admin Email' : role === 'partner' ? 'Cinema Provider Email' : 'Viewer Email'}
          </label>
          <input
            type="email"
            required
            placeholder={role === 'admin' ? "admin@tixora.io" : "user@example.com"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2 text-white placeholder-[#64748b] outline-none focus:border-[#8b5cf6]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[#958ea0]">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0d0e12] border border-[#232938] rounded-xl pl-3.5 pr-10 py-2 text-white placeholder-[#64748b] outline-none focus:border-[#8b5cf6]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white transition-colors cursor-pointer p-0.5 flex items-center justify-center focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {role === 'admin' && (
          <div className="flex flex-col gap-1">
            <label className="text-[#958ea0] flex items-center justify-between">
              <span>Security Access Key (Optional)</span>
              <span className="text-[10px] text-[#d0bcff]">ROOT-SEC-256</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="TXR-ROOT-KEY (Optional)"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="w-full bg-[#0d0e12] border border-[#232938] rounded-xl pl-3.5 pr-10 py-2 text-white placeholder-[#64748b] outline-none focus:border-[#d0bcff]"
              />
              <KeyRound className="w-4 h-4 text-[#d0bcff] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        {effectiveIsSignUp && role !== 'admin' && (
          <div className="flex flex-col gap-1">
            <label className="text-[#958ea0]">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#0d0e12] border border-[#232938] rounded-xl pl-3.5 pr-10 py-2 text-white placeholder-[#64748b] outline-none focus:border-[#8b5cf6]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white transition-colors cursor-pointer p-0.5 flex items-center justify-center focus:outline-none"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2.5 rounded-xl font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 mt-2 ${
            loading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
          } ${
            role === 'admin'
              ? 'bg-gradient-to-r from-[#d0bcff] to-[#a078ff] text-[#23005c] shadow-[0_0_20px_rgba(208,188,255,0.4)] hover:brightness-110'
              : role === 'partner'
              ? 'bg-gradient-to-r from-[#03b5d3] to-[#0ea5e9] text-[#001f26] shadow-[0_0_20px_rgba(3,181,211,0.4)] hover:brightness-110'
              : 'bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white shadow-[0_0_20px_rgba(160,120,255,0.4)] hover:brightness-110'
          }`}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>
            {role === 'admin'
              ? 'Authorize Super Admin Access'
              : effectiveIsSignUp
              ? (role === 'partner' ? 'Register Cinema Provider' : 'Create Viewer Account')
              : (role === 'partner' ? 'Sign In to Cinema Console' : 'Sign In as Movie Viewer')}
          </span>
        </button>

      </div>

    </form>
  );
}

function AuthModalDialog({
  onClose,
  onAuthSuccess,
  initialRole = 'customer',
  initialIsSignUp = false
}) {
  const [role, setRole] = useState(initialRole);
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#12151e] border border-[#232938] rounded-3xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.95)] relative grid grid-cols-1 lg:grid-cols-2 my-8">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 text-[#958ea0] hover:text-white text-sm font-bold bg-[#1a1b20] hover:bg-[#292a2e] w-8 h-8 rounded-full flex items-center justify-center border border-[#232938] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Side: Form Container */}
        <div className="flex flex-col gap-4 p-6 sm:p-8 justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#8b5cf6] to-[#06b6d4] flex items-center justify-center text-[#120038]">
              <Film className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-white">TIXORA</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#8b5cf6]/20 text-[#d0bcff] border border-[#8b5cf6]/30">AUTH PORTAL</span>
          </div>

          <div className="flex flex-1 items-center justify-center w-full">
            <SignupForm
              role={role}
              setRole={setRole}
              isSignUp={isSignUp}
              setIsSignUp={setIsSignUp}
              onAuthSuccess={(data) => {
                onAuthSuccess(data);
                onClose();
              }}
            />
          </div>
        </div>

        {/* Right Side: Cinematic Image & Value Props */}
        <div className="relative hidden lg:flex flex-col justify-between p-8 bg-[#0d0e12] border-l border-[#232938] overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1000&q=80"
            alt="Cinema Auditorium"
            className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e12] via-[#0d0e12]/80 to-transparent"></div>

          {/* Top badge */}
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181c26]/90 border border-[#232938] text-[10px] font-mono text-[#4cd7f6] uppercase font-bold">
              <Sparkles className="w-3 h-3" />
              {role === 'admin'
                ? 'Super Admin Platform Oversight'
                : role === 'partner'
                ? 'Cinema Provider & Exhibitor Portal'
                : 'Customer Ticket Pass & Visual Seating'}
            </span>
          </div>

          {/* Bottom Callout */}
          <div className="relative z-10 flex flex-col gap-3">
            <h3 className="text-xl font-bold text-white">
              {role === 'admin'
                ? 'Super Admin Film Authorization & Clearances'
                : role === 'partner'
                ? 'Cinema Hall Management & Theatrical Title Registration'
                : 'Interactive Visual Seat Booking with Zero Latency'}
            </h3>
            <p className="text-xs text-[#94a3b8] font-mono leading-relaxed">
              {role === 'admin'
                ? 'Platform-wide authority to review provider-submitted films, verify statutory CBFC certificates and distribution deeds, and approve or deny titles in tabular format.'
                : role === 'partner'
                ? 'Submit your movies with legal distribution deeds and CBFC certificates, allot screenings to auditoriums, and manage seat configurations.'
                : 'Book seats in real-time, view verified CBFC certification badges for each movie, and access live QR gate passes.'}
            </p>

            <div className="flex items-center gap-3 pt-2 text-[11px] font-mono text-[#4edea3]">
              <ShieldCheck className="w-4 h-4" />
              <span>
                {role === 'admin'
                  ? 'Super Admin Level 3 Clearance • Cryptographically Verified'
                  : 'SMPTE Hardware Certified • Verified Cinema Network'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function AuthModal({
  isOpen,
  onClose,
  onAuthSuccess,
  initialRole = 'customer',
  initialIsSignUp = false
}) {
  if (!isOpen) return null;

  return (
    <AuthModalDialog
      key={`${initialRole}-${initialIsSignUp}`}
      onClose={onClose}
      onAuthSuccess={onAuthSuccess}
      initialRole={initialRole}
      initialIsSignUp={initialIsSignUp}
    />
  );
}
