import { Router, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

interface JuryMessage {
  role: "user" | "jury";
  content: string;
}

interface JuryBody {
  messages: JuryMessage[];
  reportContext: {
    theme?: string;
    school?: string;
    filiere?: string;
    reportType?: string;
    studentName?: string;
    resume?: string;
    introduction?: string;
    partieI?: string;
    partieII?: string;
    conclusion?: string;
    encadrantPeda?: string;
  };
}

function snippet(text: string | undefined, maxChars = 600): string {
  if (!text) return "";
  return text.length > maxChars ? text.slice(0, maxChars) + "…" : text;
}

function buildJurySystem(ctx: JuryBody["reportContext"]): string {
  const name    = ctx.studentName  ?? "l'étudiant(e)";
  const school  = ctx.school       ?? "l'école";
  const filiere = ctx.filiere      ?? "la filière";
  const type    = ctx.reportType   ?? "rapport de fin d'études";
  const theme   = ctx.theme        ?? "le thème fourni";

  const sectionSnippets = [
    ctx.resume       ? `RÉSUMÉ:\n${snippet(ctx.resume)}`       : "",
    ctx.introduction ? `INTRODUCTION:\n${snippet(ctx.introduction)}` : "",
    ctx.partieI      ? `PARTIE I (extrait):\n${snippet(ctx.partieI)}`  : "",
    ctx.partieII     ? `PARTIE II (extrait):\n${snippet(ctx.partieII)}`  : "",
    ctx.conclusion   ? `CONCLUSION:\n${snippet(ctx.conclusion)}`   : "",
  ].filter(Boolean).join("\n\n");

  return `Tu simules un jury de soutenance académique marocain évaluant le ${type} de ${name} intitulé "${theme}" à ${school} (filière : ${filiere}).

Le jury est composé de trois membres. Chaque réponse doit OBLIGATOIREMENT commencer par le nom du membre entre doubles astérisques, par exemple : **Pr. Hassan Benali :** 

Membres du jury :
- **Pr. Hassan Benali** — Président du Jury, Professeur des Universités, spécialiste en ${filiere}. Ton : formel et exigeant. S'intéresse aux fondements théoriques et à la rigueur académique.
- **Dr. Fatima Zahra Alaoui** — Membre du Jury, Professeur Associée, experte en méthodologie de recherche. Ton : analytique. S'intéresse à la méthodologie, aux données et à la cohérence du raisonnement.
- **M. Youssef El Mansouri** — Expert Invité Professionnel, Directeur en entreprise. Ton : pragmatique. S'intéresse aux applications pratiques, aux recommandations opérationnelles et à la valeur ajoutée pour le secteur.

${sectionSnippets ? `=== CONTENU DU RAPPORT ÉVALUÉ ===\n${sectionSnippets}` : ""}

Règles de simulation :
1. Pose UNE seule question par intervention (2 à 4 phrases max).
2. Alterne entre les trois membres — ne répète pas deux fois de suite le même membre.
3. Commence toujours par **Nom du membre :** sur la même ligne.
4. Les questions doivent être spécifiques au contenu du rapport fourni, pas génériques.
5. Si l'étudiant répond bien, approfondir avec une question de suivi. Si la réponse est insuffisante, demander de préciser.
6. Sois rigoureux mais encourageant — le but est de préparer l'étudiant, pas de le déstabiliser.
7. Après 8 échanges, propose une évaluation synthétique de la prestation.
8. Ne génère jamais plus d'une question par tour.`;
}

router.post("/jury", async (req: Request, res: Response) => {
  const body = req.body as JuryBody;

  if (!body.reportContext) {
    res.status(400).json({ error: "reportContext is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Convert conversation history to Claude format
  const claudeMessages: Array<{ role: "user" | "assistant"; content: string }> =
    (body.messages ?? []).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

  // If no messages yet, start with the jury opening
  if (claudeMessages.length === 0) {
    claudeMessages.push({
      role: "user",
      content: `La séance de soutenance commence. L'étudiant(e) vient de présenter son rapport. Commence par l'accueil officiel (Pr. Hassan Benali), puis pose la première question.`,
    });
  }

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: buildJurySystem(body.reportContext),
      messages: claudeMessages,
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
