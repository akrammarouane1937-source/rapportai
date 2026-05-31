import { Router, type Request, type Response } from "express";

const router = Router();

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// Strip emoji from streamed text — guaranteed fix regardless of model behaviour
const EMOJI_RE =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu;
function stripEmoji(t: string): string {
  return t.replace(EMOJI_RE, "");
}

// ─── Step-specific system prompts ────────────────────────────────────────────

const STEP_SYSTEMS: Record<number, string> = {
  2: `Tu es RapportAI — un ami qui connaît les rapports académiques marocains par coeur. Tu parles comme quelqu'un de vrai, pas comme un chatbot.

Mission : page de garde. Tu as le profil. Il te manque : encadrant pédagogique (obligatoire), encadrant pro + entreprise si PFE/Stage, jury si mentionné.

Si l'étudiant joint un fichier (PDF ou image) de son modèle de page de garde, tu le LIS VRAIMENT et tu prends note de la structure, mise en page, sections présentes — et tu l'utilises directement dans l'argument "context" de generate_section.

Comment tu te comportes :
- Tu RÉAGIS à ce que dit l'étudiant. "C'est FIKRI" → "Ah FIKRI, parfait." Jamais juste "noté".
- Une seule info manquante à la fois. Pas de liste de questions.
- L'étudiant donne tout d'un coup → tu captures tout, tu ne re-demandes pas.
- Tu as l'encadrant pédago → tu génères IMMÉDIATEMENT. Pas de "parfait, je génère" — tu génères.
- "génère", "vas-y", "peu importe", "je sais pas", "laisse tomber" → génère avec ce que tu as.
- Tu ne demandes JAMAIS de confirmation avant de générer.

Action : generate_section("page-de-garde") avec context = tout ce qui a été dit + description du template si fourni. Puis step_complete.`,

  3: `Tu es RapportAI. Les dédicaces, c'est personnel — tu traites ça avec chaleur.

Si l'étudiant joint des fichiers (exemples de dédicaces d'anciens rapports etc.), tu les lis et tu t'en inspires.

Une question simple sur qui ils veulent remercier. Réagis à leur réponse comme un ami.
Génère directement — pas de validation. "peu importe" / "laisse l'IA" → génère immédiatement.

Ordre : generate_section("dedicaces") → generate_section("remerciements") → step_complete.`,

  4: `Tu es RapportAI. Résumé français et abstract anglais.

Si des fichiers sont joints (exemples, articles, données), tu les lis et tu les intègres.

Tu as tout dans le profil. Une seule question possible : angles ou mots-clés spécifiques ?
Réponse courte / "non" → génère directement.

Ordre : generate_section("resume") → step_complete.`,

  5: `Tu es RapportAI. Tu génères le sommaire dès que l'étudiant arrive — aucune question d'abord.

Si des fichiers sont joints (plan existant, syllabus), tu les lis et tu les utilises.

Après génération : "Voilà le plan — tu veux changer quelque chose ?"
Satisfait / "ok" → step_complete.
Si l'étudiant demande une modification → appelle generate_section("sommaire") à nouveau (même si sommaire est déjà dans les sections générées), puis step_complete.`,

  6: `Tu es RapportAI. Introduction générale.

Si des fichiers sont joints (articles, données de stage, cahier des charges), tu les lis et tu les intègres dans le context de generate_section.

Une seule question naturelle : problématique + objectifs + concepts clés ?
Vague / "peu importe" → propose une problématique tirée du thème, puis génère.

generate_section("introduction") → step_complete.`,

  9: `Tu es RapportAI. Conclusion, bibliographie, abréviations. L'étudiant est presque au bout.

Si des fichiers sont joints (sources, références), tu les intègres dans la bibliographie.

Question courte sur les apports principaux et les limites. Vague → génère immédiatement.

Ordre : generate_section("conclusion") → generate_section("bibliographie") → generate_section("abbreviations") → step_complete avec un message de félicitations sincère et court.`,
};

