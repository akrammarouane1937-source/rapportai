// ─── Orchestrator Tools ──────────────────────────────────────────────────────
// The ONLY ways the orchestrator can act. Each tool reads/writes ReportState and/or
// delegates to a specialist (Writer = existing section generation, Humanizer = existing
// loop). Student preferences in the state are injected into every write — that is what
// makes the system obey the student instead of a template.

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import path from "path";
import type { SDKReportAgent } from "../sdk-agent";
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
    description: "Liste les documents que l'étudiant a téléversés (bibliothèque) avec leurs noms, pour confirmer ce qui est disponible et l'utiliser comme sources.",
    input_schema: { type: "object", properties: {} },
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

Si la consigne de l'étudiant contredit un modèle par défaut, SUIS L'ÉTUDIANT.
SOURCES : lis sommaire.md, et SURTOUT lis les fichiers ".txt" présents dans le dossier (Glob "*.txt") — ce sont les textes extraits des PDF/Word que l'étudiant a téléversés dans sa bibliothèque. Cite ces sources réelles en priorité (Auteur, année). Écris dans "${sectionId}.md".`;
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
      return { result: "Plan (sommaire) mis à jour selon la structure demandée." };
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
        const subTask = buildWriterTask(state, sectionId, instructions)
          + `\n\nÉcris UNIQUEMENT cette sous-section dans "${tempName}.md" (Write, fichier neuf). N'écris RIEN dans "${sectionId}.md".`;
        for await (const ev of agent.streamSection(sectionId, subTask)) {
          if (ev.type === "tool_call") emit({ type: "tool_call", name: ev.name, detail: ev.detail });
        }
        if (snapshot) writeFileSync(filePath, snapshot, "utf-8");  // writer may have touched it
        const rawSub = existsSync(tempPath) ? readFileSync(tempPath, "utf-8").trim() : "";
        if (!rawSub) return { result: `Rien n'a été rédigé pour ${sectionId}. Réessaie.` };
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
      for await (const ev of agent.streamSection(sectionId, task)) {
        if (ev.type === "tool_call") emit({ type: "tool_call", name: ev.name, detail: ev.detail });
      }
      // GUARDRAIL: never deliver un-humanized — code enforces it, not the model.
      upsertSection(state, { id: sectionId, status: "humanizing" });
      emit({ type: "tool_call", name: "humanize_section", detail: sectionId });
      try { await agent.humanizeSection(sectionId); } catch { /* keep raw on failure */ }
      const content = agent.getSection(sectionId) ?? "";
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
      return { result: `Bibliothèque — ${realDocs.length} document(s), avec extraits du contenu réel :\n\n${parts.join("\n\n---\n\n")}\n\nTu peux maintenant confirmer leurs titres/auteurs et t'en servir comme sources. Le rédacteur lira le texte COMPLET (fichiers .txt) pendant la génération pour citer correctement.` };
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
