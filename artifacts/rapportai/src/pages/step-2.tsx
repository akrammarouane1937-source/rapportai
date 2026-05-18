import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ChatMessage, ToolCallCard, StepTransitionCard, ThinkingCard } from "@/components/chat-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatInput } from "@/components/chat-input";
import { UploadCard } from "@/components/upload-card";
import { useReportStore } from "@/lib/store";
import { useGenerate } from "@/hooks/use-generate";
import { useFileStore } from "@/lib/fileStore";
import { useOptionalUser as useUser } from "@/lib/useOptionalClerk";
import { motion } from "framer-motion";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type Phase = "intro" | "missing" | "template" | "generating" | "done";
type Msg = { role: "agent" | "user"; content: React.ReactNode };

export default function Step2Page() {
  const [, setLocation] = useLocation();
  const { report, updateReport } = useReportStore();
  const { generate, abort, isGenerating, toolCalls, streamedContent, thinkingText, error } = useGenerate();
  const addFiles = useFileStore((s) => s.addFiles);
  const { user } = useUser();

  const [phase, setPhase] = useState<Phase>("intro");
  const [templateFiles, setTemplateFiles] = useState<File[]>([]);

  const studentName = user?.fullName || user?.firstName || report.studentName || "";

  const needsEncPeda     = !report.encadrantPeda;
  const needsEncPro      = !report.encadrantPro && report.reportType !== "memoire";
  const needsEntreprise  = !report.entreprise && report.reportType !== "memoire";
  const needsJury        = !(report as Record<string, unknown>).juryMember1;

  const missingCount = [needsEncPeda, needsEncPro, needsEntreprise, needsJury].filter(Boolean).length;

  const buildMissingLines = () => {
    const items: string[] = [];
    if (needsEncPeda)    items.push("• Encadrant pédagogique (nom complet) ?");
    if (needsEncPro)     items.push("• Encadrant professionnel (nom complet ou \"non\") ?");
    if (needsEntreprise) items.push("• Entreprise d'accueil (nom exact) ?");
    if (needsJury)       items.push("• Membres du jury (noms complets ou \"non\") ?");
    return items.join("\n");
  };

  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "agent",
      content: (
        <div>
          <p>
            Je génère ta page de garde pour{" "}
            <span className="font-semibold">{studentName || "toi"}</span> —{" "}
            <span className="font-semibold">{report.school}</span>,{" "}
            {report.filiere} ({report.reportType.toUpperCase()}).
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thème : « {report.theme} »
          </p>
        </div>
      ),
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, toolCalls, isGenerating]);

  const push = (...m: Msg[]) => setMsgs((p) => [...p, ...m]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (missingCount > 0) {
        push({
          role: "agent",
          content: (
            <div>
              <p className="mb-2">Il me manque quelques infos :</p>
              <pre className="text-sm whitespace-pre-wrap font-sans">{buildMissingLines()}</pre>
              <p className="mt-2 text-sm text-muted-foreground">Réponds en une fois ou tape "non" pour passer.</p>
            </div>
          ),
        });
        setPhase("missing");
      } else {
        push({
          role: "agent",
          content: "Toutes les infos sont là 👍 Tu as un template Word de ton école ? Upload-le ou tape \"non\".",
        });
        setPhase("template");
      }
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async (text: string, files?: File[]) => {
    const t = text.trim();
    const skip = /^(non|passer|\/|-)$/i.test(t) || (!t && (!files || files.length === 0));

    if (phase === "missing") {
      push({ role: "user", content: t || "Non" });
      // Best-effort parse — the agent will handle the rest via profile.json
      if (!skip && t) {
        const updates: Partial<typeof report> = {};
        if (needsEncPeda) {
          const m = t.match(/(?:encadrant\s+p[eé]da\w*\s*[:–-]?\s*)?([A-ZÀ-Ö][a-zà-ö.]+(?:\s+[A-ZÀ-Ö][a-zà-ö.]+){1,3})/);
          if (m) updates.encadrantPeda = m[1];
        }
        if (needsEntreprise && !/non/i.test(t)) {
          const m = t.match(/entreprise\s*[:–-]?\s*(.+?)(?:\n|,|$)/i);
          if (m) updates.entreprise = m[1].trim();
        }
        if (Object.keys(updates).length > 0) updateReport(updates);
      }
      push({
        role: "agent",
        content: "Tu as un template Word de ton école ? Upload-le ici ou tape \"non\".",
      });
      setPhase("template");

    } else if (phase === "template") {
      if (files && files.length > 0) {
        setTemplateFiles(files);
        addFiles(files);
        push({ role: "user", content: `${files.length} fichier(s) uploadé(s)` });
        files.forEach((f) => push({ role: "agent", content: <UploadCard file={f} status="ready" /> }));
        push({ role: "agent", content: "Template reçu ✅ Je génère ta page de garde..." });
      } else {
        push(
          { role: "user", content: skip ? "Non" : t },
          { role: "agent", content: "Pas de template — je vais chercher les logos automatiquement. Je génère..." }
        );
      }
      setPhase("generating");
      await runGenerate(files ?? []);

    } else if (phase === "done") {
      push({ role: "user", content: t });
      push({ role: "agent", content: "Je révise la page de garde..." });
      const result = await generate("page-de-garde", report, t);
      if (result) {
        updateReport({ pageDeGarde: result });
        push({ role: "agent", content: "Page de garde mise à jour ✅" });
      } else {
        push({ role: "agent", content: "❌ Révision échouée. Réessaie." });
      }
    }
  };

  const runGenerate = async (extraFiles: File[]) => {
    const allFiles = [...templateFiles, ...extraFiles];
    if (studentName && !report.studentName) updateReport({ studentName });

    const result = await generate(
      "page-de-garde",
      { ...report, studentName: studentName || report.studentName },
      undefined,
      allFiles.length > 0 ? allFiles : undefined
    );

    if (!result) {
      push({ role: "agent", content: "❌ Génération échouée. Vérifie ta connexion et réessaie." });
      setPhase("template");
      return;
    }

    updateReport({ pageDeGarde: result });
    push({
      role: "agent",
      content: (
        <div>
          <p>Page de garde générée ✅</p>
          <p className="text-sm text-muted-foreground mt-1">
            {templateFiles.length > 0
              ? "Template utilisé · logos intégrés"
              : "Logos recherchés automatiquement · structure académique marocaine"}
          </p>
        </div>
      ),
    });
    setPhase("done");
  };

  return (
    <Layout
      stepName="Page de garde"
      stepNumber={2}
      previewPanel={
        <PreviewPanel
          activeSection="page-de-garde"
          content={report.pageDeGarde || streamedContent}
        />
      }
    >
      <div className="flex-1 overflow-y-auto py-4 px-2 md:py-5 md:px-3">
        {msgs.map((m, i) => (
          <ChatMessage key={i} role={m.role} content={m.content} />
        ))}
        {thinkingText && <ThinkingCard text={thinkingText} streaming={isGenerating} />}
        {toolCalls.map((tc) => (
          <ToolCallCard key={tc.id} name={tc.name} detail={tc.detail} done={tc.done} />
        ))}
        {isGenerating && (
          <ChatMessage role="agent" content="Recherche des logos et génération en cours..." isTyping />
        )}
        {error && <ChatMessage role="agent" content={`❌ Erreur : ${error}. Réessaie.`} />}

        {phase === "template" && !isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-3"
          >
            <label className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                accept=".docx,.doc"
                onChange={(e) => {
                  const f = e.target.files ? Array.from(e.target.files) : [];
                  if (f.length > 0) handleSend("", f);
                }}
              />
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <span>
                  <Upload className="w-4 h-4" />
                  Uploader un template Word
                </span>
              </Button>
            </label>
          </motion.div>
        )}

        {phase === "done" && !isGenerating && (
          <StepTransitionCard
            title="Page de garde complétée"
            subtitle="Prochaine étape — dédicaces et remerciements."
            onNext={() => {
              updateReport({ currentStep: 3 });
              setLocation("/rapport/step-3");
            }}
            nextLabel="Étape 3 — Dédicaces"
          />
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t" style={{ borderColor: "#1e293b" }}>
        <ChatInput
          isGenerating={isGenerating}
          onAbort={abort}
          onSend={handleSend}
          disabled={isGenerating || phase === "generating"}
          placeholder={
            phase === "missing"  ? "Encadrant, entreprise, jury..." :
            phase === "template" ? "Uploader un template ou 'non'..." :
            phase === "done"     ? "Demander une modification..." :
            ""
          }
        />
      </div>
    </Layout>
  );
}
