import { Code, serveAction, z } from "../_shared/action.ts";

// Giao bánh: client gửi những gì người chơi đã chọn ở từng bước; server tự chấm điểm, tính tiền,
// quyết định tip/quịt. Không nhận số tiền hay số sao từ client.
const Input = z.object({
  visitId: z.uuid(),
  ingredients: z.array(Code).max(12),
  method: z.enum(["bake", "fry", "steam"]),
  scores: z.array(z.number().int().min(0).max(100)).length(2),
  sauce: Code.nullable(),
  topping: Code.nullable(),
  packaging: z.enum(["box", "bag"]),
}).strict();

serveAction(Input, ({ userId, input, rpc }) =>
  rpc("complete_order", {
    p_user: userId,
    p_visit: input.visitId,
    p_ingredients: input.ingredients,
    p_method: input.method,
    p_scores: input.scores,
    p_sauce: input.sauce,
    p_topping: input.topping,
    p_packaging: input.packaging,
  }));
