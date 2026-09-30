"use client";

import { useEffect } from "react";
import { LATEST_UPDATE, UPDATES_SEEN_KEY } from "@/lib/game/changelog";

/** Đánh dấu đã xem bản cập nhật mới nhất (tắt chấm "Mới" ở màn Tiệm). */
export function MarkSeen() {
  useEffect(() => {
    try {
      localStorage.setItem(UPDATES_SEEN_KEY, LATEST_UPDATE);
    } catch {}
  }, []);
  return null;
}
