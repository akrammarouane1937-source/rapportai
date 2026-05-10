import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { findClaudeBinary } from "../lib/find-claude-binary";

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
  description: string;
  caption: string;
  suggested_data?: string;
}

router.post("/figures/analyze", async (req: Request, res: Response) => {
  const body = req.body as FigureAnalyzeBody;
  const ctx = body.reportContext ?? {};
  const hasData = Array.isArray(body.columns) && body.columns.length > 0;

  const theme   = ctx.theme      ?? "sujet non précisé";
  const filiere = ctx.filiere    ?? "gestion";
  const type    = ctx.reportType ?? "rapport de fin d'études";

  const claudeBinary = findClaudeBinary();

  const dataSection = hasData
    ? `Données importées : ${body.rowCount ?? "?"} lignes.\nColonnes : ${body.columns.join(", ")}\n\nAperçu (5 premières lignes) :\n${body.preview}`
    : `Aucune donnée importée. Suggère quelles figures l'étudiant DEVRAIT créer, précise les données à collecter dans "suggested_data".`;

  const prompt = `Tu es un expert en visualisation de données pour rapports académiques marocains (${type}).
Thème : ${theme} | Filière : ${filiere}

${dataSection}

Génère exactement 2 à 4 suggestions de figures pertinentes.
Retourne UNIQUEMENT un tableau JSON valide (zéro texte avant ou après) :
[
  {
    "id": "fig-1",
    "figureNumber": 1,
    "title": "Titre court (6 mots max)",
    "type": "bar",
    "placement": "Partie I",
    "x_column": "Colonne X ou null",
    "y_columns": ["Colonne Y"],
    "description": "Comme le montre la Figure 1 ci-dessous, [phrase académique].",
    "caption": "Figure 1 — Titre complet"${!hasData ? ',\n    "suggested_data": "Données à collecter"' : ""}
  }
]`;

  try {
    let fullText = "";

    for await (const message of query({
      prompt,
      options: {
        maxTurns: 1,
        allowedTools: [],
        ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") fullText += block.text;
        }
      }
    }

    const jsonMatch = fullText.match(/\[[\s\S]*\]/);
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
