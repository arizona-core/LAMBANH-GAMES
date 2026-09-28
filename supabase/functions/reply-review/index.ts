import { serveAction, z } from "../_shared/action.ts";

// Trả lời đánh giá của khách (mỗi đánh giá 1 lần). Server lọc từ bậy và quyết định thưởng uy tín.
const Input = z.object({ reviewId: z.uuid(), reply: z.string().trim().min(2).max(200) }).strict();

serveAction(Input, ({ userId, input, rpc }) =>
  rpc("reply_review", { p_user: userId, p_review: input.reviewId, p_reply: input.reply }));
