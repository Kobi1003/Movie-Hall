import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  ShieldCheck,
  Lock,
  X,
  Calendar,
  Clock,
  Timer,
  AlertTriangle,
  User,
  Users,
  CreditCard,
  Smartphone,
  Landmark,
  Wallet,
  Zap,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { FOOD_MENU } from '../data/mockData';
import { bookingsApi, paymentsApi, showsApi } from '../api.js';

export default function CheckoutModal({
  checkoutData,
  currentUser,
  onClose,
  onSuccess
}) {
  const {
    showId: propShowId,
    movie,
    selectedTheatre,
    selectedScreen,
    selectedDay,
    selectedShowtime,
    selectedSeats = [],
    foodQuantities,
    grandTotal,
    promoCode
  } = checkoutData;

  const showId = propShowId || checkoutData?.showId || movie?.showId;
  const theatreName = selectedTheatre || movie?.theatres?.[0]?.name || movie?.theatre || 'PVR IMAX Grand Galleria';
  const screenName = selectedScreen || movie?.theatres?.[0]?.screenName || 'Screen 3 (Laser Macro XE)';
  const daySlot = selectedDay || 'Today (Fri 25 Sep)';
  const timeSlot = selectedShowtime || '07:30 PM';

  // --- STATE MANAGEMENT ---
  const [activeHoldId, setActiveHoldId] = useState(checkoutData?.holdId || null);
  const [isHolding, setIsHolding] = useState(!checkoutData?.holdId);
  const [holdError, setHoldError] = useState('');
  
  // 2-minute booking window countdown (120 seconds or exact remaining time if promoted)
  const initialSeconds = checkoutData?.customerExpiresAt 
    ? Math.max(5, Math.min(120, Math.floor((new Date(checkoutData.customerExpiresAt).getTime() - Date.now()) / 1000)))
    : 120;
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);
  const [isExpired, setIsExpired] = useState(false);
  const timerRef = useRef(null);

  // Customer & Attendee state (Name & Age)
  const [customerName, setCustomerName] = useState(currentUser?.fullName || currentUser?.name || '');
  const [customerAge, setCustomerAge] = useState('');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '+91 98765 43210');
  const [customerEmail, setCustomerEmail] = useState(currentUser?.email || 'customer@tixora.io');
  const [showPerSeatAttendees, setShowPerSeatAttendees] = useState(false);
  const [attendees, setAttendees] = useState(
    selectedSeats.map(s => ({
      seatId: s.id,
      seatLabel: s.label || `${s.row}${s.number}`,
      name: '',
      age: ''
    }))
  );

  // Payment Gateway selection
  // Options: 'upi', 'card', 'netbanking', 'wallet', 'simulated'
  const [selectedGateway, setSelectedGateway] = useState('upi');
  const [upiId, setUpiId] = useState('customer@okhdfcbank');
  const [selectedUpiApp, setSelectedUpiApp] = useState('Google Pay');
  const [cardNumber, setCardNumber] = useState('4532 8920 1192 7834');
  const [cardHolder, setCardHolder] = useState(currentUser?.fullName || 'Arjun Roy');
  const [cardExpiry, setCardExpiry] = useState('11/28');
  const [cardCvv, setCardCvv] = useState('839');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [selectedWallet, setSelectedWallet] = useState('Paytm Wallet');

  // Processing & Errors
  const [isProcessing, setIsProcessing] = useState(false);
  const [formError, setFormError] = useState('');

  // 1. ACQUIRE REDIS SEAT HOLD ON MOUNT (3-Minute Redis Hold with 2-Minute Customer Window)
  useEffect(() => {
    let isCancelled = false;

    const acquireHold = async () => {
      if (activeHoldId) return; // already held
      setIsHolding(true);
      setHoldError('');
      try {
        if (!showId || selectedSeats.length === 0) {
          throw new Error('Please select valid seats before initiating booking.');
        }
        const holdRes = await showsApi.holdSeats(showId, selectedSeats.map(s => s.id));
        if (isCancelled) return;
        if (!holdRes?.holdId) {
          throw new Error('Could not lock seats in Redis. Another user may have just selected them.');
        }
        setActiveHoldId(holdRes.holdId);
        // Start 2-minute countdown (120 seconds)
        const duration = holdRes.customerDurationSeconds || 120;
        setSecondsRemaining(duration);
      } catch (err) {
        if (!isCancelled) {
          setHoldError(err.message || 'Seat reservation failed. Seats might be held by another user.');
        }
      } finally {
        if (!isCancelled) setIsHolding(false);
      }
    };

    acquireHold();

    return () => {
      isCancelled = true;
    };
  }, [showId, selectedSeats]);

  // 2. LIVE 2-MINUTE COUNTDOWN TIMER
  useEffect(() => {
    if (isHolding || holdError || isExpired) return;

    timerRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSessionExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHolding, holdError, isExpired]);

  // Handle automatic expiration at 00:00 (2 minutes exceeded)
  const handleSessionExpired = async () => {
    setIsExpired(true);
    if (activeHoldId && showId) {
      try {
        await showsApi.releaseHold(showId, activeHoldId);
      } catch (e) {
        console.warn('Failed to release expired hold:', e.message);
      }
    }
  };

  // Safe manual close: release hold so waiting users don't have to wait the full remaining duration
  const handleClose = async () => {
    if (activeHoldId && showId && !isExpired) {
      try {
        await showsApi.releaseHold(showId, activeHoldId);
      } catch (e) {
        console.warn('Failed to release hold on manual modal close:', e.message);
      }
    }
    onClose();
  };

  // Quick auto-fill attendees from primary booker
  const handleAutoFillAttendees = () => {
    setAttendees(selectedSeats.map(s => ({
      seatId: s.id,
      seatLabel: s.label || `${s.row}${s.number}`,
      name: customerName || 'Guest Attendee',
      age: customerAge || '25'
    })));
    setShowPerSeatAttendees(true);
  };

  const handleAttendeeChange = (idx, field, value) => {
    setAttendees(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  // 3. FINAL SUBMIT & CONFIRMATION
  const handleConfirmAndPay = async () => {
    setFormError('');

    // Validation: Name & Age
    if (!customerName.trim()) {
      setFormError('Please enter the primary attendee name.');
      return;
    }
    const ageNum = parseInt(customerAge, 10);
    if (!customerAge || isNaN(ageNum) || ageNum < 3 || ageNum > 120) {
      setFormError('Please enter a valid age between 3 and 120.');
      return;
    }

    if (!activeHoldId) {
      setFormError('Seat hold is not active. Please retry.');
      return;
    }

    setIsProcessing(true);

    const foodItems = Object.entries(foodQuantities || {}).map(([id, qty]) => {
      const item = FOOD_MENU.find(f => f.id === id);
      return { id, name: item ? item.name : id, qty, price: item ? item.price : 0 };
    });

    // Prepare attendees payload
    const formattedAttendees = showPerSeatAttendees
      ? attendees.map(a => ({
          seatId: a.seatId,
          seatLabel: a.seatLabel,
          name: a.name.trim() || customerName,
          age: parseInt(a.age, 10) || ageNum
        }))
      : selectedSeats.map(s => ({
          seatId: s.id,
          seatLabel: s.label || `${s.row}${s.number}`,
          name: customerName,
          age: ageNum
        }));

    let bookingId = null;

    try {
      // 1. Create booking with Name, Age, Attendees
      const createRes = await bookingsApi.create({
        showId,
        holdId: activeHoldId,
        seatIds: selectedSeats.map(s => s.id),
        foodItems,
        promoCode: promoCode || null,
        customerDetails: {
          name: customerName.trim(),
          age: ageNum,
          email: customerEmail.trim(),
          phone: customerPhone.trim()
        },
        attendees: formattedAttendees
      });

      const createdBooking = createRes?.booking || createRes;
      if (!createdBooking?.id) throw new Error('Could not create booking. Please retry.');
      bookingId = createdBooking.id;

      // 2. Initiate Payment with selected gateway
      const paymentPayload = {
        bookingId: createdBooking.id,
        paymentMethod: selectedGateway,
        amount: createdBooking.total_amount,
        upiId: selectedGateway === 'upi' ? upiId : undefined,
        upiApp: selectedGateway === 'upi' ? selectedUpiApp : undefined,
        cardNumber: selectedGateway === 'card' ? cardNumber : undefined,
        cardExpiry: selectedGateway === 'card' ? cardExpiry : undefined,
        cardCvv: selectedGateway === 'card' ? cardCvv : undefined,
        cardHolderName: selectedGateway === 'card' ? cardHolder : undefined,
        bankName: selectedGateway === 'netbanking' ? selectedBank : undefined,
        walletProvider: selectedGateway === 'wallet' ? selectedWallet : undefined
      };

      const payRes = await paymentsApi.create(paymentPayload);
      if (!payRes?.paymentId) throw new Error('Payment gateway initialization failed.');

      // 3. Confirm Payment and Issue Digital Ticket
      const confirmRes = await paymentsApi.confirm({
        paymentId: payRes.paymentId,
        providerPaymentId: payRes.providerPaymentId
      });

      const confirmed = confirmRes?.booking?.booking || confirmRes?.booking || confirmRes;
      const ticket = confirmRes?.booking?.ticket || confirmRes?.ticket;

      if (confirmRes?.paymentStatus !== 'SUCCESS' || !confirmed?.id) {
        throw new Error('Payment was not completed. Please try again.');
      }

      // Success callback
      onSuccess({
        internalId: confirmed.id,
        bookingId: confirmed.booking_reference,
        movieTitle: movie?.title || 'Movie',
        format: movie?.format || '2D',
        theatre: theatreName,
        screen: screenName,
        date: daySlot,
        time: timeSlot,
        seats: selectedSeats.map(s => s.label || s.seatId),
        seatLocations: selectedSeats.map(s => `Row ${s.row}, Seat ${s.number} (${s.tier || 'Standard'})`),
        attendees: formattedAttendees,
        customerName: customerName.trim(),
        customerAge: ageNum,
        paymentGateway: selectedGateway.toUpperCase(),
        totalAmount: confirmed.total_amount,
        status: confirmed.status,
        qrCodeUrl: ticket?.qr_code_data || '',
        foodItems,
        securityCode: ticket?.security_code || '',
        gate: ticket?.gate_info || ''
      });
    } catch (apiErr) {
      if (apiErr?.code === 'CUSTOMER_SESSION_EXPIRED' || /expired/i.test(apiErr?.message || '')) {
        setIsExpired(true);
      }
      setFormError(apiErr.message || 'Transaction could not be completed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Format timer into MM:SS
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const timerPercentage = Math.max(0, Math.min(100, (secondsRemaining / 120) * 100));

  // Visual timer alert color
  const timerColor = secondsRemaining > 60
    ? 'text-[#4edea3] border-[#4edea3]/40 bg-[#4edea3]/10'
    : secondsRemaining > 25
      ? 'text-[#fbbf24] border-[#fbbf24]/40 bg-[#fbbf24]/10'
      : 'text-[#ff6b6b] border-[#ff6b6b]/50 bg-[#ff6b6b]/15 animate-pulse';

  // --- RENDER: EXPIRED OVERLAY ---
  if (isExpired) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#12151e] border border-[#ff6b6b]/40 rounded-3xl p-6 sm:p-7 shadow-[0_24px_60px_rgba(255,107,107,0.25)] flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-[#ff6b6b]/20 border border-[#ff6b6b]/50 flex items-center justify-center text-[#ff6b6b]">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">2-Minute Booking Window Expired</h3>
            <p className="text-xs text-[#958ea0] font-mono mt-1 leading-relaxed">
              As per real-time concurrency rules, your 2-minute reservation session has expired. The Redis hold was automatically released so waiting queue members can book this seat.
            </p>
          </div>
          <div className="w-full p-3 rounded-xl bg-[#181c26] border border-[#232938] text-left text-xs font-mono text-[#cbc3d7] flex flex-col gap-1">
            <span className="text-[#958ea0]">Released Seats:</span>
            <div className="flex flex-wrap gap-1">
              {selectedSeats.map(s => (
                <span key={s.id} className="px-2 py-0.5 rounded bg-[#232938] text-white font-bold">
                  {s.label || s.id}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white font-bold text-sm font-mono hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-lg"
          >
            Return to Seat Map & Re-select
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER: MAIN CHECKOUT WIZARD MODAL ---
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md sm:max-w-lg bg-[#11131a] border border-[#232938] rounded-2xl p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.95)] relative flex flex-col gap-3 my-2 max-h-[94vh] overflow-y-auto">

        {/* COMPACT INTEGRATED HEADER WITH INLINE 2-MINUTE TIMER & CLOSE */}
        <div className="flex flex-col gap-2 pb-2.5 border-b border-[#232938]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#8b5cf6] to-[#06b6d4] flex items-center justify-center text-[#120038] shadow-sm">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm sm:text-base font-bold text-white leading-tight">Complete Booking</h3>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/30 uppercase">
                    2m Lock
                  </span>
                </div>
                <span className="text-[10px] text-[#94a3b8] font-mono">Fill details before lock expires</span>
              </div>
            </div>

            {/* Inline 2-Minute Timer Pill & Close */}
            <div className="flex items-center gap-1.5">
              <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border font-mono font-extrabold text-xs shadow-sm ${timerColor}`}>
                <Timer className="w-3.5 h-3.5" />
                <span>{formattedTime}</span>
              </div>
              <button
                onClick={handleClose}
                className="text-[#958ea0] hover:text-white bg-[#181c26] hover:bg-[#232938] w-7 h-7 rounded-lg flex items-center justify-center border border-[#232938] cursor-pointer transition-colors"
                title="Cancel reservation & release hold"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Slim Progress Track */}
          <div className="w-full bg-[#181c26] h-1 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                secondsRemaining > 60
                  ? 'bg-gradient-to-r from-[#8b5cf6] to-[#4edea3]'
                  : secondsRemaining > 25
                    ? 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b]'
                    : 'bg-gradient-to-r from-[#ef4444] to-[#dc2626]'
              }`}
              style={{ width: `${timerPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* LOADING HOLD STATE */}
        {isHolding && (
          <div className="p-2.5 rounded-lg bg-[#181c26] border border-[#232938] flex items-center justify-center gap-2 text-[11px] font-mono text-[#4cd7f6]">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-[#4cd7f6] border-t-transparent animate-spin"></span>
            <span>Securing 2-minute lock for your seats...</span>
          </div>
        )}

        {holdError && (
          <div className="p-2.5 rounded-lg bg-[#ff6b6b]/15 border border-[#ff6b6b]/40 text-xs font-mono text-[#ffb4ab] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#ff6b6b]" />
            <span>{holdError}</span>
          </div>
        )}

        {/* COMPACT SHOW & SEAT SUMMARY */}
        <div className="p-2.5 rounded-xl bg-[#0d0e12] border border-[#232938] flex flex-col gap-1.5 text-xs font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate max-w-[230px]">
              <span className="text-white font-bold text-xs truncate">{movie?.title}</span>
              <span className="text-[#a078ff] text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#a078ff]/15 border border-[#a078ff]/30 shrink-0">
                {movie?.format || '2D'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#cbc3d7] shrink-0">
              <Calendar className="w-3 h-3 text-[#4edea3]" />
              <span>{daySlot}</span>
              <span className="text-[#494454]">•</span>
              <span className="text-white font-semibold">{timeSlot}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#1e2230]">
            <div className="flex items-center gap-1 text-[#958ea0] truncate max-w-[210px]">
              <Building2 className="w-3 h-3 text-[#4cd7f6] shrink-0" />
              <span className="truncate">{theatreName}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[#958ea0] text-[10px]">Seats:</span>
              <div className="flex flex-wrap gap-1">
                {selectedSeats.map(s => (
                  <span
                    key={s.id}
                    className="px-1.5 py-0.2 rounded bg-[#181c26] border border-[#a078ff]/40 text-white text-[10px] font-bold"
                  >
                    {s.label || s.id}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: ATTENDEE DETAILS (NAME, AGE) */}
        <div className="rounded-xl bg-[#0d0e12] border border-[#232938] p-3 flex flex-col gap-2 font-mono">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#232938]">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#4edea3]" />
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                1. Attendee Details (Required)
              </span>
            </div>
            {selectedSeats.length > 1 && (
              <button
                type="button"
                onClick={() => setShowPerSeatAttendees(!showPerSeatAttendees)}
                className="text-[10px] text-[#a078ff] hover:text-[#c4a6ff] underline cursor-pointer"
              >
                {showPerSeatAttendees ? 'Simple' : `All ${selectedSeats.length} Seats`}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-[10px] text-[#958ea0]">Primary Booker Name *</label>
              <input
                type="text"
                placeholder="Full Name (e.g. Arjun Roy)"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="bg-[#181c26] border border-[#232938] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#64748b] outline-none focus:border-[#a078ff] transition-colors"
              />
            </div>
            <div className="sm:col-span-1 flex flex-col gap-1">
              <label className="text-[10px] text-[#958ea0]">Age *</label>
              <input
                type="number"
                min="3"
                max="120"
                placeholder="Age"
                value={customerAge}
                onChange={e => setCustomerAge(e.target.value)}
                className="bg-[#181c26] border border-[#232938] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#64748b] outline-none focus:border-[#a078ff] transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#958ea0]">Mobile (SMS Tickets)</label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="bg-[#181c26] border border-[#232938] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#64748b] outline-none focus:border-[#a078ff]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#958ea0]">Email Address</label>
              <input
                type="email"
                placeholder="email@domain.com"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                className="bg-[#181c26] border border-[#232938] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#64748b] outline-none focus:border-[#a078ff]"
              />
            </div>
          </div>

          {/* PER-SEAT ATTENDEE BREAKDOWN IF REQUESTED */}
          {showPerSeatAttendees && selectedSeats.length > 1 && (
            <div className="mt-1 pt-2 border-t border-[#232938] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#cbc3d7] font-semibold flex items-center gap-1">
                  <Users className="w-3 h-3 text-[#4cd7f6]" />
                  Individual Ticket Holders:
                </span>
                <button
                  type="button"
                  onClick={handleAutoFillAttendees}
                  className="text-[9px] text-[#4edea3] hover:underline cursor-pointer"
                >
                  Auto-fill All
                </button>
              </div>

              <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto pr-1">
                {attendees.map((attendee, idx) => (
                  <div key={attendee.seatId} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-[#181c26] border border-[#232938]">
                    <span className="text-[11px] font-bold text-[#a078ff] w-10 shrink-0">
                      {attendee.seatLabel}:
                    </span>
                    <input
                      type="text"
                      placeholder="Name"
                      value={attendee.name}
                      onChange={e => handleAttendeeChange(idx, 'name', e.target.value)}
                      className="flex-1 bg-[#0d0e12] border border-[#232938] rounded px-2 py-1 text-[11px] text-white outline-none focus:border-[#a078ff]"
                    />
                    <input
                      type="number"
                      placeholder="Age"
                      value={attendee.age}
                      onChange={e => handleAttendeeChange(idx, 'age', e.target.value)}
                      className="w-14 bg-[#0d0e12] border border-[#232938] rounded px-2 py-1 text-[11px] text-white outline-none focus:border-[#a078ff]"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: PAYMENT METHOD */}
        <div className="rounded-xl bg-[#0d0e12] border border-[#232938] p-3 flex flex-col gap-2 font-mono">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-[#232938]">
            <CreditCard className="w-3.5 h-3.5 text-[#4cd7f6]" />
            <span className="text-[11px] font-bold text-white uppercase tracking-wider">
              2. Payment Method
            </span>
          </div>

          {/* COMPACT GATEWAY TABS */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedGateway('upi')}
              className={`p-1.5 rounded-lg border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                selectedGateway === 'upi'
                  ? 'bg-[#a078ff]/15 border-[#a078ff] text-white shadow-sm'
                  : 'bg-[#181c26] border-[#232938] text-[#958ea0] hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-[#4edea3]" />
              <span className="text-[10px] font-bold">UPI / QR</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedGateway('card')}
              className={`p-1.5 rounded-lg border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                selectedGateway === 'card'
                  ? 'bg-[#a078ff]/15 border-[#a078ff] text-white shadow-sm'
                  : 'bg-[#181c26] border-[#232938] text-[#958ea0] hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-[#4cd7f6]" />
              <span className="text-[10px] font-bold">Card</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedGateway('netbanking')}
              className={`p-1.5 rounded-lg border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                selectedGateway === 'netbanking'
                  ? 'bg-[#a078ff]/15 border-[#a078ff] text-white shadow-sm'
                  : 'bg-[#181c26] border-[#232938] text-[#958ea0] hover:text-white'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-[#fbbf24]" />
              <span className="text-[10px] font-bold">NetBank</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedGateway('wallet')}
              className={`p-1.5 rounded-lg border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                selectedGateway === 'wallet'
                  ? 'bg-[#a078ff]/15 border-[#a078ff] text-white shadow-sm'
                  : 'bg-[#181c26] border-[#232938] text-[#958ea0] hover:text-white'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-[#f472b6]" />
              <span className="text-[10px] font-bold">Wallet</span>
            </button>
          </div>

          {/* GATEWAY DETAILS CONTAINER */}
          <div className="p-2.5 rounded-lg bg-[#181c26] border border-[#232938] flex flex-col gap-2 text-xs">
            {/* 1. UPI Details */}
            {selectedGateway === 'upi' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-[#958ea0]">Choose App:</span>
                  {['Google Pay', 'PhonePe', 'Paytm', 'BHIM UPI'].map(app => (
                    <button
                      key={app}
                      type="button"
                      onClick={() => setSelectedUpiApp(app)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        selectedUpiApp === app
                          ? 'bg-[#4edea3] text-[#00281b]'
                          : 'bg-[#0d0e12] text-[#cbc3d7] border border-[#232938]'
                      }`}
                    >
                      {app}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Enter UPI ID (e.g. name@okhdfcbank)"
                    value={upiId}
                    onChange={e => setUpiId(e.target.value)}
                    className="flex-1 bg-[#0d0e12] border border-[#232938] rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-[#4edea3]"
                  />
                  <span className="text-[9px] text-[#4edea3] px-1.5 py-0.5 rounded bg-[#4edea3]/10 border border-[#4edea3]/30 font-bold shrink-0">
                    Verified
                  </span>
                </div>
              </div>
            )}

            {/* 2. Card Details */}
            {selectedGateway === 'card' && (
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  placeholder="Card Number"
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value)}
                  className="bg-[#0d0e12] border border-[#232938] rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-[#4cd7f6]"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    placeholder="Cardholder Name"
                    value={cardHolder}
                    onChange={e => setCardHolder(e.target.value)}
                    className="bg-[#0d0e12] border border-[#232938] rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-[#4cd7f6]"
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={e => setCardExpiry(e.target.value)}
                      className="w-1/2 bg-[#0d0e12] border border-[#232938] rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-[#4cd7f6]"
                    />
                    <input
                      type="password"
                      placeholder="CVV"
                      maxLength="4"
                      value={cardCvv}
                      onChange={e => setCardCvv(e.target.value)}
                      className="w-1/2 bg-[#0d0e12] border border-[#232938] rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-[#4cd7f6]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. Net Banking */}
            {selectedGateway === 'netbanking' && (
              <div className="grid grid-cols-3 gap-1">
                {['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Bank', 'PNB'].map(bank => (
                  <button
                    key={bank}
                    type="button"
                    onClick={() => setSelectedBank(bank)}
                    className={`p-1 rounded text-[10px] font-bold truncate transition-all cursor-pointer ${
                      selectedBank === bank
                        ? 'bg-[#fbbf24] text-[#2d1b00]'
                        : 'bg-[#0d0e12] text-[#cbc3d7] border border-[#232938]'
                    }`}
                  >
                    {bank}
                  </button>
                ))}
              </div>
            )}

            {/* 4. Digital Wallets */}
            {selectedGateway === 'wallet' && (
              <div className="grid grid-cols-3 gap-1">
                {['Paytm Wallet', 'Amazon Pay', 'Mobikwik'].map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setSelectedWallet(w)}
                    className={`p-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      selectedWallet === w
                        ? 'bg-[#f472b6] text-[#2e001c]'
                        : 'bg-[#0d0e12] text-[#cbc3d7] border border-[#232938]'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: BOOKING CONFIRMATION & PAYMENT CTA */}
        <div className="flex flex-col gap-2 pt-1 border-t border-[#232938]">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#958ea0]">Grand Total Payable:</span>
            <span className="text-base font-bold text-[#d0bcff]">₹{grandTotal.toFixed(2)}</span>
          </div>

          {formError && (
            <p role="alert" className="text-xs text-[#ffb4ab] font-mono bg-[#ff6b6b]/10 border border-[#ff6b6b]/30 p-2 rounded-lg">
              ⚠️ {formError}
            </p>
          )}

          <button
            disabled={isProcessing || isHolding || !activeHoldId}
            onClick={handleConfirmAndPay}
            className={`w-full py-3 rounded-xl font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(160,120,255,0.4)] transition-all ${
              isProcessing || isHolding || !activeHoldId
                ? 'bg-[#1e1f24] text-[#64748b] border border-[#292a2e] cursor-not-allowed'
                : 'bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white hover:brightness-110 active:scale-95 cursor-pointer'
            }`}
          >
            {isProcessing ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                <span>Confirming booking & issuing ticket...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-[#4edea3]" />
                <span>Confirm & Book Tickets (₹{grandTotal.toFixed(2)})</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono text-[#94a3b8]">
            <Lock className="w-3 h-3 text-[#4edea3]" />
            <span>256-Bit SSL Instant Payment • Window Closes in {formattedTime}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
