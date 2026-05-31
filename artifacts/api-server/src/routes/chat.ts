import { Router, type Request, type Response } from "express";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";

const router = Router();

const SESSIONS_ROOT = process.env.SESSIONS_DIR ?? "/tmp/rapportai-sessions";

// ─── Section mappings ─────────────────────────────────────────────────────────

const SECTION_FILE_MAP: Record<string, string> = {
  pageDeGarde:  "page-de-garde",
  dedicaces:    "dedicaces",
  resumeFr:     "resume",
  sommaire:     "sommaire",
  introduction: "introduction",
  partieI:      "partie-i",
  partieII:     "partie-ii",
  conclusion:   "conclusion",
};

const SECTION_PATHS: Record<string, string> = {
  pageDeGarde:  "/rapport/step-2",
  dedicaces:    "/rapport/step-3",
  resumeFr:     "/rapport/step-4",
  sommaire:     "/rapport/step-5",
  introduction: "/rapport/step-6",
  partieI:      "/rapport/partie-i",
  partieII:     "/rapport/partie-ii",
  conclusion:   "/rapport/step-9",
  rapports:     "/rapports",
  juryai:       "/juryai",
  figures:      "/figures",
  export:       "/rapport/step-9",
};

const SECTION_LABELS: Record<string, string> = {
  pageDeGarde:  "Page de garde",
  dedicaces:    "Dédicaces & Remerciements",
  resumeFr:     "Résumé & Abstract",
  sommaire:     "Sommaire",
  introduction: "Introduction",
  partieI:      "Partie I : Cadre théorique",
  partieII:     "Partie II : Étude empirique",
  conclusion:   "Conclusion",
};

