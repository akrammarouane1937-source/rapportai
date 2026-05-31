import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard } from "@/components/chat-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import type { Report } from "@/lib/store";
import { API_BASE } from "@/lib/apiBase";
import { Check } from "lucide-react";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Phase = "theme" | "school" | "filiere" | "type" | "annee" | "color" | "done";
type Msg = { role: "agent" | "user"; content: string | React.ReactNode };

const TYPE_OPTIONS: Array<{ label: string; value: "PFE" | "stage" | "memoire" }> = [
  { label: "PFE", value: "PFE" },
  { label: "Stage", value: "stage" },
  { label: "Mémoire", value: "memoire" },
];

const COLOR_OPTIONS: Array<{ label: string; value: string; hex: string }> = [
  { label: "Bleu marine", value: "bleu marine (#1e3a5f)", hex: "#1e3a5f" },
  { label: "Bordeaux", value: "bordeaux (#8b1a2e)", hex: "#8b1a2e" },
  { label: "Vert foncé", value: "vert foncé (#1a4a2e)", hex: "#1a4a2e" },
  { label: "Gris anthracite", value: "gris anthracite (#2d3748)", hex: "#2d3748" },
  { label: "Doré", value: "doré (#7b5c2a)", hex: "#7b5c2a" },
];

const SKIP_PHRASES = ["passer", "skip", "peu importe", "je sais pas", "sais pas", "laisse tomber", "aucune", "non", "pas de", "rien"];
const isSkip = (text: string) => SKIP_PHRASES.some((p) => text.toLowerCase().includes(p));

// Phrases that mean "hang on" — should NOT be stored as answers
const WAIT_PHRASES = [
  "attends", "attend", "attendez", "attends un peu", "wait", "une seconde",
  "1 sec", "2 sec", "une min", "minute", "hold on", "patienter", "pas maintenant",
];
const isWait = (text: string) => {
  const t = text.trim().toLowerCase();
  return WAIT_PHRASES.some((p) => t === p || t.startsWith(p + " ") || t.startsWith(p + "…") || t.startsWith(p + "."));
};

const QUESTION_STARTERS = [
  "pourquoi", "c'est quoi", "c quoi", "comment", "est-ce", "est ce", "peux-tu",
  "peux tu", "tu peux", "à quoi", "pour quoi", "quel", "quelle", "quels",
  "why", "what", "how",
];
const isQuestion = (text: string, phase: Phase) => {
  const t = text.trim().toLowerCase();
  if (t.endsWith("?")) return true;
  if (phase === "theme") return false;
  return QUESTION_STARTERS.some((q) => t === q || t.startsWith(q + " "));
};

const toApiMsgs = (list: Msg[]) =>
  list
    .filter((m) => typeof m.content === "string" && (m.content as string).trim())
    .map((m) => ({ role: m.role === "agent" ? "assistant" : "user", content: m.content as string }));

const schoolReaction = (school: string): string => {
  const s = school.toUpperCase();
  if (s.includes("EMSI")) return `EMSI, super. Et ta filière ?`;
  if (s.includes("ENCG")) return `ENCG, parfait. Et ta filière ?`;
  if (s.includes("ENSA")) return `ENSA, ok. Et ta filière ?`;
  if (s.includes("ENSIAS")) return `ENSIAS, bonne école. Et ta filière ?`;
  if (s.includes("UIR")) return `UIR, top. Et ta filière ?`;
  if (s.includes("ISCAE")) return `ISCAE, nickel. Et ta filière ?`;
  if (s.includes("HEM")) return `HEM, classe. Et ta filière ?`;
  return `${school}, ok. Et ta filière ?`;
};

const filiereReaction = (filiere: string): string => {
  const f = filiere.toLowerCase();
  if (f.includes("finance") || f.includes("compta")) return `Finance — bon choix. Quel type de rapport ?`;
  if (f.includes("info") || f.includes("dev") || f.includes("génie")) return `Génie info, parfait. Quel type de rapport ?`;
  if (f.includes("market")) return `Marketing — intéressant. Quel type de rapport ?`;
  if (f.includes("manage")) return `Management, ok. Quel type de rapport ?`;
  return `${filiere}, noté. Quel type de rapport ?`;
};

