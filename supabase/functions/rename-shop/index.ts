import { serveAction, z } from "../_shared/action.ts";

const Input = z.object({ shopName: z.string().trim().min(3).max(32) }).strict();

serveAction(Input, ({ userId, input, rpc }) =>
  rpc("rename_shop", { p_user: userId, p_shop_name: input.shopName }));
