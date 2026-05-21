import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageIcon, Trash2, Upload, X, Check, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import {
  getApprovedFigures,
  addApprovedFigure,
  removeApprovedFigure,
  buildFormattedSource,
  type ApprovedFigure,
  type FigureSourceType,
} from "@/lib/figureStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLACEMENT_COLORS: Record<string, string> = {
  "Partie I":  "bg-blue-50 text-blue-700 border border-blue-100",
  "Partie II": "bg-orange-50 text-orange-700 border border-orange-100",
};

const API = import.meta.env.VITE_API_URL ?? "";

// ─── Extracted figure from backend ───────────────────────────────────────────

interface ExtractedFigure {
  page:              number;
  image_base64:      string;
  mime_type:         string;
  type:              string;
  auto_description:  string;
  suggested_caption: string;
  suggested_source:  string;
}

// ─── Caption Builder ──────────────────────────────────────────────────────────
// Shared by both upload modal and extraction flow.

interface CaptionBuilderProps {
  preview: string;
  nextNumber: number;
  prefillTitle?: string;
  prefillSource?: string;
  prefillDocTitle?: string;
  onSave: (fig: ApprovedFigure) => void;
  onCancel: () => void;
  saving?: boolean;
}

function CaptionBuilder({
  preview, nextNumber, prefillTitle = "", prefillSource = "", prefillDocTitle = "",
  onSave, onCancel, saving = false,
}: CaptionBuilderProps) {
  const [title,         setTitle]         = useState(prefillTitle);
  const [sourceType,    setSourceType]    = useState<FigureSourceType>("self");
  const [author,        setAuthor]        = useState("");
  const [documentTitle, setDocumentTitle] = useState(prefillDocTitle);
  const [year,          setYear]          = useState(new Date().getFullYear().toString());
  const [pageRef,       setPageRef]       = useState("");
  const [placement,     setPlacement]     = useState<"Partie I" | "Partie II">("Partie I");

  // Pre-fill source from extraction suggestion
  useEffect(() => {
    if (prefillSource && prefillSource !== "Source : [À compléter par l'auteur]") {
      // Try to detect type from suggestion
      if (prefillSource.includes("Élaboré par l'auteur")) setSourceType("self");
      else if (prefillSource.includes("adapté par l'auteur")) setSourceType("framework");
    }
  }, [prefillSource]);

  const formattedSource = buildFormattedSource({ sourceType, author, documentTitle, yearCreated: year, pageRef });

  const canSave = title.trim() && (sourceType === "self" || author.trim());

  const handleSave = () => {
    if (!canSave) return;
    const img = new Image();
    const finish = (w: number, h: number) => {
      const fig: ApprovedFigure = {
        id:              `fig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        figureNumber:    nextNumber,
        title:           title.trim(),
        caption:         `Figure ${nextNumber} — ${title.trim()}\n${formattedSource}`,
        type:            "uploaded",
        placement,
        description:     title.trim(),
        sourceType,
        source:          author.trim() || "Auteur",
        author:          author.trim() || "Auteur",
        documentTitle:   documentTitle.trim() || undefined,
        yearCreated:     year,
        pageRef:         pageRef.trim() || undefined,
        formattedSource,
        pngBase64:       preview,
        labels:          [],
        series:          [],
        width:           w,
        height:          h,
      };
      onSave(fig);
    };
    img.onload  = () => finish(img.naturalWidth || 600, img.naturalHeight || 400);
    img.onerror = () => finish(600, 400);
    img.src = preview;
  };

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center" style={{ height: 140 }}>
        <img src={preview} alt="preview" className="max-h-full max-w-full object-contain" />
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Titre de la figure <span className="text-red-400">*</span></label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Évolution du chiffre d'affaires 2020–2024"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>

      {/* Source type */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">Type de source <span className="text-red-400">*</span></label>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            ["self",      "Je l'ai créé"],
            ["document",  "Document (livre/article)"],
            ["web",       "Source internet"],
            ["framework", "Modèle académique"],
          ] as [FigureSourceType, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setSourceType(val)}
              className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-left ${
                sourceType === val
                  ? "bg-purple-50 border-purple-300 text-purple-700"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conditional source fields */}
      {sourceType !== "self" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              {sourceType === "framework" ? "Nom du modèle / auteur" : "Auteur / Organisation"} <span className="text-red-400">*</span>
            </label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder={sourceType === "framework" ? "Ex: Porter, M.E." : "Ex: Bank Al-Maghrib"}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          {sourceType === "document" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Titre du document</label>
                <input
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="Titre du livre/rapport"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Page</label>
                <input
                  value={pageRef}
                  onChange={(e) => setPageRef(e.target.value)}
                  placeholder="Ex: 42"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Année</label>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2023"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
        </div>
      )}

      {/* Caption preview */}
      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
        <p className="text-xs font-semibold text-gray-500 mb-1">Aperçu de la légende :</p>
        <p className="text-xs text-gray-800 font-medium">Figure {nextNumber} — {title || "[Titre]"}</p>
        <p className="text-xs text-gray-500 italic">{formattedSource}</p>
      </div>

      {/* Placement */}
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

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 font-medium px-4 py-2">
          Ignorer
        </button>
        <Button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="bg-purple-600 hover:bg-purple-700 text-white gap-2 rounded-xl"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Ajout…</> : <><Check className="w-4 h-4" /> Ajouter au rapport</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Upload Modal (image upload tab) ─────────────────────────────────────────

interface UploadModalProps {
  onClose:    () => void;
  onAdded:    () => void;
  nextNumber: number;
}

function UploadModal({ onClose, onAdded, nextNumber }: UploadModalProps) {
  const [tab,         setTab]         = useState<"image" | "document">("image");
  // Image upload state
  const [preview,     setPreview]     = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef  = useRef<HTMLInputElement>(null);
  // Document extraction state
  const [extracting,  setExtracting]  = useState(false);
  const [extracted,   setExtracted]   = useState<ExtractedFigure[]>([]);
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [docTitle,    setDocTitle]    = useState("");
  const [nextNum,     setNextNum]     = useState(nextNumber);

  const [dragOver, setDragOver] = useState(false);

  const loadImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDocumentUpload = async (file: File) => {
    setExtracting(true);
    setExtracted([]);
    setDocTitle(file.name.replace(/\.[^.]+$/, ""));
    try {
      const formData = new FormData();
      formData.append("document", file);
      const resp = await fetch(`${API}/api/figures/extract`, { method: "POST", body: formData });
      const data = await resp.json() as { figures: ExtractedFigure[]; count: number };
      setExtracted(data.figures ?? []);
      setCurrentIdx(0);
    } catch {
      alert("Extraction échouée. Réessaie ou uploade les images directement.");
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveFigure = (fig: ApprovedFigure) => {
    setSaving(true);
    addApprovedFigure(fig);
    setSaving(false);
    onAdded();
    if (tab === "image") {
      onClose();
    } else {
      // Advance to next extracted figure
      if (currentIdx + 1 < extracted.length) {
        setCurrentIdx((i) => i + 1);
        setNextNum((n) => n + 1);
      } else {
        onClose();
      }
    }
  };

  const currentFig = extracted[currentIdx];

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

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {([["image", "Image directe"], ["document", "Extraire d'un PDF/Word"]] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === t ? "text-purple-700 border-b-2 border-purple-500" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 max-h-[80vh] overflow-y-auto">
          {/* ── TAB: Image directe ── */}
          {tab === "image" && (
            <>
              {!preview ? (
                <div
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) loadImageFile(f); }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors mb-4 ${
                    dragOver ? "border-purple-400 bg-purple-50" : "border-gray-200 hover:border-purple-300 hover:bg-gray-50"
                  }`}
                  style={{ height: 150 }}
                >
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Upload className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700">Glisse ton image ici</p>
                    <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, SVG</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) loadImageFile(f); }} />
                </div>
              ) : (
                <CaptionBuilder
                  preview={preview}
                  nextNumber={nextNumber}
                  onSave={handleSaveFigure}
                  onCancel={onClose}
                  saving={saving}
                />
              )}
            </>
          )}

          {/* ── TAB: Document extraction ── */}
          {tab === "document" && (
            <>
              {!extracting && extracted.length === 0 && (
                <div
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleDocumentUpload(f); }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => docRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-gray-50 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors"
                  style={{ height: 200 }}
                >
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700">Uploade ton document</p>
                    <p className="text-xs text-gray-400 mt-0.5">PDF, Word (.docx), PowerPoint (.pptx) — max 20 MB</p>
                    <p className="text-xs text-gray-400 mt-0.5">L'IA extrait toutes les figures avec leurs légendes suggérées</p>
                  </div>
                  <input ref={docRef} type="file" accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocumentUpload(f); }} />
                </div>
              )}

              {extracting && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700">Extraction en cours…</p>
                    <p className="text-xs text-gray-400 mt-1">L'IA analyse chaque page pour détecter les figures</p>
                  </div>
                </div>
              )}

              {!extracting && extracted.length === 0 && false && (
                <p className="text-center text-sm text-gray-400 mt-4">Aucune figure détectée dans ce document.</p>
              )}

              {!extracting && extracted.length > 0 && currentFig && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500">
                      Figure {currentIdx + 1} sur {extracted.length} — Page {currentFig.page}
                    </p>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{currentFig.type}</span>
                  </div>
                  <p className="text-xs text-gray-500 italic mb-3">{currentFig.auto_description}</p>
                  <CaptionBuilder
                    preview={currentFig.image_base64}
                    nextNumber={nextNum}
                    prefillTitle={currentFig.suggested_caption.replace(/^Figure — /, "")}
                    prefillSource={currentFig.suggested_source}
                    prefillDocTitle={docTitle}
                    onSave={handleSaveFigure}
                    onCancel={() => {
                      if (currentIdx + 1 < extracted.length) {
                        setCurrentIdx((i) => i + 1);
                      } else {
                        onClose();
                      }
                    }}
                    saving={saving}
                  />
                </div>
              )}
            </>
          )}
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

        {/* Formatted source line */}
        <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2">
          <p className="text-xs text-gray-500 italic line-clamp-2">{fig.formattedSource || fig.source}</p>
        </div>

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
                    : `${figures.length} figure${figures.length !== 1 ? "s" : ""} — intégrées automatiquement dans le rapport Word avec sources`}
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
                  Uploade une image directement ou importe un PDF/Word — l'IA extrait toutes les figures et génère les légendes avec attribution de source.
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
