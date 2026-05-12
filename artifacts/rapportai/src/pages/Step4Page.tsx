import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Sparkles, X, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepLayout } from "@/components/report/StepLayout";
import { WordPreview } from "@/components/report/WordPreview";
import { useGenerate } from "@/lib/useGenerate";
import { markdownToHtml } from "@/lib/markdownToHtml";
import { saveReport, getReport, useAutoSave } from "@/lib/reportStore";

const MAX_WORDS = 300;

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function buildPreviewHtml(
  resume: string,
  motsCles: string[],
  abstract: string,
  keywords: string[],
  abrevs: Array<{ abbr: string; sig: string }>
): string {
  const parts: string[] = [];
  parts.push(`<h2>Résumé</h2>`);
  if (motsCles.length > 0) parts.push(`<p><strong>Mots-clés :</strong> ${motsCles.join(", ")}</p>`);
  parts.push(`<p>${resume || "<em>Le résumé apparaîtra ici…</em>"}</p>`);
  parts.push(`<h2>Abstract</h2>`);
  if (keywords.length > 0) parts.push(`<p><strong>Keywords:</strong> ${keywords.join(", ")}</p>`);
  parts.push(`<p>${abstract || "<em>The abstract will appear here…</em>"}</p>`);
  if (abrevs.length > 0) {
    parts.push(`<h2>Liste des Abréviations</h2>`);
    abrevs.forEach((a) => parts.push(`<p><strong>${a.abbr}</strong> — ${a.sig}</p>`));
  }
  return parts.join("\n");
}

function ChipList({
  chips,
  setChips,
  max,
  placeholder,
}: {
  chips: string[];
  setChips: (v: string[]) => void;
  max: number;
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    if (input.trim() && chips.length < max) {
      setChips([...chips, input.trim()]);
      setInput("");
    }
  };
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 text-xs font-medium px-3 py-1.5 rounded-full"
        >
          {c}
          <button onClick={() => setChips(chips.filter((_, j) => j !== i))}>
            <X className="w-3 h-3 text-purple-400 hover:text-purple-700" />
          </button>
        </span>
      ))}
      {chips.length < max && (
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
            if (e.key === "Escape") setInput("");
          }}
          placeholder={placeholder}
          className="text-xs border border-dashed border-gray-300 rounded-full px-3 py-1.5 focus:outline-none focus:border-purple-400 w-32"
        />
      )}
    </div>
  );
}

