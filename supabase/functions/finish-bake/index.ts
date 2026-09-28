import { serveAction, z } from "../_shared/action.ts";

// Điểm canh giờ 3 bước. Server tự tính số sao + kiểm tra thời gian chơi tối thiểu.
const Input = z.object({
  sessionId: z.uuid(),
  scores: z.array(z.number().int().min(0).max(100)).length(3),
}).strict();

serveAction(Input, ({ userId, input, rpc }) =>
  rpc("finish_bake", { p_user: userId, p_session: input.sessionId, p_scores: input.scores }));
