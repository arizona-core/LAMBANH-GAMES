import { serveAction, z } from "../_shared/action.ts";

// Đổi avatar/màu quán (miễn phí, giới hạn 30 lần/ngày).
const Input = z.object({
  avatar: z.enum(["a1", "a2", "a3", "a4", "p_glasses", "p_olddad", "p_curly", "p_girl", "p_cap", "p_alien"]),
  color: z.enum(["caramel", "strawberry", "mint", "ocean", "lavender", "honey"]).nullable(),
}).strict();

serveAction(Input, ({ userId, input, rpc }) =>
  rpc("update_avatar", { p_user: userId, p_avatar: input.avatar, p_color: input.color }));
