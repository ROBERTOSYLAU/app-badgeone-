"use client";
import { createContext, useContext, useState, useCallback } from "react";

type Options = { title?: string; confirmText?: string; danger?: boolean };
type ConfirmCtx = (msg: string, opts?: Options) => Promise<boolean>;

const Ctx = createContext<ConfirmCtx>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ msg: string; opts: Options; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback((msg: string, opts: Options = {}): Promise<boolean> => {
    return new Promise((resolve) => setState({ msg, opts, resolve }));
  }, []);

  const close = (val: boolean) => {
    state?.resolve(val);
    setState(null);
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {state && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}
          onClick={() => close(false)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "24px 28px", minWidth: 320, maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.20)" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 8 }}>{state.opts.title || "Confirmar ação"}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20, lineHeight: 1.5 }}>{state.msg}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => close(false)} style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                Cancelar
              </button>
              <button onClick={() => close(true)} style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: state.opts.danger ? "#dc2626" : "#1A3A5C", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                {state.opts.confirmText || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm() { return useContext(Ctx); }
