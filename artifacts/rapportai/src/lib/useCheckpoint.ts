export type Checkpoint = {
  content: string;
  ts: number;
  wordCount: number;
};

const MAX = 3;

function key(sectionId: string) {
  return `rapportai_ckpt_${sectionId}`;
}

export function useCheckpoint(sectionId: string) {
  function save(content: string) {
    if (!content.trim()) return;
    const existing = getAll();
    const cp: Checkpoint = {
      content,
      ts: Date.now(),
      wordCount: content.split(/\s+/).filter(Boolean).length,
    };
    const updated = [cp, ...existing].slice(0, MAX);
    try { localStorage.setItem(key(sectionId), JSON.stringify(updated)); } catch { /* quota */ }
  }

  function getAll(): Checkpoint[] {
    try {
      const raw = localStorage.getItem(key(sectionId));
      return raw ? (JSON.parse(raw) as Checkpoint[]) : [];
    } catch { return []; }
  }

  function latest(): Checkpoint | null {
    return getAll()[0] ?? null;
  }

  function restore(index = 0): Checkpoint | null {
    return getAll()[index] ?? null;
  }

  function hasCheckpoints(): boolean {
    return getAll().length > 0;
  }

  function clear() {
    try { localStorage.removeItem(key(sectionId)); } catch { /* ignore */ }
  }

  return { save, latest, restore, getAll, hasCheckpoints, clear };
}
