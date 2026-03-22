export type HistoryEntry = {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
};

const KEY = "badgeone_history";
const MAX = 300;

export function logAction(action: string, detail = "") {
  if (typeof window === "undefined") return;
  const entry: HistoryEntry = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    action,
    detail,
    timestamp: new Date().toISOString(),
  };
  const list = getHistory();
  localStorage.setItem(KEY, JSON.stringify([entry, ...list].slice(0, MAX)));
}

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
