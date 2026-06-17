import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "fs";
import path from "path";
import type { StreamEvent } from "./agent-session";
import { findClaudeBinary } from "./find-claude-binary";
import { schoolContext, schoolProfile } from "./moroccan-schools";
import { buildFormattingPromptBlock, type FormattingPrefs } from "./formatting";
import { getSectionConfig } from "./agents/sectionConfigs";
import { logger } from "./logger";
import humanizeSkillsMd from "./skills/humanize-skills.md";
import humanizeSystemMd from "./skills/humanize-system.md";

// Per-user working directory — each session gets isolated storage.
// Override with SESSIONS_DIR env var so Railway can mount a persistent volume.
const SESSIONS_ROOT = process.env.SESSIONS_DIR ?? "/tmp/rapportai-sessions";

export interface ReportProfile {
  studentName: string;
  school: string;
  filiere: string;
  reportType: string;
  theme: string;
  problematique?: string;
  citationStyle?: string;
  annee?: string;
  encadrantPeda?: string;
  encadrantPro?: string;
  entreprise?: string;
  ville?: string;
  dateDebutStage?: string;
  dateFinStage?: string;
  juryMember1?: string;
  juryMember2?: string;
  juryMember3?: string;
  formatting?: FormattingPrefs;
}

const SECTION_IDS = [
  "page-de-garde",
  "sommaire",
  "dedicaces",
  "remerciements",
  "resume",
  "introduction",
  "partie-i",
  "partie-ii",
  "conclusion",
  "abbreviations",
  "liste-figures",
  "liste-tableaux",
];

// ─── SDKReportAgent ───────────────────────────────────────────────────────────

export class SDKReportAgent {
  readonly id: string;
  readonly profile: ReportProfile;
  readonly createdAt: Date;
  lastActiveAt: Date;
  readonly workDir: string;
  private abortController: AbortController;

  constructor(sessionId: string, profile: ReportProfile) {
    this.id = sessionId;
    this.profile = profile;
    this.createdAt = new Date();
    this.lastActiveAt = new Date();
    this.abortController = new AbortController();

    this.workDir = path.join(SESSIONS_ROOT, sessionId);
    mkdirSync(this.workDir, { recursive: true });

    // Write profile so Claude can read it with the Read tool
    writeFileSync(
      path.join(this.workDir, "profile.json"),
      JSON.stringify(profile, null, 2)
    );

    // Write instructions file Claude will read first
    writeFileSync(
      path.join(this.workDir, "INSTRUCTIONS.md"),
      buildInstructions(profile)
    );
  }

  // Reconstruct an agent from an existing session directory (no disk writes).
  // Returns null if the session directory or profile.json doesn't exist.
  static reviveFromDisk(sessionId: string): SDKReportAgent | null {
    const workDir = path.join(SESSIONS_ROOT, sessionId);
    try {
      if (!existsSync(workDir)) return null;
      const profilePath = path.join(workDir, "profile.json");
      if (!existsSync(profilePath)) return null;
      const profile = JSON.parse(readFileSync(profilePath, "utf-8")) as ReportProfile;
      const agent = Object.create(SDKReportAgent.prototype) as SDKReportAgent;
      Object.assign(agent, {
        id: sessionId,
        profile,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        workDir,
        abortController: new AbortController(),
      });
      return agent;
    } catch {
      return null;
    }
  }

  // Load existing sections from previous sessions into working directory
  loadSections(sections: Record<string, string>): void {
    for (const [id, content] of Object.entries(sections)) {
      if (content) {
        writeFileSync(path.join(this.workDir, `${id}.md`), content);
      }
    }
  }

  // Upload a document so Claude can read it with the Read tool
  uploadDocument(filename: string, content: string | Buffer): void {
    writeFileSync(path.join(this.workDir, filename), content);
  }

  getDocumentNames(): string[] {
    try {
      return readdirSync(this.workDir).filter(
        (f) => !f.endsWith(".md") && f !== "profile.json" && f !== "INSTRUCTIONS.md"
      );
    } catch {
      return [];
    }
  }

  // List PNG page images extracted from uploaded PDFs (stored in figures/ subdirectory)
  listFigureImages(): string[] {
    try {
      const figuresDir = path.join(this.workDir, "figures");
      if (!existsSync(figuresDir)) return [];
      return readdirSync(figuresDir)
        .filter((f) => /^page-\d+\.png$/.test(f))
        .sort((a, b) => parseInt(a.match(/\d+/)?.[0] ?? "0", 10) - parseInt(b.match(/\d+/)?.[0] ?? "0", 10))
        .map((f) => `figures/${f}`);
    } catch {
      return [];
    }
  }

  // Read all written sections from disk
  getSections(): Record<string, string> {
    const sections: Record<string, string> = {};
    for (const id of SECTION_IDS) {
      const filePath = path.join(this.workDir, `${id}.md`);
      if (existsSync(filePath)) {
        sections[id] = readFileSync(filePath, "utf-8");
      }
    }
    return sections;
  }

  getSection(id: string): string | undefined {
    const filePath = path.join(this.workDir, `${id}.md`);
    return existsSync(filePath) ? readFileSync(filePath, "utf-8") : undefined;
  }

  // Load a skills file from src/lib/skills/
  // Tries multiple path strategies — process.cwd() differs between local and Render.
  // esbuild sets __dirname to the dist/ directory, so __dirname/../src/lib/skills works on Render.
  private loadSkillFile(filename: string): string {
    const candidates = [
      path.join(__dirname, "..", "src", "lib", "skills", filename),                             // dist/../src/lib/skills/ (Render esbuild)
      path.join(process.cwd(), "src", "lib", "skills", filename),                              // local dev
      path.join(process.cwd(), "artifacts", "api-server", "src", "lib", "skills", filename),  // from repo root
    ];
    for (const p of candidates) {
      try {
        if (existsSync(p)) {
          logger.info({ path: p, file: filename }, "loadSkillFile: loaded");
          return readFileSync(p, "utf-8");
        }
      } catch { /* try next */ }
    }
    logger.warn({ candidates, file: filename }, "loadSkillFile: not found in any candidate path");
    return "";
  }

