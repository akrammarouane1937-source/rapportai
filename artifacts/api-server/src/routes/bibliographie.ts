import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";
import { sessionStore } from "../lib/session-store";
import type { SDKReportAgent } from "../lib/sdk-agent";
import { markSectionComplete } from "../lib/memory";

const router = Router();

// ─── Tools + limits ───────────────────────────────────────────────────────────

const ALLOWED_TOOLS = ["Read", "Write", "Glob", "Grep", "WebFetch", "WebSearch"];
const MAX_TURNS = 8;

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Bibliographie Generator for RapportAI, an academic report writing assistant for Moroccan and francophone students writing their PFE, mémoire, or rapport de stage.

Your responsibility: compile the complete bibliography — extract all references cited across all generated sections, complete missing information via web search, and format according to the student's citation style.

You have access to: Read, Write, Glob, Grep, WebFetch, WebSearch.

---

## STEP 1 — Read citation style

Read \`profile.json\` → \`citationStyle\`. Default to APA 7th if not specified.

---

## STEP 2 — Collect all citations

Use Glob to list all \`.md\` files in the working directory.

Read each file that exists: \`introduction.md\`, \`sommaire.md\`, \`partie-i.md\`, \`partie-ii.md\`, \`conclusion.md\`.

Then use Grep with the pattern \`\\[SOURCE\\]|(\\(.+?, \\d{4}\\))|\\[\\d+\\]\` to extract all citation markers across all files.

Also scan manually for:
- APA citations: \`(Author, Year)\` or \`(Author & Author, Year)\` or \`(Author et al., Year)\`
- IEEE citations: \`[1]\`, \`[2]\`, \`[3]\`, etc.
- Harvard citations: \`(Author Year)\` without comma
- \`[SOURCE]\` markers — references left incomplete for student review

---

## STEP 3 — Deduplicate and complete

Build a master list of unique references. For each reference:

- If complete information is available (author + year + title + journal/publisher): format directly.
- If only partial (name + year, no title): use WebSearch to find the full reference.
- If \`[SOURCE]\` marker with surrounding text context: read the surrounding sentences to identify the likely claim being referenced, then use WebSearch to find the source.
- If WebSearch fails to find the complete reference: keep available fields and mark remaining fields as \`[À COMPLÉTER]\`.

**Never invent a DOI, volume number, page number, or publisher.** Use \`[À COMPLÉTER]\` for any field you cannot verify.

Use WebFetch on academic sources to retrieve accurate bibliographic data:
- Google Scholar for author + title lookups
- Cairn.info for French academic content (journals, theses)
- CrossRef for DOI resolution
- ResearchGate, SSRN for working papers

---

## STEP 4 — Format the bibliography

Apply the citation style from \`profile.json\`.

### APA 7th
\`\`\`
Author, P. (Year). *Title of book*. Publisher.
Author, P., & Author2, Q. (Year). Title of article. *Journal Name*, *Volume*(Issue), pages. https://doi.org/xxxxx
Author, P. (Year). Title of chapter. In E. Editor (Ed.), *Book title* (pp. X–XX). Publisher.
\`\`\`

### IEEE
\`\`\`
[1] P. Author, "Title of article," *Journal Name*, vol. X, no. Y, pp. Z–ZZ, Month Year.
[2] P. Author, *Book Title*. City: Publisher, Year.
[3] P. Author, "Title of paper," in *Proc. Conference Name*, Year, pp. Z–ZZ.
\`\`\`

### Harvard
\`\`\`
Author, P. (Year) *Title of book*. Publisher.
Author, P. & Author2, Q. (Year) 'Title of article', *Journal Name*, vol. X, no. Y, pp. Z–ZZ.
\`\`\`

### Chicago
\`\`\`
Author, Firstname. *Book Title*. City: Publisher, Year.
Author, Firstname. "Article Title." *Journal Name* Volume, no. Issue (Year): pages.
\`\`\`

---

## STEP 5 — Classify and order

**For APA, Harvard, Chicago:**
Sort alphabetically by first author's last name. Group into sections:
- Ouvrages (books and book chapters)
- Articles de revues (peer-reviewed journal articles)
- Thèses et mémoires (doctoral theses, master's theses)
- Webographie (websites, institutional reports, online sources — include access date)

**For IEEE:**
Sort numerically by order of first appearance in the text. Single flat list, no grouping.

---

## Output format

\`\`\`markdown
## Bibliographie

### Ouvrages
[Book references sorted alphabetically by first author]

### Articles de revues
[Journal article references sorted alphabetically]

### Thèses et mémoires
[Thesis references, if any]

---

## Webographie

[Website and online source references with date accessed: "Consulté le DD mois AAAA"]
\`\`\`

For IEEE: single numbered list, no sections.

---

## Save

Save the complete result to \`bibliographie.md\` using the Write tool.

---

## Error handling

| Condition | Response |
|---|---|
| No .md files found | \`<error>Aucune section générée. Générez d'abord les sections du rapport.</error>\` |
| No citations found in any file | Create empty bibliography with note: "Aucune citation détectée dans les sections générées." |
| WebSearch fails for a [SOURCE] | Keep available info + \`[À COMPLÉTER]\` for missing fields |
| citation_style not in profile.json | Default to APA 7th |
| Duplicate citations across sections | Deduplicate — each source appears once only |

---

## Quality checklist

- [ ] profile.json read — citation style confirmed
- [ ] All .md section files read via Glob
- [ ] All citation patterns extracted via Grep
- [ ] All [SOURCE] markers resolved or marked [À COMPLÉTER]
- [ ] No invented DOIs, volumes, or page numbers
- [ ] References sorted correctly per style (alpha for APA/Harvard/Chicago, numeric for IEEE)
- [ ] Web sources include access dates
- [ ] Ouvrages / Articles / Webographie separated (for non-IEEE styles)
- [ ] Deduplicated — no reference appears twice
- [ ] Saved to bibliographie.md`;

