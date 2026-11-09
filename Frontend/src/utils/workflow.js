// Partner 5-Step Publishing Workflow Progression State Manager

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

