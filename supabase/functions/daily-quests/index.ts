import { serveAction, z } from "../_shared/action.ts";

// Danh sách 15 nhiệm vụ hôm nay + tiến độ. Server tự bốc nhiệm vụ và tính tiến độ từ dữ liệu thật.
serveAction(z.object({}).strict(), ({ userId, rpc }) => rpc("get_daily_quests", { p_user: userId }));
