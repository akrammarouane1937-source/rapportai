import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart2, ImageIcon, Trash2, ArrowRight, Plus } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { getApprovedFigures, removeApprovedFigure, type ApprovedFigure } from "@/lib/figureStore";

const PLACEMENT_COLORS: Record<string, string> = {
  "Partie I":  "bg-blue-50 text-blue-700",
  "Partie II": "bg-orange-50 text-orange-700",
};

const TYPE_LABELS: Record<string, string> = {
  bar:      "Barres",
  line:     "Courbes",
  pie:      "Camembert",
  doughnut: "Anneau",
};

function FigureCard({ fig, onRemove }: { fig: ApprovedFigure; onRemove: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {/* Figure preview */}
      <div className="bg-gray-50 flex items-center justify-center p-4 border-b border-gray-100" style={{ height: 160 }}>
        <img
          src={fig.pngBase64}
          alt={fig.title}
          style={{ maxHeight: 140, maxWidth: "100%", objectFit: "contain" }}
        />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-400 mb-0.5">Figure {fig.figureNumber}</p>
            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{fig.title}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLACEMENT_COLORS[fig.placement]}`}>
            {fig.placement}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {TYPE_LABELS[fig.type] ?? fig.type}
          </span>
        </div>

        <p className="text-xs text-gray-500 italic line-clamp-2 mb-3">{fig.caption}</p>

        <div className="flex items-center justify-end">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Annuler
              </button>
              <button
                onClick={onRemove}
                className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors"
              >
                Confirmer
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-20 h-20 bg-purple-50 rounded-3xl flex items-center justify-center mb-5">
        <ImageIcon className="w-9 h-9 text-purple-300" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        Aucune figure approuvée
      </h2>
      <p className="text-gray-500 text-sm max-w-sm mb-6">
        Les figures sont générées dans les pages Partie I et Partie II. Une fois approuvées, elles apparaissent ici et sont intégrées automatiquement dans ton rapport Word.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/rapport/partie-i">
          <Button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="w-4 h-4" /> Aller à Partie I
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
        <Link href="/rapport/partie-ii">
          <Button variant="outline" className="flex items-center gap-2 border-purple-200 text-purple-600 hover:bg-purple-50">
            <Plus className="w-4 h-4" /> Aller à Partie II
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

export default function FiguresPage() {
  const [figures, setFigures] = useState<ApprovedFigure[]>([]);

  useEffect(() => {
    setFigures(getApprovedFigures());
  }, []);

  const handleRemove = (id: string) => {
    removeApprovedFigure(id);
    setFigures(getApprovedFigures());
  };

  const parteI  = figures.filter((f) => f.placement === "Partie I");
  const parteII = figures.filter((f) => f.placement === "Partie II");

  return (
    <div className="flex min-h-screen bg-[#f9f8ff]">
      <Sidebar />
      <SidebarSpacer />
      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="flex items-center justify-between mb-7">
              <div>
                <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Figures & Graphiques
                </h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  {figures.length === 0
                    ? "Aucune figure approuvée pour l'instant"
                    : `${figures.length} figure${figures.length !== 1 ? "s" : ""} approuvée${figures.length !== 1 ? "s" : ""} — intégrées dans le rapport Word`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/rapport/partie-i">
                  <Button variant="outline" size="sm" className="border-purple-200 text-purple-600 hover:bg-purple-50 gap-1.5">
                    <BarChart2 className="w-4 h-4" /> Partie I
                  </Button>
                </Link>
                <Link href="/rapport/partie-ii">
                  <Button variant="outline" size="sm" className="border-purple-200 text-purple-600 hover:bg-purple-50 gap-1.5">
                    <BarChart2 className="w-4 h-4" /> Partie II
                  </Button>
                </Link>
              </div>
            </div>

            {figures.length === 0 ? (
              <div className="grid">
                <EmptyState />
              </div>
            ) : (
              <>
                {parteI.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      Partie I — {parteI.length} figure{parteI.length !== 1 ? "s" : ""}
                    </h2>
                    <AnimatePresence mode="popLayout">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {parteI.map((fig) => (
                          <FigureCard key={fig.id} fig={fig} onRemove={() => handleRemove(fig.id)} />
                        ))}
                      </div>
                    </AnimatePresence>
                  </div>
                )}

                {parteII.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                      Partie II — {parteII.length} figure{parteII.length !== 1 ? "s" : ""}
                    </h2>
                    <AnimatePresence mode="popLayout">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {parteII.map((fig) => (
                          <FigureCard key={fig.id} fig={fig} onRemove={() => handleRemove(fig.id)} />
                        ))}
                      </div>
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
