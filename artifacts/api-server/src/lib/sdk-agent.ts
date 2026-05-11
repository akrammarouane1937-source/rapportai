import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "fs";
import path from "path";
import type { StreamEvent } from "./agent-session";
import { findClaudeBinary } from "./find-claude-binary";

// Per-user working directory — each session gets isolated storage
const SESSIONS_ROOT = "/tmp/rapportai-sessions";

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
}

const SECTION_IDS = [
  "dedicaces",
  "remerciements",
  "resume",
  "introduction",
  "partie-i",
  "partie-ii",
  "conclusion",
];

// ─── SDKReportAgent ───────────────────────────────────────────────────────────

export class SDKReportAgent {
  readonly id: string;
  readonly profile: ReportProfile;
  readonly createdAt: Date;
  lastActiveAt: Date;
  private workDir: string;
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

  // Load existing sections from previous sessions into working directory
  loadSections(sections: Record<string, string>): void {
    for (const [id, content] of Object.entries(sections)) {
      if (content) {
        writeFileSync(path.join(this.workDir, `${id}.md`), content);
      }
    }
  }

  // Upload a document so Claude can read it with the Read tool
  uploadDocument(filename: string, text: string): void {
    writeFileSync(path.join(this.workDir, filename), text);
  }

  getDocumentNames(): string[] {
    const { readdirSync } = require("fs") as typeof import("fs");
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

  // Stream a task — yields StreamEvents compatible with existing SSE routes
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
        systemPrompt: buildSystemPrompt(this.profile),
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
          yield { type: "tool_call", name: block.name };
        }
      }
    }
    // result message signals completion — no event needed, loop ends naturally
  }

  abort(): void {
    this.abortController.abort();
  }

  // Build the task prompt for a report section
  buildSectionTask(section: string): string {
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
      case "partie-i":
        return `${docNote}
Lis d'abord INSTRUCTIONS.md et profile.json.
Lis les sections déjà rédigées (introduction.md, resume.md si présents).
Utilise WebFetch sur https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(p.theme)}&limit=8&fields=title,authors,year,externalIds,abstract pour trouver des sources réelles.

Rédige la Partie I du ${p.reportType} "${p.theme}" (${p.school} — ${p.filiere}, ${p.annee ?? "2024–2025"}).

## Chapitre 1 — Cadre théorique et revue de littérature
### 1.1 Fondements théoriques
### 1.2 Revue de la littérature internationale et nationale
### 1.3 Contexte marocain et spécificités locales
### 1.4 Positionnement théorique de l'étude

## Chapitre 2 — Méthodologie de recherche
### 2.1 Approche et design de recherche
### 2.2 Collecte et traitement des données
### 2.3 Modèles et outils d'analyse
### 2.4 Validité et fiabilité de la démarche

Problématique : ${prob}
Style : ${style}. Minimum 2500 mots. Citations réelles uniquement.
Enregistre avec Write dans partie-i.md une fois terminé.`;

      case "partie-ii":
        return `${docNote}
Lis INSTRUCTIONS.md, profile.json, et partie-i.md (obligatoire — références croisées requises).

Rédige la Partie II du ${p.reportType} "${p.theme}" (${p.school} — ${p.filiere}).

## Chapitre 3 — Présentation et analyse des résultats
### 3.1 Statistiques descriptives et présentation de l'échantillon
### 3.2 Résultats de l'analyse principale
### 3.3 Interprétation et validation des hypothèses
### 3.4 Synthèse des findings empiriques

## Chapitre 4 — Discussion, limites et recommandations
### 4.1 Discussion au regard de la littérature
### 4.2 Implications théoriques et académiques
### 4.3 Implications pratiques et managériales
### 4.4 Limites et voies de recherche futures

Problématique : ${prob}
Style : ${style}. Minimum 2500 mots. Références croisées vers Partie I obligatoires.
Enregistre avec Write dans partie-ii.md.`;

      case "introduction":
        return `Lis INSTRUCTIONS.md, profile.json, et toutes les sections .md existantes.
Rédige l'Introduction Générale (400–600 mots) du ${p.reportType} "${p.theme}".
Structure : Contexte → Problématique → Objectifs → Structure du rapport.
Problématique : ${prob}
Enregistre dans introduction.md.`;

      case "conclusion":
        return `Lis introduction.md, partie-i.md, partie-ii.md (obligatoire).
Rédige la Conclusion Générale (400–600 mots).
Structure : Synthèse → Apports → Limites → Perspectives.
Références directes vers les deux parties.
Enregistre dans conclusion.md.`;

      case "resume":
        return `Lis introduction.md si présent.
Rédige le Résumé (250–300 mots) : Contexte → Objectifs → Méthodologie → Résultats → Conclusion.
Termine par les mots-clés (5–8).
Enregistre dans resume.md.`;

      case "page-de-garde":
        return `Tu vas générer la page de garde du rapport.

1. Utilise Glob pour lister tous les fichiers du dossier
2. Si template-screenshot.png existe, lis-le avec Read pour voir visuellement la mise en page (couleurs, bordures, logo position, typographie)
3. Si un fichier .docx existe, lis-le avec Read pour extraire la structure textuelle exacte (placeholders, labels)
4. Lis profile.json pour les informations de l'étudiant

Génère ensuite page-de-garde.md avec le contenu exact de la page de garde en respectant :
- La structure visuelle du template (couleurs, titres, disposition)
- Les informations réelles de l'étudiant (nom, école, thème, encadrants, entreprise, année)
- Les placeholders du template remplacés par les vraies données
- Format Markdown fidèle à la mise en page Word

Enregistre dans page-de-garde.md.`;

      case "dedicaces":
        return `Rédige les Dédicaces (10–15 lignes, style poétique sobre).
Enregistre dans dedicaces.md.`;

      case "remerciements":
        return `Lis profile.json pour les noms des encadrants.
Rédige les Remerciements (150–200 mots, ton formel et sincère).
Mentionne : encadrant pédagogique, encadrant professionnel, école, famille.
Enregistre dans remerciements.md.`;

      default:
        return `Rédige la section "${section}" du rapport. Enregistre dans ${section}.md.`;
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

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(p: ReportProfile): string {
  const style = p.citationStyle ?? "APA 7th ed.";

  return `Tu es l'agent de rédaction académique de RapportAI — une instance Claude Code dédiée au rapport de ${p.studentName}.

## Ton environnement
Tu travailles dans un dossier dédié à ce rapport. Tous les fichiers sont là :
- INSTRUCTIONS.md — directives détaillées
- profile.json — profil complet de l'étudiant
- *.md — sections rédigées (partie-i.md, conclusion.md, etc.)
- Documents uploadés — PDFs, Word, TXT de l'étudiant
- template-screenshot.png — capture d'écran visuelle du modèle Word de l'école (couleurs, bordures, mise en page)
- Le fichier .docx du modèle — contenu textuel du template

## Tes outils prioritaires
- **Read** — lis toujours les sections existantes avant d'écrire. Lis aussi template-screenshot.png pour voir la mise en page visuelle du modèle, et le .docx pour son contenu textuel
- **Write** — enregistre chaque section terminée dans son fichier .md
- **Edit** — modifications chirurgicales sans réécrire toute la section
- **WebFetch** — récupère des articles académiques réels (Semantic Scholar, CrossRef, Wikipedia)
- **Glob** — liste les fichiers disponibles dans le dossier
- **Bash** — si tu as besoin de compter les mots ou vérifier quelque chose

## Règles absolues
- Français académique formel
- Citations RÉELLES via WebFetch sur Semantic Scholar — jamais inventées
- Titres Markdown ## et ### obligatoires
- Minimum 2500 mots pour Partie I et Partie II
- Toujours lire les sections existantes avant d'écrire
- Style de citation : ${style}

## Profil
- Étudiant : ${p.studentName} | École : ${p.school} | Filière : ${p.filiere}
- Type : ${p.reportType} | Thème : "${p.theme}"
${p.encadrantPeda ? `- Encadrant péda : ${p.encadrantPeda}` : ""}
${p.encadrantPro ? `- Encadrant pro : ${p.encadrantPro}` : ""}
${p.entreprise ? `- Entreprise : ${p.entreprise}` : ""}`;
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
