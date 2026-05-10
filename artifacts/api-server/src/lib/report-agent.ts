import Anthropic from "@anthropic-ai/sdk";
import { AgentSession } from "./agent-session";

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface BibEntry {
  title: string;
  authors: string;
  year: string;
  journal?: string;
  doi?: string;
}

// ─── Tool definitions — the full suite ───────────────────────────────────────

const REPORT_TOOLS: Anthropic.Tool[] = [
  // ── Read ──────────────────────────────────────────────────────────────────
  {
    name: "read_section",
    description:
      "Lis le contenu intégral d'une ou plusieurs sections déjà rédigées. " +
      "Appelle cet outil avant toute rédaction pour assurer la cohérence terminologique, " +
      "éviter les répétitions et construire des références croisées.",
    input_schema: {
      type: "object" as const,
      properties: {
        sections: {
          type: "array",
          items: { type: "string" },
          description:
            'Sections à lire. Valeurs : "all", "resume", "introduction", ' +
            '"partie-i", "partie-ii", "conclusion", "dedicaces", "remerciements".',
        },
      },
      required: ["sections"],
    },
  },

  // ── Write ─────────────────────────────────────────────────────────────────
  {
    name: "write_section",
    description:
      "Enregistre une section rédigée dans le document. " +
      "Appelle cet outil dès qu'une section est terminée pour la persister.",
    input_schema: {
      type: "object" as const,
      properties: {
        section_id: {
          type: "string",
          description: "Identifiant de la section (ex: 'partie-i', 'conclusion').",
        },
        content: {
          type: "string",
          description: "Contenu Markdown complet de la section.",
        },
      },
      required: ["section_id", "content"],
    },
  },

  // ── Edit ──────────────────────────────────────────────────────────────────
  {
    name: "edit_section",
    description:
      "Effectue une modification ciblée dans une section existante. " +
      "Remplace un passage précis sans réécrire toute la section. " +
      "Équivalent de l'outil Edit dans un éditeur de code.",
    input_schema: {
      type: "object" as const,
      properties: {
        section_id: {
          type: "string",
          description: "Identifiant de la section à modifier.",
        },
        old_text: {
          type: "string",
          description: "Le texte exact à remplacer (doit être unique dans la section).",
        },
        new_text: {
          type: "string",
          description: "Le texte de remplacement.",
        },
      },
      required: ["section_id", "old_text", "new_text"],
    },
  },

  // ── Glob / list ───────────────────────────────────────────────────────────
  {
    name: "list_sections",
    description:
      "Liste toutes les sections du rapport avec leur statut (rédigée / non rédigée) " +
      "et leur nombre de mots. Utile pour savoir où en est le document.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },

  // ── Grep ──────────────────────────────────────────────────────────────────
  {
    name: "search_content",
    description:
      "Recherche un mot, une expression ou un concept dans les sections rédigées. " +
      "Utile pour vérifier la cohérence terminologique ou trouver où un concept " +
      "a déjà été mentionné.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Le texte ou l'expression à rechercher.",
        },
        section_id: {
          type: "string",
          description:
            "Identifiant de la section où chercher. Omis = cherche dans tout le document.",
        },
      },
      required: ["query"],
    },
  },

  // ── WebSearch / academic ──────────────────────────────────────────────────
  {
    name: "search_academic",
    description:
      "Recherche des articles académiques réels via Semantic Scholar et CrossRef. " +
      "Utilise cet outil pour trouver des sources à citer plutôt que d'inventer des références. " +
      "Retourne des résultats avec titre, auteurs, année, DOI.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "La requête de recherche académique (en français ou en anglais).",
        },
        limit: {
          type: "number",
          description: "Nombre de résultats à retourner (défaut : 5, max : 10).",
        },
      },
      required: ["query"],
    },
  },

  // ── WebFetch ──────────────────────────────────────────────────────────────
  {
    name: "fetch_url",
    description:
      "Récupère le contenu d'une URL ou d'un DOI. " +
      "Utile pour lire un article, une page Wikipedia, un rapport institutionnel, " +
      "ou récupérer les métadonnées d'un DOI via CrossRef.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description:
            "L'URL à récupérer, ou un DOI au format '10.xxxx/xxxxx' (sera résolu via CrossRef).",
        },
      },
      required: ["url"],
    },
  },

  // ── Read uploaded document ────────────────────────────────────────────────
  {
    name: "read_document",
    description:
      "Lis le contenu d'un document uploadé par l'étudiant(e) (PDF, Word, TXT). " +
      "Appelle cet outil pour t'appuyer sur les documents de référence fournis. " +
      "Sans argument, retourne la liste des documents disponibles.",
    input_schema: {
      type: "object" as const,
      properties: {
        filename: {
          type: "string",
          description:
            "Nom du fichier à lire. Omis = liste tous les documents disponibles.",
        },
      },
      required: [],
    },
  },

  // ── AskUserQuestion ───────────────────────────────────────────────────────
  {
    name: "ask_user",
    description:
      "Pose une question de clarification à l'étudiant(e) et attend sa réponse " +
      "avant de continuer la rédaction. " +
      "Utilise cet outil quand une information essentielle manque et que deviner " +
      "produirait un contenu incorrect ou générique.",
    input_schema: {
      type: "object" as const,
      properties: {
        question: {
          type: "string",
          description: "La question à poser à l'étudiant(e), en français.",
        },
        choices: {
          type: "array",
          items: { type: "string" },
          description:
            "Options de réponse proposées (optionnel). Si fourni, l'étudiant choisit parmi ces options.",
        },
      },
      required: ["question"],
    },
  },
];

