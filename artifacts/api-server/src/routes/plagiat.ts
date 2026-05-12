import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync } from "fs";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";

const router = Router();
const SESSIONS_ROOT = "/tmp/rapportai-sessions";

interface PlagiatBody {
  content: string;
  sessionId?: string;
  theme?: string;
  reportType?: string;
  school?: string;
  filiere?: string;
}

router.post("/plagiat", async (req: Request, res: Response) => {
  const { content, sessionId, theme, reportType, school, filiere } = req.body as PlagiatBody;

  if (!content || !content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const claudeBinary = findClaudeBinary();
  const type    = reportType ?? "rapport académique";
  const subject = theme      ?? "le sujet du rapport";
  const ecole   = school     ?? "l'école";
  const fil     = filiere    ?? "la filière";

  const sessionDir = sessionId ? path.join(SESSIONS_ROOT, sessionId) : null;
  const workDir    = sessionDir && existsSync(sessionDir) ? sessionDir : undefined;

  const systemPrompt = `Tu es un expert anti-plagiat pour rapports académiques marocains. Ta mission : réécrire le texte fourni pour réduire son taux de similarité avec des sources existantes tout en préservant rigoureusement le contenu académique.

OBJECTIF : Passer sous 15% de similarité sur Turnitin, iThenticate, et Compilatio.

Techniques obligatoires :
1. PARAPHRASER en profondeur — reformuler chaque phrase avec une structure syntaxique différente
2. SYNONYMES PRÉCIS — remplacer les termes clés par des équivalents académiques exacts (jamais de synonymes approximatifs)
3. RESTRUCTURER les paragraphes — changer l'ordre des idées tout en maintenant la logique argumentative
4. VOIX ACTIVE/PASSIVE — alterner les constructions grammaticales
5. NOMINALISATION — transformer les verbes en constructions nominales et vice versa
6. ANCRAGE CONTEXTUEL — intégrer des références au contexte marocain et francophone quand pertinent
7. SYNTHÈSE ORIGINALE — fusionner plusieurs phrases sources en une reformulation plus synthétique

Règles absolues :
- CONSERVER le sens académique exact — zéro perte d'information
- CONSERVER toutes les citations (entre guillemets ou en note) — ne jamais reformuler les citations directes
- CONSERVER les chiffres, statistiques, dates, noms propres exactement
- CONSERVER la structure Markdown (titres, listes, tableaux)
- NE PAS ajouter de nouvelles idées ou affirmations
- NE PAS supprimer d'arguments

Contexte : ${type} sur "${subject}" pour ${ecole} — ${fil}.
Retourne UNIQUEMENT le texte reformulé en Markdown, sans commentaires ni explications.`;

  try {
    for await (const message of query({
      prompt: `Reformule ce texte pour réduire le taux de similarité sous 15% sur Turnitin tout en préservant le sens académique exact :\n\n${content}`,
      options: {
        systemPrompt,
        maxTurns: 1,
        ...(workDir ? { cwd: workDir, allowedTools: ["Read"] } : { allowedTools: [] }),
        ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text" && block.text) {
            res.write(`data: ${JSON.stringify({ content: block.text })}\n\n`);
          }
        }
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
