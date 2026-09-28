"use client";

import { useToast } from "@/lib/store/toast";

export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
