import { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck, Shield, Building2, Film,
  CalendarDays, Clock, Monitor, Users, Search,
  CheckCircle2, XCircle, AlertCircle, AlertTriangle, ChevronDown,
  ChevronUp, Lock, Unlock, CircleDot, Ban, Check, RotateCcw, X,
  BadgeCheck, MapPin, Activity, Database, RefreshCw,
  FileCheck, FileText, ExternalLink, Award, Sparkles, Filter, DollarSign
} from "lucide-react";
import { adminApi, showsApi } from "../api.js";
import SettlementsView from "./SettlementsView";

const ADMIN_PROVIDERS_INIT = [
  { providerId: "PROV-HP-001", providerName: "Rajesh Kumar", companyName: "Rajesh Cinemas & Entertainment Pvt. Ltd.", email: "admin@rajeshcinemas.io", phone: "+91 98201 49811", gstin: "27AABCR1234P1ZV", registrationId: "U92100MH2019PTC321447", city: "Mumbai (MMR)", hallCount: 2, verifiedHalls: 1, pendingHalls: 1, permissionStatus: "ACTIVE", joinedDate: "2024-03-01", lastActivity: "19 Sep 2026", halls: [{ hallId: "HALL-P001", name: "PVR IMAX Grand Galleria", status: "VERIFIED", screens: 3 }, { hallId: "HALL-P002", name: "INOX Megaplex BKC", status: "PENDING_VERIFICATION", screens: 4 }] },
  { providerId: "PROV-HP-002", providerName: "Meera Iyer", companyName: "SouthStar Cinemas LLP", email: "meera@southstar.in", phone: "+91 94401 88122", gstin: "33AAFCS4521A1ZB", registrationId: "U92100TN2021LLP441982", city: "Chennai", hallCount: 1, verifiedHalls: 1, pendingHalls: 0, permissionStatus: "ACTIVE", joinedDate: "2025-01-15", lastActivity: "18 Sep 2026", halls: [{ hallId: "HALL-H01", name: "SPI Sathyam Cinemas", status: "VERIFIED", screens: 2 }] },
  { providerId: "PROV-HP-003", providerName: "Arjun Prasad", companyName: "Prasad Film Circuits Ltd.", email: "arjun@prasadcircuits.io", phone: "+91 91009 22443", gstin: "36AAECS9812B1ZV", registrationId: "U92100TS2018PTC109221", city: "Hyderabad", hallCount: 1, verifiedHalls: 1, pendingHalls: 0, permissionStatus: "ACTIVE", joinedDate: "2023-07-20", lastActivity: "17 Sep 2026", halls: [{ hallId: "HALL-H02", name: "Prasads IMAX Multiplex", status: "VERIFIED", screens: 3 }] },
  { providerId: "PROV-HP-004", providerName: "Sana Mirza", companyName: "Capital Screens Pvt. Ltd.", email: "sana@capitalscreens.in", phone: "+91 98118 44009", gstin: "07AACCS2241F1ZR", registrationId: "U92100DL2022PTC188821", city: "Delhi NCR", hallCount: 2, verifiedHalls: 0, pendingHalls: 2, permissionStatus: "SUSPENDED", joinedDate: "2026-08-10", lastActivity: "12 Sep 2026", halls: [{ hallId: "HALL-H03", name: "Cinepolis VIP Luxe Galleria", status: "PENDING_VERIFICATION", screens: 3 }, { hallId: "HALL-H04", name: "PVR Directors Cut Ambience Mall", status: "PENDING_VERIFICATION", screens: 2 }] },
  { providerId: "PROV-HP-005", providerName: "Karthik Nair", companyName: "Inox Leisure South Zone", email: "k.nair@inoxsouth.io", phone: "+91 80001 77334", gstin: "29AABCI7821G1ZQ", registrationId: "U92100KA2020PTC204411", city: "Bengaluru", hallCount: 1, verifiedHalls: 1, pendingHalls: 0, permissionStatus: "REVOKED", joinedDate: "2022-11-30", lastActivity: "04 Sep 2026", halls: [{ hallId: "HALL-H05", name: "INOX Lido Bengaluru", status: "VERIFIED", screens: 2 }] },
];

