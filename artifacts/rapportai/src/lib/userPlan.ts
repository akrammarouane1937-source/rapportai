const KEY = "rapportai_plan_v1";

export type PlanId = "free" | "basique" | "starter" | "pro";

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
  //                 pages  revisions  label         labelShort  priceMad  priceUsd  anchorMad  stripePriceId
  free:    { pages: 12,       revisions: 2,        label: "Gratuit",   labelShort: "Gratuit",   priceMad: 0,   priceUsd: 0,  anchorMad: 0,    stripePriceId: null },
  basique: { pages: 35,       revisions: 8,        label: "Basique",   labelShort: "Basique",   priceMad: 147, priceUsd: 15, anchorMad: 350,  stripePriceId: "price_BASIQUE_TO_ADD" },
  starter: { pages: 60,       revisions: 20,       label: "Essentiel", labelShort: "Essentiel", priceMad: 377, priceUsd: 37, anchorMad: 1000, stripePriceId: "price_1TdDGG003Ts2AXbaNkwwT03b" },
  pro:     { pages: Infinity, revisions: Infinity, label: "Pro",       labelShort: "Pro",       priceMad: 677, priceUsd: 67, anchorMad: 1500, stripePriceId: "price_1TdDGO003Ts2AXbac5dyihpl" },
};

// "humanize" is the single anti-AI-detection / anti-plagiat feature (one capability,
// one flag). Don't reintroduce a separate "anti-plagiat" flag — they are the same thing.
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free:    [],
  basique: ["humanize"],
  starter: ["pdf", "humanize"],
  pro:     ["pdf", "humanize", "juryai"],
};

export function getMyPlan(): UserPlanData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserPlanData> & { sectionsGenerated?: number };
      // A paid plan without a purchase record is a stale value from the
      // free-launch era (old default was "pro") — downgrade to free.
      const stored = parsed.planId ?? "free";
      const planId: PlanId = (stored === "basique" || stored === "starter" || stored === "pro")
        ? (parsed.purchasedAt ? stored : "free")
        : "free";
      // migrate old "sectionsGenerated" field → "pagesGenerated"
      return {
        planId,
        revisionCount:  parsed.revisionCount ?? 0,
        pagesGenerated: parsed.pagesGenerated ?? (parsed.sectionsGenerated ? parsed.sectionsGenerated * 8 : 0),
        purchasedAt:    parsed.purchasedAt,
      };
    }
  } catch {}
  return { planId: "free", revisionCount: 0, pagesGenerated: 0 };
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
  if (planId === "free") return "basique";
  if (planId === "basique") return "starter";
  return "pro";
}

// ─── Daily chat message limit (the only otherwise-unbounded free surface) ─────

const CHAT_DAILY_LIMITS: Record<PlanId, number> = { free: 15, basique: Infinity, starter: Infinity, pro: Infinity };
const CHAT_USAGE_KEY = "rapportai_chat_usage";

export function getChatUsage(): { count: number; limit: number } {
  const limit = CHAT_DAILY_LIMITS[getMyPlan().planId];
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = JSON.parse(localStorage.getItem(CHAT_USAGE_KEY) ?? "{}") as { date?: string; count?: number };
    return { count: raw.date === today ? (raw.count ?? 0) : 0, limit };
  } catch {
    return { count: 0, limit };
  }
}

export function incrementChatMessage(): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = getChatUsage();
    localStorage.setItem(CHAT_USAGE_KEY, JSON.stringify({ date: today, count: count + 1 }));
  } catch { /* quota — non-fatal */ }
}

/** Price difference between current plan and target plan, in MAD */
export function upgradeCostMad(from: PlanId, to: PlanId): number {
  return Math.max(0, PLAN_LIMITS[to].priceMad - PLAN_LIMITS[from].priceMad);
}
