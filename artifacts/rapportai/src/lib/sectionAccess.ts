import type { PlanId } from "@/lib/userPlan";
import { FREE_LAUNCH } from "@/lib/userPlan";

// ─── Section access — single source of truth (mirror of api-server plan-guard.ts) ─
//
// No free use: an unpaid user is paywalled on everything. Basique is the entry plan.
//
//   Free      → nothing (paywalled — must buy at least Basique)
//   Basique   → front matter + Introduction + Partie I
//   Essentiel → + Partie II, Conclusion, Bibliographie, lists, Annexes
//   Pro       → everything (+ unlimited revisions, JuryAI)

const PLAN_RANK: Record<PlanId, number> = { free: 0, basique: 1, starter: 2, pro: 3 };

/** Minimum plan required to generate each section. Keyed by RapportsPage section id. */
export const SECTION_MIN_PLAN: Record<string, PlanId> = {
  "step-1":          "free",     // Informations générales
  "remerciements":   "free",
  "step-3":          "free",     // Dédicaces
  "step-4":          "free",     // Résumé & Abstract
  "step-5":          "free",     // Sommaire
  "step-6":          "free",     // Introduction
  "partie-i":        "basique",
  "partie-ii":       "starter",
  "step-9":          "starter",  // Conclusion
  // Derived scholarly apparatus — extracted from body content, so they belong with
  // whatever the buyer already generated. Tied to Basique so a Partie I buyer gets
  // a complete chapter (with its bibliography, abbreviations, and lists).
  "bibliographie":   "basique",
  "abreviations":    "basique",
  "tableDesFigures": "basique",
  "listeDesTableaux":"basique",
  "annexes":         "starter",
  // tableDesMatieres removed — it's auto-generated at export, not a step.
};

export function sectionMinPlan(sectionId: string): PlanId {
  return SECTION_MIN_PLAN[sectionId] ?? "free";
}

export function canAccessSection(sectionId: string, planId: PlanId): boolean {
  if (FREE_LAUNCH) return true;
  if (planId === "free") return false;  // no free use — must buy at least Basique to generate anything
  return PLAN_RANK[planId] >= PLAN_RANK[sectionMinPlan(sectionId)];
}

/** Short lock badge label for a section the current plan can't reach. */
export function lockBadge(sectionId: string): string {
  const required = sectionMinPlan(sectionId);
  if (required === "starter") return "Essentiel";
  if (required === "pro") return "Pro";
  return "Basique";  // free-tier sections are locked for free users → Basique is the entry plan
}
