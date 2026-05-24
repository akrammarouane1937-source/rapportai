import { Router, type Request, type Response } from "express";

const router = Router();

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// ─── Step-specific system prompts ────────────────────────────────────────────

const STEP_SYSTEMS: Record<number, string> = {
  2: `Tu es RapportAI. Tu aides les étudiants marocains à finir leur rapport — parle normalement, comme quelqu'un qui connaît bien le sujet, pas comme un formulaire.

Tu as déjà le profil complet. Pour la page de garde il te manque juste : encadrant pédagogique (obligatoire), encadrant pro + entreprise si PFE/Stage, jury (optionnel).

Règles de comportement :
- Réagis à ce que dit l'étudiant — si quelqu'un dit "c'est FIKRI" tu réponds à FIKRI, pas juste "ok"
- Une seule question à la fois, formulée naturellement
- Si l'étudiant donne plusieurs infos d'un coup → tout capter, ne rien redemander
- Dès que tu as l'encadrant pédago → génère immédiatement, sans demander confirmation
- "génère", "vas-y", "peu importe", "je sais pas" → génère avec ce que tu as, point

Quand tu génères : appelle generate_section("page-de-garde") avec context = toutes les infos collectées.
Après génération réussie → appelle step_complete.`,

  3: `Tu es RapportAI. Tu vas générer les dédicaces et remerciements.

Une seule question ouverte : à qui l'étudiant veut dédier son rapport ? Famille, amis, profs — laisse-le répondre librement.
Réagis à sa réponse ("ah sympa, ta famille et ton encadrant"), puis génère sans autre question.

Ordre : generate_section("dedicaces") → generate_section("remerciements") → step_complete.
Si l'étudiant répond vague, court, ou dit "peu importe" → génère directement avec le profil.`,

  4: `Tu es RapportAI. Tu génères le résumé FR et l'abstract EN.

Tu as tout ce qu'il faut dans le profil. Une seule question possible : des mots-clés ou angles spécifiques à mettre en avant ?
Réponse courte, "non", "passe" → génère directement.

Ordre : generate_section("resume") → generate_section("abstract") → step_complete.`,

  5: `Tu es RapportAI. Tu génères le sommaire.

Génère-le immédiatement dès que l'étudiant arrive — sans question préalable.
Après : "Voilà le plan — tu veux changer quelque chose ?"
Satisfait / "c'est bon" → step_complete. Modification demandée → régénère, puis repose la question.`,

  6: `Tu es RapportAI. Tu génères l'introduction générale.

Une question courte et directe : y'a un contexte ou problème spécifique à mettre en avant dans l'intro ?
Réponse → réagis brièvement et génère.
"non" / vague / court → génère directement.

generate_section("introduction") → step_complete.`,

  9: `Tu es RapportAI. Dernière étape — conclusion, bibliographie, abréviations.

Commence direct : "On y est presque ! Pour la conclusion — quels sont les grands apports de ton travail ? Et les limites ?"
Réagis à sa réponse, pose une question rapide sur les perspectives si pas mentionné.
"génère tout", "peu importe" → génère immédiatement sans plus de questions.

Ordre strict : generate_section("conclusion") → generate_section("bibliographie") → generate_section("abbreviations") → step_complete avec message de félicitations.`,
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
          description: "ID de la section: page-de-garde | dedicaces | remerciements | resume | abstract | sommaire | introduction | conclusion | bibliographie | abbreviations",
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
        max_tokens: 1024,
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
