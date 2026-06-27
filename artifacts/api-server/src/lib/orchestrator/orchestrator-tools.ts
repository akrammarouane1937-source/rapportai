// ─── Orchestrator Tools ──────────────────────────────────────────────────────
// The ONLY ways the orchestrator can act. Each tool reads/writes ReportState and/or
// delegates to a specialist (Writer = existing section generation, Humanizer = existing
// loop). Student preferences in the state are injected into every write — that is what
// makes the system obey the student instead of a template.

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import path from "path";
import type { SDKReportAgent } from "../sdk-agent";
import { logger } from "../logger";
import {
  type ReportState, setPreference, upsertSection, saveReportState, summarizeState,
} from "./report-state";

// Parts are built sub-section by sub-section, each appended to the canonical file
// (partie-i.md / partie-ii.md) so the preview + Word export pick them up.
const PARTIE_SECTIONS = new Set(["partie-i", "partie-ii"]);

export interface ToolContext {
  state: ReportState;
  agent: SDKReportAgent;
  emit: (ev: { type: string; [k: string]: unknown }) => void;  // stream progress to the client
}

export interface ToolResult {
  result: string;                                   // text fed back to the orchestrator
  askUser?: { question: string; choices?: string[] };  // set only by ask_user
}

// Anthropic tool-use schemas (sent to the orchestrator model).
export const TOOL_SCHEMAS = [
  {
    name: "set_preference",
    description: "Enregistre une préférence de l'étudiant (structure, longueur, style, école) dans l'état du rapport. À utiliser dès que l'étudiant exprime une préférence, pour qu'elle soit respectée partout ensuite.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Chemin. Préférences: 'structure.notes', 'structure.hierarchyDepth', 'lengthTarget.partieI', 'style', 'schoolConventions', 'citationStyle'. Profil étudiant: 'profile.theme', 'profile.reportType', 'profile.school', 'profile.filiere', 'profile.problematique'." },
        value: { description: "La valeur (string ou number)" },
      },
      required: ["path", "value"],
    },
  },
  {
    name: "update_plan",
    description: "Écrit ou met à jour le plan (sommaire) du rapport selon la structure voulue par l'étudiant. Passe le markdown complet du sommaire.",
    input_schema: {
      type: "object",
      properties: { sommaire_markdown: { type: "string" } },
      required: ["sommaire_markdown"],
    },
  },
  {
    name: "write_section",
    description: "Rédige du contenu en respectant la structure/longueur/style de l'état, puis l'humanise. section_id DOIT être un identifiant CANONIQUE (jamais inventé) : 'page-de-garde', 'dedicaces', 'remerciements', 'resume', 'sommaire', 'introduction', 'partie-i', 'partie-ii', 'conclusion'. Pour la Partie I/II, on construit SOUS-SECTION PAR SOUS-SECTION : appelle write_section avec section_id='partie-i' (ou 'partie-ii') et décris la sous-section précise dans 'instructions' (ex: 'Chapitre 1, Section 1 avec sous-sections 1.1 et 1.2') ; chaque appel AJOUTE la sous-section humanisée à la Partie. N'invente JAMAIS d'id comme 'chapitre-1-section-1'.",
    input_schema: {
      type: "object",
      properties: {
        section_id: { type: "string", description: "Id canonique uniquement (voir description). Pour Partie I/II → 'partie-i' / 'partie-ii'." },
        instructions: { type: "string", description: "Consigne précise pour CE morceau (quelle sous-section, structure, longueur, contenu)" },
      },
      required: ["section_id", "instructions"],
    },
  },
  {
    name: "humanize_section",
    description: "Passe une section déjà rédigée dans l'humaniseur (anti-détection IA + anti-plagiat).",
    input_schema: {
      type: "object",
      properties: { section_id: { type: "string" } },
      required: ["section_id"],
    },
  },
  {
    name: "read_library",
    description: "Liste les documents de la bibliothèque + un court extrait de chacun. Pour LIRE le contenu COMPLET d'un document précis (l'analyser, le résumer, en citer des passages), utilise read_document.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "read_document",
    description: "Lit le CONTENU COMPLET (ou un large extrait paginé) d'UN document de la bibliothèque, par son nom (vu via read_library). Utilise-le dès que l'étudiant veut que tu lises, analyses, résumes ou cites un document — ne dis JAMAIS que tu n'as accès qu'à la couverture, lis-le vraiment avec cet outil. Retourne jusqu'à ~40 000 caractères ; pour la suite d'un long document, rappelle-le avec un offset plus grand.",
    input_schema: {
      type: "object",
      properties: {
        filename: { type: "string", description: "Nom exact du document (ex: 'Thesis_Zhang2014.pdf')" },
        offset: { type: "number", description: "optionnel — caractère de départ pour lire la suite (défaut 0)" },
      },
      required: ["filename"],
    },
  },
  {
    name: "ask_user",
    description: "Pose UNE question à l'étudiant — UNIQUEMENT pour un choix réellement ambigu et important. N'abuse jamais de cet outil ; ne répète jamais la même question.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string" },
        choices: { type: "array", items: { type: "string" }, description: "optionnel — propositions cliquables" },
      },
      required: ["question"],
    },
  },
  {
    name: "mark_confirmed",
    description: "Marque une section comme validée par l'étudiant.",
    input_schema: {
      type: "object",
      properties: { section_id: { type: "string" } },
      required: ["section_id"],
    },
  },
];

