import { create } from "zustand";

export type ToastKind = "info" | "success" | "error";
type Toast = { id: number; kind: ToastKind; text: string };

type ToastState = {
  toasts: Toast[];
  push: (text: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push: (text, kind = "info") => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-2), { id, kind, text }] });
    setTimeout(() => get().dismiss(id), 2800);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
