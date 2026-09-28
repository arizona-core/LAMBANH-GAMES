import { Code, serveAction, z } from "../_shared/action.ts";

const Input = z.object({ recipe: Code }).strict();

serveAction(Input, ({ userId, input, rpc }) =>
  rpc("start_bake", { p_user: userId, p_recipe: input.recipe }));
