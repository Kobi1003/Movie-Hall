import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PartnerWorkflowBar, { PartnerStepFooter, WorkflowLockedGate } from './PartnerWorkflowBar';
import { setPartnerUnlockedStep } from '../utils/workflow';
import { 
  Sliders, 
  Plus, 
  Minus,
  Save, 
  RotateCcw, 
  Tv, 
  Armchair, 
  Sparkles, 
  Layers, 
  DollarSign,
  CheckCircle2,
  Trash2,
  Building2,
  AlertCircle,
  Users
} from 'lucide-react';
import { INITIAL_SEAT_TIERS } from '../data/mockData';
import { seatPlansApi, cinemasApi } from '../api.js';

// Helper to convert row index to alphabet (A, B, C... Z, AA, AB...)
function getRowLabel(index) {
  let label = '';
  let num = index;
  while (num >= 0) {
    label = String.fromCharCode((num % 26) + 65) + label;
    num = Math.floor(num / 26) - 1;
  }
  return label;
}

export default function SeatPlannerStudio() {
  const navigate = useNavigate();
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
      } else {
        cinemasApi.createScreen({
          screenName: 'Audi 1 - Main Auditorium',
          screenNumber: 1,
          screenType: 'STANDARD',
          capacity: 100,
          projectionType: 'Laser 4K',
          audioFormat: 'Dolby Atmos',
          supportedFormats: ['2D', '3D'],
          isActive: true
        }).then(newScr => {
          if (!cancelled && newScr?.id) {
            setScreens([newScr]);
            setSelectedScreenId(newScr.id);
            setSelectedHall(newScr.screen_name || 'Audi 1 - Main Auditorium');
          }
        }).catch(() => {});
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

  // ─── Seat Controls: Increase / Decrease Seats per Row ──────────────────────
  const addSeatToRow = (rowIndex) => {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== rowIndex) return r;
      const nextNum = r.seats.length > 0 ? Math.max(...r.seats) + 1 : 1;
      return {
        ...r,
        seats: [...r.seats, nextNum]
      };
    }));
  };

  const removeSeatFromRow = (rowIndex) => {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== rowIndex) return r;
      if (r.seats.length <= 1) return r; // preserve at least 1 seat in row
      return {
        ...r,
        seats: r.seats.slice(0, -1)
      };
    }));
  };

  // ─── Row Controls: Increase / Decrease Rows ────────────────────────────────
  const addRow = (insertAfterIndex = null) => {
    setRows(prev => {
      const defaultSeatCount = 10;
      const newSeats = Array.from({ length: defaultSeatCount }, (_, i) => i + 1);
      const newRow = {
        name: '',
        tier: activeTier || 'premium',
        seats: newSeats
      };

      let updated;
      if (insertAfterIndex === null || insertAfterIndex >= prev.length - 1) {
        updated = [...prev, newRow];
      } else {
        updated = [
          ...prev.slice(0, insertAfterIndex + 1),
          newRow,
          ...prev.slice(insertAfterIndex + 1)
        ];
      }
      return updated.map((r, i) => ({ ...r, name: getRowLabel(i) }));
    });
  };

  const removeRow = (rowIndex) => {
    setRows(prev => {
      if (prev.length <= 1) return prev; // preserve at least 1 row in auditorium
      const updated = prev.filter((_, idx) => idx !== rowIndex);
      return updated.map((r, i) => ({ ...r, name: getRowLabel(i) }));
    });
  };

  // ─── Tier & Price Handlers ──────────────────────────────────────────────────
  const toggleRowTier = (rowName, explicitTier = null) => {
    setRows(prev => prev.map(r => {
      if (r.name === rowName) {
        return { ...r, tier: explicitTier || activeTier };
      }
      return r;
    }));
  };

  const updateTierPrice = (tierId, newPrice) => {
    const parsed = Math.max(0, Number(newPrice) || 0);
    setTiers(prev => prev.map(t => t.id === tierId ? { ...t, price: parsed } : t));
  };

  // ─── Real-Time Dynamic Totals ──────────────────────────────────────────────
  const totalSeatsCount = useMemo(() => {
    return rows.reduce((acc, r) => acc + r.seats.length, 0);
  }, [rows]);

  const totalTheatreCost = useMemo(() => {
    return rows.reduce((acc, r) => {
      const tierObj = tiers.find(t => t.id === r.tier) || tiers[0];
      return acc + (r.seats.length * (tierObj ? tierObj.price : 350));
    }, 0);
  }, [rows, tiers]);

  const avgSeatPrice = useMemo(() => {
    return totalSeatsCount > 0 ? Math.round(totalTheatreCost / totalSeatsCount) : 0;
  }, [totalTheatreCost, totalSeatsCount]);

  // Breakdown by tier
  const tierBreakdown = useMemo(() => {
    return tiers.map(t => {
      const tierRows = rows.filter(r => r.tier === t.id);
      const seatsInTier = tierRows.reduce((acc, r) => acc + r.seats.length, 0);
      const costInTier = seatsInTier * t.price;
      return {
        ...t,
        seatsCount: seatsInTier,
        totalCost: costInTier
      };
    });
  }, [rows, tiers]);

  // ─── Deploy and Save to Supabase ───────────────────────────────────────────
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
        canvasHeight: Math.max(800, rows.length * 65 + 200),
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
              xPosition: 100 + sIdx * 48,
              yPosition: 120 + rIdx * 55,
              width: 32,
              height: 32
            };
          })
        )
      };

      const result = await seatPlansApi.save(selectedScreenId, layoutData);
      if (result?.version?.id) {
        await seatPlansApi.publish(selectedScreenId, result.version.id);
      }
      setPartnerUnlockedStep(3);
      setIsSaved(true);
      setFeedback({
        type: 'success',
        message: `Auditorium seat plan successfully uploaded and published! Total seats: ${totalSeatsCount} • Total Theatre Cost: ₹${totalTheatreCost.toLocaleString()}. Customers can now book tickets on this screen once shows are scheduled.`
      });
      setTimeout(() => setIsSaved(false), 4500);
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
      {/* 5-Step Pipeline Navigation Header */}
      <PartnerWorkflowBar currentStep={2} />
      
      <WorkflowLockedGate stepNumber={2}>
        {/* Studio Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#232938]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#a078ff] animate-pulse"></span>
            <span className="text-[11px] font-mono uppercase text-[#a078ff] font-bold">Cinema Provider Seat Matrix</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Auditorium Seat & Cost Controller</h1>
          <p className="text-xs text-[#94a3b8] font-mono mt-0.5">
            Use the <strong className="text-white">+</strong> and <strong className="text-white">-</strong> controls on each row to adjust row counts and seats per row. Total capacity and theatre cost update in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
                <span>Upload & Publish Seat Layout</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Top Real-Time Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-2xl bg-[#12151e] border border-[#232938] flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase font-bold text-[#958ea0] flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#03b5d3]" />
            Total Seats
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">{totalSeatsCount}</span>
            <span className="text-xs font-mono text-[#94a3b8]">seats</span>
          </div>
          <span className="text-[10px] font-mono text-[#4cd7f6] mt-1">Across {rows.length} rows</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#12151e] border border-[#232938] flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase font-bold text-[#958ea0] flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-[#4edea3]" />
            Total Theatre Cost (Full House)
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#4edea3]">₹{totalTheatreCost.toLocaleString()}</span>
          </div>
          <span className="text-[10px] font-mono text-[#94a3b8] mt-1">Full auditorium capacity value</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#12151e] border border-[#232938] flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase font-bold text-[#958ea0] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#a078ff]" />
            Total Rows
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">{rows.length}</span>
            <span className="text-xs font-mono text-[#94a3b8]">rows</span>
          </div>
          <span className="text-[10px] font-mono text-[#d0bcff] mt-1">Row A to Row {rows[rows.length - 1]?.name || 'A'}</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#12151e] border border-[#232938] flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase font-bold text-[#958ea0] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#fbbf24]" />
            Avg. Ticket Price
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">₹{avgSeatPrice}</span>
            <span className="text-xs font-mono text-[#94a3b8]">/ seat</span>
          </div>
          <span className="text-[10px] font-mono text-[#fbbf24] mt-1">Based on configured tiers</span>
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
            <span className="text-[11px] font-mono uppercase font-bold text-[#958ea0]">Auditorium Screen</span>
            {screens.length > 0 ? (
              <select
                value={selectedScreenId}
                onChange={(e) => setSelectedScreenId(e.target.value)}
                className="bg-[#0d0e12] border border-[#232938] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none cursor-pointer focus:border-[#a078ff]"
              >
                {screens.map(scr => (
                  <option key={scr.id} value={scr.id} className="bg-[#12151e]">
                    {scr.screen_name || scr.screenName || 'Screen'}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs font-mono text-[#94a3b8] p-2 bg-[#0d0e12] rounded-xl border border-[#232938]">
                Loading verified screens…
              </div>
            )}
          </div>

          {/* Quick Row Management Toolbar */}
          <div className="p-4 rounded-2xl bg-[#12151e] border border-[#232938] flex flex-col gap-2.5">
            <span className="text-[11px] font-mono uppercase font-bold text-[#958ea0]">Global Auditorium Controls</span>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => addRow()}
                className="p-2.5 rounded-xl bg-[#181c26] hover:bg-[#202534] border border-[#4cd7f6]/40 text-[#4cd7f6] text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Row at Bottom
              </button>
              
              <button
                type="button"
                onClick={() => removeRow(rows.length - 1)}
                disabled={rows.length <= 1}
                className="p-2.5 rounded-xl bg-[#181c26] hover:bg-[#202534] border border-[#ffb4ab]/40 text-[#ffb4ab] text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus className="w-3.5 h-3.5" />
                Remove Bottom Row
              </button>
            </div>
          </div>

          {/* Seat Tier Pricing & Painting */}
          <div className="p-4 rounded-2xl bg-[#12151e] border border-[#232938] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold text-[#958ea0]">Seat Tiers & Unit Prices</span>
              <span className="text-[10px] font-mono text-[#a078ff]">Set ticket price</span>
            </div>

            <div className="space-y-2">
              {tiers.map((t) => {
                const breakdown = tierBreakdown.find(b => b.id === t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => setActiveTier(t.id)}
                    className={`p-3 rounded-xl border flex flex-col gap-2 transition-all cursor-pointer ${
                      activeTier === t.id
                        ? 'bg-[#181c26] border-[#8b5cf6] shadow-[0_0_16px_rgba(139,92,246,0.3)]'
                        : 'bg-[#0d0e12] border-[#232938] hover:border-[#494454]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
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
                          min="0"
                          value={t.price}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateTierPrice(t.id, e.target.value)}
                          className="w-20 bg-[#181c26] border border-[#232938] rounded-lg px-2 py-1 text-xs font-mono font-bold text-white text-right outline-none focus:border-[#a078ff]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#232938] text-[10px] font-mono text-[#94a3b8]">
                      <span>{breakdown?.seatsCount || 0} seats configured</span>
                      <span className="font-bold text-[#4edea3]">Total: ₹{(breakdown?.totalCost || 0).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
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

        {/* Right Canvas: Live Visual Editor with Row & Seat +/- Controls (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          <div className="p-6 rounded-2xl bg-[#0d0e12] border border-[#232938] flex flex-col items-center shadow-2xl relative min-h-[550px] overflow-hidden">
            
            {loading && (
              <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-2xl text-xs font-mono text-[#d0bcff]">
                Fetching auditorium layout from Supabase…
              </div>
            )}

            {/* Screen Projection Curvature */}
            <div className="w-full flex flex-col items-center pt-2 pb-6 relative">
              <div 
                className="w-11/12 max-w-lg h-3 rounded-[50%] bg-gradient-to-r from-transparent via-[#4cd7f6] to-transparent shadow-[0_0_28px_rgba(76,215,246,0.8)] mb-2"
                style={{ transform: `scaleX(${screenCurvature / 50})` }}
              ></div>
              <div className="text-[11px] font-mono text-[#4cd7f6] uppercase tracking-widest flex items-center gap-2">
                <Tv className="w-3.5 h-3.5" />
                VIRTUAL PROJECTION AXIS • {selectedHall}
              </div>
            </div>

            {/* Interactive Rows Editor Canvas with +/- on every row */}
            <div className="w-full flex flex-col gap-3 overflow-x-auto py-2 px-1">
              {rows.map((row, rowIndex) => {
                const tierInfo = tiers.find(t => t.id === row.tier) || tiers[0];
                const rowCost = row.seats.length * (tierInfo?.price || 0);

                return (
                  <div 
                    key={row.name + rowIndex} 
                    className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-[#12151e] border border-[#232938] hover:border-[#384054] transition-all min-w-[720px]"
                  >
                    
                    {/* Left: Row Label + Tier Selector + Row +/- Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      
                      {/* Row Label */}
                      <span className="w-7 h-7 rounded-lg bg-[#181c26] border border-[#232938] flex items-center justify-center text-xs font-mono font-extrabold text-[#d0bcff]">
                        {row.name}
                      </span>

                      {/* Row Tier Selector */}
                      <select
                        value={row.tier}
                        onChange={(e) => toggleRowTier(row.name, e.target.value)}
                        className="bg-[#0d0e12] border border-[#232938] rounded-lg px-2 py-1 text-[11px] font-mono text-white outline-none cursor-pointer focus:border-[#a078ff]"
                      >
                        {tiers.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} (₹{t.price})
                          </option>
                        ))}
                      </select>

                      {/* Row Level (+) and (-) to increase or decrease rows */}
                      <div className="flex items-center gap-1 pl-1 border-l border-[#232938]">
                        <button
                          type="button"
                          onClick={() => removeRow(rowIndex)}
                          disabled={rows.length <= 1}
                          title={`Delete Row ${row.name}`}
                          className="w-6 h-6 rounded-md bg-[#ffb4ab]/10 hover:bg-[#ffb4ab]/25 border border-[#ffb4ab]/30 text-[#ffb4ab] flex items-center justify-center text-xs font-bold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => addRow(rowIndex)}
                          title={`Insert new row below Row ${row.name}`}
                          className="w-6 h-6 rounded-md bg-[#4cd7f6]/10 hover:bg-[#4cd7f6]/25 border border-[#4cd7f6]/30 text-[#4cd7f6] flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                    </div>

                    {/* Middle: Seats Grid */}
                    <div 
                      className="flex items-center gap-1.5 p-1.5 rounded-xl border overflow-x-auto"
                      style={{ 
                        borderColor: `${tierInfo.color}40`,
                        backgroundColor: `${tierInfo.color}08`
                      }}
                    >
                      {row.seats.map((num) => (
                        <div
                          key={num}
                          className="w-6 h-6 rounded flex items-center justify-center font-mono text-[10px] font-bold shadow-sm transition-transform hover:scale-110 select-none"
                          style={{ backgroundColor: tierInfo.color, color: '#120038' }}
                          title={`Row ${row.name}, Seat ${num} (${tierInfo.name} • ₹${tierInfo.price})`}
                        >
                          {num}
                        </div>
                      ))}
                    </div>

                    {/* Right: Seat count controls (+ / - per row) & Total Row Cost */}
                    <div className="flex items-center gap-3 shrink-0">
                      
                      {/* Seats (+) and (-) on this row */}
                      <div className="flex items-center gap-1 bg-[#0d0e12] border border-[#232938] rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => removeSeatFromRow(rowIndex)}
                          disabled={row.seats.length <= 1}
                          title={`Decrease seats in Row ${row.name}`}
                          className="w-6 h-6 rounded-lg bg-[#181c26] hover:bg-[#ffb4ab]/20 text-[#cbc3d7] hover:text-[#ffb4ab] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <span className="text-[11px] font-mono font-bold text-white px-2 min-w-[50px] text-center">
                          {row.seats.length} seats
                        </span>

                        <button
                          type="button"
                          onClick={() => addSeatToRow(rowIndex)}
                          title={`Increase seats in Row ${row.name}`}
                          className="w-6 h-6 rounded-lg bg-[#181c26] hover:bg-[#4edea3]/20 text-[#cbc3d7] hover:text-[#4edea3] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Row Cost */}
                      <div className="min-w-[75px] text-right">
                        <span className="text-[11px] font-mono font-bold text-[#4edea3] block">
                          ₹{rowCost.toLocaleString()}
                        </span>
                        <span className="text-[9px] font-mono text-[#64748b] block">
                          ₹{tierInfo.price}/seat
                        </span>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>

            {/* Bottom Add Row Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 w-full pt-4 border-t border-[#232938] text-xs font-mono">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addRow()}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#03b5d3]/20 to-[#a078ff]/20 hover:from-[#03b5d3]/30 hover:to-[#a078ff]/30 border border-[#03b5d3]/40 text-white font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#03b5d3]" />
                  Add New Row (Row {getRowLabel(rows.length)})
                </button>
                <span className="text-[#94a3b8] hidden sm:inline">or use row <strong className="text-white">+ / -</strong> icons</span>
              </div>

              <div className="flex items-center gap-2 text-[#94a3b8]">
                <span>Total Theatre Capacity: <strong className="text-white">{totalSeatsCount} seats</strong></span>
                <span>•</span>
                <span>Total Value: <strong className="text-[#4edea3]">₹{totalTheatreCost.toLocaleString()}</strong></span>
              </div>
            </div>

          </div>

        </div>

        </div>
      </WorkflowLockedGate>

      <PartnerStepFooter
        currentStep={2}
        onPrev={() => navigate('/partner/films/new')}
        onNext={() => navigate('/partner/authorizations')}
        prevLabel="← Back: Step 1 Add / Edit Film"
        nextLabel="Proceed to Step 3: Screen Authorization →"
        helpText="Step 2: Seat Layout Studio. Auditorium layout and pricing tiers configured. Proceed to Step 3 to authorize screens."
      />
    </div>
  );
}