// ─── ReportAgent ──────────────────────────────────────────────────────────────

export class ReportAgent extends AgentSession {
  readonly profile: ReportProfile;
  private sections: Record<string, string> = {};
  private uploadedDocuments: Record<string, string> = {};

  uploadDocument(filename: string, text: string): void {
    this.uploadedDocuments[filename] = text;
  }

  getDocumentNames(): string[] {
    return Object.keys(this.uploadedDocuments);
  }

  // All section IDs in canonical report order
  private static readonly SECTION_ORDER = [
    "dedicaces",
    "remerciements",
    "resume",
    "introduction",
    "partie-i",
    "partie-ii",
    "conclusion",
  ];

  constructor(sessionId: string, profile: ReportProfile) {
    super(sessionId, buildSystemPrompt(profile), REPORT_TOOLS);
    this.profile = profile;
  }

  loadSections(sections: Record<string, string>): void {
    this.sections = { ...sections };
  }

  getSections(): Record<string, string> {
    return { ...this.sections };
  }

  getSection(id: string): string | undefined {
    return this.sections[id];
  }

  /**
   * Build the task message for a targeted revision.
   * The agent reads the section, makes precise edit_section calls,
   * then returns the final updated content — no full rewrite.
   */
  buildRevisionTask(sectionId: string, instruction: string): string {
    return `L'étudiant(e) demande une révision ciblée sur la section "${sectionId}".

Instruction : ${instruction}

Procède exactement comme suit :
1. Appelle read_section avec sections: ["${sectionId}"] pour lire le contenu actuel
2. Identifie précisément les passages à modifier selon l'instruction
3. Pour chaque modification, appelle edit_section avec le texte exact à remplacer et le texte de remplacement
   - Ne réécris PAS toute la section — fais uniquement les changements demandés
   - Si plusieurs passages doivent changer, appelle edit_section plusieurs fois

Règles absolues :
- Modifications chirurgicales uniquement — ne touche pas à ce qui n'est pas demandé
- Conserve toutes les citations, références et la structure Markdown (##, ###)
- Français académique formel
- Si l'instruction est ambiguë ou impossible à appliquer, utilise ask_user pour préciser`;
  }

