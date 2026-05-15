import { create } from "zustand";

interface FileStore {
  files: File[];
  addFiles: (newFiles: File[]) => void;
  clearAll: () => void;
}

export const useFileStore = create<FileStore>((set) => ({
  files: [],
  addFiles: (newFiles) =>
    set((s) => ({
      files: [
        ...s.files,
        ...newFiles.filter(
          (f) => !s.files.some((sf) => sf.name === f.name && sf.size === f.size)
        ),
      ],
    })),
  clearAll: () => set({ files: [] }),
}));
