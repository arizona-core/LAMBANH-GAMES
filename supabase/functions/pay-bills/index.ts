import { serveAction, z } from "../_shared/action.ts";

// Đóng hóa đơn / thuế / tiền phạt. billIds bỏ trống = đóng tất cả. Số tiền do server tính, không nhận từ client.
const Input = z.object({ billIds: z.array(z.uuid()).min(1).max(50).optional() }).strict();

serveAction(Input, ({ userId, input, rpc }) => rpc("pay_bills", { p_user: userId, p_ids: input.billIds ?? null }));
