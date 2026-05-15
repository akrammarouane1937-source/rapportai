import { useRef, useState, useCallback } from "react";
import { Paperclip, Image, FileText, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string, files?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Écrire un message...",
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

  const removeFile = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = () => {
    if (!text.trim() && attachedFiles.length === 0) return;
    onSend(text.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
    setText("");
    setAttachedFiles([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-grow up to 5 lines (~120px)
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  // Drag & drop handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const canSend = (text.trim().length > 0 || attachedFiles.length > 0) && !disabled;

  return (
    <div
      className={cn(
        "border rounded-xl bg-background shadow-sm transition-colors",
        isDragging && "border-primary bg-primary/5"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Attached file chips */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {attachedFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted text-sm text-muted-foreground"
            >
              <FileText className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="max-w-[140px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="ml-0.5 hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
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
        className="w-full resize-none px-4 pt-3 pb-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-[120px] min-h-[44px]"
        style={{ height: "auto" }}
      />

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-3 pb-3">
        <div className="flex items-center gap-1">
          {/* Any file */}
          <input
            ref={anyFileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <button
            type="button"
            title="Joindre un fichier"
            onClick={() => anyFileRef.current?.click()}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Image */}
          <input
            ref={imageRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <button
            type="button"
            title="Joindre une image"
            onClick={() => imageRef.current?.click()}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Image className="w-4 h-4" />
          </button>

          {/* Document */}
          <input
            ref={docRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <button
            type="button"
            title="Joindre un document"
            onClick={() => docRef.current?.click()}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <FileText className="w-4 h-4" />
          </button>

          <span className="mx-2 h-4 w-px bg-border" />
          <span className="text-xs text-muted-foreground hidden sm:inline">Shift+Entrée = nouvelle ligne</span>
        </div>

        <Button
          size="sm"
          onClick={handleSend}
          disabled={!canSend}
          className="gap-1.5 h-8 px-3"
        >
          Envoyer
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
