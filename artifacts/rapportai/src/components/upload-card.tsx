import { motion } from "framer-motion";
import { FileText, Image, CheckCircle2 } from "lucide-react";

interface UploadCardProps {
  file: File;
  status: "processing" | "ready";
  metadata?: { title?: string; author?: string; year?: string };
}

export function UploadCard({ file, status, metadata }: UploadCardProps) {
  const isImage = file.type.startsWith("image/");
  const Icon = isImage ? Image : FileText;

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

        {status === "processing" ? (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs text-muted-foreground">Analyse en cours…</span>
          </div>
        ) : (
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
      </div>

      <div className="flex-shrink-0 text-xs text-muted-foreground">
        {(file.size / 1024).toFixed(0)} Ko
      </div>
    </motion.div>
  );
}
