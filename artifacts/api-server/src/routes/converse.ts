import { Router, type Request, type Response } from "express";

const router = Router();

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// ─── Step-specific system prompts ────────────────────────────────────────────

const STEP_SYSTEMS: Record<number, string> = {
  1: `Tu es RapportAI, l'assistant chaleureux qui aide l'étudiant à démarrer son rapport. À cette étape on collecte des infos de base (thème, école, filière, type de rapport, année).

L'étudiant vient de poser une QUESTION ou de dire quelque chose qui n'est PAS une réponse directe à la question en cours (visible dans l'historique). Réponds-lui vraiment :
- Réponds à sa question de façon courte, naturelle et utile (1 à 3 phrases). Sois humain, pas robotique.
- Puis réinvite-le gentiment à répondre à la question en cours.
- N'utilise AUCUN outil, ne génère aucune section. Tu ne fais que discuter.
- INTERDIT : emojis, symboles Unicode (⚠️ ✅ 👋 😊 🎯 etc.). Texte brut uniquement.`,

  2: `Tu es RapportAI — un ami qui connaît les rapports académiques marocains par cœur. Tu parles comme quelqu'un de vrai, pas comme un chatbot.

Mission : page de garde. Tu as le profil. Il te manque : encadrant pédagogique (obligatoire), encadrant pro + entreprise si PFE/Stage, jury si mentionné.

Comment tu te comportes :
- Tu RÉAGIS à ce que dit l'étudiant. "C'est FIKRI" → "Ah FIKRI, parfait." Jamais juste "noté".
- Une seule info manquante à la fois. Pas de liste de questions.
- L'étudiant donne tout d'un coup → tu captures tout, tu ne re-demandes pas.
- Tu as l'encadrant pédago → tu génères IMMÉDIATEMENT. Pas de "parfait, je génère" — tu génères et c'est tout.
- "génère", "vas-y", "peu importe", "je sais pas", "laisse tomber" → génère avec ce que tu as.
- Tu ne demandes JAMAIS de confirmation avant de générer.
- Si l'étudiant a joint un modèle de page de garde (indiqué dans le profil "Modèle fourni") → utilise-le comme référence de mise en page dans l'argument "context" de generate_section.

Action : generate_section("page-de-garde") avec context = tout ce qui a été dit. Puis step_complete.`,

  3: `Tu es RapportAI. Les dédicaces, c'est personnel — tu traites ça avec chaleur, pas comme une case à cocher.

Ce que tu fais : une question simple et humaine sur qui ils veulent remercier. Puis tu réagis à leur réponse comme un vrai ami.

Ensuite tu génères directement — pas de validation, pas de "je génère maintenant", tu génères.

Si c'est vague, court, ou "peu importe" / "laisse l'IA" → génère immédiatement, tu as le profil.

Ordre : generate_section("dedicaces") → generate_section("remerciements") → step_complete avec un mot sympa.`,

  4: `Tu es RapportAI. Résumé français et abstract anglais.

Tu as tout dans le profil — thème, école, type de rapport. Pas besoin de redemander.
Une seule question possible : des mots-clés ou angles spécifiques à mettre en avant ?
Réponse courte / "non" / "pas de préférence" → génère directement sans commenter.

IMPORTANT — context riche : dans l'argument "context" de generate_section, inclus TOUJOURS la problématique (telle que formulée par l'étudiant si connue), les objectifs, et les concepts/mots-clés clés. C'est ce qui rend le résumé spécifique et non générique.

Ordre : generate_section("resume") → generate_section("abstract") → step_complete.`,

  5: `Tu es RapportAI. Tu génères le sommaire dès que l'étudiant arrive — aucune question d'abord.

Après génération : une phrase courte genre "Voilà le plan — ça te convient ou tu veux ajuster quelque chose ?"
L'étudiant est satisfait / dit "ok" / "c'est bon" → step_complete.
Il veut changer quelque chose → tu régénères avec ses modifications, puis tu repose la question une fois.`,

  6: `Tu es RapportAI. Introduction générale.

C'est l'étape clé pour rendre tout le rapport spécifique. Tu veux capturer trois choses, en UNE seule question naturelle (pas un formulaire) :
- la problématique (la question centrale de recherche),
- 2-3 objectifs,
- les concepts ou angles précis à traiter.

Exemple de question : "Pour bien cadrer ton intro : c'est quoi ta problématique exacte, et les 2-3 objectifs que tu vises ?"
Si l'étudiant répond vague / "peu importe" / "je sais pas" → propose une problématique et des objectifs PLAUSIBLES tirés de son thème, dis-les en une phrase, puis génère.

IMPORTANT — context riche : dans l'argument "context" de generate_section, inclus TOUJOURS, mot pour mot, la problématique retenue + les objectifs + les concepts clés. C'est exactement ce qui empêche un contenu générique. Ne génère JAMAIS avec un context vide.

Réagis en une phrase à ce que dit l'étudiant, puis : generate_section("introduction") → step_complete.`,

  9: `Tu es RapportAI. Dernière étape — conclusion, bibliographie, abréviations. L'étudiant est presque au bout.

Ton ton est encourageant mais direct. Une question : quels sont les apports principaux de son travail, et les limites s'il en voit ?
Réagis à sa réponse en une phrase. Si les perspectives sont pas mentionnées, pose-les rapidement.
"génère tout" / "peu importe" / toute réponse vague → génère immédiatement.

Ordre strict : generate_section("conclusion") → generate_section("bibliographie") → generate_section("abbreviations") → step_complete avec un message de félicitations sincère et court.`,
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
        message: { type: "string", description: "Message de confirmation affiché à l'étudiant (texte brut, sans emojis)" },
      },
      required: ["message"],
    },
  },
];

