"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastFn = (opts: {
  title: string;
  description?: string;
  variant?: ToastVariant;
}) => void;

const ToastContext = createContext<{ toast: ToastFn }>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastFn>(
    ({ title, description, variant = "info" }) => {
      const id = String(++counter.current);
      setToasts((prev) => [...prev.slice(-4), { id, title, description, variant }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifikasi"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "flex items-start gap-3 min-w-72 max-w-sm w-full px-4 py-3 rounded-xl shadow-lg border pointer-events-auto",
              "animate-in slide-in-from-right-4 fade-in-0 duration-200",
              t.variant === "success" && "bg-white border-green-200",
              t.variant === "error"   && "bg-white border-red-200",
              t.variant === "info"    && "bg-white border-amber-200",
            )}
          >
            {t.variant === "success" && (
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            )}
            {t.variant === "error" && (
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            {t.variant === "info" && (
              <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 leading-tight">
                {t.title}
              </p>
              {t.description && (
                <p className="text-xs text-slate-500 mt-0.5 leading-tight">
                  {t.description}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0 mt-0.5"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
