// Hàm gọi Edge Function (typed). Đây là con đường DUY NHẤT để client thay đổi dữ liệu kinh tế:
// client gửi "ý định", server kiểm tra và quyết định kết quả.
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { Avatar, ShopColor } from "@/lib/game/constants";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Actions = {
  "create-profile": {
    input: { ownerName: string; shopName: string; avatar: Avatar; color: ShopColor };
    output: { slug: string };
  };
  "rename-shop": { input: { shopName: string }; output: { slug: string; gems: number } };
  "claim-daily": { input: Record<string, never>; output: { streak: number; coins: number; gems: number } };
  "buy-ingredient": { input: { code: string; qty: number }; output: { coins: number; spent: number } };
  "start-bake": {
    input: { recipe: string };
    output: { session_id: string; min_play_seconds: number; oven_bonus: number };
  };
  "finish-bake": {
    input: { sessionId: string; scores: [number, number, number] };
    output: {
      quality: number;
      score: number;
      xp_gained: number;
      level: number;
      leveled_up: boolean;
      tired?: boolean;
      expired?: true;
    };
  };
  "sell-npc": {
    input: { recipe: string; quality: number; qty: number };
    output: { earned: number; unit_price: number; reputation_gained: number };
  };
  "buy-upgrade": { input: { code: string }; output: { coins: number; gems: number } };
  "create-listing": {
    input:
      | { kind: "ingredient"; item: string; qty: number; price: number }
      | { kind: "baked"; item: string; quality: number; qty: number; price: number };
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