  buildSectionTask(section: string, sources?: BibEntry[]): string {
    const p = this.profile;
    const style = p.citationStyle ?? "APA 7th ed.";
    const prob =
      p.problematique ??
      `Dans quelle mesure "${p.theme}" peut-il être approfondi dans le contexte marocain ?`;
    const citationBlock = buildCitationBlock(sources, style);

    const docNames = this.getDocumentNames();
    const docPreamble = docNames.length > 0
      ? `Des documents ont été uploadés par l'étudiant(e) : ${docNames.join(", ")}. Commence par appeler read_document pour chaque document et base-toi sur leur contenu réel.\n\n`
      : "";

    switch (section) {
      case "partie-i":
        return `${docPreamble}Appelle ensuite read_section avec sections: ["all"] pour lire tout ce qui est déjà rédigé. Utilise search_academic pour trouver des sources réelles si la bibliothèque est vide. Puis rédige la Partie I du ${p.reportType} intitulé "${p.theme}" (${p.school} — ${p.filiere}, ${p.annee ?? "2024–2025"}).

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
Style de citation : ${style}
${citationBlock}

EXIGENCES :
- Minimum 2 500 mots
- Chaque sous-section : minimum 3 paragraphes de 80–120 mots
- Références croisées vers les sections précédentes
- Placeholders figures : [INSÉRER FIGURE N — Titre]
- Si une information clé manque, utilise ask_user avant de continuer
- Termine par write_section avec section_id: "partie-i"
- NE T'ARRÊTE PAS avant les 8 sous-sections complètes`;

      case "partie-ii":
        return `${docPreamble}Appelle ensuite read_section avec sections: ["all"]. Utilise search_academic si besoin de sources supplémentaires. Puis rédige la Partie II du ${p.reportType} intitulé "${p.theme}" (${p.school} — ${p.filiere}, ${p.annee ?? "2024–2025"}).

## Chapitre 3 — Présentation et analyse des résultats
### 3.1 Statistiques descriptives et présentation de l'échantillon
### 3.2 Résultats de l'analyse principale
### 3.3 Interprétation des résultats et validation des hypothèses
### 3.4 Synthèse des findings empiriques

## Chapitre 4 — Discussion, limites et recommandations
### 4.1 Discussion des résultats au regard de la littérature
### 4.2 Implications théoriques et contributions académiques
### 4.3 Implications pratiques et managériales
### 4.4 Limites de l'étude et voies de recherche futures

Problématique : ${prob}
Style de citation : ${style}
${citationBlock}

EXIGENCES :
- Minimum 2 500 mots
- Références croisées directes vers la Partie I
- Tableaux décrits en texte ("Le tableau 3.1 montre que…")
- Placeholders figures : [INSÉRER FIGURE N — Titre]
- Termine par write_section avec section_id: "partie-ii"
- NE T'ARRÊTE PAS avant les 8 sous-sections complètes`;

      case "introduction":
        return `Commence par read_section avec sections: ["all"] pour lire tout ce qui est déjà rédigé. Puis rédige l'Introduction Générale du ${p.reportType} intitulé "${p.theme}" (${p.school} — ${p.filiere}, ${p.annee ?? "2024–2025"}).

## Introduction Générale
### Contexte général
### Problématique
### Objectifs de recherche
### Structure du rapport

Problématique : ${prob}
${citationBlock}

400 à 600 mots. Pose la problématique, justifie la pertinence dans le contexte marocain, annonce les deux parties.
Termine par write_section avec section_id: "introduction".`;

      case "conclusion":
        return `Commence par read_section avec sections: ["introduction", "partie-i", "partie-ii"]. Puis rédige la Conclusion Générale du ${p.reportType} intitulé "${p.theme}" (${p.school} — ${p.filiere}).

## Conclusion Générale
### Synthèse des résultats
### Apports et contributions
### Limites de l'étude
### Perspectives futures de recherche

Problématique résolue : ${prob}
${citationBlock}

400 à 600 mots. Synthèse directe des deux parties, références croisées vers les chapitres.
Termine par write_section avec section_id: "conclusion".`;

      case "resume":
        return `Commence par read_section avec sections: ["introduction"]. Puis rédige le Résumé académique (250–300 mots) du ${p.reportType} intitulé "${p.theme}" (${p.school} — ${p.filiere}).

Structure : Contexte → Objectifs → Méthodologie → Résultats → Conclusion.
Problématique : ${prob}
Termine par les mots-clés. Ne dépasse pas 300 mots.
Termine par write_section avec section_id: "resume".`;

      default:
        return `Rédige la section "${section}" du ${p.reportType} intitulé "${p.theme}" (${p.school} — ${p.filiere}).`;
    }
  }

