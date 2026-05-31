const KEY = "rapportai_plan_v1";

export type PlanId = "free" | "starter" | "pro";

export interface UserPlanData {
  planId:         PlanId;
  revisionCount:  number;
  pagesGenerated: number;
  purchasedAt?:   number;
}

export interface PlanLimit {
  pages:        number;   // max pages (Infinity = unlimited). 250 words ≈ 1 page.
  revisions:    number;   // max revision calls
  label:        string;   // display name
  labelShort:   string;
  priceMad:     number;   // display price in MAD
  priceUsd:     number;   // Stripe charge in USD
  anchorMad:    number;   // crossed-out "market price" for anchoring
  stripePriceId: string | null;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimit> = {
  //                pages  revisions  label         labelShort  priceMad  priceUsd  anchorMad  stripePriceId
  free:    { pages: 15,       revisions: 2,        label: "Gratuit",   labelShort: "Gratuit",   priceMad: 0,   priceUsd: 0,  anchorMad: 0,    stripePriceId: null },
  starter: { pages: 60,       revisions: 20,       label: "Essentiel", labelShort: "Essentiel", priceMad: 377, priceUsd: 37, anchorMad: 1000, stripePriceId: "price_1TdDGG003Ts2AXbaNkwwT03b" },
  pro:     { pages: Infinity, revisions: Infinity, label: "Pro",       labelShort: "Pro",       priceMad: 677, priceUsd: 67, anchorMad: 1500, stripePriceId: "price_1TdDGO003Ts2AXbac5dyihpl" },
};

export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free:    [],
  starter: ["pdf", "anti-plagiat", "humanize"],
  pro:     ["pdf", "anti-plagiat", "humanize", "juryai"],
};

export function getMyPlan(): UserPlanData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserPlanData> & { sectionsGenerated?: number };
      // migrate old "sectionsGenerated" field → "pagesGenerated"
      return {
        planId:         parsed.planId ?? "pro",
        revisionCount:  parsed.revisionCount ?? 0,
        pagesGenerated: parsed.pagesGenerated ?? (parsed.sectionsGenerated ? parsed.sectionsGenerated * 8 : 0),
        purchasedAt:    parsed.purchasedAt,
      };
    }
  } catch {}
  // Default during free launch: pro with no limits
  return { planId: "pro", revisionCount: 0, pagesGenerated: 0 };
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

/** Estimate pages from word count (250 words ≈ 1 page) */
export function wordsToPages(wordCount: number): number {
  return Math.ceil(wordCount / 250);
}

export function incrementPages(wordCount: number): UserPlanData {
  const plan  = getMyPlan();
  const added = wordsToPages(wordCount);
  const next  = { ...plan, pagesGenerated: (plan.pagesGenerated ?? 0) + added };
  saveMyPlan(next);
  return next;
}

export function canGenerateSection(planId: PlanId, pagesGenerated: number): boolean {
  const limit = PLAN_LIMITS[planId].pages;
  return limit === Infinity || pagesGenerated < limit;
}

export function canRevise(planId: PlanId, revisionCount: number): boolean {
  const limit = PLAN_LIMITS[planId].revisions;
  return limit === Infinity || revisionCount < limit;
}

export function canUseFeature(feature: string, planId: PlanId): boolean {
  return PLAN_FEATURES[planId].includes(feature);
}

export function nextPlan(planId: PlanId): PlanId {
  if (planId === "free") return "starter";
  return "pro";
}

/** Price difference between current plan and target plan, in MAD */
export function upgradeCostMad(from: PlanId, to: PlanId): number {
  return Math.max(0, PLAN_LIMITS[to].priceMad - PLAN_LIMITS[from].priceMad);
}
