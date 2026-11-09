import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus,
  LayoutGrid,
  Building2,
  Film,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Clock,
  Lock,
  AlertCircle
} from 'lucide-react';
import { getPartnerUnlockedStep, setPartnerUnlockedStep, isStepUnlocked, PARTNER_STEPS } from '../utils/workflow';
import { moviesApi, cinemasApi } from '../api';

export default function PartnerWorkflowBar({ currentStep = 1, onStepClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [unlockedStep, setUnlockedStep] = useState(getPartnerUnlockedStep());
  const [lockedNotice, setLockedNotice] = useState('');

  // Normalize current step (can be number 1-5 or id)
  const activeStepNumber = typeof currentStep === 'number'
    ? currentStep
    : PARTNER_STEPS.find(s => s.id === currentStep || s.tabId === currentStep || s.path === location.pathname)?.step || 1;

  // Sync unlocked step from event and auto-discover completed milestones from backend
  useEffect(() => {
    const handleStepUnlocked = (e) => {
      if (e.detail) setUnlockedStep(e.detail);
    };
    window.addEventListener('tixora_workflow_step_unlocked', handleStepUnlocked);

    // Auto-detect milestone progress
    const checkMilestones = async () => {
      try {
        let maxStep = 1;
        const myMovies = await moviesApi.listMine().catch(() => []);
        if (Array.isArray(myMovies) && myMovies.length > 0) {
          maxStep = Math.max(maxStep, 2);
        }

        const screens = await cinemasApi.getScreens().catch(() => []);
        if (Array.isArray(screens) && screens.length > 0 && screens.some(s => Number(s.capacity) > 0)) {
          maxStep = Math.max(maxStep, 3);
        }

        const cinema = await cinemasApi.getMyCinema().catch(() => null);
        const docs = await cinemasApi.getDocuments().catch(() => []);
        if (cinema && (cinema.verification_status === 'SUBMITTED' || cinema.verification_status === 'VERIFIED' || docs.length >= 2)) {
          maxStep = Math.max(maxStep, 4);
        }

        if (cinema && (cinema.verification_status === 'VERIFIED' || maxStep >= 4)) {
          maxStep = Math.max(maxStep, 5);
        }

        const updated = setPartnerUnlockedStep(maxStep);
        setUnlockedStep(updated);
      } catch (_) {}
    };

    checkMilestones();
    return () => window.removeEventListener('tixora_workflow_step_unlocked', handleStepUnlocked);
  }, []);

  const handleStepClick = (step) => {
    if (step.step > unlockedStep) {
      const prevStepObj = PARTNER_STEPS.find(s => s.step === step.step - 1);
      setLockedNotice(`Step ${step.step} (${step.shortTitle}) is locked. Please complete Step ${step.step - 1} (${prevStepObj?.shortTitle || 'Previous Step'}) first.`);
      setTimeout(() => setLockedNotice(''), 4500);
      return;
    }
    setLockedNotice('');
    if (onStepClick) {
      onStepClick(step);
    } else {
      navigate(step.path);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 mb-6">
      {/* Statutory Guidance Banner */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#181c26] via-[#151926] to-[#12151e] border border-[#232938] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#a078ff]/15 border border-[#a078ff]/30 flex items-center justify-center text-[#d0bcff] shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">
                Exhibitor & Provider Publishing Pipeline
              </span>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/30 uppercase">
                5-Step Sequential Workflow
              </span>
            </div>
            <p className="text-[11px] text-[#94a3b8] font-mono mt-0.5">
              Complete each stage sequentially. Each step unlocks after the previous step has been successfully finished.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0d0e12] border border-[#232938] text-[10px] font-mono text-[#94a3b8]">
            <Clock className="w-3 h-3 text-[#fbbf24]" />
            <span>Active: Step {activeStepNumber} of 5</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#4edea3]/10 border border-[#4edea3]/30 text-[10px] font-mono font-bold text-[#4edea3]">
            <span>Unlocked: {unlockedStep}/5</span>
          </div>
        </div>
      </div>

      {/* Locked Notice Alert if User Tries to Jump Ahead */}
      {lockedNotice && (
        <div role="alert" className="p-3.5 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/40 text-[#fde68a] text-xs font-mono flex items-center gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-[#fbbf24] shrink-0" />
          <span>{lockedNotice}</span>
        </div>
      )}

      {/* Stepper Navigation Track */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 bg-[#0c0d12] p-2 rounded-2xl border border-[#232938]">
        {PARTNER_STEPS.map((s) => {
          const Icon = s.icon;
          const isActive = s.step === activeStepNumber;
          const isPassed = s.step < activeStepNumber;
          const isLocked = s.step > unlockedStep;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleStepClick(s)}
              className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all relative overflow-hidden group ${
                isLocked
                  ? 'bg-[#0d0e12]/60 border-[#1a1e29] opacity-60 cursor-not-allowed text-[#494454]'
                  : isActive
                  ? `bg-[#181c26] ${s.borderColor} shadow-[0_0_20px_rgba(160,120,255,0.15)] ring-1 ring-[#a078ff]/30 cursor-pointer`
                  : isPassed
                  ? 'bg-[#12151e]/80 border-[#4edea3]/25 hover:border-[#4edea3]/50 text-[#cbc3d7] cursor-pointer'
                  : 'bg-[#12151e]/50 border-[#232938] hover:border-[#494454] text-[#8c8596] cursor-pointer'
              }`}
            >
              {/* Top Accent Line for Active Step */}
              {isActive && (
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${s.color}`} />
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${
                    isLocked
                      ? 'bg-[#181c26] text-[#64748b]'
                      : isActive
                      ? `bg-gradient-to-r ${s.color} text-[#001f26]`
                      : isPassed
                      ? 'bg-[#4edea3]/20 text-[#4edea3]'
                      : 'bg-[#1e2330] text-[#64748b]'
                  }`}>
                    {isLocked ? <Lock className="w-3 h-3 text-[#64748b]" /> : isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.step}
                  </div>
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                    isLocked ? 'text-[#64748b]' : isActive ? s.textColor : isPassed ? 'text-[#4edea3]' : 'text-[#64748b]'
                  }`}>
                    {isLocked ? 'Locked' : isActive ? 'Current' : isPassed ? 'Completed' : `Step ${s.step}`}
                  </span>
                </div>
                {isLocked ? (
                  <Lock className="w-3.5 h-3.5 text-[#494454]" />
                ) : (
                  <Icon className={`w-3.5 h-3.5 ${isActive ? s.textColor : 'text-[#64748b] group-hover:text-white transition-colors'}`} />
                )}
              </div>

              <div>
                <h4 className={`text-xs font-extrabold truncate ${isLocked ? 'text-[#64748b]' : isActive ? 'text-white' : 'text-[#e5e1e6] group-hover:text-white'}`}>
                  {s.title}
                </h4>
                <p className="text-[10px] text-[#64748b] truncate font-mono mt-0.5">
                  {isLocked ? `Complete Step ${s.step - 1} to unlock` : s.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorkflowLockedGate({ stepNumber, children }) {
  const navigate = useNavigate();
  const unlocked = isStepUnlocked(stepNumber);
  const currentStepObj = PARTNER_STEPS.find(s => s.step === stepNumber);
  const prevStepObj = PARTNER_STEPS.find(s => s.step === stepNumber - 1);

  if (unlocked) {
    return children;
  }

  return (
    <div className="w-full max-w-xl mx-auto my-12 p-8 rounded-3xl bg-[#12151e] border border-[#232938] text-center space-y-5 shadow-2xl">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-[#fbbf24]/15 border border-[#fbbf24]/30 flex items-center justify-center text-[#fbbf24]">
        <Lock className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-mono font-bold uppercase px-3 py-1 rounded-full bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/30">
          Sequential Workflow Gate
        </span>
        <h3 className="text-xl font-bold text-white">
          Step {stepNumber}: {currentStepObj?.shortTitle || 'Section'} is Locked
        </h3>
        <p className="text-xs text-[#94a3b8] font-mono leading-relaxed max-w-md mx-auto">
          To maintain regulatory and exhibition compliance, you must complete the previous stage before accessing this section.
        </p>
      </div>

      <div className="pt-2">
        {prevStepObj && (
          <button
            type="button"
            onClick={() => navigate(prevStepObj.path)}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#8b5cf6] text-white font-bold text-xs font-mono shadow-[0_0_20px_rgba(160,120,255,0.35)] hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to Step {stepNumber - 1}: {prevStepObj.title} →</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function PartnerStepFooter({
  currentStep,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  helpText
}) {
  const navigate = useNavigate();

  const prevStepObj = PARTNER_STEPS.find(s => s.step === currentStep - 1);
  const nextStepObj = PARTNER_STEPS.find(s => s.step === currentStep + 1);

  const handlePrev = () => {
    if (onPrev) {
      onPrev();
    } else if (prevStepObj) {
      navigate(prevStepObj.path);
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else if (nextStepObj) {
      navigate(nextStepObj.path);
    }
  };

  return (
    <div className="mt-8 pt-5 border-t border-[#232938] flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <p className="text-xs text-[#94a3b8] font-mono">
          {helpText || (
            currentStep === 5
              ? "All 5 steps are in place. Verified films with scheduled shows are live on the customer portal."
              : `Completed Step ${currentStep}? Proceed to Step ${currentStep + 1} to continue the publishing path.`
          )}
        </p>
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto">
        {currentStep > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-[#232938] hover:border-[#494454] bg-[#12151e] text-[#cbc3d7] hover:text-white text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{prevLabel || `← Back: ${prevStepObj?.shortTitle || 'Previous'}`}</span>
          </button>
        )}

        {currentStep < 5 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#a078ff] to-[#8b5cf6] hover:brightness-110 text-white text-xs font-bold font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(160,120,255,0.3)] transition-all cursor-pointer"
          >
            <span>{nextLabel || `Proceed to Step ${currentStep + 1}: ${nextStepObj?.shortTitle || 'Next'} →`}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : onNext ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] hover:brightness-110 text-[#1e1300] text-xs font-bold font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(251,191,36,0.35)] transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{nextLabel || 'Complete 5-Step Path & View Admin Notice →'}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
