import { ImageIcon, Upload, X, ZoomIn } from "lucide-react";
import { useState, useRef } from "react";

interface Figure {
  id: string;
  name: string;
  url: string;
  caption?: string;
}

const DEMO_FIGURES: Figure[] = [];

export function FiguresPanel() {
  const [figures, setFigures] = useState<Figure[]>(DEMO_FIGURES);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      setFigures((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: file.name, url, caption: "" },
      ]);
    });
  };

  const removeFigure = (id: string) => {
    setFigures((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-purple-500" />
          <h3
            className="font-semibold text-gray-900 text-sm"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Figures & Graphiques
          </h3>
          {figures.length > 0 && (
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">
              {figures.length}
            </span>
          )}
        </div>
        <button
          data-testid="button-upload-figure"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Ajouter
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="input-figure-upload"
        />
      </div>

      <div className="p-4">
        {figures.length === 0 ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              dragging ? "border-purple-400 bg-purple-50" : "border-gray-200 hover:border-purple-300 hover:bg-gray-50"
            }`}
          >
            <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-1">Glisse tes figures ici</p>
            <p className="text-xs text-gray-400">PNG, JPG, SVG jusqu'à 10 Mo</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {figures.map((fig) => (
              <div key={fig.id} className="group relative rounded-xl overflow-hidden bg-gray-50 aspect-square border border-gray-100">
                <img src={fig.url} alt={fig.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    data-testid={`button-zoom-figure-${fig.id}`}
                    className="w-7 h-7 bg-white rounded-full flex items-center justify-center hover:bg-gray-100"
                    onClick={() => window.open(fig.url, "_blank")}
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-gray-700" />
                  </button>
                  <button
                    data-testid={`button-remove-figure-${fig.id}`}
                    className="w-7 h-7 bg-white rounded-full flex items-center justify-center hover:bg-red-50"
                    onClick={() => removeFigure(fig.id)}
                  >
                    <X className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate">{fig.name}</p>
                </div>
              </div>
            ))}
            {/* Add more */}
            <button
              onClick={() => fileRef.current?.click()}
              className="aspect-square border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-purple-300 hover:bg-purple-50 transition-colors"
              data-testid="button-add-more-figures"
            >
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">Ajouter</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
