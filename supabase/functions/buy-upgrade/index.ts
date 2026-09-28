import { Code, serveAction, z } from "../_shared/action.ts";

const Input = z.object({ code: Code }).strict();

serveAction(Input, ({ userId, input, rpc }) => rpc("buy_upgrade", { p_user: userId, p_code: input.code }));