// ─── Phase ordering & skip logic ─────────────────────────────────────────────

const PHASE_ORDER: Phase[] = ["theme", "school", "filiere", "type", "annee", "color", "done"];

/** Returns the next phase that still needs to be collected, skipping known fields. */
function nextUncollectedPhase(after: Phase, snapshot: Partial<Report>): Phase {
  const idx = PHASE_ORDER.indexOf(after);
  for (let i = idx + 1; i < PHASE_ORDER.length; i++) {
    const p = PHASE_ORDER[i];
    if (p === "done") return "done";
    if (p === "school"  && !snapshot.school)       return "school";
    if (p === "school"  && snapshot.school)        continue;
    if (p === "filiere" && !snapshot.filiere)      return "filiere";
    if (p === "filiere" && snapshot.filiere)       continue;
    if (p === "type"    && !snapshot.reportType)   return "type";
    if (p === "type"    && snapshot.reportType)    continue;
    if (p === "annee"   && !snapshot.academicYear) return "annee";
    if (p === "annee"   && snapshot.academicYear)  continue;
    if (p === "color"   && !snapshot.reportColor)  return "color";
    if (p === "color"   && snapshot.reportColor)   continue;
  }
  return "done";
}

/** Initial phase: first field that is not yet collected. */
function getInitialPhase(report: Partial<Report>, restoredPhase?: Phase): Phase {
  // Restored session that was already past "theme" → trust the saved phase
  if (restoredPhase && restoredPhase !== "theme") return restoredPhase;
  if (!report.theme)       return "theme";
  if (!report.school)      return "school";
  if (!report.filiere)     return "filiere";
  if (!report.reportType)  return "type";
  if (!report.academicYear) return "annee";
  if (!report.reportColor)  return "color";
  return "done";
}

/** Opening message that acknowledges already-known info and asks for the first missing field. */
function buildOpeningMessage(phase: Phase, report: Partial<Report>): string {
  if (phase === "theme") {
    return "Bienvenue sur RapportAI. On va construire ton rapport ensemble, étape par étape. Commence par le thème : c'est quoi ton sujet ?";
  }

  const known: string[] = [];
  if (report.theme)      known.push(`thème : "${report.theme}"`);
  if (report.school)     known.push(`école : ${report.school}`);
  if (report.filiere)    known.push(`filière : ${report.filiere}`);
  if (report.reportType) known.push(`type : ${report.reportType.toUpperCase()}`);
  if (report.academicYear) known.push(`année : ${report.academicYear}`);

  const prefix = known.length
    ? `J'ai déjà : ${known.join(", ")}. `
    : "";

  if (phase === "school")  return `${prefix}Ton école ou université ?`;
  if (phase === "filiere") return `${prefix}Ta filière ?`;
  if (phase === "type")    return `${prefix}Quel type de rapport ? (PFE, Stage ou Mémoire)`;
  if (phase === "annee")   return `${prefix}Année académique ? (ex: 2025–2026)`;
  if (phase === "color")   return `${prefix}Dernière chose — quelle couleur pour ton rapport ?`;
  if (phase === "done")    return `Tout est là ! Tu peux passer à la page de garde.`;
  return "Bienvenue sur RapportAI. On va construire ton rapport ensemble.";
}

// ─── Color parsing ────────────────────────────────────────────────────────────

function parseCustomColor(input: string): { value: string; hex: string } | null {
  const t = input.trim();
  // Match a CSS hex color
  const hexMatch = t.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
  if (hexMatch) {
    return { value: `${t} (${hexMatch[0]})`, hex: hexMatch[0] };
  }
  // Any non-empty text treated as a colour description (AI will use it)
  if (t.length >= 2) {
    return { value: t, hex: "" };
  }
  return null;
}

// ─── State restoration helpers ────────────────────────────────────────────────

