import { serveAction, z } from "../_shared/action.ts";

// Dọn dẹp tiệm: vệ sinh về 100%, tốn nước (cộng vào hóa đơn nước hôm nay).
serveAction(z.object({}).strict(), ({ userId, rpc }) => rpc("clean_shop", { p_user: userId }));
