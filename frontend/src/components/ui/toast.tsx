import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ToastContext, type ToastVariant } from "./toast-context";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = Date.now() + Math.random();
      setItems((current) => [...current, { id, message, variant }]);
      window.setTimeout(
        () => setItems((current) => current.filter((item) => item.id !== id)),
        5000,
      );
    },
    [],
  );
  const value = useMemo(() => ({ showToast }), [showToast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="ui-toast-region"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Notifications"
      >
        {items.map((item) => (
          <div
            className="ui-toast"
            role={item.variant === "error" ? "alert" : "status"}
            key={item.id}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
