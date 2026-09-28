import { serveAction, z } from "../_shared/action.ts";

serveAction(z.object({}).strict(), ({ userId, rpc }) => rpc("claim_daily", { p_user: userId }));