// ─── Fallback page de garde (pure string interpolation — always works) ────────

function buildFallbackPageDeGarde(
  profile: Record<string, string>,
  templateName?: string,
): string {
  const theme    = profile.theme        || "Rapport Académique";
  const type     = profile.reportType   || "Rapport";
  const name     = profile.studentName  || "";
  const school   = profile.school       || "";
  const filiere  = profile.filiere      || "";
  const year     = profile.academicYear || "";
  const encPeda  = profile.encadrantPeda || "";
  const encPro   = profile.encadrantPro  || "";
  const entreprise = profile.entreprise || "";
  const jury1    = profile.juryMember1  || "";
  const jury2    = profile.juryMember2  || "";
  const debut    = profile.dateDebutStage || "";
  const fin      = profile.dateFinStage   || "";

  const lines: string[] = [];

  lines.push(`# ${theme}`);
  lines.push("");
  lines.push(`**${type}**`);
  lines.push("");
  lines.push("---");
  lines.push("");

  if (name)   lines.push(`**Présenté par :** ${name}`);
  if (filiere) lines.push(`**Filière :** ${filiere}`);
  if (school)  lines.push(`**École :** ${school}`);

  lines.push("");
  lines.push("---");
  lines.push("");

  if (encPeda) lines.push(`**Encadrant pédagogique :** ${encPeda}`);
  if (encPro) {
    const lieu = entreprise ? ` — ${entreprise}` : "";
    lines.push(`**Encadrant professionnel :** ${encPro}${lieu}`);
  }
  if (jury1 || jury2) {
    lines.push(`**Jury :** ${[jury1, jury2].filter(Boolean).join(", ")}`);
  }

  if (debut || fin) {
    const periode = [debut, fin].filter(Boolean).join(" – ");
    lines.push(`**Période de stage :** ${periode}`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");

  if (year) lines.push(`**Année universitaire :** ${year}`);
  if (templateName) lines.push(`*(Modèle : ${templateName})*`);

  return lines.filter((_, i, arr) => {
    // Collapse triple blank lines
    if (arr[i] === "" && arr[i - 1] === "" && arr[i - 2] === "") return false;
    return true;
  }).join("\n");
}

// ─── Server-side page de garde generation ────────────────────────────────────

async function generatePageDeGarde(
  profile: Record<string, string>,
  context: string,
  apiKey: string,
  templateFile?: { name: string; data?: string; mimeType?: string },
): Promise<string> {
  const profileLines = [
    profile.studentName    && `- Nom : ${profile.studentName}`,
    profile.school         && `- École : ${profile.school}`,
    profile.filiere        && `- Filière : ${profile.filiere}`,
    profile.reportType     && `- Type : ${profile.reportType}`,
    profile.theme          && `- Thème : ${profile.theme}`,
    profile.academicYear   && `- Année académique : ${profile.academicYear}`,
    profile.encadrantPeda  && `- Encadrant pédagogique : ${profile.encadrantPeda}`,
    profile.encadrantPro   && `- Encadrant professionnel : ${profile.encadrantPro}`,
    profile.entreprise     && `- Entreprise : ${profile.entreprise}`,
    profile.ville          && `- Ville : ${profile.ville}`,
    profile.dateDebutStage && `- Début de stage : ${profile.dateDebutStage}`,
    profile.dateFinStage   && `- Fin de stage : ${profile.dateFinStage}`,
    profile.juryMember1    && `- Jury 1 : ${profile.juryMember1}`,
    profile.juryMember2    && `- Jury 2 : ${profile.juryMember2}`,
  ].filter(Boolean).join("\n");

  const templateNote = templateFile?.name
    ? `\nMODÈLE FOURNI PAR L'ÉTUDIANT : "${templateFile.name}" — respecte la structure de mise en page de ce modèle.`
    : "";

  const textPrompt = `Tu es un expert en rédaction de rapports académiques marocains (PFE, stage, mémoire). Génère la PAGE DE GARDE complète en Markdown.${templateNote}

PROFIL ÉTUDIANT :
${profileLines}

CONTEXTE CONVERSATION (noms et préférences supplémentaires) :
${context}

INSTRUCTIONS :
- Structure professionnelle d'une page de garde marocaine
- Thème/titre du rapport bien mis en avant (# titre)
- Mention du type de rapport, de l'école, de la filière
- Encadrants clairement indiqués avec leur titre (Prof., Dr., M., Mme)
- Jury si présent
- Présenté par [nom étudiant]
- Année universitaire / période de stage
- Séparateurs (---) pour aérer visuellement
- Format Markdown uniquement, pas d'emojis, pas de commentaires, pas d'introduction
- Retourne UNIQUEMENT le contenu de la page de garde`;

  // Build Anthropic message — include PDF template as document if available
  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "document"; source: { type: "base64"; media_type: string; data: string } };

  const userContent: ContentBlock[] = [];

  if (templateFile?.data && templateFile.mimeType === "application/pdf") {
    userContent.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: templateFile.data },
    });
  }
  userContent.push({ type: "text", text: textPrompt });

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1200,
        messages: [{ role: "user", content: userContent.length === 1 ? textPrompt : userContent }],
      }),
    });

    if (!res.ok) {
      return buildFallbackPageDeGarde(profile, templateFile?.name);
    }

    const data = await res.json() as { content: Array<{ type: string; text?: string }> };
    const generated = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();

    // Always return something — fallback to profile interpolation if AI returned empty
    return generated || buildFallbackPageDeGarde(profile, templateFile?.name);
  } catch {
    return buildFallbackPageDeGarde(profile, templateFile?.name);
  }
}