  protected override async handleTool(
    name: string,
    input: unknown
  ): Promise<string> {
    switch (name) {

      // ── Read ───────────────────────────────────────────────────────────────
      case "read_section": {
        const { sections } = input as { sections: string[] };
        const readAll = sections.includes("all") || sections.length === 0;
        // Always return sections in canonical document order, not insertion order
        const keys = ReportAgent.SECTION_ORDER.filter((id) =>
          readAll ? this.sections[id] : sections.includes(id) && this.sections[id]
        );

        if (keys.length === 0) {
          return "Aucune section rédigée pour l'instant. C'est le début du document.";
        }
        return keys
          .map((k) => `=== Section : ${k} ===\n\n${this.sections[k]}`)
          .join("\n\n---\n\n");
      }

      // ── Write ──────────────────────────────────────────────────────────────
      case "write_section": {
        const { section_id, content } = input as { section_id: string; content: string };
        this.sections[section_id] = content;
        const words = content.trim().split(/\s+/).length;
        return `Section "${section_id}" enregistrée — ${words} mots.`;
      }

      // ── Edit ───────────────────────────────────────────────────────────────
      case "edit_section": {
        const { section_id, old_text, new_text } = input as {
          section_id: string;
          old_text: string;
          new_text: string;
        };
        const current = this.sections[section_id];
        if (!current) {
          return `Erreur : la section "${section_id}" n'existe pas encore.`;
        }
        if (!current.includes(old_text)) {
          return `Erreur : le texte à remplacer n'a pas été trouvé dans "${section_id}". Vérifie que le texte correspond exactement.`;
        }
        this.sections[section_id] = current.replace(old_text, new_text);
        return `Section "${section_id}" modifiée avec succès.`;
      }

      // ── List sections ──────────────────────────────────────────────────────
      case "list_sections": {
        const allIds = ReportAgent.SECTION_ORDER;
        const lines = allIds.map((id) => {
          const content = this.sections[id];
          if (!content) return `- ${id} : ⬜ non rédigée`;
          const words = content.trim().split(/\s+/).length;
          return `- ${id} : ✅ rédigée (${words} mots)`;
        });
        return lines.join("\n");
      }

      // ── Search content ─────────────────────────────────────────────────────
      case "search_content": {
        const { query, section_id } = input as { query: string; section_id?: string };
        const sectionsToSearch = section_id
          ? { [section_id]: this.sections[section_id] ?? "" }
          : this.sections;

        const results: string[] = [];
        const queryLower = query.toLowerCase();

        for (const [id, content] of Object.entries(sectionsToSearch)) {
          if (!content) continue;
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(queryLower)) {
              // Return surrounding context (3 lines)
              const start = Math.max(0, i - 1);
              const end = Math.min(lines.length - 1, i + 1);
              results.push(
                `[${id}, ligne ~${i + 1}]\n${lines.slice(start, end + 1).join("\n")}`
              );
            }
          }
        }

        if (results.length === 0) {
          return `Aucune occurrence de "${query}" trouvée dans le document.`;
        }
        return `${results.length} occurrence(s) trouvée(s) pour "${query}" :\n\n${results.join("\n\n---\n\n")}`;
      }

