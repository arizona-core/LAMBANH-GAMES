// Truy vấn ĐỌC dùng chung cho Server Component (client Supabase + RLS của người chơi).
import { redirect } from "next/navigation";
import { ONLINE_WINDOW_MS } from "@/lib/game/avatar";
import { getCurrentPlayer } from "@/lib/supabase/server";
import type { RecipeWithIngredients } from "@/lib/types";

/** Người chơi hiện tại (layout (game) đã đảm bảo có profile). */
export async function requirePlayer() {
  const ctx = await getCurrentPlayer();
  if (!ctx.user) redirect("/login");
  if (!ctx.profile) redirect("/onboarding");
  return { supabase: ctx.supabase, user: ctx.user, profile: ctx.profile };
}

type Supabase = Awaited<ReturnType<typeof requirePlayer>>["supabase"];

export async function getRecipes(supabase: Supabase): Promise<RecipeWithIngredients[]> {
  const { data } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(ingredient_code, qty)")
    .order("sort");
  return data ?? [];
}

export async function getIngredients(supabase: Supabase) {
  const { data } = await supabase.from("ingredients").select("*").order("sort");
  return data ?? [];
}

export async function getInventoryMap(supabase: Supabase): Promise<Record<string, number>> {
  const { data } = await supabase.from("inventory").select("ingredient_code, qty");
  return Object.fromEntries((data ?? []).map((r) => [r.ingredient_code, r.qty]));
}

/** Hiệu ứng nâng cấp lớn nhất theo loại (chỉ để hiển thị; server tự tính lại). */
export async function getUpgradeBonuses(supabase: Supabase) {
  const { data } = await supabase.from("upgrades").select("upgrade_code, upgrade_catalog(kind, effect)");
  const owned = new Set((data ?? []).map((u) => u.upgrade_code));
  const bonus = { oven: 0, display: 0 };
  for (const u of data ?? []) {
    const c = u.upgrade_catalog;
    if (c && (c.kind === "oven" || c.kind === "display")) bonus[c.kind] = Math.max(bonus[c.kind], c.effect);
  }
  return { owned, ...bonus };
}

/** Số người chơi đang online (hoạt động trong ONLINE_WINDOW_MS gần nhất). */
export async function countOnline(supabase: Supabase): Promise<number> {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
  const { count } = await supabase.from("public_profiles").select("id", { count: "exact", head: true }).gte("last_seen_at", since);
  return count ?? 0;
}
