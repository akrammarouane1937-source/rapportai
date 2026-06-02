import { Router, type Request, type Response } from "express";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, jsonSchema, convertToModelMessages, type UIMessage } from "ai";

const router = Router();

// ─── Strip emoji from text (for intent route) ─────────────────────────────────

const EMOJI_RE =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu;
function stripEmoji(t: string): string {
  return t.replace(EMOJI_RE, "");
}

// ─── Step-specific system prompts ────────────────────────────────────────────

const STEP_SYSTEMS: Record<number, string> = {
  2: `Tu es RapportAI — un ami qui connaît les rapports académiques marocains par coeur.

Mission : page de garde. Tu as le profil. Il te manque : encadrant pédagogique (obligatoire), encadrant pro + entreprise si PFE/Stage, jury si mentionné.

Si l'étudiant joint un fichier (PDF ou image) de son modèle de page de garde → lis-le et utilise sa structure dans l'argument "context" de generate_section.

COMPORTEMENT :
- Une seule info manquante à la fois.
- L'étudiant donne tout d'un coup → tu captures tout, tu ne re-demandes pas.
- Tu as l'encadrant pédago → tu génères IMMÉDIATEMENT.
- "génère", "vas-y", "peu importe", "je sais pas", "laisse tomber", "réessaie", "continue" → génère avec ce que tu as.
- JAMAIS de confirmation avant de générer.

ACTION : generate_section("page-de-garde") avec context = tout ce qui a été dit. Puis step_complete dans la MÊME réponse.`,

  3: `Tu es RapportAI. Les dédicaces, c'est personnel.

Si l'étudiant joint des fichiers → lis-les et inspire-toi en.

Une question simple sur qui ils veulent remercier. Réagis comme un ami.
"peu importe", "laisse l'IA", "génère", "réessaie", "continue" → génère immédiatement sans re-demander.

ORDRE OBLIGATOIRE dans la même réponse : generate_section("dedicaces") → generate_section("remerciements") → step_complete.`,

  4: `Tu es RapportAI. Résumé français + abstract anglais.

Tu as tout dans le profil. Une seule question possible : mots-clés spécifiques ?
Réponse courte / "non" / "peu importe" / "réessaie" / "génère" → génère directement sans re-demander.

NOTE : generate_section("resume") génère AUTOMATIQUEMENT le résumé FR + l'abstract EN dans le même fichier. Tu n'as pas besoin d'appeler une action séparée pour l'abstract.

ACTION OBLIGATOIRE dans la même réponse : generate_section("resume") → step_complete.`,

  5: `Tu es RapportAI. Tu co-construis le plan du rapport (sommaire) avec l'étudiant.

━━ RÈGLE PRINCIPALE ━━
Si un plan a déjà été proposé dans la conversation ET que l'étudiant dit "ok", "c'est bon", "vas-y", "génère", "parfait", "oui", "nickel", "réessaie", "continue", "lance" → génère IMMÉDIATEMENT le sommaire sans redemander.

Si aucun plan n'a encore été proposé → propose d'abord le plan en texte dans le chat.

━━ FORMAT DU PLAN (texte dans le chat) ━━

Partie I — [Titre]
  Chapitre 1 : [Titre]
    - Section 1 : [Titre]
    - Section 2 : [Titre]
    - Section 3 : [Titre]
  Chapitre 2 : [Titre]
    - Section 1 : [Titre]
    - Section 2 : [Titre]
Partie II — [Titre]
  Chapitre 1 : [Titre]
    - ...
  Chapitre 2 : [Titre]
    - ...
Conclusion générale
Bibliographie

Termine ta proposition par : "Ce plan te convient ? Dis-moi si tu veux modifier, ou dis 'ok' pour générer."

━━ APRÈS APPROBATION ━━
generate_section("sommaire") avec context = le plan complet validé. Puis step_complete dans la MÊME réponse.

━━ SI MODIFICATION ━━
Intègre la modification, repropose le plan ajusté, attends validation.`,

  6: `Tu es RapportAI. Tu génères l'introduction générale du rapport.

COMPORTEMENT (dans l'ordre) :
1. Si le thème est dans le profil → confirme en UNE phrase et génère IMMÉDIATEMENT.
2. Si le thème manque → demande-le en UNE seule phrase. Dès que tu l'as, génère.
3. "génère", "vas-y", "ok", "peu importe", "réessaie", "continue" → génère MAINTENANT.

RÈGLES :
- Ne demande JAMAIS filière, école, nom, année — ils sont dans le profil.
- L'introduction doit annoncer les parties du sommaire si disponible.
- Si des fichiers sont joints → intègre-les dans le context de generate_section.

STRUCTURE D'UNE BONNE INTRODUCTION :
  - Contexte général du domaine
  - Problématique et motivation
  - Objectifs du rapport
  - Annonce du plan (Partie I : ..., Partie II : ...)

ACTION OBLIGATOIRE dans la même réponse : generate_section("introduction") → step_complete.`,

  9: `Tu es RapportAI. Dernière étape : conclusion, bibliographie, abréviations.

Si des fichiers sont joints (sources, références) → intègre-les dans la bibliographie.

Pose UNE question courte sur les apports principaux et les limites du travail.
Réponse vague / "peu importe" / "génère" / "réessaie" / "continue" → génère immédiatement.

ORDRE OBLIGATOIRE dans la même réponse : generate_section("conclusion") → generate_section("bibliographie") → generate_section("abbreviations") → step_complete avec un message de félicitations court.`,

  10: `Tu es RapportAI. Tu génères la liste des figures du rapport.

COMPORTEMENT : Génère IMMÉDIATEMENT sans poser de question.
Analyse le contenu fourni pour extraire toutes les mentions "Figure N", "Fig. N", etc.
Combine avec les figures uploadées listées.

FORMAT :
## Liste des figures

**Figure 1** — [Titre]
*Source : [auteur/fichier]*

Si aucune figure trouvée → "## Liste des figures\n\n*(Aucune figure dans ce rapport)*"

ACTION OBLIGATOIRE dans la même réponse : generate_section("liste-figures") → step_complete.`,

  11: `Tu es RapportAI. Tu génères la liste des tableaux du rapport.

COMPORTEMENT : Génère IMMÉDIATEMENT sans poser de question.
Analyse le contenu pour extraire toutes les mentions "Tableau N", "Table N", etc.

FORMAT :
## Liste des tableaux

**Tableau 1** — [Titre]
*Source : [auteur/données primaires]*

Si aucun tableau trouvé → "## Liste des tableaux\n\n*(Aucun tableau dans ce rapport)*"

ACTION OBLIGATOIRE dans la même réponse : generate_section("liste-tableaux") → step_complete.`,
};

