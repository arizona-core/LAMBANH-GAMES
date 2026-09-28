import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { requirePlayer } from "@/lib/game/queries";
import { PlayersView, type PlayerItem } from "./PlayersView";

export const metadata: Metadata = { title: "Người chơi" };

export default async function PlayersPage() {
  const { supabase, profile } = await requirePlayer();
  const { data } = await supabase
    .from("public_profiles")
    .select("id, owner_name, shop_name, slug, avatar, avatar_url, color, level, reputation, last_seen_at")
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(200);

  const players: PlayerItem[] = (data ?? []).map((p) => ({
    id: p.id!,
    ownerName: p.owner_name ?? "",
    shopName: p.shop_name ?? "",
    slug: p.slug ?? "",
    avatar: p.avatar ?? "a1",
    avatarUrl: p.avatar_url,
    color: p.color ?? "caramel",
    level: p.level ?? 1,
    reputation: p.reputation ?? 0,
    lastSeen: p.last_seen_at,
  }));

  return (
    <main className="app">
      <div className="screen screen--with-nav">
        <ScreenHeader title="Người chơi" />
        <PlayersView players={players} meId={profile.id} />
      </div>
      <BottomNav />
    </main>
  );
}
