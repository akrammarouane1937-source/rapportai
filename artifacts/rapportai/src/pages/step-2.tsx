import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, StepTransitionCard, AgentSteps } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { useReportStore } from "@/lib/store";
import { useConversation } from "@/hooks/use-conversation";
import { useOptionalUser as useUser } from "@/lib/useOptionalClerk";
import { useFileStore } from "@/lib/fileStore";
import { School, X, FileText } from "lucide-react";

function capitalizeName(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function TemplateButton() {
  const { files, addFiles, clearAll } = useFileStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateFile = files.find((f) => f.name.startsWith("canevas-"));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearAll();
    const renamed = new File([file], `canevas-${file.name}`, { type: file.type });
    addFiles([renamed]);
    e.target.value = "";
  };

  if (templateFile) {
    return (
      <div className="flex items-center gap-1 text-xs" style={{ color: "#16a34a" }}>
        <FileText className="w-3.5 h-3.5 shrink-0" />
        <span className="max-w-[100px] truncate hidden sm:inline">
          {templateFile.name.replace(/^canevas-/, "")}
        </span>
        <button
          onClick={clearAll}
          title="Retirer le modèle"
          className="ml-0.5"
          style={{ color: "#9ca3af" }}
        >
          <X className="w-3 h-3" />
        </button>
        <input ref={fileInputRef} type="file" accept=".docx,.doc,.pdf" className="hidden" onChange={handleFile} />
      </div>
    );
  }

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".docx,.doc,.pdf" className="hidden" onChange={handleFile} />
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Joindre le modèle Word de votre école (optionnel)"
        className="p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs"
        style={{ color: "#a78bfa" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#7c3aed")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#a78bfa")}
      >
        <School className="w-4 h-4" />
      </button>
    </>
  );
}

export default function Step2Page() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const { user } = useUser();
  const [stepDone, setStepDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const studentName = capitalizeName(
    user?.fullName || user?.firstName || report.studentName || ""
  );

  const { messages, send, abort, isThinking, isGenerating, toolCalls, thinkingText } = useConversation({
    step: 2,
    autoSend: "Démarre.",
    onSectionGenerated: (section, content) => {
      if (section === "page-de-garde") {
        updateReport({ pageDeGarde: content, studentName: studentName || report.studentName });
      }
    },
    onStepComplete: () => setStepDone(true),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls, isThinking, isGenerating]);

  return (
    <Layout
      stepName="Page de garde"
      stepNumber={2}
      previewPanel={<PreviewPanel activeSection="page-de-garde" content={report.pageDeGarde} />}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {messages.map((m) => <ChatMessage key={m.id} role={m.role} content={m.content} />)}
        <AgentSteps toolCalls={toolCalls} thinkingText={thinkingText} isGenerating={isGenerating} />
        {(isThinking || isGenerating) && <ChatMessage role="agent" content="" isTyping />}
        {stepDone && !isThinking && !isGenerating && (
          <StepTransitionCard
            title="Page de garde prête"
            subtitle="On passe aux dédicaces et remerciements."
            onNext={() => { updateReport({ currentStep: 3 }); setLocation("/rapport/step-3"); }}
            nextLabel="Étape 3 : Dédicaces"
          />
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput
        isGenerating={isThinking || isGenerating}
        onAbort={abort}
        onSend={(text) => send(text)}
        disabled={isThinking || isGenerating}
        placeholder="Réponds naturellement..."
        templateSlot={<TemplateButton />}
      />
    </Layout>
  );
}
