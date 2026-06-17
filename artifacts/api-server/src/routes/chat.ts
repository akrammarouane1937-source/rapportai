import { Router, type Request, type Response } from "express";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const router = Router();
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

interface ContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface StreamBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  inputRaw?: string;
  input?: Record<string, unknown>;
}

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

// ─── Routing maps ─────────────────────────────────────────────────────────────

const SECTION_PATHS: Record<string, string> = {
  onboarding:   "/rapport/step-1",
  pageDeGarde:  "/rapport/step-2",
  dedicaces:    "/rapport/step-3",
  resumeFr:     "/rapport/step-4",
  sommaire:     "/rapport/step-5",
  introduction: "/rapport/step-6",
  partieI:      "/rapport/partie-i",
  partieII:     "/rapport/partie-ii",
  conclusion:   "/rapport/step-9",
  rapports:     "/rapports",
  figures:      "/figures",
  export:       "/rapport/step-9",
};

const SECTION_LABELS: Record<string, string> = {
  pageDeGarde:  "Page de garde",
  dedicaces:    "Remerciements & Dédicaces",
  resumeFr:     "Résumé & Abstract",
  sommaire:     "Sommaire",
  introduction: "Introduction",
  partieI:      "Partie I : Cadre théorique",
  partieII:     "Partie II : Étude empirique",
  conclusion:   "Conclusion",
};

// Page de garde is built automatically at export (from the student's profile), not
// a chat-generated section — so it's excluded from progress count and "next step".
const SECTION_ORDER = [
  "dedicaces", "resumeFr", "sommaire",
  "introduction", "partieI", "partieII", "conclusion",
];
const SECTION_TOTAL = SECTION_ORDER.length;

// ─── Tools ────────────────────────────────────────────────────────────────────

const ORCHESTRATOR_TOOLS = [
  {
    name: "navigate_to_section",
    description: `Navigate the student to a specific report section or page.
Use immediately when the student wants to generate, edit, continue, or review a section.

CRITICAL — context_injection rules (use the summaries from your context when available):
  • For partieII: inject = "Résumé Partie I : [PASTE the Partie I summary from your context]. La Partie II doit s'ancrer dans ce cadre théorique et le valider empiriquement."
  • For conclusion: inject = "Résumé Partie I : [...]. Résumé Partie II : [...]. Problématique : [...]. La conclusion doit synthétiser ces apports et y répondre directement."
  • For introduction: inject = "Plan du sommaire : [sommaire summary]. L'intro doit poser la problématique et annoncer exactement ce plan."
  • For resumeFr: inject = "[intro + parts summaries]. Le résumé doit refléter fidèlement ces sections."
  • For rapports / figures: no context_injection needed.

If summaries aren't available yet, build context_injection from the section previews in your context.`,
    input_schema: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          description: "One of: onboarding (Step 1 — for new users after saving their theme/problématique) | pageDeGarde | dedicaces | resumeFr | sommaire | introduction | partieI | partieII | conclusion | rapports | figures | export",
        },
        context_injection: {
          type: "string",
          description: "Context string pre-loaded into the destination sub-agent. Build it from the section content you already have in context.",
        },
      },
      required: ["section"],
    },
  },

  {
    name: "read_full_section",
    description: `Read the complete text of a generated report section.
Use when the 280-character preview in your context is insufficient for:
  • Deep coherence analysis between two sections
  • Detailed feedback on writing quality or argumentation
  • Generating accurate jury questions based on actual content
  • Verifying that a section properly addresses the problématique
Call this BEFORE doing any serious analysis that requires quoting or deeply understanding a section.`,
    input_schema: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          description: "Section key: pageDeGarde | dedicaces | resumeFr | sommaire | introduction | partieI | partieII | conclusion",
        },
      },
      required: ["section"],
    },
  },

  {
    name: "read_multiple_sections",
    description: `Read the complete text of 2 or more sections at once.
Use for cross-section analysis: coherence check between introduction and conclusion, comparing Partie I and Partie II, verifying sommaire matches actual content.
More efficient than calling read_full_section multiple times.`,
    input_schema: {
      type: "object" as const,
      properties: {
        sections: {
          type: "array",
          items: { type: "string" },
          description: "Array of section keys to read: e.g. [\"partieI\", \"partieII\"] or [\"introduction\", \"conclusion\"]",
        },
      },
      required: ["sections"],
    },
  },

  {
    name: "get_report_stats",
    description: `Get precise statistics about the student's current report.
Returns: word count per section, total words, estimated page count, completion percentage, section balance analysis (are Partie I and Partie II proportional?), estimated reading time.
Use when the student asks about progress, word count, page count, or section balance.`,
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },

  {
    name: "analyze_coherence",
    description: `Run a structured coherence analysis across all generated sections.
Returns a diagnostic covering:
  • Does the introduction's problématique match what the parties actually address?
  • Does the conclusion synthesize both parties?
  • Does the sommaire match the actual structure of generated sections?
  • Are there contradictions between sections?
  • Which sections are missing relative to the announced plan?
This tool reads all available section content — call it directly without needing read_full_section first.`,
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },

  {
    name: "revise_section",
    description: `Revise an existing report section in-place, without navigating away from the chat.
Use when the student asks to improve, rewrite, shorten, expand, fix, or humanize an EXISTING section
("améliore ma Partie I", "rends mon introduction moins robotique", "raccourcis ma conclusion").
The revised content replaces the section in the student's report automatically.
Do NOT use for sections that haven't been generated yet — use navigate_to_section for that.
Before calling, briefly tell the student what you're about to do ("Je révise ta Partie I…").`,
    input_schema: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          description: "Section key: pageDeGarde | dedicaces | resumeFr | sommaire | introduction | partieI | partieII | conclusion",
        },
        instructions: {
          type: "string",
          description: "Precise revision instructions in French: what to change, what to keep, target length, tone. Include the student's exact request plus your own diagnosis of what needs fixing.",
        },
      },
      required: ["section", "instructions"],
    },
  },

  {
    name: "search_references",
    description: `Search for real, citable academic papers via the Semantic Scholar database.
Use when the student asks for sources, references, bibliography entries, articles, or academic literature
("trouve-moi des sources sur X", "j'ai besoin de références pour ma Partie I").
Returns real papers with authors, year, venue, and link — never invent references yourself.
Query in English gives better results (translate the student's topic), but present results in French.`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query in English, 3-8 keywords. E.g. 'participatory islamic finance Morocco SME'",
        },
        limit: {
          type: "number",
          description: "Number of papers to return (default 5, max 10)",
        },
      },
      required: ["query"],
    },
  },

  {
    name: "save_to_profile",
    description: `Save a confirmed theme, problématique, filière or école to the student's report profile.
Use ONLY after the student explicitly confirms a value — either one they provided themselves
("mon thème c'est X", "ma problématique est Y") or one you suggested and they accepted.
Do NOT call this speculatively. Always get explicit confirmation first.
After calling this tool, send a short confirmation message and offer to continue.`,
    input_schema: {
      type: "object" as const,
      properties: {
        field: {
          type: "string",
          enum: ["theme", "problematique", "filiere", "school"],
          description: "Which profile field to save",
        },
        value: {
          type: "string",
          description: "The confirmed value to save. For problématique: a well-formed research question (25–45 words).",
        },
      },
      required: ["field", "value"],
    },
  },
];

