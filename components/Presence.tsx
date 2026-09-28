"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { callAction } from "@/lib/api/actions";

const BEAT_MS = 30_000;

/** Đánh dấu "đang online" khi mở app (tab hiển thị). Màn Tiệm đã có customer-tick nên bỏ qua. */
export function Presence() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/shop")) return;
    const beat = () => {
      if (document.visibilityState === "visible") callAction("heartbeat", {});
    };
    const first = setTimeout(beat, 1500);
    const id = setInterval(beat, BEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [pathname]);
  return null;
}
