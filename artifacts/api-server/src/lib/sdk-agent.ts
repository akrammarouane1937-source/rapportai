import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "fs";
import path from "path";
import type { StreamEvent } from "./agent-session";
import { findClaudeBinary } from "./find-claude-binary";
import { schoolContext } from "./moroccan-schools";
import { getSectionConfig } from "./agents/sectionConfigs";

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
}

const SECTION_IDS = [
  "dedicaces",
  "remerciements",
  "resume",
  "introduction",
  "partie-i",
  "partie-ii",
  "conclusion",
  "abbreviations",
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
  private loadSkillFile(filename: string): string {
    try {
      const p = path.join(process.cwd(), "src/lib/skills", filename);
      if (existsSync(p)) return readFileSync(p, "utf-8");
    } catch { /* missing — silent */ }
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
      ? `\n\n---\n## KNOWLEDGE BASE — LIS ENTIÈREMENT AVANT D'ÉCRIRE\n${sectionSkills}`
      : "";
    const systemPrompt = sectionSystem
      ? `${sectionSystem}\n\n---\n## CONTEXTE ÉTUDIANT\n${baseSystem}${knowledgeBase}`
      : `${baseSystem}${knowledgeBase}`;

    for await (const message of query({
      prompt: task,
      options: {
        abortController: this.abortController,
        maxTurns,
        cwd: this.workDir,
        systemPrompt,
        ...(allowedTools ? { allowedTools } : { permissionMode: "acceptEdits" }),
        ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
      },
    })) {
      yield* this._processMessage(message);
    }
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

  // Build the task prompt for a report section
  buildSectionTask(section: string, opts?: { extraContext?: string; figures?: { figureNumber: number; title: string; source: string; author: string; caption: string; placement: string }[] }): string {
    const p = this.profile;
    const style = p.citationStyle ?? "APA 7th ed.";
    const prob =
      p.problematique ??
      `Dans quelle mesure "${p.theme}" peut-il être approfondi dans le contexte marocain ?`;

    const docs = this.getDocumentNames();
    const docNote =
      docs.length > 0
        ? `\nDocuments uploadés disponibles dans ce dossier : ${docs.join(", ")}. Commence par les lire avec Read.\n`
        : "";

    switch (section) {
      case "partie-i": {
        const figsI = (opts?.figures ?? []).filter(f => f.placement === "Partie I");
        const figNoteI = figsI.length > 0
          ? `\n\nFigures uploadées par l'étudiant pour la Partie I — intègre-les dans le texte avec "La Figure N montre..." :\n` +
            figsI.map(f => `- Figure ${f.figureNumber} — "${f.title}" (Source : ${f.source}, Auteur : ${f.author})\n  Légende : ${f.caption}`).join("\n")
          : "";
        return `${docNote}Lis sommaire.md pour extraire la structure exacte de la Partie I (chapitres et sections).
Génère ensuite la Partie I complète en suivant cette structure — ne modifie aucun titre, n'ajoute aucun chapitre.
Problématique : ${prob} | Style de citation : ${style}${figNoteI}
Enregistre dans partie-i.md une fois terminé.`;
      }

      case "partie-ii": {
        const figsII = (opts?.figures ?? []).filter(f => f.placement === "Partie II");
        const figNoteII = figsII.length > 0
          ? `\n\nFigures uploadées par l'étudiant pour la Partie II — intègre-les dans le texte avec "La Figure N montre..." :\n` +
            figsII.map(f => `- Figure ${f.figureNumber} — "${f.title}" (Source : ${f.source}, Auteur : ${f.author})\n  Légende : ${f.caption}`).join("\n")
          : "";
        return `${docNote}Lis sommaire.md pour extraire la structure exacte de la Partie II (chapitres et sections).
Lis aussi partie-i.md — les références croisées vers Partie I sont obligatoires.
Génère ensuite la Partie II complète en suivant la structure du sommaire.
Problématique : ${prob} | Style de citation : ${style}${figNoteII}
Enregistre dans partie-ii.md une fois terminé.`;
      }

      case "introduction":
        return `${docNote}Lis INSTRUCTIONS.md, profile.json, et toutes les sections .md existantes.
Rédige l'Introduction Générale (400–600 mots) du ${p.reportType} "${p.theme}".
Structure : Contexte → Problématique → Objectifs → Structure du rapport.
Problématique : ${prob}
Enregistre dans introduction.md.`;

      case "conclusion": {
        const conclusionExtra = opts?.extraContext
          ? `\n\nÉléments spécifiques à intégrer : ${opts.extraContext}`
          : "";
        return `${docNote}Lis introduction.md, partie-i.md, partie-ii.md (obligatoire).
Rédige la Conclusion Générale (400–600 mots).
Structure : Synthèse → Apports → Limites → Perspectives.
Références directes vers les deux parties.${conclusionExtra}
Enregistre dans conclusion.md.`;
      }

      case "resume":
        return `${docNote}Lis introduction.md si présent.
Rédige le Résumé (250–300 mots) : Contexte → Objectifs → Méthodologie → Résultats → Conclusion.
Termine par les mots-clés (5–8).
Enregistre dans resume.md.`;

      case "page-de-garde": {
        const missingFields: string[] = [];
        if (!p.encadrantPeda) missingFields.push("encadrant pédagogique");
        if (!p.encadrantPro && p.reportType !== "Mémoire") missingFields.push("encadrant professionnel");
        if (!p.entreprise && p.reportType !== "Mémoire") missingFields.push("entreprise d'accueil");
        if (!p.juryMember1) missingFields.push("membres du jury (optionnel)");

        return `CONTEXTE ÉTUDIANT — NE REDEMANDE JAMAIS CES INFOS :
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

${missingFields.length > 0 ? `INFOS MANQUANTES — pose ces questions en UN SEUL message avant de générer :\n${missingFields.map(f => `- ${f} ?`).join("\n")}` : "Toutes les infos sont présentes — génère directement la page de garde."}

Suis les instructions du skills file (page-de-garde-skills.md) pour choisir PATH A (template) ou PATH B (pas de template).
Enregistre dans page-de-garde.md.`;
      }

      case "dedicaces": {
        const dedicacesExtra = opts?.extraContext
          ? `\n\nDemande spécifique de l'étudiant(e) — respecte-la impérativement, préserve chaque nom mentionné :\n"""\n${opts.extraContext}\n"""`
          : "";
        return `${docNote}Lis profile.json.${dedicacesExtra}
IMPORTANT : Ne lis PAS dedicaces.md s'il existe — génère un texte entièrement nouveau from scratch.
Rédige les Dédicaces (8–20 lignes, style lyrique et sobre).
Utilise Write pour écrire dedicaces.md (écrase tout contenu précédent).`;
      }

      case "remerciements": {
        const remExtra = opts?.extraContext
          ? `\n\nDemande spécifique de l'étudiant(e) — intègre TOUS les noms et éléments mentionnés :\n"""\n${opts.extraContext}\n"""`
          : "";
        return `${docNote}Lis profile.json pour les noms et titres des encadrants.${remExtra}
IMPORTANT : Ne lis PAS remerciements.md s'il existe — génère un texte entièrement nouveau from scratch.
Rédige les Remerciements (200–350 mots, ton formel et sincère).
Respecte l'ordre : encadrant pédagogique → encadrant professionnel → école → famille → amis si mentionnés.
Varie les formules d'ouverture de chaque paragraphe.
Utilise Write pour écrire remerciements.md (écrase tout contenu précédent).`;
      }

      case "abbreviations":
        return `${docNote}Lis toutes les sections .md existantes (introduction.md, partie-i.md, partie-ii.md, conclusion.md, resume.md).
Identifie TOUTES les abréviations, sigles et acronymes utilisés dans le rapport.
Génère un tableau JSON UNIQUEMENT (sans texte avant/après) avec ce format exact :
[{"abbr":"OPCVM","sig":"Organisme de Placement Collectif en Valeurs Mobilières"},...]
Chaque abréviation doit avoir "abbr" (le sigle) et "sig" (la signification complète en français).
Inclus minimum 10 abréviations. Ne génère AUCUN texte en dehors du JSON.
Enregistre dans abbreviations.md.`;

      default:
        return `${docNote}Rédige la section "${section}" du rapport.${opts?.extraContext ? `\n\nContexte supplémentaire : ${opts.extraContext}` : ""}\nEnregistre dans ${section}.md.`;
    }
  }

  // Build a surgical revision task
  buildRevisionTask(sectionId: string, instruction: string): string {
    return `Lis ${sectionId}.md.
L'étudiant demande : ${instruction}

Applique des modifications chirurgicales uniquement — ne réécris pas toute la section.
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

  return `Tu es l'agent de rédaction académique de RapportAI — une instance Claude Code dédiée au rapport de ${p.studentName} à ${schoolFull}.

## Ton environnement
Tu travailles dans un dossier dédié à ce rapport. Utilise Glob pour lister tous les fichiers disponibles au démarrage. Les fichiers possibles :
- \`INSTRUCTIONS.md\` — directives détaillées du rapport — LIS EN PREMIER
- \`profile.json\` — profil complet de l'étudiant — LIS EN DEUXIÈME
- \`*.md\` — sections déjà rédigées (partie-i.md, conclusion.md, etc.) — lis avant d'écrire
- Documents uploadés — PDFs, Word, TXT fournis par l'étudiant
- \`template-screenshot.png\` — capture visuelle du modèle Word de l'école
- Fichier \`.docx\` — contenu textuel du template de l'école

## Étapes obligatoires avant toute rédaction
1. Glob pour lister tous les fichiers du dossier
2. Lire \`INSTRUCTIONS.md\`
3. Lire \`profile.json\`
4. Lire toutes les sections \`.md\` existantes pour cohérence et références croisées
5. Si un template ou screenshot existe, le lire pour respecter la mise en page

## Règles absolues
- Français académique formel — registre soutenu uniquement
- Citations RÉELLES uniquement — utilise WebFetch sur Semantic Scholar, CrossRef, ou Google Scholar pour trouver des sources existantes. JAMAIS inventer une citation
- Structure Markdown obligatoire : \`##\` pour les chapitres, \`###\` pour les sections
- Minimum 2500 mots pour Partie I et Partie II
- Références croisées entre sections obligatoires — cite ce qui a été écrit dans les autres parties
- Style de citation : ${style}
- Enregistre chaque section terminée avec Write dans son fichier \`.md\`
- Utilise Edit pour les modifications chirurgicales — ne réécris jamais une section entière pour un petit changement

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
${p.juryMember3 ? `- Membre du jury 3 : ${p.juryMember3}` : ""}

## Interdictions absolues
- Ne jamais inventer des citations, auteurs, titres, DOI, ou dates de publication
- Ne jamais rédiger une section sans avoir lu les sections existantes
- Ne jamais ignorer le template ou le canevas de l'école si fourni
- Ne jamais dépasser le scope de la section demandée
- Après avoir écrit le fichier avec Write, ne génère AUCUN texte de confirmation, résumé ou commentaire. Ton travail est terminé — arrête-toi immédiatement.
- Pour les sections courtes (dédicaces, remerciements, résumé), utilise Write UNE SEULE FOIS avec le contenu complet. N'appelle jamais Write deux fois sur le même fichier.${canevasNote}`;
}

// ─── Instructions file written to disk ───────────────────────────────────────

function buildInstructions(p: ReportProfile): string {
  return `# RapportAI — Instructions pour ${p.studentName}

## Rapport
- Type : ${p.reportType}
- Thème : ${p.theme}
- École : ${p.school} — ${p.filiere}
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
`;
}
