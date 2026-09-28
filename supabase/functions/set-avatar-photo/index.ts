import { ActionError, admin, serveAction, z } from "../_shared/action.ts";
import { AVATAR_BUCKET, removeOldAvatars } from "../_shared/avatars.ts";

// Client đã tải ảnh (≤256px webp) lên avatars/<userId>/<timestamp>.webp.
// Server kiểm tra file thuộc đúng thư mục của người dùng và có thật, đặt làm avatar,
// rồi xoá toàn bộ ảnh cũ trong thư mục để tránh tốn dung lượng.
const Input = z.object({ path: z.string().regex(/^[0-9a-f-]{36}\/\d{10,16}\.webp$/) }).strict();

serveAction(Input, async ({ userId, input, rpc }) => {
  const [folder, file] = input.path.split("/");
  if (folder !== userId) throw new ActionError("NOT_FOUND");
  const { data } = await admin.storage.from(AVATAR_BUCKET).list(userId, { search: file, limit: 1 });
  if (!data?.some((f) => f.name === file)) throw new ActionError("NOT_FOUND");

  const res = await rpc("set_avatar_photo", { p_user: userId, p_url: input.path });
  await removeOldAvatars(userId, input.path);
  return res;
});
