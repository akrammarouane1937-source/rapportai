import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard } from "@/components/chat-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";

type Phase = "nom" | "encPeda" | "encPro" | "entreprise" | "done";
type Msg = { role: "agent" | "user"; content: React.ReactNode };

export default function Step2() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const [phase, setPhase] = useState<Phase>("nom");
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "agent", content: "Maintenant tes informations personnelles. Ton nom complet ?" },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  const handleSend = (text: string) => {
    const t = text.trim();
    const skip = /^(non|passer|\/|-)$/i.test(t);

    if (phase === "nom") {
      updateReport({ studentName: t });
      push(
        { role: "user", content: t },
        { role: "agent", content: "Ton encadrant pédagogique ?" }
      );
      setPhase("encPeda");
    } else if (phase === "encPeda") {
      updateReport({ encadrantPeda: t });
      push(
        { role: "user", content: t },
        { role: "agent", content: "Encadrant professionnel ? (tape 'non' si aucun)" }
      );
      setPhase("encPro");
    } else if (phase === "encPro") {
      updateReport({ encadrantPro: skip ? "" : t });
      push(
        { role: "user", content: t },
        { role: "agent", content: "Entreprise d'accueil ? (tape 'non' si stage école)" }
      );
      setPhase("entreprise");
    } else if (phase === "entreprise") {
      updateReport({ entreprise: skip ? "" : t });
      push(
        { role: "user", content: t },
        { role: "agent", content: "Parfait ✅ Toutes tes infos sont enregistrées." }
      );
      setPhase("done");
    }
  };

  return (
    <Layout stepName="Informations personnelles" stepNumber={2}>
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {msgs.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} />)}
        {phase === "done" && (
          <StepTransitionCard
            title="Infos personnelles enregistrées"
            subtitle="On génère maintenant tes dédicaces et remerciements."
            onNext={() => { updateReport({ currentStep: 3 }); setLocation("/rapport/step-3"); }}
            nextLabel="Étape 3 — Dédicaces"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t" style={{ borderColor: "#1e293b" }}>
        <ChatInput
          onSend={handleSend}
          disabled={phase === "done"}
          placeholder={
            phase === "nom" ? "Ton nom complet..." :
            phase === "encPeda" ? "Nom de l'encadrant pédagogique..." :
            phase === "encPro" ? "Encadrant professionnel (ou 'non')..." :
            phase === "entreprise" ? "Entreprise d'accueil (ou 'non')..." : ""
          }
        />
      </div>
    </Layout>
  );
}