// ─── Tool definitions (static tools — no execute, handled by frontend) ────────

const TOOLS = {
  generate_section: {
    description:
      "Déclenche la génération d'une section du rapport. Inclus dans 'context' TOUS les noms, préférences, fichiers fournis et détails mentionnés.",
    inputSchema: jsonSchema<{ section: string; context: string }>({
      type: "object",
      properties: {
        section: {
          type: "string",
          description:
            "ID: page-de-garde | dedicaces | remerciements | resume | sommaire | introduction | conclusion | bibliographie | abbreviations | liste-figures | liste-tableaux",
        },
        context: {
          type: "string",
          description:
            "Instructions complètes incluant noms, demandes spécifiques, structure du template si fourni.",
        },
      },
      required: ["section", "context"],
    }),
  },
  ask_user: {
    description:
      "Pose une question à l'étudiant avec des choix cliquables. Utilise UNIQUEMENT quand tu as 2 à 4 options courtes et claires.",
    inputSchema: jsonSchema<{ question: string; choices: string[] }>({
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "La question courte à poser (sans emoji, max 1 phrase).",
        },
        choices: {
          type: "array",
          items: { type: "string" },
          description: "2 à 4 options courtes et cliquables.",
        },
      },
      required: ["question", "choices"],
    }),
  },
  step_complete: {
    description: "Appelle ceci quand toutes les sections requises ont été générées.",
    inputSchema: jsonSchema<{ message: string }>({
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Message de confirmation (texte brut, sans emojis)",
        },
      },
      required: ["message"],
    }),
  },
} as const;

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystem(
  step: number,
  profile: Record<string, string>,
  generatedSections: string[],
): string {
  const stepSystem =
    STEP_SYSTEMS[step] ?? "Tu es l'assistant de RapportAI. Aide l'étudiant en français.";
  return `${stepSystem}

━━━ PROFIL COMPLET DE L'ÉTUDIANT (DÉJÀ CONNU — NE PAS RE-DEMANDER) ━━━
- Nom : ${profile.studentName ?? ""}
- École : ${profile.school ?? ""}
- Filière : ${profile.filiere ?? ""}
- Type de rapport : ${profile.reportType ?? ""}
- Thème : ${profile.theme ?? ""}
- Année académique : ${profile.academicYear ?? ""}
${profile.reportColor ? `- Couleur choisie pour le rapport : ${profile.reportColor}` : ""}
${profile.encadrantPeda ? `- Encadrant pédagogique : ${profile.encadrantPeda}` : ""}
${profile.encadrantPro ? `- Encadrant professionnel : ${profile.encadrantPro}` : ""}
${profile.entreprise ? `- Entreprise / lieu de stage : ${profile.entreprise}` : ""}
${profile.ville ? `- Ville : ${profile.ville}` : ""}
${profile.dateDebutStage ? `- Début stage : ${profile.dateDebutStage}` : ""}
${profile.dateFinStage ? `- Fin stage : ${profile.dateFinStage}` : ""}
${profile.juryMember1 ? `- Jury 1 : ${profile.juryMember1}` : ""}
${profile.juryMember2 ? `- Jury 2 : ${profile.juryMember2}` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RÈGLES ABSOLUES :
1. Les informations du profil ci-dessus sont DÉJÀ CONNUES. Ne demande JAMAIS quelque chose qui est déjà dans le profil.
2. Si l'étudiant joint un fichier (PDF, image) → lis-le vraiment et utilise-le.
3. Après generate_section(), appelle IMMÉDIATEMENT step_complete() dans la même réponse.
4. "génère", "vas-y", "ok", "peu importe" ou toute variante → génère MAINTENANT sans poser de questions.
5. INTERDIT ABSOLU : emojis et symboles Unicode décoratifs — texte brut uniquement.

Sections déjà générées : ${generatedSections.length > 0 ? generatedSections.join(", ") : "aucune"}

Réponds toujours en français. Sois naturel et humain.`;
}