export default function Step4Page() {
  const [, setLocation] = useLocation();

  // ── Load persisted data on mount ─────────────────────────────────────────
  const initialReport = getReport();

  const [resume, setResume] = useState(initialReport.resume ?? "");
  const [motsCles, setMotsCles] = useState<string[]>(initialReport.motsCles ?? []);
  const [abstract, setAbstract] = useState(initialReport.abstract ?? "");
  const [keywords, setKeywords] = useState<string[]>(initialReport.keywords ?? []);
  const [abrevs, setAbrevs] = useState<Array<{ abbr: string; sig: string }>>(
    initialReport.abreviations ?? []
  );
  const [newAbbr, setNewAbbr] = useState("");
  const [newSig, setNewSig] = useState("");

  // Use refs so the AI callbacks always see latest values (avoid stale closures)
  const resumeRef    = useRef(resume);
  const motsClesRef  = useRef(motsCles);
  const abstractRef  = useRef(abstract);
  const keywordsRef  = useRef(keywords);
  const abrevsRef    = useRef(abrevs);

  const setResumeSync = (v: string) => { resumeRef.current = v; setResume(v); };
  const setMotsClesSync = (v: string[]) => { motsClesRef.current = v; setMotsCles(v); };
  const setAbstractSync = (v: string) => { abstractRef.current = v; setAbstract(v); };
  const setKeywordsSync = (v: string[]) => { keywordsRef.current = v; setKeywords(v); };
  const setAbrevsSync = (v: Array<{ abbr: string; sig: string }>) => { abrevsRef.current = v; setAbrevs(v); };

  // ── Auto-save ─────────────────────────────────────────────────────────────
  useAutoSave(
    { resume, abstract, motsCles, keywords, abreviations: abrevs },
    [resume, abstract, motsCles, keywords, abrevs]
  );

  // ── Live Word preview ──────────────────────────────────────────────────────
  const previewContent = buildPreviewHtml(resume, motsCles, abstract, keywords, abrevs);
  const previewWordCount = countWords(resume) + countWords(abstract);

  // ── AI — résumé génération ─────────────────────────────────────────────────
  const rawTextRef = useRef("");

  const onChunkResume = useCallback((chunk: string) => {
    rawTextRef.current += chunk;
    setResumeSync(rawTextRef.current);
  }, []);

  const onDoneResume = useCallback(() => {
    saveReport({
      resume:        resumeRef.current,
      abstract:      abstractRef.current,
      motsCles:      motsClesRef.current,
      keywords:      keywordsRef.current,
      abreviations:  abrevsRef.current,
    });
  }, []);

  const { generate: generateResume, isStreaming: generatingResume } = useGenerate({
    onChunk: onChunkResume,
    onDone:  onDoneResume,
  });

  const handleLaisserIA = () => {
    const report = getReport();
    rawTextRef.current = "";
    setResumeSync("");
    generateResume({
      section:       "resume",
      theme:         report.theme         ?? "",
      school:        report.school        ?? "",
      filiere:       report.filiere       ?? "",
      problematique: report.theme         ?? "",
      motsCles:      motsClesRef.current.length > 0 ? motsClesRef.current : [],
      citationStyle: report.citationStyle ?? "APA 7th ed.",
    });
  };

  // ── AI — abstract (translate from résumé) ─────────────────────────────────
  const rawAbstractRef = useRef("");

  const onChunkAbstract = useCallback((chunk: string) => {
    rawAbstractRef.current += chunk;
    setAbstractSync(rawAbstractRef.current);
  }, []);

  const onDoneAbstract = useCallback(() => {
    saveReport({ abstract: abstractRef.current });
  }, []);

  const { generate: generateAbstract, isStreaming: generatingAbstract } = useGenerate({
    onChunk: onChunkAbstract,
    onDone:  onDoneAbstract,
  });

  const handleAbstractIA = () => {
    const report = getReport();
    rawAbstractRef.current = "";
    setAbstractSync("");
    generateAbstract({
      section:       "abstract",
      theme:         report.theme  ?? "",
      school:        report.school ?? "",
      filiere:       report.filiere ?? "",
      problematique: resumeRef.current || report.theme || "",
      citationStyle: "APA 7th ed.",
    });
  };

  const addAbrev = () => {
    if (newAbbr.trim() && newSig.trim()) {
      setAbrevsSync([...abrevsRef.current, { abbr: newAbbr.trim(), sig: newSig.trim() }]);
      setNewAbbr("");
      setNewSig("");
    }
  };

  const resumeWords   = countWords(resume);
  const abstractWords = countWords(abstract);

  return (
    <StepLayout stepId={4} fullHeight>
      <div className="flex h-full overflow-hidden">
        {/* LEFT — Form 38% */}
        <div
          className="overflow-y-auto flex-shrink-0 flex flex-col"
          style={{ width: "38%", borderRight: "1px solid #e5e7eb" }}
        >
          <div className="p-6 space-y-6 pb-32">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1
                className="text-xl font-bold text-gray-900 mb-1"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Résumé + Abstract + Abréviations
              </h1>
              <p className="text-xs text-gray-400">
                Ces pages précèdent le sommaire dans ton rapport final.
              </p>
            </motion.div>

            {/* Résumé français */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">Résumé français</label>
                <span
                  className={`text-xs font-medium ${
                    resumeWords > MAX_WORDS ? "text-red-500" : "text-gray-400"
                  }`}
                >
                  {resumeWords} / {MAX_WORDS} mots
                </span>
              </div>
              <textarea
                value={resume}
                onChange={(e) => setResumeSync(e.target.value)}
                rows={6}
                placeholder="Présentez votre travail en français — contexte, méthodologie, résultats principaux, conclusion."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300"
              />
              <button
                onClick={handleLaisserIA}
                disabled={generatingResume}
                className="mt-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3" />
                {generatingResume ? "Génération IA..." : "Laisser l'IA décider"}
              </button>
            </div>

            {/* Mots-clés FR */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mots-clés français{" "}
                <span className="text-xs font-normal text-gray-400">(max 5)</span>
              </label>
              <ChipList
                chips={motsCles}
                setChips={setMotsClesSync}
                max={5}
                placeholder="Ajouter..."
              />
            </div>

            {/* Abstract English */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">Abstract (English)</label>
                <span
                  className={`text-xs font-medium ${
                    abstractWords > MAX_WORDS ? "text-red-500" : "text-gray-400"
                  }`}
                >
                  {abstractWords} / {MAX_WORDS} mots
                </span>
              </div>
              <textarea
                value={abstract}
                onChange={(e) => setAbstractSync(e.target.value)}
                rows={6}
                placeholder="Present your work in English — context, methodology, main results, conclusion."
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300"
              />
              <button
                onClick={handleAbstractIA}
                disabled={generatingAbstract || !resume}
                className="mt-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3" />
                {generatingAbstract ? "Traduction IA..." : "Traduire depuis le résumé"}
              </button>
            </div>

            {/* Keywords EN */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Keywords (English){" "}
                <span className="text-xs font-normal text-gray-400">(max 5)</span>
              </label>
              <ChipList
                chips={keywords}
                setChips={setKeywordsSync}
                max={5}
                placeholder="Add keyword..."
              />
            </div>

            {/* Abréviations */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Liste des abréviations
                </label>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-2 bg-gray-50 border-b border-gray-200 px-3 py-2">
                  <span className="text-xs font-semibold text-gray-500">Abréviation</span>
                  <span className="text-xs font-semibold text-gray-500">Signification</span>
                </div>
                {abrevs.length === 0 && (
                  <p className="px-3 py-3 text-xs text-gray-300 italic">
                    Aucune abréviation ajoutée
                  </p>
                )}
                {abrevs.map((row, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-2 px-3 py-2 border-b border-gray-100 group hover:bg-gray-50"
                  >
                    <span className="text-xs font-bold text-gray-700">{row.abbr}</span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{row.sig}</span>
                      <button
                        onClick={() => setAbrevsSync(abrevs.filter((_, j) => j !== i))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-2 px-3 py-2 gap-2">
                  <input
                    value={newAbbr}
                    onChange={(e) => setNewAbbr(e.target.value)}
                    placeholder="MPT"
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300"
                  />
                  <div className="flex gap-1">
                    <input
                      value={newSig}
                      onChange={(e) => setNewSig(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addAbrev()}
                      placeholder="Signification"
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300"
                    />
                    <button
                      onClick={addAbrev}
                      className="w-7 h-7 bg-purple-600 text-white rounded-lg flex items-center justify-center hover:bg-purple-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky button */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex-shrink-0">
            <Button
              onClick={() => setLocation("/rapport/step-5")}
              className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
              style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
            >
              Suivant — Sommaire <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* RIGHT — Word preview 62% */}
        <div className="flex-1 overflow-hidden">
          <WordPreview
            content={previewContent || undefined}
            rawContent={resume || undefined}
            sectionTitle="Résumé"
            wordCount={previewWordCount}
            sectionId="resume"
          />
        </div>
      </div>
    </StepLayout>
  );
}
