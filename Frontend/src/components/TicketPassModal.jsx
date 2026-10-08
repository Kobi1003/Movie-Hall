import { 
  X, 
  Download, 
  Printer, 
  MapPin, 
  ShieldCheck, 
  UtensilsCrossed,
  Sparkles
} from 'lucide-react';

export default function TicketPassModal({ 
  booking, 
  onClose,
  onBookAnother
}) {
  if (!booking) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-[#12151e] border border-[#232938] rounded-3xl p-6 sm:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.95)] relative flex flex-col gap-6 my-8">
        
        {/* Close */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 text-[#958ea0] hover:text-white text-sm font-bold bg-[#1a1b20] hover:bg-[#292a2e] w-8 h-8 rounded-full flex items-center justify-center border border-[#232938]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Notification */}
        <div className="flex items-center gap-2 text-[#4edea3] text-xs font-mono">
          <Sparkles className="w-4 h-4" />
          <span className="font-bold">SEATS SECURED & VERIFIED</span>
          <span className="text-[#94a3b8]">• Instant Turnstile Pass</span>
        </div>

        {/* Boarding Pass Container */}
        <div className="rounded-2xl bg-[#0d0e12] border border-[#232938] overflow-hidden shadow-2xl flex flex-col">
          
          {/* Upper Header: Movie & Format */}
          <div className="p-6 bg-gradient-to-r from-[#181c26] via-[#12151e] to-[#0d0e12] border-b border-[#232938] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-[#4cd7f6]/15 text-[#4cd7f6] text-[10px] font-mono font-bold border border-[#4cd7f6]/30">
                {booking.format}
              </span>
              <span className="text-xs font-mono text-[#d0bcff] font-bold">{booking.bookingId}</span>
            </div>
            
            <h2 className="text-2xl font-extrabold text-white">{booking.movieTitle}</h2>
            
            <div className="flex items-center gap-1.5 text-xs text-[#94a3b8] font-mono">
              <MapPin className="w-3.5 h-3.5 text-[#4cd7f6]" />
              <span>{booking.theatre} • {booking.screen}</span>
            </div>
          </div>

          {/* Middle Information Grid */}
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono border-b border-dashed border-[#232938]">
            <div>
              <span className="text-[10px] text-[#958ea0] block">Date</span>
              <span className="text-white font-bold">{booking.date}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#958ea0] block">Showtime</span>
              <span className="text-white font-bold">{booking.time}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#958ea0] block">Assigned Seats</span>
              <span className="text-[#d0bcff] font-bold text-sm">{booking.seats?.join(', ')}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#958ea0] block">Turnstile Gate</span>
              <span className="text-[#4edea3] font-bold">{booking.gate || 'Gate 4'}</span>
            </div>
          </div>

          {/* In-Seat Food Tokens */}
          {booking.foodItems && booking.foodItems.length > 0 && (
            <div className="px-6 py-3 bg-[#12151e] border-b border-[#232938] flex items-center gap-2 text-xs font-mono text-[#cbc3d7]">
              <UtensilsCrossed className="w-4 h-4 text-[#d0bcff]" />
              <span>F&B In-Seat Delivery: {booking.foodItems.map(f => `${f.name} (x${f.qty})`).join(', ')}</span>
            </div>
          )}

          {/* Lower QR Code Area */}
          <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6 bg-[#08090d]">
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-1">
              <span className="text-[10px] font-mono uppercase text-[#958ea0]">Digital Security Key</span>
              <span className="text-lg font-mono font-extrabold text-white tracking-widest">{booking.securityCode || 'SEC-8902'}</span>
              <span className="text-[11px] font-mono text-[#4edea3] flex items-center gap-1 mt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Live Sensor Verified
              </span>
            </div>

            <div className="p-3 bg-white rounded-2xl shadow-xl flex flex-col items-center">
              <img 
                src={booking.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${booking.bookingId}`} 
                alt="Ticket QR Code" 
                className="w-32 h-32 object-contain"
              />
              <span className="text-[9px] font-mono text-black font-bold mt-1 tracking-wider">TIXORA PASS</span>
            </div>
          </div>

        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-[#1a1b20] hover:bg-[#292a2e] text-xs font-mono text-white border border-[#232938] flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Pass
            </button>
            <button
              onClick={() => alert('Digital Wallet Pass file exported to your device!')}
              className="px-4 py-2 rounded-xl bg-[#1a1b20] hover:bg-[#292a2e] text-xs font-mono text-white border border-[#232938] flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Save to Wallet
            </button>
          </div>

          <button
            onClick={() => {
              onClose();
              if (onBookAnother) onBookAnother();
            }}
            className="px-5 py-2.5 rounded-xl bg-[#a078ff] text-[#120038] font-bold text-xs font-mono hover:bg-[#d0bcff] transition-all cursor-pointer"
          >
            Done / Close
          </button>
        </div>

      </div>
    </div>
  );
}
