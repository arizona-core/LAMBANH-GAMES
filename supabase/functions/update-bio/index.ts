import { serveAction, z } from "../_shared/action.ts";

// Cập nhật tiểu sử quán (≤ 200 ký tự, server lọc từ bậy).
const Input = z.object({ bio: z.string().max(200) }).strict();

serveAction(Input, ({ userId, input, rpc }) => rpc("update_bio", { p_user: userId, p_bio: input.bio }));
