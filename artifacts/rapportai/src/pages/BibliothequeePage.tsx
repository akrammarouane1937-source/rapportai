import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Link2, BookMarked, Search, Trash2, Plus, X,
  Loader2, ChevronRight, ExternalLink, BookOpen, Check, AlertCircle,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarSpacer } from "@/components/layout/Sidebar";
import { getReport } from "@/lib/reportStore";
import {
  getBibSources, addBibSource, removeBibSource, parseBib,
  fetchDoi, makeId, detectUsedIn,
  type BibSource,
} from "@/lib/bibliothequeStore";

// ─── Stacked cards illustration ───────────────────────────────────────────────

function StackedCards() {
  return (
    <div className="relative h-40 w-52 mx-auto mb-8 select-none">
      <div
        className="absolute inset-0 bg-white rounded-2xl shadow-lg p-3 origin-bottom"
        style={{ transform: "rotate(-14deg) translate(-18px, 14px)", border: "1px solid #f0f0f0" }}
      >
        <div className="h-5 rounded-md mb-2 flex items-center px-2" style={{ background: "#e8501b" }}>
          <span className="text-white text-[10px] font-black tracking-wide">Springer</span>
        </div>
        {[80, 65, 75, 55].map((w, i) => (
          <div key={i} className="h-1.5 bg-gray-100 rounded-full mb-1.5" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div
        className="absolute inset-0 bg-white rounded-2xl shadow-lg p-3 origin-bottom"
        style={{ transform: "rotate(11deg) translate(18px, 10px)", border: "1px solid #f0f0f0" }}
      >
        <div className="h-5 rounded-md mb-2 flex items-center px-2" style={{ background: "#b5121b" }}>
          <span className="text-white text-[10px] font-black tracking-wide">arXiv</span>
        </div>
        {[70, 80, 60, 50].map((w, i) => (
          <div key={i} className="h-1.5 bg-gray-100 rounded-full mb-1.5" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="absolute inset-0 bg-white rounded-2xl shadow-lg p-3" style={{ border: "1px solid #f0f0f0" }}>
        <div className="h-5 rounded-md mb-2 flex items-center px-2" style={{ background: "#1a1a3e" }}>
          <span className="text-white text-[10px] font-black tracking-wide italic">nature</span>
        </div>
        <div className="h-4 bg-purple-100 rounded-md mb-2" />
        {[90, 75, 85].map((w, i) => (
          <div key={i} className="h-1.5 bg-gray-100 rounded-full mb-1.5" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Method row ───────────────────────────────────────────────────────────────

function MethodRow({
  icon, label, onClick, badge,
}: { icon: React.ReactNode; label: string; onClick: () => void; badge?: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-left transition-all group bg-white hover:bg-purple-50"
      style={{ border: "1px solid #e9d5ff" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#c084fc")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e9d5ff")}
    >
      <span className="text-purple-500 flex-shrink-0">{icon}</span>
      <span className="flex-1 text-sm font-medium text-gray-700 group-hover:text-purple-700">{label}</span>
      {badge && (
        <span className="text-[10px] bg-purple-100 text-purple-600 border border-purple-200 px-2 py-0.5 rounded-full font-semibold">
          {badge}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-400 transition-colors" />
    </button>
  );
}

// ─── DOI input modal ──────────────────────────────────────────────────────────

function DoiModal({ onClose, onSave }: { onClose: () => void; onSave: (s: BibSource) => void }) {
  const [doi, setDoi] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Partial<BibSource> | null>(null);

  const handleFetch = async () => {
    if (!doi.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDoi(doi.trim());
      setPreview(data);
    } catch {
      setError("DOI introuvable. Vérifiez le format (ex: 10.1000/xyz123).");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!preview) return;
    onSave({
      id: makeId(),
      title: preview.title ?? "Titre inconnu",
      authors: preview.authors ?? "Auteur inconnu",
      year: preview.year ?? "?",
      journal: preview.journal,
      doi: preview.doi,
      url: preview.url,
      type: "doi",
      usedIn: [],
      addedAt: Date.now(),
    });
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose} title="Ajouter via DOI / URL">
      <div className="space-y-3">
        <p className="text-sm text-gray-400">Ex : 10.1016/j.jfineco.2021.01.001</p>
        <div className="flex gap-2">
          <input
            autoFocus
            value={doi}
            onChange={(e) => { setDoi(e.target.value); setPreview(null); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            placeholder="DOI ou URL de l'article..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <Button
            onClick={handleFetch}
            disabled={loading || !doi.trim()}
            className="h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Rechercher"}
          </Button>
        </div>
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}
        {preview && (
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-1">
            <p className="text-sm font-semibold text-gray-900 leading-snug">{preview.title}</p>
            <p className="text-xs text-gray-500">{preview.authors}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-purple-600 font-medium">{preview.year}</span>
              {preview.journal && <span className="text-xs text-gray-400 italic">{preview.journal}</span>}
            </div>
            <Button
              onClick={handleSave}
              className="mt-3 w-full h-9 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl gap-2"
            >
              <Check className="w-3.5 h-3.5" /> Ajouter à la bibliothèque
            </Button>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

// ─── PDF details modal ────────────────────────────────────────────────────────

function PdfModal({
  fileName, onClose, onSave,
}: { fileName: string; onClose: () => void; onSave: (s: BibSource) => void }) {
  const [title, setTitle] = useState(fileName.replace(/\.pdf$/i, ""));
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [journal, setJournal] = useState("");

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: makeId(),
      title: title.trim(),
      authors: authors.trim() || "Auteur inconnu",
      year: year.trim() || "?",
      journal: journal.trim() || undefined,
      type: "pdf",
      usedIn: [],
      addedAt: Date.now(),
      fileName,
    });
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose} title="Détails du document">
      <div className="space-y-3">
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
          <FileText className="w-4 h-4 text-purple-500 flex-shrink-0" />
          <span className="text-xs text-gray-500 truncate">{fileName}</span>
        </div>
        {[
          { label: "Titre *", value: title, set: setTitle, placeholder: "Titre de l'article ou du livre" },
          { label: "Auteur(s)", value: authors, set: setAuthors, placeholder: "Nom, Prénom et al." },
          { label: "Année", value: year, set: setYear, placeholder: "2024" },
          { label: "Revue / Journal", value: journal, set: setJournal, placeholder: "Optionnel" },
        ].map(({ label, value, set, placeholder }) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <input
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
        ))}
        <Button
          onClick={handleSave}
          disabled={!title.trim()}
          className="w-full h-10 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl mt-2 gap-2"
        >
          <Plus className="w-4 h-4" /> Ajouter la source
        </Button>
      </div>
    </ModalOverlay>
  );
}

// ─── Shared modal overlay ─────────────────────────────────────────────────────

function ModalOverlay({
  onClose, title, children,
}: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md mx-4 rounded-2xl p-6 shadow-xl bg-white"
        style={{ border: "1px solid #ede9fe" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

// ─── Source card ──────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ReactNode> = {
  pdf:    <FileText className="w-4 h-4" />,
  doi:    <Link2 className="w-4 h-4" />,
  bib:    <BookMarked className="w-4 h-4" />,
  scholar: <Search className="w-4 h-4" />,
};

const USED_COLORS: Record<string, string> = {
  "Partie I":     "bg-blue-50 text-blue-600 border-blue-200",
  "Partie II":    "bg-green-50 text-green-600 border-green-200",
  "Introduction": "bg-amber-50 text-amber-600 border-amber-200",
};

function SourceCard({ source, onRemove }: { source: BibSource; onRemove: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-start gap-3 px-5 py-4 border-b border-gray-100"
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-purple-50 text-purple-500">
        {TYPE_ICON[source.type] ?? <BookOpen className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-snug mb-0.5 truncate pr-4">{source.title}</p>
        <p className="text-xs text-gray-500 mb-2">
          {source.authors}
          {source.year && source.year !== "?" && <span className="text-gray-400"> · {source.year}</span>}
          {source.journal && <span className="text-gray-400 italic"> · {source.journal}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {source.usedIn.length > 0
            ? source.usedIn.map((s) => (
                <span key={s} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${USED_COLORS[s] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
                  Utilisé dans {s}
                </span>
              ))
            : <span className="text-[10px] text-gray-400">Non encore cité</span>
          }
          {source.url && (
            <a href={source.url} target="_blank" rel="noopener noreferrer"
               className="text-[10px] text-purple-500 hover:text-purple-700 flex items-center gap-0.5 ml-1">
              DOI <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
      <button onClick={onRemove} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-1">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onMethod }: { onMethod: (m: "pdf" | "doi" | "bib" | "scholar") => void }) {
  const report = getReport();
  const scholarQuery = [report.theme, report.filiere]
    .filter(Boolean).slice(0, 2).join(" ") || "recherche académique Maroc";

  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6">
      <StackedCards />
      <h2 className="text-2xl font-black text-gray-900 mb-3 text-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        Rendez vos rapports plus pertinents
      </h2>
      <p className="text-sm text-gray-500 text-center max-w-xs leading-relaxed mb-10">
        Ajoutez vos sources et laissez RapportAI citer automatiquement dans votre rapport.
      </p>
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Méthodes les plus populaires</p>
          <div className="space-y-2">
            <MethodRow icon={<Upload className="w-4 h-4" />} label="Télécharger des fichiers PDF" onClick={() => onMethod("pdf")} />
            <MethodRow icon={<Link2 className="w-4 h-4" />}  label="Ajouter via DOI / URL"        onClick={() => onMethod("doi")} />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Autres méthodes</p>
          <div className="space-y-2">
            <MethodRow icon={<BookMarked className="w-4 h-4" />} label="Importer .bib / .ris" onClick={() => onMethod("bib")} badge=".bib" />
            <MethodRow
              icon={<Search className="w-4 h-4" />}
              label="Rechercher sur Google Scholar"
              onClick={() => window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(scholarQuery)}`, "_blank")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sources list view ────────────────────────────────────────────────────────

function SourcesView({
  sources, onRemove, onMethod,
}: { sources: BibSource[]; onRemove: (id: string) => void; onMethod: (m: "pdf" | "doi" | "bib") => void }) {
  const report = getReport();
  const scholarQuery = [report.theme, report.filiere].filter(Boolean).join(" ") || "recherche académique";

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{sources.length} source{sources.length > 1 ? "s" : ""}</h2>
          <p className="text-xs text-gray-400 mt-0.5">RapportAI citera ces sources automatiquement lors de la génération.</p>
        </div>
        <AnimatePresence mode="popLayout">
          {sources.map((s) => (
            <SourceCard key={s.id} source={s} onRemove={() => onRemove(s.id)} />
          ))}
        </AnimatePresence>
      </div>
      <div className="w-64 flex-shrink-0 p-5 space-y-5 border-l border-gray-100">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Ajouter une source</p>
          <div className="space-y-2">
            <MethodRow icon={<Upload className="w-4 h-4" />}     label="PDF"         onClick={() => onMethod("pdf")} />
            <MethodRow icon={<Link2 className="w-4 h-4" />}      label="DOI / URL"   onClick={() => onMethod("doi")} />
            <MethodRow icon={<BookMarked className="w-4 h-4" />} label=".bib / .ris" onClick={() => onMethod("bib")} />
            <MethodRow
              icon={<Search className="w-4 h-4" />}
              label="Scholar"
              onClick={() => window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(scholarQuery)}`, "_blank")}
            />
          </div>
        </div>
        <div className="rounded-xl p-3.5 bg-purple-50 border border-purple-100">
          <p className="text-xs font-bold text-purple-700 mb-1">Astuce</p>
          <p className="text-xs text-purple-500 leading-relaxed">
            Importez 2-3 PDF complets : Claude utilisera leur contenu comme sources directes dans votre rapport.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BibliothequeePage() {
  const [sources, setSources] = useState<BibSource[]>(() => {
    const report = getReport();
    return getBibSources().map((s) => ({
      ...s,
      usedIn: detectUsedIn(s, report.partieI, report.partieII, report.introduction),
    }));
  });
  const [activeModal, setActiveModal] = useState<"pdf" | "doi" | "bib" | null>(null);
  const [pendingPdfName, setPendingPdfName] = useState<string | null>(null);
  const [bibLoading, setBibLoading] = useState(false);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const bibInputRef = useRef<HTMLInputElement>(null);

  const handleMethod = useCallback((m: "pdf" | "doi" | "bib" | "scholar") => {
    if (m === "pdf")       pdfInputRef.current?.click();
    else if (m === "doi")  setActiveModal("doi");
    else if (m === "bib")  bibInputRef.current?.click();
  }, []);

  const handlePdfSelected = useCallback((file: File) => {
    setPendingPdfName(file.name);
    setActiveModal("pdf");
  }, []);

  const handleBibSelected = useCallback(async (file: File) => {
    setBibLoading(true);
    const text = await file.text();
    const parsed = parseBib(text);
    if (parsed.length > 0) {
      const report = getReport();
      const enriched = parsed.map((s) => ({
        ...s,
        usedIn: detectUsedIn(s, report.partieI, report.partieII, report.introduction),
      }));
      enriched.forEach(addBibSource);
      setSources(getBibSources());
    }
    setBibLoading(false);
    if (bibInputRef.current) bibInputRef.current.value = "";
  }, []);

  const handleSaveSource = useCallback((s: BibSource) => {
    const report = getReport();
    const enriched = { ...s, usedIn: detectUsedIn(s, report.partieI, report.partieII, report.introduction) };
    addBibSource(enriched);
    setSources(getBibSources());
    setActiveModal(null);
    setPendingPdfName(null);
  }, []);

  const handleRemove = useCallback((id: string) => {
    removeBibSource(id);
    setSources(getBibSources());
  }, []);

  return (
    <div className="flex min-h-screen bg-[#f9f8ff]">
      <Sidebar />
      <SidebarSpacer />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5 flex-shrink-0 bg-white border-b border-gray-100"
             style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-100">
              <BookOpen className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h1 className="text-base font-black text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Bibliothèque
              </h1>
              <p className="text-xs text-gray-400">Sources · {sources.length}</p>
            </div>
          </div>
          {sources.length > 0 && (
            <Button
              onClick={() => handleMethod("pdf")}
              className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl gap-2"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter une source
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-white">
          {sources.length === 0 ? (
            <EmptyState onMethod={handleMethod} />
          ) : (
            <SourcesView sources={sources} onRemove={handleRemove} onMethod={handleMethod} />
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfSelected(f); if (pdfInputRef.current) pdfInputRef.current.value = ""; }} />
      <input ref={bibInputRef} type="file" accept=".bib,.ris" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBibSelected(f); }} />

      {/* Modals */}
      <AnimatePresence>
        {activeModal === "doi" && (
          <DoiModal key="doi" onClose={() => setActiveModal(null)} onSave={handleSaveSource} />
        )}
        {activeModal === "pdf" && pendingPdfName && (
          <PdfModal key="pdf" fileName={pendingPdfName} onClose={() => { setActiveModal(null); setPendingPdfName(null); }} onSave={handleSaveSource} />
        )}
      </AnimatePresence>

      {bibLoading && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-lg border border-purple-100">
          <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
          <span className="text-sm text-gray-600">Import .bib en cours…</span>
        </div>
      )}
    </div>
  );
}
