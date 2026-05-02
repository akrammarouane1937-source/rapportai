import { Router, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

interface FigureAnalyzeBody {
  columns: string[];
  preview: string;
  rowCount?: number;
  filename?: string;
  reportContext: {
    theme?: string;
    school?: string;
    filiere?: string;
    reportType?: string;
  };
}

export interface FigureSuggestion {
  id: string;
  figureNumber: number;
  title: string;
  type: "bar" | "line" | "pie" | "doughnut";
  placement: "Partie I" | "Partie II";
  x_column: string | null;
  y_columns: string[];
  description: string;   // e.g. "Comme le montre la Figure 1 ci-dessous..."
  caption: string;       // e.g. "Figure 1 — Évolution du CA (2020-2024)"
  suggested_data?: string; // when no data uploaded
}

router.post("/figures/analyze", async (req: Request, res: Response) => {
  const body = req.body as FigureAnalyzeBody;
  const ctx = body.reportContext ?? {};
  const hasData = Array.isArray(body.columns) && body.columns.length > 0;

  const theme   = ctx.theme   ?? "sujet non précisé";
  const filiere = ctx.filiere ?? "gestion";
  const type    = ctx.reportType ?? "rapport de fin d'études";

  const dataSection = hasData
    ? `Les données importées contiennent ${body.rowCount ?? "?"} lignes.\nColonnes disponibles : ${body.columns.join(", ")}\n\nAperçu des données (5 premières lignes) :\n${body.preview}`
    : `Aucune donnée importée. Suggère quelles figures l'étudiant DEVRAIT créer pour son sujet, et précise les données à collecter dans "suggested_data".`;

  const prompt = `Tu es un expert en visualisation de données pour rapports académiques marocains (${type}).

Contexte du rapport :
- Thème : ${theme}
- Filière : ${filiere}

${dataSection}

Génère exactement 2 à 4 suggestions de figures pertinentes pour ce rapport. Chaque figure doit être concrète et académiquement pertinente.

Retourne UNIQUEMENT un tableau JSON valide (zéro texte avant ou après), selon ce format strict :
[
  {
    "id": "fig-1",
    "figureNumber": 1,
    "title": "Titre court descriptif (6 mots max)",
    "type": "bar",
    "placement": "Partie I",
    "x_column": "Nom exact de la colonne X (ou null)",
    "y_columns": ["Nom exact de la colonne Y"],
    "description": "Comme le montre la Figure 1 ci-dessous, [phrase académique spécifique au sujet].",
    "caption": "Figure 1 — Titre complet de la figure"${!hasData ? ',\n    "suggested_data": "Description des données à collecter"' : ""}
  }
]`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    let figures: FigureSuggestion[] = [];
    if (jsonMatch) {
      try { figures = JSON.parse(jsonMatch[0]) as FigureSuggestion[]; } catch { figures = []; }
    }

    res.json({ figures });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message, figures: [] });
  }
});

export default router;
