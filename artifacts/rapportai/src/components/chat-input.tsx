import { useRef, useState, useCallback } from "react";
import { Paperclip, Image, FileText, ArrowUp, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string, files?: File[]) => void | Promise<void>;
  onAbort?: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
  placeholder?: string;
  templateSlot?: React.ReactNode;
}

export function ChatInput({
  onSend,
  onAbort,
  isGenerating = false,
  disabled = false,
  placeholder = "Écrire un message...",
  templateSlot,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const anyFileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setAttachedFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...arr.filter((f) => !names.has(f.name))];
    });
  }, []);

  const removeFile = (idx: number) => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSend = () => {
    if (!text.trim() && attachedFiles.length === 0) return;
    onSend(text.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
    setText("");
    setAttachedFiles([]);
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

  const canSend = (text.trim().length > 0 || attachedFiles.length > 0) && !disabled;

  return (
    <div
      className={cn("mx-4 mb-4 rounded-xl transition-all", isDragging && "ring-2 ring-violet-500")}
      style={{ background: "#fff", border: "1px solid #e9d5ff" }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* File chips */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
          {attachedFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
              style={{ background: "#f5f0ff", color: "#7c3aed", border: "1px solid #ede9fe" }}
            >
              <FileText className="w-3 h-3 shrink-0" />
              <span className="max-w-[120px] truncate">{file.name}</span>
              <button onClick={() => removeFile(idx)} className="ml-0.5 hover:text-white transition-colors">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
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
        <div className="flex items-center gap-0.5">
          {templateSlot && (
            <>
              {templateSlot}
              <div className="w-px h-4 mx-1" style={{ background: "#e9d5ff" }} />
            </>
          )}
          {/* Hidden inputs */}
          <input ref={anyFileRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
          <input ref={imageRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
          <input ref={docRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.csv,.xlsx" className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />

          {[
            { icon: <Paperclip className="w-4 h-4" />, ref: anyFileRef, title: "Joindre" },
            { icon: <Image className="w-4 h-4" />, ref: imageRef, title: "Image" },
            { icon: <FileText className="w-4 h-4" />, ref: docRef, title: "Document" },
          ].map(({ icon, ref, title }) => (
            <button
              key={title}
              type="button"
              title={title}
              onClick={() => ref.current?.click()}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "#a78bfa" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#7c3aed")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#a78bfa")}
            >
              {icon}
            </button>
          ))}
        </div>

        {isGenerating ? (
          // Stop button (filled square) — shown while agent is running (Replit pattern)
          <button
            onClick={onAbort}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: "#7c3aed", border: "none" }}
            title="Arrêter la génération"
          >
            <Square className="w-3.5 h-3.5 text-white fill-white" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
            style={{
              background: canSend ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "#f3f4f6",
              border: canSend ? "none" : "1px solid #e5e7eb",
            }}
          >
            <ArrowUp className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