  // streamSection — section-aware stream: loads correct system prompt + tools from sectionConfigs
  // toolOverride: pass a custom tool list to skip web research (e.g. for page-by-page mode)
  async *streamSection(section: string, task: string, toolOverride?: string[]): AsyncGenerator<StreamEvent> {
    this.lastActiveAt = new Date();
    this.abortController = new AbortController();
    const claudeBinary = findClaudeBinary();

    // Load section-specific system prompt + skills
    let sectionSystem = "";
    let sectionSkills = "";
    let allowedTools: string[] | undefined;
    let maxTurns = 25;

    try {
      const config = getSectionConfig(section);
      sectionSystem = this.loadSkillFile(config.skillsFile.replace("-skills.md", "-system.md"));
      sectionSkills = this.loadSkillFile(config.skillsFile);
      allowedTools = toolOverride ?? config.allowedTools;
      maxTurns = toolOverride ? 8 : config.maxTurns; // page mode needs fewer turns
    } catch { /* unknown section — fall back to generic */ }

    // Apply explicit override even if getSectionConfig threw
    if (toolOverride) allowedTools = toolOverride;

    // Combine: section system prompt + student context + knowledge base
    const baseSystem = buildSystemPrompt(this.profile, this.workDir);
    const knowledgeBase = sectionSkills
      ? `\n\n---\n## KNOWLEDGE BASE : LIS ENTIÈREMENT AVANT D'ÉCRIRE\n${sectionSkills}`
      : "";
    const systemPrompt = sectionSystem
      ? `${sectionSystem}\n\n---\n## CONTEXTE ÉTUDIANT\n${baseSystem}${knowledgeBase}`
      : `${baseSystem}${knowledgeBase}`;

    // All sections use Sonnet for consistent, jury-grade quality. Haiku was
    // cheaper (~5x) but produced weak output on the lighter sections (e.g. the
    // Abstract came out in French, terminology mangled). The light sections are
    // short, so the absolute cost increase is small.
    const sectionModel = "claude-sonnet-4-5";

    for await (const message of query({
      prompt: task,
      options: {
        abortController: this.abortController,
        maxTurns,
        cwd: this.workDir,
        systemPrompt,
        model: sectionModel,
        ...(allowedTools ? { allowedTools } : { permissionMode: "acceptEdits" }),
        ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
      },
    })) {
      yield* this._processMessage(message);
    }
  }

