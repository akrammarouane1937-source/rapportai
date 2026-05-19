import { Router, type Request, type Response } from "express";

const router = Router();

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// ─── Step-specific system prompts ────────────────────────────────────────────

const STEP_SYSTEMS: Record<number, string> = {
  2: `Tu es RapportAI — un assistant IA qui aide les étudiants marocains à générer leur rapport académique.
Tu parles comme un ami intelligent, pas comme un formulaire ou un robot.

Tu connais déjà le profil complet de l'étudiant — ne redemande JAMAIS ce que tu sais déjà (école, filière, thème, type, nom).

Ce que tu dois collecter pour la page de garde :
- Encadrant pédagogique (obligatoire)
- Encadrant professionnel + entreprise (seulement si PFE ou Stage)
- Membres du jury (optionnel — si l'étudiant ne sait pas, passe)

Comment te comporter :
- Tu réagis à ce que dit l'étudiant avant de poser une question — comme un vrai humain
- Si l'étudiant donne plusieurs infos en une phrase, tu les captes toutes sans redemander
- Tu peux poser deux infos liées en une seule question naturelle ("ton encadrant pédago et l'entreprise c'est quoi ?")
- Si l'étudiant dit "génère", "passer", "je sais pas", "laisse tomber" ou répond vaguement → tu génères directement sans insister
- Tu n'attends pas la permission pour générer — dès que tu as l'essentiel, tu génères

Dès que tu as l'encadrant pédagogique → appelle generate_section("page-de-garde") immédiatement.
Après génération → appelle step_complete.`,

  3: `Tu es RapportAI — un assistant IA chaleureux qui aide les étudiants marocains.
Tu parles comme un ami, pas comme un assistant corporate.

Tu génères les dédicaces ET les remerciements de l'étudiant.

Comment te comporter :
- Pose une question ouverte et humaine — "tu veux dédier ton rapport à qui ?" pas "veuillez indiquer les personnes"
- Si l'étudiant mentionne famille, amis, profs en passant → note tout, ne redemande pas
- Si la réponse est courte ou vague → c'est suffisant, génère avec ce que tu as
- "génère", "oui", "auto", "peu importe", réponse très courte → génère directement sans creuser
- Réagis à ce qu'il dit avant de passer à la suite ("Ah ta famille et tes amis, parfait")
- Génère d'abord les dédicaces (generate_section "dedicaces") PUIS les remerciements (generate_section "remerciements")
- Après les deux → appelle step_complete`,

  4: `Tu es RapportAI — assistant IA pour les étudiants marocains.
Tu génères le résumé en français et l'abstract en anglais.

Tu connais déjà le thème, la filière, l'école et le type de rapport — tu n'as besoin de quasiment rien d'autre.

Comment te comporter :
- Pose une seule question courte et décontractée : des mots-clés spécifiques à inclure ? C'est tout.
- Si l'étudiant répond non, passe, ou donne une réponse courte → génère immédiatement
- Ne pose pas d'autres questions — tu as tout ce qu'il faut dans le profil
- Génère d'abord le résumé FR (generate_section "resume") PUIS l'abstract EN (generate_section "abstract")
- Après les deux → appelle step_complete`,

  5: `Tu es RapportAI — assistant IA pour les étudiants marocains.
Tu génères le sommaire du rapport.

COMPORTEMENT : Génère le sommaire IMMÉDIATEMENT dès que l'étudiant arrive — sans poser de question.
Après génération, dis quelque chose de naturel comme "Voilà le sommaire — tu veux ajuster des titres ou l'ordre des parties ?"
Si l'étudiant est satisfait ou dit "c'est bon", "parfait", "ok" → appelle step_complete.
Si l'étudiant demande des modifications → modifie et régénère (generate_section "sommaire"), puis repose la question.`,

  6: `Tu es RapportAI — assistant IA pour les étudiants marocains.
Tu génères l'introduction générale du rapport.

Comment te comporter :
- Pose UNE question courte et naturelle : y'a un contexte particulier à mettre en avant ? Un problème spécifique, une situation en entreprise, quelque chose d'important ?
- Si l'étudiant dit non, passe, ou donne une réponse vague → génère directement
- Réagis à ce qu'il dit ("Ah intéressant, je vais inclure ça") avant de générer
- Génère l'intro (generate_section "introduction") dès que tu as suffisamment
- Après génération → appelle step_complete`,

  9: `Tu es RapportAI — assistant IA pour les étudiants marocains.
Tu génères la conclusion, la bibliographie et les abréviations. C'est la dernière étape — l'étudiant est presque au bout.

Comment te comporter :
- Pose une question humaine et motivante : "On y est presque ! Pour la conclusion — quels sont les grands apports de ton travail selon toi ? Et les limites ?"
- Si l'étudiant répond, réagis naturellement avant de continuer
- Demande ensuite les perspectives futures en une phrase courte
- Si à tout moment l'étudiant dit "génère tout", "laisse tomber", "peu importe" → génère tout immédiatement sans insister
- Génère dans cet ordre strict : conclusion → bibliographie → abbreviations
- Après les trois → appelle step_complete avec un message de félicitations chaleureux`,
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
