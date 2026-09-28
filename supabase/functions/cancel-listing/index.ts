import { serveAction, z } from "../_shared/action.ts";

const Input = z.object({ listingId: z.uuid() }).strict();

serveAction(Input, ({ userId, input, rpc }) => rpc("cancel_listing", { p_user: userId, p_listing: input.listingId }));