// Build the writer task from the state — preferences are PRIORITY 1 over any template.
function buildWriterTask(state: ReportState, sectionId: string, instructions: string): string {
  const p = state.preferences;
  return `Rédige la section "${sectionId}" du rapport.

CONSIGNE DE L'ÉTUDIANT (PRIORITÉ ABSOLUE — passe avant tout modèle par défaut) :
${instructions || "(suis le plan et les préférences ci-dessous)"}

PRÉFÉRENCES ENREGISTRÉES (à respecter) :
- Structure : profondeur ${p.structure.hierarchyDepth} niveaux, numérotation "${p.structure.numbering}"${p.structure.notes ? `, ${p.structure.notes}` : ""}
- Longueur cible : ${p.lengthTarget[sectionId] ?? p.lengthTarget.global ?? "selon la profondeur que le sujet exige"}
- Style : ${p.style || "académique"}
- École/convention : ${p.schoolConventions || "standard PFE marocain"}
- Citations : ${p.citationStyle}

NUMÉROTATION DES TITRES (chaque niveau est DISTINCT — ne fusionne JAMAIS deux niveaux) :
- « Chapitre 1 » (niveau chapitre) → « Section 1 », « Section 2 » (niveau section, SANS décimale) → « 1.1 », « 1.2 » (sous-sections) → « 1.1.1 » → « 1.1.1.1 » (si dense).
- INTERDIT : écrire « Section 1.1 ». C'est « Section 1 » comme titre de section (ex: « ## Section 1 : … »), puis « 1.1 » comme titre de sous-section (ex: « ### 1.1 … ») sur un niveau de titre Markdown plus profond. Respecte EXACTEMENT la convention demandée par l'étudiant niveau par niveau.

Si la consigne de l'étudiant contredit un modèle par défaut, SUIS L'ÉTUDIANT.
SOURCES (ANTI-HALLUCINATION — crucial pour un rapport remis à un jury) : lis sommaire.md, et SURTOUT lis les fichiers ".txt" (Glob "*.txt") — textes extraits des PDF/Word de la bibliothèque de l'étudiant ; cite-les en priorité (Auteur, année). Sinon, cite UNIQUEMENT des références majeures bien établies que tu connais avec CERTITUDE (Markowitz 1952, Sharpe 1964…). N'INVENTE JAMAIS une citation (auteur, année, titre, DOI) — une référence fabriquée fait sanctionner l'étudiant. Tu n'as PAS accès au web. Si une donnée/source manque, écris l'affirmation sans citation ou insère un placeholder "[DONNÉES REQUISES : …]". Écris dans "${sectionId}.md".`;
}