// Server-side tools — executed by Anthropic, no handler code needed.
// web_search: live web results. web_fetch: read a specific URL.
// Both stream their results transparently; our SSE parser ignores the
// server_tool_use blocks and only forwards the final text to the client.
const SERVER_TOOLS: Array<Record<string, unknown>> = [
  { type: "web_search_20260209", name: "web_search", max_uses: 3 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 },
];

// ─── Stats builder ────────────────────────────────────────────────────────────

function buildReportStats(sections: Record<string, SectionSummary | null>): string {
  const lines: string[] = ["## Statistiques du rapport\n"];
  let totalWords = 0;
  const completed: string[] = [];

  for (const key of SECTION_ORDER) {
    const val = sections[key];
    const label = SECTION_LABELS[key] ?? key;
    if (val && val.wordCount > 50) {
      const pages = (val.wordCount / 250).toFixed(1);
      lines.push(`✅ **${label}** : ${val.wordCount.toLocaleString("fr-FR")} mots (~${pages} pages)`);
      totalWords += val.wordCount;
      completed.push(label);
    } else {
      lines.push(`⬜ **${label}** : non générée`);
    }
  }

  const totalPages = (totalWords / 250).toFixed(0);
  const readingMin = Math.ceil(totalWords / 250);
  lines.push(`\n---`);
  lines.push(`**Total :** ${totalWords.toLocaleString("fr-FR")} mots · ~${totalPages} pages · ${readingMin} min de lecture`);
  lines.push(`**Progression :** ${completed.length}/${SECTION_TOTAL} sections (${Math.round((completed.length / SECTION_TOTAL) * 100)}%)`);

  const partieIWords = sections.partieI?.wordCount ?? 0;
  const partieIIWords = sections.partieII?.wordCount ?? 0;
  if (partieIWords > 0 && partieIIWords > 0) {
    const ratio = partieIWords / partieIIWords;
    if (ratio > 1.6) {
      lines.push(`\n⚠️ **Déséquilibre** : Partie I (${partieIWords} mots) est ${(ratio).toFixed(1)}x plus longue que Partie II (${partieIIWords} mots). Considère d'approfondir la partie empirique.`);
    } else if (ratio < 0.6) {
      lines.push(`\n⚠️ **Déséquilibre** : Partie II (${partieIIWords} mots) est ${(1 / ratio).toFixed(1)}x plus longue que Partie I (${partieIWords} mots). Le cadre théorique semble sous-développé.`);
    } else {
      lines.push(`\n✅ **Équilibre correct** entre Partie I et Partie II (ratio ${ratio.toFixed(2)}).`);
    }
  }

  return lines.join("\n");
}

// ─── Coherence analyzer ───────────────────────────────────────────────────────

