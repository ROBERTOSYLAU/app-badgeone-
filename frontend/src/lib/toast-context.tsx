"use client";
import { createContext, useContext, useState, useCallback } from "react";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; msg: string; type: ToastType };
type ToastCtx = { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };

const Ctx = createContext<ToastCtx>({ success: () => {}, error: () => {}, info: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let _id = 0;

  const add = useCallback((msg: string, type: ToastType) => {
    const id = ++_id;
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  const ctx: ToastCtx = {
    success: (m) => add(m, "success"),
    error: (m) => add(m, "error"),
    info: (m) => add(m, "info"),
  };

  const colors: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
    success: { bg: "#f0fdf4", border: "#86efac", color: "#166534", icon: "✓" },
    error:   { bg: "#fef2f2", border: "#fca5a5", color: "#991b1b", icon: "✕" },
    info:    { bg: "#eff6ff", border: "#93c5fd", color: "#1e40af", icon: "i" },
  };

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <div style={{ position: "fixed", bottom: 20, right: 20, display: "flex", flexDirection: "column", gap: 8, zIndex: 9999, pointerEvents: "none" }}>
        {toasts.map((t) => {
          const c = colors[t.type];
          return (
            <div key={t.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              background: c.bg, border: `1px solid ${c.border}`, color: c.color,
              borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 500,
              boxShadow: "0 4px 12px rgba(0,0,0,0.10)", minWidth: 240, maxWidth: 380,
              animation: "slideInRight 0.2s ease",
            }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{c.icon}</span>
              {t.msg}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() { return useContext(Ctx); }
