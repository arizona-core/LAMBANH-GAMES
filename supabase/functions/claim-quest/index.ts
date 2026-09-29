import { Code, serveAction, z } from "../_shared/action.ts";

// Nhận thưởng 1 nhiệm vụ. Server kiểm tra lại tiến độ, phần thưởng lấy từ danh mục (không nhận từ client).
const Input = z.object({ code: Code }).strict();

serveAction(Input, ({ userId, input, rpc }) => rpc("claim_quest", { p_user: userId, p_code: input.code }));
