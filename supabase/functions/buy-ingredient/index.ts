import { Code, serveAction, z } from "../_shared/action.ts";

const Input = z.object({ code: Code, qty: z.number().int().min(1).max(99) }).strict();

serveAction(Input, ({ userId, input, rpc }) =>
  rpc("buy_ingredient", { p_user: userId, p_code: input.code, p_qty: input.qty }));
