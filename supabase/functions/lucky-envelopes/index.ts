import { serveAction, z } from "../_shared/action.ts";

// Bao lì xì: server tự tính tiến độ các mốc từ dữ liệu thật và phát bao cho mốc đã đạt.
serveAction(z.object({}).strict(), ({ userId, rpc }) => rpc("get_envelopes", { p_user: userId }));
