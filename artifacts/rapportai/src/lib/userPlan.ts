const KEY = "rapportai_plan_v1";

export type PlanId = "free" | "starter" | "pro";

export interface UserPlanData {
  planId: PlanId;
  revisionCount: number;
  sectionsGenerated: number;
  purchasedAt?: number;
}

export interface PlanLimit {
  sections:  number;
  revisions: number;
  label:     string;
  priceUsd:  number;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimit> = {
  free:    { sections: 3,        revisions: 2,        label: "Gratuit", priceUsd: 0  },
  starter: { sections: 60,       revisions: 10,       label: "Starter", priceUsd: 37 },
  pro:     { sections: Infinity, revisions: Infinity, label: "Pro",     priceUsd: 67 },
};

export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free:    [],
  starter: ["pdf", "anti-plagiat"],
  pro:     ["pdf", "anti-plagiat", "juryai", "certificat", "powerpoint"],
};

export function getMyPlan(): UserPlanData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as UserPlanData;
  } catch {}
  // Default during free launch: pro with no limits
  return { planId: "pro", revisionCount: 0, sectionsGenerated: 0 };
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

export function incrementSections(count = 1): UserPlanData {
  const plan = getMyPlan();
  const next = { ...plan, sectionsGenerated: (plan.sectionsGenerated ?? 0) + count };
  saveMyPlan(next);
  return next;
}

export function canGenerateSection(planId: PlanId, sectionsGenerated: number): boolean {
  const limit = PLAN_LIMITS[planId].sections;
  return limit === Infinity || sectionsGenerated < limit;
}

export function canRevise(planId: PlanId, revisionCount: number): boolean {
  const limit = PLAN_LIMITS[planId].revisions;
  return limit === Infinity || revisionCount < limit;
}

export function canUseFeature(feature: string, planId: PlanId): boolean {
  return PLAN_FEATURES[planId].includes(feature);
}

export function upgradeCost(from: PlanId, to: PlanId): number {
  return Math.max(0, PLAN_LIMITS[to].priceUsd - PLAN_LIMITS[from].priceUsd);
}

export function nextPlan(planId: PlanId): PlanId {
  if (planId === "free") return "starter";
  return "pro";
}
