import { useRef, useState, useCallback, useEffect } from "react";
import { Plus, X, ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

interface AttachedItem {
  file: File;
  previewUrl?: string;
}

interface ChatInputProps {
  onSend: (text: string, files?: File[]) => void | Promise<void>;
  onAbort?: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
  placeholder?: string;
  templateSlot?: React.ReactNode;
  accept?: string;
}

const CODE_EXT_SET = new Set(["py","js","ts","jsx","tsx","java","c","cpp","h","sql","r","rb","php","go","rs","sh","json","xml","html","css","yaml","yml"]);
const SHEET_EXT_SET = new Set(["xls","xlsx","csv","tsv"]);

function FileTypeIcon({ file }: { file: File }) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "docx" || ext === "doc") {
    return (
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
        style={{ background: "#2B579A", fontSize: 15, fontFamily: "Georgia, serif" }}
      >
        W
      </div>
    );
  }
  if (ext === "pdf") {
    return (
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
        style={{ background: "#E74C3C", fontSize: 11 }}
      >
        PDF
      </div>
    );
  }
  if (SHEET_EXT_SET.has(ext)) {
    return (
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
        style={{ background: "#217346", fontSize: 10 }}
      >
        {ext === "csv" || ext === "tsv" ? "CSV" : "XLS"}
      </div>
    );
  }
  if (CODE_EXT_SET.has(ext)) {
    return (
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
        style={{ background: "#0f172a", fontSize: 10, letterSpacing: "-0.5px" }}
      >
        {`<${ext.length <= 3 ? ext.toUpperCase() : "CODE"}>`}
      </div>
    );
  }
  if (ext === "md" || ext === "markdown") {
    return (
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
        style={{ background: "#4b5563", fontSize: 10 }}
      >
        MD
      </div>
    );
  }
  if (ext === "txt") {
    return (
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
        style={{ background: "#6b7280", fontSize: 10 }}
      >
        TXT
      </div>
    );
  }
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
      style={{ background: "#6b7280", fontSize: 10 }}
    >
      FILE
    </div>
  );
}

const DEFAULT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.markdown,.py,.js,.ts,.jsx,.tsx,.java,.c,.cpp,.h,.sql,.r,.rb,.php,.go,.rs,.sh,.json,.xml,.html,.css,image/*";

export function ChatInput({
  onSend,
  onAbort,
  isGenerating = false,
  disabled = false,
  placeholder = "Écrire un message...",
  templateSlot,
  accept = DEFAULT_ACCEPT,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<AttachedItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);

    const oversized = arr.filter((f) => f.size > MAX_FILE_BYTES);
    if (oversized.length > 0) {
      const names = oversized.map((f) => f.name).join(", ");
      toast({
        title: "Fichier trop volumineux",
        description: `${names} dépasse la limite de 10 Mo. Compresse ou divise le fichier.`,
        variant: "destructive",
      });
    }

    const valid = arr.filter((f) => f.size <= MAX_FILE_BYTES);
    if (valid.length === 0) return;

    setItems((prev) => {
      const names = new Set(prev.map((i) => i.file.name));
      const newItems: AttachedItem[] = valid
        .filter((f) => !names.has(f.name))
        .map((f) => ({
          file: f,
          previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        }));
      return [...prev, ...newItems];
    });
  }, [toast]);

  const removeItem = (idx: number) => {
    setItems((prev) => {
      const item = prev[idx];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  useEffect(() => {
    return () => {
      items.forEach((i) => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = () => {
    if (!text.trim() && items.length === 0) return;
    const files = items.map((i) => i.file);
    onSend(text.trim(), files.length > 0 ? files : undefined);
    setText("");
    items.forEach((i) => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
    setItems([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const canSend = (text.trim().length > 0 || items.length > 0) && !disabled;

  return (
    <div
      className={cn("mx-4 mb-4 rounded-2xl transition-all", isDragging && "ring-2 ring-violet-400")}
      style={{ background: "#fff", border: "1px solid #e9d5ff" }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* File cards row */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {items.map((item, idx) =>
            item.previewUrl ? (
              /* Image thumbnail card */
              <div
                key={idx}
                className="relative rounded-xl overflow-hidden shrink-0"
                style={{ width: 130, height: 88 }}
              >
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-[10px] truncate"
                  style={{ background: "rgba(0,0,0,0.52)", color: "#fff" }}
                >
                  {item.file.name}
                </div>
                <button
                  onClick={() => removeItem(idx)}
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ) : (
              /* Document card */
              <div
                key={idx}
                className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl shrink-0"
                style={{
                  background: "#f9f6ff",
                  border: "1px solid #ede9fe",
                  minWidth: 160,
                  maxWidth: 220,
                }}
              >
                <FileTypeIcon file={item.file} />
                <div className="min-w-0 flex-1">
                  <div
                    className="text-xs font-medium truncate"
                    style={{ color: "#1e1b4b", maxWidth: 130 }}
                    title={item.file.name}
                  >
                    {item.file.name}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#9ca3af" }}>
                    {item.file.size < 1024 * 1024
                      ? `${(item.file.size / 1024).toFixed(0)} KB`
                      : `${(item.file.size / (1024 * 1024)).toFixed(1)} MB`}
                  </div>
                </div>
                <button
                  onClick={() => removeItem(idx)}
                  className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:opacity-70"
                  style={{ background: "#ddd6fe" }}
                >
                  <X className="w-2.5 h-2.5" style={{ color: "#7c3aed" }} />
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={isDragging ? "Déposer les fichiers ici..." : placeholder}
        disabled={disabled}
        rows={1}
        className="w-full resize-none px-4 pt-3 pb-1 text-sm bg-transparent outline-none disabled:opacity-40"
        style={{
          color: "#1e1b4b",
          caretColor: "#7c3aed",
          height: "auto",
          maxHeight: "120px",
          minHeight: "44px",
          lineHeight: "1.5",
        }}
      />

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-3 pb-3 mt-1">
        <div className="flex items-center gap-1.5">
          {templateSlot}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <button
            type="button"
            title="Joindre un fichier (image, PDF, Word…)"
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all disabled:opacity-40"
            style={{ color: "#9ca3af", border: "1px solid #e5e7eb", background: "#f9fafb" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#7c3aed";
              e.currentTarget.style.borderColor = "#a78bfa";
              e.currentTarget.style.background = "#f5f0ff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#9ca3af";
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.background = "#f9fafb";
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {isGenerating ? (
          <button
            onClick={onAbort}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all"
            style={{ background: "#7c3aed" }}
            title="Arrêter"
          >
            <Square className="w-3.5 h-3.5 text-white fill-white" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{
              cursor: canSend ? "pointer" : "not-allowed",
              background: canSend ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "#f3f4f6",
              border: canSend ? "none" : "1px solid #e5e7eb",
              opacity: canSend ? 1 : 0.4,
            }}
          >
            <ArrowUp className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