const SECTION_ORDER = [
  "pageDeGarde", "dedicaces", "resumeFr", "sommaire",
  "introduction", "partieI", "partieII", "conclusion",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionSummary {
  content: string;
  wordCount: number;
}

interface ChatBody {
  sessionId?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  mode?: "jury" | "assistant";
  theme?: string;
  reportType?: string;
  school?: string;
  filiere?: string;
  problematique?: string;
  studentName?: string;
  sections?: Record<string, SectionSummary | null>;
  sectionSummaries?: Record<string, string>;
}

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sse(res: Response, data: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── System prompts ───────────────────────────────────────────────────────────

const ORCHESTRATOR_SYSTEM = `Tu es RapportAI Orchestrateur, le coordinateur principal du système de génération de rapports académiques pour les étudiants marocains et francophones (PFE, mémoire, rapport de stage).

## TON IDENTITÉ

Tu n'es PAS un rédacteur. Tu es un coordinateur et planificateur. Tu ne génères JAMAIS de contenu de section toi-même. Tu délègues toute rédaction aux agents spécialisés.

## ACCÈS AUX FICHIERS DU RAPPORT

Ton répertoire de travail contient tous les fichiers du rapport étudiant. Tu peux les lire directement :
- profile.json : profil complet de l'étudiant (nom, école, filière, thème, problématique)
- conversation.md : historique de la conversation en cours
- page-de-garde.md, dedicaces.md, resume.md, sommaire.md
- introduction.md, partie-i.md, partie-ii.md, conclusion.md

**RÈGLE CRITIQUE : Toujours lire les fichiers pertinents avec Read AVANT de répondre.**
- L'étudiant parle d'une section → lis-la avant de répondre
- L'étudiant demande un retour → lis la section, commente ensuite
- Demande de cohérence → lis introduction.md + conclusion.md + les parties
- Jamais de commentaire sur le contenu sans avoir lu le fichier

## NAVIGATION

Si tu dois envoyer l'étudiant vers une section pour la générer ou la modifier :
1. Écris dans **chat-nav.json** : \`{"navigate_to":"sectionKey","context_injection":"..."}\`
2. Dans ta réponse, annonce la navigation : "Je t'emmène vers [section]."

Clés valides : pageDeGarde | dedicaces | resumeFr | sommaire | introduction | partieI | partieII | conclusion | juryai | rapports | figures | export

**RÈGLES context_injection :**
- Pour **partieII** → context_injection = "Résumé Partie I : [résumé lu depuis partie-i.md]. La Partie II doit s'ancrer dans ce cadre théorique et le valider empiriquement."
- Pour **conclusion** → context_injection = "Résumé Partie I : [...]. Résumé Partie II : [...]. Problématique : [...]. La conclusion doit synthétiser et répondre directement à la problématique."
- Pour **introduction** → context_injection = "Plan du sommaire : [lu depuis sommaire.md]. L'intro doit poser la problématique et annoncer ce plan."
- Pour les autres sections → context_injection avec le profil étudiant pertinent

## CE QUE TU NE FAIS JAMAIS

- Écrire du contenu de section (intro, partie I, etc.) : délègue aux agents
- Répondre sur une section sans l'avoir lue
- Commencer par "Bien sûr !", "Absolument !", "Voici", "J'espère que ça aide"
- Utiliser : s'inscrire dans, mettre en lumière, jouer un rôle essentiel, incontournable
- Répéter la question de l'étudiant

## STYLE — RÉPONSES COURTES

**5 à 8 lignes max par message. Conversationnel et actionnable.**
- Une seule question à la fois
- Pas de titres ## ni sous-titres
- Diagnostics : résumé flash ("Il te manque 3 sections. La plus urgente : le Sommaire. On y va ?")
- Toujours terminer par une action concrète ou une question courte
- Toujours en français

## CONNAISSANCE DU CONTEXTE MAROCAIN

Quand pertinent, réfère à :
- Finance/Gestion : AMMC, Bank Al-Maghrib, CDVM, Bourse de Casablanca
- Banque : GPBM, crédit agricole du Maroc, CIH
- Management : entreprises du CAM 25, contexte PME marocain
- Droit : Code de commerce marocain, droit OHADA, réglementation AMMC
- Informatique : startups marocaines, transformation digitale Maroc`;

const JURY_SYSTEM = `Tu es une simulation de jury académique marocain évaluant une soutenance.

## ACCÈS AU RAPPORT

Lis directement les fichiers .md du rapport dans ton répertoire de travail pour poser des questions précises basées sur le contenu réel :
- introduction.md, partie-i.md, partie-ii.md, conclusion.md, sommaire.md
- profile.json pour le profil de l'étudiant

Commence par lire le rapport disponible avant de poser la première question.

## PANEL JURY

- **Pr. Hassan Benali** : Président, théorie et rigueur académique, formel et exigeant
- **Dr. Fatima Zahra Alaoui** : Experte méthodologie, analytique et constructive
- **M. Youssef El Mansouri** : Professionnel industrie, pragmatique, orienté résultats

## RÈGLES STRICTES

- UNE seule question par tour, 3 phrases max
- Toujours identifier le locuteur : **Pr. Benali :** / **Dr. Alaoui :** / **M. El Mansouri :**
- Alterne les membres tour par tour
- Questions basées sur le contenu réel lu dans les fichiers
- Après 8 réponses de l'étudiant → évaluation finale obligatoire

## ÉVALUATION FINALE

\`\`\`
**Points forts :** [2–3 points spécifiques au rapport]
**Points à améliorer :** [2–3 points spécifiques]
**Mention proposée :** [Passable / Assez bien / Bien / Très bien / Excellent]
\`\`\``;

// ─── Sanitizer ────────────────────────────────────────────────────────────────

const sanitize = (v: string | undefined, max = 300) =>
  (v ?? "").trim().slice(0, max)
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, "[supprimé]")
    .replace(/ignore\s+(all\s+)?above\s+instructions/gi, "[supprimé]")
    .replace(/reveal\s+(your\s+)?(system\s+)?prompt/gi, "[supprimé]")
    .replace(/you\s+are\s+now\s+/gi, "[supprimé]");

// ─── POST /api/chat ───────────────────────────────────────────────────────────

router.post("/chat", async (req: Request, res: Response) => {
  const {
    sessionId: rawSessionId,
    messages: rawMessages,
    mode,
    theme,
    reportType,
    school,
    filiere,
    problematique,
    studentName,
    sections = {},
    sectionSummaries = {},
  } = req.body as ChatBody;

  if (!rawMessages || !Array.isArray(rawMessages) || rawMessages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const subject  = sanitize(theme, 200)        || "le sujet du rapport";
  const ecole    = sanitize(school, 100)        || "l'école";
  const fil      = sanitize(filiere, 100)       || "la filière";
  const typeRap  = sanitize(reportType, 50)     || "rapport de fin d'études";
  const prob     = sanitize(problematique, 600);
  const student  = sanitize(studentName, 120)   || "l'étudiant(e)";

  // Create or reuse session workdir
  const sessionId = rawSessionId ?? `chat-${Date.now()}`;
  const workDir = path.join(SESSIONS_ROOT, sessionId);
  mkdirSync(workDir, { recursive: true });

  try {
    // ── 1. Write current sections to disk so Claude can read them directly ──
    for (const [key, summary] of Object.entries(sections)) {
      const fileId = SECTION_FILE_MAP[key];
      if (!fileId || !summary || summary.wordCount < 10) continue;
      writeFileSync(path.join(workDir, `${fileId}.md`), summary.content);
    }

    // ── 2. Write profile.json ──────────────────────────────────────────────
    const profile = { studentName: student, school: ecole, filiere: fil, reportType: typeRap, theme: subject, problematique: prob || undefined };
    writeFileSync(path.join(workDir, "profile.json"), JSON.stringify(profile, null, 2));

    // ── 3. Write conversation history ──────────────────────────────────────
    const completedKeys = SECTION_ORDER.filter((k) => (sections[k]?.wordCount ?? 0) > 50);
    const nextKey = SECTION_ORDER.find((k) => (sections[k]?.wordCount ?? 0) <= 50);

    const summaryLines: string[] = [];
    for (const key of SECTION_ORDER) {
      const summary = sectionSummaries[key];
      if (summary) {
        summaryLines.push(`- **${SECTION_LABELS[key] ?? key}:** ${summary}`);
      }
    }

    const contextBlock = [
      `# Contexte du rapport`,
      `- Étudiant : ${student}`,
      `- École : ${ecole} | Filière : ${fil} | Type : ${typeRap}`,
      `- Thème : "${subject}"`,
      prob ? `- Problématique : "${prob}"` : "",
      `- Progression : ${completedKeys.length}/8 sections (${completedKeys.map((k) => SECTION_LABELS[k] ?? k).join(", ") || "aucune"})`,
      nextKey ? `- Prochaine section recommandée : ${SECTION_LABELS[nextKey] ?? nextKey}` : "- Rapport complet ✅",
      summaryLines.length > 0 ? `\n# Résumés des sections\n${summaryLines.join("\n")}` : "",
    ].filter(Boolean).join("\n");

    const conversationMd = rawMessages.map((m) =>
      `**${m.role === "user" ? "Étudiant" : "RapportAI"}:** ${m.content}`
    ).join("\n\n");

    writeFileSync(
      path.join(workDir, "conversation.md"),
      `${contextBlock}\n\n---\n\n# Conversation\n\n${conversationMd}`
    );

    // ── 4. Clean previous nav file ─────────────────────────────────────────
    const navPath = path.join(workDir, "chat-nav.json");
    if (existsSync(navPath)) unlinkSync(navPath);

    // ── 5. Flush headers so the client knows we're alive ──────────────────
    // (no progress event — let the frontend's animated thinkingMessage run naturally)

    // ── 6. Build prompt ────────────────────────────────────────────────────
    const isJury = mode === "jury";
    const lastUserMsg = rawMessages.filter((m) => m.role === "user").at(-1)?.content ?? "";
    const systemPrompt = isJury ? JURY_SYSTEM : ORCHESTRATOR_SYSTEM;

    const prompt = isJury
      ? `Lis les fichiers du rapport dans ton répertoire, puis réponds à l'étudiant.\n\nMessage de l'étudiant : ${lastUserMsg}`
      : `Lis conversation.md pour le contexte complet, puis les sections .md pertinentes si nécessaire.\nSi tu veux naviguer, écris chat-nav.json d'abord.\n\nMessage de l'étudiant : ${lastUserMsg}`;

    // ── 7. Run Claude Code SDK agent ───────────────────────────────────────
    const claudeBinary = findClaudeBinary();
    let fullText = "";

    for await (const message of query({
      prompt,
      options: {
        maxTurns: 15,
        cwd: workDir,
        systemPrompt,
        model: "claude-sonnet-4-5",
        allowedTools: isJury ? ["Read", "Glob"] : ["Read", "Write", "Glob"],
        ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
      },
    }) as AsyncIterable<SDKMessage>) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text" && block.text) {
            fullText += block.text;
          }
          // tool_use blocks are internal — no progress events sent to client
        }
      }
    }

    // ── 8. Send final response text ────────────────────────────────────────
    if (fullText.trim()) {
      sse(res, { content: fullText.trim() });
    }

    // ── 9. Check for navigation intent ────────────────────────────────────
    if (!isJury && existsSync(navPath)) {
      try {
        const navRaw = readFileSync(navPath, "utf-8");
        const nav = JSON.parse(navRaw) as { navigate_to: string; context_injection?: string };
        const navPath2 = SECTION_PATHS[nav.navigate_to] ?? "/rapports";
        sse(res, { action: { type: "navigate", path: navPath2, injection: nav.context_injection ?? "" } });
      } catch {
        // malformed nav file — ignore
      }
    }

    sse(res, { done: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    sse(res, { error: message });
  } finally {
    res.end();
  }
});

// ─── Tool trace builder ───────────────────────────────────────────────────────

function buildToolDetail(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Read": {
      const fp = String(input.file_path ?? "");
      const name = fp.split(/[\\/]/).pop() ?? fp;
      if (name.endsWith(".md")) return `Lecture de ${name.replace(".md", "")}…`;
      if (name === "profile.json") return "Lecture du profil étudiant…";
      return `Lecture de ${name}…`;
    }
    case "Write": {
      const fp = String(input.file_path ?? "");
      const name = fp.split(/[\\/]/).pop() ?? fp;
      if (name === "chat-nav.json") return "Préparation de la navigation…";
      return `Écriture de ${name}…`;
    }
    case "Glob":
      return "Analyse des fichiers disponibles…";
    default:
      return "Analyse en cours…";
  }
}

export default router;
