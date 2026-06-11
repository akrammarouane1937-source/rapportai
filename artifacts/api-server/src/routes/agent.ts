import { Router, type Request, type Response } from "express";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { sessionStore } from "../lib/session-store";
import { SDKReportAgent } from "../lib/sdk-agent";
import { streamingHumanize } from "../lib/humanize-util";
import { logger } from "../lib/logger";

const router = Router();
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// ─── Section → Zustand key mapping ───────────────────────────────────────────

const ZUSTAND_KEY: Record<string, string> = {
  "page-de-garde":  "pageDeGarde",
  "dedicaces":      "dedicaces",
  "remerciements":  "remerciements",
  "resume":         "resumeFr",
  "abstract":       "abstractEn",
  "sommaire":       "sommaire",
  "introduction":   "introduction",
  "partie-i":       "partieI",
  "partie-ii":      "partieII",
  "conclusion":     "conclusion",
  "bibliographie":  "bibliographie",
  "abbreviations":  "abreviations",
  "liste-figures":  "listeDesFigures",
  "liste-tableaux": "listeDesTableaux",
};

// ─── Coordinator system prompts ───────────────────────────────────────────────

const COORDINATOR_SYSTEMS: Record<string, string> = {
  "2": `Tu es RapportAI. Mission : page de garde.
PREMIER MESSAGE : "Salut [prénom] ! On prépare ta page de garde — le premier visuel que ton jury verra. Il me manque juste une chose : le nom de ton encadrant pédagogique ?" (+ encadrant pro et entreprise si PFE/Stage, UNE question à la fois).
Dès que tu as l'encadrant pédago → propose en 1 phrase ce que la page contiendra, et demande "On y va ?".
"génère", "vas-y", "oui", "réessaie", "continue", "peu importe" → génère avec ce que tu as.`,

  "3": `Tu es RapportAI. Mission : dédicaces et remerciements.
PREMIER MESSAGE : salue [prénom] chaleureusement, puis ACTION: ask_user avec QUESTION: "Pour tes dédicaces et remerciements, tu préfères :" et CHOICES: [Style classique — je m'occupe de tout | Je veux les personnaliser]
- "Style classique" → génère immédiatement (famille, encadrants, corps professoral).
- "Je veux les personnaliser" → demande à qui dédier / qui remercier (UNE question), puis génère.
"peu importe", "génère", "continue", "réessaie" → génère immédiatement.
Génère TOUJOURS les deux : SECTIONS: dedicaces,remerciements`,

  "4": `Tu es RapportAI. Mission : résumé français + abstract anglais (l'abstract est la traduction fidèle du résumé).
Tu as tout dans le profil — ne pose AUCUNE question ouverte.
PREMIER MESSAGE : salue [prénom], annonce en 1 phrase le plan ("un résumé d'une page en texte fluide + sa traduction en Abstract"), puis ACTION: ask_user avec QUESTION: "Pour les mots-clés du résumé, tu préfères :" et CHOICES: [L'IA les choisit pour moi | Je veux les préciser moi-même]
- "L'IA les choisit pour moi" (ou "génère", "peu importe", "réessaie") → génère IMMÉDIATEMENT, l'IA choisit les mots-clés.
- "Je veux les préciser moi-même" → demande ses mots-clés, puis génère dès sa réponse en les intégrant dans CONTEXT.
Le résumé est un TEXTE CONTINU d'une page (350-450 mots), sans titres internes, terminé par la ligne Mots-clés.
SECTIONS: resume (génère les deux automatiquement)`,

  "5": `Tu es RapportAI. Mission : générer le sommaire complet du rapport.
PREMIER MESSAGE — PLAN D'ABORD, ne génère PAS encore :
Salue [prénom], puis propose dans le chat un mini-plan adapté à son thème :
"Voici ce que je propose pour structurer ton rapport :
— Partie I (théorique) : [titre proposé contextualisé] — 2 chapitres
— Partie II (empirique) : [titre proposé contextualisé] — 2 chapitres"
Puis ACTION: ask_user avec QUESTION: "Cette structure te convient ?" et CHOICES: [Parfait, génère le sommaire | Je veux 3 chapitres par partie | Je veux modifier les titres]
- Validation (ou "génère", "vas-y", "ok") → génère le sommaire complet avec ce plan.
- Modification demandée → intègre, reconfirme en 1 phrase, puis génère.

FORMAT OBLIGATOIRE pour le CONTEXT (titres en markdown #/##/###/#### — JAMAIS de texte générique comme "Chapitre 1") :
# Remerciements
# Liste des abréviations
# Liste des tableaux et figures
# Introduction générale
## Partie I — [Titre théorique contextualisé au thème]
### Chapitre 1 : [Titre spécifique]
#### Section 1.1 : [Titre]
#### Section 1.2 : [Titre]
### Chapitre 2 : [Titre spécifique]
#### Section 2.1 : [Titre]
#### Section 2.2 : [Titre]
## Partie II — [Titre empirique/appliqué contextualisé]
### Chapitre 1 : [Titre spécifique]
#### Section 1.1 : [Titre]
#### Section 1.2 : [Titre]
### Chapitre 2 : [Titre spécifique]
#### Section 2.1 : [Titre]
# Conclusion générale
# Bibliographie
# Annexes

Après génération, annonce brièvement ce que tu as créé et propose des ajustements.
"réessaie", "vas-y", "génère", "modifie [X]" → intègre et regénère IMMÉDIATEMENT.`,

  "6": `Tu es RapportAI. Mission : introduction générale.
PREMIER MESSAGE — PLAN D'ABORD, ne génère PAS encore :
Salue [prénom], puis présente le plan de l'introduction en 4 points courts adaptés à son thème :
"Pour ton introduction, voici ce que je prévois : une accroche sur [angle lié au thème], le contexte et les enjeux, ta problématique, puis l'annonce du plan."
Puis ACTION: ask_user avec QUESTION: "Ça te convient ?" et CHOICES: [Génère comme ça | Je veux te donner des précisions d'abord]
- Validation (ou "génère", "vas-y", "ok", "continue", "réessaie") → génère MAINTENANT.
- Précisions → écoute, intègre dans CONTEXT, puis génère.
Ne demande JAMAIS filière, école, nom — ils sont dans le profil.`,

  "9": `Tu es RapportAI. Mission : conclusion, bibliographie, abréviations.
PREMIER MESSAGE : salue [prénom] ("Dernière ligne droite !"), annonce le plan (conclusion + bibliographie + abréviations générées ensemble), puis ACTION: ask_user avec QUESTION: "Pour les apports et limites de ton travail :" et CHOICES: [Déduis-les de mon rapport | Je veux les préciser moi-même]
- "Déduis-les" (ou "génère", "peu importe", "réessaie") → génère tout immédiatement.
- "Je veux les préciser" → demande les 2-3 apports principaux + la limite principale (UNE question), puis génère.
Génère TOUJOURS les trois ensemble : SECTIONS: conclusion,bibliographie,abbreviations`,

  "10": `Tu es RapportAI. Mission : liste des figures.
Section utilitaire — EXCEPTION à la règle du plan : génère IMMÉDIATEMENT sans poser de question.
RESPONSE court et chaleureux ("Je dresse ta liste des figures, [prénom] — une seconde…").
ACTION: generate, SECTIONS: liste-figures`,

  "11": `Tu es RapportAI. Mission : liste des tableaux.
Section utilitaire — EXCEPTION à la règle du plan : génère IMMÉDIATEMENT sans poser de question.
RESPONSE court et chaleureux ("Je dresse ta liste des tableaux, [prénom] — une seconde…").
ACTION: generate, SECTIONS: liste-tableaux`,

  "partie-i": `Tu es RapportAI. Mission : Partie I (cadre théorique).
PREMIER MESSAGE — PLAN D'ABORD : salue [prénom], rappelle le plan ("Partie I : [titre], [N] chapitres" depuis le profil), précise que la génération dure 5 à 10 minutes (ne pas fermer l'onglet), puis ACTION: ask_user avec QUESTION: "On lance avec ce plan ?" et CHOICES: [Oui, lance la génération | Je veux ajuster le plan d'abord]
- "oui", "ok", "c'est bon", "vas-y", "génère", "réessaie" → génère MAINTENANT.
- Ajustement → écoute, intègre dans CONTEXT, reconfirme en 1 phrase, génère.
Si l'étudiant demande une modification après génération → génère à nouveau avec le contexte de modification.`,

  "partie-ii": `Tu es RapportAI. Mission : Partie II (cadre empirique/appliqué).
PREMIER MESSAGE — PLAN D'ABORD : salue [prénom], rappelle le plan ("Partie II : [titre], [N] chapitres" depuis le profil), précise que la génération dure 5 à 10 minutes (ne pas fermer l'onglet), puis ACTION: ask_user avec QUESTION: "On lance avec ce plan ?" et CHOICES: [Oui, lance la génération | Je veux ajuster le plan d'abord]
- "oui", "ok", "c'est bon", "vas-y", "génère", "réessaie" → génère MAINTENANT.
- Ajustement → écoute, intègre dans CONTEXT, reconfirme en 1 phrase, génère.
Si l'étudiant demande une modification après génération → génère à nouveau avec le contexte.`,
};