      // ── Search academic ────────────────────────────────────────────────────
      case "search_academic": {
        const { query, limit = 5 } = input as { query: string; limit?: number };
        const max = Math.min(limit, 10);

        try {
          // Try Semantic Scholar first (free, no key needed, excellent academic coverage)
          const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${max}&fields=title,authors,year,externalIds,publicationVenue,abstract`;
          const ssResp = await fetch(ssUrl, {
            headers: { "User-Agent": "RapportAI/1.0 (academic-research)" },
            signal: AbortSignal.timeout(8000),
          });

          if (ssResp.ok) {
            const data = (await ssResp.json()) as {
              data: Array<{
                title: string;
                authors: Array<{ name: string }>;
                year: number;
                externalIds?: { DOI?: string };
                publicationVenue?: { name: string };
                abstract?: string;
              }>;
            };

            if (data.data && data.data.length > 0) {
              const formatted = data.data
                .map((p, i) => {
                  const authors = p.authors?.map((a) => a.name).join(", ") ?? "Auteurs inconnus";
                  const doi = p.externalIds?.DOI ?? null;
                  const venue = p.publicationVenue?.name ?? "";
                  const abstract = p.abstract
                    ? `\n   Résumé : ${p.abstract.slice(0, 200)}…`
                    : "";
                  return `${i + 1}. **${p.title}**\n   Auteurs : ${authors}\n   Année : ${p.year ?? "N/A"}${venue ? `\n   Revue : ${venue}` : ""}${doi ? `\n   DOI : ${doi}` : ""}${abstract}`;
                })
                .join("\n\n");
              return `Résultats Semantic Scholar pour "${query}" :\n\n${formatted}`;
            }
          }

          // Fallback: CrossRef (also free, great for DOIs)
          const crUrl = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${max}&select=title,author,published,DOI,container-title`;
          const crResp = await fetch(crUrl, {
            headers: { "User-Agent": "RapportAI/1.0 (mailto:support@rapportai.ma)" },
            signal: AbortSignal.timeout(8000),
          });

          if (crResp.ok) {
            const data = (await crResp.json()) as {
              message: {
                items: Array<{
                  title?: string[];
                  author?: Array<{ family: string; given?: string }>;
                  published?: { "date-parts": number[][] };
                  DOI?: string;
                  "container-title"?: string[];
                }>;
              };
            };

            const items = data.message?.items ?? [];
            if (items.length > 0) {
              const formatted = items
                .map((item, i) => {
                  const title = item.title?.[0] ?? "Sans titre";
                  const authors =
                    item.author
                      ?.map((a) => `${a.family}${a.given ? " " + a.given[0] + "." : ""}`)
                      .join(", ") ?? "Auteurs inconnus";
                  const year = item.published?.["date-parts"]?.[0]?.[0] ?? "N/A";
                  const journal = item["container-title"]?.[0] ?? "";
                  const doi = item.DOI ?? "";
                  return `${i + 1}. **${title}**\n   Auteurs : ${authors}\n   Année : ${year}${journal ? `\n   Revue : ${journal}` : ""}${doi ? `\n   DOI : ${doi}` : ""}`;
                })
                .join("\n\n");
              return `Résultats CrossRef pour "${query}" :\n\n${formatted}`;
            }
          }

          return `Aucun résultat trouvé pour "${query}". Essaie des mots-clés différents ou en anglais.`;
        } catch {
          return `Erreur lors de la recherche académique. Utilise des citations plausibles avec [SOURCE À COMPLÉTER].`;
        }
      }

      // ── Fetch URL / DOI ────────────────────────────────────────────────────
      case "fetch_url": {
        const { url } = input as { url: string };

        try {
          // If it looks like a DOI (10.xxxx/...), resolve via CrossRef
          const isDoi = /^10\.\d{4,}\//.test(url);
          const resolvedUrl = isDoi
            ? `https://api.crossref.org/works/${encodeURIComponent(url)}`
            : url;

          const resp = await fetch(resolvedUrl, {
            headers: { "User-Agent": "RapportAI/1.0" },
            signal: AbortSignal.timeout(10000),
          });

          if (!resp.ok) {
            return `Impossible de récupérer ${url} (HTTP ${resp.status}).`;
          }

          const contentType = resp.headers.get("content-type") ?? "";

          if (contentType.includes("application/json")) {
            const json = (await resp.json()) as Record<string, unknown>;

            // CrossRef DOI response
            if (isDoi && json.message) {
              const m = json.message as Record<string, unknown>;
              const publishedYear =
                ((m.published as { "date-parts"?: number[][] } | undefined)?.["date-parts"])?.[0]?.[0] ?? "N/A";
              return `DOI résolu : ${url}\nTitre : ${(m.title as string[])?.[0] ?? "N/A"}\nAuteurs : ${((m.author as Array<{ family: string }>) ?? []).map((a) => a.family).join(", ")}\nAnnée : ${publishedYear}\nRevue : ${(m["container-title"] as string[])?.[0] ?? "N/A"}`;
            }

            return JSON.stringify(json, null, 2).slice(0, 3000);
          }

          // HTML page — strip tags and return plain text
          const html = await resp.text();
          const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim()
            .slice(0, 3000);

          return `Contenu de ${url} :\n\n${text}`;
        } catch {
          return `Impossible de récupérer ${url}. Vérifie l'URL et réessaie.`;
        }
      }

