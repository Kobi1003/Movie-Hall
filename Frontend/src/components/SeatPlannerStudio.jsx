import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Plus, 
  Save, 
  RotateCcw, 
  Tv, 
  Armchair, 
  Sparkles, 
  Layers, 
  Accessibility, 
  DollarSign,
  CheckCircle2,
  Trash2,
  Eye,
  Building2,
  AlertCircle
} from 'lucide-react';
import { INITIAL_SEAT_TIERS } from '../data/mockData';
import { seatPlansApi, cinemasApi } from '../api.js';

export default function SeatPlannerStudio() {
  const [screens, setScreens] = useState([]);
  const [selectedScreenId, setSelectedScreenId] = useState('');
  const [selectedHall, setSelectedHall] = useState('Auditorium Screen');
  const [activeTier, setActiveTier] = useState('vip');
  const [screenCurvature, setScreenCurvature] = useState(60);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Studio Grid representation
  const [tiers, setTiers] = useState(INITIAL_SEAT_TIERS);

  // Custom rows definition
  const [rows, setRows] = useState([
    { name: 'A', tier: 'recliner', seats: [1, 2, 3, 4, 5, 6, 7, 8] },
    { name: 'B', tier: 'vip', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { name: 'C', tier: 'vip', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { name: 'D', tier: 'vip', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { name: 'E', tier: 'premium', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { name: 'F', tier: 'premium', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { name: 'G', tier: 'premium', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { name: 'H', tier: 'premium', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { name: 'J', tier: 'classic', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  ]);

  // Load screens on mount
  useEffect(() => {
    let cancelled = false;
    cinemasApi.screens().then((res) => {
      if (cancelled) return;
      const list = Array.isArray(res) ? res : [];
      setScreens(list);
      if (list.length > 0) {
        setSelectedScreenId(list[0].id);
        setSelectedHall(list[0].screen_name || list[0].screenName || 'Auditorium Screen');
      }
    }).catch(err => {
      console.warn('Could not load cinema screens:', err.message);
    });
    return () => { cancelled = true; };
  }, []);

  // Load layout for selected screen
  useEffect(() => {
    if (!selectedScreenId) return;
    let cancelled = false;
    setLoading(true);
    setFeedback(null);

    const screenObj = screens.find(s => s.id === selectedScreenId);
    if (screenObj) {
      setSelectedHall(screenObj.screen_name || screenObj.screenName || 'Auditorium Screen');
    }

    seatPlansApi.getByScreen(selectedScreenId).then((plan) => {
      if (cancelled) return;
      if (plan?.seats?.length) {
        // Group seats by row
        const rowMap = new Map();
        for (const s of plan.seats) {
          const rLabel = s.row_label || s.row || 'A';
          if (!rowMap.has(rLabel)) {
            let t = 'classic';
            const cat = (s.categoryName || s.seat_type || '').toLowerCase();
            if (cat.includes('reclin')) t = 'recliner';
            else if (cat.includes('vip')) t = 'vip';
            else if (cat.includes('prem')) t = 'premium';
            rowMap.set(rLabel, { name: rLabel, tier: t, seats: [] });
          }
          rowMap.get(rLabel).seats.push(Number(s.seat_number || s.number || 1));
        }

        const formattedRows = Array.from(rowMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        formattedRows.forEach(r => r.seats.sort((a, b) => a - b));
        if (formattedRows.length > 0) setRows(formattedRows);

        // Update category prices if present
        if (plan.categories?.length) {
          setTiers(prev => prev.map(t => {
            const matched = plan.categories.find(c => {
              const cn = (c.name || c.display_name || '').toLowerCase();
              return cn.includes(t.id) || (t.id === 'classic' && cn.includes('stand'));
            });
            return matched ? { ...t, price: Number(matched.base_price || t.price) } : t;
          }));
        }
      }
    }).catch(err => {
      console.warn('Could not fetch screen plan:', err.message);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [selectedScreenId, screens]);

  const toggleRowTier = (rowName) => {
    setRows(prev => prev.map(r => {
      if (r.name === rowName) {
        return { ...r, tier: activeTier };
      }
      return r;
    }));
  };

  const updateTierPrice = (tierId, newPrice) => {
    setTiers(prev => prev.map(t => t.id === tierId ? { ...t, price: Number(newPrice) } : t));
  };

  const totalSeatsCount = rows.reduce((acc, r) => acc + r.seats.length, 0);
  const potentialYield = rows.reduce((acc, r) => {
    const tierObj = tiers.find(t => t.id === r.tier);
    return acc + (r.seats.length * (tierObj ? tierObj.price : 350));
  }, 0);

  const handleSave = async () => {
    if (!selectedScreenId) {
      alert('Please select an active screen first.');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const layoutData = {
        name: selectedHall,
        canvasWidth: 1200,
        canvasHeight: 800,
        screenPosition: 'TOP',
        categories: tiers.map(t => ({
          name: t.name,
          displayName: t.name,
          basePrice: t.price,
          seatType: (t.id === 'classic' ? 'STANDARD' : t.id).toUpperCase()
        })),
        sections: [{ name: 'Main Hall', displayName: 'Main Auditorium', sortOrder: 0 }],
        seats: rows.flatMap((r, rIdx) => 
          r.seats.map((seatNum, sIdx) => {
            const tierObj = tiers.find(t => t.id === r.tier) || tiers[0];
            return {
              rowLabel: r.name,
              seatNumber: seatNum,
              categoryName: tierObj.name,
              sectionName: 'Main Hall',
              seatType: (tierObj.id === 'classic' ? 'STANDARD' : tierObj.id).toUpperCase(),
              xPosition: 100 + sIdx * 50,
              yPosition: 120 + rIdx * 50,
              width: 32,
              height: 32
            };
          })
        )
      };

      const result = await seatPlansApi.save(selectedScreenId, layoutData);
      // Auto-publish the saved plan so it is immediately active for shows and booking in Supabase
      if (result?.version?.id) {
        await seatPlansApi.publish(selectedScreenId, result.version.id);
      }
      setIsSaved(true);
      setFeedback({
        type: 'success',
        message: `Auditorium seat plan (${totalSeatsCount} seats) successfully saved & published to Supabase for ${selectedHall}!`
      });
      setTimeout(() => setIsSaved(false), 3500);
    } catch (e) {
      console.warn('Seat plan backend save error:', e.message);
      setFeedback({
        type: 'error',
        message: `Failed to save seat plan: ${e.message}`
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Studio Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#232938]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#a078ff] animate-pulse"></span>
            <span className="text-[11px] font-mono uppercase text-[#a078ff] font-bold">Cinema Studio Matrix 4.0</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Auditorium Visual Seat Planner</h1>
          <p className="text-xs text-[#94a3b8] font-mono mt-0.5">Design seat tiers, aisle spacing, recliner configurations, and tier pricing models for Supabase synchronization.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setRows([
                { name: 'A', tier: 'recliner', seats: [1, 2, 3, 4, 5, 6, 7, 8] },
                { name: 'B', tier: 'vip', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
                { name: 'C', tier: 'vip', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
                { name: 'D', tier: 'vip', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
                { name: 'E', tier: 'premium', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
                { name: 'F', tier: 'premium', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
                { name: 'G', tier: 'premium', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
                { name: 'H', tier: 'premium', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
                { name: 'J', tier: 'classic', seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
              ]);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#181c26] hover:bg-[#292a2e] text-xs font-mono text-[#cbc3d7] border border-[#232938] flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Layout
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#6d3bd7] text-white text-xs font-bold font-mono flex items-center gap-2 shadow-[0_0_20px_rgba(160,120,255,0.4)] hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
          >
            {saving ? (
              <span>Saving to Supabase…</span>
            ) : isSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#4edea3]" />
                <span>Saved & Published!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Deploy & Save to Supabase</span>
              </>
            )}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center gap-2.5 text-xs font-mono ${
          feedback.type === 'success' 
            ? 'bg-[#4edea3]/10 border-[#4edea3]/30 text-[#4edea3]' 
            : 'bg-[#ffb4ab]/10 border-[#ffb4ab]/30 text-[#ffb4ab]'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Grid: Tools + Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Toolbar / Configurator (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Hall Selection & Quick Stats */}
          <div className="p-4 rounded-2xl bg-[#12151e] border border-[#232938] flex flex-col gap-3">
            <span className="text-[11px] font-mono uppercase font-bold text-[#958ea0]">Target Auditorium Screen</span>
            {screens.length > 0 ? (
              <select
                value={selectedScreenId}
                onChange={(e) => setSelectedScreenId(e.target.value)}
                className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none cursor-pointer focus:border-[#a078ff]"
              >
                {screens.map(scr => (
                  <option key={scr.id} value={scr.id} className="bg-[#12151e]">
                    {scr.screen_name || scr.screenName || 'Screen'} ({scr.capacity || 80} seats)
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs font-mono text-[#94a3b8] p-2 bg-[#0d0e12] rounded-xl border border-[#232938]">
                Loading verified screens…
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#232938] text-xs font-mono">
              <div className="p-2 rounded-lg bg-[#0d0e12]">
                <span className="text-[#958ea0] block text-[10px]">Total Capacity</span>
                <span className="text-white font-bold text-base">{totalSeatsCount} Seats</span>
              </div>
              <div className="p-2 rounded-lg bg-[#0d0e12]">
                <span className="text-[#958ea0] block text-[10px]">Full House Yield</span>
                <span className="text-[#4edea3] font-bold text-base">₹{potentialYield.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Seat Tier Painter Brush */}
          <div className="p-4 rounded-2xl bg-[#12151e] border border-[#232938] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold text-[#958ea0]">Active Painter Tier</span>
              <span className="text-[10px] font-mono text-[#a078ff]">Click any row to apply</span>
            </div>

            <div className="space-y-2">
              {tiers.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setActiveTier(t.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    activeTier === t.id
                      ? 'bg-[#181c26] border-[#8b5cf6] shadow-[0_0_16px_rgba(139,92,246,0.3)]'
                      : 'bg-[#0d0e12] border-[#232938] hover:border-[#494454]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span 
                      className="w-4 h-4 rounded-md flex items-center justify-center text-[10px]"
                      style={{ backgroundColor: t.color, color: '#120038' }}
                    >
                      ✓
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">{t.name}</h4>
                      <span className="text-[10px] text-[#94a3b8]">{t.desc}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono text-[#94a3b8]">₹</span>
                    <input
                      type="number"
                      value={t.price}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateTierPrice(t.id, e.target.value)}
                      className="w-16 bg-[#181c26] border border-[#232938] rounded px-1.5 py-0.5 text-xs font-mono font-bold text-white text-right outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Screen Curvature Adjuster */}
          <div className="p-4 rounded-2xl bg-[#12151e] border border-[#232938] flex flex-col gap-2 text-xs font-mono">
            <div className="flex items-center justify-between text-[#94a3b8]">
              <span>Projection Screen Arc Curvature</span>
              <span className="text-white font-bold">{screenCurvature}°</span>
            </div>
            <input
              type="range"
              min="20"
              max="90"
              value={screenCurvature}
              onChange={(e) => setScreenCurvature(Number(e.target.value))}
              className="w-full accent-[#a078ff] cursor-pointer"
            />
          </div>

        </div>

        {/* Right Canvas: Live Visual Editor (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          <div className="p-6 rounded-2xl bg-[#0d0e12] border border-[#232938] flex flex-col items-center shadow-2xl relative min-h-[500px]">
            
            {loading && (
              <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-2xl text-xs font-mono text-[#d0bcff]">
                Fetching auditorium layout from Supabase…
              </div>
            )}

            {/* Screen Projection Curvature */}
            <div className="w-full flex flex-col items-center pt-2 pb-8 relative">
              <div 
                className="w-11/12 max-w-lg h-3 rounded-[50%] bg-gradient-to-r from-transparent via-[#4cd7f6] to-transparent shadow-[0_0_28px_rgba(76,215,246,0.8)] mb-2"
                style={{ transform: `scaleX(${screenCurvature / 50})` }}
              ></div>
              <div className="text-[11px] font-mono text-[#4cd7f6] uppercase tracking-widest flex items-center gap-2">
                <Tv className="w-3.5 h-3.5" />
                VIRTUAL PROJECTION AXIS • {selectedHall}
              </div>
            </div>

            {/* Interactive Rows Editor Canvas */}
            <div className="w-full flex flex-col items-center gap-3 overflow-x-auto py-4">
              {rows.map((row) => {
                const tierInfo = tiers.find(t => t.id === row.tier) || tiers[0];
                return (
                  <div key={row.name} className="flex items-center gap-3 group">
                    <button
                      onClick={() => toggleRowTier(row.name)}
                      className="w-6 text-center font-mono font-bold text-xs text-[#d0bcff] hover:text-[#4cd7f6] cursor-pointer"
                      title="Click to apply active painter tier"
                    >
                      {row.name}
                    </button>

                    <div 
                      onClick={() => toggleRowTier(row.name)}
                      className="flex items-center gap-1.5 p-1.5 rounded-xl border transition-all cursor-pointer"
                      style={{ 
                        borderColor: `${tierInfo.color}40`,
                        backgroundColor: `${tierInfo.color}10`
                      }}
                      title={`Row ${row.name} (${tierInfo.name} — ₹${tierInfo.price}) - Click to paint`}
                    >
                      {row.seats.map((num) => (
                        <div
                          key={num}
                          className="w-6 h-6 rounded flex items-center justify-center font-mono text-[10px] font-bold text-white shadow-sm"
                          style={{ backgroundColor: tierInfo.color, color: '#120038' }}
                        >
                          {num}
                        </div>
                      ))}
                    </div>

                    <span className="text-[10px] font-mono text-[#958ea0] w-20">
                      ₹{tierInfo.price} / seat
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Hint message */}
            <div className="mt-6 pt-4 border-t border-[#232938] w-full text-center text-xs font-mono text-[#94a3b8]">
              💡 Tip: Click any row on the canvas to paint it with the active tier ({tiers.find(t => t.id === activeTier)?.name}). Changes are automatically published to Supabase upon clicking Deploy.
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
