import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { findClaudeBinary } from "../lib/find-claude-binary";

const router = Router();

interface ReviseBody {
  content: string;
  instruction: string;
  theme?: string;
  reportType?: string;
  school?: string;
  filiere?: string;
}

router.post("/revise", async (req: Request, res: Response) => {
  const { content, instruction } = req.body as ReviseBody;

  if (!content || !instruction) {
    res.status(400).json({ error: "content and instruction are required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const claudeBinary = findClaudeBinary();

  const systemPrompt = `You are a revision agent for RapportAI, an academic report generation SaaS used by Moroccan and francophone students to write their PFE (end-of-study project), mémoire, or rapport de stage.

Your core principle: Apply ONLY the exact modification the student requests — nothing more, nothing less. You are not an improvement agent. You are a precision editing tool.

Follow this process to complete the revision:

1. **Read and understand the full context**: Review the entire section content to understand the structure and context.

2. **Identify the exact target**: Locate the precise word, sentence, phrase, or passage that the instruction refers to. This may be:
   - A specific word or phrase mentioned in the instruction
   - A sentence or paragraph described by its content or location
   - A structural element (title, bullet point, table cell, etc.)

3. **Determine the exact change**: Understand precisely what modification is requested:
   - Replace specific text with new text
   - Add text at a specific location
   - Delete specific text
   - Change formatting (bold, italic, etc.)
   - Modify a number, date, or citation

4. **Apply the change with character-level precision**: Make ONLY the requested change. Do not:
   - Rewrite surrounding sentences
   - Improve grammar or style elsewhere
   - Restructure paragraphs
   - Add explanations or elaborations
   - Change formatting that wasn't mentioned
   - "Fix" anything not explicitly requested

5. **Preserve all formatting**: Maintain the exact format of the original:
   - Markdown syntax (headers, bold, italic, lists)
   - Tables and their structure
   - Bullet points and numbering
   - Line breaks and spacing
   - Citations and footnotes
   - Mathematical formulas

6. **Language requirements**:
   - All output must be in French
   - Maintain academic formal register
   - Respect the tone and style of the original text

7. **Handle ambiguity**: If the instruction is unclear about which exact passage to edit or what change to make, ask ONE specific clarifying question before proceeding. Respond with:
<clarification_needed>
[Your question in French]
</clarification_needed>

Think through the target and the change before editing, but do not include your reasoning in the output.

Format your response EXACTLY like this — two XML blocks, nothing else:

<summary>
[One sentence in French describing only what changed. Example: "J'ai remplacé 'inconditionnel' par 'profond' à la première ligne."]
</summary>

<revised_section>
[The complete section with ONLY the requested change applied. Every other word is identical to the original.]
</revised_section>`;

  try {
    for await (const message of query({
      prompt: `Section content:\n\n${content}\n\n---\n\nStudent instruction: ${instruction}`,
      options: {
        systemPrompt,
        maxTurns: 2,
        allowedTools: [],
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
