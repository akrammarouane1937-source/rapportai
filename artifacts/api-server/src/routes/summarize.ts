import { Router, type Request, type Response } from "express";

const router = Router();
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const SECTION_LABELS: Record<string, string> = {
  "partie-i":      "Partie I — Cadre théorique",
  "partie-ii":     "Partie II — Étude empirique",
  "page-de-garde": "Page de garde",
  "resume":        "Résumé & Abstract",
  "introduction":  "Introduction",
  "conclusion":    "Conclusion",
  "dedicaces":     "Dédicaces",
  "remerciements": "Remerciements",
  "sommaire":      "Sommaire",
  "bibliographie": "Bibliographie",
  // store key format too
  "partieI":       "Partie I — Cadre théorique",
  "partieII":      "Partie II — Étude empirique",
  "pageDeGarde":   "Page de garde",
  "resumeFr":      "Résumé & Abstract",
};

// POST /api/summarize
// Called automatically after each section is generated.
// Returns a 2-3 sentence summary for the orchestrator to inject into subsequent agents.
router.post("/summarize", async (req: Request, res: Response) => {
  const {
    section,
    content,
    theme = "",
    reportType = "rapport de fin d'études",
  } = req.body as {
    section: string;
    content: string;
    theme?: string;
    reportType?: string;
  };

  if (!section || !content || content.trim().length < 100) {
    res.status(400).json({ error: "section and content (min 100 chars) are required" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    return;
  }

  const label = SECTION_LABELS[section] ?? section;
  // Use first 2500 chars — enough to capture structure and key arguments
  const excerpt = content.trim().slice(0, 2500);

  const prompt = `Tu es un assistant de synthèse académique.

Lis cette section de rapport académique et rédige un résumé en 2-3 phrases UNIQUEMENT.
Le résumé doit capturer :
1. Les arguments principaux ou informations clés développés
2. Les conclusions ou résultats atteints
3. Ce que les agents générant les sections SUIVANTES doivent absolument savoir pour maintenir la cohérence (ex: cadre théorique retenu, méthodologie choisie, résultats empiriques clés)

Ne mets aucun titre, aucune introduction, aucun commentaire. Juste le résumé en 2-3 phrases.

Section : ${label}
Thème du rapport : "${theme}"
Type : ${reportType}

Contenu de la section :
${excerpt}${content.trim().length > 2500 ? "\n[…]" : ""}`;

  try {
    const anthropicRes = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      res.status(500).json({ error: `API error: ${err.slice(0, 100)}` });
      return;
    }

    const data = await anthropicRes.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const rawSummary = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();

    // Fallback: if model returned nothing useful, extract first 2 sentences from content
    const summary = rawSummary.length > 20
      ? rawSummary
      : excerpt.replace(/#+[^\n]*/g, "").trim().split(/[.!?]\s+/).slice(0, 2).join(". ").slice(0, 300);

    res.json({ summary: summary || excerpt.slice(0, 200) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

export default router;
