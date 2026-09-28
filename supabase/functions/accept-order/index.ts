import { serveAction, z } from "../_shared/action.ts";

// Nhận đơn của 1 khách ở quầy → mở phiên làm bánh (hoặc mở lại đơn đang làm dở).
const Input = z.object({ visitId: z.uuid() }).strict();

serveAction(Input, ({ userId, input, rpc }) => rpc("accept_order", { p_user: userId, p_visit: input.visitId }));
