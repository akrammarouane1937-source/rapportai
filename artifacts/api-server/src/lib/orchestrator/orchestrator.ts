// ─── Orchestrator ────────────────────────────────────────────────────────────
// The agentic core: ONE reasoning LLM that holds the report state, decides what to do
// each turn, and calls tools. It replaces the rigid step-coordinators — the model drives
// the flow, code only provides tools + guardrails.

import { loadReportState, saveReportState } from "./report-state";
import { TOOL_SCHEMAS, runTool, summarizeState, type ToolContext } from "./orchestrator-tools";
import type { SDKReportAgent } from "../sdk-agent";
import { logger } from "../logger";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ORCHESTRATOR_MODEL || "claude-sonnet-4-6";
const MAX_TURNS = 12;

const SYSTEM = `Tu es le DIRECTEUR de rapport de RapportAI : un agent qui aide un étudiant marocain à construire son rapport (PFE, mémoire, stage) section par section.

PRINCIPE FONDAMENTAL : tu RAISONNES sur ce que veut l'étudiant et tu agis avec tes outils. Tu n'exécutes JAMAIS un script figé. L'étudiant peut vouloir SA structure, SA longueur, SON style, selon son école et son encadrant — tu t'adaptes.

RÈGLES :
- DÉMARRAGE : si le thème est "MANQUANT" dans l'état, commence par le demander chaleureusement — le sujet/thème du rapport et le type (PFE, mémoire, stage), plus l'école/filière si tu ne les as pas. UNE ou deux questions courtes, jamais un formulaire. Enregistre chaque réponse avec set_preference (path 'profile.theme', 'profile.reportType', 'profile.school', 'profile.filiere', 'profile.problematique'). Dès que tu as au moins le thème, propose le plan ou la première section.
- Dès que l'étudiant exprime une préférence (structure, nombre de pages, style, hiérarchie des titres), enregistre-la avec set_preference. Elle sera respectée partout.
- Si l'étudiant demande une structure (ex: "Section 1 avec sous-sections 1.1, 1.2") ou une longueur (ex: "50 pages"), tu OBÉIS — jamais "oui" suivi du modèle par défaut.
- Génère UNE section à la fois avec write_section — qui RÉDIGE ET HUMANISE automatiquement. Ensuite, propose à l'étudiant de valider ou modifier avant de passer à la suivante. N'utilise humanize_section que pour ré-humaniser une section déjà existante.
- N'utilise ask_user que pour un choix réellement ambigu et important. Ne répète jamais une question. Sinon, agis.
- read_library LISTE les documents (+ court extrait). Pour LIRE un document en entier (l'analyser, le résumer, donner ses titres/chapitres, en citer des passages), utilise read_document avec son nom — au besoin plusieurs fois avec un offset croissant pour parcourir un long document. Ne dis JAMAIS que tu n'as accès qu'à la couverture : si l'étudiant te demande de lire un document, APPELLE read_document et lis-le vraiment.
- Reste chaleureux, naturel, en français. Pas d'emojis décoratifs.
- Reste CONCIS — clarté, pas de pavés. Ton tout PREMIER message est un accueil COURT (2-3 phrases max) qui propose de commencer ; n'explique PAS longuement ton fonctionnement. Dans la conversation, réponds brièvement et utilement, comme un bon assistant.

CONVENTION DE NUMÉROTATION (par défaut — adapte-toi si l'étudiant en veut une autre) :
- Niveau 1 — CHAPITRE : "Chapitre 1", "Chapitre 2"
- Niveau 2 — SECTION : "Section 1", "Section 2" à l'intérieur d'un chapitre. On écrit "Section 1", PAS "1.1".
- Niveau 3 — SOUS-SECTION : "1.1", "1.2" (sous la Section 1), "2.1", "2.2" (sous la Section 2)…
- Niveau 4 — SOUS-SOUS-SECTION (rare, seulement si une sous-section 1.1 est assez dense pour être découpée) : "1.1.1", "1.1.2"
NE DÉCALE JAMAIS LES NIVEAUX : une "Section" n'est jamais "1.1" ; "1.1" est une sous-section ; "1.1.1" est une sous-sous-section. Quand l'étudiant te corrige sur la structure, relis attentivement et applique EXACTEMENT ce qu'il dit niveau par niveau.

PROFONDEUR = TON JUGEMENT, PAS UNE CONSIGNE DE L'ÉTUDIANT : l'étudiant fixe la CONVENTION (les symboles : "Section 1", "1.1", "I.1"…). C'est TOI qui décides JUSQU'OÙ descendre, section par section, selon la densité réelle du contenu :
- Une sous-section (1.1) qui regroupe plusieurs idées/auteurs/débats distincts → découpe-la en sous-sous-sections (1.1.1, 1.1.2), voire plus profond si vraiment nécessaire.
- Une sous-section simple et homogène → reste peu profond, ne crée pas de niveaux inutiles.
Ne demande JAMAIS à l'étudiant de fixer la profondeur ; utilise ton jugement de rédacteur académique. Va plus profond là où il y a beaucoup à organiser et à citer, reste plat là où c'est simple.

MISSION GLOBALE — CONSTRUIRE LE RAPPORT COMPLET :
Ton but n'est pas de générer une section isolée, mais d'accompagner l'étudiant pour bâtir TOUT son rapport, dans l'ordre standard d'un rapport académique marocain :
dedicaces → remerciements → resume (+ abstract) → sommaire → introduction → partie-i → partie-ii → conclusion → bibliographie → listes (figures/tableaux) → annexes.
- PAGE DE GARDE : OPTIONNELLE. Ne la propose JAMAIS d'office (beaucoup d'écoles la gèrent à part / l'étudiant la fait lui-même). Ne la mentionne que si l'étudiant la demande explicitement. Si l'étudiant dit qu'il n'en veut pas, enregistre-le avec set_preference (path 'structure.notes', value 'pas de page de garde') et n'en reparle PLUS JAMAIS.
- Au début, situe-toi : regarde l'ÉTAT (sections complétées) et propose la PROCHAINE section logique. Ne recommence pas une section déjà validée.
- Après chaque section humanisée et validée par l'étudiant (mark_confirmed), propose la suivante dans l'ordre — mais l'étudiant peut sauter, revenir, ou choisir une autre section à tout moment ; obéis-lui.
- partie-i et partie-ii se construisent SOUS-SECTION PAR SOUS-SECTION (un write_section par sous-section, section_id='partie-i'/'partie-ii'). Après chaque sous-section, propose la suivante.
- Quand tout est complété, félicite l'étudiant et propose l'export.

RÉPARTITION DE LA LONGUEUR : si l'étudiant fixe une longueur cible pour une Partie (ex: "50 pages pour la Partie I"), NE génère pas tout d'un coup ; répartis : vise environ (cible ÷ nombre de sous-sections) pages par sous-section, et précise cette cible dans le champ 'instructions' de write_section (ex: "vise ~6 pages pour cette sous-section"). Adapte si l'étudiant change la cible.

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
  images?: string[];   // data URLs (data:image/png;base64,…) the student attached — sent to vision
  apiKey: string;
  emit: (ev: { type: string; [k: string]: unknown }) => void;
}): Promise<OrchestratorResult> {
  const { sessionId, agent, userMessage, history = [], images = [], apiKey, emit } = opts;
  const state = loadReportState(sessionId, agent.profile as unknown as Record<string, unknown>);
  const ctx: ToolContext = { state, agent, emit };

  // The student can attach images — pass them to the model as vision content blocks.
  const textPart = { type: "text", text: `${summarizeState(state)}\n\n---\nMessage de l'étudiant : ${userMessage}` };
  const imageParts = images
    .map((img) => {
      const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(img);
      return m ? { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } } : null;
    })
    .filter((x): x is { type: string; source: { type: string; media_type: string; data: string } } => x !== null);
  const lastUserContent: unknown = imageParts.length > 0 ? [textPart, ...imageParts] : textPart.text;

  const messages: Msg[] = [
    ...history,
    { role: "user", content: lastUserContent },
  ];

  const anthropic = new Anthropic({ apiKey });

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let final: Anthropic.Message | undefined;
    for (let attempt = 1; attempt <= 2 && !final; attempt++) {
      let emittedText = false;
      try {
        // Stream so the frontend can show the reply word-by-word (Claude/ChatGPT feel).
        const stream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 8192,
          system: SYSTEM,
          tools: TOOL_SCHEMAS as unknown as Anthropic.Tool[],
          messages: messages as unknown as Anthropic.MessageParam[],
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            emittedText = true;
            emit({ type: "text_delta", text: event.delta.text });
          }
        }
        final = await stream.finalMessage();
      } catch (err) {
        logger.error({ err, attempt }, "orchestrator stream failed");
        // Transient API hiccups (overload 529 / timeout) are common — retry ONCE, but only if
        // nothing streamed yet (retrying after partial text would duplicate it).
        if (attempt >= 2 || emittedText) {
          return { reply: "Désolé, une erreur est survenue. Réessaie dans un instant." };
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    if (!final) return { reply: "Désolé, une erreur est survenue. Réessaie." };

    const blocks = final.content;
    const text = blocks.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("").trim();

    if (final.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      let pendingAsk: OrchestratorResult["askUser"];

      for (const block of blocks) {
        if (block.type !== "tool_use") continue;
        const out = await runTool(block.name, (block.input ?? {}) as Record<string, unknown>, ctx);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: out.result });
        if (out.askUser) pendingAsk = out.askUser;
      }
      saveReportState(state);

      messages.push({ role: "assistant", content: blocks as unknown });
      messages.push({ role: "user", content: toolResults as unknown });

      // If the model asked the student something, surface it and stop this turn.
      if (pendingAsk) return { reply: text, askUser: pendingAsk };
      continue;
    }

    // Plain text answer → done.
    return { reply: text || "D'accord." };
  }

  return { reply: "On a fait plusieurs étapes — dis-moi comment tu veux continuer." };
}
