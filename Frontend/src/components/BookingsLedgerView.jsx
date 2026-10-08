import { useEffect, useRef, useState } from 'react';
import { 
  Search, 
  QrCode, 
  CheckCircle, 
  XCircle, 
  ShieldCheck,
  Camera
} from 'lucide-react';
import { adminApi } from '../api.js';

export default function BookingsLedgerView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanCodeInput, setScanCodeInput] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  useEffect(() => {
    if (!scannerOpen || !cameraActive) return undefined;
    if (!('BarcodeDetector' in window)) {
      setCameraError('QR camera scanning is not supported by this browser. Enter the ticket number below.');
      stopCamera();
      return undefined;
    }
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    let running = true;
    let frameId;
    let detecting = false;
    const scanFrame = async () => {
      const video = videoRef.current;
      if (running && video?.readyState >= 2 && !detecting) {
        detecting = true;
        try {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue) {
            setScanCodeInput(codes[0].rawValue);
            running = false;
            stopCamera();
          }
        } catch { setCameraError('Could not read that QR code. Try again or enter the ticket number.'); }
        detecting = false;
      }
      if (running) frameId = window.requestAnimationFrame(scanFrame);
    };
    scanFrame();
    return () => { running = false; window.cancelAnimationFrame(frameId); };
  }, [scannerOpen, cameraActive]);

  useEffect(() => () => streamRef.current?.getTracks().forEach(track => track.stop()), []);

  const startCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is unavailable. Enter the ticket number below.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError('Camera permission was denied or no camera is available. Enter the ticket number below.');
    }
  };

  const [bookings, setBookings] = useState([]);
  useEffect(() => {
    adminApi.getBookings().then(rows => setBookings((rows || []).map(b => ({
      bookingId: b.booking_reference || b.id, movieTitle: b.movies?.title || '—', format: b.shows?.format || '—',
      theatre: b.cinemas?.cinema_name || '—', screen: b.screens?.screen_name || '—',
      date: b.shows?.show_date || '—', time: b.shows?.start_time || '—',
      seats: (b.booking_seats || []).map(s => s.seat_label), totalAmount: Number(b.total_amount || 0),
      status: b.tickets?.some(t => t.status === 'USED') ? 'CHECKED_IN' : b.status,
      customerName: b.profiles?.full_name || '—', securityCode: b.tickets?.[0]?.security_code || '',
      ticketNumber: b.tickets?.[0]?.ticket_number || '', ticketStatus: b.tickets?.[0]?.status || ''
    })))).catch(err => console.error('Could not load bookings:', err));
  }, []);

  const handleValidateCode = async () => {
    const code = scanCodeInput.trim();
    try {
      const ticket = await adminApi.checkInTicket(code);
      const found = bookings.find(b => b.ticketNumber === ticket.ticket_number || b.securityCode === ticket.security_code);
      setScanResult({
        success: true,
        booking: found,
        message: `Ticket checked in successfully${found ? `: ${found.movieTitle} — Seats: ${found.seats.join(', ')}` : ''}.`
      });
      setBookings(prev => prev.map(b => b.ticketNumber === ticket.ticket_number || b.securityCode === ticket.security_code ? { ...b, status: 'CHECKED_IN', ticketStatus: 'USED' } : b));
    } catch (err) {
      setScanResult({
        success: false,
        message: err.message || 'Ticket could not be checked in.'
      });
    }
  };

  const filteredBookings = bookings.filter(b => 
    b.bookingId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.movieTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.customerName && b.customerName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="w-full flex flex-col pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Admin Authority Banner */}
      <div className="mb-4 px-4 py-2 rounded-xl bg-[#201833] border border-[#d0bcff]/40 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-[#d0bcff]">
          <ShieldCheck className="w-4 h-4 text-[#4edea3]" />
          <span className="font-bold">ADMIN ROOT CONSOLE:</span>
          <span className="text-[#e3e2e8]">Turnstile QR Scanner & Master Ticket Auditing Authority</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[#958ea0]">
          <span>Security Clearance: <strong className="text-[#4edea3]">SUPERUSER_ROOT</strong></span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Check-in Terminal: <strong className="text-[#4cd7f6]">ONLINE</strong></span>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#232938]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#4cd7f6] animate-pulse"></span>
            <span className="text-[11px] font-mono uppercase text-[#4cd7f6] font-bold">Box Office Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Bookings & Occupancy Ledger</h1>
          <p className="text-xs text-[#94a3b8] font-mono mt-0.5">Real-time ticket validation, QR scanner verification, and customer check-in logs.</p>
        </div>

        <button
          onClick={() => setScannerOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] text-white font-bold text-xs font-mono shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:brightness-110 flex items-center gap-2 cursor-pointer"
        >
          <QrCode className="w-4 h-4" />
          <span>Launch QR Scanner Simulator</span>
        </button>
      </div>

      {/* Quick Search & Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[#12151e] border border-[#232938]">
          <span className="text-[#958ea0] text-xs font-mono block">Total Bookings Today</span>
          <span className="text-2xl font-bold font-mono text-white mt-1 block">{bookings.length}</span>
        </div>
        <div className="p-4 rounded-xl bg-[#12151e] border border-[#232938]">
          <span className="text-[#958ea0] text-xs font-mono block">Checked-In Attendees</span>
          <span className="text-2xl font-bold font-mono text-[#4edea3] mt-1 block">
            {bookings.filter(b => b.status === 'CHECKED_IN').length}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-[#12151e] border border-[#232938]">
          <span className="text-[#958ea0] text-xs font-mono block">Active Holds / Awaiting Check-In</span>
          <span className="text-2xl font-bold font-mono text-[#4cd7f6] mt-1 block">
            {bookings.filter(b => b.ticketStatus === 'VALID').length}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-[#12151e] border border-[#232938]">
          <span className="text-[#958ea0] text-xs font-mono block">Gross Revenue Logged</span>
          <span className="text-2xl font-bold font-mono text-[#d0bcff] mt-1 block">
            ₹{bookings.reduce((acc, b) => acc + (b.totalAmount || 0), 0).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 bg-[#12151e] border border-[#232938] px-4 py-2 rounded-xl focus-within:border-[#8b5cf6]">
          <Search className="w-4 h-4 text-[#958ea0]" />
          <input
            type="text"
            placeholder="Search booking code (TXR-...), movie, or customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs font-mono text-white placeholder-[#64748b] outline-none w-full"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="p-6 rounded-2xl bg-[#12151e] border border-[#232938] shadow-2xl overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-[#232938] text-[#958ea0]">
              <th className="pb-3">Booking ID</th>
              <th className="pb-3">Movie & Hall</th>
              <th className="pb-3">Showtime</th>
              <th className="pb-3">Seats</th>
              <th className="pb-3">Security Code</th>
              <th className="pb-3">Amount</th>
              <th className="pb-3">Check-in Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#232938]/60">
            {filteredBookings.map((b) => (
              <tr key={b.bookingId} className="hover:bg-[#181c26]/60 transition-colors">
                <td className="py-3.5 font-bold text-[#d0bcff]">{b.bookingId}</td>
                <td className="py-3.5 text-white">
                  <div>{b.movieTitle}</div>
                  <span className="text-[10px] text-[#94a3b8]">{b.theatre} • {b.screen}</span>
                </td>
                <td className="py-3.5 text-[#cbc3d7]">{b.date} • {b.time}</td>
                <td className="py-3.5">
                  <div className="flex flex-wrap gap-1">
                    {b.seats.map((seat, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-[#1e1f24] text-[#4cd7f6] text-[10px] font-bold border border-[#292a2e]">
                        {seat}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3.5 text-[#958ea0]">{b.securityCode || '—'}</td>
                <td className="py-3.5 font-bold text-white">₹{b.totalAmount}</td>
                <td className="py-3.5">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    b.status === 'CHECKED_IN'
                      ? 'bg-[#4edea3]/15 text-[#4edea3] border border-[#4edea3]/30'
                      : 'bg-[#4cd7f6]/15 text-[#4cd7f6] border border-[#4cd7f6]/30'
                  }`}>
                    {b.status === 'CHECKED_IN' ? '✓ CHECKED IN' : 'CONFIRMED / PENDING'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* QR SCANNER SIMULATOR MODAL */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#181c26] border border-[#232938] rounded-2xl p-6 shadow-2xl relative flex flex-col gap-4">
            <button 
              onClick={() => { stopCamera(); setScannerOpen(false); setScanResult(null); }}
              className="absolute top-4 right-4 text-[#958ea0] hover:text-white text-sm font-bold bg-[#292a2e] w-8 h-8 rounded-full flex items-center justify-center"
            >
              ✕
            </button>

            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#8b5cf6]" />
              <h3 className="text-base font-bold text-white">Auditorium Entry QR Scanner</h3>
            </div>

            {/* Visual Scanner Viewfinder */}
            <div className="w-full h-48 rounded-xl bg-[#0d0e12] border-2 border-dashed border-[#8b5cf6]/60 flex flex-col items-center justify-center relative overflow-hidden">
              <video ref={videoRef} className={`w-full h-full object-cover ${cameraActive ? '' : 'hidden'}`} playsInline muted />
              {!cameraActive && <><QrCode className="w-16 h-16 text-[#494454] opacity-50" /><span className="text-[11px] font-mono text-[#94a3b8] mt-2">Use the camera or enter the ticket number</span></>}
            </div>
            <button type="button" onClick={cameraActive ? stopCamera : startCamera} className="self-start px-3 py-2 rounded-lg bg-[#232938] text-white text-xs font-mono">
              {cameraActive ? 'Stop camera' : 'Scan QR with camera'}
            </button>
            {cameraError && <p role="alert" className="text-xs text-[#ffb4ab]">{cameraError}</p>}

            {/* Quick Test Autofill buttons */}
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              <span className="text-[10px] font-mono text-[#958ea0]">Ticket numbers:</span>
              {bookings.slice(0, 3).map(b => (
                <button
                  key={b.bookingId}
                  onClick={() => setScanCodeInput(b.ticketNumber)}
                  className="px-2 py-1 rounded bg-[#1e1f24] hover:bg-[#292a2e] text-[10px] font-mono text-[#d0bcff] border border-[#292a2e]"
                >
                  {b.ticketNumber}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ticket number, security code, or decoded QR content"
                value={scanCodeInput}
                onChange={(e) => setScanCodeInput(e.target.value)}
                className="flex-1 bg-[#0d0e12] border border-[#232938] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-[#8b5cf6]"
              />
              <button
                onClick={handleValidateCode}
                className="px-4 py-2 rounded-xl bg-[#a078ff] text-[#120038] font-bold text-xs font-mono hover:bg-[#d0bcff]"
              >
                Validate Pass
              </button>
            </div>

            {scanResult && (
              <div className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2 ${
                scanResult.success ? 'bg-[#00a572]/20 border-[#00a572] text-[#4edea3]' : 'bg-[#ffb4ab]/10 border-[#ffb4ab]/30 text-[#ffb4ab]'
              }`}>
                {scanResult.success ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>{scanResult.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
