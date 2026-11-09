import { Plus, LayoutGrid, Building2, Film, DollarSign } from 'lucide-react';

// Partner 5-Step Publishing Workflow Progression State Manager

export const PARTNER_STEPS = [
  {
    step: 1,
    id: 'add-edit-film',
    tabId: 'add-film',
    path: '/partner/films/new',
    title: '1. Add / Edit Film',
    shortTitle: 'Add Film',
    desc: 'Film Details, Poster Artwork & Exhibition Formats',
    icon: Plus,
    color: 'from-[#a078ff] to-[#8b5cf6]',
    textColor: 'text-[#d0bcff]',
    borderColor: 'border-[#a078ff]/40',
    badge: 'Step 1'
  },
  {
    step: 2,
    id: 'seat-planner',
    tabId: 'seat-planner',
    path: '/partner/seat-planner',
    title: '2. Seat Layout Studio',
    shortTitle: 'Seat Studio',
    desc: 'Auditorium Seating Matrix, Rows & Tier Pricing',
    icon: LayoutGrid,
    color: 'from-[#f43f5e] to-[#e11d48]',
    textColor: 'text-[#fb7185]',
    borderColor: 'border-[#f43f5e]/40',
    badge: 'Step 2'
  },
  {
    step: 3,
    id: 'cinema-auth',
    tabId: 'authorization',
    path: '/partner/authorizations',
    title: '3. Screen Authorization',
    shortTitle: 'Screen Auth',
    desc: 'Cinema Venue, Screens, CBFC Licence & Distribution Deed',
    icon: Building2,
    color: 'from-[#fbbf24] to-[#f59e0b]',
    textColor: 'text-[#fbbf24]',
    borderColor: 'border-[#fbbf24]/40',
    badge: 'Step 3'
  },
  {
    step: 4,
    id: 'film-catalog',
    tabId: 'catalog',
    path: '/partner/films',
    title: '4. Film Catalog',
    shortTitle: 'Catalog',
    desc: 'Submissions & Super Admin Approval Review',
    icon: Film,
    color: 'from-[#03b5d3] to-[#0ea5e9]',
    textColor: 'text-[#4cd7f6]',
    borderColor: 'border-[#03b5d3]/40',
    badge: 'Step 4'
  },
  {
    step: 5,
    id: 'shows-pricing',
    tabId: 'shows-pricing',
    path: '/partner/shows',
    title: '5. Shows & Pricing',
    shortTitle: 'Shows & Pricing',
    desc: 'Showtime Schedules & Live Theatrical Ticketing',
    icon: DollarSign,
    color: 'from-[#4edea3] to-[#10b981]',
    textColor: 'text-[#4edea3]',
    borderColor: 'border-[#4edea3]/40',
    badge: 'Step 5'
  }
];

export function getPartnerUnlockedStep() {
  try {
    const val = localStorage.getItem('tixora_partner_unlocked_step');
    const num = parseInt(val, 10);
    return !isNaN(num) && num >= 1 && num <= 5 ? num : 1;
  } catch (_) {
    return 1;
  }
}

export function setPartnerUnlockedStep(step) {
  try {
    const current = getPartnerUnlockedStep();
    const next = Math.max(current, Math.min(5, Math.max(1, parseInt(step, 10) || 1)));
    localStorage.setItem('tixora_partner_unlocked_step', String(next));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tixora_workflow_step_unlocked', { detail: next }));
    }
    return next;
  } catch (_) {
    return 1;
  }
}

export function isStepUnlocked(stepNumber) {
  return Number(stepNumber) <= getPartnerUnlockedStep();
}
