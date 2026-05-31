export type FileCardStatus =
  | { status: "uploading"; progress: number }
  | { status: "processing" }
  | { status: "ready"; metadata?: { title?: string; author?: string; year?: string }; extractedPreview?: string }
  | { status: "error"; errorMessage: string };

const _states = new Map<string, FileCardStatus>();
const _subs = new Map<string, Set<() => void>>();

export function setFileCardState(id: string, s: FileCardStatus): void {
  _states.set(id, s);
  _subs.get(id)?.forEach((cb) => cb());
}

export function getFileCardState(id: string): FileCardStatus | undefined {
  return _states.get(id);
}

export function subscribeFileCard(id: string, cb: () => void): () => void {
  if (!_subs.has(id)) _subs.set(id, new Set());
  _subs.get(id)!.add(cb);
  return () => {
    _subs.get(id)?.delete(cb);
  };
}

export function clearFileCardState(id: string): void {
  _states.delete(id);
  _subs.delete(id);
}