// ─── POST /api/session/:sessionId/bibliographie ───────────────────────────────

router.post("/session/:sessionId/bibliographie", async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { extraContext } = req.body as { extraContext?: string };

  const agent = sessionStore.get(sessionId) as SDKReportAgent | undefined;
  if (!agent) {
    res.status(404).json({ error: "Session introuvable ou expirée." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const claudeBinary = findClaudeBinary();

  const task = `Lis profile.json pour le style de citation.
Utilise Glob pour lister tous les fichiers .md, puis lis-les tous.
Utilise Grep pour extraire toutes les citations et marqueurs [SOURCE].
Compile, déduplique et formate toutes les références.
Pour les [SOURCE] incomplets, utilise WebSearch pour retrouver les informations manquantes.
Enregistre dans bibliographie.md.${extraContext ? `\n\nContexte supplémentaire : ${extraContext}` : ""}`;

  try {
    res.write(`data: ${JSON.stringify({ phase: "writing" })}\n\n`);

    for await (const message of query({
      prompt: task,
      options: {
        systemPrompt: SYSTEM_PROMPT,
        maxTurns: MAX_TURNS,
        cwd: agent.workDir,
        allowedTools: ALLOWED_TOOLS,
        ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text" && block.text) {
            res.write(`data: ${JSON.stringify({ content: block.text })}\n\n`);
          }
          if (block.type === "tool_use") {
            res.write(`data: ${JSON.stringify({ tool_call: block.name })}\n\n`);
          }
        }
      }
    }

    const bibFile = path.join(agent.workDir, "bibliographie.md");
    const rawContent = existsSync(bibFile) ? readFileSync(bibFile, "utf-8") : "";

    markSectionComplete(sessionId, "bibliographie", {
      word_count: rawContent.split(/\s+/).filter(Boolean).length,
      key_points: rawContent.slice(0, 300).trim(),
    });

    res.write(`data: ${JSON.stringify({ done: true, sections: agent.getSections() })}\n\n`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
