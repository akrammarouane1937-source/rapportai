// ─── Orchestrator ────────────────────────────────────────────────────────────
// The agentic core: ONE reasoning LLM that holds the report state, decides what to do
// each turn, and calls tools. It replaces the rigid step-coordinators — the model drives
// the flow, code only provides tools + guardrails.

import { loadReportState, saveReportState } from "./report-state";
import { TOOL_SCHEMAS, runTool, summarizeState, type ToolContext } from "./orchestrator-tools";
import type { SDKReportAgent } from "../sdk-agent";
import { logger } from "../logger";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ORCHESTRATOR_MODEL || "claude-sonnet-4-6";
const MAX_TURNS = 12;

const SYSTEM = `Tu es le DIRECTEUR de rapport de RapportAI : un agent qui aide un étudiant marocain à construire son rapport (PFE, mémoire, stage) section par section.

PRINCIPE FONDAMENTAL : tu RAISONNES sur ce que veut l'étudiant et tu agis avec tes outils. Tu n'exécutes JAMAIS un script figé. L'étudiant peut vouloir SA structure, SA longueur, SON style, selon son école et son encadrant — tu t'adaptes.

RÈGLES :
- Dès que l'étudiant exprime une préférence (structure, nombre de pages, style, hiérarchie des titres), enregistre-la avec set_preference. Elle sera respectée partout.
- Si l'étudiant demande une structure (ex: "Section 1 avec sous-sections 1.1, 1.2") ou une longueur (ex: "50 pages"), tu OBÉIS — jamais "oui" suivi du modèle par défaut.
- Génère UNE section à la fois avec write_section — qui RÉDIGE ET HUMANISE automatiquement. Ensuite, propose à l'étudiant de valider ou modifier avant de passer à la suivante. N'utilise humanize_section que pour ré-humaniser une section déjà existante.
- N'utilise ask_user que pour un choix réellement ambigu et important. Ne répète jamais une question. Sinon, agis.
- Consulte read_library quand l'étudiant parle de ses documents/sources.
- Reste chaleureux, naturel, en français. Pas d'emojis décoratifs.

CONVENTION DE NUMÉROTATION (par défaut — adapte-toi si l'étudiant en veut une autre) :
- Niveau 1 — CHAPITRE : "Chapitre 1", "Chapitre 2"
- Niveau 2 — SECTION : "Section 1", "Section 2" à l'intérieur d'un chapitre. On écrit "Section 1", PAS "1.1".
- Niveau 3 — SOUS-SECTION : "1.1", "1.2" (sous la Section 1), "2.1", "2.2" (sous la Section 2)…
- Niveau 4 — SOUS-SOUS-SECTION (rare, seulement si une sous-section 1.1 est assez dense pour être découpée) : "1.1.1", "1.1.2"
NE DÉCALE JAMAIS LES NIVEAUX : une "Section" n'est jamais "1.1" ; "1.1" est une sous-section ; "1.1.1" est une sous-sous-section. Quand l'étudiant te corrige sur la structure, relis attentivement et applique EXACTEMENT ce qu'il dit niveau par niveau.

Tu reçois à chaque tour l'ÉTAT DU RAPPORT (préférences, sections, sources). Sers-t'en pour savoir où tu en es.`;

export interface OrchestratorResult {
  reply: string;
  askUser?: { question: string; choices?: string[] };
}

type Msg = { role: "user" | "assistant"; content: unknown };

export async function runOrchestrator(opts: {
  sessionId: string;
  agent: SDKReportAgent;
  userMessage: string;
  history?: Msg[];
  apiKey: string;
  emit: (ev: { type: string; [k: string]: unknown }) => void;
}): Promise<OrchestratorResult> {
  const { sessionId, agent, userMessage, history = [], apiKey, emit } = opts;
  const state = loadReportState(sessionId, agent.profile as unknown as Record<string, unknown>);
  const ctx: ToolContext = { state, agent, emit };

  const messages: Msg[] = [
    ...history,
    { role: "user", content: `${summarizeState(state)}\n\n---\nMessage de l'étudiant : ${userMessage}` },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let data: {
      stop_reason?: string;
      content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
    };
    try {
      const resp = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: { "anthropic-version": "2023-06-01", "x-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: 4096, system: SYSTEM, tools: TOOL_SCHEMAS, messages }),
      });
      if (!resp.ok) {
        logger.error({ status: resp.status, body: await resp.text().catch(() => "") }, "orchestrator API error");
        return { reply: "Désolé, une erreur est survenue. Réessaie dans un instant." };
      }
      data = await resp.json();
    } catch (err) {
      logger.error({ err }, "orchestrator fetch failed");
      return { reply: "Désolé, une erreur réseau est survenue. Réessaie." };
    }

    const blocks = data.content ?? [];
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("").trim();

    if (data.stop_reason === "tool_use") {
      const toolUses = blocks.filter((b) => b.type === "tool_use");
      const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];
      let pendingAsk: OrchestratorResult["askUser"];

      for (const tu of toolUses) {
        const out = await runTool(tu.name!, tu.input ?? {}, ctx);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id!, content: out.result });
        if (out.askUser) pendingAsk = out.askUser;
      }
      saveReportState(state);

      messages.push({ role: "assistant", content: blocks });
      messages.push({ role: "user", content: toolResults });

      // If the model asked the student something, surface it and stop this turn.
      if (pendingAsk) return { reply: text, askUser: pendingAsk };
      continue;
    }

    // Plain text answer → done.
    return { reply: text || "D'accord." };
  }

  return { reply: "On a fait plusieurs étapes — dis-moi comment tu veux continuer." };
}
