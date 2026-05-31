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

// ─── Intent API ───────────────────────────────────────────────────────────────
// Claude decides whether a message is a real answer, a skip, or off-script.
// No client-side heuristics — all intent detection is server-side.

type IntentResult =
  | { type: "answer"; value: string }
  | { type: "skip" }
  | { type: "reply"; text: string };

async function resolveIntent(
  phase: Phase,
  userInput: string,
  profile: Partial<Report>
): Promise<IntentResult> {
  try {
    const res = await fetch(`${API_BASE}/api/converse/intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase, userInput, profile }),
    });
    if (!res.ok) throw new Error("intent API error");
    return (await res.json()) as IntentResult;
  } catch {
    return { type: "reply", text: "Je n'ai pas bien compris, tu peux reformuler ?" };
  }
}

// ─── Phase ordering & skip logic ─────────────────────────────────────────────

const PHASE_ORDER: Phase[] = ["theme", "school", "filiere", "type", "annee", "color", "done"];

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

function getInitialPhase(report: Partial<Report>, restoredPhase?: Phase): Phase {
  if (restoredPhase && restoredPhase !== "theme") return restoredPhase;
  if (!report.theme)        return "theme";
  if (!report.school)       return "school";
  if (!report.filiere)      return "filiere";
  if (!report.reportType)   return "type";
  if (!report.academicYear) return "annee";
  if (!report.reportColor)  return "color";
  return "done";
}

function buildOpeningMessage(phase: Phase, report: Partial<Report>): string {
  if (phase === "theme") {
    return "Bienvenue sur RapportAI. On va construire ton rapport ensemble, étape par étape. Commence par le thème : c'est quoi ton sujet ?";
  }
  const known: string[] = [];
  if (report.theme)        known.push(`thème : "${report.theme}"`);
  if (report.school)       known.push(`école : ${report.school}`);
  if (report.filiere)      known.push(`filière : ${report.filiere}`);
  if (report.reportType)   known.push(`type : ${report.reportType.toUpperCase()}`);
  if (report.academicYear) known.push(`année : ${report.academicYear}`);
  const prefix = known.length ? `J'ai déjà : ${known.join(", ")}. ` : "";
  if (phase === "school")  return `${prefix}Ton école ou université ?`;
  if (phase === "filiere") return `${prefix}Ta filière ?`;
  if (phase === "type")    return `${prefix}Quel type de rapport ? (PFE, Stage ou Mémoire)`;
  if (phase === "annee")   return `${prefix}Année académique ? (ex: 2025–2026)`;
  if (phase === "color")   return `${prefix}Dernière chose — quelle couleur pour ton rapport ?`;
  if (phase === "done")    return `Tout est là. Tu peux passer à la page de garde.`;
  return "Bienvenue sur RapportAI. On va construire ton rapport ensemble.";
}

// Short acknowledgment + next question after a successful answer.
function buildTransitionMessage(answeredPhase: Phase, value: string, nextPhase: Phase, wasSkipped = false): string {
  const ack = wasSkipped
    ? "D'accord, on passe."
    : answeredPhase === "theme"
      ? `Noté — "${value.length > 55 ? value.slice(0, 55) + "…" : value}".`
      : answeredPhase === "school"
        ? (() => {
            const s = value.toUpperCase();
            if (s.includes("EMSI"))   return "EMSI, super.";
            if (s.includes("ENCG"))   return "ENCG, parfait.";
            if (s.includes("ENSA"))   return "ENSA, ok.";
            if (s.includes("ENSIAS")) return "ENSIAS, bonne école.";
            if (s.includes("UIR"))    return "UIR, top.";
            if (s.includes("ISCAE"))  return "ISCAE, nickel.";
            if (s.includes("HEM"))    return "HEM, classe.";
            return `${value}, ok.`;
          })()
        : answeredPhase === "filiere"
          ? (() => {
              const f = value.toLowerCase();
              if (f.includes("finance") || f.includes("compta")) return "Finance — bon choix.";
              if (f.includes("info") || f.includes("dev") || f.includes("génie")) return "Génie info, parfait.";
              if (f.includes("market")) return "Marketing — intéressant.";
              if (f.includes("manage")) return "Management, ok.";
              return `${value}, noté.`;
            })()
          : "Parfait.";

  if (nextPhase === "done")    return `${ack} Toutes les infos sont là. On commence !`;
  if (nextPhase === "school")  return `${ack} Ton école ou université ?`;
  if (nextPhase === "filiere") return `${ack} Ta filière ?`;
  if (nextPhase === "type")    return `${ack} Quel type de rapport ?`;
  if (nextPhase === "annee")   return `${ack} Année académique ? (ex: 2025–2026)`;
  if (nextPhase === "color")   return `${ack} Dernière chose — quelle couleur pour ton rapport ?`;
  return `${ack} On continue !`;
}

// ─── Color parsing ────────────────────────────────────────────────────────────

function parseCustomColor(input: string): { value: string; hex: string } | null {
  const t = input.trim();
  const hexMatch = t.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
  if (hexMatch) return { value: `${t} (${hexMatch[0]})`, hex: hexMatch[0] };
  if (t.length >= 2) return { value: t, hex: "" };
  return null;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

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
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(
    restored?.disclaimerAccepted ?? initPhase !== "theme"
  );
  const [disclaimerChecked, setDisclaimerChecked] = useState(
    restored?.disclaimerAccepted ?? initPhase !== "theme"
  );
  const [msgs, setMsgs] = useState<Msg[]>(() =>
    restored?.msgs && restored.msgs.length > 0
      ? restored.msgs
      : [{ role: "agent", content: buildOpeningMessage(initPhase, report) }]
  );
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
    } catch { /* quota — non-fatal */ }
  }, [msgs, phase, disclaimerAccepted]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  const handleSend = async (text: string) => {
    if (!text.trim() || typing || phase === "type" || phase === "done") return;
    const trimmed = text.trim();

    push({ role: "user", content: trimmed });

    // Color phase: accept any text as a custom colour (no AI call needed)
    if (phase === "color") {
      const parsed = parseCustomColor(trimmed);
      if (!parsed) {
        setTyping(true);
        await delay(300);
        setTyping(false);
        push({ role: "agent", content: "Je n'ai pas compris la couleur. Choisis dans la liste ou tape un nom de couleur (ex: \"rouge\", \"#2d3748\")." });
      } else {
        updateReport({ reportColor: parsed.value });
        setTyping(true);
        await delay(350);
        setTyping(false);
        push({ role: "agent", content: "Toutes les infos sont là. On commence !" });
        setPhase("done");
      }
      return;
    }

    // All other text phases → let Claude decide intent
    setTyping(true);
    const intent = await resolveIntent(phase, trimmed, report);
    await delay(200); // small buffer so typing indicator is visible
    setTyping(false);

    if (intent.type === "reply") {
      // Off-script: Claude already formulated the right response + re-asked the question
      push({ role: "agent", content: intent.text });
      return;
    }

    // ANSWER or SKIP → store value and advance
    const value = intent.type === "answer" ? intent.value : "";
    const wasSkipped = intent.type === "skip";

    const updatedSnapshot = { ...report };
    if (phase === "theme")   { updateReport({ theme: value });        updatedSnapshot.theme = value; }
    if (phase === "school")  { updateReport({ school: value });       updatedSnapshot.school = value; }
    if (phase === "filiere") { updateReport({ filiere: value });      updatedSnapshot.filiere = value; }
    if (phase === "annee")   { updateReport({ academicYear: value }); updatedSnapshot.academicYear = value; }

    const next = nextUncollectedPhase(phase, updatedSnapshot);
    push({ role: "agent", content: buildTransitionMessage(phase, value, next, wasSkipped) });
    setPhase(next);
  };

  const handleColorSelect = async (color: { label: string; value: string; hex: string }) => {
    if (phase !== "color" || typing) return;
    updateReport({ reportColor: color.value });
    push({ role: "user", content: color.label });
    setTyping(true);
    await delay(350);
    setTyping(false);
    push({ role: "agent", content: "Toutes les infos sont là. On commence !" });
    setPhase("done");
  };

  const handleTypeSelect = async (value: "PFE" | "stage" | "memoire", label: string) => {
    if (phase !== "type" || typing) return;
    updateReport({ reportType: value, currentStep: 1 });
    push({ role: "user", content: label });
    const reaction =
      value === "PFE"   ? "PFE — on va faire quelque chose de solide." :
      value === "stage" ? "Rapport de stage, ok." :
                          "Mémoire — beau projet.";
    const updatedSnapshot = { ...report, reportType: value };
    const next = nextUncollectedPhase("type", updatedSnapshot);
    const msg = buildTransitionMessage("type", value, next);
    // Use the reaction prefix instead of "Parfait."
    const fullMsg = msg.replace(/^Parfait\./, reaction);
    setTyping(true);
    await delay(420);
    setTyping(false);
    push({ role: "agent", content: fullMsg });
    setPhase(next);
  };

  const inputDisabled = !disclaimerAccepted || phase === "type" || phase === "done" || typing;

  return (
    <Layout stepName="Informations générales" stepNumber={1}>
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {msgs.map((m, i) => (
          <ChatMessage key={i} role={m.role as "agent" | "user"} content={m.content} />
        ))}

        {/* Disclaimer */}
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

        {/* Type selector */}
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

        {/* Color picker — preset buttons + free text hint */}
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
              Ou tape une couleur personnalisée ci-dessous (ex : "rouge vif", "#a83260")
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
