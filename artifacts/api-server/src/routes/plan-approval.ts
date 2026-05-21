import { Router, type Request, type Response } from "express";
import { sessionStore } from "../lib/session-store";
import { readMemory, patchMemory } from "../lib/memory";
import { logger } from "../lib/logger";

const router = Router();

const PLAN_SYSTEM = `Tu es un assistant académique spécialisé dans la structuration de rapports universitaires marocains (PFE, PFA, Mémoire, Rapport de stage).

À partir du profil étudiant fourni, génère un PLAN DÉTAILLÉ du rapport sous forme JSON.
Le plan doit respecter la norme académique marocaine : Introduction, Partie I (cadre théorique), Partie II (étude empirique/pratique), Conclusion.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après, sans balises markdown.`;

// ─── GET /api/session/:sessionId/plan ─────────────────────────────────────────
// Generates a structured plan (outline) for student review before generation starts.

router.get("/session/:sessionId/plan", async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const agent = sessionStore.get(sessionId);
  if (!agent) { res.status(404).json({ error: "Session not found" }); return; }

  const memory = readMemory(sessionId);
  if (!memory) { res.status(404).json({ error: "Session memory not found" }); return; }

  // Return cached plan if already approved
  if (memory.report.plan_approved && memory.report.generated_plan) {
    res.json({ plan: memory.report.generated_plan, approved: true });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" }); return; }

  const profile = agent.profile;
  const prompt = `Profil étudiant :
- Nom : ${profile.studentName}
- École : ${profile.school}
- Filière : ${profile.filiere}
- Type de rapport : ${profile.reportType}
- Thème : ${profile.theme}
- Problématique : ${profile.problematique ?? "Non définie"}
- Encadrant pédagogique : ${profile.encadrantPeda ?? "N/A"}
- Entreprise : ${profile.entreprise ?? "N/A"}
- Année : ${profile.annee ?? "2024-2025"}

Génère un plan détaillé JSON avec cette structure :
{
  "title": "Titre complet du rapport",
  "sections": [
    {
      "id": "introduction",
      "name": "Introduction Générale",
      "target_words": 500,
      "key_points": ["point 1", "point 2"]
    },
    {
      "id": "partie-i",
      "name": "Partie I — [Titre du cadre théorique]",
      "target_words": 3000,
      "chapters": ["Chapitre 1 : ...", "Chapitre 2 : ...", "Chapitre 3 : ..."],
      "key_points": ["concepts clés à couvrir"]
    },
    {
      "id": "partie-ii",
      "name": "Partie II — [Titre de l'étude empirique]",
      "target_words": 3000,
      "chapters": ["Chapitre 1 : ...", "Chapitre 2 : ...", "Chapitre 3 : ..."],
      "key_points": ["méthodologie, terrain, résultats"]
    },
    {
      "id": "conclusion",
      "name": "Conclusion Générale",
      "target_words": 500,
      "key_points": ["synthèse, limites, perspectives"]
    }
  ],
  "estimated_total_words": 8000
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: PLAN_SYSTEM,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      res.status(500).json({ error: `API error: ${err.slice(0, 100)}` });
      return;
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    const raw = data.content.filter(b => b.type === "text").map(b => b.text ?? "").join("").trim();

    // Safe JSON parse — strip markdown fences if present
    let plan: unknown;
    try {
      plan = JSON.parse(raw);
    } catch {
      const match = raw.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
      if (match) {
        try { plan = JSON.parse(match[1]); } catch { /* fall through */ }
      }
      if (!plan) {
        const objMatch = raw.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try { plan = JSON.parse(objMatch[0]); } catch { /* fall through */ }
        }
      }
    }

    if (!plan) {
      res.status(500).json({ error: "Failed to parse plan from model output" });
      return;
    }

    // Cache the plan in memory
    patchMemory(sessionId, { report: { ...memory.report, generated_plan: plan } });

    logger.info({ event: "plan_generated", sessionId }, "Plan generated");
    res.json({ plan, approved: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/session/:sessionId/approve ─────────────────────────────────────
// Student approves (or adjusts) the plan before generation starts.

router.post("/session/:sessionId/approve", (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { approved, adjustments } = req.body as {
    approved: boolean;
    adjustments?: Record<string, unknown>;
  };

  const memory = readMemory(sessionId);
  if (!memory) { res.status(404).json({ error: "Session not found" }); return; }

  const updatedPlan = adjustments
    ? { ...memory.report.generated_plan as object, ...adjustments }
    : memory.report.generated_plan;

  patchMemory(sessionId, {
    report: {
      ...memory.report,
      plan_approved: approved,
      generated_plan: updatedPlan,
    },
  });

  logger.info({ event: "plan_approved", sessionId, approved }, "Plan approval recorded");
  res.json({ ok: true, approved, plan: updatedPlan });
});

export default router;
