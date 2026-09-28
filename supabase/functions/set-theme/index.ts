import { serveAction, z } from "../_shared/action.ts";

// Chọn theme đang dùng cho tiệm (phải sở hữu theme đó, hoặc 'default').
const Input = z.object({ theme: z.string().regex(/^(default|theme_[a-z0-9_]{1,30})$/) }).strict();

serveAction(Input, ({ userId, input, rpc }) => rpc("set_theme", { p_user: userId, p_theme: input.theme }));
