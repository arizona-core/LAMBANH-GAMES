import { Code, serveAction, z } from "../_shared/action.ts";

// Chợ chỉ bán nguyên liệu (kể cả sốt/topping) — bánh luôn làm theo đơn khách.
const Input = z.object({
  kind: z.literal("ingredient"),
  item: Code,
  qty: z.number().int().min(1).max(999),
  price: z.number().int().min(1).max(1_000_000),
}).strict();

serveAction(Input, ({ userId, input, rpc }) =>
  rpc("create_listing", {
    p_user: userId,
    p_kind: input.kind,
    p_item: input.item,
    p_quality: null,
    p_qty: input.qty,
    p_price: input.price,
  }));