export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const { state, agent, emit } = ctx;

  emit({ type: "tool_call", name, detail: typeof input.section_id === "string" ? input.section_id : (typeof input.path === "string" ? input.path : "") });

  switch (name) {
    case "set_preference": {
      setPreference(state, String(input.path), input.value);
      return { result: `Préférence enregistrée : ${input.path} = ${JSON.stringify(input.value)}.` };
    }

    case "update_plan": {
      const md = String(input.sommaire_markdown ?? "");
      agent.uploadDocument("sommaire.md", md);
      state.plan = md;
      saveReportState(state);
      emit({ type: "file_written", section: "sommaire", content: md });  // → live preview updates
      return { result: "Plan (sommaire) mis à jour — visible dans l'aperçu. Demande à l'étudiant de valider." };
    }

    case "write_section": {
      const sectionId = String(input.section_id);
      const instructions = String(input.instructions ?? "");
      upsertSection(state, { id: sectionId, status: "drafting", lastInstruction: instructions });

      if (PARTIE_SECTIONS.has(sectionId)) {
        // Build the part one sub-section at a time, APPENDING the humanized result to the
        // canonical partie-i.md / partie-ii.md (so preview + Word export read it).
        const tempName = `${sectionId}.__section`;
        const tempPath = path.join(agent.workDir, `${tempName}.md`);
        const filePath = path.join(agent.workDir, `${sectionId}.md`);
        const snapshot = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
        try { if (existsSync(tempPath)) unlinkSync(tempPath); } catch { /* ignore */ }
        const subTask = buildWriterTask(state, sectionId, instructions);
        emit({ type: "tool_call", name: "write_section", detail: sectionId });
        let rawSub = "";
        try {
          rawSub = await agent.generateSectionDirect(sectionId, subTask);  // direct API — no subprocess
        } catch (err) {
          logger.error({ err: err instanceof Error ? err.stack : String(err), sectionId, where: "write_section.partie" }, "GENERATION FAILED");
          upsertSection(state, { id: sectionId, status: "pending" });
          return { result: `La rédaction de cette sous-section a échoué (souci technique passager). Le contenu déjà validé est préservé. Dis à l'étudiant que tu réessaies tout de suite, puis rappelle write_section pour la MÊME sous-section.` };
        }
        if (!rawSub.trim()) return { result: `Rien n'a été rédigé pour ${sectionId}. Réessaie.` };
        writeFileSync(tempPath, rawSub, "utf-8");  // humanizeSection reads/rewrites this file
        upsertSection(state, { id: sectionId, status: "humanizing" });
        emit({ type: "tool_call", name: "humanize_section", detail: sectionId });
        try { await agent.humanizeSection(tempName); } catch { /* keep raw */ }
        const humanizedSub = (existsSync(tempPath) ? readFileSync(tempPath, "utf-8").trim() : rawSub) || rawSub;
        const combined = snapshot.trim() ? `${snapshot.trim()}\n\n${humanizedSub}` : humanizedSub;
        writeFileSync(filePath, combined, "utf-8");
        try { unlinkSync(tempPath); } catch { /* ignore */ }
        const totalWords = combined.split(/\s+/).filter(Boolean).length;
        upsertSection(state, { id: sectionId, status: "ready", words: totalWords });
        emit({ type: "file_written", section: sectionId, content: combined });
        return { result: `Sous-section ajoutée à la ${sectionId === "partie-i" ? "Partie I" : "Partie II"} (total ${totalWords} mots), rédigée ET humanisée. Propose à l'étudiant de valider, puis enchaîne la sous-section suivante.` };
      }

      // Standalone section (introduction, conclusion, résumé…) → whole canonical file.
      emit({ type: "tool_call", name: "write_section", detail: sectionId });
      const task = buildWriterTask(state, sectionId, instructions);
      let draft = "";
      try {
        draft = await agent.generateSectionDirect(sectionId, task);  // direct API — no subprocess
      } catch (err) {
        logger.error({ err: err instanceof Error ? err.stack : String(err), sectionId, where: "write_section.standalone" }, "GENERATION FAILED");
        upsertSection(state, { id: sectionId, status: "pending" });
        return { result: `La rédaction de "${sectionId}" a échoué (souci technique passager). Dis à l'étudiant que tu réessaies tout de suite, puis rappelle write_section.` };
      }
      if (!draft.trim()) return { result: `Rien n'a été rédigé pour "${sectionId}". Réessaie.` };
      writeFileSync(path.join(agent.workDir, `${sectionId}.md`), draft, "utf-8");
      // GUARDRAIL: never deliver un-humanized — code enforces it, not the model.
      upsertSection(state, { id: sectionId, status: "humanizing" });
      emit({ type: "tool_call", name: "humanize_section", detail: sectionId });
      try { await agent.humanizeSection(sectionId); } catch { /* keep raw on failure */ }
      const content = agent.getSection(sectionId) ?? draft;
      const words = content.split(/\s+/).filter(Boolean).length;
      upsertSection(state, { id: sectionId, status: "ready", words });
      emit({ type: "file_written", section: sectionId, content });
      return { result: `Section "${sectionId}" rédigée ET humanisée (${words} mots). Propose à l'étudiant de valider ou de modifier avant de continuer.` };
    }

    case "humanize_section": {
      const sectionId = String(input.section_id);
      upsertSection(state, { id: sectionId, status: "humanizing" });
      emit({ type: "tool_call", name: "humanize_section", detail: sectionId });
      await agent.humanizeSection(sectionId);
      const content = agent.getSection(sectionId) ?? "";
      upsertSection(state, { id: sectionId, status: "ready", words: content.split(/\s+/).filter(Boolean).length });
      return { result: `Section "${sectionId}" humanisée.` };
    }

    case "read_library": {
      const all = agent.getDocumentNames();
      const realDocs = all.filter((f) => !f.endsWith(".txt"));  // .txt are the extracted copies
      if (realDocs.length === 0) return { result: "Aucun document dans la bibliothèque. L'étudiant peut en téléverser pour des sources réelles." };
      const parts: string[] = [];
      for (const doc of realDocs) {
        let excerpt = "";
        const txtPath = path.join(agent.workDir, `${doc}.txt`);
        const directPath = path.join(agent.workDir, doc);
        try {
          if (existsSync(txtPath)) excerpt = readFileSync(txtPath, "utf-8").slice(0, 2000);
          else if (existsSync(directPath) && /\.(txt|md)$/i.test(doc)) excerpt = readFileSync(directPath, "utf-8").slice(0, 2000);
        } catch { /* ignore */ }
        parts.push(`### ${doc}\n${excerpt.trim() || "(texte non extractible — l'étudiant peut le re-téléverser)"}`);
      }
      return { result: `Bibliothèque — ${realDocs.length} document(s), avec un court extrait de chacun :\n\n${parts.join("\n\n---\n\n")}\n\nPour LIRE le contenu COMPLET d'un document (l'analyser, le résumer, en citer des passages), appelle read_document avec son nom. Ne dis JAMAIS que tu n'as accès qu'à la couverture — lis-le vraiment.` };
    }

    case "read_document": {
      const filename = String(input.filename ?? "").trim();
      const offset = Math.max(0, Number(input.offset ?? 0) || 0);
      if (!filename) return { result: "Précise le nom du document (vu via read_library)." };
      const all = agent.getDocumentNames();
      const realDocs = all.filter((f) => !f.endsWith(".txt"));
      const candidates = [path.join(agent.workDir, `${filename}.txt`), path.join(agent.workDir, filename)];
      const matched = realDocs.find((f) => f === filename || f.startsWith(filename) || filename.startsWith(f));
      if (matched) candidates.unshift(path.join(agent.workDir, `${matched}.txt`), path.join(agent.workDir, matched));
      const txtPath = candidates.find((p) => existsSync(p));
      if (!txtPath) return { result: `Document "${filename}" introuvable. Disponibles : ${realDocs.join(", ") || "aucun"}.` };
      let content = "";
      try { content = readFileSync(txtPath, "utf-8"); } catch { return { result: "Lecture impossible." }; }
      const total = content.length;
      const CHUNK = 40000;
      const slice = content.slice(offset, offset + CHUNK);
      if (!slice.trim()) return { result: `"${filename}" : aucun texte extractible à partir du caractère ${offset} (total ${total}). Le PDF est peut-être scanné (image) — demande à l'étudiant de coller les passages clés.` };
      const more = offset + CHUNK < total
        ? `\n\n[...] (lu ${offset}–${offset + CHUNK} sur ${total} caractères ; rappelle read_document avec offset=${offset + CHUNK} pour la suite.)`
        : `\n\n[fin du document — ${total} caractères]`;
      return { result: `Contenu de "${filename}" :\n\n${slice}${more}` };
    }

    case "ask_user": {
      return { result: "Question posée à l'étudiant.", askUser: { question: String(input.question), choices: input.choices as string[] | undefined } };
    }

    case "mark_confirmed": {
      const sectionId = String(input.section_id);
      upsertSection(state, { id: sectionId, status: "confirmed" });
      if (!state.progress.completed.includes(sectionId)) state.progress.completed.push(sectionId);
      saveReportState(state);
      return { result: `Section "${sectionId}" validée.` };
    }

    default:
      return { result: `Outil inconnu: ${name}.` };
  }
}

export { summarizeState };
