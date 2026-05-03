const KEY = "rapportai_plan_v1";

export type PlanId = "free" | "essentiel" | "pro" | "premium";

export interface UserPlanData {
  planId: PlanId;
  revisionCount: number;
  purchasedAt?: number;
}

export const PLAN_LIMITS: Record<PlanId, { pages: number; revisions: number; label: string; price: number }> = {
  free:      { pages: 5,        revisions: 3,        label: "Gratuit",  price: 0   },
  essentiel: { pages: 30,       revisions: 10,       label: "Essentiel",price: 149 },
  pro:       { pages: 60,       revisions: Infinity, label: "Pro",      price: 449 },
  premium:   { pages: Infinity, revisions: Infinity, label: "Premium",  price: 749 },
};

export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free:      [],
  essentiel: ["pdf", "citations"],
  pro:       ["pdf", "juryai", "anti-plagiat", "citations", "certificat"],
  premium:   ["pdf", "juryai", "anti-plagiat", "citations", "certificat", "powerpoint"],
};

export function getMyPlan(): UserPlanData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as UserPlanData;
  } catch {}
  return { planId: "pro", revisionCount: 0 };
}

export function saveMyPlan(patch: Partial<UserPlanData>): void {
  try {
    const current = getMyPlan();
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
  } catch {}
}

export function incrementRevision(): UserPlanData {
  const plan = getMyPlan();
  const next = { ...plan, revisionCount: plan.revisionCount + 1 };
  saveMyPlan(next);
  return next;
}

/** Returns true when the user's plan allows this feature */
export function canUseFeature(feature: string, planId: PlanId): boolean {
  return PLAN_FEATURES[planId].includes(feature);
}

/** Returns the MAD price difference to upgrade to the next plan (e.g. essentiel → pro = 300) */
export function upgradeCost(from: PlanId, to: PlanId): number {
  return Math.max(0, PLAN_LIMITS[to].price - PLAN_LIMITS[from].price);
}

/** Returns the next recommended plan to suggest */
export function nextPlan(planId: PlanId): PlanId {
  if (planId === "free") return "essentiel";
  if (planId === "essentiel") return "pro";
  if (planId === "pro") return "premium";
  return "premium";
}
