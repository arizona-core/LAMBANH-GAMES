import { admin } from "./action.ts";

export const AVATAR_BUCKET = "avatars";

/** Xoá mọi ảnh trong thư mục <userId>/ của bucket avatars, trừ file `keep` (nếu có). */
export async function removeOldAvatars(userId: string, keep?: string) {
  const { data, error } = await admin.storage.from(AVATAR_BUCKET).list(userId, { limit: 100 });
  if (error || !data) return;
  const paths = data.map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (paths.length) await admin.storage.from(AVATAR_BUCKET).remove(paths);
}