function buildCoherencePayload(
  sections: Record<string, SectionSummary | null>,
  problematique: string,
): string {
  const lines: string[] = ["## Données pour analyse de cohérence\n"];

  if (problematique) {
    lines.push(`**Problématique déclarée :** "${problematique}"\n`);
  }

  for (const key of SECTION_ORDER) {
    const val = sections[key];
    const label = SECTION_LABELS[key] ?? key;
    if (!val || val.wordCount < 10) {
      lines.push(`### ${label}\n[Non générée]\n`);
    } else {
      const excerpt = val.content.slice(0, 800);
      lines.push(`### ${label} (${val.wordCount} mots)\n${excerpt}${val.content.length > 800 ? "\n[…tronqué]" : ""}\n`);
    }
  }

  lines.push(`\nAnalyse maintenant :`);
  lines.push(`1. La problématique posée dans l'introduction est-elle résolue dans les parties et la conclusion ?`);
  lines.push(`2. Le sommaire correspond-il à ce qui a été généré dans les parties ?`);
  lines.push(`3. Y a-t-il des contradictions ou des répétitions entre sections ?`);
  lines.push(`4. Quelles sections sont absentes ou insuffisantes par rapport au plan annoncé ?`);
  lines.push(`5. Score de cohérence global : /10 avec justification.`);

  return lines.join("\n");
}

// ─── Reference search (Semantic Scholar) ──────────────────────────────────────

interface ScholarPaper {
  title: string;
  year: number | null;
  venue: string | null;
  url: string | null;
  abstract: string | null;
  authors: { name: string }[];
  externalIds?: { DOI?: string };
}

async function searchReferences(query: string, limit: number): Promise<string> {
  const fields = "title,authors,year,venue,abstract,url,externalIds";
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!resp.ok) {
      return `Erreur API Semantic Scholar (${resp.status}). Dis à l'étudiant que la recherche de références est momentanément indisponible et propose de réessayer dans un instant. N'invente JAMAIS de références.`;
    }

    const data = await resp.json() as { total?: number; data?: ScholarPaper[] };
    const papers = data.data ?? [];
    if (papers.length === 0) {
      return `Aucun résultat pour "${query}". Suggère à l'étudiant d'élargir la recherche (mots-clés plus génériques, sans mention du Maroc) — tu peux relancer search_references avec une requête reformulée.`;
    }

    const lines = papers.map((p, i) => {
      const authors = p.authors?.length
        ? p.authors.slice(0, 3).map((a) => a.name).join(", ") + (p.authors.length > 3 ? " et al." : "")
        : "Auteur inconnu";
      const doi = p.externalIds?.DOI ? ` · DOI: ${p.externalIds.DOI}` : "";
      const abstract = p.abstract ? `\n   Résumé : ${p.abstract.slice(0, 250)}…` : "";
      return `${i + 1}. **${authors}** (${p.year ?? "s.d."}). *${p.title}*. ${p.venue ?? ""}${doi}${p.url ? `\n   ${p.url}` : ""}${abstract}`;
    });

    return `## Résultats Semantic Scholar pour "${query}" (${papers.length} articles réels)\n\n${lines.join("\n\n")}\n\nPrésente ces références à l'étudiant en format APA 7 (ou le style de citation de son école), avec une phrase sur la pertinence de chacune pour son rapport.`;
  } catch {
    return `La recherche de références a échoué (timeout ou réseau). Informe l'étudiant et propose de réessayer. N'invente JAMAIS de références.`;
  }
}

// ─── Section revision (dedicated API call) ────────────────────────────────────

async function reviseSectionContent(
  sectionKey: string,
  currentContent: string,
  instructions: string,
  profile: { theme: string; problematique: string; filiere: string },
  apiKey: string,
): Promise<string | null> {
  const label = SECTION_LABELS[sectionKey] ?? sectionKey;
  const systemPrompt = `Tu es un rédacteur académique expert pour les rapports de PFE marocains et francophones.
Tu révises la section "${label}" d'un rapport. Thème : ${profile.theme}. ${profile.problematique ? `Problématique : ${profile.problematique}.` : ""} Filière : ${profile.filiere}.

RÈGLES :
- Retourne UNIQUEMENT le contenu révisé de la section, sans préambule ni commentaire.
- Conserve la structure markdown existante (titres, niveaux) sauf si les instructions demandent de la changer.
- Style académique français : phrases variées, vocabulaire précis, transitions naturelles.
- INTERDIT : "il est important de noter", "s'inscrire dans", "mettre en lumière", "jouer un rôle essentiel", "incontournable", "force est de constater".
- Ne réduis pas la longueur sauf si demandé explicitement.`;

  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16384,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `## Contenu actuel de la section "${label}" :\n\n${currentContent}\n\n## Instructions de révision :\n\n${instructions}\n\nRetourne la version révisée complète.`,
        }],
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json() as { content?: { type: string; text?: string }[] };
    const text = data.content?.filter((b) => b.type === "text").map((b) => b.text).join("") ?? "";
    return text.trim() || null;
  } catch {
    return null;
  }
}

// ─── System prompts ───────────────────────────────────────────────────────────
// Loaded from lib/skills/chat-system.md — edit that file to change the prompt.

