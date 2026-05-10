import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Upload, X, ArrowRight, Sparkles, University, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepLayout } from "@/components/report/StepLayout";
import { saveReport, getReport, useAutoSave } from "@/lib/reportStore";
import { ensureSession } from "@/lib/useGenerate";
import { API_BASE } from "@/lib/apiBase";

const REPORT_TYPES = [
  { id: "PFE", label: "PFE", desc: "Projet de Fin d'Études" },
  { id: "Rapport de Stage", label: "Stage", desc: "Rapport de Stage" },
  { id: "Mémoire", label: "Mémoire", desc: "Mémoire de Recherche" },
];

const COLORS = [
  { id: "purple", hex: "#7c3aed", label: "Violet" },
  { id: "blue",   hex: "#1d4ed8", label: "Bleu" },
  { id: "green",  hex: "#15803d", label: "Vert" },
  { id: "red",    hex: "#b91c1c", label: "Rouge" },
  { id: "gray",   hex: "#374151", label: "Gris" },
  { id: "black",  hex: "#000000", label: "Noir" },
];

export default function Step2Page() {
  const [, setLocation] = useLocation();
  const stored = getReport();

  const [reportType, setReportType] = useState(stored.reportType || "PFE");
  const [theme,      setTheme]      = useState(stored.theme      || "");
  const [school,     setSchool]     = useState(stored.school     || "");
  const [filiere,    setFiliere]    = useState(stored.filiere    || "");
  const [annee,      setAnnee]      = useState(stored.annee      || "2024–2025");
  const [student,    setStudent]    = useState(stored.studentName || "");
  const [encPeda,    setEncPeda]    = useState(stored.encadrantPeda || "");
  const [encPro,     setEncPro]     = useState(stored.encadrantPro  || "");
  const [entreprise, setEntreprise] = useState(stored.entreprise   || "");
  const [ville,      setVille]      = useState(stored.ville         || "");
  const [color,      setColor]      = useState(COLORS[0]);
  const [logoUrl,        setLogoUrl]        = useState<string | null>(stored.logoUrl ?? null);
  const [logoFetching,   setLogoFetching]   = useState(false);
  const [logoNotFound,   setLogoNotFound]   = useState(false);
  const [templateName,   setTemplateName]   = useState<string | null>(stored.coverTemplate ?? null);
  const [templateStatus, setTemplateStatus] = useState<"idle"|"uploading"|"ready"|"error">("idle");
  const [templateHtml,   setTemplateHtml]   = useState<string | null>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const templateRef = useRef<HTMLInputElement>(null);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLogoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAILogo = async () => {
    if (!school.trim()) return;
    setLogoFetching(true);
    setLogoNotFound(false);
    try {
      const res = await fetch(`${API_BASE}/api/logo?school=${encodeURIComponent(school)}`);
      const data = await res.json() as { logoUrl: string | null };
      if (data.logoUrl) { setLogoUrl(data.logoUrl); setLogoNotFound(false); }
      else setLogoNotFound(true);
    } catch {
      setLogoNotFound(true);
    } finally {
      setLogoFetching(false);
    }
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTemplateStatus("uploading");
    try {
      // Convert docx → HTML client-side for instant preview
      const arrayBuffer = await file.arrayBuffer();
      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml({ arrayBuffer });
      if (result.value) setTemplateHtml(result.value);

      // Upload to session so the agent can read its content during generation
      saveReport({ reportType, theme, school, filiere, annee, studentName: student, encadrantPeda: encPeda, encadrantPro: encPro, entreprise, ville });
      const sessionId = await ensureSession();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/session/${sessionId}/upload-document`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTemplateName(file.name);
      saveReport({ coverTemplate: file.name });
      setTemplateStatus("ready");
    } catch (err) {
      console.error("Template upload error:", err);
      setTemplateStatus("error");
    }
  };

  const handleContinue = () => {
    saveReport({
      reportType, theme, school, filiere, annee,
      studentName: student, encadrantPeda: encPeda,
      encadrantPro: encPro, entreprise, ville,
      logoUrl: logoUrl ?? undefined,
    });
    setLocation("/rapport/step-3");
  };

  useAutoSave(
    { reportType, theme, school, filiere, annee, studentName: student, encadrantPeda: encPeda, encadrantPro: encPro || undefined, entreprise: entreprise || undefined, ville },
    [reportType, theme, school, filiere, annee, student, encPeda, encPro, entreprise, ville]
  );

  const canContinue = theme.trim() && school.trim() && student.trim();

  return (
    <StepLayout stepId={2} fullHeight>
      <div className="flex h-full overflow-hidden">

        {/* LEFT — Form 40% */}
        <div className="overflow-y-auto flex-shrink-0 flex flex-col" style={{ width: "40%", borderRight: "1px solid #e5e7eb" }}>
          <div className="flex-1 p-6 space-y-5 pb-32">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Page de Garde</h1>
              <p className="text-xs text-gray-400">Personnalise la couverture de ton rapport.</p>
            </motion.div>

            {/* Type de rapport */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type de rapport</label>
              <div className="grid grid-cols-3 gap-2">
                {REPORT_TYPES.map(t => (
                  <button key={t.id} onClick={() => setReportType(t.id)}
                    className={`rounded-xl p-2.5 text-left border-2 transition-all ${reportType === t.id ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                    <p className="text-xs font-bold text-gray-800">{t.label}</p>
                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Thème */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Titre / Thème <span className="text-red-400">*</span></label>
              <textarea value={theme} onChange={e => setTheme(e.target.value)} rows={3}
                placeholder="Ex : Optimisation de portefeuille d'actifs financiers à la Bourse de Casablanca"
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300" />
            </div>

            {/* École + Filière */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">École <span className="text-red-400">*</span></label>
                <input value={school} onChange={e => setSchool(e.target.value)} placeholder="Ex : EMSI"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Filière</label>
                <input value={filiere} onChange={e => setFiliere(e.target.value)} placeholder="Ex : Finance"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300" />
              </div>
            </div>

            {/* Étudiant */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nom de l'étudiant(e) <span className="text-red-400">*</span></label>
              <input value={student} onChange={e => setStudent(e.target.value)} placeholder="Ex : Youssef El Amrani"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300" />
            </div>

            {/* Encadrants */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Encadrant pédagogique</label>
                <input value={encPeda} onChange={e => setEncPeda(e.target.value)} placeholder="Pr. Mohamed Alami"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Encadrant professionnel</label>
                <input value={encPro} onChange={e => setEncPro(e.target.value)} placeholder="M. Karim Benali"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300" />
              </div>
            </div>

            {/* Entreprise + Ville */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Entreprise d'accueil</label>
                <input value={entreprise} onChange={e => setEntreprise(e.target.value)} placeholder="Ex : Attijariwafa Bank"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ville</label>
                <input value={ville} onChange={e => setVille(e.target.value)} placeholder="Casablanca"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 placeholder:text-gray-300" />
              </div>
            </div>

            {/* Année */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Année universitaire</label>
              <div className="flex gap-2">
                {["2023–2024", "2024–2025", "2025–2026"].map(y => (
                  <button key={y} onClick={() => setAnnee(y)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${annee === y ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-500 border-gray-200 hover:border-purple-300"}`}>
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Word upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Modèle Word de votre école <span className="text-xs font-normal text-gray-400">(recommandé)</span>
              </label>
              <p className="text-xs text-gray-400 mb-2">90% des encadrants imposent leur propre template. Importez-le et l'IA respectera sa structure exacte.{!canContinue && <span className="text-orange-400"> (Remplis d'abord les champs obligatoires *)</span>}</p>
              <input ref={templateRef} type="file" accept=".docx,.doc" className="hidden" onChange={handleTemplateUpload} />
              {templateStatus === "ready" || templateName ? (
                <div className="flex items-center gap-3 border border-green-200 bg-green-50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-700 truncate">{templateName}</p>
                    <p className="text-xs text-green-500">L'IA utilisera ce modèle</p>
                  </div>
                  <button onClick={() => { setTemplateName(null); setTemplateStatus("idle"); setTemplateHtml(null); saveReport({ coverTemplate: undefined }); }}
                    className="text-xs text-red-400 hover:text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button onClick={() => templateRef.current?.click()} disabled={templateStatus === "uploading" || !canContinue}
                  className="flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-3 w-full hover:border-purple-300 hover:bg-purple-50/30 transition-colors text-left disabled:opacity-50">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {templateStatus === "uploading" ? <Loader2 className="w-4 h-4 text-purple-500 animate-spin" /> : <FileText className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{templateStatus === "uploading" ? "Chargement..." : "Importer le modèle Word"}</p>
                    <p className="text-xs text-gray-400">.docx · max 20 Mo</p>
                  </div>
                </button>
              )}
              {templateStatus === "error" && <p className="text-xs text-red-500 mt-1">Erreur lors de l'import. Réessaie.</p>}
            </div>

            {/* Logo upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Logo de l'école <span className="text-xs font-normal text-gray-400">(optionnel)</span></label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
              {logoUrl ? (
                <div className="flex items-center gap-3">
                  <img src={logoUrl} alt="logo" className="w-16 h-16 object-contain rounded-xl border border-gray-200 bg-white p-1" />
                  <button onClick={() => setLogoUrl(null)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                    <X className="w-3 h-3" /> Supprimer
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-3 flex-1 hover:border-purple-300 hover:bg-purple-50/30 transition-colors text-left">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Upload className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Importer le logo</p>
                      <p className="text-xs text-gray-400">PNG, JPG · max 2 Mo</p>
                    </div>
                  </button>
                  <button onClick={handleAILogo} disabled={logoFetching || !school.trim()}
                    title="Trouver automatiquement avec l'IA"
                    className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-purple-200 rounded-xl p-3 w-20 hover:border-purple-400 hover:bg-purple-50/30 transition-colors disabled:opacity-40">
                    {logoFetching ? <Loader2 className="w-4 h-4 text-purple-500 animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-500" />}
                    <p className="text-[10px] text-purple-500 font-medium text-center leading-tight">IA auto</p>
                  </button>
                </div>
              )}
              {logoNotFound && <p className="text-xs text-orange-500 mt-1">Logo introuvable automatiquement — importe-le manuellement.</p>}
            </div>

            {/* Accent color */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Couleur d'accentuation</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c.id} onClick={() => setColor(c)} title={c.label}
                    className={`w-7 h-7 rounded-full transition-all ${color.id === c.id ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"}`}
                    style={{ background: c.hex }} />
                ))}
              </div>
            </div>
          </div>

          {/* Sticky button */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex-shrink-0">
            <Button onClick={handleContinue} disabled={!canContinue}
              className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ boxShadow: canContinue ? "0 4px 20px rgba(124,58,237,0.35)" : "none" }}>
              Suivant — Dédicaces & Remerciements <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* RIGHT — Live cover preview 60% */}
        <div className="flex-1 overflow-y-auto flex items-center justify-center" style={{ background: "#e5e7eb" }}>
          <div className="py-10 px-6 flex justify-center w-full">

            {/* Template active — shown when a Word template was uploaded */}
            {(templateStatus === "ready" || templateName) ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative bg-white w-full max-w-[500px] flex flex-col items-center justify-center text-center"
                style={{ minHeight: 500, boxShadow: "0 8px 40px rgba(0,0,0,0.15)", borderRadius: 16, padding: "56px 48px" }}
              >
                <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-6">
                  <FileText className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Modèle Word actif</h2>
                <p className="text-sm text-gray-500 mb-4 max-w-xs">
                  L'IA respectera exactement la mise en page de votre école lors de l'export final.
                </p>
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-6 w-full">
                  <p className="text-xs font-semibold text-green-700 truncate">{templateName}</p>
                </div>
                <div className="space-y-2 w-full text-left">
                  {[
                    "Structure de pages respectée",
                    "En-têtes et pieds de page conservés",
                    "Polices et marges identiques",
                    "Mise en page de l'école préservée",
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      </div>
                      <p className="text-xs text-gray-600">{item}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (

            <motion.div
              layout
              className="relative bg-white w-full max-w-[500px]"
              style={{ minHeight: 720, boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
            >
              {/* Accent bar top */}
              <div className="h-2 w-full" style={{ background: color.hex }} />

              {/* Body */}
              <div className="px-12 py-10 flex flex-col" style={{ minHeight: 700, fontFamily: "Times New Roman, serif" }}>

                {/* Logo + School */}
                <div className="flex flex-col items-center mb-8">
                  {logoUrl ? (
                    <img src={logoUrl} alt="logo" className="h-16 object-contain mb-3" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color.hex}18` }}>
                      <University className="w-8 h-8" style={{ color: color.hex }} />
                    </div>
                  )}
                  <p className="text-sm font-bold text-center text-gray-800 uppercase tracking-widest">
                    {school || "École / Université"}
                  </p>
                  {filiere && (
                    <p className="text-xs text-gray-500 text-center mt-1">{filiere}</p>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px my-2" style={{ background: color.hex, opacity: 0.4 }} />

                {/* Type badge */}
                <div className="flex justify-center my-4">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full"
                    style={{ background: `${color.hex}18`, color: color.hex }}>
                    {reportType}
                  </span>
                </div>

                {/* Theme title */}
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                  <h1 className="text-[15px] font-bold leading-snug text-gray-900" style={{ fontFamily: "Times New Roman, serif" }}>
                    {theme || <span className="text-gray-300 italic">Titre de votre rapport...</span>}
                  </h1>
                </div>

                {/* Divider */}
                <div className="h-px my-2" style={{ background: color.hex, opacity: 0.4 }} />

                {/* Footer info */}
                <div className="mt-6 space-y-2 text-xs text-gray-600" style={{ fontFamily: "Times New Roman, serif" }}>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Réalisé par</span>
                    <span className="font-medium text-right">{student || "Prénom NOM"}</span>
                  </div>
                  {encPeda && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Encadrant péda.</span>
                      <span className="font-medium text-right">{encPeda}</span>
                    </div>
                  )}
                  {encPro && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Encadrant pro.</span>
                      <span className="font-medium text-right">{encPro}</span>
                    </div>
                  )}
                  {entreprise && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Entreprise</span>
                      <span className="font-medium text-right">{entreprise}</span>
                    </div>
                  )}
                </div>

                {/* Bottom: city + year */}
                <div className="mt-6 flex justify-between items-center text-xs text-gray-400">
                  <span>{ville || "Ville"}</span>
                  <div className="h-px flex-1 mx-3" style={{ background: "#e5e7eb" }} />
                  <span>{annee}</span>
                </div>
              </div>

              {/* Accent bar bottom */}
              <div className="h-1 w-full" style={{ background: color.hex, opacity: 0.5 }} />
            </motion.div>

            )} {/* end templateHtml conditional */}
          </div>
        </div>

      </div>
    </StepLayout>
  );
}
