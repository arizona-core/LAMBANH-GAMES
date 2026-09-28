import { serveAction, z } from "../_shared/action.ts";

// Đánh dấu "đang online" (client gọi ~30 giây/lần khi mở app).
serveAction(z.object({}).strict(), ({ userId, rpc }) => rpc("heartbeat", { p_user: userId }));
