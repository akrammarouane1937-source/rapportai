import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageIcon, Trash2, Upload, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import {
  getApprovedFigures,
  addApprovedFigure,
  removeApprovedFigure,
  type ApprovedFigure,
} from "@/lib/figureStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLACEMENT_COLORS: Record<string, string> = {
  "Partie I":  "bg-blue-50 text-blue-700 border border-blue-100",
  "Partie II": "bg-orange-50 text-orange-700 border border-orange-100",
};

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  onClose: () => void;
  onAdded: () => void;
  nextNumber: number;
}

function UploadModal({ onClose, onAdded, nextNumber }: UploadModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle]     = useState("");
  const [caption, setCaption] = useState("");
  const [source, setSource]   = useState("");
  const [author, setAuthor]   = useState("");
  const [placement, setPlacement] = useState<"Partie I" | "Partie II">("Partie I");
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const canSave = preview && title.trim() && source.trim() && author.trim();

  const handleSave = () => {
    if (!canSave) return;
    setSaving(true);

    // Measure image dimensions
    const img = new Image();
    img.onload = () => {
      const fig: ApprovedFigure = {
        id: `uploaded-${Date.now()}`,
        figureNumber: nextNumber,
        title: title.trim(),
        caption: caption.trim() || title.trim(),
        type: "uploaded",
        placement,
        description: caption.trim() || title.trim(),
        source: source.trim(),
        author: author.trim(),
        pngBase64: preview!,
        labels: [],
        series: [],
        width: img.naturalWidth || 600,
        height: img.naturalHeight || 400,
      };
      addApprovedFigure(fig);
      setSaving(false);
      onAdded();
      onClose();
    };
    img.onerror = () => {
      // fallback if image fails to load dimensions
      const fig: ApprovedFigure = {
        id: `uploaded-${Date.now()}`,
        figureNumber: nextNumber,
        title: title.trim(),
        caption: caption.trim() || title.trim(),
        type: "uploaded",
        placement,
        description: caption.trim() || title.trim(),
        source: source.trim(),
        author: author.trim(),
        pngBase64: preview!,
        labels: [],
        series: [],
        width: 600,
        height: 400,
      };
      addApprovedFigure(fig);
      setSaving(false);
      onAdded();
      onClose();
    };
    img.src = preview!;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Ajouter une figure
          </h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Image drop zone */}
          {!preview ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                dragOver ? "border-purple-400 bg-purple-50" : "border-gray-200 hover:border-purple-300 hover:bg-gray-50"
              }`}
              style={{ height: 160 }}
            >
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <Upload className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">Glisse ton image ici</p>
                <p className="text-xs text-gray-400 mt-0.5">ou clique pour sélectionner (PNG, JPG, SVG)</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
              />
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-gray-50 border border-gray-100" style={{ height: 160 }}>
              <img src={preview} alt="preview" className="w-full h-full object-contain" />
              <button
                onClick={() => setPreview(null)}
                className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center text-gray-500 hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Titre de la figure <span className="text-red-400">*</span></label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Évolution du chiffre d'affaires 2020–2023"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
            />
          </div>

          {/* Caption */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Légende <span className="text-gray-400">(optionnel)</span></label>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Ex: La figure illustre la progression du CA sur 4 ans"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
            />
          </div>

          {/* Source */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Source <span className="text-red-400">*</span></label>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Ex: Rapport annuel 2023, Office des Changes"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
            />
          </div>

          {/* Author */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Auteur <span className="text-red-400">*</span></label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ex: Direction financière, ou 'Auteur propre'"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
            />
          </div>

          {/* Partie selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Quelle partie ? <span className="text-red-400">*</span></label>
            <div className="flex gap-2">
              {(["Partie I", "Partie II"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlacement(p)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    placement === p
                      ? p === "Partie I"
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-orange-50 border-orange-300 text-orange-700"
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 font-medium px-4 py-2">
            Annuler
          </button>
          <Button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2 rounded-xl"
          >
            {saving ? "Ajout..." : <><Check className="w-4 h-4" /> Valider la figure</>}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Figure Card ──────────────────────────────────────────────────────────────

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
      <div className="bg-gray-50 flex items-center justify-center p-3 border-b border-gray-100" style={{ height: 150 }}>
        <img src={fig.pngBase64} alt={fig.title} style={{ maxHeight: 130, maxWidth: "100%", objectFit: "contain" }} />
      </div>

      <div className="p-4">
        <p className="text-xs font-bold text-gray-400 mb-0.5">Figure {fig.figureNumber}</p>
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 mb-2">{fig.title}</p>

        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLACEMENT_COLORS[fig.placement]}`}>
            {fig.placement}
          </span>
        </div>

        {/* Source / Author */}
        {(fig.source || fig.author) && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2 space-y-0.5">
            {fig.source && (
              <p className="text-xs text-gray-500 truncate">
                <span className="font-semibold text-gray-600">Source :</span> {fig.source}
              </p>
            )}
            {fig.author && (
              <p className="text-xs text-gray-500 truncate">
                <span className="font-semibold text-gray-600">Auteur :</span> {fig.author}
              </p>
            )}
          </div>
        )}

        {fig.caption && <p className="text-xs text-gray-400 italic line-clamp-2 mb-3">{fig.caption}</p>}

        <div className="flex items-center justify-end">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 hover:text-gray-700">Annuler</button>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FiguresPage() {
  const [figures, setFigures] = useState<ApprovedFigure[]>([]);
  const [showModal, setShowModal] = useState(false);

  const reload = () => setFigures(getApprovedFigures());

  useEffect(() => { reload(); }, []);

  const handleRemove = (id: string) => {
    removeApprovedFigure(id);
    reload();
  };

  const partieI  = figures.filter((f) => f.placement === "Partie I");
  const partieII = figures.filter((f) => f.placement === "Partie II");
  const nextNumber = figures.length + 1;

  return (
    <div className="flex min-h-screen bg-[#f9f8ff]">
      <Sidebar />
      <SidebarSpacer />
      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

            {/* Header */}
            <div className="flex items-center justify-between mb-7">
              <div>
                <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Figures & Graphiques
                </h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  {figures.length === 0
                    ? "Aucune figure ajoutée pour l'instant"
                    : `${figures.length} figure${figures.length !== 1 ? "s" : ""} — intégrées automatiquement dans le rapport Word`}
                </p>
              </div>
              <Button
                onClick={() => setShowModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white gap-2 rounded-xl shadow-md shadow-purple-100"
              >
                <Upload className="w-4 h-4" /> Ajouter une figure
              </Button>
            </div>

            {/* Content */}
            {figures.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-24 text-center"
              >
                <div className="w-20 h-20 bg-purple-50 rounded-3xl flex items-center justify-center mb-5">
                  <ImageIcon className="w-9 h-9 text-purple-300" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Aucune figure pour l'instant
                </h2>
                <p className="text-gray-500 text-sm max-w-sm mb-6">
                  Uploade tes graphiques, tableaux ou captures d'écran. Précise la source, l'auteur et la partie. Elles seront intégrées automatiquement dans ton rapport Word avec la liste des figures.
                </p>
                <Button onClick={() => setShowModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white gap-2 rounded-xl">
                  <Upload className="w-4 h-4" /> Ajouter ma première figure
                </Button>
              </motion.div>
            ) : (
              <>
                {partieI.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      Partie I — {partieI.length} figure{partieI.length !== 1 ? "s" : ""}
                    </h2>
                    <AnimatePresence mode="popLayout">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {partieI.map((fig) => (
                          <FigureCard key={fig.id} fig={fig} onRemove={() => handleRemove(fig.id)} />
                        ))}
                      </div>
                    </AnimatePresence>
                  </div>
                )}

                {partieII.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                      Partie II — {partieII.length} figure{partieII.length !== 1 ? "s" : ""}
                    </h2>
                    <AnimatePresence mode="popLayout">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {partieII.map((fig) => (
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

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <UploadModal
            onClose={() => setShowModal(false)}
            onAdded={reload}
            nextNumber={nextNumber}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