const STEP1_KEY = "rapportai_chat_step1";

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STEP1_KEY);
    return raw ? (JSON.parse(raw) as { msgs?: Msg[]; phase?: Phase; disclaimerAccepted?: boolean }) : null;
  } catch { return null; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Step1() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();

  const [restored] = useState(loadSavedState);

  const initPhase = getInitialPhase(report, restored?.phase);
  const [phase, setPhase] = useState<Phase>(initPhase);
  const [typing, setTyping] = useState(false);
  // Auto-accept disclaimer if user already has onboarding data (phase != "theme")
  // — they've been through some previous step, TOS was accepted earlier.
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(
    restored?.disclaimerAccepted ?? initPhase !== "theme"
  );
  const [disclaimerChecked, setDisclaimerChecked] = useState(
    restored?.disclaimerAccepted ?? initPhase !== "theme"
  );
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    // Restored conversation → use it
    if (restored?.msgs && restored.msgs.length > 0) return restored.msgs;
    // Fresh start (possibly with pre-filled onboarding data)
    return [{ role: "agent", content: buildOpeningMessage(initPhase, report) }];
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing, phase]);

  useEffect(() => {
    try {
      const serializable = msgs
        .filter((m) => typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content as string }));
      localStorage.setItem(STEP1_KEY, JSON.stringify({ msgs: serializable, phase, disclaimerAccepted }));
    } catch { /* quota/unavailable — non-fatal */ }
  }, [msgs, phase, disclaimerAccepted]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  const reply = async (agentText: string, nextPhase: Phase, ms = 480) => {
    setTyping(true);
    await delay(ms);
    setTyping(false);
    push({ role: "agent", content: agentText });
    setPhase(nextPhase);
  };

  // Off-topic question → stream real AI answer, don't advance phase
  const answerQuestion = async (convo: Msg[]) => {
    setTyping(true);
    let acc = "";
    try {
      const res = await fetch(`${API_BASE}/api/converse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toApiMsgs(convo), step: 1, profile: report, generatedSections: [] }),
      });
      if (!res.ok || !res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const d = JSON.parse(raw) as { text?: string };
            if (d.text) acc += d.text;
          } catch { /* skip */ }
        }
      }
    } catch { acc = ""; }
    setTyping(false);
    push({
      role: "agent",
      content: acc.trim() || "Bonne question. J'ai juste besoin de cette info pour personnaliser ton rapport — tu peux me répondre ?",
    });
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || typing) return;
    const trimmed = text.trim();

    // "attends" / wait phrases → respond naturally, don't store, don't advance
    if (phase !== "type" && phase !== "color" && phase !== "done") {
      if (isWait(trimmed)) {
        push({ role: "user", content: trimmed });
        const waitReplies: Record<Phase, string> = {
          theme:   "Pas de problème, prends ton temps. Quand tu es prêt, dis-moi le thème de ton rapport.",
          school:  "Pas de souci ! Quelle est ton école ou université quand tu es prêt ?",
          filiere: "Ok, je t'attends ! Ta filière quand tu es prêt.",
          annee:   "Pas de problème. L'année académique, c'est quoi ?",
          type: "", color: "", done: "",
        };
        await reply(waitReplies[phase] || "Prends ton temps !", phase, 380);
        return;
      }
    }

    // Off-topic / question → answer it, don't advance
    if (phase !== "type" && phase !== "color" && phase !== "done") {
      const filiereSkip = phase === "filiere" && isSkip(trimmed);
      if (!filiereSkip && isQuestion(trimmed, phase)) {
        push({ role: "user", content: trimmed });
        await answerQuestion([...msgs, { role: "user", content: trimmed }]);
        return;
      }
    }

    if (phase === "theme") {
      updateReport({ theme: trimmed });
      push({ role: "user", content: trimmed });
      // Compute next phase based on already-known fields
      const next = nextUncollectedPhase("theme", { ...report, theme: trimmed });
      if (next === "school") {
        await reply("Ton école ou université ?", "school", 520);
      } else if (next === "filiere") {
        await reply(`Ton école est déjà enregistrée (${report.school}). Ta filière ?`, "filiere", 520);
      } else if (next === "type") {
        await reply("Quel type de rapport ? PFE, Stage, ou Mémoire ?", "type", 480);
      } else if (next === "annee") {
        await reply("Année académique ? (ex: 2025–2026)", "annee", 460);
      } else if (next === "color") {
        await reply("Parfait. Dernière chose — quelle couleur pour ton rapport ?", "color", 400);
      } else {
        await reply("Toutes les infos sont là. On commence !", "done", 400);
      }

    } else if (phase === "school") {
      updateReport({ school: trimmed });
      push({ role: "user", content: trimmed });
      const next = nextUncollectedPhase("school", { ...report, school: trimmed });
      if (next === "filiere") {
        await reply(schoolReaction(trimmed), "filiere", 480);
      } else if (next === "type") {
        await reply(`${trimmed}, super. Quel type de rapport ?`, "type", 480);
      } else if (next === "annee") {
        await reply(`${trimmed}, super. Année académique ? (ex: 2025–2026)`, "annee", 460);
      } else if (next === "color") {
        await reply("Parfait. Dernière chose — quelle couleur ?", "color", 400);
      } else {
        await reply("Toutes les infos sont là. On commence !", "done", 400);
      }

    } else if (phase === "filiere") {
      if (isSkip(trimmed)) {
        push({ role: "user", content: trimmed });
        const next = nextUncollectedPhase("filiere", report);
        if (next === "type") await reply("Pas de problème, on peut laisser ça. Quel type de rapport ?", "type", 420);
        else if (next === "annee") await reply("Pas de problème. Année académique ?", "annee", 420);
        else if (next === "color") await reply("Ok. Quelle couleur pour ton rapport ?", "color", 400);
        else await reply("Toutes les infos sont là. On commence !", "done", 400);
      } else {
        updateReport({ filiere: trimmed });
        push({ role: "user", content: trimmed });
        const next = nextUncollectedPhase("filiere", { ...report, filiere: trimmed });
        if (next === "type") {
          await reply(filiereReaction(trimmed), "type", 480);
        } else if (next === "annee") {
          await reply(`${trimmed}, noté. Année académique ? (ex: 2025–2026)`, "annee", 460);
        } else if (next === "color") {
          await reply("Parfait. Quelle couleur pour ton rapport ?", "color", 400);
        } else {
          await reply("Toutes les infos sont là. On commence !", "done", 400);
        }
      }

    } else if (phase === "annee") {
      updateReport({ academicYear: trimmed });
      push({ role: "user", content: trimmed });
      const next = nextUncollectedPhase("annee", { ...report, academicYear: trimmed });
      if (next === "color") {
        await reply("Parfait. Dernière chose — quelle couleur pour ton rapport ?", "color", 400);
      } else {
        await reply("Toutes les infos sont là. On commence !", "done", 400);
      }

    } else if (phase === "color") {
      // Text input for color (custom colour)
      const parsed = parseCustomColor(trimmed);
      if (!parsed) {
        push({ role: "user", content: trimmed });
        await reply("Je n'ai pas bien compris la couleur. Tu peux choisir dans la liste ci-dessous, ou taper le nom d'une couleur (ex: \"rouge\", \"#2d3748\").", "color", 380);
        return;
      }
      updateReport({ reportColor: parsed.value });
      push({ role: "user", content: trimmed });
      await reply("Toutes les infos sont là. On commence !", "done", 400);
    }
  };

  const handleColorSelect = async (color: { label: string; value: string; hex: string }) => {
    if (phase !== "color" || typing) return;
    updateReport({ reportColor: color.value });
    push({ role: "user", content: color.label });
    await reply("Toutes les infos sont là. On commence !", "done", 400);
  };

  const handleTypeSelect = async (value: "PFE" | "stage" | "memoire", label: string) => {
    if (phase !== "type" || typing) return;
    updateReport({ reportType: value, currentStep: 1 });
    push({ role: "user", content: label });
    const reaction =
      value === "PFE"   ? `PFE — on va faire quelque chose de solide. Année académique ? (ex: 2025–2026)` :
      value === "stage" ? `Rapport de stage, ok. Année académique ? (ex: 2025–2026)` :
                          `Mémoire — beau projet. Année académique ? (ex: 2025–2026)`;
    const next = nextUncollectedPhase("type", { ...report, reportType: value });
    if (next === "annee") {
      await reply(reaction, "annee", 460);
    } else if (next === "color") {
      await reply("Parfait. Quelle couleur pour ton rapport ?", "color", 400);
    } else {
      await reply("Toutes les infos sont là. On commence !", "done", 400);
    }
  };

  // Input is only disabled during loading, type-button phase (buttons handle it), and done
  const inputDisabled = !disclaimerAccepted || phase === "type" || phase === "done" || typing;

  return (
    <Layout stepName="Informations générales" stepNumber={1}>
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {msgs.map((m, i) => (
          <ChatMessage key={i} role={m.role as "agent" | "user"} content={m.content} />
        ))}

        {/* Disclaimer — shown once before first input */}
        {!disclaimerAccepted && phase === "theme" && (
          <div className="mx-10 mb-4 px-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                RapportAI génère un <strong>rapport académique complet</strong> à partir des informations que tu fournis.
                Tu t'engages à vérifier son contenu, à le personnaliser selon ton contexte spécifique,
                et à y intégrer tes propres analyses avant toute soumission académique.
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <button
                  type="button"
                  onClick={() => setDisclaimerChecked((v) => !v)}
                  className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                    disclaimerChecked
                      ? "bg-purple-600 border-purple-600"
                      : "border-gray-300 bg-white group-hover:border-purple-400"
                  }`}
                >
                  {disclaimerChecked && <Check className="w-2.5 h-2.5 text-white" />}
                </button>
                <span className="text-xs text-gray-700">
                  J'accepte les{" "}
                  <a href="/terms" target="_blank" className="text-purple-600 hover:underline">Conditions Générales d'Utilisation</a>
                  {" "}et la{" "}
                  <a href="/privacy" target="_blank" className="text-purple-600 hover:underline">Politique de Confidentialité</a>.
                </span>
              </label>
              <button
                onClick={() => { if (disclaimerChecked) setDisclaimerAccepted(true); }}
                disabled={!disclaimerChecked}
                className="w-full py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: disclaimerChecked ? "#7c3aed" : "#e5e7eb", color: disclaimerChecked ? "#fff" : "#9ca3af" }}
              >
                Commencer
              </button>
            </div>
          </div>
        )}

        {typing && <ChatMessage role="agent" content="" isTyping />}

        {/* Type selector buttons */}
        {phase === "type" && !typing && (
          <div className="flex gap-2 flex-wrap ml-10 mb-4 px-4">
            {TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => handleTypeSelect(o.value, o.label)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ border: "1px solid #7c3aed55", color: "#a78bfa", background: "#7c3aed11" }}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {/* Color picker — buttons + custom text input hint */}
        {phase === "color" && !typing && (
          <div className="ml-10 mb-4 px-4 space-y-2">
            <div className="flex gap-3 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => handleColorSelect(c)}
                  title={c.label}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-gray-200 hover:border-gray-400 bg-white"
                >
                  <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: c.hex }} />
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400">
              Ou tape une couleur personnalisée dans le champ ci-dessous (ex : "rouge vif", "#a83260")
            </p>
          </div>
        )}

        {phase === "done" && !typing && (
          <StepTransitionCard
            title="Informations générales enregistrées"
            subtitle="On continue avec la page de garde."
            onNext={() => { updateReport({ currentStep: 2 }); setLocation("/rapport/step-2"); }}
            nextLabel="Étape 2 : Page de garde"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t border-border">
        <ChatInput
          onSend={handleSend}
          disabled={inputDisabled}
          placeholder={
            phase === "theme"   ? "Ton thème de rapport..." :
            phase === "school"  ? "Ton école / université..." :
            phase === "filiere" ? "Ta filière (ou 'passer' pour continuer)..." :
            phase === "annee"   ? "Année académique (ex: 2025–2026)..." :
            phase === "color"   ? "Couleur personnalisée (ex: rouge, #2d3748)..." : ""
          }
        />
      </div>
    </Layout>
  );
}
