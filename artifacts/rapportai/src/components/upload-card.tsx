import { useEffect, useReducer } from "react";
import { motion } from "framer-motion";
import { FileText, Image, CheckCircle2, FileCode, Sheet, FileType, AlertCircle } from "lucide-react";
import { getFileCardState, subscribeFileCard } from "@/lib/fileCardState";

const CODE_EXTS = new Set(["py","js","ts","jsx","tsx","java","c","cpp","h","sql","r","rb","php","go","rs","sh","json","xml","html","css","yaml","yml"]);
const SHEET_EXTS = new Set(["xls","xlsx","csv","tsv"]);

function getFileIcon(file: File) {
  if (file.type.startsWith("image/")) return Image;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf" || ext === "doc" || ext === "docx") return FileText;
  if (SHEET_EXTS.has(ext)) return Sheet;
  if (CODE_EXTS.has(ext)) return FileCode;
  if (ext === "md" || ext === "markdown" || ext === "txt") return FileType;
  return FileText;
}

interface UploadCardProps {
  file: File;
  status: "uploading" | "processing" | "ready" | "error";
  progress?: number;
  errorMessage?: string;
  metadata?: { title?: string; author?: string; year?: string };
}

export function UploadCard({ file, status, progress = 0, errorMessage, metadata }: UploadCardProps) {
  const Icon = getFileIcon(file);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="ml-11 mb-4 flex items-start gap-3 p-3 rounded-xl bg-card border border-border/50 shadow-sm"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-card-foreground truncate">{file.name}</p>

        {status === "uploading" && (
          <div className="mt-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Envoi en cours…</span>
              <span className="text-xs font-medium text-primary">{progress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "linear", duration: 0.2 }}
              />
            </div>
          </div>
        )}

        {status === "processing" && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs text-muted-foreground">Conversion…</span>
          </div>
        )}

        {status === "ready" && (
          <div className="flex items-center gap-1.5 mt-1">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span className="text-xs text-muted-foreground">
              {metadata?.author
                ? `${metadata.author}${metadata.year ? `, ${metadata.year}` : ""}`
                : metadata?.title
                ? metadata.title
                : "Fichier prêt"}
            </span>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center gap-1.5 mt-1">
            <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-600 line-clamp-2">
              {errorMessage ?? "Erreur lors du traitement"}
            </span>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 text-xs text-muted-foreground">
        {(file.size / 1024).toFixed(0)} Ko
      </div>
    </motion.div>
  );
}

export function DynamicUploadCard({ file, cardId }: { file: File; cardId: string }) {
  const [, tick] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    return subscribeFileCard(cardId, tick);
  }, [cardId]);

  const state = getFileCardState(cardId);
  const status = state?.status ?? "processing";
  const progress = state?.status === "uploading" ? state.progress : undefined;
  const errorMessage = state?.status === "error" ? state.errorMessage : undefined;
  const metadata = state?.status === "ready" ? state.metadata : undefined;

  return (
    <UploadCard
      file={file}
      status={status}
      progress={progress}
      errorMessage={errorMessage}
      metadata={metadata}
    />
  );
}
