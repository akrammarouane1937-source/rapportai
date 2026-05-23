import { useState } from "react";
import { useLocation } from "wouter";
import { useReportStore } from "@/lib/store";
import { Layout } from "@/components/layout";
import { Plus, Trash2, ChevronLeft, ChevronRight, Paperclip } from "lucide-react";
import type { AnnexeItem } from "@/lib/store";

const LETTER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export default function AnnexesPage() {
  const { report, updateReport } = useReportStore();
  const [, setLocation] = useLocation();
  const items: AnnexeItem[] = report.annexeItems ?? [];

  const setItems = (next: AnnexeItem[]) => updateReport({ annexeItems: next });

  const add = () =>
    setItems([...items, { title: "", content: "" }]);

  const remove = (i: number) =>
    setItems(items.filter((_, idx) => idx !== i));

  const update = (i: number, field: keyof AnnexeItem, value: string) =>
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const hasContent = items.some((a) => a.title.trim() || a.content.trim());

  return (
    <Layout stepName="Annexes" stepNumber={8}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
              >
                <Paperclip className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Annexes
                </h1>
                <p className="text-sm text-gray-500">
                  Questionnaires, données brutes, captures d'écran, guides d'entretien…
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-3 leading-relaxed pl-12">
              Chaque annexe sera numérotée automatiquement (Annexe A, B, C…) et placée à la fin du rapport, après la bibliographie. Si tu n'as pas d'annexes, passe directement à l'étape suivante.
            </p>
          </div>

          {/* Annexe cards */}
          <div className="space-y-4">
            {items.map((item, i) => (
              <div
                key={i}
                className="rounded-xl p-5"
                style={{ border: "1px solid #ede9fe", background: "#fafafa" }}
              >
                {/* Card header */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "#7c3aed", color: "#fff", letterSpacing: "0.05em" }}
                  >
                    Annexe {LETTER[i] ?? i + 1}
                  </span>
                  <button
                    onClick={() => remove(i)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Title */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Titre de l'annexe
                  </label>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => update(i, "title", e.target.value)}
                    placeholder="ex : Questionnaire de satisfaction client"
                    className="w-full px-3 py-2 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 outline-none transition-all"
                    style={{
                      border: "1px solid #e9d5ff",
                      background: "#fff",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#7c3aed")}
                    onBlur={(e) => (e.target.style.borderColor = "#e9d5ff")}
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Contenu / Description
                  </label>
                  <textarea
                    value={item.content}
                    onChange={(e) => update(i, "content", e.target.value)}
                    placeholder="Colle ici le contenu de l'annexe, ou décris ce qu'elle contient si tu l'insères manuellement dans le Word final…"
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 outline-none resize-y transition-all"
                    style={{
                      border: "1px solid #e9d5ff",
                      background: "#fff",
                      lineHeight: "1.6",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#7c3aed")}
                    onBlur={(e) => (e.target.style.borderColor = "#e9d5ff")}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Markdown supporté — tu peux utiliser des tableaux, listes, titres.
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Add button */}
          <button
            onClick={add}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              border: "2px dashed #c4b5fd",
              color: "#7c3aed",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#f5f0ff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <Plus className="w-4 h-4" />
            Ajouter une annexe
          </button>

          {/* Empty state hint */}
          {items.length === 0 && (
            <p className="text-center text-sm text-gray-400 mt-6">
              Aucune annexe — clique sur le bouton ci-dessus pour en ajouter, ou passe directement à la conclusion.
            </p>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10 pt-6" style={{ borderTop: "1px solid #f3f4f6" }}>
            <button
              onClick={() => setLocation("/rapport/partie-ii")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Partie II
            </button>

            <div className="text-center">
              {hasContent && (
                <p className="text-xs text-purple-600 font-medium mb-1">
                  {items.filter((a) => a.title.trim()).length} annexe{items.filter((a) => a.title.trim()).length !== 1 ? "s" : ""} enregistrée{items.filter((a) => a.title.trim()).length !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            <button
              onClick={() => { updateReport({ currentStep: 9 }); setLocation("/rapport/step-9"); }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 2px 10px rgba(124,58,237,0.3)" }}
            >
              Conclusion & Export
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </Layout>
  );
}
