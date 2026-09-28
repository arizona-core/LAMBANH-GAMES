import { Code, Quality, serveAction, z } from "../_shared/action.ts";

const Input = z.object({ recipe: Code, quality: Quality, qty: z.number().int().min(1).max(50) }).strict();

serveAction(Input, ({ userId, input, rpc }) =>
  rpc("sell_to_npc", { p_user: userId, p_recipe: input.recipe, p_quality: input.quality, p_qty: input.qty }));
