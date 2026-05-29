import { Sandbox } from "@vercel/sandbox";
import type { StreamEvent } from "./agent-session";
import type { ReportProfile } from "./sdk-agent";

// Inlined runner script — executes inside the Vercel Sandbox microVM
const RUNNER_SCRIPT = `
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync } from "fs";

const input = JSON.parse(readFileSync("/work/input.json", "utf-8"));
const { prompt, systemPrompt, maxTurns = 25, cwd = "/work" } = input;

process.chdir(cwd);

for await (const message of query({
  prompt,
  options: {
    maxTurns,
    cwd,
    systemPrompt,
    permissionMode: "acceptEdits",
    allowedTools: ["Read", "Write", "Edit", "WebFetch", "Glob", "Bash"],
  },
})) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text" && block.text) {
        process.stdout.write(JSON.stringify({ type: "text", content: block.text }) + "\\n");
      }
      if (block.type === "tool_use") {
        process.stdout.write(JSON.stringify({ type: "tool_call", name: block.name }) + "\\n");
      }
    }
  }
  if (message.type === "result") {
    process.stdout.write(JSON.stringify({ type: "done", subtype: message.subtype }) + "\\n");
  }
}
`;

const SECTION_IDS = [
  "dedicaces", "remerciements", "resume",
  "introduction", "partie-i", "partie-ii", "conclusion",
];

// ─── SandboxSession ───────────────────────────────────────────────────────────

export class SandboxSession {
  readonly id: string;
  readonly profile: ReportProfile;
  readonly createdAt: Date;
  lastActiveAt: Date;

  private sandbox: Sandbox | null = null;
  private sections: Record<string, string> = {};
  private uploadedDocs: Record<string, string> = {};

  constructor(sessionId: string, profile: ReportProfile) {
    this.id = sessionId;
    this.profile = profile;
    this.createdAt = new Date();
    this.lastActiveAt = new Date();
  }

  loadSections(sections: Record<string, string>): void {
    this.sections = { ...sections };
  }

  uploadDocument(filename: string, text: string): void {
    this.uploadedDocs[filename] = text;
  }

  getDocumentNames(): string[] {
    return Object.keys(this.uploadedDocs);
  }

  getSections(): Record<string, string> {
    return { ...this.sections };
  }

  getSection(id: string): string | undefined {
    return this.sections[id];
  }

  // ── Stream a task inside an isolated Vercel Sandbox ─────────────────────────

  async *stream(prompt: string): AsyncGenerator<StreamEvent> {
    this.lastActiveAt = new Date();

    // Create a fresh microVM for this task
    const sandbox = await Sandbox.create({ runtime: "node24" });
    this.sandbox = sandbox;

    try {
      // 1. Set up working directory
      await sandbox.runCommand({ cmd: "mkdir", args: ["-p", "/work"] });

      // 2. Write the runner script
      await sandbox.fs.writeFile("/work/agent-runner.mjs", RUNNER_SCRIPT);

      // 3. Write profile + instructions
      await sandbox.fs.writeFile("/work/profile.json", JSON.stringify(this.profile, null, 2));
      await sandbox.fs.writeFile("/work/INSTRUCTIONS.md", buildInstructions(this.profile));

      // 4. Write any already-written sections
      for (const [id, content] of Object.entries(this.sections)) {
        if (content) await sandbox.fs.writeFile(`/work/${id}.md`, content);
      }

      // 5. Write uploaded documents
      for (const [filename, text] of Object.entries(this.uploadedDocs)) {
        await sandbox.fs.writeFile(`/work/${filename}`, text);
      }

      // 6. Install Agent SDK inside the sandbox
      yield { type: "tool_call", name: "installing_sdk" };
      await sandbox.runCommand({
        cmd: "npm",
        args: ["install", "--prefix", "/work", "@anthropic-ai/claude-agent-sdk"],
      });

      // 7. Write runner script + input, then execute
      await sandbox.fs.writeFile("/work/runner.mjs", RUNNER_SCRIPT);
      await sandbox.fs.writeFile("/work/input.json", JSON.stringify({
        prompt,
        systemPrompt: buildSystemPrompt(this.profile),
        maxTurns: 25,
        cwd: "/work",
      }));

      const runCmd = await sandbox.runCommand({
        cmd: "node",
        args: ["/work/runner.mjs"],
        cwd: "/work",
        env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "" },
        detached: true,
      });

      // Stream output lines as SSE events
      for await (const log of runCmd.logs()) {
        if (log.source === "stdout" && log.message) {
          try {
            const msg = JSON.parse(log.message) as {
              type: string; content?: string; name?: string; subtype?: string;
            };
            if (msg.type === "text" && msg.content) {
              yield { type: "text", content: msg.content };
            }
            if (msg.type === "tool_call" && msg.name) {
              yield { type: "tool_call", name: msg.name };
            }
            if (msg.type === "done") break;
          } catch { /* skip non-JSON lines */ }
        }
      }

      await runCmd.wait();

      // 8. Read written sections back from sandbox filesystem
      for (const id of SECTION_IDS) {
        try {
          const exists = await sandbox.fs.exists(`/work/${id}.md`);
          if (exists) {
            const content = await sandbox.fs.readFile(`/work/${id}.md`);
            this.sections[id] = content.toString();
          }
        } catch { /* section not written yet */ }
      }

    } finally {
      await sandbox.stop();
      this.sandbox = null;
    }
  }

  abort(): void {
    this.sandbox?.stop().catch(() => {});
    this.sandbox = null;
  }

  buildSectionTask(section: string): string {
    return buildSectionTask(section, this.profile);
  }

  buildRevisionTask(sectionId: string, instruction: string): string {
    return `Lis ${sectionId}.md.\nInstruction: ${instruction}\nModifications chirurgicales uniquement. Sauvegarde dans ${sectionId}.md.`;
  }
}

