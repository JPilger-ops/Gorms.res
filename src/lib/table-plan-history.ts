export type DraftHistory<T> = { past: T[]; present: T; future: T[] };
export const startHistory = <T>(present: T): DraftHistory<T> => ({ past: [], present, future: [] });
export function commitHistory<T>(history: DraftHistory<T>, next: T): DraftHistory<T> {
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history;
  return { past: [...history.past, history.present].slice(-50), present: next, future: [] };
}
export function undoHistory<T>(history: DraftHistory<T>): DraftHistory<T> {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past.at(-1)!,
    future: [history.present, ...history.future].slice(0, 50),
  };
}
export function redoHistory<T>(history: DraftHistory<T>): DraftHistory<T> {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present].slice(-50),
    present: history.future[0],
    future: history.future.slice(1),
  };
}
