import { useRef, useState, useCallback, useEffect } from "react";
import { Paperclip, X, ArrowUp, Square, FileText, FileImage, FileSpreadsheet, FileCode } from "lucide-react";
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
const IMAGE_EXT_SET = new Set(["jpg","jpeg","png","gif","webp","svg","bmp"]);

function chipIcon(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return <FileText className="w-3 h-3 shrink-0" />;
  if (ext === "docx" || ext === "doc") return <FileText className="w-3 h-3 shrink-0" />;
  if (SHEET_EXT_SET.has(ext)) return <FileSpreadsheet className="w-3 h-3 shrink-0" />;
  if (CODE_EXT_SET.has(ext)) return <FileCode className="w-3 h-3 shrink-0" />;
  if (IMAGE_EXT_SET.has(ext) || file.type.startsWith("image/")) return <FileImage className="w-3 h-3 shrink-0" />;
  return <FileText className="w-3 h-3 shrink-0" />;
}

function chipColor(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { bg: "#fee2e2", text: "#b91c1c" };
  if (ext === "docx" || ext === "doc") return { bg: "#dbeafe", text: "#1d4ed8" };
  if (SHEET_EXT_SET.has(ext)) return { bg: "#dcfce7", text: "#15803d" };
  if (CODE_EXT_SET.has(ext)) return { bg: "#fef9c3", text: "#854d0e" };
  if (IMAGE_EXT_SET.has(ext) || file.type.startsWith("image/")) return { bg: "#f3e8ff", text: "#7c3aed" };
  return { bg: "#f3f4f6", text: "#374151" };
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
      toast({
        title: "Fichier trop volumineux",
        description: `${oversized.map((f) => f.name).join(", ")} dépasse la limite de 10 Mo.`,
        variant: "destructive",
      });
    }
    const valid = arr.filter((f) => f.size <= MAX_FILE_BYTES);
    if (valid.length === 0) return;
    setItems((prev) => {
      const names = new Set(prev.map((i) => i.file.name));
      return [
        ...prev,
        ...valid
          .filter((f) => !names.has(f.name))
          .map((f) => ({
            file: f,
            previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
          })),
      ];
    });
  }, [toast]);

  const removeItem = useCallback((idx: number) => {
    setItems((prev) => {
      const item = prev[idx];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

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
      {/* Attached file chips */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
          {items.map((item, idx) =>
            item.previewUrl ? (
              /* Image thumbnail — compact square */
              <div
                key={idx}
                className="relative rounded-lg overflow-hidden shrink-0 group"
                style={{ width: 52, height: 52 }}
              >
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  style={{ background: "rgba(0,0,0,0.45)" }}
                  title="Supprimer"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            ) : (
              /* Document chip */
              (() => {
                const { bg, text: col } = chipColor(item.file);
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 rounded-lg pl-2 pr-1 py-1 shrink-0 max-w-[200px]"
                    style={{ background: bg, border: `1px solid ${col}22` }}
                  >
                    <span style={{ color: col }}>{chipIcon(item.file)}</span>
                    <span
                      className="text-[11px] font-medium truncate"
                      style={{ color: col, maxWidth: 130 }}
                      title={item.file.name}
                    >
                      {item.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="flex items-center justify-center w-4 h-4 rounded shrink-0 cursor-pointer transition-opacity hover:opacity-70 ml-0.5"
                      style={{ color: col }}
                      title="Supprimer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })()
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
          {/* Hidden file input — reset value on click so same file can be re-selected */}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <button
            type="button"
            title="Joindre un fichier (image, PDF, Word…)"
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: "#9ca3af", border: "1px solid #e5e7eb", background: "#f9fafb" }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.color = "#7c3aed";
                e.currentTarget.style.borderColor = "#a78bfa";
                e.currentTarget.style.background = "#f5f0ff";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#9ca3af";
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.background = "#f9fafb";
            }}
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>
        </div>

        {isGenerating ? (
          <button
            type="button"
            onClick={onAbort}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all"
            style={{ background: "#7c3aed" }}
            title="Arrêter"
          >
            <Square className="w-3.5 h-3.5 text-white fill-white" />
          </button>
        ) : (
          <button
            type="button"
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
            <ArrowUp className="w-4 h-4" style={{ color: canSend ? "#fff" : "#9ca3af" }} />
          </button>
        )}
      </div>
    </div>
  );
}