const CHAT_SYSTEM_PROMPT = readFileSync(
  join(__dirname, "../src/lib/skills/chat-system.md"),
  "utf-8"
);

const chatSkillsPath = join(__dirname, "../src/lib/skills/chat-skills.md");
const CHAT_SKILLS = existsSync(chatSkillsPath) ? readFileSync(chatSkillsPath, "utf-8") : "";

/* eslint-disable @typescript-eslint/no-unused-vars */
const _LEGACY_ORCHESTRATOR_SYSTEM_INLINE = `Tu es RapportAI Orchestrateur, le coordinateur principal du système de génération de rapports académiques pour les étudiants marocains et francophones (PFE, mémoire, rapport de stage).

## TON IDENTITÉ

Tu n'es PAS un rédacteur. Tu es un coordinateur et planificateur. Tu ne génères JAMAIS de contenu de section toi-même. Tu délègues toute rédaction aux agents spécialisés et assembles leurs résultats.

## CE QUI TE REND UNIQUE

Tu es le SEUL agent qui voit le rapport dans sa globalité. Les agents spécialisés (step-2, step-3, partie-i, etc.) ne connaissent que leur section. Toi tu vois tout :
- Toutes les sections déjà générées (contenu et longueur)
- La progression globale (combien de sections restantes)
- Les incohérences cross-sections qu'aucun agent spécialisé ne peut détecter
- L'étape logique suivante selon le contexte

## LES 8 AGENTS SOUS TA COORDINATION

1. **PageDeGardeAgent**     → Page de garde (step-2)
2. **DedicacesAgent**       → Dédicaces & Remerciements (step-3)
3. **ResumeAgent**          → Résumé & Abstract (step-4)
4. **SommaireAgent**        → Sommaire (step-5)
5. **IntroductionAgent**    → Introduction (step-6)
6. **Partie1Agent**         → Partie I : Cadre théorique (partie-i)
7. **Partie2Agent**         → Partie II : Étude empirique (partie-ii)
8. **ConclusionAgent**      → Conclusion (step-9)

## ORDRE D'EXÉCUTION : RESPECTE LES DÉPENDANCES

**PHASE A : Indépendantes (peuvent être faites dans n'importe quel ordre) :**
→ PageDeGardeAgent
→ DedicacesAgent

**PHASE B : Nécessite le profil étudiant :**
→ SommaireAgent (structure du rapport)
→ ResumeAgent (titre et plan)

**PHASE C : Nécessite PHASE B :**
→ IntroductionAgent (pose la problématique et la méthodologie)

**PHASE D : Séquentielle, chaque étape lit la précédente :**
→ Partie1Agent (lit l'Introduction)
→ Partie2Agent (lit la Partie I, CRITIQUE : inject le résumé de Partie I)

**PHASE E : Nécessite toutes les parties :**
→ ConclusionAgent (lit toutes les parties, CRITIQUE : inject synthèse complète)

## PROTOCOLE DE PASSAGE DE CONTEXTE

Avant de naviguer vers chaque agent, construis un **context_injection** contenant :
- Profil étudiant (nom, école, filière, type rapport, thème)
- Résumés des sections précédentes (2-3 phrases chacun, PAS le texte complet)
- Règles de cohérence : la problématique de l'introduction doit être traitée dans toutes les parties
- Instructions spécifiques à la section (longueur, points clés, ton académique)

**Règles context_injection critiques :**
- Pour **partieII** → inject = "Résumé Partie I : [résumé]. La Partie II doit s'ancrer dans ce cadre théorique et le valider empiriquement."
- Pour **conclusion** → inject = "Résumé Partie I : [...]. Résumé Partie II : [...]. Problématique : [...]. La conclusion doit synthétiser ces apports et répondre directement à la problématique."
- Pour **introduction** → inject = "Plan du sommaire : [résumé sommaire]. L'intro doit poser la problématique et annoncer exactement ce plan."
- Pour **resumeFr** → inject = "[résumé intro + parties]. Le résumé doit refléter fidèlement ces sections."
- Pour **rapports / figures** → pas de context_injection nécessaire.

## TES 6 MISSIONS PRINCIPALES

### 1. Navigation intelligente (navigate_to_section)
Dès que l'étudiant veut travailler sur une section → appelle **navigate_to_section** immédiatement.
- "Étape suivante" ou "continuer" → trouve la première section vide et navigue
- Partie II avec Partie I existante → context_injection avec résumé de Partie I
- Conclusion → context_injection avec synthèse des parties existantes
- Introduction → context_injection avec le plan du sommaire si disponible
- Soutenance, préparation orale → génère des questions de jury basées sur le contenu réel du rapport (use read_full_section)

### 2. Analyse de cohérence (analyze_coherence)
Quand l'étudiant demande si son rapport est cohérent → appelle **analyze_coherence** directement.
Ce tool te donne un diagnostic complet : problématique vs conclusion, sommaire vs contenu, contradictions.

### 3. Diagnostic des lacunes
Quand l'étudiant demande "qu'est-ce qui manque" :
- Regarde sections vides et progression dans le contexte
- Si sommaire est généré → compare avec sections existantes pour trouver les gaps
- Donne liste prioritaire avec ordre recommandé (respecte l'ordre des phases A→E)

### 4. Analyse approfondie d'une section (read_full_section / read_multiple_sections)
**RÈGLE PROACTIVE : appelle read_full_section ou read_multiple_sections automatiquement** dès que :
- L'étudiant parle d'une section spécifique → lis-la avant de répondre
- L'étudiant demande un retour ou une amélioration → lis d'abord, commente ensuite
- L'étudiant demande si l'intro est cohérente avec la conclusion → read_multiple_sections(["introduction","conclusion"])
- Ne réponds JAMAIS sur le contenu d'une section sans l'avoir lue (280 chars = aperçu insuffisant pour un vrai feedback)
- Pour critiquer l'argumentation, détecter des répétitions, ou générer des questions jury précises → lis le contenu complet

### 5. Statistiques précises (get_report_stats)
"Combien de mots j'ai ?", "Combien de pages ?", "Mon rapport est équilibré ?" → **get_report_stats** immédiatement.

### 6. Préparation soutenance
Quand l'étudiant veut préparer sa soutenance :
- Lis d'abord les sections avec read_full_section ou read_multiple_sections
- Génère 4-6 questions difficiles que le jury posera, basées sur les VRAIS points faibles du contenu
- Anticipe les questions sur la méthodologie, les limites, les résultats empiriques
- Propose des reformulations pour les passages qui pourraient être remis en question

## VALIDATION : CE QUE TU COMMUNIQUES À L'ÉTUDIANT

Chaque section générée passe par une validation automatique (nombre de mots, structure, placeholders non remplis). Si une section échoue :
- L'agent est rappelé avec les erreurs spécifiques (max 2 tentatives)
- Informe l'étudiant : "Amélioration en cours..." sans exposer les détails techniques
- Si encore insuffisant après 2 tentatives → présente le résultat avec un avertissement

## ASSEMBLAGE FINAL

Une fois les 8 sections validées :
1. Lance **analyze_coherence** : vérifie que la conclusion répond à la problématique de l'intro
2. Présente un récapitulatif complet à l'étudiant (get_report_stats)
3. Propose une passe de révision si demandé
4. Guide vers l'export

## UPLOADS DE FICHIERS — RÉPONSE CORRECTE

Si un étudiant demande s'il peut uploader un fichier (plan, PDF, Word, données, rapport de stage…) :
- NE DIS JAMAIS que les uploads ne sont pas supportés. Ils le sont.
- L'upload de fichiers est disponible directement dans les étapes de rédaction :
  - **Partie I** : upload de PDFs académiques, framework théorique, bibliographie, articles de recherche
  - **Partie II** : upload de données, Excel, rapports d'entreprise, questionnaires, résultats de terrain
- Redirige immédiatement avec navigate_to_section si l'étudiant veut commencer par là.
- Exemple : "Oui, tu peux uploader ton plan directement dans Partie I. Je t'y amène ?"

## CAPTURE DU CONTEXTE ÉTUDIANT — MÉMOIRE ACTIVE

L'étudiant peut te parler librement de son sujet avant même de commencer la rédaction : problématique, idées de chapitres, entreprise de stage, données collectées, difficultés rencontrées, etc.

Quand il le fait :
- Écoute, confirme ce que tu as compris en 1-2 phrases ("Ok, donc ta problématique tourne autour de X — je note ça pour tes agents.")
- Mémorise TOUT pour le passer dans context_injection des agents concernés
- Pour le **SommaireAgent** : si l'étudiant a partagé une problématique, des idées de chapitres, ou un angle théorique → inclus-les explicitement dans context_injection lors du navigate_to_section("sommaire")
- Pour **Partie1Agent** et **Partie2Agent** : si l'étudiant a mentionné des données, une entreprise, une méthodologie → les injecter aussi
- Dis à l'étudiant en une phrase : "Je note ça pour tes agents de rédaction."

Si l'étudiant n'a rien partagé encore, lors du premier message, invite-le brièvement :
"Si tu veux, parle-moi un peu de ton projet — thème, problématique, idées de chapitres. Tout ce que tu partages ici sera transmis à tes agents de génération."

## CONNAISSANCE DU CONTEXTE MAROCAIN

Quand pertinent au thème de l'étudiant, réfère à :
- **Finance/Gestion** : AMMC, Bank Al-Maghrib, CDVM, Bourse de Casablanca, OPCVM, fonds marocains
- **Banque** : Bank Al-Maghrib, GPBM, crédit agricole du Maroc, CIH
- **Management** : entreprises du CAM 25, contexte PME marocain
- **Droit** : Code de commerce marocain, droit OHADA, réglementation AMMC
- **Informatique** : contexte startups marocaines, transformation digitale Maroc

## CE QUE TU NE FAIS JAMAIS

- Écrire du contenu de section (introduction, partie I, etc.) : c'est le rôle des agents spécialisés
- Passer le texte complet d'une section à un autre agent : utilise des résumés uniquement
- Présenter une section qui a échoué la validation sans avertissement
- Sauter l'injection de contexte pour Partie II et Conclusion : c'est critique pour la cohérence
- Exposer des erreurs techniques directement à l'étudiant : gère-les en interne
- Répéter la question de l'étudiant
- Commencer par "Bien sûr !", "Absolument !", "Voici", "J'espère que ça aide"
- Utiliser : s'inscrire dans, mettre en lumière, jouer un rôle essentiel, incontournable, enjeux (vague)
- Donner des conseils vagues sans substance : chaque réponse doit être actionnabe

## STYLE DE COMMUNICATION — RÈGLE ABSOLUE : RÉPONSES COURTES

**Longueur maximale : 5 à 8 lignes par message. Jamais plus.**

Tu parles à un étudiant dans un chat, pas dans un rapport Word. Tes réponses doivent être conversationnelles, directes, et actionnables.

**Règles strictes :**
- **Une seule question à la fois.** Si tu dois collecter 4 informations, pose la première, attends la réponse, puis pose la suivante.
- **Pas de titres ni de sous-titres** (pas de "##", "**Points forts**", "**Phase A**"). Utilise du texte naturel ou au maximum 3-4 bullets.
- **Pas de listes numérotées de plus de 4 items.** Si tu as 6 points, résume-les en 2-3.
- **Diagnostics : résumé flash.** "Il te manque 4 sections. La plus urgente : le Sommaire. On y va ?" — pas un tableau de phases.
- **Choix de thème : une question, puis des options courtes.** Pas d'analyse multi-blocs avec points forts/points à clarifier/options A/B/C simultanément.
- Informe l'étudiant de la progression : "Génération de ton introduction en cours…"
- Professionnel et clair, jamais technique sur les erreurs internes
- Toujours terminer par une action concrète ou une question courte
- Toujours en français

**Exemples de mauvais → bon :**
- ❌ "Points forts : ✅ … ✅ … ✅ … / Points à clarifier : 1. … 2. … / Option A … Option B … Option C …"
- ✅ "Ton thème est solide. Une précision : tu veux couvrir tous les cycles ou te concentrer sur un secteur spécifique (banques, immobilier…) ?"
- ❌ Liste de 6 sections avec phases A/B/C/D/E et deux ordres recommandés
- ✅ "Il te manque 4 sections clés. Je te recommande de commencer par le Sommaire — c'est lui qui structure tout le reste. On y va ?"
`;