      // ── Read uploaded document ─────────────────────────────────────────────
      case "read_document": {
        const { filename } = input as { filename?: string };
        const docs = this.uploadedDocuments;
        const names = Object.keys(docs);

        if (!filename) {
          if (names.length === 0) return "Aucun document uploadé par l'étudiant(e).";
          return `Documents disponibles : ${names.join(", ")}`;
        }

        const content = docs[filename];
        if (!content) {
          return `Document "${filename}" introuvable. Disponibles : ${names.join(", ") || "aucun"}`;
        }

        const MAX = 15_000;
        const truncated = content.length > MAX ? content.slice(0, MAX) + `\n\n[Tronqué — ${content.length} caractères au total]` : content;
        return `=== Document : ${filename} ===\n\n${truncated}`;
      }

      // ── ask_user is handled in agent-session.ts before reaching here ──────
      default:
        return `Outil inconnu : ${name}`;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCitationBlock(sources: BibEntry[] | undefined, style: string): string {
  if (!sources || sources.length === 0) {
    return `\nInstruction citations : Utilise search_academic pour trouver des sources réelles. Pour toute affirmation sans source, écris [SOURCE À COMPLÉTER].`;
  }

  const inlineLabel = (s: BibEntry) => {
    const lastName = s.authors.split(/[,& ]/)[0].trim();
    return `(${lastName}, ${s.year})`;
  };

  const list = sources
    .map((s, i) => {
      const journal = s.journal ? `. *${s.journal}*` : "";
      const doi = s.doi ? ` https://doi.org/${s.doi}` : "";
      return `  ${i + 1}. ${inlineLabel(s)} — ${s.authors} (${s.year}). ${s.title}${journal}${doi}`;
    })
    .join("\n");

  return `\n## Sources disponibles (format ${style})\n${list}\nPour toute affirmation sans source dans la liste, utilise search_academic ou écris [SOURCE À COMPLÉTER].`;
}

function buildSystemPrompt(p: ReportProfile): string {
  const style = p.citationStyle ?? "APA 7th ed.";

  return `Tu es l'agent de rédaction académique de RapportAI. Tu accompagnes ${p.studentName} tout au long de la rédaction de son ${p.reportType} à ${p.school}.

## Tes outils — utilise-les activement

**Lecture et écriture du document :**
- read_section : lis les sections déjà rédigées AVANT d'écrire (obligatoire pour toute section principale)
- write_section : enregistre chaque section une fois terminée
- edit_section : corrige un passage précis sans réécrire toute la section
- list_sections : vérifie l'état d'avancement du rapport

**Recherche dans le document :**
- search_content : vérifie qu'un terme ou concept n'a pas déjà été défini ailleurs

**Documents de l'étudiant(e) :**
- read_document : lis les PDF/Word/TXT uploadés par l'étudiant(e) — utilise cet outil EN PREMIER si des documents ont été fournis, ils contiennent les données réelles du stage/projet

**Recherche académique :**
- search_academic : trouve des articles réels via Semantic Scholar et CrossRef — utilise cet outil pour trouver des citations RÉELLES plutôt que d'en inventer
- fetch_url : récupère le contenu d'une URL ou les métadonnées d'un DOI

**Communication avec l'étudiant(e) :**
- ask_user : pose une question quand une information essentielle manque — mieux vaut demander que deviner

## Mémoire de session
Tu te souviens de tout dans cette conversation : le profil, chaque section rédigée, chaque source trouvée, chaque décision stylistique. Utilise cette mémoire — ne re-demande jamais ce qui a déjà été fourni.

## Profil du rapport
- Étudiant(e) : ${p.studentName}
- École : ${p.school} | Filière : ${p.filiere} | Promotion : ${p.annee ?? "2024–2025"}
- Type : ${p.reportType} | Thème : "${p.theme}"
${p.problematique ? `- Problématique : ${p.problematique}` : ""}
${p.encadrantPeda ? `- Encadrant pédagogique : ${p.encadrantPeda}` : ""}
${p.encadrantPro ? `- Encadrant professionnel : ${p.encadrantPro}` : ""}
${p.entreprise ? `- Entreprise : ${p.entreprise}` : ""}
- Style de citation : ${style}

## Règles absolues
- Français académique formel uniquement
- 100% spécifique au thème "${p.theme}"
- Titres Markdown ## et ### obligatoires
- Anti-plagiat : reformulation personnelle, < 10% similarité
- Citations réelles via search_academic — jamais inventées
- Commence directement par le contenu, sans préambule`;
}
