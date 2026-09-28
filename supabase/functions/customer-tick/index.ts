import { serveAction, z } from "../_shared/action.ts";

// Nhịp sinh khách khi người chơi đang mở app (client gọi ~20 giây/lần).
serveAction(z.object({}).strict(), ({ userId, rpc }) => rpc("customer_tick", { p_user: userId }));
