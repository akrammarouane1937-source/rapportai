import { Router, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

const SYSTEM_PROMPT =
  "Tu es un expert en rédaction académique française, spécialisé dans les rapports de fin d'études des universités marocaines. Écris toujours en français académique formel et soutenu. Structure avec chapitres numérotés H2/H3. Citations format APA. Minimum 800 mots par partie générée. Jamais de contenu générique — chaque phrase spécifique au thème fourni. Commence directement par le contenu sans introduction.";

interface GenerateBody {
  section: string;
  theme?: string;
  school?: string;
  filiere?: string;
  problematique?: string;
  motsCles?: string[];
  citationStyle?: string;
  extraContext?: string;
}

function buildPrompt(ctx: GenerateBody): string {
  const theme = ctx.theme ?? "Sujet non précisé";
  const school = ctx.school ?? "l'école";
  const filiere = ctx.filiere ?? "gestion";
  const prob = ctx.problematique ?? "À définir selon le thème";
  const kw = ctx.motsCles?.join(", ") ?? "";
  const style = ctx.citationStyle ?? "APA 7th ed.";

  switch (ctx.section) {
    case "partie-i":
      return `Rédige la Partie I d'un rapport de fin d'études intitulé "${theme}" pour un étudiant de ${school} en ${filiere}.

La Partie I doit couvrir :
## Chapitre 1 — Cadre théorique et revue de littérature
### 1.1 Fondements théoriques
### 1.2 Revue de la littérature internationale
### 1.3 Contexte marocain et spécificités du marché
## Chapitre 2 — Méthodologie de recherche
### 2.1 Approche et design de recherche
### 2.2 Collecte et traitement des données
### 2.3 Modèle et outils d'analyse

Problématique : ${prob}
Mots-clés : ${kw}
Style de citation : ${style}

Rédige minimum 1000 mots, avec des citations académiques fictives mais plausibles au format ${style}. Insère des placeholders pour les figures : [INSÉRER FIGURE N — Titre].`;

    case "partie-ii":
      return `Rédige la Partie II d'un rapport de fin d'études intitulé "${theme}" pour un étudiant de ${school} en ${filiere}.

La Partie II doit couvrir :
## Chapitre 3 — Présentation et analyse des résultats
### 3.1 Statistiques descriptives et présentation des données
### 3.2 Résultats de l'analyse principale
### 3.3 Interprétation des résultats
## Chapitre 4 — Discussion et recommandations
### 4.1 Discussion des résultats
### 4.2 Implications théoriques et pratiques
### 4.3 Recommandations opérationnelles

Problématique : ${prob}
Mots-clés : ${kw}
Style de citation : ${style}

Insère des placeholders pour les figures : [INSÉRER FIGURE N — Titre descriptif]. Rédige minimum 1000 mots avec des analyses chiffrées fictives mais cohérentes.`;

    case "introduction":
      return `Rédige l'Introduction Générale d'un rapport de fin d'études intitulé "${theme}" pour un étudiant de ${school} en ${filiere}.

Structure requise :
## Introduction Générale
### Contexte général
### Problématique
### Objectifs de recherche
### Structure du rapport

Problématique : ${prob}
Mots-clés : ${kw}

Rédige 400-600 mots en français académique soutenu. Pose clairement la problématique et justifie la pertinence du sujet dans le contexte marocain.`;

    case "conclusion":
      return `Rédige la Conclusion Générale d'un rapport de fin d'études intitulé "${theme}" pour un étudiant de ${school} en ${filiere}.

Structure requise :
## Conclusion Générale
### Synthèse des résultats
### Apports et contributions
### Limites de l'étude
### Perspectives futures

Problématique : ${prob}

Rédige 400-600 mots. Résume les apports théoriques et pratiques, puis propose des perspectives de recherche futures en lien avec le contexte marocain.`;

    case "resume":
      return `Rédige un Résumé académique en français de 250-300 mots pour un rapport intitulé "${theme}" (${school} — ${filiere}).

Format : Contexte → Objectifs → Méthodologie → Résultats → Conclusion.
Problématique : ${prob}
Ne dépasse pas 300 mots. Termine par : Mots-clés : ${kw || "À définir"}`;

    case "dedicaces":
      return `Rédige une page de Dédicaces sobre et élégante pour un rapport de fin d'études marocain intitulé "${theme}".
La dédicace doit être sobre, sincère et académiquement appropriée. Utilise une mise en forme poétique. 3-5 lignes maximum.`;

    case "remerciements":
      return `Rédige une page de Remerciements formelle pour un rapport de fin d'études intitulé "${theme}" d'un étudiant de ${school} en ${filiere}.
Remercie : encadrant pédagogique, encadrant professionnel, jury, direction de l'école. Ton formel. 150-200 mots.`;

    default:
      return `Génère du contenu académique formel de 250-400 mots pour un rapport de fin d'études sur le thème "${theme}" (${school} — ${filiere}).
Contexte : ${ctx.extraContext ?? "Non précisé"}`;
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
      system: SYSTEM_PROMPT,
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