  // humanizeSection — iterative tool-based agent (same method as Claude Code and
  // routes/humanize.ts). It reads the section file, rewrites it IN PLACE with many
  // targeted Edits, then self-audits. Blind one-shot API rewrites only moved ZeroGPT
  // 97%→72%; the agentic read→edit→audit loop is what reaches the low-20s.
  // Editing in place (vs regenerating the whole file) also sidesteps output-token
  // truncation on long sections like Partie I.
  async humanizeSection(sectionId: string): Promise<void> {
    const rawPath = path.join(this.workDir, `${sectionId}.md`);
    if (!existsSync(rawPath)) {
      logger.warn({ section: sectionId }, "humanize: file not found");
      return;
    }

    const before = readFileSync(rawPath, "utf-8").trim();
    if (!before) {
      logger.warn({ section: sectionId }, "humanize: file is empty");
      return;
    }

    // Load both files at runtime; fall back to esbuild-bundled versions (guaranteed available).
    const runtimeSystem = this.loadSkillFile("humanize-system.md");
    // NOTE: we deliberately do NOT use humanize-skills.md / humanize-system.md as the
    // system prompt here. Both push aggressive "burstiness" ("after 3-4 sentences add a
    // very short/abrupt one"), which fragmented sections into telegraphic, pitch-deck
    // prose ("Réponse affirmative.", "Seconde voie.") that reads badly to a jury — and
    // ZeroGPT plateaus ~42% regardless. Quality of expression is the priority.
    void runtimeSystem; // (files still loaded above; intentionally unused now)
    const systemPrompt = `Tu es un relecteur expert qui peaufine des mémoires académiques en français (PFE, mémoire de master, rapport de stage). Ton seul objectif : un texte qui se lit comme rédigé par un excellent étudiant — fluide, naturel, de registre académique soutenu. Un JURY HUMAIN le lira ; la qualité de lecture prime sur tout le reste.

Tu peux réduire discrètement les marques d'IA (vocabulaire générique, tirets cadratins, transitions mécaniques, phrases toutes de même longueur), MAIS jamais au prix de la lisibilité.

INTERDICTIONS ABSOLUES :
- Aucune phrase sans verbe conjugué. Pas de fragments du type « Réponse affirmative. », « Seconde voie. », « +221 %. », « Validation empirique complète. ».
- Aucune question rhétorique télégraphique du type « Robustesse ? Confirmée. ».
- Pas de style haché ou journalistique : pas d'enchaînement de phrases ultra-courtes.
- Ne change ni le sens, ni les chiffres, ni les citations, ni la terminologie, ni les formules.

Chaque phrase doit être grammaticalement complète et se lire naturellement à voix haute. La variation de longueur doit rester SUBTILE et naturelle, comme dans un bon mémoire — jamais forcée. En cas de doute, préfère toujours une phrase complète et bien construite à un effet de style.`;

    const claudeBinary = findClaudeBinary();
    // Sonnet by default: Opus gave no ZeroGPT benefit (~42% either way) at ~5x the cost.
    // Override with HUMANIZE_MODEL=claude-opus-4-8 if needed.
    const model = process.env.HUMANIZE_MODEL || "claude-sonnet-4-5";
    // ~1 turn per paragraph edit + read + a single audit; scale with length, capped.
    // 1 audit round (not 3): extra rounds didn't improve the ZeroGPT score (~42% plateau)
    // and roughly doubled humanize time on long sections (Partie II hit ~14 min / 3 rounds).
    const maxTurns = Math.min(80, Math.max(30, Math.ceil(before.length / 1400)));

    const task = `Ta mission : réécrire le fichier "${sectionId}.md" pour qu'il se lise comme rédigé par un bon étudiant marocain — naturel, fluide et ACADÉMIQUE. Un jury (un humain) le lira : la qualité de lecture passe AVANT le score de détection. Réduis les tournures d'IA, mais sans jamais sacrifier le registre académique ni la grammaire.

Le texte d'IA a un défaut principal : toutes les phrases ont la même longueur et le même rythme. Tu dois introduire une VARIATION NATURELLE de longueur, comme le ferait un bon rédacteur.

PROCÉDURE (utilise Read puis Edit, un paragraphe à la fois — JAMAIS Write sur tout le fichier) :
1. Lis "${sectionId}.md".
2. Pour CHAQUE paragraphe, applique :
   - VARIATION DE RYTHME : alterne phrases longues et phrases plus courtes de façon naturelle. Une phrase courte de temps en temps (10-15 mots) suffit à casser la monotonie. Ne force pas : reste fluide.
   - Supprime TOUS les tirets cadratins (—).
   - Varie les débuts de phrases : évite que tous les paragraphes commencent par La/Le/Les/L'.
   - Casse les listes parallèles « X, Y et Z » de même forme grammaticale en variant la formulation.
   - Supprime le vocabulaire d'IA : systématiquement, cruciale, fondamentale, notamment, davantage, néanmoins, toutefois, "il convient de", "il est important de", "s'inscrit dans", "joue un rôle", "constitue/représente" (→ est/sont).
   - Coupe les transitions suréxpliquées (« C'est dans ce contexte que », « ainsi », « par ailleurs »).
   Applique chaque correction avec Edit immédiatement.

INTERDICTIONS ABSOLUES (sinon le texte paraît bâclé au jury) :
- JAMAIS de fragments sans verbe. Chaque phrase doit avoir un sujet et un verbe conjugué. Exemples À NE PAS produire : « Réponse affirmative. », « Pipeline Python pour collecter les données. », « +221 %. », « Validation empirique complète. », « Seconde voie. ». Reformule-les en phrases complètes.
- JAMAIS de questions rhétoriques télégraphiques du type « Robustesse en conditions extrêmes ? Confirmée. » ou « Programmation stochastique ? Écartés. ». Reformule en affirmation complète.
- Pas de style haché ou journalistique. Le registre reste celui d'un mémoire académique.

3. AUDIT (une seule passe) : relis le fichier. Vérifie qu'il ne reste AUCUN fragment sans verbe, AUCUNE question rhétorique télégraphique, AUCUN tiret cadratin, et que chaque paragraphe se lit naturellement à voix haute. Corrige avec Edit.

RÈGLES ABSOLUES :
- Conserve 100% du sens, des chiffres, citations (Auteur, année), formules et acronymes. Au minimum 95% des mots de l'original.
- Garde la même structure Markdown (titres, listes).
- Le fichier final "${sectionId}.md" DOIT contenir la version humanisée. Ne crée aucun autre fichier. Tout ton travail passe par Read/Edit sur "${sectionId}.md".`;

    logger.info({ section: sectionId, model, maxTurns, chars: before.length, mode: "quality-first" }, "humanize: starting (tool-based agent)");

    this.abortController = new AbortController();
    try {
      for await (const message of query({
        prompt: task,
        options: {
          abortController: this.abortController,
          maxTurns,
          cwd: this.workDir,
          systemPrompt,
          model,
          allowedTools: ["Read", "Edit", "Write"],
          ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
        },
      })) {
        void message; // drain — humanize internals aren't streamed to the user
      }
    } catch (err) {
      logger.warn({ err, section: sectionId }, "humanize: tool-based agent failed — keeping current file");
    }

    let after = readFileSync(rawPath, "utf-8").trim();

    // Deterministic safety net: strip any em dashes the agent left behind — a hard
    // ZeroGPT tell. Em dash with spaces → comma; without → comma too.
    if (after.includes("—")) {
      const stripped = after
        .replace(/ — /g, ", ")
        .replace(/— /g, ", ")
        .replace(/ —/g, ",")
        .replace(/—/g, ", ");
      writeFileSync(rawPath, stripped, "utf-8");
      after = stripped.trim();
      logger.info({ section: sectionId }, "humanize: stripped residual em dashes");
    }

    logger.info(
      { section: sectionId, changed: after !== before, beforeChars: before.length, afterChars: after.length },
      "humanize: complete",
    );
  }

  // stream — generic stream (used by revision + fallback), no section config
  async *stream(prompt: string): AsyncGenerator<StreamEvent> {
    this.lastActiveAt = new Date();
    this.abortController = new AbortController();
    const claudeBinary = findClaudeBinary();

    for await (const message of query({
      prompt,
      options: {
        abortController: this.abortController,
        maxTurns: 25,
        cwd: this.workDir,
        systemPrompt: buildSystemPrompt(this.profile, this.workDir),
        permissionMode: "acceptEdits",
        ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
      },
    })) {
      yield* this._processMessage(message);
    }
  }

