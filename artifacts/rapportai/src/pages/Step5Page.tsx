import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { GripVertical, ArrowRight, Info, ChevronUp, ChevronDown, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepLayout } from "@/components/report/StepLayout";

type SommaireItem = {
  id: string;
  level: 1 | 2 | 3;
  title: string;
  page: number;
};

const INITIAL_ITEMS: SommaireItem[] = [
  { id: "intro", level: 1, title: "Introduction Générale", page: 3 },
  { id: "p1", level: 1, title: "Partie I — Cadre théorique et empirique", page: 6 },
  { id: "p1c1", level: 2, title: "Chapitre 1 — Revue de littérature", page: 7 },
  { id: "p1c1s1", level: 3, title: "1.1 Théorie moderne du portefeuille", page: 7 },
  { id: "p1c1s2", level: 3, title: "1.2 Hypothèse d'efficience des marchés", page: 10 },
  { id: "p1c2", level: 2, title: "Chapitre 2 — Méthodologie", page: 13 },
  { id: "p1c2s1", level: 3, title: "2.1 Collecte et traitement des données", page: 13 },
  { id: "p1c2s2", level: 3, title: "2.2 Modèle d'optimisation retenu", page: 16 },
  { id: "p2", level: 1, title: "Partie II — Résultats et analyse", page: 19 },
  { id: "p2c1", level: 2, title: "Chapitre 3 — Construction du portefeuille optimal", page: 20 },
  { id: "p2c1s1", level: 3, title: "3.1 Frontière efficiente", page: 20 },
  { id: "p2c1s2", level: 3, title: "3.2 Analyse de sensibilité", page: 23 },
  { id: "p2c2", level: 2, title: "Chapitre 4 — Discussion et recommandations", page: 27 },
  { id: "concl", level: 1, title: "Conclusion Générale", page: 31 },
  { id: "biblio", level: 1, title: "Bibliographie", page: 34 },
  { id: "annexes", level: 1, title: "Annexes", page: 38 },
];

const LEVEL_STYLES: Record<number, string> = {
  1: "font-bold text-gray-900 text-sm",
  2: "font-medium text-gray-700 text-sm",
  3: "text-gray-500 text-xs",
};
const LEVEL_INDENT: Record<number, string> = {
  1: "pl-0",
  2: "pl-5",
  3: "pl-10",
};

export default function Step5Page() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<SommaireItem[]>(INITIAL_ITEMS);
  const [dragging, setDragging] = useState<string | null>(null);

  const move = (id: string, dir: -1 | 1) => {
    const idx = items.findIndex(i => i.id === id);
    if (idx + dir < 0 || idx + dir >= items.length) return;
    const next = [...items];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    setItems(next);
  };

  return (
    <StepLayout stepId={5}>
      <div className="max-w-3xl mx-auto px-8 py-8 pb-32">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* Info banner */}
          <div className="flex items-start gap-3 bg-purple-50 border border-purple-100 rounded-2xl p-4 mb-8">
            <Info className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-purple-700">
              Le sommaire est généré automatiquement depuis la structure de votre rapport.
              Vous pouvez réorganiser les sections avec les flèches.
            </p>
          </div>

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Sommaire</h1>
            <button className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-xl transition-colors">
              <Eye className="w-4 h-4" /> Aperçu Word
            </button>
          </div>

          {/* Sommaire items */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                layout
                className={`flex items-center gap-3 px-5 py-3 border-b border-gray-50 group hover:bg-gray-50 transition-colors ${dragging === item.id ? "bg-purple-50/50" : ""}`}
              >
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 cursor-grab" />

                <div className={`flex-1 flex items-center min-w-0 ${LEVEL_INDENT[item.level]}`}>
                  <span className={`truncate flex-1 ${LEVEL_STYLES[item.level]}`}>{item.title}</span>
                  <div className="flex-1 mx-3 border-b border-dotted border-gray-300 min-w-8" />
                  <span className="text-xs text-gray-400 flex-shrink-0 font-medium w-6 text-right">{item.page}</span>
                </div>

                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => move(item.id, -1)} disabled={idx === 0} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-30">
                    <ChevronUp className="w-3 h-3 text-gray-500" />
                  </button>
                  <button onClick={() => move(item.id, 1)} disabled={idx === items.length - 1} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-30">
                    <ChevronDown className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Sticky bottom */}
      <div className="fixed bottom-0 right-0 bg-white border-t border-gray-100 px-8 py-4 z-30" style={{ left: 60 }}>
        <div className="max-w-3xl mx-auto flex items-center justify-end">
          <Button onClick={() => setLocation("/rapport/step-6")}
            className="bg-purple-600 hover:bg-purple-700 text-white h-11 px-6 rounded-xl font-semibold text-sm flex items-center gap-2"
            style={{ boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}>
            Suivant — Introduction Générale <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </StepLayout>
  );
}