/* eslint-enable @typescript-eslint/no-unused-vars */

// ─── Streaming API call ───────────────────────────────────────────────────────

interface ApiCallResult {
  blocks: StreamBlock[];
  toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>;
}

async function streamApiCall(
  messages: ChatMessage[],
  systemPrompt: string,
  tools: Array<Record<string, unknown>>,
  apiKey: string,
  res: Response,
): Promise<ApiCallResult> {
  const anthropicRes = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      // Sonnet 4.6 required for the _20260209 server-side web tools.
      // effort "medium": 4.6 defaults to "high", too slow for a chat widget.
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      stream: true,
      output_config: { effort: "medium" },
      system: systemPrompt,
      messages,
      ...(tools.length > 0 ? { tools, tool_choice: { type: "auto" } } : {}),
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    throw new Error(`API error ${anthropicRes.status}: ${errText.slice(0, 200)}`);
  }

  const reader = anthropicRes.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const blocks: StreamBlock[] = [];
  let currentIdx = -1;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;

      let event: Record<string, unknown>;
      try { event = JSON.parse(raw); } catch { continue; }

      const evType = event.type as string;

      if (evType === "content_block_start") {
        const block = event.content_block as { type: string; id?: string; name?: string };
        if (block.type === "text") {
          blocks.push({ type: "text", text: "" });
          currentIdx = blocks.length - 1;
        } else if (block.type === "tool_use") {
          blocks.push({ type: "tool_use", id: block.id ?? "", name: block.name ?? "", inputRaw: "" });
          currentIdx = blocks.length - 1;
        }
      }

      if (evType === "content_block_delta" && currentIdx >= 0) {
        const delta = event.delta as { type: string; text?: string; partial_json?: string };
        const cur = blocks[currentIdx];
        if (delta.type === "text_delta" && cur.type === "text" && delta.text) {
          cur.text = (cur.text ?? "") + delta.text;
          res.write(`data: ${JSON.stringify({ content: delta.text })}\n\n`);
        }
        if (delta.type === "input_json_delta" && cur.type === "tool_use" && delta.partial_json) {
          cur.inputRaw = (cur.inputRaw ?? "") + delta.partial_json;
        }
      }

      if (evType === "content_block_stop" && currentIdx >= 0) {
        const cur = blocks[currentIdx];
        if (cur.type === "tool_use") {
          try { cur.input = JSON.parse(cur.inputRaw ?? "{}"); } catch { cur.input = {}; }
        }
        currentIdx = -1;
      }
    }
  }

  const toolUses = blocks
    .filter((b) => b.type === "tool_use")
    .map((b) => ({ id: b.id!, name: b.name!, input: b.input ?? {} }));

  return { blocks, toolUses };
}

