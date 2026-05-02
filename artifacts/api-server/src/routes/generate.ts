import { Router, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

interface BibEntry {
  title: string;
  authors: string;
  year: string;
  journal?: string;
  doi?: string;
}

interface GenerateBody {
  section: string;
  // Identity
  reportType?: string;
  studentName?: string;
  school?: string;
  filiere?: string;
  annee?: string;
  ville?: string;
  entreprise?: string;
  encadrantPeda?: string;
  encadrantPro?: string;
  // Subject
  theme?: string;
  problematique?: string;
  motsCles?: string[];
  citationStyle?: string;
  // Previously generated sections (for cross-referencing)
  resume?: string;
  introduction?: string;
  partieI?: string;
  partieII?: string;
  // Library sources from Bibliothèque
  sources?: BibEntry[];
  // Misc
  extraContext?: string;
}

function buildSystemPrompt(ctx: GenerateBody): string {
  const name    = ctx.studentName  ?? "l'étudiant(e)";
  const school  = ctx.school       ?? "l'école";
  const filiere = ctx.filiere      ?? "la filière";
  const type    = ctx.reportType   ?? "rapport de fin d'études";
  const theme   = ctx.theme        ?? "le thème fourni";
  const style   = ctx.citationStyle ?? "APA 7th ed.";

  return `Tu es l'assistant de rédaction académique de RapportAI. Tu aides ${name} (${school} — ${filiere}) à rédiger son ${type} intitulé "${theme}".

Règles absolues :
- Français académique formel et soutenu uniquement
- Chaque phrase est spécifique au sujet "${theme}" — JAMAIS de contenu générique ou hors-sujet
- Structure avec titres Markdown ## et ### (indispensable pour la table des matières Word)
- Citations au format ${style} avec auteurs et années plausibles
- Commence directement par le contenu — aucun préambule méta, aucun "Voici la rédaction…"
- Utilise toutes les données personnelles fournies dans le prompt (nom étudiant, école, encadrants…)
- Si des sections précédentes sont fournies, assure la cohérence et la continuité du discours`;
}

/**
 * Build an APA-style inline label for a source, e.g. "(Dupont, 2020)"
 * Used in citation instructions to show Claude the exact format to use.
 */
function inlineLabel(s: BibEntry): string {
  const lastName = s.authors.split(/[,& ]/)[0].trim();
  return `(${lastName}, ${s.year})`;
}

/**
 * Build the sources block injected into the Claude prompt.
 * If sources are provided, lists them and tells Claude to cite inline.
 * If not, tells Claude to use [SOURCE À COMPLÉTER] placeholders.
 */
function buildCitationBlock(sources: BibEntry[] | undefined, style: string): string {
  if (!sources || sources.length === 0) {
    return `\nInstruction citations : L'étudiant n'a pas encore importé de sources dans sa bibliothèque. Utilise des citations plausibles au format ${style} avec des auteurs réels du domaine académique, ET insère au moins 2 placeholders [SOURCE À COMPLÉTER] aux endroits où une source spécifique manque, pour que l'étudiant sache où chercher.`;
  }

  const numbered = sources
    .map((s, i) => {
      const journal = s.journal ? `. *${s.journal}*` : "";
      const doi     = s.doi ? ` https://doi.org/${s.doi}` : "";
      return `  ${i + 1}. ${inlineLabel(s)} — ${s.authors} (${s.year}). ${s.title}${journal}${doi}`;
    })
    .join("\n");

  return `\n## Sources bibliographiques disponibles (à citer dans le texte)
L'étudiant a importé ces sources dans sa bibliothèque. Tu DOIS :
1. Citer les sources pertinentes dans le corps du texte au format ${style}, ex : ${inlineLabel(sources[0])}
2. Utiliser autant de sources de la liste que possible là où elles sont académiquement pertinentes
3. Pour toute affirmation nécessitant une source non listée, écrire [SOURCE À COMPLÉTER]
4. Ne pas inventer de références qui ne sont pas dans la liste

Sources disponibles :
${numbered}`;
}

function snippet(text: string | undefined, maxChars = 900): string {
  if (!text) return "";
  return text.length > maxChars ? text.slice(0, maxChars) + "…" : text;
}

function buildPrompt(ctx: GenerateBody): string {
  const theme     = ctx.theme         ?? "Sujet non précisé";
  const school    = ctx.school        ?? "l'école";
  const filiere   = ctx.filiere       ?? "gestion";
  const type      = ctx.reportType    ?? "rapport de fin d'études";
  const student   = ctx.studentName   ?? "l'étudiant(e)";
  const encPeda   = ctx.encadrantPeda ?? "l'encadrant pédagogique";
  const encPro    = ctx.encadrantPro  ?? "l'encadrant professionnel";
  const entreprise = ctx.entreprise   ?? "l'entreprise d'accueil";
  const annee     = ctx.annee         ?? "2024–2025";
  const ville     = ctx.ville         ?? "Maroc";
  const prob      = ctx.problematique ?? `Dans quelle mesure "${theme}" peut-il être approfondi dans le contexte marocain ?`;
  const kw        = ctx.motsCles?.join(", ") ?? theme;
  const style     = ctx.citationStyle ?? "APA 7th ed.";

  switch (ctx.section) {

    case "partie-i":
      return `Rédige la Partie I du ${type} intitulé "${theme}", réalisé par ${student} à ${school} en ${filiere} (${annee}).

## Chapitre 1 — Cadre théorique et revue de littérature
### 1.1 Fondements théoriques
### 1.2 Revue de la littérature internationale
### 1.3 Contexte marocain et spécificités locales

## Chapitre 2 — Méthodologie de recherche
### 2.1 Approche et design de recherche
### 2.2 Collecte et traitement des données
### 2.3 Modèles et outils d'analyse

Problématique centrale : ${prob}
Mots-clés : ${kw}
Style de citation : ${style}

${ctx.resume ? `Résumé existant (cohérence requise) :\n"${snippet(ctx.resume)}"\n` : ""}
${ctx.introduction ? `Introduction existante (s'appuyer dessus) :\n"${snippet(ctx.introduction)}"\n` : ""}
${buildCitationBlock(ctx.sources, style)}

Exigences : minimum 1 000 mots, placeholders figures : [INSÉRER FIGURE N — Titre], analyses spécifiques au marché marocain.`;

    case "partie-ii":
      return `Rédige la Partie II du ${type} intitulé "${theme}", réalisé par ${student} à ${school} en ${filiere} (${annee}).

## Chapitre 3 — Présentation et analyse des résultats
### 3.1 Statistiques descriptives
### 3.2 Résultats de l'analyse principale
### 3.3 Interprétation des résultats

## Chapitre 4 — Discussion et recommandations
### 4.1 Discussion des résultats
### 4.2 Implications théoriques et pratiques
### 4.3 Recommandations opérationnelles

Problématique centrale : ${prob}
Mots-clés : ${kw}
Style de citation : ${style}

${ctx.partieI ? `Partie I déjà rédigée (assure la continuité) :\n"${snippet(ctx.partieI)}"\n` : ""}
${buildCitationBlock(ctx.sources, style)}

Exigences : minimum 1 000 mots, analyses chiffrées fictives mais cohérentes, placeholders : [INSÉRER FIGURE N — Titre descriptif].`;

    case "introduction":
      return `Rédige l'Introduction Générale du ${type} intitulé "${theme}" (${school} — ${filiere}, ${annee}).

## Introduction Générale
### Contexte général
### Problématique
### Objectifs de recherche
### Structure du rapport

Problématique : ${prob}
Mots-clés : ${kw}

${ctx.resume ? `Résumé existant (utilise-le comme boussole thématique) :\n"${snippet(ctx.resume)}"\n` : ""}
${buildCitationBlock(ctx.sources, style)}

400 à 600 mots. Pose clairement la problématique et justifie la pertinence du sujet dans le contexte marocain actuel.`;

    case "conclusion":
      return `Rédige la Conclusion Générale du ${type} intitulé "${theme}" (${school} — ${filiere}).

## Conclusion Générale
### Synthèse des résultats
### Apports et contributions

### Limites de l'étude
### Perspectives futures de recherche

Problématique résolue : ${prob}

${ctx.partieI  ? `Résumé Partie I (à synthétiser) :\n"${snippet(ctx.partieI)}"\n`  : ""}
${ctx.partieII ? `Résumé Partie II (à synthétiser) :\n"${snippet(ctx.partieII)}"\n` : ""}
${buildCitationBlock(ctx.sources, style)}

400 à 600 mots. Synthétise les apports théoriques et pratiques en lien direct avec les deux parties, puis ouvre sur des perspectives de recherche pertinentes pour le Maroc.`;

    case "resume":
      return `Rédige le Résumé académique en français (250–300 mots) du ${type} intitulé "${theme}" (${school} — ${filiere}).

Structure : Contexte → Objectifs → Méthodologie → Résultats → Conclusion.
Problématique : ${prob}
Style de citation : ${style}

${ctx.introduction ? `Introduction existante :\n"${snippet(ctx.introduction)}"\n` : ""}

Termine par : Mots-clés : ${kw || "À définir"}
Ne dépasse pas 300 mots.`;

    case "dedicaces":
      return `Rédige une page de Dédicaces sobre et élégante pour le ${type} intitulé "${theme}" de ${student} (${school}).

La dédicace doit être sobre, sincère et académiquement appropriée. Mise en forme poétique avec une dédicace principale à la famille et une ligne pour les proches et ami(e)s. 4 à 6 lignes maximum.`;

    case "remerciements":
      return `Rédige une page de Remerciements formelle pour le ${type} intitulé "${theme}" de ${student} (${school} — ${filiere}).

Personnes à remercier nominativement :
- Encadrant pédagogique : ${encPeda}
- Encadrant professionnel : ${encPro}
- Entreprise d'accueil : ${entreprise}
- Corps professoral et administratif de ${school}

Ton solennel et sincère. 150 à 200 mots. Utilise les vrais noms fournis.`;

    default:
      return `Génère du contenu académique formel de 250 à 400 mots pour un ${type} sur le thème "${theme}" (${school} — ${filiere}).
Contexte supplémentaire : ${ctx.extraContext ?? "Non précisé"}`;
  }
}

router.post("/generate", async (req: Request, res: Response) => {
  const body = req.body as GenerateBody;

  if (!body.section) {
    res.status(400).json({ error: "section is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: buildSystemPrompt(body),
      messages: [{ role: "user", content: buildPrompt(body) }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

export default router;
