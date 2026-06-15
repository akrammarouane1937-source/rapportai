import type { PlanId } from "@/lib/userPlan";

// ─── Section access — single source of truth (mirror of api-server plan-guard.ts) ─
//
// Gating is BY SECTION, not by page count. The free tier gives a complete frame
// (front matter + Introduction); Partie I — the part students truly can't write
// alone — is the first paywall moment.
//
//   Free      → front matter + Introduction
//   Basique   → + Partie I
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
  return PLAN_RANK[planId] >= PLAN_RANK[sectionMinPlan(sectionId)];
}

/** Short lock badge label for a section the current plan can't reach. */
export function lockBadge(sectionId: string): string {
  const required = sectionMinPlan(sectionId);
  if (required === "basique") return "Basique";
  if (required === "starter") return "Essentiel";
  if (required === "pro") return "Pro";
  return "";
}
