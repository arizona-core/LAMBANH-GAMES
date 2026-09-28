import { serveAction, z } from "../_shared/action.ts";
import { removeOldAvatars } from "../_shared/avatars.ts";

// Đổi avatar có sẵn/màu quán (miễn phí, giới hạn 30 lần/ngày).
// Chuyển sang avatar có sẵn → xoá ảnh đã tải lên trong Storage.
const Input = z.object({
  avatar: z.enum(["a1", "a2", "a3", "a4", "p_glasses", "p_olddad", "p_curly", "p_girl", "p_cap", "p_alien", "custom"]),
  color: z.enum(["caramel", "strawberry", "mint", "ocean", "lavender", "honey"]).nullable(),
}).strict();

serveAction(Input, async ({ userId, input, rpc }) => {
  const res = await rpc("update_avatar", { p_user: userId, p_avatar: input.avatar, p_color: input.color });
  if (input.avatar !== "custom") await removeOldAvatars(userId);
  return res;
});