const SHOW_STATUS_CFG = {
  ON_SALE: { label: "On Sale", color: "#4edea3", dot: "bg-[#4edea3]", cls: "bg-[#4edea3]/10 text-[#4edea3] border-[#4edea3]/30" },
  HIGH_DEMAND: { label: "High Demand", color: "#fbbf24", dot: "bg-[#fbbf24]", cls: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30" },
  PRIME_SURGE: { label: "Prime Surge", color: "#f97316", dot: "bg-[#f97316]", cls: "bg-[#f97316]/10 text-[#f97316] border-[#f97316]/30" },
  SOLD_OUT: { label: "Sold Out", color: "#f87171", dot: "bg-[#f87171]", cls: "bg-[#f87171]/10 text-[#f87171] border-[#f87171]/30" },
  CANCELLED: { label: "Cancelled", color: "#ffb4ab", dot: "bg-[#ffb4ab]", cls: "bg-[#ffb4ab]/15 text-[#ffb4ab] border-[#ffb4ab]/40" },
};

const PERM_CFG = {
  ACTIVE: { label: "Active", Icon: CheckCircle2, cls: "bg-[#4edea3]/10 text-[#4edea3] border-[#4edea3]/30" },
  SUSPENDED: { label: "Suspended", Icon: AlertCircle, cls: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30" },
  REVOKED: { label: "Revoked", Icon: XCircle, cls: "bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]/30" },
};

function OccupancyBar({ booked, total }) {
  const pct = total > 0 ? Math.round((booked / total) * 100) : 0;
  const color = pct >= 90 ? "#ffb4ab" : pct >= 70 ? "#fbbf24" : "#4edea3";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#232938] rounded-full overflow-hidden min-w-[48px]">
        <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full" />
      </div>
      <span className="text-[10px] font-mono whitespace-nowrap" style={{ color }}>{booked}/{total} ({pct}%)</span>
    </div>
  );
}

function ShowsOverviewTab() {
  const [dbShows, setDbShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("asc");

  // Moderation modal state
  const [modalConfig, setModalConfig] = useState(null); // { show, type: 'APPROVE' | 'CANCEL' }
  const [selectedReason, setSelectedReason] = useState("Schedule overlap / Screen conflict");
  const [customReason, setCustomReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  const loadShows = async () => {
    setLoading(true);
    try {
      const shows = await showsApi.list();
      if (Array.isArray(shows)) {
        const mapped = shows.map(s => {
          const isCancelled = s.status === 'CANCELLED' || s.isCancelled || s.cinemaStatus === 'REJECTED' || s.cinemaStatus === 'SUSPENDED' || s.cinemaIsActive === false || s.movieStatus === 'SUSPENDED' || s.movieStatus === 'REJECTED';
          let status = 'ON_SALE';
          if (isCancelled) {
            status = 'CANCELLED';
          } else if (s.status === 'PUBLISHED') {
            status = (s.totalSeats > 0 && s.seatsBooked >= s.totalSeats) ? 'SOLD_OUT' : 'ON_SALE';
          } else if (s.status === 'SOLD_OUT') {
            status = 'SOLD_OUT';
          } else {
            status = s.status || 'ON_SALE';
          }
          return {
            showId: s.id,
            movieTitle: s.movieTitle || s.movies?.title || '—',
            hallName: s.cinemaName || s.cinemas?.cinema_name || '—',
            screenName: s.screenName || s.screens?.screen_name || 'Screen 1',
            date: s.showDate || s.show_date,
            startTime: s.startTime || s.start_time,
            endTime: s.endTime || s.end_time || '',
            format: s.format || '2D',
            language: s.language || 'English',
            totalSeats: s.totalSeats || 0,
            seatsBooked: s.seatsBooked || 0,
            status,
            city: s.city || s.cinemas?.city || '',
            cancellationReason: s.cancellation_reason || s.cancellationReason || ''
          };
        });
        setDbShows(mapped);
      }
    } catch (e) {
      console.error('Could not load shows:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShows();
  }, []);

  // Compute Schedule Overlaps / Collisions
  const { overlappingShowIds, overlapMap } = useMemo(() => {
    const map = new Map();
    dbShows.forEach(s => {
      if (s.status === 'CANCELLED') return;
      const key = `${s.date}__${(s.hallName || '').trim().toLowerCase()}__${(s.screenName || '').trim().toLowerCase()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });

    const collidingIds = new Set();
    const details = new Map();

    const toMin = (t) => {
      if (!t) return 0;
      const parts = t.split(':').map(Number);
      return (parts[0] || 0) * 60 + (parts[1] || 0);
    };

    for (const [, group] of map.entries()) {
      if (group.length > 1) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i];
            const b = group[j];
            const startA = toMin(a.startTime);
            const startB = toMin(b.startTime);
            const endA = a.endTime ? toMin(a.endTime) : (startA + 150);
            const endB = b.endTime ? toMin(b.endTime) : (startB + 150);

            // Interval collision condition
            if (startA < endB && startB < endA) {
              collidingIds.add(a.showId);
              collidingIds.add(b.showId);

              if (!details.has(a.showId)) details.set(a.showId, []);
              details.get(a.showId).push(b);

              if (!details.has(b.showId)) details.set(b.showId, []);
              details.get(b.showId).push(a);
            }
          }
        }
      }
    }

    return { overlappingShowIds: collidingIds, overlapMap: details };
  }, [dbShows]);

  const ADMIN_SHOWS = dbShows;

  const filtered = ADMIN_SHOWS.filter(s => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      s.movieTitle.toLowerCase().includes(q) ||
      s.hallName.toLowerCase().includes(q) ||
      s.screenName.toLowerCase().includes(q) ||
      (s.city || "").toLowerCase().includes(q);

    let matchesStatus = true;
    if (statusFilter === "OVERLAPS") {
      matchesStatus = overlappingShowIds.has(s.showId);
    } else if (statusFilter !== "ALL") {
      matchesStatus = s.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    let av = sortField === "booked" ? a.seatsBooked : (a[sortField] ?? "");
    let bv = sortField === "booked" ? b.seatsBooked : (b[sortField] ?? "");
    if (typeof av === "string") av = av.toLowerCase();
    if (typeof bv === "string") bv = bv.toLowerCase();
    return sortDir === "asc" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
  });

  const toggleSort = field => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const totalBooked = ADMIN_SHOWS.reduce((s, sh) => s + sh.seatsBooked, 0);
  const soldOut = ADMIN_SHOWS.filter(s => s.status === "SOLD_OUT").length;
  const cancelledShows = ADMIN_SHOWS.filter(s => s.status === "CANCELLED").length;
  const totalOverlaps = overlappingShowIds.size;

  const SBtn = ({ field, label }) => (
    <button onClick={() => toggleSort(field)} className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#958ea0] hover:text-white cursor-pointer">
      {label}
      <span className={sortField === field ? "text-[#a078ff]" : "text-[#494454]"}>{sortField === field ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}</span>
    </button>
  );

  const handleExecuteModeration = async () => {
    if (!modalConfig?.show) return;
    setProcessing(true);
    const { show, type } = modalConfig;
    const finalReason = selectedReason === "Custom..."
      ? (customReason.trim() || "Administrative adjustment")
      : (customReason.trim() ? `${selectedReason}: ${customReason.trim()}` : selectedReason);

    try {
      if (type === 'CANCEL') {
        await adminApi.cancelShow(show.showId, { reason: finalReason });
        setDbShows(prev => prev.map(s => s.showId === show.showId ? { ...s, status: 'CANCELLED', cancellationReason: finalReason } : s));
        setFeedbackNotice({
          type: 'success',
          message: `Show "${show.movieTitle}" (${show.startTime}) at ${show.screenName} has been cancelled and unlisted.`
        });
      } else {
        await adminApi.approveShow(show.showId, { reason: finalReason });
        setDbShows(prev => prev.map(s => s.showId === show.showId ? { ...s, status: 'ON_SALE', cancellationReason: '' } : s));
        setFeedbackNotice({
          type: 'success',
          message: `Show "${show.movieTitle}" (${show.startTime}) at ${show.screenName} approved and published On Sale.`
        });
      }
      setModalConfig(null);
      setCustomReason("");
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        message: err.message || 'Operation failed. Please retry.'
      });
    } finally {
      setProcessing(false);
    }
  };

  const openDenyModal = (show) => {
    const isOverlap = overlappingShowIds.has(show.showId);
    const conflicts = overlapMap.get(show.showId) || [];
    setSelectedReason(isOverlap ? "Schedule overlap / Screen conflict" : "Screen technical maintenance / screen issue");
    setCustomReason(isOverlap && conflicts.length ? `Clashes with ${conflicts.map(c => `${c.movieTitle} (${c.startTime})`).join(', ')}` : "");
    setModalConfig({ show, type: 'CANCEL' });
  };

  const openApproveModal = (show) => {
    setSelectedReason("Approved and authorized for public ticket sales");
    setCustomReason("");
    setModalConfig({ show, type: 'APPROVE' });
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackNotice && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono ${
          feedbackNotice.type === 'error'
            ? 'bg-[#ffb4ab]/15 border-[#ffb4ab]/40 text-[#ffb4ab]'
            : 'bg-[#4edea3]/15 border-[#4edea3]/40 text-[#4edea3]'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackNotice.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
            <span>{feedbackNotice.message}</span>
          </div>
          <button onClick={() => setFeedbackNotice(null)} className="text-[#958ea0] hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action / Moderation Modal */}
      {modalConfig && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalConfig(null); }}
        >
          <div className="bg-[#12151e] border border-[#232938] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#232938]">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  modalConfig.type === 'CANCEL' ? 'bg-[#ffb4ab]/15 text-[#ffb4ab]' : 'bg-[#4edea3]/15 text-[#4edea3]'
                }`}>
                  {modalConfig.type === 'CANCEL' ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {modalConfig.type === 'CANCEL' ? 'Deny / Cancel Show Screening' : 'Approve & Publish Show'}
                  </h3>
                  <p className="text-[11px] font-mono text-[#958ea0]">
                    {modalConfig.type === 'CANCEL' ? 'Take down conflicting or unavailable show' : 'Authorize show for customer bookings'}
                  </p>
                </div>
              </div>
              <button onClick={() => setModalConfig(null)} className="text-[#958ea0] hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Show Card */}
            <div className="p-3.5 rounded-xl bg-[#0d0e12] border border-[#232938] space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">{modalConfig.show.movieTitle}</h4>
                  <p className="text-xs font-mono text-[#a078ff]">{modalConfig.show.hallName} · {modalConfig.show.screenName}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#a078ff]/15 text-[#d0bcff] border border-[#a078ff]/30">
                  {modalConfig.show.format}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-[#cbc3d7]">
                <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-[#4cd7f6]" /> {modalConfig.show.date}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#4edea3]" /> {modalConfig.show.startTime}</span>
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-[#fbbf24]" /> {modalConfig.show.city}</span>
              </div>

              {/* Conflict Highlight Box if show has overlap */}
              {overlappingShowIds.has(modalConfig.show.showId) && (
                <div className="mt-2 p-2.5 rounded-lg bg-[#ffb4ab]/10 border border-[#ffb4ab]/40 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#ffb4ab] flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] font-mono">
                    <p className="text-[#ffb4ab] font-bold">Schedule Collision Detected!</p>
                    <p className="text-[#cbc3d7] mt-0.5">
                      This screening clashes on <strong>{modalConfig.show.screenName}</strong> with:
                    </p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-[#ffb4ab]">
                      {(overlapMap.get(modalConfig.show.showId) || []).map((c, idx) => (
                        <li key={idx}><strong>{c.movieTitle}</strong> at {c.startTime}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Reason Selection */}
            {modalConfig.type === 'CANCEL' ? (
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-[#cbc3d7] flex items-center justify-between">
                  <span>Reason for Cancellation / Denial</span>
                  <span className="text-[10px] text-[#958ea0] font-normal">Logged to Audit Trail</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  {[
                    "Schedule overlap / Screen conflict",
                    "Screen technical maintenance / screen issue",
                    "Exhibition authorization / licensing restriction",
                    "Operator request / duplicate show entry",
                    "Capacity or seating adjustment",
                    "Custom..."
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedReason(r)}
                      className={`px-3 py-2 rounded-xl text-left border transition-colors cursor-pointer ${
                        selectedReason === r
                          ? "bg-[#ffb4ab]/20 border-[#ffb4ab]/50 text-white font-bold"
                          : "bg-[#0d0e12] border-[#232938] text-[#958ea0] hover:border-[#494454] hover:text-white"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Additional notes or cancellation rationale for cinema operator..."
                  className="w-full mt-2 px-3 py-2 rounded-xl bg-[#0d0e12] border border-[#232938] text-xs font-mono text-white placeholder-[#494454] outline-none focus:border-[#ffb4ab]/60"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-[#cbc3d7]">
                  Approval Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Optional approval notes for audit record..."
                  className="w-full px-3 py-2 rounded-xl bg-[#0d0e12] border border-[#232938] text-xs font-mono text-white placeholder-[#494454] outline-none focus:border-[#4edea3]/60"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleExecuteModeration}
                disabled={processing}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs font-mono flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 ${
                  modalConfig.type === 'CANCEL'
                    ? 'bg-gradient-to-r from-[#ffb4ab] to-[#f87171] text-[#1a0000] hover:brightness-110'
                    : 'bg-gradient-to-r from-[#4edea3] to-[#03b5d3] text-[#001f26] hover:brightness-110'
                }`}
              >
                {processing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : modalConfig.type === 'CANCEL' ? (
                  <>
                    <Ban className="w-4 h-4" />
                    <span>Confirm Deny & Cancel Show</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Approval & Publish</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setModalConfig(null)}
                disabled={processing}
                className="px-5 py-2.5 rounded-xl bg-[#1a1d26] border border-[#232938] text-[#cbc3d7] text-xs font-mono font-bold hover:text-white cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Shows Listed", value: ADMIN_SHOWS.length, color: "#d0bcff", Icon: Film },
          { label: "Tickets Sold", value: totalBooked.toLocaleString(), color: "#4edea3", Icon: Users },
          {
            label: "Schedule Overlaps",
            value: totalOverlaps,
            color: totalOverlaps > 0 ? "#fbbf24" : "#4edea3",
            Icon: AlertTriangle,
            badge: totalOverlaps > 0 ? `${totalOverlaps} colliding` : "No conflicts"
          },
          { label: "Cancelled Shows", value: cancelledShows, color: "#ffb4ab", Icon: XCircle },
        ].map(({ label, value, color, Icon, badge }) => (
          <div key={label} className="bg-[#12151e] border border-[#232938] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[9px] text-[#958ea0] font-mono uppercase tracking-wider truncate">{label}</p>
                {badge && (
                  <span className={`text-[8px] font-mono px-1.5 py-0.2 rounded ${totalOverlaps > 0 ? 'bg-[#fbbf24]/20 text-[#fbbf24]' : 'bg-[#4edea3]/20 text-[#4edea3]'}`}>
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-xl font-extrabold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 flex items-center gap-2 bg-[#0d0e12] border border-[#232938] px-3 py-2 rounded-xl focus-within:border-[#a078ff]/60">
          <Search className="w-4 h-4 text-[#958ea0]" />
          <input
            type="text"
            placeholder="Search movie, venue, screen, city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-[#494454] outline-none"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {["ALL", "ON_SALE", "OVERLAPS", "HIGH_DEMAND", "SOLD_OUT", "CANCELLED"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border cursor-pointer transition-colors ${
                statusFilter === s
                  ? s === "OVERLAPS"
                    ? "bg-[#fbbf24]/20 text-[#fbbf24] border-[#fbbf24]/50"
                    : "bg-[#a078ff]/20 text-[#d0bcff] border-[#a078ff]/50"
                  : "bg-[#0d0e12] text-[#958ea0] border-[#232938] hover:border-[#494454]"
              }`}
            >
              {s === "ALL" ? "All" : s === "OVERLAPS" ? `⚠️ Overlaps (${totalOverlaps})` : SHOW_STATUS_CFG[s]?.label || s}
            </button>
          ))}
          <button
            onClick={loadShows}
            title="Refresh Shows"
            className="p-2 rounded-lg bg-[#0d0e12] border border-[#232938] text-[#958ea0] hover:text-white cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#a078ff]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Shows Moderation Table */}
      <div className="bg-[#0d0e12] border border-[#232938] rounded-2xl overflow-hidden shadow-xl">
        <div className="hidden lg:grid grid-cols-[2fr_1.8fr_0.9fr_0.9fr_0.8fr_1.2fr_0.9fr_1.5fr] gap-0 px-4 py-2.5 border-b border-[#232938] bg-[#12151e]">
          <SBtn field="movieTitle" label="Movie / Format" />
          <SBtn field="hallName" label="Venue & Screen" />
          <SBtn field="date" label="Date" />
          <SBtn field="startTime" label="Time" />
          <SBtn field="city" label="City" />
          <SBtn field="booked" label="Tickets Sold" />
          <SBtn field="status" label="Status" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#958ea0]">Moderation</span>
        </div>
        <div className="divide-y divide-[#1a1d26]">
          {sorted.length === 0 && (
            <div className="py-12 text-center text-[#494454] text-sm font-mono">
              {statusFilter === "OVERLAPS" ? "✅ No conflicting show overlaps detected." : "No shows match your search."}
            </div>
          )}
          {sorted.map(show => {
            const st = SHOW_STATUS_CFG[show.status] || SHOW_STATUS_CFG.ON_SALE;
            const isOverlap = overlappingShowIds.has(show.showId);
            const conflicts = overlapMap.get(show.showId) || [];

            return (
              <div
                key={show.showId}
                className={`flex flex-col lg:grid lg:grid-cols-[2fr_1.8fr_0.9fr_0.9fr_0.8fr_1.2fr_0.9fr_1.5fr] gap-0 px-4 py-3 hover:bg-[#12151e] transition-colors ${
                  isOverlap ? 'bg-[#fbbf24]/5 border-l-2 border-l-[#fbbf24]' : ''
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-white">{show.movieTitle}</p>
                  <p className="text-[10px] font-mono text-[#a078ff]">{show.format} · {show.language}</p>
                  {isOverlap && (
                    <div className="flex items-center gap-1 text-[9px] font-mono text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/30 px-1.5 py-0.5 rounded mt-1 w-fit">
                      <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
                      <span>Overlap Conflict ({conflicts.length})</span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#cbc3d7] truncate">{show.hallName}</p>
                  <p className="text-[10px] font-mono text-[#494454] truncate">{show.screenName}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-[#cbc3d7] mt-1 lg:mt-0">
                  <CalendarDays className="w-3 h-3 text-[#4cd7f6]" />{show.date}
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-[#cbc3d7]">
                  <Clock className="w-3 h-3 text-[#4edea3]" />{show.startTime}
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-[#958ea0]">
                  <MapPin className="w-3 h-3 text-[#fbbf24]" />{show.city}
                </div>
                <div className="py-1">
                  <OccupancyBar booked={show.seatsBooked} total={show.totalSeats} />
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${st.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                  {show.cancellationReason && (
                    <p className="text-[9px] font-mono text-[#ffb4ab] mt-1 truncate" title={show.cancellationReason}>
                      {show.cancellationReason}
                    </p>
                  )}
                </div>

                {/* Moderation Actions Column */}
                <div className="flex items-center gap-2 pt-2 lg:pt-0">
                  {show.status === 'CANCELLED' ? (
                    <button
                      onClick={() => openApproveModal(show)}
                      className="px-2.5 py-1 rounded-lg bg-[#4edea3]/15 text-[#4edea3] hover:bg-[#4edea3]/25 border border-[#4edea3]/40 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Re-approve and publish show"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Approve</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openApproveModal(show)}
                        className="px-2 py-1 rounded-lg bg-[#1a1d26] hover:bg-[#4edea3]/20 text-[#958ea0] hover:text-[#4edea3] border border-[#232938] hover:border-[#4edea3]/40 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Approve / Confirm Screening"
                      >
                        <Check className="w-3 h-3 text-[#4edea3]" />
                        <span className="hidden sm:inline">Approve</span>
                      </button>

                      <button
                        onClick={() => openDenyModal(show)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                          isOverlap
                            ? 'bg-[#ffb4ab]/25 text-[#ffb4ab] border border-[#ffb4ab]/60 hover:bg-[#ffb4ab]/35 shadow-sm shadow-[#ffb4ab]/20'
                            : 'bg-[#ffb4ab]/10 text-[#ffb4ab] border border-[#ffb4ab]/30 hover:bg-[#ffb4ab]/20'
                        }`}
                        title="Deny or Cancel Show"
                      >
                        <Ban className="w-3 h-3" />
                        <span>Deny</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-[#232938] bg-[#12151e] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
          <span className="text-[11px] font-mono text-[#494454]">
            Showing {sorted.length} of {ADMIN_SHOWS.length} shows {totalOverlaps > 0 ? `(${totalOverlaps} colliding schedule conflicts)` : ''}
          </span>
          <span className="text-[11px] font-mono text-[#a078ff]">
            {totalBooked.toLocaleString()} tickets sold across all venues
          </span>
        </div>
      </div>
    </div>
  );
}

function ProviderManagementTab() {
  const [providers, setProviders] = useState(ADMIN_PROVIDERS_INIT);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    const fetchCinemas = async () => {
      try {
        const cinemas = await adminApi.getCinemas();
        if (Array.isArray(cinemas) && cinemas.length > 0) {
          const mapped = cinemas.map(c => ({
            providerId: c.id,
            providerName: c.cinema_name,
            companyName: c.cinema_name + ' Pvt. Ltd.',
            email: c.email || 'partner@cinema.io',
            phone: c.phone || '+91 98000 00000',
            city: c.city || 'Mumbai',
            hallCount: 1,
            verifiedHalls: c.verification_status === 'VERIFIED' ? 1 : 0,
            pendingHalls: c.verification_status === 'VERIFIED' ? 0 : 1,
            permissionStatus: c.verification_status === 'VERIFIED' ? 'ACTIVE' : (c.verification_status === 'REJECTED' ? 'REVOKED' : 'SUSPENDED'),
            joinedDate: c.created_at ? c.created_at.split('T')[0] : '2026-01-01',
            lastActivity: 'Today',
            halls: [{ hallId: c.id, name: c.cinema_name, status: c.verification_status || 'DRAFT', screens: c.screens?.length || 0, screenRecords: c.screens || [], documents: c.documents || [] }]
          }));
          setProviders(mapped);
        }
      } catch (err) {
        console.warn('Could not load cinemas from admin API:', err.message);
      }
    };
    fetchCinemas();
  }, []);

  const filtered = providers.filter(p => {
    const q = search.toLowerCase();
    return (!q || p.companyName.toLowerCase().includes(q) || p.providerName.toLowerCase().includes(q) || p.city.toLowerCase().includes(q))
      && (statusFilter === "ALL" || p.permissionStatus === statusFilter);
  });

  const executeAction = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.action === 'ACTIVE') {
        await adminApi.approveVerification(confirmAction.providerId, 'Approved by Platform Root Admin');
      } else if (confirmAction.action === 'REVOKED' || confirmAction.action === 'SUSPENDED') {
        await adminApi.rejectVerification(confirmAction.providerId, `Access marked as ${confirmAction.action}`);
      }
    } catch (e) {
      console.warn('Admin API status update error:', e.message);
    }
    setProviders(prev => prev.map(p => p.providerId === confirmAction.providerId ? { ...p, permissionStatus: confirmAction.action } : p));
    setConfirmAction(null);
  };

  const totalActive = providers.filter(p => p.permissionStatus === "ACTIVE").length;
  const totalSuspended = providers.filter(p => p.permissionStatus === "SUSPENDED").length;
  const totalRevoked = providers.filter(p => p.permissionStatus === "REVOKED").length;
  const totalPending = providers.reduce((s, p) => s + p.pendingHalls, 0);

  const ACTION_CFG = {
    ACTIVE: { label: "Grant Permission", btnCls: "bg-gradient-to-r from-[#4edea3] to-[#03b5d3] text-[#001f26]", hlCls: "bg-[#4edea3]/10 border-[#4edea3]/30 text-[#4edea3]" },
    SUSPENDED: { label: "Suspend Access", btnCls: "bg-gradient-to-r from-[#fbbf24] to-[#f97316] text-[#1a0800]", hlCls: "bg-[#fbbf24]/10 border-[#fbbf24]/30 text-[#fbbf24]" },
    REVOKED: { label: "Revoke Permission", btnCls: "bg-gradient-to-r from-[#ffb4ab] to-[#f87171] text-[#1a0000]", hlCls: "bg-[#ffb4ab]/10 border-[#ffb4ab]/30 text-[#ffb4ab]" },
  };

  return (
    <div className="space-y-6">
      {confirmAction && (() => {
        const prov = providers.find(p => p.providerId === confirmAction.providerId);
        const acfg = ACTION_CFG[confirmAction.action];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
            <div className="bg-[#12151e] border border-[#232938] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${acfg.hlCls}`}><Shield className="w-5 h-5" /><span className="font-bold text-sm">{acfg.label}</span></div>
              <div>
                <p className="text-sm text-[#cbc3d7]">You are about to <strong className="text-white">{acfg.label.toLowerCase()}</strong> for:</p>
                <div className="mt-2 p-3 rounded-xl bg-[#0d0e12] border border-[#232938]">
                  <p className="text-sm font-bold text-white">{prov?.companyName}</p>
                  <p className="text-[11px] font-mono text-[#958ea0]">{prov?.providerName} · {prov?.city}</p>
                  <p className="text-[10px] font-mono text-[#494454] mt-1">ID: {prov?.providerId}</p>
                </div>
                <p className="text-[11px] text-[#494454] mt-2 font-mono">This action is logged and immediately effective.</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={executeAction} className={`flex-1 py-2.5 rounded-xl font-bold text-xs font-mono cursor-pointer ${acfg.btnCls}`}>Confirm — {acfg.label}</button>
                <button onClick={() => setConfirmAction(null)} className="px-4 py-2.5 rounded-xl bg-[#1a1d26] border border-[#232938] text-[#cbc3d7] text-xs font-mono font-bold cursor-pointer hover:text-white">Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Providers", value: totalActive, color: "#4edea3", Icon: CheckCircle2 },
          { label: "Suspended", value: totalSuspended, color: "#fbbf24", Icon: AlertCircle },
          { label: "Revoked", value: totalRevoked, color: "#ffb4ab", Icon: XCircle },
          { label: "Halls Pending Verify", value: totalPending, color: "#4cd7f6", Icon: CircleDot },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="bg-[#12151e] border border-[#232938] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <p className="text-[9px] text-[#958ea0] font-mono uppercase tracking-wider">{label}</p>
              <p className="text-xl font-extrabold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 flex items-center gap-2 bg-[#0d0e12] border border-[#232938] px-3 py-2 rounded-xl focus-within:border-[#a078ff]/60">
          <Search className="w-4 h-4 text-[#958ea0]" />
          <input type="text" placeholder="Search company, provider name, city..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm text-white placeholder-[#494454] outline-none" />
        </div>
        <div className="flex items-center gap-2">
          {["ALL", "ACTIVE", "SUSPENDED", "REVOKED"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border cursor-pointer ${statusFilter === s ? "bg-[#a078ff]/20 text-[#d0bcff] border-[#a078ff]/50" : "bg-[#0d0e12] text-[#958ea0] border-[#232938] hover:border-[#494454]"}`}>
              {s === "ALL" ? "All" : PERM_CFG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && <div className="py-10 text-center text-[#494454] text-sm font-mono bg-[#0d0e12] border border-[#232938] rounded-2xl">No providers match.</div>}
        {filtered.map(provider => {
          const perm = PERM_CFG[provider.permissionStatus];
          const PermIcon = perm.Icon;
          const isExpanded = expandedId === provider.providerId;
          return (
            <div key={provider.providerId} className="bg-[#0d0e12] border border-[#232938] rounded-2xl overflow-hidden">
              <div className="p-4 flex flex-col lg:flex-row items-start lg:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#8b5cf6] to-[#4cd7f6] flex items-center justify-center font-extrabold text-white text-sm flex-shrink-0">{provider.providerName.slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{provider.companyName}</p>
                    <p className="text-[11px] font-mono text-[#958ea0]">{provider.providerName} · {provider.city}</p>
                    <p className="text-[10px] font-mono text-[#494454]">{provider.providerId} · Joined {provider.joinedDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#12151e] border border-[#232938] rounded-lg"><Building2 className="w-3.5 h-3.5 text-[#4cd7f6]" /><span className="text-[11px] font-mono text-white">{provider.hallCount} Hall{provider.hallCount !== 1 ? "s" : ""}</span></div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#12151e] border border-[#232938] rounded-lg"><BadgeCheck className="w-3.5 h-3.5 text-[#4edea3]" /><span className="text-[11px] font-mono text-white">{provider.verifiedHalls} Verified</span></div>
                  {provider.pendingHalls > 0 && <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-lg"><CircleDot className="w-3.5 h-3.5 text-[#fbbf24]" /><span className="text-[11px] font-mono text-[#fbbf24]">{provider.pendingHalls} Pending</span></div>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${perm.cls}`}><PermIcon className="w-3 h-3" />{perm.label}</span>
                  {provider.permissionStatus !== "ACTIVE" && <button onClick={() => setConfirmAction({ providerId: provider.providerId, action: "ACTIVE" })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#4edea3]/10 border border-[#4edea3]/30 text-[#4edea3] hover:bg-[#4edea3]/20 text-[10px] font-mono font-bold cursor-pointer"><Unlock className="w-3 h-3" />Grant</button>}
                  {provider.permissionStatus === "ACTIVE" && <button onClick={() => setConfirmAction({ providerId: provider.providerId, action: "SUSPENDED" })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/30 text-[#fbbf24] hover:bg-[#fbbf24]/20 text-[10px] font-mono font-bold cursor-pointer"><AlertCircle className="w-3 h-3" />Suspend</button>}
                  {provider.permissionStatus !== "REVOKED" && <button onClick={() => setConfirmAction({ providerId: provider.providerId, action: "REVOKED" })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 text-[#ffb4ab] hover:bg-[#ffb4ab]/20 text-[10px] font-mono font-bold cursor-pointer"><Lock className="w-3 h-3" />Revoke</button>}
                  <button onClick={() => setExpandedId(isExpanded ? null : provider.providerId)} className="p-1.5 rounded-lg bg-[#12151e] border border-[#232938] text-[#958ea0] hover:text-white cursor-pointer">{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                </div>
              </div>
              {isExpanded && (
                <div className="border-t border-[#232938] bg-[#0a0b10] p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[{ label: "Email", value: provider.email }, { label: "Phone", value: provider.phone }, { label: "GSTIN", value: provider.gstin }, { label: "Registration ID", value: provider.registrationId }, { label: "Last Activity", value: provider.lastActivity }, { label: "City / Zone", value: provider.city }].map(item => (
                      <div key={item.label} className="bg-[#12151e] border border-[#232938] rounded-xl p-3"><p className="text-[9px] font-mono text-[#494454] uppercase tracking-widest">{item.label}</p><p className="text-[11px] font-mono text-[#cbc3d7] mt-0.5 break-all">{item.value}</p></div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#958ea0] mb-2">Registered Halls</p>
                    <div className="space-y-2">
                      {provider.halls.map(hall => {
                        const hcfg = hall.status === "VERIFIED" ? { label: "Verified", cls: "bg-[#4edea3]/10 text-[#4edea3] border-[#4edea3]/30" } : { label: "Pending Verification", cls: "bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30" };
                        return (
                          <div key={hall.hallId} className="bg-[#12151e] border border-[#232938] rounded-xl px-4 py-3 space-y-3">
                            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><Building2 className="w-4 h-4 text-[#4cd7f6]" /><div><p className="text-xs font-semibold text-white">{hall.name}</p><p className="text-[10px] font-mono text-[#494454]">{hall.hallId} · {hall.screens} screen{hall.screens !== 1 ? "s" : ""}</p></div></div><span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${hcfg.cls}`}>{hcfg.label}</span></div>
                            {hall.screenRecords?.length > 0 && <div className="flex flex-wrap gap-2">{hall.screenRecords.map(screen => <span key={screen.id} className="px-2 py-1 rounded-lg bg-[#0d0e12] border border-[#232938] text-[10px] text-[#cbc3d7]">{screen.screen_name} · {screen.screen_type} · {screen.capacity} seats</span>)}</div>}
                            {hall.documents?.length > 0 && <div className="flex flex-wrap gap-2">{hall.documents.map(doc => <span key={doc.id} className="px-2 py-1 rounded-lg bg-[#0d0e12] border border-[#232938] text-[10px] text-[#cbc3d7]">{doc.document_type.replaceAll('_', ' ')} · {doc.status}{doc.review_url && <> · <a className="text-[#4cd7f6] underline" href={doc.review_url} target="_blank" rel="noreferrer">View document</a></>}</span>)}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] font-mono text-[#494454] text-center">All permission changes are logged and immediately effective. Grant/Revoke actions require confirmation.</p>
    </div>
  );
}

function DatabaseTab() {
  const [records, setRecords] = useState({ providers: [], customers: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [section, setSection] = useState('providers');
  const [search, setSearch] = useState('');
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getDatabase();
      const customersList = result?.customers || result?.users || [];
      setRecords({
        providers: result?.providers || [],
        customers: customersList,
        users: customersList
      });
    } catch (err) {
      setError(err.message || 'Could not load database records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const customersList = records.customers?.length ? records.customers : records.users;
  const q = search.toLowerCase();

  const filteredProviders = records.providers.filter(p => {
    const moviesText = (p.movies || []).map(m => m.title).join(' ');
    const cinemasText = (p.cinemas || []).map(c => c.cinema_name).join(' ');
    return `${p.full_name || ''} ${p.email || ''} ${p.organization_name || ''} ${p.phone || ''} ${moviesText} ${cinemasText}`.toLowerCase().includes(q);
  });

  const filteredCustomers = customersList.filter(u => {
    const bookingsText = (u.bookings || []).map(b => `${b.booking_reference || ''} ${b.movies?.title || ''} ${b.cinemas?.cinema_name || ''}`).join(' ');
    return `${u.full_name || ''} ${u.email || ''} ${u.phone || ''} ${u.location || ''} ${bookingsText}`.toLowerCase().includes(q);
  });

  const totalProviderFilms = records.providers.reduce((sum, p) => sum + (p.movies?.length || 0), 0);
  const totalCustomerBookings = customersList.reduce((sum, u) => sum + (u.totalBookings || 0), 0);
  const totalCustomerSpend = customersList.reduce((sum, u) => sum + (u.totalSpend || 0), 0);

  const label = (name, value) => (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-[#64748b]">{name}</p>
      <p className="mt-1 text-xs text-[#cbc3d7] break-words">{value || '—'}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header & KPI Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-[#d0bcff]" />
            Database & Accounts Registry
          </h2>
          <p className="text-xs text-[#94a3b8] mt-1">
            Authoritative directory of registered movie providers, cinema exhibitors, and active customers with real-time transactional records.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-[#232938] bg-[#12151e] text-xs font-mono text-[#cbc3d7] hover:text-white hover:border-[#a078ff]/50 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Registry
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Movie Providers & Exhibitors', value: records.providers.length, color: '#4cd7f6', Icon: Building2, subtitle: `${totalProviderFilms} films registered` },
          { label: 'Registered Customers', value: customersList.length, color: '#a078ff', Icon: Users, subtitle: `${totalCustomerBookings} total bookings` },
          { label: 'Catalog Films Submitted', value: totalProviderFilms, color: '#4edea3', Icon: Film, subtitle: 'Across all providers' },
          { label: 'Customer GMV / Spend', value: `₹${totalCustomerSpend.toLocaleString()}`, color: '#fbbf24', Icon: Activity, subtitle: 'Confirmed transactions' },
        ].map(({ label: title, value, color, Icon, subtitle }) => (
          <div key={title} className="bg-[#12151e] border border-[#232938] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] text-[#958ea0] font-mono uppercase tracking-wider truncate">{title}</p>
              <p className="text-lg font-extrabold text-white truncate">{value}</p>
              <p className="text-[10px] font-mono text-[#64748b] truncate">{subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Segmented Controls & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setSection('providers')}
            className={`px-4 py-2.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition-all ${section === 'providers'
              ? 'bg-[#4cd7f6]/20 border-[#4cd7f6]/60 text-[#4cd7f6] shadow-[0_0_12px_rgba(76,215,246,0.15)]'
              : 'bg-[#0d0e12] border-[#232938] text-[#958ea0] hover:border-[#494454]'
              }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Movie Providers ({records.providers.length})</span>
          </button>
          <button
            onClick={() => setSection('customers')}
            className={`px-4 py-2.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition-all ${section === 'customers'
              ? 'bg-[#a078ff]/20 border-[#a078ff]/60 text-[#d0bcff] shadow-[0_0_12px_rgba(160,120,255,0.15)]'
              : 'bg-[#0d0e12] border-[#232938] text-[#958ea0] hover:border-[#494454]'
              }`}
          >
            <Users className="w-4 h-4" />
            <span>Customers ({customersList.length})</span>
          </button>
        </div>

        <div className="flex-1 flex items-center gap-2 bg-[#0d0e12] border border-[#232938] px-3.5 py-2 rounded-xl focus-within:border-[#a078ff]/60 transition-colors">
          <Search className="w-4 h-4 text-[#64748b]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={
              section === 'providers'
                ? 'Search providers by name, company, email, phone, or film title…'
                : 'Search customers by name, email, phone, location, or booking reference…'
            }
            className="flex-1 bg-transparent text-sm text-white placeholder-[#494454] outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-[#958ea0] hover:text-white font-mono">
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-sm text-[#ffb4ab]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm font-mono text-[#958ea0] bg-[#0d0e12] border border-[#232938] rounded-2xl">
          Loading database records…
        </div>
      ) : section === 'providers' ? (
        /* ================= MOVIE PROVIDERS LIST ================= */
        <div className="space-y-4">
          {filteredProviders.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-[#232938] bg-[#0d0e12] text-sm text-[#64748b] font-mono">
              {search ? 'No movie providers match your search query.' : 'No movie providers found in database.'}
            </div>
          ) : (
            filteredProviders.map(provider => (
              <article key={provider.id} className="rounded-2xl border border-[#232938] bg-[#0d0e12] overflow-hidden shadow-lg">
                {/* Provider Card Header */}
                <div className="p-4 border-b border-[#232938] bg-[#12151e]/80 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#4cd7f6]/10 border border-[#4cd7f6]/30 flex items-center justify-center text-[#4cd7f6] shrink-0 font-bold">
                      {(provider.full_name || 'P')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white truncate">{provider.full_name || 'Unnamed Provider'}</p>
                        <span className="px-2 py-0.5 rounded-full border border-[#4cd7f6]/30 bg-[#4cd7f6]/10 text-[9px] font-mono font-bold text-[#4cd7f6]">
                          {provider.role || 'MOVIE_PROVIDER'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-mono font-bold ${provider.is_active ? 'bg-[#4edea3]/10 border-[#4edea3]/30 text-[#4edea3]' : 'bg-[#ffb4ab]/10 border-[#ffb4ab]/30 text-[#ffb4ab]'
                          }`}>
                          {provider.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <p className="text-xs text-[#958ea0] mt-0.5">{provider.email || 'No email recorded'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-xl border border-[#232938] bg-[#181c26] text-[10px] font-mono text-[#cbc3d7]">
                      {provider.movies?.length || 0} Film{(provider.movies?.length === 1 ? '' : 's')}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl border border-[#232938] bg-[#181c26] text-[10px] font-mono text-[#cbc3d7]">
                      {provider.cinemas?.length || 0} Cinema Hall{(provider.cinemas?.length === 1 ? '' : 's')}
                    </span>
                  </div>
                </div>

                {/* Provider Meta Details */}
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-[#232938] bg-[#0d0e12]/60 text-xs">
                  {label('Provider ID', provider.id)}
                  {label('Company / Organization', provider.organization_name || 'Independent Exhibitor')}
                  {label('Phone', provider.phone)}
                  {label('Joined Platform', provider.created_at ? new Date(provider.created_at).toLocaleDateString() : '')}
                </div>

                {/* Provider Associated Cinema Halls */}
                {provider.cinemas && provider.cinemas.length > 0 && (
                  <div className="p-4 border-b border-[#232938] bg-[#12151e]/40">
                    <p className="text-[10px] uppercase font-mono tracking-wider text-[#4cd7f6] font-bold mb-2 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      Associated Cinema Halls ({provider.cinemas.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {provider.cinemas.map(c => (
                        <div key={c.id} className="p-2.5 rounded-xl border border-[#232938] bg-[#181c26] flex items-center gap-2 text-xs">
                          <span className="font-bold text-white">{c.cinema_name}</span>
                          <span className="text-[#958ea0]">· {c.city || 'Location TBA'}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${c.verification_status === 'VERIFIED' ? 'bg-[#4edea3]/20 text-[#4edea3]' : 'bg-[#fbbf24]/20 text-[#fbbf24]'
                            }`}>
                            {c.verification_status || 'PENDING'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Provider Films List */}
                <div className="p-4 space-y-3">
                  <p className="text-[10px] uppercase font-mono tracking-wider text-[#a078ff] font-bold flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5" />
                    Submitted Film Catalog ({provider.movies?.length || 0})
                  </p>
                  {provider.movies?.length === 0 ? (
                    <p className="text-xs text-[#64748b] font-mono">No film titles submitted by this provider yet.</p>
                  ) : (
                    provider.movies.map(movie => {
                      const isApproved = movie.status === 'ACTIVE';
                      const isPending = movie.status === 'PENDING_REVIEW';
                      return (
                        <div key={movie.id} className="rounded-xl border border-[#232938] bg-[#12151e] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-white">{movie.title}</h3>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${isApproved
                                  ? 'bg-[#4edea3]/15 border-[#4edea3]/40 text-[#4edea3]'
                                  : isPending
                                    ? 'bg-[#fbbf24]/15 border-[#fbbf24]/40 text-[#fbbf24]'
                                    : 'bg-[#ffb4ab]/15 border-[#ffb4ab]/40 text-[#ffb4ab]'
                                  }`}>
                                  {isApproved ? '✓ AUTHORIZED (LIVE)' : isPending ? '● AWAITING ADMIN APPROVAL' : movie.status}
                                </span>
                              </div>
                              <p className="text-[10px] font-mono text-[#64748b] mt-0.5">Code: {movie.movie_code} · Added: {new Date(movie.created_at).toLocaleDateString()}</p>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-[#181c26] text-[#4cd7f6] border border-[#232938]">
                              {(movie.formats || ['Standard 2D']).join(', ')}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                            {label('Director', movie.director_name)}
                            {label('Distributor', movie.distributor_name)}
                            {label('CBFC Certificate', `${movie.cbfc_certification || 'UA'} (${movie.cbfc_certificate_number || 'TBA'})`)}
                            {label('Duration & Release', `${movie.duration_minutes || 120} min · ${movie.release_date || 'TBA'}`)}
                          </div>

                          {/* Screenings breakdown */}
                          <div className="pt-2.5 border-t border-[#232938]">
                            <p className="text-[9px] uppercase tracking-wider text-[#64748b] mb-1.5">Screenings Schedule</p>
                            {movie.screenings?.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {movie.screenings.map(show => (
                                  <span key={show.id} className="px-2 py-1 rounded bg-[#0d0e12] border border-[#232938] text-[10px] font-mono text-[#cbc3d7]">
                                    {show.show_date} · {String(show.start_time || '').slice(0, 5)} · {show.cinemas?.cinema_name || 'Cinema'} ({show.status})
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-[#64748b] font-mono">No active screenings scheduled yet.</p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      ) : (
        /* ================= CUSTOMERS LIST ================= */
        <div className="space-y-3">
          {filteredCustomers.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-[#232938] bg-[#0d0e12] text-sm text-[#64748b] font-mono">
              {search ? 'No customers match your search query.' : 'No customers found in database.'}
            </div>
          ) : (
            filteredCustomers.map(customer => {
              const isExpanded = expandedCustomerId === customer.id;
              const bookings = customer.bookings || [];
              return (
                <article key={customer.id} className="rounded-2xl border border-[#232938] bg-[#0d0e12] overflow-hidden shadow-lg">
                  {/* Customer Card Header */}
                  <div className="p-4 border-b border-[#232938] bg-[#12151e]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#a078ff]/10 border border-[#a078ff]/30 flex items-center justify-center text-[#d0bcff] shrink-0 font-bold">
                        {(customer.full_name || 'C')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-white truncate">{customer.full_name || 'Customer'}</p>
                          <span className="px-2.5 py-0.5 rounded-full border border-[#a078ff]/30 bg-[#a078ff]/10 text-[9px] font-mono font-bold text-[#d0bcff]">
                            CUSTOMER
                          </span>
                          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-mono font-bold ${customer.is_active ? 'bg-[#4edea3]/10 border-[#4edea3]/30 text-[#4edea3]' : 'bg-[#ffb4ab]/10 border-[#ffb4ab]/30 text-[#ffb4ab]'
                            }`}>
                            {customer.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>
                        <p className="text-xs text-[#958ea0] mt-0.5">{customer.email || 'No email registered'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-xl border border-[#232938] bg-[#181c26] text-[10px] font-mono text-[#4edea3] font-bold">
                        ₹{(customer.totalSpend || 0).toLocaleString()} spent
                      </span>
                      <span className="px-2.5 py-1 rounded-xl border border-[#232938] bg-[#181c26] text-[10px] font-mono text-[#cbc3d7]">
                        {customer.totalBookings || 0} booking{(customer.totalBookings === 1 ? '' : 's')}
                      </span>
                      <button
                        onClick={() => setExpandedCustomerId(isExpanded ? null : customer.id)}
                        className="px-2.5 py-1 rounded-xl border border-[#a078ff]/40 bg-[#a078ff]/15 text-[#d0bcff] hover:bg-[#a078ff]/25 text-[10px] font-mono font-bold cursor-pointer transition-colors flex items-center gap-1"
                      >
                        {isExpanded ? 'Hide Bookings' : 'View Bookings'}
                      </button>
                    </div>
                  </div>

                  {/* Customer Meta Details */}
                  <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-[#0d0e12]/60">
                    {label('Customer ID', customer.id)}
                    {label('Phone Number', customer.phone)}
                    {label('Location / City', customer.location || customer.city || 'India')}
                    {label('Account Joined', customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '')}
                  </div>

                  {/* Expandable Booking Records */}
                  {isExpanded && (
                    <div className="p-4 border-t border-[#232938] bg-[#12151e]/40 space-y-2">
                      <p className="text-[10px] uppercase font-mono tracking-wider text-[#d0bcff] font-bold flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-[#4edea3]" />
                        Customer Booking History ({bookings.length})
                      </p>
                      {bookings.length === 0 ? (
                        <p className="text-xs text-[#64748b] font-mono py-2">This customer has not placed any ticket orders yet.</p>
                      ) : (
                        <div className="divide-y divide-[#232938] border border-[#232938] rounded-xl overflow-hidden bg-[#0d0e12]">
                          {bookings.map(booking => (
                            <div key={booking.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-white">{booking.booking_reference || booking.id.slice(0, 8)}</span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${booking.status === 'CONFIRMED'
                                    ? 'bg-[#4edea3]/20 text-[#4edea3]'
                                    : 'bg-[#ffb4ab]/20 text-[#ffb4ab]'
                                    }`}>
                                    {booking.status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#958ea0] mt-0.5">
                                  {booking.movies?.title || 'Movie'} at {booking.cinemas?.cinema_name || 'Cinema Hall'}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-bold text-white">₹{booking.total_amount}</span>
                                <p className="text-[10px] font-mono text-[#64748b] mt-0.5">
                                  {booking.created_at ? new Date(booking.created_at).toLocaleString() : ''}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function MovieAuthorizationsTab({ onPendingCountChange }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [workingId, setWorkingId] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [rejectingMovie, setRejectingMovie] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadMovies = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getMovies();
      const list = Array.isArray(data) ? data : [];
      setMovies(list);
      const pending = list.filter(m => m.status === 'PENDING_REVIEW').length;
      if (onPendingCountChange) onPendingCountChange(pending);
    } catch (err) {
      setError(err.message || 'Could not load movies from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovies();
  }, []);

  const handleApprove = async (movie, bypass = false) => {
    setWorkingId(movie.id);
    setError('');
    setSuccessMsg('');
    try {
      await adminApi.approveMovie(movie.id, {
        reason: 'Authorized and approved by platform super admin',
        bypassDocumentCheck: bypass
      });
      setSuccessMsg(`Film "${movie.title}" successfully authorized and published to the customer user catalog!`);
      await loadMovies();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message || 'Could not authorize film.');
    } finally {
      setWorkingId('');
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingMovie) return;
    setWorkingId(rejectingMovie.id);
    setError('');
    setSuccessMsg('');
    try {
      await adminApi.rejectMovie(rejectingMovie.id, { reason: rejectReason || 'Rejected by platform admin' });
      setSuccessMsg(`Film "${rejectingMovie.title}" has been rejected.`);
      setRejectingMovie(null);
      setRejectReason('');
      await loadMovies();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message || 'Could not reject film.');
    } finally {
      setWorkingId('');
    }
  };

  const handleSuspend = async (movie) => {
    setWorkingId(movie.id);
    setError('');
    setSuccessMsg('');
    try {
      await adminApi.suspendMovie(movie.id, 'Exhibition rights temporarily suspended by super administrator');
      setSuccessMsg(`Film "${movie.title}" public exhibition has been suspended.`);
      await loadMovies();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message || 'Could not suspend film.');
    } finally {
      setWorkingId('');
    }
  };

  const pendingCount = movies.filter(m => m.status === 'PENDING_REVIEW').length;
  const activeCount = movies.filter(m => m.status === 'ACTIVE').length;
  const suspendedCount = movies.filter(m => m.status === 'SUSPENDED').length;

  const filtered = movies.filter(m => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      (m.title || '').toLowerCase().includes(q) ||
      (m.movie_code || '').toLowerCase().includes(q) ||
      (m.provider?.full_name || '').toLowerCase().includes(q) ||
      (m.provider?.organization_name || '').toLowerCase().includes(q) ||
      (m.distributor_name || '').toLowerCase().includes(q) ||
      (m.cbfc_certificate_number || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Rejection Modal */}
      {rejectingMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-[#12151e] border border-[#232938] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-[#ffb4ab]/10 border-[#ffb4ab]/30 text-[#ffb4ab]">
              <XCircle className="w-5 h-5 shrink-0" />
              <span className="font-bold text-sm">Reject Film Registration</span>
            </div>
            <div>
              <p className="text-sm text-[#cbc3d7]">
                You are rejecting the registration for: <strong className="text-white">{rejectingMovie.title}</strong>
              </p>
              <p className="text-xs text-[#958ea0] mt-1">Submitted by: {rejectingMovie.provider?.full_name || 'Provider'}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-[#958ea0]">Reason for rejection (shared with provider)</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Incomplete CBFC certification document, expired distribution rights, unreadable scan..."
                className="w-full bg-[#0d0e12] border border-[#232938] rounded-xl p-3 text-xs text-white placeholder-[#64748b] outline-none focus:border-[#ffb4ab]/60"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                disabled={workingId === rejectingMovie.id}
                onClick={handleRejectConfirm}
                className="flex-1 py-2.5 rounded-xl bg-[#ffb4ab]/20 hover:bg-[#ffb4ab]/30 border border-[#ffb4ab]/40 text-[#ffb4ab] font-bold text-xs font-mono cursor-pointer transition-all"
              >
                {workingId === rejectingMovie.id ? 'Processing…' : 'Confirm Rejection'}
              </button>
              <button
                onClick={() => { setRejectingMovie(null); setRejectReason(''); }}
                className="px-4 py-2.5 rounded-xl bg-[#1a1d26] border border-[#232938] text-[#cbc3d7] text-xs font-mono font-bold cursor-pointer hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pending Authorizations", value: pendingCount, color: "#fbbf24", Icon: Clock, alert: pendingCount > 0 },
          { label: "Authorized & Released", value: activeCount, color: "#4edea3", Icon: BadgeCheck, alert: false },
          { label: "Suspended / Rejected", value: suspendedCount, color: "#ffb4ab", Icon: XCircle, alert: false },
          { label: "Total Films Registered", value: movies.length, color: "#d0bcff", Icon: Film, alert: false },
        ].map(({ label, value, color, Icon, alert }) => (
          <div key={label} className={`bg-[#12151e] border ${alert ? 'border-[#fbbf24]/50 shadow-[0_0_20px_rgba(251,191,36,0.15)]' : 'border-[#232938]'} rounded-2xl p-4 flex items-center gap-3`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <p className="text-[9px] text-[#958ea0] font-mono uppercase tracking-wider">{label}</p>
              <p className="text-xl font-extrabold text-white flex items-center gap-2">
                {value}
                {alert && <span className="w-2 h-2 rounded-full bg-[#fbbf24] animate-ping" />}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Feedback Messages */}
      {error && (
        <div role="alert" className="p-4 rounded-xl border border-[#ffb4ab]/40 bg-[#ffb4ab]/10 text-sm text-[#ffb4ab] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs font-mono underline ml-3">Dismiss</button>
        </div>
      )}
      {successMsg && (
        <div role="status" className="p-4 rounded-xl border border-[#4edea3]/40 bg-[#4edea3]/10 text-sm text-[#4edea3] flex items-center justify-between">
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-xs font-mono underline ml-3">Dismiss</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 flex items-center gap-2 bg-[#0d0e12] border border-[#232938] px-3.5 py-2.5 rounded-xl focus-within:border-[#4edea3]/60 transition-colors">
          <Search className="w-4 h-4 text-[#958ea0]" />
          <input
            type="text"
            placeholder="Search movie title, code, provider name, distributor, CBFC number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-[#494454] outline-none"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'PENDING_REVIEW', label: `Awaiting Authorization (${pendingCount})` },
            { id: 'ACTIVE', label: `Authorized (${activeCount})` },
            { id: 'SUSPENDED', label: `Suspended (${suspendedCount})` },
            { id: 'ALL', label: `All Films (${movies.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${statusFilter === tab.id
                ? 'bg-[#4edea3]/20 text-[#4edea3] border-[#4edea3]/60 shadow-[0_0_12px_rgba(78,222,163,0.15)]'
                : 'bg-[#0d0e12] text-[#958ea0] border-[#232938] hover:border-[#494454]'
                }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={loadMovies}
            className="p-2.5 rounded-xl bg-[#0d0e12] border border-[#232938] text-[#958ea0] hover:text-white transition-colors cursor-pointer"
            title="Refresh film list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Movie Authorizations Table (No Posters, Strictly Tabular) */}
      {loading ? (
        <div className="py-16 text-center text-sm font-mono text-[#958ea0] bg-[#0d0e12] border border-[#232938] rounded-2xl">
          Loading provider films & verification documents…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm font-mono text-[#64748b] bg-[#0d0e12] border border-[#232938] rounded-2xl">
          {search ? 'No films match your search query.' : statusFilter === 'PENDING_REVIEW' ? 'All submitted films have been reviewed! No pending authorizations.' : 'No films in this category.'}
        </div>
      ) : (
        <div className="bg-[#0d0e12] border border-[#232938] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#232938] bg-[#12151e] text-[10px] font-mono font-bold uppercase tracking-wider text-[#958ea0]">
                  <th className="py-3.5 px-4">Movie Title & Code</th>
                  <th className="py-3.5 px-4">Cinema Provider</th>
                  <th className="py-3.5 px-4">Distribution Rights</th>
                  <th className="py-3.5 px-4">Release & Duration</th>
                  <th className="py-3.5 px-4">Attached Documents</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Super Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1d26] text-xs">
                {filtered.map(movie => {
                  const docs = movie.movie_documents || [];
                  const docTypes = new Set(docs.map(d => d.document_type));
                  const hasCBFC = docTypes.has('CBFC_CERTIFICATE') || !!movie.cbfc_certificate_number;
                  const hasDeed = docTypes.has('DISTRIBUTION_DEED') || !!movie.distributor_name;
                  const isPending = movie.status === 'PENDING_REVIEW';
                  const isActive = movie.status === 'ACTIVE';
                  const isSuspended = movie.status === 'SUSPENDED';

                  return (
                    <tr
                      key={movie.id}
                      className={`hover:bg-[#12151e]/80 transition-colors ${isPending ? 'bg-[#fbbf24]/[0.03]' : ''
                        }`}
                    >
                      {/* Movie Title & Code */}
                      <td className="py-4 px-4 align-top">
                        <div className="font-bold text-white text-sm">
                          {movie.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1e1f24] text-[#a078ff] border border-[#292a2e]">
                            {movie.movie_code || 'CODE-TBA'}
                          </span>
                          <span className="text-[10px] font-mono text-[#64748b]">
                            {Array.isArray(movie.languages) ? movie.languages.join(', ') : movie.original_language || 'English'}
                          </span>
                        </div>
                        {movie.director_name && (
                          <p className="text-[10px] text-[#958ea0] mt-1">
                            Dir: <span className="text-[#cbc3d7]">{movie.director_name}</span>
                          </p>
                        )}
                      </td>

                      {/* Cinema Provider */}
                      <td className="py-4 px-4 align-top">
                        <div className="font-semibold text-[#d0bcff]">
                          {movie.provider?.full_name || 'Registered Provider'}
                        </div>
                        <div className="text-[10px] font-mono text-[#64748b] mt-0.5">
                          {movie.provider?.organization_name || movie.provider?.email || 'Exhibitor'}
                        </div>
                      </td>

                      {/* Distribution Rights */}
                      <td className="py-4 px-4 align-top">
                        <div className="font-medium text-white truncate max-w-[150px]" title={movie.distributor_name}>
                          {movie.distributor_name || 'Direct Rights'}
                        </div>
                        <div className="text-[10px] font-mono text-[#64748b] mt-0.5">
                          Formats: {(movie.formats || ['2D']).join(', ')}
                        </div>
                      </td>

                      {/* Release & Duration */}
                      <td className="py-4 px-4 align-top whitespace-nowrap">
                        <div className="text-white font-mono text-xs">
                          {movie.release_date || 'TBA'}
                        </div>
                        <div className="text-[10px] font-mono text-[#958ea0] mt-0.5">
                          {movie.duration_minutes ? `${movie.duration_minutes} min` : '120 min'}
                        </div>
                      </td>

                      {/* Attached Documents */}
                      <td className="py-4 px-4 align-top">
                        {docs.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {docs.map(doc => (
                              <div key={doc.id} className="flex items-center gap-1.5 text-[11px] font-mono">
                                <FileText className="w-3 h-3 text-[#4cd7f6] shrink-0" />
                                <span className="text-[#cbc3d7] truncate max-w-[110px]" title={doc.filename}>
                                  {doc.document_type === 'CBFC_CERTIFICATE' ? 'CBFC' : doc.document_type === 'DISTRIBUTION_DEED' ? 'Deed' : doc.document_type}
                                </span>
                                {doc.review_url ? (
                                  <a
                                    href={doc.review_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-0.5 text-[10px] text-[#4cd7f6] hover:underline shrink-0"
                                  >
                                    <span>View</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                ) : (
                                  <span className="text-[9px] text-[#64748b]">Stored</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-[#fbbf24]">No file attached</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 align-top whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${isPending
                          ? 'bg-[#fbbf24]/15 border-[#fbbf24]/40 text-[#fbbf24] animate-pulse'
                          : isActive
                            ? 'bg-[#4edea3]/15 border-[#4edea3]/40 text-[#4edea3]'
                            : 'bg-[#ffb4ab]/15 border-[#ffb4ab]/40 text-[#ffb4ab]'
                          }`}>
                          {isPending ? '● AWAITING' : isActive ? '✓ APPROVED' : '✕ DENIED'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isPending && (
                            <>
                              <button
                                disabled={workingId === movie.id}
                                onClick={() => handleApprove(movie, true)}
                                title="Approve film & authorize for public viewing"
                                className="px-3 py-1.5 rounded-lg bg-[#4edea3] hover:bg-[#4edea3]/90 text-[#002111] font-bold text-xs font-mono disabled:opacity-50 cursor-pointer transition-all flex items-center gap-1 shadow-[0_0_12px_rgba(78,222,163,0.25)]"
                              >
                                <BadgeCheck className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                disabled={workingId === movie.id}
                                onClick={() => { setRejectingMovie(movie); setRejectReason(''); }}
                                title="Deny / Reject movie submission"
                                className="px-3 py-1.5 rounded-lg bg-[#ffb4ab]/15 hover:bg-[#ffb4ab]/25 border border-[#ffb4ab]/40 text-[#ffb4ab] text-xs font-mono font-bold disabled:opacity-50 cursor-pointer transition-colors"
                              >
                                Deny
                              </button>
                            </>
                          )}

                          {isActive && (
                            <button
                              disabled={workingId === movie.id}
                              onClick={() => handleSuspend(movie)}
                              title="Deny / Suspend film rights"
                              className="px-3 py-1.5 rounded-lg bg-[#ffb4ab]/15 hover:bg-[#ffb4ab]/25 border border-[#ffb4ab]/30 text-[#ffb4ab] text-xs font-mono font-bold disabled:opacity-50 cursor-pointer transition-colors"
                            >
                              Deny Access
                            </button>
                          )}

                          {isSuspended && (
                            <button
                              disabled={workingId === movie.id}
                              onClick={() => handleApprove(movie, true)}
                              title="Re-approve film registration"
                              className="px-3 py-1.5 rounded-lg bg-[#4edea3]/20 hover:bg-[#4edea3]/30 border border-[#4edea3]/50 text-[#4edea3] text-xs font-mono font-bold disabled:opacity-50 cursor-pointer transition-colors"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-[#232938] bg-[#12151e] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] font-mono text-[#64748b]">
            <span>Showing {filtered.length} of {movies.length} registered film titles</span>
            <span className="text-[#a078ff]">Admin approval grants immediate visibility to users in the discovery section</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminRootConsole({ currentUser }) {
  const [activeTab, setActiveTab] = useState("movie_auth");
  const [pendingMovieCount, setPendingMovieCount] = useState(0);

  useEffect(() => {
    adminApi.getPendingMovies().then(res => {
      if (Array.isArray(res)) setPendingMovieCount(res.length);
    }).catch(() => { });
  }, []);

  return (
    <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#d0bcff] to-[#a078ff] flex items-center justify-center shadow-[0_0_24px_rgba(208,188,255,0.4)] flex-shrink-0">
            <Lock className="w-5 h-5 text-[#23005c]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Admin Root Console</h1>
            <p className="text-[11px] font-mono text-[#958ea0]">Super Admin film authorization & regulatory clearance oversight</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#d0bcff]/10 border border-[#d0bcff]/30 text-[#d0bcff] text-[10px] font-mono font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d0bcff] animate-pulse" />
            ROOT ACCESS
          </div>
          {currentUser && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#232938] border border-[#2e3240] text-[#cbc3d7] text-[10px] font-mono">
              <ShieldCheck className="w-3 h-3 text-[#4edea3]" />
              {currentUser.name}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-stretch gap-3 mb-6 flex-wrap">
        {[
          {
            id: "movie_auth",
            label: "Film Authorizations",
            badge: pendingMovieCount > 0 ? `${pendingMovieCount} PENDING` : null,
            badgeAlert: pendingMovieCount > 0,
            Icon: BadgeCheck,
            color: "#4edea3",
            desc: "Verify documents & authorize cinema provider titles"
          },
          {
            id: "shows",
            label: "Shows Overview",
            Icon: Film,
            color: "#d0bcff",
            desc: "All listed shows across the platform"
          },
          {
            id: "providers",
            label: "Provider Management",
            Icon: Shield,
            color: "#4cd7f6",
            desc: "Grant / revoke hall permissions"
          },
          {
            id: "database",
            label: "Database",
            Icon: Database,
            color: "#d0bcff",
            desc: "Provider, user, and movie records"
          },
          {
            id: "settlements",
            label: "Settlements & Escrow",
            Icon: DollarSign,
            color: "#4edea3",
            desc: "Smart escrow disbursement matrix & ledgers"
          },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[220px] flex items-center gap-3 px-5 py-3.5 rounded-2xl border font-semibold cursor-pointer text-left transition-all ${activeTab === tab.id
              ? "bg-[#1a1c28] border-[#a078ff]/60 shadow-[0_0_16px_rgba(160,120,255,0.15)]"
              : "bg-[#0d0e12] border-[#232938] hover:border-[#494454]"
              }`}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: activeTab === tab.id ? `${tab.color}20` : "#1a1d26",
                border: `1px solid ${activeTab === tab.id ? tab.color + "40" : "#232938"}`
              }}
            >
              <tab.Icon style={{ color: activeTab === tab.id ? tab.color : "#494454", width: 18, height: 18 }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-bold truncate ${activeTab === tab.id ? "text-white" : "text-[#958ea0]"}`}>
                  {tab.label}
                </p>
                {tab.badge && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fbbf24] text-[9px] font-mono font-bold animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>
              <p className={`text-[10px] font-mono truncate ${activeTab === tab.id ? "text-[#958ea0]" : "text-[#494454]"}`}>
                {tab.desc}
              </p>
            </div>
          </button>
        ))}
      </div>

      {activeTab === "movie_auth" && <MovieAuthorizationsTab onPendingCountChange={setPendingMovieCount} />}
      {activeTab === "shows" && <ShowsOverviewTab />}
      {activeTab === "providers" && <ProviderManagementTab />}
      {activeTab === "database" && <DatabaseTab />}
      {activeTab === "settlements" && <SettlementsView />}
    </div>
  );
}