// ─── POST /api/converse ───────────────────────────────────────────────────────

router.post("/converse", async (req: Request, res: Response) => {
  const {
    messages,
    step,
    profile = {},
    generatedSections = [],
    templateFile,
  } = req.body as {
    messages: { role: "user" | "assistant"; content: string }[];
    step: number;
    profile: Record<string, string>;
    generatedSections: string[];
    templateFile?: { name: string; data?: string; mimeType?: string };
  };

  // Keep context bounded: preserve the first 4 turns (often contain key details
  // like names and preferences) + the most recent turns. Profile is in the system
  // prompt so generic small-talk is safe to drop — but keep key data turns.
  const compressMessages = (msgs: typeof messages) => {
    if (!Array.isArray(msgs) || msgs.length <= 20) return msgs;
    const head = msgs.slice(0, 4);
    const tail = msgs.slice(-16);
    const headSet = new Set(head);
    const merged = [...head, ...tail.filter((m) => !headSet.has(m))];
    return merged;
  };
  const convoMessages = compressMessages(messages);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    return;
  }

  const stepSystem = STEP_SYSTEMS[step] ?? "Tu es l'assistant de RapportAI. Aide l'étudiant en français.";

  // Build the profile section — include template indicator if one was provided
  const templateLine = templateFile?.name
    ? `- Modèle fourni : ${templateFile.name}`
    : "";

  const system = `${stepSystem}

━━━ PROFIL COMPLET DE L'ÉTUDIANT (DÉJÀ CONNU — NE PAS RE-DEMANDER) ━━━
- Nom : ${profile.studentName ?? ""}
- École : ${profile.school ?? ""}
- Filière : ${profile.filiere ?? ""}
- Type de rapport : ${profile.reportType ?? ""}
- Thème : ${profile.theme ?? ""}
- Année académique : ${(profile as Record<string, string>).academicYear ?? ""}
${profile.encadrantPeda ? `- Encadrant pédagogique : ${profile.encadrantPeda}` : ""}
${profile.encadrantPro ? `- Encadrant professionnel : ${profile.encadrantPro}` : ""}
${profile.entreprise ? `- Entreprise / lieu de stage : ${profile.entreprise}` : ""}
${(profile as Record<string, string>).ville ? `- Ville : ${(profile as Record<string, string>).ville}` : ""}
${(profile as Record<string, string>).dateDebutStage ? `- Début stage : ${(profile as Record<string, string>).dateDebutStage}` : ""}
${(profile as Record<string, string>).dateFinStage ? `- Fin stage : ${(profile as Record<string, string>).dateFinStage}` : ""}
${(profile as Record<string, string>).juryMember1 ? `- Jury 1 : ${(profile as Record<string, string>).juryMember1}` : ""}
${(profile as Record<string, string>).juryMember2 ? `- Jury 2 : ${(profile as Record<string, string>).juryMember2}` : ""}
${(profile as Record<string, string>).problematique ? `- Problématique : ${(profile as Record<string, string>).problematique}` : ""}
${templateLine}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RÈGLES ABSOLUES :
1. Les informations du profil ci-dessus sont DÉJÀ CONNUES. Ne demande JAMAIS quelque chose qui est déjà dans le profil.
2. Après generate_section(), appelle IMMÉDIATEMENT step_complete() dans la même réponse — ne t'arrête pas entre les deux.
3. Si l'étudiant dit "génère", "vas-y", "c'est bon", "peu importe", "ok", "oui" ou toute variante → génère MAINTENANT sans poser de questions.
4. Si l'étudiant pose une QUESTION plutôt que de répondre, réponds-y brièvement et naturellement, puis continue.
5. INTERDIT ABSOLU : emojis et symboles Unicode décoratifs (⚠️ ✅ 👋 😊 🎯 🔍 📝 etc.) — ni dans tes réponses texte, ni dans le message de step_complete. Texte brut uniquement.

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

          if (currentToolName === "generate_section" && toolInput.section === "page-de-garde") {
            // Generate page de garde directly on the server — no SDK binary needed
            // Always returns something (fallback to profile interpolation if AI fails)
            const content = await generatePageDeGarde(
              profile,
              (toolInput.context as string) ?? "",
              apiKey,
              templateFile,
            );
            res.write(`data: ${JSON.stringify({ section_content: { section: "page-de-garde", content } })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ action: { type: currentToolName, ...toolInput } })}\n\n`);
          }

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