// ─── Helpers (same as sdk-agent.ts) ──────────────────────────────────────────

function buildSystemPrompt(p: ReportProfile): string {
  return `Tu es l'agent de rédaction académique de RapportAI pour ${p.studentName}.
Travaille dans /work. Lis INSTRUCTIONS.md et profile.json d'abord.
Sections : Read pour lire, Write pour sauvegarder (ex: partie-i.md).
Citations réelles via WebFetch sur Semantic Scholar. Français académique formel.
Style: ${p.citationStyle ?? "APA 7th ed."}
Étudiant: ${p.studentName} | École: ${p.school} | Filière: ${p.filiere}
Type: ${p.reportType} | Thème: "${p.theme}"`;
}

function buildInstructions(p: ReportProfile): string {
  return `# RapportAI : ${p.studentName}
Thème: ${p.theme}
École: ${p.school}, ${p.filiere}, ${p.annee ?? "2024–2025"}
Type: ${p.reportType}
${p.problematique ? `Problématique: ${p.problematique}` : ""}
${p.encadrantPeda ? `Encadrant péda: ${p.encadrantPeda}` : ""}
${p.encadrantPro ? `Encadrant pro: ${p.encadrantPro}` : ""}
${p.entreprise ? `Entreprise: ${p.entreprise}` : ""}

Sections à rédiger (ordre):
1. dedicaces.md  2. remerciements.md  3. resume.md
4. introduction.md  5. partie-i.md  6. partie-ii.md  7. conclusion.md

Standard: 2500+ mots par partie, citations réelles, ${p.citationStyle ?? "APA 7th ed."}`;
}

function buildSectionTask(section: string, p: ReportProfile): string {
  const prob = p.problematique ?? `Dans quelle mesure "${p.theme}" peut-il être approfondi ?`;
  const style = p.citationStyle ?? "APA 7th ed.";

  switch (section) {
    case "partie-i":
      return `Lis INSTRUCTIONS.md, profile.json et les sections existantes.
Utilise WebFetch sur https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(p.theme)}&limit=8&fields=title,authors,year,externalIds,abstract pour trouver des sources réelles.
Rédige Partie I (2500+ mots, 8 sous-sections, ## et ###).
Problématique: ${prob} | Style: ${style}
Sauvegarde dans partie-i.md.`;

    case "partie-ii":
      return `Lis partie-i.md (obligatoire), INSTRUCTIONS.md.
Rédige Partie II (2500+ mots, 8 sous-sections, références croisées vers Partie I).
Problématique: ${prob} | Style: ${style}
Sauvegarde dans partie-ii.md.`;

    case "introduction":
      return `Lis toutes les sections existantes.
Rédige Introduction Générale (400–600 mots): Contexte → Problématique → Objectifs → Structure.
Problématique: ${prob}
Sauvegarde dans introduction.md.`;

    case "conclusion":
      return `Lis introduction.md, partie-i.md, partie-ii.md.
Rédige Conclusion Générale (400–600 mots): Synthèse → Apports → Limites → Perspectives.
Sauvegarde dans conclusion.md.`;

    case "resume":
      return `Rédige Résumé (250–300 mots) + mots-clés. Sauvegarde dans resume.md.`;

    case "dedicaces":
      return `Rédige Dédicaces (10–15 lignes, style sobre). Sauvegarde dans dedicaces.md.`;

    case "remerciements":
      return `Lis profile.json. Rédige Remerciements (150–200 mots, ton formel).
Mentionne encadrants, école, famille. Sauvegarde dans remerciements.md.`;

    default:
      return `Rédige la section "${section}". Sauvegarde dans ${section}.md.`;
  }
}
