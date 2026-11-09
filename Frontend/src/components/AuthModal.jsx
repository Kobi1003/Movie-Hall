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
  Lock,
  UserPlus,
  Mail,
  CheckCircle2,
  ArrowLeft,
  RotateCcw
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

  // --- FORGOT PASSWORD WITH OTP STATE ---
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState('REQUEST_OTP'); // 'REQUEST_OTP' | 'VERIFY_OTP'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (role === 'admin') {
      setEmail('admin@tixora.io');
    } else {
      setEmail('');
    }
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setIsForgotPassword(false);
    setForgotStep('REQUEST_OTP');
  }, [role]);

  // Handle Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setForgotSuccessMessage('');
    const targetEmail = forgotEmail.trim() || email.trim();
    if (!targetEmail) {
      setError('Please enter your registered email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await authApi.requestForgotOtp(targetEmail);
      setForgotEmail(targetEmail);
      setForgotStep('VERIFY_OTP');
      setForgotSuccessMessage(res?.message || `A 6-digit OTP code has been sent to ${targetEmail}.`);
    } catch (err) {
      setError(err?.message || 'Could not send OTP. Please check the email address and retry.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Handle Verify OTP & Reset Password
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);

    if (!forgotOtp.trim()) {
      setError('Please enter the 6-digit OTP received in your email.');
      return;
    }
    if (!forgotNewPassword) {
      setError('Please enter your new password.');
      return;
    }
    if (forgotNewPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await authApi.verifyForgotOtp({
        email: forgotEmail.trim(),
        otp: forgotOtp.trim(),
        newPassword: forgotNewPassword
      });

      const token = res?.token || res?.data?.token;
      const user = res?.user || res?.data?.user || {};
      if (token) setAuthToken(token);

      const mappedRole = user.role === 'PLATFORM_ADMIN' ? 'admin' : (['CINEMA_OWNER', 'MOVIE_PROVIDER'].includes(user.role) ? 'partner' : 'customer');
      const userData = {
        id: user.id,
        name: user.fullName || user.full_name || (mappedRole === 'admin' ? 'Super Administrator' : mappedRole === 'partner' ? 'Cinema Provider' : 'Movie Viewer'),
        email: user.email || forgotEmail.trim(),
        role: mappedRole,
        venueName: user.organization_name || user.organizationName,
        token
      };

      setStoredUser(userData);
      onAuthSuccess(userData);
    } catch (err) {
      setError(err?.message || 'Invalid or expired OTP code. Please check your email and retry.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Main login/signup submit
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
          email: email.trim(),
          password,
          fullName: name.trim() || (role === 'partner' ? 'Cinema Partner' : 'Movie Viewer'),
          role: backendRole,
          organizationName: venueName.trim() || undefined
        });
      } else {
        res = await authApi.login({ email: email.trim(), password });
      }

      const token = res?.token;
      const user = res?.user || {};
      if (token) setAuthToken(token);

      const mappedRole = user.role === 'PLATFORM_ADMIN' ? 'admin' : (['CINEMA_OWNER', 'MOVIE_PROVIDER'].includes(user.role) ? 'partner' : 'customer');

      // Check role compatibility with selected tab
      if (!effectiveIsSignUp && role === 'partner' && mappedRole === 'customer') {
        setError('This account is registered as a Movie Viewer. Switch to the Movie Viewer tab to sign in, or register a new Cinema Provider account.');
        setLoading(false);
        return;
      }

      if (!effectiveIsSignUp && role === 'admin' && mappedRole !== 'admin') {
        setError('This account does not have Super Admin clearance. Please sign in with admin@tixora.io.');
        setLoading(false);
        return;
      }

      const userData = {
        id: user.id,
        name: user.fullName || user.full_name || name || (role === 'admin' ? 'Super Administrator' : role === 'partner' ? 'Cinema Provider' : 'Movie Viewer'),
        email: user.email || email.trim(),
        role: mappedRole,
        venueName: venueName || user.organization_name || user.organizationName,
        token
      };

      setStoredUser(userData);
      onAuthSuccess(userData);
    } catch (err) {
      console.error('Authentication failed:', err);
      if (!effectiveIsSignUp) {
        setError('The given credentials are wrong. If you cannot remember your password, click "Forgot Password?" below to receive an OTP.');
      } else {
        setError(err?.message || 'Registration failed. Please check your details and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // RENDER: FORGOT PASSWORD FLOW
  if (isForgotPassword) {
    return (
      <div className="flex flex-col gap-4 w-full text-left">
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => {
              setIsForgotPassword(false);
              setError(null);
            }}
            className="flex items-center gap-1.5 text-xs font-mono text-[#d0bcff] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Sign In</span>
          </button>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#8b5cf6]/20 text-[#d0bcff] border border-[#8b5cf6]/30">
            {forgotStep === 'REQUEST_OTP' ? 'STEP 1: EMAIL OTP' : 'STEP 2: VERIFY & RESET'}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#4cd7f6]" />
            <span>Reset Account Password</span>
          </h2>
          <p className="text-xs text-[#94a3b8] font-mono leading-relaxed">
            {forgotStep === 'REQUEST_OTP'
              ? 'Enter your registered email address. We will send a secure 6-digit OTP code directly to your inbox via EmailJS.'
              : `Enter the 6-digit OTP sent to ${forgotEmail} along with your new password.`}
          </p>
        </div>

        {forgotSuccessMessage && (
          <div className="p-3 rounded-xl bg-[#4edea3]/10 border border-[#4edea3]/30 text-[#4edea3] text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{forgotSuccessMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-[#ffb4ab]/15 border border-[#ffb4ab]/30 text-[#ffb4ab] text-xs font-mono leading-relaxed">
            ⚠️ {error}
          </div>
        )}

        {forgotStep === 'REQUEST_OTP' ? (
          <form onSubmit={handleRequestOtp} className="flex flex-col gap-3 text-xs font-mono">
            <div className="flex flex-col gap-1">
              <label className="text-[#958ea0]">Registered Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={forgotEmail || email}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-[#0d0e12] border border-[#232938] rounded-xl pl-3.5 pr-10 py-2 text-white placeholder-[#64748b] outline-none focus:border-[#4cd7f6]"
                />
                <Mail className="w-4 h-4 text-[#64748b] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={forgotLoading}
              className={`w-full py-2.5 rounded-xl font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 mt-2 bg-gradient-to-r from-[#03b5d3] to-[#8b5cf6] text-white shadow-[0_0_20px_rgba(3,181,211,0.4)] hover:brightness-110 ${
                forgotLoading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {forgotLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Send 6-Digit Verification OTP</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3 text-xs font-mono">
            <div className="flex flex-col gap-1">
              <label className="text-[#958ea0]">6-Digit Verification OTP</label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={forgotOtp}
                onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#0d0e12] border border-[#232938] rounded-xl px-3.5 py-2.5 text-white text-center font-mono text-base tracking-[0.4em] font-bold placeholder-[#64748b] outline-none focus:border-[#4edea3]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[#958ea0]">New Password (min 6 characters)</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  className="w-full bg-[#0d0e12] border border-[#232938] rounded-xl pl-3.5 pr-10 py-2 text-white placeholder-[#64748b] outline-none focus:border-[#8b5cf6]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white transition-colors cursor-pointer p-0.5 flex items-center justify-center focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[#958ea0]">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  className="w-full bg-[#0d0e12] border border-[#232938] rounded-xl pl-3.5 pr-10 py-2 text-white placeholder-[#64748b] outline-none focus:border-[#8b5cf6]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white transition-colors cursor-pointer p-0.5 flex items-center justify-center focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={forgotLoading}
                className="text-[11px] font-mono text-[#d0bcff] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Resend OTP Code</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={forgotLoading}
              className={`w-full py-2.5 rounded-xl font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 mt-1 bg-gradient-to-r from-[#4edea3] to-[#0ea5e9] text-[#002114] shadow-[0_0_20px_rgba(78,222,163,0.4)] hover:brightness-110 ${
                forgotLoading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {forgotLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Verify OTP & Sign In</span>
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full text-left">

      {/* Role Selection Tabs (Only customer & cinema provider - Super Admin is strictly isolated) */}
      {role === 'admin' ? (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#d0bcff]/10 border border-[#d0bcff]/30 text-[#d0bcff]">
          <Lock className="w-4 h-4 shrink-0 text-[#d0bcff]" />
          <div className="flex flex-col">
            <span className="text-xs font-bold font-mono uppercase tracking-wider">Super Admin Root Access Gateway</span>
            <span className="text-[10px] text-[#958ea0] font-mono">Restricted clearance only. Customers and cinema partners cannot access this console.</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 pb-1">
          <label className="text-[10px] font-mono uppercase font-bold text-[#958ea0]">
            Account Section:
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0d0e12] border border-[#232938] rounded-2xl">
            {[
              { id: 'customer', label: 'Movie Viewer', icon: User, color: '#8b5cf6', badge: 'VIEWER' },
              { id: 'partner', label: 'Cinema Provider', icon: Building2, color: '#03b5d3', badge: 'EXHIBITOR' },
            ].map(t => {
              const Icon = t.icon;
              const isSelected = role === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setRole(t.id);
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
      )}

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
              onClick={() => {
                setError(null);
                setIsSignUp(!isSignUp);
              }}
              className="text-xs font-mono font-bold text-[#d0bcff] hover:underline cursor-pointer"
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
        <div className="p-3 rounded-xl bg-[#ffb4ab]/15 border border-[#ffb4ab]/30 text-[#ffb4ab] text-xs font-mono leading-relaxed flex flex-col gap-2">
          <span>{error}</span>
          {!effectiveIsSignUp && role !== 'admin' && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setForgotEmail(email);
                  setIsForgotPassword(true);
                  setForgotStep('REQUEST_OTP');
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#4cd7f6] bg-[#03b5d3]/15 hover:bg-[#03b5d3]/25 border border-[#03b5d3]/30 px-3 py-1.5 rounded-lg w-fit transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Reset password via Email OTP</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setIsSignUp(true);
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-lg w-fit transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create new account</span>
              </button>
            </div>
          )}
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

        {effectiveIsSignUp && role === 'partner' && (
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
          <div className="flex items-center justify-between">
            <label className="text-[#958ea0]">Password</label>
            {!effectiveIsSignUp && role !== 'admin' && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setForgotEmail(email);
                  setIsForgotPassword(true);
                  setForgotStep('REQUEST_OTP');
                }}
                className="text-[10px] font-mono text-[#4cd7f6] hover:underline cursor-pointer flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3" />
                <span>Forgot password? (Get OTP)</span>
              </button>
            )}
          </div>
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
          <button
            type="button"
            onClick={() => {
              setEmail('admin@tixora.io');
              setPassword('Password123!');
            }}
            className="text-[11px] font-mono text-[#d0bcff] hover:underline flex items-center gap-1.5 self-start cursor-pointer py-1 mb-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-fill Super Admin credentials</span>
          </button>
        )}

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

  const rightPanelContent = {
    admin: {
      badge: 'Super Admin Platform Oversight',
      title: 'Super Admin Film Authorization & Clearances',
      desc: 'Platform-wide authority to review provider-submitted films, verify statutory CBFC certificates and distribution deeds, and approve or deny titles in tabular format.',
      footer: 'Super Admin Level 3 Clearance • Cryptographically Verified'
    },
    partner: {
      badge: 'Cinema Provider & Exhibitor Portal',
      title: 'Cinema Hall Management & Theatrical Title Registration',
      desc: 'Submit your movies with legal distribution deeds and CBFC certificates, allot screenings to auditoriums, and manage seat configurations.',
      footer: 'SMPTE Hardware Certified • Verified Cinema Network'
    },
    customer: {
      badge: 'Customer Ticket Pass & Visual Seating',
      title: 'Interactive Visual Seat Booking with Zero Latency',
      desc: 'Book seats in real-time, view verified CBFC certification badges for each movie, and access live QR gate passes.',
      footer: 'SMPTE Hardware Certified • Verified Cinema Network'
    }
  };

  const rp = rightPanelContent[role] || rightPanelContent.customer;

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
              {rp.badge}
            </span>
          </div>

          {/* Bottom Callout */}
          <div className="relative z-10 flex flex-col gap-3">
            <h3 className="text-xl font-bold text-white">{rp.title}</h3>
            <p className="text-xs text-[#94a3b8] font-mono leading-relaxed">{rp.desc}</p>

            <div className="flex items-center gap-3 pt-2 text-[11px] font-mono text-[#4edea3]">
              <ShieldCheck className="w-4 h-4" />
              <span>{rp.footer}</span>
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
