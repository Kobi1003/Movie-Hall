import React, { useState, useEffect } from 'react';
import {
  Ticket,
  QrCode,
  MapPin,
  Calendar,
  Clock,
  Tv,
  ShieldCheck,
  Download,
  Printer,
  Share2,
  UtensilsCrossed,
  ArrowRight,
  Eye,
  Star,
  Sparkles,
  ThumbsUp,
  CheckCircle2,
  MessageSquare,
  Building2,
  Volume2,
  Armchair,
  X
} from 'lucide-react';
import { cinemasApi } from '../api.js';

const AVAILABLE_TAGS = [
  'Dolby Atmos 64-Channel',
  'Laser 4K Projection',
  'Plush Motorized Recliners',
  'Spacious Legroom',
  'Immaculate Hygiene',
  'Optimal Air Conditioning',
  'Quick Turnstile Entry',
  'Gourmet Snack Concession'
];

export default function MyBookingsView({
  userBookings = [],
  onViewTicketPass,
  onExploreEvents,
  onCancelBooking
}) {
  const [cancellingId, setCancellingId] = useState(null);
  const [reviews, setReviews] = useState(() => {
    try {
      const saved = localStorage.getItem('tixora_cinema_reviews');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Rating Modal state
  const [activeRatingTarget, setActiveRatingTarget] = useState(null); // { bookingId, cinemaName, cinemaId }
  const [ratingValue, setRatingValue] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [availableCinemas, setAvailableCinemas] = useState([
    { id: 'cinema-pvr-barasat', name: 'PVR Movies, Barasat', city: 'Kolkata' },
    { id: 'cinema-pqr', name: 'PQR Cinema', city: 'Kolkata' },
    { id: 'cinema-imax-galleria', name: 'PVR IMAX Grand Galleria', city: 'Mumbai' },
    { id: 'cinema-inox-megaplex', name: 'INOX Megaplex BKC', city: 'Mumbai' }
  ]);

  // Fetch reviews and registered cinemas on mount
  useEffect(() => {
    cinemasApi.getMyReviews().then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setReviews(prev => {
          const map = new Map();
          data.forEach(r => map.set(r.id, r));
          prev.forEach(r => map.set(r.id, r));
          const merged = Array.from(map.values());
          localStorage.setItem('tixora_cinema_reviews', JSON.stringify(merged));
          return merged;
        });
      }
    }).catch(() => {});

    cinemasApi.list().then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setAvailableCinemas(data.map(c => ({
          id: c.id,
          name: c.cinema_name || c.name,
          city: c.city || ''
        })));
      }
    }).catch(() => {});
  }, []);

  const handleCancel = async (booking) => {
    if (!window.confirm(`Are you sure you want to cancel booking ${booking.bookingId}? Your seats will be released and a refund will be processed.`)) {
      return;
    }
    const bId = booking.internalId || booking.bookingId;
    setCancellingId(bId);
    try {
      if (onCancelBooking) {
        await onCancelBooking(booking);
      }
    } finally {
      setCancellingId(null);
    }
  };

  const openRatingModal = (booking) => {
    const cinemaName = booking.theatre || 'Cinema Multiplex';
    const existing = reviews.find(r => r.bookingId === (booking.internalId || booking.bookingId) || r.cinemaName === cinemaName);

    setActiveRatingTarget({
      bookingId: booking.internalId || booking.bookingId,
      cinemaName,
      cinemaId: booking.cinemaId || 'cinema-default'
    });

    if (existing) {
      setRatingValue(existing.rating || 5);
      setSelectedTags(existing.tags || []);
      setReviewComment(existing.reviewText || '');
    } else {
      setRatingValue(5);
      setSelectedTags(['Dolby Atmos 64-Channel', 'Plush Motorized Recliners']);
      setReviewComment('');
    }
    setReviewSuccess('');
  };

  const openNewReviewModal = (preselectedCinema = null) => {
    const targetCinema = preselectedCinema || availableCinemas[0] || { id: 'cinema-default', name: 'PVR Movies, Barasat' };
    const existing = reviews.find(r => r.cinemaName === targetCinema.name);

    setActiveRatingTarget({
      bookingId: null,
      cinemaName: targetCinema.name,
      cinemaId: targetCinema.id
    });

    if (existing) {
      setRatingValue(existing.rating || 5);
      setSelectedTags(existing.tags || []);
      setReviewComment(existing.reviewText || '');
    } else {
      setRatingValue(5);
      setSelectedTags(['Dolby Atmos 64-Channel', 'Plush Motorized Recliners']);
      setReviewComment('');
    }
    setReviewSuccess('');
  };

  const handleToggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!activeRatingTarget) return;

    setSubmittingReview(true);
    const newReview = {
      id: `rev-${Date.now()}`,
      cinemaId: activeRatingTarget.cinemaId,
      cinemaName: activeRatingTarget.cinemaName,
      bookingId: activeRatingTarget.bookingId || null,
      rating: ratingValue,
      reviewText: reviewComment.trim(),
      tags: selectedTags,
      createdAt: new Date().toISOString()
    };

    try {
      await cinemasApi.addReview(activeRatingTarget.cinemaId, {
        rating: ratingValue,
        reviewText: reviewComment.trim(),
        tags: selectedTags,
        bookingId: activeRatingTarget.bookingId || undefined,
        cinemaName: activeRatingTarget.cinemaName
      }).catch(() => {});
    } catch (_) {}

    setReviews(prev => {
      const updated = [newReview, ...prev.filter(r => (activeRatingTarget.bookingId ? r.bookingId !== activeRatingTarget.bookingId : true) && r.cinemaName !== activeRatingTarget.cinemaName)];
      try {
        localStorage.setItem('tixora_cinema_reviews', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    setSubmittingReview(false);
    setReviewSuccess('Review & experience rating saved successfully!');
    setTimeout(() => {
      setActiveRatingTarget(null);
      setReviewSuccess('');
    }, 1500);
  };

  return (
    <div className="w-full flex flex-col pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#232938]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#4cd7f6] animate-pulse"></span>
            <span className="text-[11px] font-mono uppercase text-[#4cd7f6] font-bold">Customer Digital Ticket Wallet</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">My Cinema & Event Passes</h1>
          <p className="text-xs text-[#94a3b8] font-mono mt-0.5">Instant entry QR passes, in-seat food token codes, and cinema hall rating oversight.</p>
        </div>

        <button
          onClick={onExploreEvents}
          className="px-4 py-2 rounded-xl bg-[#181c26] hover:bg-[#292a2e] text-xs font-mono font-bold text-[#d0bcff] border border-[#232938] flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <span>Book Another Show</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ACTIVE PASSES LIST */}
      {userBookings.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#12151e] border border-dashed border-[#232938] text-center flex flex-col items-center gap-3">
          <Ticket className="w-12 h-12 text-[#64748b]" />
          <h3 className="text-lg font-bold text-white">No active ticket passes yet</h3>
          <p className="text-xs text-[#94a3b8] max-w-sm">Pick your movie from the Discover Hub and reserve your seats with real-time hold guarantee.</p>
          <button
            onClick={onExploreEvents}
            className="mt-2 px-5 py-2.5 rounded-xl bg-[#a078ff] text-[#120038] font-bold text-xs font-mono hover:bg-[#d0bcff] cursor-pointer"
          >
            Explore Movies & Shows
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {userBookings.map((booking) => {
            const hasReviewed = reviews.some(r => r.bookingId === (booking.internalId || booking.bookingId) || r.cinemaName === booking.theatre);
            const userRev = reviews.find(r => r.bookingId === (booking.internalId || booking.bookingId) || r.cinemaName === booking.theatre);

            return (
              <div
                key={booking.bookingId}
                className="rounded-2xl bg-[#12151e] border border-[#232938] overflow-hidden shadow-2xl flex flex-col md:flex-row items-stretch hover:border-[#8b5cf6]/40 transition-colors"
              >

                {/* Left Ticket Details (Main Body) */}
                <div className="p-6 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          booking.status === 'CONFIRMED'
                            ? 'bg-[#4edea3]/15 text-[#4edea3] border-[#4edea3]/30'
                            : 'bg-[#ffb4ab]/15 text-[#ffb4ab] border-[#ffb4ab]/30'
                        }`}>
                          ● {booking.status}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#4cd7f6]">{booking.format}</span>
                        {hasReviewed && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#fbbf24]/15 border border-[#fbbf24]/30 text-[#fbbf24]">
                            <Star className="w-2.5 h-2.5 fill-[#fbbf24]" />
                            {userRev?.rating}★ Rated
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-[#958ea0]">{booking.bookingId}</span>
                    </div>

                    <h3 className="text-xl font-bold text-white">{booking.movieTitle}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-[#94a3b8] font-mono mt-1">
                      <MapPin className="w-3.5 h-3.5 text-[#4cd7f6]" />
                      <span>{booking.theatre} • {booking.screen}</span>
                    </div>
                  </div>

                  {/* Show Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[#0d0e12] border border-[#232938] text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-[#958ea0] block">Date</span>
                      <span className="text-white font-bold">{booking.date}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#958ea0] block">Showtime</span>
                      <span className="text-white font-bold">{booking.time}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#958ea0] block">Seats Assigned</span>
                      <span className="text-[#d0bcff] font-bold">{booking.seats?.join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#958ea0] block">Hall Entry Gate</span>
                      <span className="text-[#4edea3] font-bold">{booking.gate || 'Gate 4'}</span>
                    </div>
                  </div>

                  {/* F&B Items if any */}
                  {booking.foodItems && booking.foodItems.length > 0 && (
                    <div className="flex items-center gap-2 text-xs font-mono text-[#cbc3d7] bg-[#181c26] p-2.5 rounded-lg border border-[#232938]">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-[#d0bcff]" />
                      <span>In-Seat F&B: {booking.foodItems.map(f => `${f.name} (x${f.qty})`).join(', ')}</span>
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-mono text-[#958ea0]">
                      Total Paid: <span className="text-white font-bold">₹{booking.totalAmount?.toFixed(2)}</span>
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Rate Cinema Hall Experience Button */}
                      <button
                        onClick={() => openRatingModal(booking)}
                        className="px-3 py-2 rounded-xl bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 text-xs font-mono font-bold text-[#fbbf24] border border-[#fbbf24]/30 flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Star className={`w-3.5 h-3.5 ${hasReviewed ? 'fill-[#fbbf24]' : ''}`} />
                        <span>{hasReviewed ? 'Edit Rating' : 'Rate Cinema Hall'}</span>
                      </button>

                      {booking.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleCancel(booking)}
                          disabled={cancellingId === (booking.internalId || booking.bookingId)}
                          className="px-3 py-2 rounded-xl bg-[#ffb4ab]/10 hover:bg-[#ffb4ab]/20 text-xs font-mono font-bold text-[#ffb4ab] border border-[#ffb4ab]/30 flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                        >
                          <span>{cancellingId === (booking.internalId || booking.bookingId) ? 'Cancelling...' : 'Cancel & Refund'}</span>
                        </button>
                      )}
                      <button
                        onClick={() => onViewTicketPass(booking)}
                        className="px-4 py-2 rounded-xl bg-[#1e1f24] hover:bg-[#292a2e] text-xs font-mono font-bold text-white border border-[#232938] flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#4cd7f6]" />
                        <span>View Digital QR Pass</span>
                      </button>
                    </div>
                  </div>

                </div>

                {/* Right QR Code Stub (Perforated ticket visual style) */}
                <div className="w-full md:w-56 p-6 bg-[#0d0e12] border-t md:border-t-0 md:border-l border-dashed border-[#232938] flex flex-col items-center justify-center text-center gap-3">
                  <div className="p-2.5 bg-white rounded-xl shadow-lg">
                    <img
                      src={booking.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${booking.bookingId}`}
                      alt="Ticket QR"
                      className="w-28 h-28 object-contain"
                    />
                  </div>
                  <div className="text-[11px] font-mono text-[#94a3b8]">
                    <span className="text-white font-bold block">{booking.securityCode || 'SEC-8902'}</span>
                    <span>Scan at turnstile</span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* DEDICATED CINEMA & MOVIE-HALL RATING SECTION (Within User Dashboard Only) */}
      <div className="mt-12 pt-8 border-t border-[#232938]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fbbf24]/15 border border-[#fbbf24]/30 flex items-center justify-center text-[#fbbf24]">
              <Star className="w-5 h-5 fill-[#fbbf24]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white">Cinema & Movie-Hall Experience Ratings</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/30 uppercase font-bold">
                  DASHBOARD EXCLUSIVE
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] font-mono mt-0.5">
                Rate auditorium acoustics, Dolby Atmos axis dispersion, 4K laser projection clarity, and seating comfort for your visited theatres.
              </p>
            </div>
          </div>

          {/* Direct Write Review Action Button */}
          <button
            onClick={() => openNewReviewModal()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#1a1200] font-bold text-xs font-mono shadow-[0_0_20px_rgba(251,191,36,0.35)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Star className="w-4 h-4 fill-[#1a1200]" />
            <span>+ Rate a Cinema Hall</span>
          </button>
        </div>

        {reviews.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#12151e] border border-[#232938] text-center flex flex-col items-center gap-3">
            <Building2 className="w-10 h-10 text-[#64748b]" />
            <h3 className="text-sm font-bold text-white">No cinema hall reviews submitted yet</h3>
            <p className="text-xs text-[#94a3b8] max-w-md font-mono">
              Share your screening impressions on sound quality, seating recline, and laser brightness to help fellow moviegoers!
            </p>
            <button
              onClick={() => openNewReviewModal()}
              className="mt-2 px-5 py-2.5 rounded-xl bg-[#fbbf24]/20 hover:bg-[#fbbf24]/30 text-[#fbbf24] border border-[#fbbf24]/40 font-bold text-xs font-mono flex items-center gap-2 cursor-pointer transition-all"
            >
              <Star className="w-4 h-4 fill-[#fbbf24]" />
              <span>Write Your First Cinema Review</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map(rev => (
              <div key={rev.id} className="p-5 rounded-2xl bg-[#12151e] border border-[#232938] flex flex-col justify-between gap-3 shadow-lg">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#4cd7f6]" />
                      <h4 className="text-sm font-bold text-white">{rev.cinemaName}</h4>
                    </div>
                    <div className="flex items-center gap-1 bg-[#fbbf24]/15 px-2.5 py-0.5 rounded-full border border-[#fbbf24]/30">
                      <div className="flex text-[#fbbf24]">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`w-3 h-3 ${s <= rev.rating ? 'fill-[#fbbf24]' : 'text-[#494454]'}`} />
                        ))}
                      </div>
                      <span className="text-[11px] font-mono font-bold text-[#fbbf24] ml-1">{rev.rating}.0</span>
                    </div>
                  </div>

                  {rev.reviewText && (
                    <p className="text-xs text-[#cbc3d7] font-mono bg-[#0d0e12] p-3 rounded-xl border border-[#232938] mt-2 italic leading-relaxed">
                      "{rev.reviewText}"
                    </p>
                  )}

                  {rev.tags && rev.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {rev.tags.map(t => (
                        <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#181c26] text-[#4cd7f6] border border-[#232938]">
                          ✓ {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#232938] flex items-center justify-between text-[10px] font-mono text-[#958ea0]">
                  <span>Verified Screening Experience</span>
                  <span>{rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently Reviewed'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* INTERACTIVE RATING MODAL POP-UP */}
      {activeRatingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 animate-in fade-in duration-200">
          <div className="bg-[#12151e] border border-[#fbbf24]/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-[0_0_50px_rgba(251,191,36,0.2)] space-y-5 relative">
            <button
              onClick={() => setActiveRatingTarget(null)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-[#181c26] text-[#958ea0] hover:text-white border border-[#232938] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#fbbf24]/15 border border-[#fbbf24]/30 flex items-center justify-center text-[#fbbf24]">
                <Star className="w-6 h-6 fill-[#fbbf24]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-mono uppercase text-[#fbbf24] font-bold">
                  Auditorium Rating
                </span>
                <h3 className="text-lg font-extrabold text-white truncate">
                  {activeRatingTarget.cinemaName}
                </h3>
              </div>
            </div>

            {/* Cinema Selector if not tied to a fixed booking pass */}
            {availableCinemas.length > 0 && (
              <div>
                <label className="text-xs font-mono text-[#94a3b8] block mb-1.5">
                  Select Cinema Hall / Multiplex
                </label>
                <select
                  value={activeRatingTarget.cinemaId}
                  onChange={(e) => {
                    const chosen = availableCinemas.find(c => c.id === e.target.value);
                    if (chosen) {
                      setActiveRatingTarget(prev => ({
                        ...prev,
                        cinemaId: chosen.id,
                        cinemaName: chosen.name
                      }));
                    }
                  }}
                  className="w-full bg-[#0d0e12] border border-[#232938] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-[#fbbf24] transition-colors cursor-pointer"
                >
                  {availableCinemas.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#12151e] text-white">
                      {c.name} {c.city ? `(${c.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {reviewSuccess && (
              <div className="p-3 rounded-xl bg-[#4edea3]/15 border border-[#4edea3]/40 text-[#4edea3] text-xs font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#4edea3]" />
                <span>{reviewSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-4">
              {/* Star Selection */}
              <div>
                <label className="text-xs font-mono text-[#94a3b8] block mb-2">
                  Overall Hall & Sound Experience Score
                </label>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#0d0e12] border border-[#232938] justify-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRatingValue(star)}
                      className="p-1 text-2xl transition-transform hover:scale-125 cursor-pointer focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          (hoverRating || ratingValue) >= star
                            ? 'text-[#fbbf24] fill-[#fbbf24]'
                            : 'text-[#494454]'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-sm font-mono font-bold text-[#fbbf24] ml-2">
                    {ratingValue}/5 ({ratingValue === 5 ? 'Exceptional' : ratingValue === 4 ? 'Very Good' : ratingValue === 3 ? 'Average' : 'Needs Improvement'})
                  </span>
                </div>
              </div>

              {/* Feature Highlights Tags */}
              <div>
                <label className="text-xs font-mono text-[#94a3b8] block mb-2">
                  Hall Experience Highlights (Click to Tag)
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-[#4cd7f6]/20 border-[#4cd7f6] text-[#4cd7f6] font-bold shadow-[0_0_10px_rgba(76,215,246,0.3)]'
                            : 'bg-[#0d0e12] border-[#232938] text-[#958ea0] hover:text-white'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '} {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Written Review */}
              <div>
                <label className="text-xs font-mono text-[#94a3b8] block mb-2">
                  Auditorium Feedback & Screening Observations
                </label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share details on acoustics, screen angle, seats, or hall cleanliness..."
                  className="w-full bg-[#0d0e12] border border-[#232938] rounded-xl p-3 text-xs text-white placeholder-[#64748b] outline-none focus:border-[#fbbf24] transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveRatingTarget(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#181c26] text-[#cbc3d7] hover:text-white text-xs font-mono border border-[#232938] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#1a1200] font-bold text-xs font-mono shadow-[0_0_20px_rgba(251,191,36,0.4)] hover:brightness-110 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Hall Rating'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
