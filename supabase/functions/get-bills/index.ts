import { serveAction, z } from "../_shared/action.ts";

// Màn "Chi phí & thuế": server chốt sổ, tự trừ hóa đơn quá hạn rồi trả hóa đơn, vệ sinh, biên bản thanh tra.
serveAction(z.object({}).strict(), ({ userId, rpc }) => rpc("get_bills", { p_user: userId }));
