import { Router, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

interface HumanizeBody {
  content: string;
  theme?: string;
  reportType?: string;
  school?: string;
  filiere?: string;
}

router.post("/humanize", async (req: Request, res: Response) => {
  const { content, theme, reportType, school, filiere } = req.body as HumanizeBody;

  if (!content || !content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const type    = reportType ?? "rapport académique";
  const subject = theme     ?? "le sujet du rapport";
  const ecole   = school    ?? "l'école";
  const fil     = filiere   ?? "la filière";

  const systemPrompt = `Tu es un expert en rédaction académique marocaine. Ta mission : réécrire un texte généré par IA pour le rendre INDÉTECTABLE par les outils anti-IA (GPTZero, Turnitin AI Detection, Copyleaks).

Techniques obligatoires à appliquer :
1. VARIER les longueurs de phrases — alterner phrases courtes (8-12 mots) et longues (25-35 mots)
2. INTRODUIRE des connecteurs logiques variés et moins prévisibles (certes, néanmoins, force est de constater, il convient de souligner, à cet égard)
3. REFORMULER les transitions — éviter les formules IA typiques ("Il est important de noter", "En conclusion", "Dans ce contexte")
4. AJOUTER des nuances stylistiques humaines — doutes mesurés, qualifications, références implicites au terrain marocain
5. VARIER la structure des paragraphes — ne pas toujours commencer par le sujet grammatical
6. CONSERVER le sens académique complet, la structure Markdown (##, ###, listes), et toutes les références/citations
7. RÉDIGER en français académique soutenu, registre universitaire marocain
8. NE PAS ajouter de contenu nouveau — seulement reformuler l'existant

Contexte : ${type} sur "${subject}" pour ${ecole} — ${fil}.

Retourne UNIQUEMENT le texte humanisé en Markdown — aucun préambule ni commentaire.`;

  const userPrompt = `Humanise ce texte pour le rendre indétectable par les outils anti-IA tout en conservant sa qualité académique :

${content}`;

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
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
