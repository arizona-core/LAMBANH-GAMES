import { serveAction, z } from "../_shared/action.ts";

const Input = z.object({
  ownerName: z.string().trim().min(2).max(24),
  shopName: z.string().trim().min(3).max(32),
  avatar: z.enum(["a1", "a2", "a3", "a4", "p_glasses", "p_olddad", "p_curly", "p_girl", "p_cap", "p_alien"]),
  color: z.enum(["caramel", "strawberry", "mint", "ocean", "lavender", "honey"]),
}).strict();

serveAction(Input, ({ userId, input, rpc }) =>
  rpc("create_profile", {
    p_user: userId,
    p_owner_name: input.ownerName,
    p_shop_name: input.shopName,
    p_avatar: input.avatar,
    p_color: input.color,
  }));