// ─── POST /api/converse/intent ────────────────────────────────────────────────

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const PHASE_QUESTIONS: Record<string, string> = {
  theme: "C'est quoi le thème / sujet de ton rapport ?",
  school: "Ton école ou université ?",
  filiere: "Ta filière ? (tu peux dire 'passer' si tu ne sais pas encore)",
  annee: "Année académique ? (ex: 2025–2026)",
};

router.post("/converse/intent", async (req: Request, res: Response) => {
  const { phase, userInput, profile = {} } = req.body as {
    phase: string;
    userInput: string;
    profile: Record<string, string>;
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ type: "reply", text: "Erreur de configuration." });
    return;
  }

  const question = PHASE_QUESTIONS[phase] ?? "Ta réponse ?";

  const system = `Tu lis un message d'un étudiant marocain qui remplit une fiche pour son rapport académique.

Question qui lui était posée : "${question}"

Contexte déjà connu :
- Thème : ${profile.theme || "(pas encore renseigné)"}
- École : ${profile.school || "(pas encore renseignée)"}
- Filière : ${profile.filiere || "(pas encore renseignée)"}
- Type de rapport : ${profile.reportType || "(pas encore renseigné)"}
- Année : ${profile.academicYear || "(pas encore renseignée)"}

Ta mission : décider si l'étudiant répond vraiment à la question, ou fait autre chose.

CAS 1 — C'est une vraie réponse à la question :
Réponds EXACTEMENT avec : ANSWER:<valeur>
La valeur doit être la réponse normalisée uniquement (pas de ponctuation après).
Exemples : ANSWER:EMSI | ANSWER:Génie Informatique | ANSWER:2024-2025 | ANSWER:Impact des fintech sur le crédit au Maroc

CAS 2 — L'étudiant veut passer / ignore / dit "je sais pas" / "peu importe" / "skip" :
Réponds EXACTEMENT avec : SKIP

CAS 3 — L'étudiant fait autre chose (question, digression, hors sujet, attente, confusion, blague) :
Réponds naturellement en français, comme un ami bienveillant. Max 2 phrases courtes.
Termine toujours par une reformulation courte de la question pour relancer.
Jamais d'emojis. Jamais de listes.`;

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
        max_tokens: 200,
        system,
        messages: [{ role: "user", content: String(userInput) }],
      }),
    });

    if (!anthropicRes.ok) {
      res.json({ type: "reply", text: "Je n'ai pas bien compris, tu peux reformuler ?" });
      return;
    }

    const data = (await anthropicRes.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const raw = data.content.find((b) => b.type === "text")?.text?.trim() ?? "";

    if (raw.startsWith("ANSWER:")) {
      res.json({ type: "answer", value: raw.slice(7).trim() });
    } else if (raw === "SKIP") {
      res.json({ type: "skip" });
    } else {
      res.json({ type: "reply", text: stripEmoji(raw) });
    }
  } catch {
    res.json({ type: "reply", text: "Une erreur s'est produite, essaie à nouveau." });
  }
});

// ─── POST /api/converse ───────────────────────────────────────────────────────

router.post("/converse", async (req: Request, res: Response) => {
  const {
    messages: uiMessages = [],
    step,
    profile = {},
    generatedSections = [],
  } = req.body as {
    messages: UIMessage[];
    step: number;
    profile: Record<string, string>;
    generatedSections: string[];
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    return;
  }

  // Convert UIMessages → ModelMessages
  let modelMessages = convertToModelMessages(uiMessages);

  // Compress history: keep first 4 turns + last 16 to bound context size
  if (modelMessages.length > 20) {
    const head = modelMessages.slice(0, 4);
    const tail = modelMessages.slice(-16);
    const headSet = new Set(head);
    modelMessages = [...head, ...tail.filter((m) => !headSet.has(m))];
  }

  const system = buildSystem(step, profile, generatedSections);
  const model = step === 5 ? "claude-sonnet-4-5" : "claude-haiku-4-5";
  const maxTokens = step === 5 ? 2048 : 1500;

  try {
    const anthropic = createAnthropic({ apiKey });

    // streamText with static tools (no execute) — tool calls are sent to frontend via UIMessageStream
    const result = streamText({
      model: anthropic(model),
      system,
      messages: modelMessages,
      tools: TOOLS,
      maxTokens,
    });

    result.pipeUIMessageStreamToResponse(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log?.error({ err }, "converse error");
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    }
  }
});

export default router;
