import { SUPABASE_URL } from "@/lib/supabase/env";

export const AVATAR_BUCKET = "avatars";
/** Người chơi được coi là online nếu hoạt động trong khoảng này. */
export const ONLINE_WINDOW_MS = 90_000;

/** Đường dẫn trong Storage (<user_id>/<ts>.webp) → URL công khai. */
export function avatarPhotoUrl(path: string | null | undefined): string | null {
  return path ? `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}` : null;
}

export function isOnline(lastSeen: string | null | undefined, now = Date.now()): boolean {
  return !!lastSeen && now - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS;
}

const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });

/** "vừa xong", "5 phút trước", "2 ngày trước"… */
export function lastSeenText(lastSeen: string | null | undefined, now = Date.now()): string {
  if (!lastSeen) return "chưa hoạt động";
  const sec = Math.round((new Date(lastSeen).getTime() - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return "vừa xong";
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  return rtf.format(Math.round(sec / 86400), "day");
}