// ─── Build coordinator system prompt ─────────────────────────────────────────

function buildCoordinatorSystem(step: string, profile: Record<string, unknown>): string {
  const stepSystem = COORDINATOR_SYSTEMS[step] ?? "Tu es l'assistant de RapportAI. Aide l'étudiant en français.";
  const hasTheme = !!(profile.theme && typeof profile.theme === "string" && profile.theme.trim() && profile.theme.trim() !== "Rapport académique");

  const sommaireLine = typeof profile.sommaire === "string" && profile.sommaire.trim()
    ? `\nSommaire approuvé (extrait) :\n${profile.sommaire.slice(0, 1500)}`
    : "";
  const partieILine = typeof profile.partieITitle === "string" && profile.partieITitle
    ? `\n- Titre Partie I : ${profile.partieITitle} (${profile.partieIChapters ?? 2} chapitres)`
    : "";
  const partieIILine = typeof profile.partieIITitle === "string" && profile.partieIITitle
    ? `\n- Titre Partie II : ${profile.partieIITitle} (${profile.partieIIChapters ?? 2} chapitres)`
    : "";

  return `${stepSystem}

━━━ PROFIL ÉTUDIANT (DÉJÀ CONNU — NE PAS RE-DEMANDER) ━━━
- Nom : ${typeof profile.studentName === "string" ? profile.studentName.replace(/\b\w/g, (c) => c.toUpperCase()) : ""}
- École : ${profile.school ?? ""}
- Filière : ${profile.filiere ?? ""}
- Type : ${profile.reportType ?? ""}
- Thème : ${hasTheme ? profile.theme : "(non renseigné — demande si nécessaire)"}
- Problématique : ${typeof profile.problematique === "string" && profile.problematique.trim() ? profile.problematique : "(non renseignée)"}
- Année : ${profile.academicYear ?? ""}
${typeof profile.pendingContextInjection === "string" && profile.pendingContextInjection.trim() ? `\n━━━ CONTEXTE TRANSMIS PAR L'ASSISTANT DU DASHBOARD (à intégrer dans la génération) ━━━\n${profile.pendingContextInjection.slice(0, 3000)}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : ""}
${profile.encadrantPeda ? `- Encadrant pédagogique : ${profile.encadrantPeda}` : ""}
${profile.encadrantPro ? `- Encadrant professionnel : ${profile.encadrantPro}` : ""}
${profile.entreprise ? `- Entreprise : ${profile.entreprise}` : ""}
${profile.ville ? `- Ville : ${profile.ville}` : ""}${partieILine}${partieIILine}${sommaireLine}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RÈGLES :
- Réponds toujours en français, naturellement
- Jamais d'emojis ni de symboles Unicode décoratifs
- Ne demande JAMAIS des infos déjà dans le profil ci-dessus
- Les sections en cours de génération n'apparaissent PAS dans le chat — elles vont dans l'aperçu
- Tu travailles UNIQUEMENT sur ta mission ci-dessus. Ne mentionne JAMAIS une autre section du rapport (page de garde, sommaire…) sauf si c'est ta mission.
- PREMIER MESSAGE : quand l'étudiant envoie "Démarre.", suis le script PREMIER MESSAGE de ta mission. Ton chaleureux et personnel (utilise son prénom), comme un assistant qui l'accueille — jamais robotique. Présente toujours ton plan AVANT de générer et laisse l'étudiant valider ou ajuster : on ne génère jamais sans son accord au premier message.
- Les raccourcis "génère", "vas-y", "ok", "réessaie" valent TOUJOURS validation immédiate, à tout moment.

ÉDITIONS CHIRURGICALES : Si l'étudiant demande de modifier UN passage spécifique ("change le deuxième paragraphe", "modifie juste la conclusion du chapitre 1") → utilise ACTION: generate avec CONTEXT: SURGICAL_EDIT: [description exacte du changement demandé]. L'agent utilisera Edit (pas Write) pour ne modifier que ce passage.

FORMAT DE RÉPONSE OBLIGATOIRE — respecte EXACTEMENT ce format, rien d'autre :

ACTION: chat
RESPONSE: [ta réponse naturelle]

OU pour déclencher une génération :

ACTION: generate
SECTIONS: [section-id1,section-id2,...] (ex: dedicaces,remerciements)
CONTEXT: [contexte détaillé pour la génération : noms, demandes spécifiques, plan validé...]
RESPONSE: [message court en français annonçant la génération de TA section — jamais une autre]

OU pour poser une question à choix à l'étudiant (2 à 4 options courtes et cliquables) — utilise quand un choix rapide entre des options claires fait avancer la conversation (ex: une préférence de structure, oui/non, un format) :

ACTION: ask_user
QUESTION: [ta question courte, sans emoji]
CHOICES: [option 1 | option 2 | option 3]

OU quand l'étape est terminée après génération :

ACTION: complete
RESPONSE: [message de félicitations court]

Choisis ACTION: complete uniquement si tu viens de confirmer qu'une génération s'est bien passée.
Sinon utilise ACTION: chat.`;
}

// ─── History compression ──────────────────────────────────────────────────────

type ConvTurn = { role: "agent" | "user"; content: string };

function compressHistory(history: ConvTurn[]): ConvTurn[] {
  if (history.length <= 8) return history;
  const head = history.slice(0, 2);
  const tail = history.slice(-6);
  const headSet = new Set(head);
  return [...head, ...tail.filter((t) => !headSet.has(t))];
}

// ─── Parse coordinator response ───────────────────────────────────────────────

function parseCoordinator(raw: string): {
  action: string;
  sections: string[];
  context: string;
  response: string;
  question: string;
  choices: string[];
} {
  const lines = raw.trim().split("\n");
  let action = "chat";
  let sections: string[] = [];
  let context = "";
  let question = "";
  let choices: string[] = [];
  const responseLines: string[] = [];
  let inResponse = false;
  let inContext = false;

  for (const line of lines) {
    if (line.startsWith("ACTION:")) {
      action = line.slice(7).trim().toLowerCase();
      inResponse = false;
      inContext = false;
    } else if (line.startsWith("SECTIONS:")) {
      sections = line.slice(9).trim().split(",").map((s) => s.trim()).filter(Boolean);
      inResponse = false;
      inContext = false;
    } else if (line.startsWith("SECTION:")) {
      sections = line.slice(8).trim().split(",").map((s) => s.trim()).filter(Boolean);
      inResponse = false;
      inContext = false;
    } else if (line.startsWith("CONTEXT:")) {
      context = line.slice(8).trim();
      inContext = true;
      inResponse = false;
    } else if (line.startsWith("QUESTION:")) {
      question = line.slice(9).trim();
      inResponse = false;
      inContext = false;
    } else if (line.startsWith("CHOICES:")) {
      choices = line.slice(8).trim().split("|").map((s) => s.trim()).filter(Boolean);
      inResponse = false;
      inContext = false;
    } else if (line.startsWith("RESPONSE:")) {
      responseLines.push(line.slice(9).trim());
      inResponse = true;
      inContext = false;
    } else if (inResponse) {
      responseLines.push(line);
    } else if (inContext && context) {
      context += "\n" + line;
    }
  }

  return {
    action,
    sections,
    context: context.trim(),
    response: responseLines.join("\n").trim(),
    question: question.trim(),
    choices,
  };
}

// ─── SSE write helper ─────────────────────────────────────────────────────────

function sseWrite(res: Response, data: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  (res as unknown as { flush?: () => void }).flush?.();
}

// ─── POST /api/agent/:step/stream ─────────────────────────────────────────────

router.post("/agent/:step/stream", async (req: Request, res: Response) => {
  const { step } = req.params;
  const {
    message = "",
    history = [],
    sessionId,
    profile = {},
  } = req.body as {
    message?: string;
    history?: ConvTurn[];
    sessionId?: string;
    profile?: Record<string, unknown>;
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    return;
  }

  // ── SSE setup ────────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.socket?.setNoDelay(true);
  res.flushHeaders();

  // Patch res.write to flush after every chunk
  const _origWrite = res.write.bind(res) as (...a: unknown[]) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).write = (...args: unknown[]): boolean => {
    const r = _origWrite(...args);
    (res as unknown as { flush?: () => void }).flush?.();
    return r;
  };

  try {
    // ── 1. Get agent from session store ────────────────────────────────────
    let agent = sessionStore.get(sessionId ?? "") as SDKReportAgent | undefined;
    if (!agent && sessionId) {
      const revived = SDKReportAgent.reviveFromDisk(sessionId);
      if (revived) {
        agent = revived;
        // Cast is safe: SDKReportAgent extends AgentSession
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sessionStore.set(agent as any);
      }
    }

    // ── 2. Build coordinator messages ──────────────────────────────────────
    const bounded = compressHistory(history);
    const stepStr = Array.isArray(step) ? step[0] : step;
    const systemPrompt = buildCoordinatorSystem(stepStr, profile);

    const apiMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const turn of bounded) {
      if (!turn.content?.trim()) continue;
      apiMessages.push({
        role: turn.role === "agent" ? "assistant" : "user",
        content: turn.content.slice(0, 2000), // cap each turn to avoid huge payloads
      });
    }
    // Ensure messages alternate (Anthropic requires user/assistant alternation)
    const filteredMessages = apiMessages.filter((m, i) => {
      if (i === 0) return m.role === "user";
      return m.role !== apiMessages[i - 1].role;
    });
    filteredMessages.push({ role: "user", content: message || "(message vide)" });

    // ── 3. Call Haiku coordinator (non-streaming) ──────────────────────────
    const coordRes = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1200,
        system: systemPrompt,
        messages: filteredMessages,
      }),
    });

    if (!coordRes.ok) {
      const errText = await coordRes.text().catch(() => "");
      logger.error({ status: coordRes.status, body: errText }, "coordinator call failed");
      sseWrite(res, { type: "text", content: "Une erreur s'est produite. Réessaie." });
      sseWrite(res, { type: "done" });
      res.end();
      return;
    }

    const coordData = (await coordRes.json()) as { content: Array<{ type: string; text: string }> };
    const rawText = coordData.content.find((b) => b.type === "text")?.text ?? "";
    const { action, sections, context, response, question, choices } = parseCoordinator(rawText);

    // ── 4. Stream the response text to the frontend ────────────────────────
    if (response) {
      sseWrite(res, { type: "text", content: response });
    } else if (action === "chat" && !response) {
      // Fallback: use raw text as response if parsing failed
      sseWrite(res, { type: "text", content: rawText.slice(0, 1000) });
    }

    // ── ask_user: agent asks a clickable-choices question, then ends ───────
    if (action === "ask_user" && question && choices.length >= 2) {
      sseWrite(res, { type: "ask_user", question, choices });
      sseWrite(res, { type: "done" });
      res.end();
      return;
    }

    // ── 5. If generate action, run the Claude Agent SDK ───────────────────
    if (action === "generate" && sections.length > 0 && !agent && sessionId) {
      // Session lost (server restart) — recreate it transparently with the
      // profile from this request instead of dead-ending the user.
      try {
        const fresh = new SDKReportAgent(sessionId, profile as ConstructorParameters<typeof SDKReportAgent>[1]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sessionStore.set(fresh as any);
        agent = fresh;
        logger.info({ sessionId }, "session recreated after loss");
      } catch (e) {
        logger.error({ sessionId, err: e }, "session recreation failed");
      }
    }

    if (action === "generate" && sections.length > 0 && !agent) {
      sseWrite(res, {
        type: "text",
        content:
          "Ta session a expiré. Recharge la page et réessaie — tes réponses sont sauvegardées localement.",
      });
      sseWrite(res, { type: "done" });
      res.end();
      return;
    }

    // Surgical edits of existing content count as revisions — enforce the plan limit.
    // Full regenerations stay gated by the page quota instead.
    if (action === "generate" && context.includes("SURGICAL_EDIT")) {
      const revCount = parseInt((req.headers["x-revision-count"] as string) ?? "0", 10);
      const revLimit = req.planRevisions;
      if (isFinite(revLimit) && revCount >= revLimit) {
        sseWrite(res, {
          type: "text",
          content: `Tu as atteint la limite de ${revLimit} révisions de ton plan. Passe au plan supérieur pour continuer à affiner ton rapport.`,
        });
        sseWrite(res, { type: "plan_limit", limit_type: "revisions", planId: req.planId });
        sseWrite(res, { type: "done" });
        res.end();
        return;
      }
    }

    if (action === "generate" && sections.length > 0 && agent) {
      // Patch the agent profile with latest data from the frontend
      if (profile && typeof profile === "object") {
        const profileFields: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(profile)) {
          if (typeof v === "string" && v.trim()) profileFields[k] = v;
          else if (typeof v === "number") profileFields[k] = v;
        }
        // formatting is an object — patch it explicitly so it isn't dropped
        if (profile.formatting && typeof profile.formatting === "object") {
          profileFields.formatting = profile.formatting;
        }
        agent.patchProfile(profileFields as Parameters<typeof agent.patchProfile>[0]);
      }

      // Write generation_context.md so section agents can read it
      if (context) {
        try {
          writeFileSync(
            path.join(agent.workDir, "generation_context.md"),
            `# Contexte de génération\n\n${context}`,
            "utf-8"
          );
        } catch { /* ignore write errors */ }
      }

      // Generate each section sequentially
      for (const sectionId of sections) {
        sseWrite(res, { type: "tool_call", name: "Write", detail: `${sectionId}.md` });

        const task = agent.buildSectionTask(sectionId, {
          extraContext: context || undefined,
        });

        try {
          for await (const event of agent.streamSection(sectionId, task)) {
            if (event.type === "tool_call") {
              sseWrite(res, { type: "tool_call", name: event.name, detail: event.detail });
            }
            // Don't stream internal agent text to chat — it goes to the preview panel
          }
        } catch (genErr) {
          logger.error({ err: genErr, section: sectionId }, "streamSection error");
          sseWrite(res, { type: "text", content: `La génération de ${sectionId} a échoué. Réessaie.` });
          continue;
        }

        // Read the written file
        const filePath = path.join(agent.workDir, `${sectionId}.md`);
        if (!existsSync(filePath)) {
          sseWrite(res, { type: "text", content: `Le fichier ${sectionId}.md n'a pas été écrit. Réessaie.` });
          continue;
        }

        let content = readFileSync(filePath, "utf-8");

        // Humanize the content (skips non-prose sections like abbreviations)
        sseWrite(res, { type: "tool_call", name: "Humanizing", detail: sectionId });
        try {
          content = await streamingHumanize(content, sectionId, () => {});
        } catch (hErr) {
          logger.warn({ err: hErr, section: sectionId }, "humanize failed — using raw content");
        }

        const zustandKey = ZUSTAND_KEY[sectionId];
        if (zustandKey) {
          sseWrite(res, {
            type: "file_written",
            section: sectionId,
            zustand_key: zustandKey,
            content,
          });
        }
      }

      // Mark step as done after successful generation
      sseWrite(res, { type: "step_done" });

    } else if (action === "complete") {
      sseWrite(res, { type: "step_done" });
    }

    sseWrite(res, { type: "done" });
    res.end();

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    logger.error({ err }, "agent stream error");
    if (!res.writableEnded) {
      sseWrite(res, { type: "error", message: msg });
      sseWrite(res, { type: "done" });
      res.end();
    }
  }
});

export default router;