  private *_processMessage(message: SDKMessage): Generator<StreamEvent> {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text" && block.text) {
          yield { type: "text", content: block.text };
        }
        if (block.type === "tool_use") {
          const detail = buildToolDetail(block.name, block.input as Record<string, unknown>);
          yield { type: "tool_call", name: block.name, detail };
        }
      }
    }
    // result message signals completion — no event needed, loop ends naturally
  }

  abort(): void {
    this.abortController.abort();
  }

  // Patch in-memory profile with latest fields from the frontend
  patchProfile(fields: Partial<ReportProfile>): void {
    Object.assign(this.profile, fields);
    // Rewrite profile.json so the agent reads the updated version
    writeFileSync(
      path.join(this.workDir, "profile.json"),
      JSON.stringify(this.profile, null, 2)
    );
  }

  // Build a structured context packet — injected before every agent call.
  // Passes summaries only (never full section text) to keep prompts lean.
  buildContextPacket(section: string, sectionSummaries: Record<string, { key_points: string; word_count: number }> = {}): string {
    const p = this.profile;
    const doneSummaries = Object.entries(sectionSummaries)
      .filter(([s]) => s !== section)
      .reduce<Record<string, string>>((acc, [s, v]) => {
        acc[s] = v.key_points;
        return acc;
      }, {});

    const packet = {
      student_profile: {
        name:           p.studentName,
        institution:    p.school,
        department:     p.filiere,
        supervisor:     p.encadrantPeda,
        academic_year:  p.annee,
        report_type:    p.reportType,
        language:       "français",
      },
      section_instructions: {
        name:       section,
        tone:       "academic",
      },
      previous_sections_summary: doneSummaries,
      coherence_rules: [
        "La problématique de l'Introduction doit être adressée dans chaque partie",
        "Ne jamais répéter des informations déjà couvertes dans les sections précédentes",
        "Maintenir une terminologie cohérente tout au long du rapport",
      ],
    };
    return JSON.stringify(packet, null, 2);
  }

  // Build the task prompt for a report section
  buildSectionTask(section: string, opts?: { extraContext?: string; figures?: { figureNumber: number; title: string; source: string; author: string; caption: string; placement: string }[] }): string {
    const p = this.profile;
    const style = p.citationStyle ?? "APA 7th ed.";
    const prob =
      p.problematique ??
      `Dans quelle mesure "${p.theme}" peut-il être approfondi dans le contexte marocain ?`;

    const docs = this.getDocumentNames();
    const txtCompanions = docs.filter(f => f.endsWith(".txt") && docs.includes(f.slice(0, -4)));
    const docNote =
      docs.length > 0
        ? `\nDocuments uploadés disponibles dans ce dossier : ${docs.join(", ")}. Commence par les lire avec Read.\n` +
          (txtCompanions.length > 0
            ? `Note : les fichiers ${txtCompanions.map(f => f.slice(0, -4)).join(", ")} ont été convertis en texte — lis leur version .txt (ex: "${txtCompanions[0]}") pour accéder au contenu extrait.\n`
            : "")
        : "";

    const figImages = this.listFigureImages();
    const figImageNote = figImages.length > 0
      ? `\nImages PNG des pages du PDF disponibles (${figImages.length} page(s)) : ${figImages.join(", ")}. ` +
        `Utilise Read sur ces fichiers pour voir visuellement les graphiques, tableaux et schémas du document. ` +
        `Quand tu références une figure extraite du PDF dans le texte, insère une ligne Markdown d'image IMMÉDIATEMENT après la phrase de référence, ` +
        `en utilisant le format exact : ![Figure N](figures/page-X.png) où N est le numéro de la figure et X est le numéro de la page PDF. ` +
        `Exemple : « Comme l'illustre la Figure 1 ci-dessous, [...] »\n![Figure 1](figures/page-2.png)\n` +
        `*Figure 1 — Titre de la figure. Source : ...*\n` +
        `Ne laisse jamais de référence textuelle sans son image Markdown correspondante.\n`
      : "";

    // Applies to all sections — prevents HTML tags appearing as raw text in preview/docx
    const noHtmlNote = `RÈGLE DE FORMATAGE : N'utilise JAMAIS de balises HTML (<sub>, <sup>, <br>, <b>, etc.) dans le texte. Pour les indices mathématiques, utilise les caractères Unicode : indices (₀₁₂₃₄₅₆₇₈₉ₐₑₒₙₚₜᵢⱼ) et exposants (⁰¹²³⁴⁵⁶⁷⁸⁹ⁿᵀ). Exemples : wₚ, σₚ², μₙ, Rₜ, wᵢ, σᵢⱼ, εₜ₋₁, βⱼ. Pour les vecteurs transposés, utilise ᵀ (ex: wᵀ). Pour les indices longs non disponibles en Unicode (comme MVP, GARCH), utilise des parenthèses ou underscores dans le texte markdown : w(MVP), σ(GARCH), H(t). Ne laisse aucune balise HTML dans le document final.\n\n`;

    switch (section) {
      case "partie-i": {
        const figsI = (opts?.figures ?? []).filter(f => f.placement === "Partie I");
        const figNoteI = figsI.length > 0
          ? `\n\nFigures uploadées par l'étudiant pour la Partie I. Intègre-les dans le texte avec "La Figure N montre..." :\n` +
            figsI.map(f => `- Figure ${f.figureNumber} : "${f.title}" (Source : ${f.source}, Auteur : ${f.author})\n  Légende : ${f.caption}`).join("\n")
          : "";
        const contextPacketI = opts?.extraContext
          ? `\n\n## CONTEXTE INJECTÉ PAR L'ORCHESTRATEUR\n${opts.extraContext}\n---\n`
          : "";
        const ctx = opts?.extraContext ?? "";
        const lengthI = /concis/i.test(ctx) || /15.{1,5}20\s*page/i.test(ctx)
          ? "Longueur cible : 15 à 20 pages (4 000–5 500 mots). Reste concis et précis, sans développement excessif."
          : /développ/i.test(ctx) || /35.{1,5}45\s*page/i.test(ctx) || /40.{1,5}50\s*page/i.test(ctx)
            ? "Longueur cible : 35 à 45 pages (9 500–12 000 mots). Approfondis chaque section : définitions, auteurs, exemples, données, analyses."
            : "Longueur cible : 25 à 30 pages (6 500–8 000 mots). Chaque section doit être substantielle — minimum 3 paragraphes développés, pas de bullet points.";
        return `${noHtmlNote}${docNote}${figImageNote}${contextPacketI}Lis sommaire.md pour extraire la structure exacte de la Partie I (chapitres et sections).
AVANT de rédiger chaque section ou chapitre, utilise WebSearch pour trouver 2-3 sources académiques récentes (2020-2025) pertinentes. Utilise WebFetch pour lire le contenu des pages trouvées et extraire des citations précises (auteur, année, titre, résultats chiffrés si disponibles). Cite toutes les sources dans le texte en style ${style}.
Génère ensuite la Partie I complète en suivant cette structure. Ne modifie aucun titre, n'ajoute aucun chapitre.
La Partie I est le cadre THÉORIQUE : elle doit poser les fondements conceptuels que la Partie II empirique va tester ou appliquer.
${lengthI}
Problématique : ${prob} | Style de citation : ${style}${figNoteI}
Enregistre dans partie-i.md une fois terminé.`;
      }

      case "partie-ii": {
        const figsII = (opts?.figures ?? []).filter(f => f.placement === "Partie II");
        const figNoteII = figsII.length > 0
          ? `\n\nFigures uploadées par l'étudiant pour la Partie II. Intègre-les dans le texte avec "La Figure N montre..." :\n` +
            figsII.map(f => `- Figure ${f.figureNumber} : "${f.title}" (Source : ${f.source}, Auteur : ${f.author})\n  Légende : ${f.caption}`).join("\n")
          : "";
        const contextPacket = opts?.extraContext
          ? `\n\n## CONTEXTE INJECTÉ PAR L'ORCHESTRATEUR\n${opts.extraContext}\n---\n`
          : "";
        const ctxII = opts?.extraContext ?? "";
        const lengthII = /concis/i.test(ctxII) || /15.{1,5}20\s*page/i.test(ctxII)
          ? "Longueur cible : 15 à 20 pages (4 000–5 500 mots). Reste concis et précis, sans développement excessif."
          : /développ/i.test(ctxII) || /35.{1,5}45\s*page/i.test(ctxII) || /40.{1,5}50\s*page/i.test(ctxII)
            ? "Longueur cible : 35 à 45 pages (9 500–12 000 mots). Approfondis chaque section : méthodologie, collecte des données, analyses statistiques, interprétations."
            : "Longueur cible : 25 à 30 pages (6 500–8 000 mots). Chaque section doit être substantielle — minimum 3 paragraphes développés, pas de bullet points.";
        return `${noHtmlNote}${docNote}${figImageNote}${contextPacket}Lis sommaire.md pour extraire la structure exacte de la Partie II (chapitres et sections).
Lis aussi partie-i.md. Les références croisées vers Partie I sont OBLIGATOIRES. Chaque chapitre de la Partie II doit s'ancrer dans le cadre théorique établi en Partie I.
AVANT de rédiger chaque section ou chapitre, utilise WebSearch pour trouver 2-3 sources académiques récentes (2020-2025) pertinentes. Utilise WebFetch pour lire le contenu des pages trouvées et extraire des citations précises (auteur, année, titre, résultats chiffrés si disponibles). Cite toutes les sources dans le texte en style ${style}.
Génère ensuite la Partie II complète en suivant la structure du sommaire.
${lengthII}
Problématique : ${prob} | Style de citation : ${style}${figNoteII}
Enregistre dans partie-ii.md une fois terminé.`;
      }

      case "introduction": {
        const introExtra = opts?.extraContext
          ? `\n\n## CONTEXTE FOURNI PAR L'ÉTUDIANT — À RESPECTER ABSOLUMENT\n${opts.extraContext}\nAncre le contexte, la problématique et les objectifs sur ces éléments précis. N'utilise PAS de formulation générique.\n---\n`
          : "";
        return `${noHtmlNote}${docNote}${introExtra}Lis INSTRUCTIONS.md, profile.json, et toutes les sections .md existantes.
Rédige l'Introduction Générale (400–600 mots) du ${p.reportType} "${p.theme}".
Structure : Contexte → Problématique → Objectifs → Structure du rapport.
Problématique : ${prob}
Enregistre dans introduction.md.`;
      }

      case "conclusion": {
        const contextPacketConclusion = opts?.extraContext
          ? `\n\n## CONTEXTE INJECTÉ PAR L'ORCHESTRATEUR\n${opts.extraContext}\n---\n`
          : "";
        return `${noHtmlNote}${docNote}${contextPacketConclusion}Lis introduction.md, partie-i.md, partie-ii.md (OBLIGATOIRE : la conclusion doit synthétiser les deux parties et répondre à la problématique posée en introduction).
Rédige la Conclusion Générale (400–600 mots).
Structure : Synthèse des apports → Réponse à la problématique → Limites → Perspectives futures.
Chaque paragraphe doit référencer explicitement une des deux parties.
Enregistre dans conclusion.md.`;
      }

      case "resume": {
        const resumeExtra = opts?.extraContext
          ? `\n\nContexte fourni par l'étudiant (à intégrer) :\n"""\n${opts.extraContext}\n"""`
          : "";
        return `${noHtmlNote}${docNote}Lis introduction.md si présent.${resumeExtra}
Rédige le Résumé EN FRANÇAIS (350–450 mots, environ 1 page) en TEXTE CONTINU : 4 à 5 paragraphes fluides qui couvrent dans l'ordre le contexte, les objectifs et la problématique, la méthodologie, les résultats attendus et les apports.
INTERDIT ABSOLU : aucun titre, aucun sous-titre, aucune liste à puces à l'intérieur du résumé — uniquement des paragraphes de prose académique qui s'enchaînent.
Termine par une seule ligne : "**Mots-clés :** mot1, mot2, mot3, mot4, mot5" — choisis toi-même 5 à 6 mots-clés précis tirés du thème et de la problématique.
Enregistre dans resume.md.`;
      }

      case "abstract": {
        return `${noHtmlNote}${docNote}Read resume.md first — the Abstract is the faithful English translation of the French Résumé.
Write the Abstract IN ENGLISH ONLY — not a single French word in the body or keywords.
Same structure as the Résumé: research objective → methodology → key results. Same length (300–450 words).
Natural academic English — adapt phrasing so it reads natively, do not translate word-for-word.
No sub-titles, no bullet points, continuous prose only.
End with one line: "**Keywords:** word1, word2, word3, word4, word5" — English equivalents of the French mots-clés.
Save to abstract.md.`;
      }

      case "page-de-garde": {
        const contextBlock = opts?.extraContext
          ? `\n\nCONTEXTE DE LA CONVERSATION (extrais les infos manquantes ici — noms, jury, entreprise) :\n"""\n${opts.extraContext}\n"""`
          : "";

        return `CONTEXTE ÉTUDIANT (NE REDEMANDE JAMAIS CES INFOS) :
- Nom : ${p.studentName}
- École : ${p.school}
- Filière : ${p.filiere}
- Type de rapport : ${p.reportType}
- Thème : ${p.theme}
- Année : ${p.annee ?? "2024–2025"}
${p.encadrantPeda ? `- Encadrant pédagogique : ${p.encadrantPeda}` : ""}
${p.encadrantPro ? `- Encadrant professionnel : ${p.encadrantPro}` : ""}
${p.entreprise ? `- Entreprise d'accueil : ${p.entreprise}` : ""}
${p.ville ? `- Ville : ${p.ville}` : ""}
${p.juryMember1 ? `- Jury : ${p.juryMember1}${p.juryMember2 ? `, ${p.juryMember2}` : ""}${p.juryMember3 ? `, ${p.juryMember3}` : ""}` : ""}
${contextBlock}

RÈGLE ABSOLUE : Tu es un agent batch, PAS interactif. Tu ne poses AUCUNE question.
Si des infos semblent manquantes dans le profil, cherche-les dans le contexte de conversation ci-dessus.
Si elles n'y sont pas non plus, génère quand même la page de garde avec ce que tu as — laisse les champs absent vides proprement (ne mets pas de placeholder).

Suis les instructions du skills file (page-de-garde-skills.md) pour choisir PATH A (template) ou PATH B (pas de template).
Enregistre dans page-de-garde.md.`;
      }

      case "sommaire": {
        const sommaireExtra = opts?.extraContext
          ? `\n\n## PLAN VALIDÉ PAR L'ÉTUDIANT — respecte exactement cette structure :\n${opts.extraContext}\n---\n`
          : "";
        return `${noHtmlNote}${docNote}${sommaireExtra}Lis profile.json.
Génère le Sommaire structuré du ${p.reportType} "${p.theme}" en Markdown académique.
Format obligatoire :
- ## pour les parties principales (Partie I, Partie II, etc.)
- ### pour les chapitres
- #### pour les sections
Inclus : Introduction Générale, les parties avec leurs chapitres, Conclusion Générale, Bibliographie, Abréviations.
N'invente aucune structure non validée. Respecte EXACTEMENT le plan fourni dans le contexte.
Enregistre dans sommaire.md.`;
      }

      case "dedicaces": {
        const dedicacesExtra = opts?.extraContext
          ? `\n\nDemande spécifique de l'étudiant(e), respecte-la impérativement, préserve chaque nom mentionné :\n"""\n${opts.extraContext}\n"""`
          : "";
        return `${noHtmlNote}${docNote}Lis profile.json.${dedicacesExtra}
IMPORTANT : Ne lis PAS dedicaces.md s'il existe. Génère un texte entièrement nouveau from scratch.
Rédige les Dédicaces (8–20 lignes, style lyrique et sobre).
Utilise Write pour écrire dedicaces.md (écrase tout contenu précédent).`;
      }

      case "remerciements": {
        const remExtra = opts?.extraContext
          ? `\n\nDemande spécifique de l'étudiant(e), intègre TOUS les noms et éléments mentionnés :\n"""\n${opts.extraContext}\n"""`
          : "";
        return `${noHtmlNote}${docNote}Lis profile.json pour les noms et titres des encadrants.${remExtra}
IMPORTANT : Ne lis PAS remerciements.md s'il existe. Génère un texte entièrement nouveau from scratch.
Rédige les Remerciements (200–350 mots, ton formel et sincère).
Respecte l'ordre : encadrant pédagogique → encadrant professionnel → école → famille → amis si mentionnés.
Varie les formules d'ouverture de chaque paragraphe.
Utilise Write pour écrire remerciements.md (écrase tout contenu précédent).`;
      }

      case "abbreviations":
        return `${noHtmlNote}${docNote}Lis toutes les sections .md existantes (introduction.md, partie-i.md, partie-ii.md, conclusion.md, resume.md).
Identifie TOUTES les abréviations, sigles et acronymes utilisés dans le rapport.
Génère un tableau JSON UNIQUEMENT (sans texte avant/après) avec ce format exact :
[{"abbr":"OPCVM","sig":"Organisme de Placement Collectif en Valeurs Mobilières"},...]
Chaque abréviation doit avoir "abbr" (le sigle) et "sig" (la signification complète en français).
Inclus minimum 10 abréviations. Ne génère AUCUN texte en dehors du JSON.
Enregistre dans abbreviations.md.`;

      case "liste-figures": {
        const figExtra = opts?.extraContext
          ? `\n\n## MÉTADONNÉES ET CONTEXTE FOURNIS PAR L'ÉTUDIANT — utilise impérativement ces informations :\n${opts.extraContext}\n---\n`
          : "";
        return `${noHtmlNote}${docNote}${figExtra}Lis partie-i.md et partie-ii.md (utilise Glob si tu n'es pas sûr des fichiers disponibles).
Combine ce contexte avec les mentions trouvées dans les fichiers .md pour identifier TOUTES les figures du rapport.
Génère une liste académique numérotée au format Markdown (sans ligne de titre ## en début — elle sera ajoutée par l'export) :

**Figure 1** — [Titre tel qu'il apparaît dans le texte ou dans les métadonnées]
*Source : [source mentionnée, ou "Auteur propre" si absente]*

**Figure 2** — ...

Si aucune figure n'est trouvée : génère "*(Aucune figure dans ce rapport)*"
Enregistre dans liste-figures.md.`;
      }

      case "liste-tableaux": {
        const tabExtra = opts?.extraContext
          ? `\n\n## CONTEXTE FOURNI PAR L'ÉTUDIANT :\n${opts.extraContext}\n---\n`
          : "";
        return `${noHtmlNote}${docNote}${tabExtra}Lis partie-i.md et partie-ii.md (utilise Glob si tu n'es pas sûr des fichiers disponibles).
Identifie TOUTES les références aux tableaux : "Tableau N", "Table N", "Tableau N —", etc.
Génère une liste académique numérotée au format Markdown (sans ligne de titre ## en début — elle sera ajoutée par l'export) :

**Tableau 1** — [Titre tel qu'il apparaît dans le texte]
*Source : [source mentionnée, ou "Données primaires" si absente]*

**Tableau 2** — ...

Si aucun tableau n'est trouvé : génère "*(Aucun tableau dans ce rapport)*"
Enregistre dans liste-tableaux.md.`;
      }

      default:
        return `${noHtmlNote}${docNote}Rédige la section "${section}" du rapport.${opts?.extraContext ? `\n\nContexte supplémentaire : ${opts.extraContext}` : ""}\nEnregistre dans ${section}.md.`;
    }
  }

  // Build a surgical revision task
  buildRevisionTask(sectionId: string, instruction: string, attachedFiles?: string[]): string {
    const filesNote = attachedFiles && attachedFiles.length > 0
      ? `\n\nL'étudiant a joint ${attachedFiles.length} fichier(s). Lis-les avec Read avant de réviser : ${attachedFiles.join(", ")}.`
      : "";

    return `Lis ${sectionId}.md.
L'étudiant demande : ${instruction}${filesNote}

Applique des modifications chirurgicales uniquement. Ne réécris pas toute la section.
Utilise Edit pour modifier uniquement les passages concernés.
Conserve la structure Markdown, les citations et les références croisées.
Sauvegarde les changements dans ${sectionId}.md.`;
  }

  // Clean up working directory (call when session expires)
  destroy(): void {
    try {
      rmSync(this.workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

// ─── Tool trace detail builder ───────────────────────────────────────────────

function buildToolDetail(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Read": {
      const fp = String(input.file_path ?? "");
      return `Lecture : ${fp.split(/[\\/]/).pop() ?? fp}`;
    }
    case "Write": {
      const fp = String(input.file_path ?? "");
      return `Écriture : ${fp.split(/[\\/]/).pop() ?? fp}`;
    }
    case "Edit": {
      const fp = String(input.file_path ?? "");
      return `Révision : ${fp.split(/[\\/]/).pop() ?? fp}`;
    }
    case "WebSearch":
      return `Recherche : "${String(input.query ?? "").slice(0, 60)}"`;
    case "WebFetch": {
      const url = String(input.url ?? "");
      try { return `Fetch : ${new URL(url).hostname}`; } catch { return `Fetch : ${url.slice(0, 60)}`; }
    }
    case "Glob":
      return `Analyse : ${String(input.pattern ?? "*")}`;
    case "Bash":
      return `Exécution : ${String(input.command ?? "").slice(0, 60)}`;
    default:
      return String(input.description ?? input.task ?? toolName);
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(p: ReportProfile, workDir?: string): string {
  const style = p.citationStyle ?? "APA 7th ed.";
  const schoolFull = schoolContext(p.school);
  const schoolProfileBlock = p.school ? `\n\n${schoolProfile(p.school)}` : "";
  const formattingBlock = buildFormattingPromptBlock(p.formatting);

  // Read student_memory.json from disk to pick up canevas flag and other enrichments
  let canevasNote = "";
  if (workDir) {
    try {
      const memPath = path.join(workDir, "student_memory.json");
      if (existsSync(memPath)) {
        const mem = JSON.parse(readFileSync(memPath, "utf-8")) as { report?: { canevas_uploaded?: boolean; canevas_filename?: string } };
        if (mem.report?.canevas_uploaded && mem.report?.canevas_filename) {
          canevasNote = `\n\n## ⚠️ CANEVAS OBLIGATOIRE\nL'école a fourni un canevas : **${mem.report.canevas_filename}**. Lis ce fichier EN PREMIER avec Read avant toute rédaction et respecte sa structure exactement.`;
        }
      }
    } catch { /* memory missing — continue without */ }
  }

  return `Tu es l'agent de rédaction académique de RapportAI, une instance Claude Code dédiée au rapport de ${p.studentName} à ${schoolFull}.

## Ton environnement
Tu travailles dans un dossier dédié à ce rapport. Utilise Glob pour lister tous les fichiers disponibles au démarrage. Les fichiers possibles :
- \`INSTRUCTIONS.md\` : directives détaillées du rapport. LIS EN PREMIER
- \`profile.json\` : profil complet de l'étudiant. LIS EN DEUXIÈME
- \`*.md\` : sections déjà rédigées (partie-i.md, conclusion.md, etc.). Lis avant d'écrire
- Documents uploadés : PDFs, Word, TXT fournis par l'étudiant
- \`template-screenshot.png\` : capture visuelle du modèle Word de l'école
- Fichier \`.docx\` : contenu textuel du template de l'école

## Étapes obligatoires avant toute rédaction
1. Glob pour lister tous les fichiers du dossier
2. Lire \`INSTRUCTIONS.md\`
3. Lire \`profile.json\`
4. Lire toutes les sections \`.md\` existantes pour cohérence et références croisées
5. Si un template ou screenshot existe, le lire pour respecter la mise en page

## Règles absolues
- Français académique formel, registre soutenu uniquement
- Citations RÉELLES uniquement, JAMAIS inventer une citation (auteur, titre, DOI, année). Privilégie d'abord les références académiques majeures et bien établies que tu connais avec certitude. Tu peux faire 2-3 recherches web ciblées MAXIMUM (WebFetch sur Semantic Scholar/CrossRef) pour confirmer une source — n'enchaîne pas des dizaines de recherches, ça ralentit énormément la génération. Si une source n'est pas sûre, remplace-la par une autre que tu connais
- Structure Markdown obligatoire : \`##\` pour les chapitres, \`###\` pour les sections
- Minimum 2500 mots pour Partie I et Partie II
- Références croisées entre sections obligatoires. Cite ce qui a été écrit dans les autres parties
- Style de citation : ${style}
- Enregistre chaque section terminée avec Write dans son fichier \`.md\`
- Utilise Edit pour les modifications chirurgicales. Ne réécris jamais une section entière pour un petit changement

## Profil de l'étudiant
- Nom : ${p.studentName}
- École : ${p.school} (${schoolFull})
- Filière : ${p.filiere}
- Type de rapport : ${p.reportType}
- Thème : "${p.theme}"
- Année : ${p.annee ?? "2024–2025"}
- Style de citation : ${style}
${p.problematique ? `- Problématique : ${p.problematique}` : ""}
${p.encadrantPeda ? `- Encadrant pédagogique : ${p.encadrantPeda}` : ""}
${p.encadrantPro ? `- Encadrant professionnel : ${p.encadrantPro}` : ""}
${p.entreprise ? `- Entreprise d'accueil : ${p.entreprise}` : ""}
${p.ville ? `- Ville : ${p.ville}` : ""}
${p.dateDebutStage ? `- Début de stage : ${p.dateDebutStage}` : ""}
${p.dateFinStage ? `- Fin de stage : ${p.dateFinStage}` : ""}
${p.juryMember1 ? `- Membre du jury 1 : ${p.juryMember1}` : ""}
${p.juryMember2 ? `- Membre du jury 2 : ${p.juryMember2}` : ""}
${p.juryMember3 ? `- Membre du jury 3 : ${p.juryMember3}` : ""}${schoolProfileBlock}${formattingBlock}

## Interdictions absolues
- Ne jamais inventer des citations, auteurs, titres, DOI, ou dates de publication
- Ne jamais rédiger une section sans avoir lu les sections existantes
- Ne jamais ignorer le template ou le canevas de l'école si fourni
- Ne jamais dépasser le scope de la section demandée
- Après avoir écrit le fichier avec Write, ne génère AUCUN texte de confirmation, résumé ou commentaire. Ton travail est terminé. Arrête-toi immédiatement.
- Pour les sections courtes (dédicaces, remerciements, résumé), utilise Write UNE SEULE FOIS avec le contenu complet. N'appelle jamais Write deux fois sur le même fichier.${canevasNote}`;
}

// ─── Instructions file written to disk ───────────────────────────────────────

function buildInstructions(p: ReportProfile): string {
  return `# RapportAI : Instructions pour ${p.studentName}

## Rapport
- Type : ${p.reportType}
- Thème : ${p.theme}
- École : ${p.school}, ${p.filiere}
- Année : ${p.annee ?? "2024–2025"}
${p.problematique ? `- Problématique : ${p.problematique}` : ""}
${p.encadrantPeda ? `- Encadrant pédagogique : ${p.encadrantPeda}` : ""}
${p.encadrantPro ? `- Encadrant professionnel : ${p.encadrantPro}` : ""}
${p.entreprise ? `- Entreprise : ${p.entreprise}` : ""}
${p.ville ? `- Ville : ${p.ville}` : ""}
${p.dateDebutStage ? `- Date de début de stage : ${p.dateDebutStage}` : ""}
${p.dateFinStage ? `- Date de fin de stage : ${p.dateFinStage}` : ""}
${p.juryMember1 ? `- Membre du jury 1 : ${p.juryMember1}` : ""}
${p.juryMember2 ? `- Membre du jury 2 : ${p.juryMember2}` : ""}
${p.juryMember3 ? `- Membre du jury 3 : ${p.juryMember3}` : ""}

## Sections du rapport (ordre canonique)
1. dedicaces.md
2. remerciements.md
3. resume.md
4. introduction.md
5. partie-i.md
6. partie-ii.md
7. conclusion.md

## Standard qualité
- Minimum 2500 mots par partie principale
- Citations réelles avec DOI quand disponible
- Références croisées entre sections obligatoires
- Style de citation : ${p.citationStyle ?? "APA 7th ed."}

## RÈGLE ÉDITIONS CHIRURGICALES
Quand une section .md existe déjà et que la demande porte sur UN passage spécifique :
- Utilise TOUJOURS l'outil Edit (pas Write) pour ne modifier QUE la partie demandée
- Lis le fichier avec Read AVANT d'éditer pour localiser précisément le passage
- Utilise Write uniquement pour une régénération COMPLÈTE explicitement demandée

## OUTIL crop_figure (recadrage d'images)
Pour extraire une figure d'une page PNG (pages du PDF disponibles dans figures/) :
\`\`\`bash
mkdir -p figures
python3 -c "
from PIL import Image
import os
img = Image.open('figures/page-3.png')
# Recadre la région (left, upper, right, lower) en pixels
cropped = img.crop((100, 200, 900, 550))
cropped.save('figures/chart_nom.png')
print('saved figures/chart_nom.png')
"
\`\`\`
Puis intègre dans le markdown :
\`\`\`
![Description du graphique](figures/chart_nom.png)
*Figure N — Titre. Source : Auteur, Année.*
\`\`\`
Utilise PIL.Image.open().size pour voir les dimensions avant de définir les coordonnées de recadrage.
`;
}
