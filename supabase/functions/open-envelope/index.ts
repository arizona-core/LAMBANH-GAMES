import { serveAction, z } from "../_shared/action.ts";

// Mở 1 bao lì xì. Phần thưởng do server tung ngẫu nhiên.
const Input = z.object({ envelopeId: z.uuid() }).strict();

serveAction(Input, ({ userId, input, rpc }) => rpc("open_envelope", { p_user: userId, p_envelope: input.envelopeId }));