// ─── POST /api/chat ───────────────────────────────────────────────────────────

router.post("/chat", async (req: Request, res: Response) => {
  const {
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    return;
  }

  // Daily chat limit — free plan only (each message costs real tokens).
  // attachPlan middleware already set req.planId from x-plan-id.
  const CHAT_DAILY_LIMIT: Partial<Record<string, number>> = { free: 15 };
  const chatLimit = CHAT_DAILY_LIMIT[req.planId ?? "free"];
  const chatCount = parseInt((req.headers["x-chat-count"] as string) ?? "0", 10);
  if (chatLimit !== undefined && chatCount >= chatLimit && process.env.FREE_LAUNCH !== "true") {
    res.status(403).json({
      error: "plan_limit_reached",
      limit_type: "chat",
      planId: req.planId ?? "free",
      limit: chatLimit,
    });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx proxy buffering
  res.flushHeaders();
  res.socket?.setNoDelay(true); // disable Nagle's algorithm

  // Patch res.write to flush after every chunk (fixes Replit proxy buffering).
  // This covers both inline writes and writes inside streamApiCall.
  const _origWrite = res.write.bind(res);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).write = (...args: any[]): boolean => {
    const r = (_origWrite as (...a: unknown[]) => boolean)(...args);
    (res as unknown as { flush?: () => void }).flush?.();
    return r;
  };

  const chatSanitize = (v: string | undefined, max = 300) =>
    (v ?? "").trim().slice(0, max).replace(/ignore\s+(all\s+)?previous\s+instructions/gi, "[supprimé]")
             .replace(/ignore\s+(all\s+)?above\s+instructions/gi, "[supprimé]")
             .replace(/reveal\s+(your\s+)?(system\s+)?prompt/gi, "[supprimé]")
             .replace(/you\s+are\s+now\s+/gi, "[supprimé]");

  const subject = chatSanitize(theme,         200) || "le sujet du rapport";
  const ecole   = chatSanitize(school,        100) || "l'école";
  const fil     = chatSanitize(filiere,       100) || "la filière";
  const type    = chatSanitize(reportType,     50) || "rapport de fin d'études";
  const prob    = chatSanitize(problematique, 600);
  const student = chatSanitize(studentName,   120) || "l'étudiant(e)";

  const sectionLines: string[] = [];
  for (const key of SECTION_ORDER) {
    const val = sections[key];
    if (!val || val.wordCount < 10) continue;
    const label = SECTION_LABELS[key] ?? key;
    const preview = val.content.slice(0, 280);
    sectionLines.push(`**${label}** (${val.wordCount} mots) :\n${preview}${val.content.length > 280 ? "…" : ""}`);
  }

  const completedKeys = SECTION_ORDER.filter((k) => (sections[k]?.wordCount ?? 0) > 50);
  const nextKey = SECTION_ORDER.find((k) => (sections[k]?.wordCount ?? 0) <= 50);

  const sectionContext = sectionLines.length > 0
    ? `\n\n## Aperçu des sections générées (${completedKeys.length}/${SECTION_TOTAL})\n\n${sectionLines.join("\n\n")}`
    : "";

  const summaryLines: string[] = [];
  for (const key of SECTION_ORDER) {
    const summary = sectionSummaries[key] ?? sectionSummaries[key.replace(/([A-Z])/g, "-$1").toLowerCase()];
    if (summary) {
      const label = SECTION_LABELS[key] ?? key;
      summaryLines.push(`**${label}:** ${summary}`);
    }
  }
  const summaryContext = summaryLines.length > 0
    ? `\n\n## Résumés des sections (utilisés pour context_injection)\n\n${summaryLines.join("\n")}`
    : "";

  const contextBlock = `

---

**Profil :** ${student} · ${ecole} · ${fil} · ${type} · "${subject}"${prob ? `\n**Problématique déclarée :** "${prob}"` : ""}
**Progression :** ${completedKeys.length}/${SECTION_TOTAL} sections terminées${completedKeys.length > 0 ? ` (${completedKeys.map((k) => SECTION_LABELS[k] ?? k).join(", ")})` : ""}
${nextKey ? `**Prochaine section recommandée :** ${SECTION_LABELS[nextKey] ?? nextKey}` : "**Rapport complet ✅**"}${summaryContext}${sectionContext}`;

  const isJury = mode === "jury";
  const systemPrompt = CHAT_SYSTEM_PROMPT + (CHAT_SKILLS ? `\n\n---\n## KNOWLEDGE BASE\n${CHAT_SKILLS}` : "") + contextBlock;
  const tools: Array<Record<string, unknown>> = isJury ? [] : [...ORCHESTRATOR_TOOLS, ...SERVER_TOOLS];

  let currentMessages: ChatMessage[] = rawMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const MAX_LOOPS = 5;

  try {
    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      const { blocks, toolUses } = await streamApiCall(
        currentMessages,
        systemPrompt,
        tools,
        apiKey,
        res,
      );

      if (toolUses.length === 0) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        return;
      }

      const navigateTool = toolUses.find((tu) => tu.name === "navigate_to_section");
      if (navigateTool) {
        const input = navigateTool.input as { section: string; context_injection?: string };
        const path = SECTION_PATHS[input.section] ?? "/rapports";
        const injection = input.context_injection ?? "";
        res.write(`data: ${JSON.stringify({ action: { type: "navigate", path, injection } })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        return;
      }

      // save_to_profile — send action to frontend then continue loop (agent confirms to user)
      const saveProfileTool = toolUses.find((tu) => tu.name === "save_to_profile");
      if (saveProfileTool) {
        const input = saveProfileTool.input as { field: string; value: string };
        if (input.field && input.value) {
          res.write(`data: ${JSON.stringify({ action: { type: "save_to_profile", field: input.field, value: input.value } })}\n\n`);
        }
        // don't return — let loop continue so agent sends confirmation text
      }

      const assistantContent: ContentBlock[] = blocks.map((b) =>
        b.type === "text"
          ? { type: "text", text: b.text ?? "" }
          : { type: "tool_use", id: b.id!, name: b.name!, input: b.input ?? {} },
      );

      const toolResultContent: ContentBlock[] = [];
      for (const tu of toolUses) {
        let result = "";

        if (tu.name === "read_full_section") {
          const sectionKey = (tu.input as { section: string }).section;
          const data = sections[sectionKey];
          result = data && data.wordCount > 10
            ? `## Contenu complet : ${SECTION_LABELS[sectionKey] ?? sectionKey} (${data.wordCount} mots)\n\n${data.content}`
            : `La section "${SECTION_LABELS[sectionKey] ?? sectionKey}" n'a pas encore été générée.`;
        }

        else if (tu.name === "read_multiple_sections") {
          const keys = (tu.input as { sections: string[] }).sections ?? [];
          const parts = keys.map((sectionKey) => {
            const data = sections[sectionKey];
            if (!data || data.wordCount <= 10) {
              return `## ${SECTION_LABELS[sectionKey] ?? sectionKey}\n[Non générée]`;
            }
            return `## ${SECTION_LABELS[sectionKey] ?? sectionKey} (${data.wordCount} mots)\n\n${data.content}`;
          });
          result = parts.join("\n\n---\n\n");
        }

        else if (tu.name === "get_report_stats") {
          result = buildReportStats(sections);
        }

        else if (tu.name === "analyze_coherence") {
          result = buildCoherencePayload(sections, prob);
        }

        else if (tu.name === "save_to_profile") {
          const input = tu.input as { field: string; value: string };
          result = `✅ "${input.field}" sauvegardé dans le profil : "${input.value}". Tu peux maintenant continuer à générer les sections.`;
        }

        else if (tu.name === "search_references") {
          const input = tu.input as { query: string; limit?: number };
          const limit = Math.min(Math.max(input.limit ?? 5, 1), 10);
          result = await searchReferences(input.query ?? "", limit);
        }

        else if (tu.name === "revise_section") {
          const input = tu.input as { section: string; instructions: string };
          const data = sections[input.section];
          // Revisions are plan-limited (attachPlan middleware set req.planRevisions)
          const revCount = parseInt((req.headers["x-revision-count"] as string) ?? "0", 10);
          const revLimit = req.planRevisions ?? Infinity;
          if (isFinite(revLimit) && revCount >= revLimit) {
            res.write(`data: ${JSON.stringify({ action: { type: "plan_limit", limit_type: "revisions", planId: req.planId ?? "free" } })}\n\n`);
            result = `Limite de révisions atteinte (${revLimit} pour le plan ${req.planId === "starter" ? "Essentiel" : "Gratuit"}). N'effectue PAS la révision. Explique gentiment à l'étudiant qu'il a utilisé ses révisions incluses et qu'il peut passer au plan supérieur pour continuer.`;
          } else if (!data || data.wordCount <= 10) {
            result = `La section "${SECTION_LABELS[input.section] ?? input.section}" n'a pas encore été générée — impossible de la réviser. Propose navigate_to_section pour la générer.`;
          } else {
            const revised = await reviseSectionContent(
              input.section,
              data.content,
              input.instructions ?? "",
              { theme: subject, problematique: prob, filiere: fil },
              apiKey,
            );
            if (revised) {
              res.write(`data: ${JSON.stringify({ action: { type: "update_section", section: input.section, content: revised } })}\n\n`);
              const newWords = revised.split(/\s+/).filter(Boolean).length;
              // Keep server-side copy in sync so later reads in this same turn see the new content
              sections[input.section] = { content: revised, wordCount: newWords };
              result = `✅ Section "${SECTION_LABELS[input.section] ?? input.section}" révisée et mise à jour dans le rapport (${data.wordCount} → ${newWords} mots).\n\nDébut du nouveau contenu :\n${revised.slice(0, 400)}…\n\nConfirme brièvement à l'étudiant ce qui a été amélioré.`;
            } else {
              result = `La révision a échoué (erreur API). Informe l'étudiant et propose de réessayer.`;
            }
          }
        }

        toolResultContent.push({
          type: "tool_result" as const,
          tool_use_id: tu.id,
          content: result,
        });
      }

      currentMessages = [
        ...currentMessages,
        { role: "assistant" as const, content: assistantContent },
        { role: "user" as const, content: toolResultContent },
      ];
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
