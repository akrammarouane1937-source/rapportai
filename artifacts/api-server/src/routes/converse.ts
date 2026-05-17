import { Router, type Request, type Response } from "express";

const router = Router();

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// ─── Step-specific system prompts ────────────────────────────────────────────

const STEP_SYSTEMS: Record<number, string> = {
  3: `Tu es l'assistant de RapportAI pour l'étape "Dédicaces & Remerciements".
Ton rôle : comprendre naturellement ce que l'étudiant veut inclure, puis générer les deux sections.

Comportement attendu :
- Pose UNE seule question à la fois, naturellement
- Si l'étudiant mentionne des amis, de la famille, des profs à remercier → note-le même s'il ne répond pas à ta question exacte
- Comprends le sens de ce que dit l'étudiant, pas juste les mots exacts
- "IA", "génère", "auto", "oui", réponse vide → génère directement
- Génère d'abord les dédicaces PUIS les remerciements (deux appels séparés)
- Quand les deux sont générées → appelle step_complete
- Ton registre : chaleureux, humain, pas formel`,

  4: `Tu es l'assistant de RapportAI pour l'étape "Résumé & Abstract".
Une seule question : "Tu veux ajouter des mots-clés particuliers ?"
Si non/passer → génère directement résumé FR puis abstract EN.
Quand les deux sont générés → appelle step_complete.`,

  5: `Tu es l'assistant de RapportAI pour l'étape "Sommaire".
L'utilisateur vient d'arriver → génère le sommaire IMMÉDIATEMENT sans demander rien.
Après génération, dis que l'étudiant peut demander des modifications.
Quand l'étudiant est satisfait → step_complete.`,

  6: `Tu es l'assistant de RapportAI pour l'étape "Introduction Générale".
Demande s'il y a un contexte particulier à inclure. Si non/passer → génère directement.
Après génération → step_complete.`,

  9: `Tu es l'assistant de RapportAI pour l'étape "Conclusion, Bibliographie & Export".
Demande les apports/limites puis les perspectives futures, puis génère dans cet ordre :
1. La conclusion (section "conclusion")
2. La bibliographie (section "bibliographie")
3. Les abréviations (section "abbreviations")
Si l'étudiant dit "génère" à tout moment → génère tout immédiatement dans cet ordre.
Quand les trois sections sont générées → step_complete.`,
};

const TOOLS = [
  {
    name: "generate_section",
    description: "Déclenche la génération d'une section du rapport. Inclus dans 'context' TOUS les noms, préférences et détails mentionnés par l'étudiant.",
    input_schema: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          description: "ID de la section: dedicaces | remerciements | resume | abstract | sommaire | introduction | conclusion | bibliographie | abbreviations",
        },
        context: {
          type: "string",
          description: "Instructions complètes pour l'agent de génération. Liste tous les noms de personnes, demandes spécifiques, et contraintes mentionnées par l'étudiant.",
        },
      },
      required: ["section", "context"],
    },
  },
  {
    name: "step_complete",
    description: "Appelle ceci quand toutes les sections requises pour cette étape ont été générées et que l'étudiant est satisfait.",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "Message de confirmation affiché à l'étudiant" },
      },
      required: ["message"],
    },
  },
];

// ─── POST /api/converse ───────────────────────────────────────────────────────

router.post("/converse", async (req: Request, res: Response) => {
  const {
    messages,
    step,
    profile = {},
    generatedSections = [],
  } = req.body as {
    messages: { role: "user" | "assistant"; content: string }[];
    step: number;
    profile: Record<string, string>;
    generatedSections: string[];
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    return;
  }

  const stepSystem = STEP_SYSTEMS[step] ?? "Tu es l'assistant de RapportAI. Aide l'étudiant en français.";

  const system = `${stepSystem}

Profil de l'étudiant :
- Nom : ${profile.studentName ?? ""}
- École : ${profile.school ?? ""}
- Filière : ${profile.filiere ?? ""}
- Type : ${profile.reportType ?? ""}
- Thème : ${profile.theme ?? ""}
${profile.encadrantPeda ? `- Encadrant pédagogique : ${profile.encadrantPeda}` : ""}
${profile.encadrantPro ? `- Encadrant professionnel : ${profile.encadrantPro}` : ""}
${profile.entreprise ? `- Entreprise : ${profile.entreprise}` : ""}

Sections déjà générées cette étape : ${generatedSections.length > 0 ? generatedSections.join(", ") : "aucune"}

IMPORTANT : Réponds toujours en français. Sois naturel et humain, pas robotique.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const anthropicRes = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        stream: true,
        system,
        messages,
        tools: TOOLS,
        tool_choice: { type: "auto" },
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      res.write(`data: ${JSON.stringify({ error: `API error: ${errText.slice(0, 200)}` })}\n\n`);
      res.end();
      return;
    }

    const reader = anthropicRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentToolName = "";
    let currentToolInput = "";
    let inToolUse = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;

        let event: Record<string, unknown>;
        try { event = JSON.parse(raw); } catch { continue; }

        const type = event.type as string;

        if (type === "content_block_start") {
          const block = event.content_block as { type: string; name?: string };
          if (block.type === "tool_use") {
            inToolUse = true;
            currentToolName = block.name ?? "";
            currentToolInput = "";
          }
        }

        if (type === "content_block_delta") {
          const delta = event.delta as { type: string; text?: string; partial_json?: string };
          if (delta.type === "text_delta" && delta.text) {
            res.write(`data: ${JSON.stringify({ text: delta.text })}\n\n`);
          }
          if (delta.type === "input_json_delta" && delta.partial_json) {
            currentToolInput += delta.partial_json;
          }
        }

        if (type === "content_block_stop" && inToolUse) {
          inToolUse = false;
          let toolInput: Record<string, unknown> = {};
          try { toolInput = JSON.parse(currentToolInput); } catch { /* malformed */ }
          res.write(`data: ${JSON.stringify({ action: { type: currentToolName, ...toolInput } })}\n\n`);
          currentToolName = "";
          currentToolInput = "";
        }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
