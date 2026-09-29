import { serveAction, z } from "../_shared/action.ts";

// Chủ tiệm đóng/mở cửa. Đóng cửa: khách đang xếp hàng ra về không bị trừ uy tín, không sinh khách mới.
const Input = z.object({ open: z.boolean() }).strict();

serveAction(Input, ({ userId, input, rpc }) => rpc("set_shop_open", { p_user: userId, p_open: input.open }));
