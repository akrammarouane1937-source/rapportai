import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard } from "@/components/chat-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { motion } from "framer-motion";

type Phase = "theme" | "school" | "filiere" | "type" | "annee" | "done";

type Msg = { role: "agent" | "user"; content: React.ReactNode };

const TYPE_OPTIONS: Array<{ label: string; value: "PFE" | "stage" | "memoire" }> = [
  { label: "PFE", value: "PFE" },
  { label: "Stage", value: "stage" },
  { label: "Mémoire", value: "memoire" },
];

export default function Step1() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const [phase, setPhase] = useState<Phase>("theme");
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "agent", content: "Bienvenue sur RapportAI 👋 On va construire ton rapport ensemble, étape par étape. Commence par le thème — c'est quoi ton sujet ?" },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const push = (msgs_: Msg[]) => setMsgs((p) => [...p, ...msgs_]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    const trimmed = text.trim();

    if (phase === "theme") {
      updateReport({ theme: trimmed });
      push([
        { role: "user", content: trimmed },
        { role: "agent", content: "Ton école ou université ?" },
      ]);
      setPhase("school");
    } else if (phase === "school") {
      updateReport({ school: trimmed });
      push([
        { role: "user", content: trimmed },
        { role: "agent", content: "Ta filière ?" },
      ]);
      setPhase("filiere");
    } else if (phase === "filiere") {
      updateReport({ filiere: trimmed });
      push([
        { role: "user", content: trimmed },
        { role: "agent", content: "Type de rapport :" },
      ]);
      setPhase("type");
    } else if (phase === "annee") {
      updateReport({ academicYear: trimmed });
      push([
        { role: "user", content: trimmed },
        { role: "agent", content: "Parfait, toutes les informations générales sont enregistrées ✅" },
      ]);
      setPhase("done");
    }
  };

  const handleTypeSelect = (value: "PFE" | "stage" | "memoire", label: string) => {
    if (phase !== "type") return;
    updateReport({ reportType: value, currentStep: 1 });
    push([
      { role: "user", content: label },
      { role: "agent", content: "Année académique ? (ex: 2025-2026)" },
    ]);
    setPhase("annee");
  };

  return (
    <Layout stepName="Informations générales" stepNumber={1}>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-0">
        {msgs.map((m, i) => (
          <ChatMessage key={i} role={m.role} content={m.content} />
        ))}
        {phase === "type" && (
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
        {phase === "done" && (
          <StepTransitionCard
            title="Informations générales enregistrées"
            subtitle="On continue avec tes informations personnelles."
            onNext={() => { updateReport({ currentStep: 2 }); setLocation("/rapport/step-2"); }}
            nextLabel="Étape 2 — Infos personnelles"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t" style={{ borderColor: "#1e293b" }}>
        <ChatInput
          onSend={handleSend}
          disabled={phase === "type" || phase === "done"}
          placeholder={
            phase === "theme" ? "Ton thème de rapport..." :
            phase === "school" ? "Ton école / université..." :
            phase === "filiere" ? "Ta filière..." :
            phase === "annee" ? "Année académique..." : ""
          }
        />
      </div>
    </Layout>
  );
}
