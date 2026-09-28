// Hàm gọi Edge Function (typed). Đây là con đường DUY NHẤT để client thay đổi dữ liệu kinh tế:
// client gửi "ý định", server kiểm tra và quyết định kết quả.
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { Avatar, AvatarKind, ShopColor } from "@/lib/game/constants";
import type { AcceptResult, CookMethod, OrderResult, Packaging, TickResult } from "@/lib/game/orders";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Actions = {
  "create-profile": {
    input: { ownerName: string; shopName: string; avatar: Avatar; color: ShopColor };
    output: { slug: string };
  };
  "update-avatar": { input: { avatar: AvatarKind; color: ShopColor | null }; output: { avatar: string } };
  "set-avatar-photo": { input: { path: string }; output: { avatar_url: string } };
  "update-bio": { input: { bio: string }; output: { bio: string } };
  heartbeat: { input: Record<string, never>; output: { last_seen_at: string } };
  "set-theme": { input: { theme: string }; output: { theme: string } };
  "reply-review": { input: { reviewId: string; reply: string }; output: { reputation_gained: number } };
  "rename-shop": { input: { shopName: string }; output: { slug: string; gems: number } };
  "claim-daily": { input: Record<string, never>; output: { streak: number; coins: number; gems: number } };
  "buy-ingredient": { input: { code: string; qty: number }; output: { coins: number; spent: number } };
  "customer-tick": { input: Record<string, never>; output: TickResult };
  "accept-order": { input: { visitId: string }; output: AcceptResult };
  "complete-order": {
    input: {
      visitId: string;
      ingredients: string[];
      method: CookMethod;
      scores: [number, number];
      sauce: string | null;
      topping: string | null;
      packaging: Packaging;
    };
    output: OrderResult;
  };
  "buy-upgrade": { input: { code: string }; output: { coins: number; gems: number } };
  "create-listing": {
    input: { kind: "ingredient"; item: string; qty: number; price: number };
    output: { listing_id: string };
  };
  "buy-listing": { input: { listingId: string }; output: { paid: number; fee: number; coins: number } };
  "cancel-listing": { input: { listingId: string }; output: { listing_id: string } };
};

export type ActionName = keyof Actions;

export async function callAction<N extends ActionName>(
  name: N,
  input: Actions[N]["input"],
): Promise<ActionResult<Actions[N]["output"]>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "UNAUTHORIZED" };

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const body = (await res.json().catch(() => null)) as ActionResult<Actions[N]["output"]> | null;
    return body ?? { ok: false, error: "INTERNAL" };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}
