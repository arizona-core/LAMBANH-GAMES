"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { callAction, type ActionName } from "@/lib/api/actions";
import { errorMessage } from "@/lib/game/errors";
import { useToast } from "@/lib/store/toast";

type Input<N extends ActionName> = Parameters<typeof callAction<N>>[1];
type Output<N extends ActionName> = Extract<Awaited<ReturnType<typeof callAction<N>>>, { ok: true }>["data"];

/**
 * Gọi 1 hành động kinh tế: hiện lỗi bằng toast, thành công thì refresh dữ liệu server
 * (router.refresh() tải lại Server Component, gồm cả HUD xu/gem).
 */
export function useAction<N extends ActionName>(name: N) {
  const router = useRouter();
  const push = useToast((s) => s.push);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const run = useCallback(
    async (input: Input<N>, opts?: { success?: (data: Output<N>) => string | null; refresh?: boolean }) => {
      setBusy(true);
      try {
        const res = await callAction(name, input);
        if (!res.ok) {
          push(errorMessage(res.error), "error");
          if (res.error === "UNAUTHORIZED") router.replace("/login");
          return null;
        }
        const msg = opts?.success?.(res.data as Output<N>);
        if (msg) push(msg, "success");
        if (opts?.refresh !== false) startTransition(() => router.refresh());
        return res.data as Output<N>;
      } finally {
        setBusy(false);
      }
    },
    [name, push, router],
  );

  return { run, busy };
}