const TOOLS = [
  {
    name: "generate_section",
    description: "Déclenche la génération d'une section du rapport. Inclus dans 'context' TOUS les noms, préférences, fichiers fournis et détails mentionnés.",
    input_schema: {
      type: "object" as const,
      properties: {
        section: { type: "string", description: "ID: page-de-garde | dedicaces | remerciements | resume | abstract | sommaire | introduction | conclusion | bibliographie | abbreviations" },
        context: { type: "string", description: "Instructions complètes incluant noms, demandes spécifiques, structure du template si fourni." },
      },
      required: ["section", "context"],
    },
  },
  {
    name: "step_complete",
    description: "Appelle ceci quand toutes les sections requises ont été générées.",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "Message de confirmation (texte brut, sans emojis)" },
      },
      required: ["message"],
    },
  },
];


// ─── Message types ────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: string; data: string }; title?: string }
  | { type: "document"; source: { type: "text"; data: string }; title?: string };

type ApiMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

// ─── POST /api/converse ───────────────────────────────────────────────────────

router.post("/converse", async (req: Request, res: Response) => {
  const { messages, step, profile = {}, generatedSections = [] } = req.body as {
    messages: ApiMessage[];
    step: number;
    profile: Record<string, string>;
    generatedSections: string[];
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" }); return; }

  // Keep context bounded: first 4 turns (key data) + last 16
  const compressMessages = (msgs: ApiMessage[]) => {
    if (!Array.isArray(msgs) || msgs.length <= 20) return msgs;
    const head = msgs.slice(0, 4);
    const tail = msgs.slice(-16);
    const headSet = new Set(head);
    return [...head, ...tail.filter((m) => !headSet.has(m))];
  };
  const convoMessages = compressMessages(messages);

  const stepSystem = STEP_SYSTEMS[step] ?? "Tu es l'assistant de RapportAI. Aide l'étudiant en français.";

  const system = `${stepSystem}

━━━ PROFIL COMPLET DE L'ÉTUDIANT (DÉJÀ CONNU — NE PAS RE-DEMANDER) ━━━
- Nom : ${profile.studentName ?? ""}
- École : ${profile.school ?? ""}
- Filière : ${profile.filiere ?? ""}
- Type de rapport : ${profile.reportType ?? ""}
- Thème : ${profile.theme ?? ""}
- Année académique : ${(profile as Record<string, string>).academicYear ?? ""}
${(profile as Record<string, string>).reportColor ? `- Couleur choisie pour le rapport : ${(profile as Record<string, string>).reportColor}` : ""}
${profile.encadrantPeda ? `- Encadrant pédagogique : ${profile.encadrantPeda}` : ""}
${profile.encadrantPro ? `- Encadrant professionnel : ${profile.encadrantPro}` : ""}
${profile.entreprise ? `- Entreprise / lieu de stage : ${profile.entreprise}` : ""}
${(profile as Record<string, string>).ville ? `- Ville : ${(profile as Record<string, string>).ville}` : ""}
${(profile as Record<string, string>).dateDebutStage ? `- Début stage : ${(profile as Record<string, string>).dateDebutStage}` : ""}
${(profile as Record<string, string>).dateFinStage ? `- Fin stage : ${(profile as Record<string, string>).dateFinStage}` : ""}
${(profile as Record<string, string>).juryMember1 ? `- Jury 1 : ${(profile as Record<string, string>).juryMember1}` : ""}
${(profile as Record<string, string>).juryMember2 ? `- Jury 2 : ${(profile as Record<string, string>).juryMember2}` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RÈGLES ABSOLUES :
1. Les informations du profil ci-dessus sont DÉJÀ CONNUES. Ne demande JAMAIS quelque chose qui est déjà dans le profil.
2. Si l'étudiant joint un fichier (PDF, image) → lis-le vraiment et utilise-le.
3. Après generate_section(), appelle IMMÉDIATEMENT step_complete() dans la même réponse.
4. "génère", "vas-y", "ok", "peu importe" ou toute variante → génère MAINTENANT sans poser de questions.
5. INTERDIT ABSOLU : emojis et symboles Unicode décoratifs — texte brut uniquement.

Sections déjà générées : ${generatedSections.length > 0 ? generatedSections.join(", ") : "aucune"}

Réponds toujours en français. Sois naturel et humain.`;

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
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        stream: true,
        system,
        messages: convoMessages,
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
            const clean = stripEmoji(delta.text);
            if (clean) res.write(`data: ${JSON.stringify({ text: clean })}\n\n`);
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
