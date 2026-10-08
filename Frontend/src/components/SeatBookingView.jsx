import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Timer, 
  ChevronDown, 
  Tv, 
  Check, 
  X, 
  Volume2, 
  ShieldCheck, 
  Sparkles, 
  Plus, 
  Minus, 
  Ticket, 
  CreditCard, 
  Tag,
  Accessibility,
  Armchair,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Info,
  Lock,
  Users,
  AlertCircle,
  Hourglass
} from 'lucide-react';
import { FOOD_MENU } from '../data/mockData';
import { showsApi } from '../api.js';
import { supabase } from '../supabaseClient.js';

export default function SeatBookingView({ 
  movie, 
  initialSlot,
  onBack, 
  onCheckoutComplete,
  currentUser,
  onOpenAuth
}) {
  // Theatre & Screen metadata
  const selectedTheatre = initialSlot?.theatre || movie?.theatres?.[0]?.name || movie?.theatre || 'PVR IMAX Grand Galleria';
  const selectedScreen = initialSlot?.screen || movie?.theatres?.[0]?.screenName || 'Screen 3 (Laser Macro XE)';
  const theatreObj = movie?.theatres?.find(t => t.name === selectedTheatre) || movie?.theatres?.[0];

  // Day & Timing state
  const [selectedDay, setSelectedDay] = useState(initialSlot?.day || theatreObj?.showtimes?.[0]?.date || '');
  const [selectedShowtime, setSelectedShowtime] = useState(
    initialSlot?.time || theatreObj?.showtimes?.[0]?.time || movie?.showtimes?.[0]?.time || ''
  );
  const [selectedShowId, setSelectedShowId] = useState(initialSlot?.showId || theatreObj?.showtimes?.find(s => s.time === initialSlot?.time)?.showId || movie?.showId || null);
  const [seatMap, setSeatMap] = useState(null);
  const [seatMapError, setSeatMapError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');

  // Available days & showtimes
  const availableDays = theatreObj?.showtimes?.length
    ? [...new Set(theatreObj.showtimes.map(s => s.date))].filter(Boolean)
    : [];
  const dayShows = (theatreObj?.showtimes || []).filter(s => !selectedDay || s.date === selectedDay);
  const availableShowtimes = dayShows.map(s => s.time);

  // Pricing Tiers (Provider's 3-Tier choices)
  const seatList = seatMap?.sections?.flatMap(section => section.seats.map(seat => ({ ...seat, tier: section.name }))) || [];
  const screenAtBottom = String(seatMap?.seatPlan?.screenPosition || 'TOP').toUpperCase() === 'BOTTOM';

  const getTierRank = (secName) => {
    const name = String(secName || '').toLowerCase();
    if (name.includes('reclin') || name.includes('vip') || name.includes('box') || name.includes('lounge')) return 1;
    if (name.includes('prem') || name.includes('deluxe') || name.includes('exec') || name.includes('gold')) return 2;
    if (name.includes('standard') || name.includes('classic') || name.includes('silver') || name.includes('stall')) return 4;
    return 3;
  };

  const sortedSections = [...(seatMap?.sections || [])].sort((a, b) => {
    // Primary: VIP (1) -> Premium (2) -> Standard (4, at the back)
    const rankDiff = getTierRank(a.name) - getTierRank(b.name);
    if (rankDiff !== 0) return rankDiff;
    const minRowA = (a.seats || []).map(s => s.row || '').filter(Boolean).sort()[0] || '';
    const minRowB = (b.seats || []).map(s => s.row || '').filter(Boolean).sort()[0] || '';
    return minRowA.localeCompare(minRowB);
  });

  const ticketTiers = sortedSections.map(section => ({
    tierName: section.name,
    price: section.seats.length ? Math.min(...section.seats.map(seat => Number(seat.price))) : 0
  }));
  const priceForCategory = (matcher) => seatList.find(seat => matcher.test(seat.tier))?.price ?? '—';
  const reclinerPrice = priceForCategory(/reclin|vip|lounge/i);
  const vipPrice = priceForCategory(/prem|deluxe|gold|exec/i);
  const classicPrice = priceForCategory(/classic|standard|stalls/i);

  // Selected Seats State (initial selected B7, B8 with exact location metadata)
  const [selectedSeats, setSelectedSeats] = useState([]);

  // F&B Add-ons State
  const [foodQuantities, setFoodQuantities] = useState({});

  // Promo code
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [promoMessage, setPromoMessage] = useState(null);

  // Redis Hold & FIFO Contested Queue State
  const [contestedSeat, setContestedSeat] = useState(null);
  const [queuedSeats, setQueuedSeats] = useState({}); // { [seatId]: { queueRequestId, position, seat } }
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [promotionNotification, setPromotionNotification] = useState(null);
  const [realtimeActive, setRealtimeActive] = useState(false);

  useEffect(() => {
    if (initialSlot?.showId) {
      setSelectedShowId(initialSlot.showId);
      if (initialSlot.day) setSelectedDay(initialSlot.day);
      if (initialSlot.time) setSelectedShowtime(initialSlot.time);
    } else if (!selectedShowId && theatreObj?.showtimes?.length) {
      const show = theatreObj.showtimes[0];
      setSelectedDay(show.date);
      setSelectedShowtime(show.time);
      setSelectedShowId(show.showId);
    }
  }, [initialSlot, theatreObj]);

  useEffect(() => {
    if (!selectedShowId) {
      setSeatMap(null);
      setSeatMapError('This show is not connected to a published seat map yet.');
      return undefined;
    }
    let cancelled = false;
    let loadedShowId = null;
    const loadSeatMap = async () => {
      try {
        const result = await showsApi.getSeatMap(selectedShowId);
        if (!cancelled) {
          if (loadedShowId !== selectedShowId) setSelectedSeats([]);
          loadedShowId = selectedShowId;
          setSeatMap(result);
          setSeatMapError('');

          // Check if any seat we were queued for has been promoted to us
          const allSeats = result.sections?.flatMap(sec => sec.seats) || [];
          let newlyPromoted = null;

          setQueuedSeats(prevQueued => {
            let changed = false;
            const nextQueued = { ...prevQueued };
            for (const [seatId, info] of Object.entries(prevQueued)) {
              const currentSeat = allSeats.find(s => s.id === seatId);
              if (currentSeat) {
                // If now held by current user -> PROMOTED!
                if (currentSeat.heldByCurrentUser) {
                  changed = true;
                  delete nextQueued[seatId];
                  newlyPromoted = { currentSeat, info };
                  setPromotionNotification({
                    seat: currentSeat,
                    message: `🎉 Great news! Seat ${currentSeat.seatId} has been unlocked and held for you! You have a 2-minute booking window to complete checkout.`
                  });
                  // Automatically add to selected seats
                  setSelectedSeats(prev => {
                    if (prev.some(s => s.id === currentSeat.id)) return prev;
                    return [...prev, {
                      id: currentSeat.id,
                      label: currentSeat.seatId,
                      row: currentSeat.row,
                      number: currentSeat.number,
                      tier: info.seat?.tier || currentSeat.seatType || 'Standard',
                      price: Number(currentSeat.price)
                    }];
                  });
                }
              }
            }
            return changed ? nextQueued : prevQueued;
          });

          // AUTOMATIC INSTANT BOOKING WINDOW:
          // As soon as the held seat is unlocked and awarded to the waiting customer,
          // instantly dismiss the waiting dialog and open CheckoutModal without any extra clicks!
          if (newlyPromoted) {
            setContestedSeat(null);
            const pSeat = {
              id: newlyPromoted.currentSeat.id,
              label: newlyPromoted.currentSeat.seatId,
              row: newlyPromoted.currentSeat.row,
              number: newlyPromoted.currentSeat.number,
              tier: newlyPromoted.info.seat?.tier || newlyPromoted.currentSeat.seatType || 'Standard',
              price: Number(newlyPromoted.currentSeat.price)
            };
            const tPrice = Number(pSeat.price) || 250;
            const fee = 30;
            const tax = (tPrice + fee) * 0.18;
            const autoGrandTotal = tPrice + fee + tax;

            if (onCheckoutComplete) {
              onCheckoutComplete({
                showId: selectedShowId,
                movie,
                selectedTheatre,
                selectedScreen,
                selectedDay,
                selectedShowtime,
                selectedSeats: [pSeat],
                foodQuantities: {},
                promoCode: null,
                grandTotal: autoGrandTotal,
                ticketTiers,
                holdId: newlyPromoted.currentSeat.holdId || null,
                customerExpiresAt: newlyPromoted.currentSeat.customerExpiresAt || newlyPromoted.currentSeat.heldUntil || null
              });
            }
          }

          // Keep customer's selection across refreshes
          setSelectedSeats(prev => {
            if (!prev.length) return prev;
            const stillSelectable = new Set(
              result.sections.flatMap(section => section.seats)
                .filter(seat => seat.status === 'AVAILABLE' || seat.heldByCurrentUser)
                .map(seat => seat.id)
            );
            const next = prev.filter(seat => stillSelectable.has(seat.id));
            return next.length === prev.length ? prev : next;
          });
        }
      } catch (error) {
        if (!cancelled) {
          setSeatMap(null);
          setSeatMapError(error.message || 'Could not load seats for this show.');
        }
      }
    };
    loadSeatMap();

    // Supabase Realtime sync on show_seats postgres_changes
    let realtimeChannel = null;
    try {
      realtimeChannel = supabase
        .channel(`show-seats-live-${selectedShowId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'show_seats',
            filter: `show_id=eq.${selectedShowId}`
          },
          (payload) => {
            console.log('[Supabase Realtime] seat update detected:', payload.eventType);
            loadSeatMap();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeActive(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setRealtimeActive(false);
          }
        });
    } catch (e) {
      console.warn('Realtime sync fallback to polling:', e);
    }

    // Polling fallback loop
    const pollInterval = Object.keys(queuedSeats).length > 0 ? 1500 : 12000;
    const refreshId = window.setInterval(loadSeatMap, pollInterval);
    return () => {
      cancelled = true;
      window.clearInterval(refreshId);
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [selectedShowId, queuedSeats]);

  // FIFO Waiting Queue Actions
  const handleJoinQueue = async (seat) => {
    if (!currentUser) {
      if (onOpenAuth) onOpenAuth({ role: 'customer', isSignUp: false });
      return;
    }
    setQueueLoading(true);
    setQueueError('');
    try {
      const res = await showsApi.joinQueue(selectedShowId, seat.id);
      setQueuedSeats(prev => ({
        ...prev,
        [seat.id]: {
          queueRequestId: res.queueRequestId,
          position: res.position || 1,
          seat
        }
      }));
      // Refresh seat map to reflect updated queue count
      const updated = await showsApi.getSeatMap(selectedShowId);
      setSeatMap(updated);
    } catch (err) {
      setQueueError(err.message || 'Could not join waiting queue');
    } finally {
      setQueueLoading(false);
    }
  };

  const handleLeaveQueue = async (seatId) => {
    const queueEntry = queuedSeats[seatId];
    if (!queueEntry?.queueRequestId) return;
    setQueueLoading(true);
    setQueueError('');
    try {
      await showsApi.cancelQueue(queueEntry.queueRequestId);
      setQueuedSeats(prev => {
        const next = { ...prev };
        delete next[seatId];
        return next;
      });
      const updated = await showsApi.getSeatMap(selectedShowId);
      setSeatMap(updated);
    } catch (err) {
      setQueueError(err.message || 'Could not leave waiting queue');
    } finally {
      setQueueLoading(false);
    }
  };

  // Seat toggle logic
  const handleSeatClick = (seat, sectionName) => {
    if (!seat) return;

    // If held by someone else, show contested lock & queue details modal
    if (seat.status === 'HELD' && !seat.heldByCurrentUser) {
      setContestedSeat({ ...seat, tier: sectionName });
      setQueueError('');
      return;
    }

    if (seat.status !== 'AVAILABLE' && !seat.heldByCurrentUser) return;

    const isAlreadySelected = selectedSeats.some(s => s.id === seat.id);
    if (isAlreadySelected) {
      setSelectedSeats(prev => prev.filter(s => s.id !== seat.id));
    } else {
      if (selectedSeats.length >= 8) {
        alert('Maximum 8 seats per booking session.');
        return;
      }
      setSelectedSeats(prev => [...prev, { id: seat.id, label: seat.seatId, row: seat.row, number: seat.number, tier: sectionName, price: Number(seat.price) }]);
    }
  };

  const handleFoodQuantity = (id, delta) => {
    setFoodQuantities(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (code === 'TIXORA100' || code === 'IMAXPASS') {
      setAppliedDiscount(100);
      setPromoMessage({ type: 'success', text: '₹100 Instant Discount Applied!' });
    } else if (code === 'VIP50') {
      setAppliedDiscount(50);
      setPromoMessage({ type: 'success', text: '₹50 Concession Voucher Applied!' });
    } else {
      setPromoMessage({ type: 'error', text: 'Invalid promo voucher code' });
    }
  };

  // Pricing calculations
  const seatsTotal = selectedSeats.reduce((acc, s) => acc + s.price, 0);
  const foodTotal = Object.entries(foodQuantities).reduce((acc, [id, qty]) => {
    const item = FOOD_MENU.find(f => f.id === id);
    return acc + (item ? item.price * qty : 0);
  }, 0);
  const convenienceFee = seatsTotal > 0 ? Math.round(selectedSeats.length * 42.50) : 0;
  const gst = Math.round(convenienceFee * 0.18);
  const grandTotal = Math.max(0, seatsTotal + foodTotal + convenienceFee + gst - appliedDiscount);

  // Seat availability and identifiers come from the selected show's live seat map.
  const renderSeat = (row, number, tier, price) => {
    const seatId = `${row}${number}`;
    const seat = seatList.find(item => item.seatId === seatId);
    if (!seat) return null;
    const isSelected = selectedSeats.some(s => s.id === seat.id);
    const isSold = ['BOOKED', 'BLOCKED'].includes(seat.status);
    const isHeld = seat.status === 'HELD' && !seat.heldByCurrentUser;
    const isWheelchair = /ACCESS|WHEELCHAIR/i.test(seat.seatType || '');
    const isRecliner = /reclin/i.test(tier);

    let buttonClass = 'relative flex items-center justify-center font-mono text-[11px] font-bold rounded-md transition-all cursor-pointer ';

    if (isRecliner) {
      buttonClass += 'w-9 h-8 ';
    } else {
      buttonClass += 'w-7 h-7 sm:w-8 sm:h-7 text-[10px] sm:text-[11px] ';
    }

    if (isSelected) {
      buttonClass += 'bg-[#a078ff] text-[#120038] shadow-[0_0_14px_rgba(160,120,255,0.85)] scale-105 z-10 font-bold border border-[#d0bcff]';
    } else if (isSold) {
      buttonClass += 'bg-[#0d0e12] opacity-30 text-[#958ea0] border border-dashed border-[#232938] cursor-not-allowed';
    } else if (isHeld) {
      buttonClass += 'bg-[#00a572]/20 text-[#4edea3] border border-[#00a572]/40 animate-pulse';
    } else {
      buttonClass += 'bg-[#181c26] text-[#e3e2e8] border border-[#232938] hover:bg-[#292a2e] hover:border-[#8b5cf6] hover:scale-105';
    }

    return (
      <button
        key={seatId}
        disabled={isSold}
        onClick={() => handleSeatClick(seat, tier)}
        className={buttonClass}
        title={`Seat Location: Row ${row}, Seat ${number} (${tier} — ₹${price})`}
      >
          {isSelected ? (
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        ) : isWheelchair ? (
          <Accessibility className="w-3.5 h-3.5 text-[#4cd7f6]" />
          ) : isHeld ? (
          <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span>
        ) : (
          <span>{seatId}</span>
        )}
      </button>
    );
  };

  return (
    <div className="w-full flex flex-col pt-20 bg-[#08090d] min-h-screen">
      
      {/* STICKY TOP CONTEXT & SLOT CONTROL HEADER */}
      <section className="sticky top-20 z-40 w-full bg-[#0d0e12]/95 backdrop-blur-2xl border-b border-[#232938] px-4 sm:px-6 lg:px-8 py-3.5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          
          {/* Back Button & Metadata */}
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              onClick={onBack}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1a1b20] text-[#cbc3d7] hover:text-white hover:bg-[#292a2e] border border-[#232938] transition-colors shrink-0 cursor-pointer"
              title="Back to Movies Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-white truncate">{movie?.title}</h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#4cd7f6]/15 text-[#4cd7f6] border border-[#4cd7f6]/30 uppercase">
                  {movie?.format}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e1f24] text-[#cbc3d7] border border-[#292a2e] uppercase">
                  {movie?.language}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-[#94a3b8] font-mono truncate mt-0.5">
                <span className="text-white font-medium flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-[#4cd7f6]" />
                  {selectedTheatre} • {selectedScreen}
                </span>
                <span className="text-[#494454]">•</span>
                <span className="text-[#a078ff] font-bold">{selectedDay} • {selectedShowtime}</span>
              </div>
            </div>
          </div>

          {/* Hold Countdown Timer */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1e1f24] border border-[#292a2e] shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4edea3]"></span>
              </span>
              <Timer className="w-4 h-4 text-[#4edea3]" />
              <span className="text-xs font-mono tracking-wider text-white">
                LIVE AVAILABILITY
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* SLOT SWITCHER BAR: DAY & TIMINGS SELECTION */}
      <section className="w-full bg-[#12151e] border-b border-[#232938] px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* Day / Date Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono uppercase font-bold text-[#958ea0] flex items-center gap-1.5 mr-1">
              <Calendar className="w-3.5 h-3.5 text-[#4edea3]" />
              Day:
            </span>
            {availableDays.map(day => (
              <button
                key={day}
                onClick={() => {
                  const nextShow = theatreObj?.showtimes?.find(s => s.date === day);
                  setSelectedDay(day);
                  if (nextShow) {
                    setSelectedShowtime(nextShow.time);
                    setSelectedShowId(nextShow.showId);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  selectedDay === day
                    ? 'bg-[#a078ff] text-[#120038] shadow-[0_0_10px_rgba(160,120,255,0.4)]'
                    : 'bg-[#181c26] text-[#cbc3d7] hover:text-white border border-[#232938]'
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Showtime Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono uppercase font-bold text-[#958ea0] flex items-center gap-1.5 mr-1">
              <Clock className="w-3.5 h-3.5 text-[#4cd7f6]" />
              Timing:
            </span>
            {availableShowtimes.map(time => (
              <button
                key={time}
                onClick={() => {
                  setSelectedShowtime(time);
                  const nextShow = dayShows.find(s => s.time === time);
                  if (nextShow) setSelectedShowId(nextShow.showId);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  selectedShowtime === time
                    ? 'bg-[#4cd7f6] text-[#001f26] shadow-[0_0_10px_rgba(76,215,246,0.4)]'
                    : 'bg-[#181c26] text-[#cbc3d7] hover:text-white border border-[#232938]'
                }`}
              >
                {time}
              </button>
            ))}
          </div>

        </div>
      </section>

      {/* MAIN WORKSPACE GRID: SEAT MAP CANVAS + CHECKOUT DOCK */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT / CENTER: PRICING DETAILS & INTERACTIVE SEATING CANVAS (8 of 12 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* PRICING DETAILS & SEAT TIER BREAKDOWN (Hall Provider Choice) */}
          <div className="rounded-2xl bg-[#12151e] border border-[#232938] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#232938]">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#4edea3]" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Pricing Details & Tier Specifications (Exhibitor Choice)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#958ea0]">{selectedTheatre}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Tier 1 */}
              <div className="p-3.5 rounded-xl bg-[#181c26] border border-[#a078ff]/40 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#d0bcff] flex items-center gap-1.5">
                      <Armchair className="w-3.5 h-3.5 text-[#a078ff]" />
                      Recliner Lounge
                    </span>
                    <span className="text-sm font-extrabold font-mono text-[#4edea3]">₹{reclinerPrice}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#958ea0] uppercase tracking-wide">Row A (Motorized)</span>
                  <p className="text-[11px] text-[#cbc3d7] mt-1.5 leading-relaxed">
                    Ultra-luxury motorized full leather incline, personal food tray, plush blanket, front elevation.
                  </p>
                </div>
              </div>

              {/* Tier 2 */}
              <div className="p-3.5 rounded-xl bg-[#181c26] border border-[#4cd7f6]/40 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#4cd7f6] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#4cd7f6]" />
                      VIP Deluxe
                    </span>
                    <span className="text-sm font-extrabold font-mono text-[#4edea3]">₹{vipPrice}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#958ea0] uppercase tracking-wide">Rows B, C, D</span>
                  <p className="text-[11px] text-[#cbc3d7] mt-1.5 leading-relaxed">
                    Prime center field-of-view eye level sweet spot, ergonomic contour foam, extra legroom.
                  </p>
                </div>
              </div>

              {/* Tier 3 */}
              <div className="p-3.5 rounded-xl bg-[#181c26] border border-[#232938] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#cbc3d7] flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-[#958ea0]" />
                      Classic
                    </span>
                    <span className="text-sm font-extrabold font-mono text-[#4edea3]">₹{classicPrice}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#958ea0] uppercase tracking-wide">Rows E to K</span>
                  <p className="text-[11px] text-[#cbc3d7] mt-1.5 leading-relaxed">
                    Tiered stadium elevation, direct Dolby Atmos sound axis dispersion, standard comfort.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* VISUAL SEATING AUDITORIUM CANVAS */}
          <div className="relative w-full rounded-2xl bg-[#0d0e12] border border-[#232938] p-4 sm:p-6 overflow-hidden shadow-2xl flex flex-col">
            
            {/* PROJECTION SCREEN ARC SIMULATION */}
            <div className={`w-full flex flex-col items-center pt-2 pb-8 relative ${screenAtBottom ? 'order-last' : ''}`}>
              <div className="absolute top-6 left-1/2 -translate-x-1/2 w-4/5 h-24 bg-gradient-to-b from-[#4cd7f6]/15 via-[#4cd7f6]/5 to-transparent pointer-events-none rounded-t-full blur-sm"></div>
              <div className="w-11/12 max-w-xl h-2.5 rounded-[50%] bg-gradient-to-r from-transparent via-[#4cd7f6] to-transparent shadow-[0_0_28px_rgba(76,215,246,0.85)] mb-2"></div>
              <div className="flex items-center gap-2 text-[#4cd7f6] tracking-widest font-mono text-[11px] uppercase opacity-90">
                <Tv className="w-3.5 h-3.5" />
                SCREEN {screenAtBottom ? 'AT BACK' : 'AT FRONT'} • FACE THIS WAY
              </div>
            </div>

            {/* SEATING LEGEND */}
            <div className="w-full bg-[#12151e]/80 rounded-xl p-3 mb-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-mono border border-[#232938]/60">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-sm bg-[#181c26] border border-[#232938] block"></span>
                <span className="text-[#94a3b8]">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-sm bg-[#a078ff] shadow-[0_0_8px_rgba(160,120,255,0.7)] flex items-center justify-center text-[#120038]">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
                <span className="text-white font-bold">Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-sm bg-[#0d0e12] opacity-40 border border-dashed border-[#232938]"></span>
                <span className="text-[#64748b]">Sold</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-sm bg-amber-500/20 border border-amber-500/60 flex items-center justify-center text-amber-400">
                  <Lock className="w-2.5 h-2.5" />
                </span>
                <span className="text-amber-300 font-medium">Locked in Redis (Click for Queue)</span>
              </div>
              {Object.keys(queuedSeats).length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-sm bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 text-[8px] font-bold">
                    Q
                  </span>
                  <span className="text-cyan-300 font-medium">In Queue</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-sm bg-[#181c26] border border-[#232938] flex items-center justify-center text-[#4cd7f6]">
                  <Accessibility className="w-2.5 h-2.5" />
                </span>
                <span className="text-[#94a3b8]">Wheelchair</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-3.5 rounded-sm bg-[#181c26] border border-[#a078ff]/40 flex items-center justify-center text-[#a078ff]">
                  <Armchair className="w-2.5 h-2.5" />
                </span>
                <span className="text-[#94a3b8]">Recliner</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0d0e12] border border-[#232938] text-[10px] font-mono">
                <span className={`w-2 h-2 rounded-full ${realtimeActive ? 'bg-[#4edea3] shadow-[0_0_8px_#4edea3] animate-pulse' : 'bg-[#03b5d3] animate-pulse'}`} />
                <span className={realtimeActive ? 'text-[#4edea3] font-bold' : 'text-[#4cd7f6] font-semibold'}>
                  {realtimeActive ? 'SUPABASE REALTIME: SYNCED' : 'LIVE SEAT SYNC: POLLING ACTIVE'}
                </span>
              </div>
            </div>

            {/* PROMOTION NOTIFICATION BANNER */}
            {promotionNotification && (
              <div className="w-full mb-4 p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/80 to-[#12151e] border border-emerald-500/50 flex items-center justify-between gap-3 shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-mono">
                    <p className="text-emerald-200 font-bold">{promotionNotification.message}</p>
                    <p className="text-[#94a3b8] text-[11px] mt-0.5">Your seat hold is active in Redis. Please complete your attendee details and payment.</p>
                  </div>
                </div>
                <button
                  onClick={() => setPromotionNotification(null)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400 text-xs font-mono font-bold transition-all shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* ACTIVE WAITING QUEUE SUMMARY BAR */}
            {Object.keys(queuedSeats).length > 0 && (
              <div className="w-full mb-4 p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2.5 text-cyan-200">
                  <Hourglass className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
                  <span>
                    <strong>Active Queue Watcher:</strong> Waiting for seat(s){' '}
                    {Object.values(queuedSeats).map(q => `${q.seat?.seatId || ''} (Pos #${q.position})`).join(', ')}. Polling every 5s for early expiration.
                  </span>
                </div>
              </div>
            )}

            {/* SEAT MATRIX SCROLL RIG -- Dynamic from API */}
            <div className="w-full overflow-x-auto pb-6 pt-2 select-none">
              <div className="min-w-[620px] flex flex-col items-center gap-6">
                {seatMapError && (
                  <div className="w-full rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 p-4 text-sm text-[#ffb4ab] font-mono text-center">
                    {seatMapError}
                  </div>
                )}
                {!seatMap && !seatMapError && (
                  <div className="w-full py-12 text-center text-[#94a3b8] font-mono text-sm animate-pulse">
                    Loading seat map...
                  </div>
                )}
                {seatMap && sortedSections && sortedSections.map((section, sectionIdx) => {
                  const rowMap = new Map();
                  for (const seat of section.seats) {
                    if (!rowMap.has(seat.row)) rowMap.set(seat.row, []);
                    rowMap.get(seat.row).push(seat);
                  }
                  const rows = [...rowMap.entries()].sort(([a], [b]) => a.localeCompare(b));
                  const isVip = /reclin|vip|box|lounge/i.test(section.name);
                  const isPrem = /prem|deluxe|exec|gold/i.test(section.name);
                  const sectionColor = isVip ? '#d0bcff' : isPrem ? '#4cd7f6' : '#cbc3d7';
                  const sectionPrice = section.seats.length ? Math.min(...section.seats.map(s => Number(s.price))) : 0;
                  const availableCount = section.seats.filter(s => s.status === 'AVAILABLE').length;
                  return (
                    <div key={section.name} className="w-full flex flex-col items-center">
                      <div className="w-full flex items-center justify-between text-[11px] font-mono px-4 mb-3">
                        <span className="font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: sectionColor }}>
                          {isVip && <Armchair className="w-3.5 h-3.5" />}
                          {isPrem && <Sparkles className="w-3.5 h-3.5" />}
                          {!isVip && !isPrem && <Tv className="w-3.5 h-3.5" style={{ color: sectionColor }} />}
                          {section.name} — ₹{sectionPrice}
                        </span>
                        <span className="text-[#64748b]">{availableCount}/{section.seats.length} available</span>
                      </div>
                      {rows.map(([rowLabel, seats]) => {
                        const sortedSeats = [...seats].sort((a, b) => a.number - b.number);
                        const half = Math.ceil(sortedSeats.length / 2);
                        const leftSeats = sortedSeats.slice(0, half);
                        const rightSeats = sortedSeats.slice(half);
                        const renderDynSeat = (seat) => {
                          const isSelected = selectedSeats.some(s => s.id === seat.id);
                          const isSold = ['BOOKED', 'BLOCKED'].includes(seat.status);
                          const isHeldByOther = seat.status === 'HELD' && !seat.heldByCurrentUser;
                          const isHeldByMe = seat.status === 'HELD' && seat.heldByCurrentUser;
                          const isQueued = Boolean(queuedSeats[seat.id]);
                          const queueCount = seat.queueCount || 0;
                          const isRecliner = /reclin/i.test(section.name);
                          const isWheelchair = /ACCESS|WHEELCHAIR/i.test(seat.seatType || '');

                          let cls = 'relative flex items-center justify-center font-mono font-bold rounded-md transition-all ' + (isRecliner ? 'w-9 h-8 text-[11px]' : 'w-7 h-7 text-[10px]') + ' ';

                          if (isSelected) {
                            cls += 'bg-[#a078ff] text-[#120038] shadow-[0_0_14px_rgba(160,120,255,0.85)] scale-105 z-10 border border-[#d0bcff] cursor-pointer';
                          } else if (isSold) {
                            cls += 'bg-[#0d0e12] opacity-30 text-[#958ea0] border border-dashed border-[#232938] cursor-not-allowed';
                          } else if (isQueued) {
                            cls += 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 ring-2 ring-cyan-500/50 animate-pulse cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.4)]';
                          } else if (isHeldByMe) {
                            cls += 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/80 animate-pulse cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.4)]';
                          } else if (isHeldByOther) {
                            cls += 'bg-amber-500/20 text-amber-300 border border-amber-500/60 hover:bg-amber-500/30 hover:border-amber-400 hover:scale-105 cursor-pointer shadow-[0_0_8px_rgba(245,158,11,0.25)]';
                          } else {
                            cls += 'bg-[#181c26] text-[#e3e2e8] border border-[#232938] hover:bg-[#292a2e] hover:border-[#8b5cf6] hover:scale-105 cursor-pointer';
                          }

                          const tooltipTitle = isHeldByOther
                            ? `${seat.seatId} - Locked in Redis (2-minute checkout active). ${queueCount > 0 ? `${queueCount} in queue. ` : ''}Click to join waiting queue!`
                            : isQueued
                            ? `${seat.seatId} - You are in waiting queue (Position #${queuedSeats[seat.id]?.position || 1})`
                            : `${seat.seatId} - ${section.name} - ₹${seat.price} - ${seat.status}`;

                          return (
                            <button
                              key={seat.id}
                              disabled={isSold}
                              onClick={() => !isSold && handleSeatClick(seat, section.name)}
                              className={cls}
                              style={{ transform: seat.rotation ? `rotate(${seat.rotation}deg)` : undefined }}
                              title={tooltipTitle}
                            >
                              {isSelected ? (
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              ) : isQueued ? (
                                <span className="text-[9px] font-mono font-extrabold text-cyan-200">Q#{queuedSeats[seat.id]?.position || '1'}</span>
                              ) : isHeldByOther ? (
                                <span className="flex items-center justify-center gap-0.5">
                                  <Lock className="w-2.5 h-2.5 text-amber-400" />
                                  {queueCount > 0 && <span className="text-[8px] font-mono text-amber-300">{queueCount}</span>}
                                </span>
                              ) : isHeldByMe ? (
                                <Timer className="w-3 h-3 text-emerald-300 animate-pulse" />
                              ) : isWheelchair ? (
                                <Accessibility className="w-3 h-3 text-[#4cd7f6]" />
                              ) : (
                                <span>{seat.seatId}</span>
                              )}
                            </button>
                          );
                        };
                        return (
                          <div key={rowLabel} className="flex items-center gap-3 mb-2">
                            <span className="w-5 text-center font-mono text-[#94a3b8] text-xs font-bold">{rowLabel}</span>
                            <div className="flex items-center gap-1.5 flex-wrap">{leftSeats.map(renderDynSeat)}</div>
                            <div className="w-8 text-center text-[#64748b] font-mono text-[9px]"></div>
                            <div className="flex items-center gap-1.5 flex-wrap">{rightSeats.map(renderDynSeat)}</div>
                            <span className="w-5 text-center font-mono text-[#94a3b8] text-xs font-bold">{rowLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-center text-[10px] font-mono text-[#958ea0] mt-4">
              Click seats to select/deselect. Seat locations and pricing update your confirmation slot in real time.
            </p>

          </div>

        </div>

        {/* RIGHT DOCK: BOOKING PROCESS & CONFIRMATION SLOT SUMMARY (4 of 12 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          <div className="rounded-2xl bg-[#12151e] border border-[#232938] p-5 flex flex-col gap-5 shadow-2xl sticky top-40">
            
            {/* Section Title */}
            <div className="flex items-center justify-between pb-3 border-b border-[#232938]">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-[#a078ff]" />
                <h3 className="text-sm font-mono font-bold uppercase text-white tracking-wide">
                  Booking Confirmation Slot
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-[#4edea3]">
                {selectedSeats.length} Seat{selectedSeats.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Confirmed Slot Details Card */}
            <div className="p-3.5 rounded-xl bg-[#0d0e12] border border-[#232938] text-xs font-mono space-y-1.5">
              <div className="flex items-center justify-between text-white font-bold">
                <span className="truncate">{movie?.title}</span>
                <span className="text-[#4cd7f6]">{movie?.format}</span>
              </div>
              <div className="text-[#cbc3d7] text-[11px] flex items-center gap-1">
                <Building2 className="w-3 h-3 text-[#4cd7f6]" />
                <span className="truncate">{selectedTheatre}</span>
              </div>
              <div className="text-[#958ea0] text-[11px] flex items-center justify-between pt-1 border-t border-[#232938]">
                <span>{selectedScreen}</span>
                <span className="text-[#a078ff] font-bold">{selectedDay} · {selectedShowtime}</span>
              </div>
            </div>

            {/* YOUR SELECTED SEAT LOCATIONS */}
            <div>
              <span className="text-xs font-mono uppercase text-[#958ea0] font-bold block mb-2">
                Selected Seat Locations:
              </span>

              {selectedSeats.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#0d0e12] border border-dashed border-[#232938] text-center flex flex-col items-center gap-1.5">
                  <Armchair className="w-6 h-6 text-[#64748b]" />
                  <p className="text-xs text-[#94a3b8]">No seats chosen yet.</p>
                  <p className="text-[10px] text-[#64748b] font-mono">Click available seats on the map above.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {selectedSeats.map(s => (
                    <div 
                      key={s.id} 
                      className="flex items-center justify-between p-2 rounded-lg bg-[#0d0e12] border border-[#232938] text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#a078ff]/20 text-[#d0bcff] font-bold border border-[#a078ff]/40">
                        {s.label}
                        </span>
                        <div>
                          <span className="text-white font-semibold block text-[11px]">Row {s.row}, Seat {s.number}</span>
                          <span className="text-[10px] text-[#958ea0]">{s.tier}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#4edea3]">₹{s.price}</span>
                        <button
                          onClick={() => setSelectedSeats(prev => prev.filter(seat => seat.id !== s.id))}
                          className="text-[#958ea0] hover:text-[#ffb4ab] cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gourmet F&B Snack Add-ons */}
            <div>
              <span className="text-xs font-mono uppercase text-[#958ea0] font-bold block mb-2">
                In-Seat Gourmet F&B (Optional):
              </span>
              <div className="space-y-2">
                {FOOD_MENU.slice(0, 2).map(item => (
                  <div key={item.id} className="p-2.5 rounded-xl bg-[#0d0e12] border border-[#232938] flex items-center justify-between gap-3 text-xs font-mono">
                    <div className="min-w-0 flex-1">
                      <span className="text-white font-semibold truncate block">{item.name}</span>
                      <span className="text-[10px] text-[#4edea3]">₹{item.price}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleFoodQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-md bg-[#181c26] text-white flex items-center justify-center hover:bg-[#292a2e]"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-4 text-center font-bold text-white">{foodQuantities[item.id] || 0}</span>
                      <button
                        onClick={() => handleFoodQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-md bg-[#181c26] text-white flex items-center justify-center hover:bg-[#292a2e]"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Promo Voucher Input */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Promo Code (e.g. TIXORA100)"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="flex-1 bg-[#0d0e12] border border-[#232938] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-[#64748b] outline-none focus:border-[#8b5cf6]"
                />
                <button
                  onClick={applyPromo}
                  className="px-3 py-2 rounded-lg bg-[#1e1f24] hover:bg-[#292a2e] border border-[#232938] text-xs font-mono font-bold text-[#d0bcff] transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
              {promoMessage && (
                <span className={`text-[10px] font-mono ${promoMessage.type === 'success' ? 'text-[#4edea3]' : 'text-[#ffb4ab]'}`}>
                  {promoMessage.text}
                </span>
              )}
            </div>

            {/* Itemized Price Breakdown */}
            <div className="flex flex-col gap-2 pt-3 border-t border-[#232938] text-xs font-mono">
              <div className="flex items-center justify-between text-[#94a3b8]">
                <span>Tickets Total ({selectedSeats.length})</span>
                <span className="text-white font-bold">₹{seatsTotal.toFixed(2)}</span>
              </div>

              {foodTotal > 0 && (
                <div className="flex items-center justify-between text-[#94a3b8]">
                  <span>Gourmet F&B Add-ons</span>
                  <span className="text-white font-bold">₹{foodTotal.toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-[#94a3b8]">
                <span>Convenience Fee & Handling</span>
                <span>₹{convenienceFee.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-[#94a3b8]">
                <span>Integrated GST (18%)</span>
                <span>₹{gst.toFixed(2)}</span>
              </div>

              {appliedDiscount > 0 && (
                <div className="flex items-center justify-between text-[#4edea3]">
                  <span>Voucher Discount</span>
                  <span>- ₹{appliedDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-base font-bold text-white pt-3 border-t border-[#232938]">
                <span>Grand Total</span>
                <span className="text-xl text-[#d0bcff]">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Instant Confirmation & Checkout CTA */}
            {checkoutError && <p role="alert" className="text-xs text-[#ffb4ab] font-mono">{checkoutError}</p>}
            {!currentUser && selectedSeats.length > 0 && (
              <p className="text-xs text-[#fbbf24] font-mono text-center">
                ⚠️ You must be signed in to complete your booking.
              </p>
            )}
            <button
              disabled={selectedSeats.length === 0}
              onClick={() => {
                if (!selectedShowId || !seatMap || selectedSeats.length === 0) {
                  setCheckoutError('Choose an available seat for a published show before continuing.');
                  return;
                }
                if (!currentUser) {
                  if (onOpenAuth) onOpenAuth({ role: 'customer', isSignUp: false });
                  return;
                }
                setCheckoutError('');
                onCheckoutComplete({
                  showId: selectedShowId,
                  movie,
                  selectedTheatre,
                  selectedScreen,
                  selectedDay,
                  selectedShowtime,
                  selectedSeats,
                  foodQuantities,
                  promoCode: appliedDiscount ? promoCode.trim().toUpperCase() : null,
                  grandTotal,
                  ticketTiers
                });
              }}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(160,120,255,0.4)] transition-all ${
                selectedSeats.length > 0
                  ? 'bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white hover:brightness-110 active:scale-95 cursor-pointer'
                  : 'bg-[#1e1f24] text-[#64748b] border border-[#292a2e] cursor-not-allowed'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>{currentUser ? `Proceed to Confirmation Slot (₹${grandTotal.toFixed(2)})` : 'Sign In to Book Tickets'}</span>
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-[#94a3b8]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#4edea3]" />
              <span>256-Bit SSL Encrypted Instant Payment</span>
            </div>

          </div>

        </div>

      </div>

      {/* CONTESTED SEAT & REDIS WAITING QUEUE MODAL */}
      {contestedSeat && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0d0e12] border border-[#232938] rounded-2xl shadow-2xl p-6 flex flex-col gap-5 text-white font-mono">
            
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#232938]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300">
                  <Lock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Seat {contestedSeat.seatId}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Locked in Redis
                    </span>
                  </h3>
                  <p className="text-xs text-[#958ea0] mt-0.5">
                    Row {contestedSeat.row}, Seat {contestedSeat.number} • {contestedSeat.tier || 'Standard'} (₹{contestedSeat.price})
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setContestedSeat(null); setQueueError(''); }}
                className="w-8 h-8 rounded-lg bg-[#181c26] text-[#958ea0] hover:text-white hover:bg-[#232938] flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Redis & Timer Architecture Explainer */}
            <div className="p-4 rounded-xl bg-[#141721] border border-[#232938] flex flex-col gap-3 text-xs leading-relaxed text-[#cbc3d7]">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Redis Distributed Concurrency Hold Active</span>
              </div>
              <p>
                Another customer is currently checking out this seat. A <strong className="text-white">2-minute reservation lock</strong> is placed in Redis to prevent simultaneous bookings.
              </p>
              <p>
                The active customer must complete their booking (attendee <strong>Name & Age</strong>, payment gateway selection) within their personal <strong className="text-emerald-300">2-minute booking window</strong>.
              </p>
              <div className="p-2.5 rounded-lg bg-black/40 border border-[#292a2e] text-[11px] text-[#94a3b8] flex items-center gap-2">
                <Timer className="w-3.5 h-3.5 text-[#4cd7f6] shrink-0" />
                <span>
                  If they do not confirm within <strong>2 minutes</strong>, their session automatically expires and the seat is immediately awarded to the next customer in the FIFO waiting queue!
                </span>
              </div>
            </div>

            {/* Waiting Queue Status */}
            <div className="p-4 rounded-xl bg-[#12151e] border border-[#232938] flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#958ea0] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  Current Waiting Queue:
                </span>
                <span className="font-bold text-white">
                  {(contestedSeat.queueCount || 0) + (queuedSeats[contestedSeat.id] ? 1 : 0)} customer(s) waiting
                </span>
              </div>

              {queuedSeats[contestedSeat.id] ? (
                <div className="mt-2 p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/50 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
                      <Hourglass className="w-3.5 h-3.5 text-cyan-400" />
                      You are in line!
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-extrabold border border-cyan-500/40">
                      Position #{queuedSeats[contestedSeat.id].position}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#94a3b8]">
                    We are monitoring the other customer's 2-minute booking timer. If it expires, you will automatically receive the hold and a 2-minute checkout window!
                  </p>
                  <button
                    disabled={queueLoading}
                    onClick={() => handleLeaveQueue(contestedSeat.id)}
                    className="w-full py-2 mt-1 rounded-lg bg-[#1e2029] hover:bg-[#2b2d3a] text-[#ffb4ab] border border-[#ffb4ab]/30 text-xs font-bold transition-all cursor-pointer"
                  >
                    {queueLoading ? 'Leaving Queue...' : 'Leave Waiting Queue'}
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-[11px] text-[#94a3b8]">
                    Join the Redis FIFO queue. If the current user doesn't finish within 2 minutes, you will get instant first priority to book this seat.
                  </p>
                  {queueError && (
                    <p className="text-xs text-[#ffb4ab]">{queueError}</p>
                  )}
                  <button
                    disabled={queueLoading}
                    onClick={() => handleJoinQueue(contestedSeat)}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    <span>{queueLoading ? 'Joining FIFO Queue...' : 'Join Waiting Queue (FIFO)'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Footer Close */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => { setContestedSeat(null); setQueueError(''); }}
                className="px-4 py-2 rounded-lg bg-[#181c26] hover:bg-[#232938] text-xs text-[#cbc3d7] transition-all cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
