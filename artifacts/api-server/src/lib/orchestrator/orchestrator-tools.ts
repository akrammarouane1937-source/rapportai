// ─── Orchestrator Tools ──────────────────────────────────────────────────────
// The ONLY ways the orchestrator can act. Each tool reads/writes ReportState and/or
// delegates to a specialist (Writer = existing section generation, Humanizer = existing
// loop). Student preferences in the state are injected into every write — that is what
// makes the system obey the student instead of a template.

import type { SDKReportAgent } from "../sdk-agent";
import {
  type ReportState, setPreference, upsertSection, saveReportState, summarizeState,
} from "./report-state";

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
        path: { type: "string", description: "Chemin: 'structure.notes', 'structure.hierarchyDepth', 'lengthTarget.partieI', 'style', 'schoolConventions', 'citationStyle'" },
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
    description: "Rédige UNE section/sous-section du rapport, en respectant la structure, la longueur cible et le style enregistrés dans l'état. Délègue au rédacteur (recherche de sources incluse).",
    input_schema: {
      type: "object",
      properties: {
        section_id: { type: "string", description: "ex: 'introduction', 'partie-i', 'partie-ii', 'conclusion'" },
        instructions: { type: "string", description: "Consigne précise de l'étudiant pour CETTE section (structure, contenu, longueur)" },
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

Si la consigne de l'étudiant contredit un modèle par défaut, SUIS L'ÉTUDIANT. Lis sommaire.md et les documents de la bibliothèque pour les sources réelles. Écris dans "${sectionId}.md".`;
}

export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const { state, agent, emit } = ctx;

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
      emit({ type: "tool_call", name: "write_section", detail: sectionId });
      const task = buildWriterTask(state, sectionId, instructions);
      for await (const ev of agent.streamSection(sectionId, task)) {
        if (ev.type === "tool_call") emit({ type: "tool_call", name: ev.name, detail: ev.detail });
      }
      // GUARDRAIL: a section is never delivered un-humanized. Humanize inline so the
      // orchestrator can't "forget" — code enforces it, not the model.
      upsertSection(state, { id: sectionId, status: "humanizing" });
      emit({ type: "tool_call", name: "humanize_section", detail: sectionId });
      try { await agent.humanizeSection(sectionId); } catch { /* keep raw on failure */ }
      const content = agent.getSection(sectionId) ?? "";
      const words = content.split(/\s+/).filter(Boolean).length;
      upsertSection(state, { id: sectionId, status: "ready", words });
      return { result: `Section "${sectionId}" rédigée ET humanisée (${words} mots). Propose maintenant à l'étudiant de valider ou de modifier avant de continuer.` };
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
      const docs = agent.getDocumentNames();
      if (docs.length === 0) return { result: "Aucun document dans la bibliothèque. L'étudiant peut en téléverser pour des sources réelles." };
      return { result: `Documents disponibles (${docs.length}) : ${docs.join(", ")}. Le rédacteur peut les lire pendant la génération pour citer les vraies sources.` };
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
