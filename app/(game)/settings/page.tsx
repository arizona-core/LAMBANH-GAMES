import type { Metadata } from "next";
import { Avatar } from "@/components/Avatar";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SHOP_COLORS, type ShopColor } from "@/lib/game/constants";
import { formatNumber } from "@/lib/game/format";
import { requirePlayer } from "@/lib/game/queries";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const { profile, user } = await requirePlayer();

  return (
    <main className="app">
      <div className="screen">
        <ScreenHeader title="Cài đặt" />
        <section className="card row" aria-label="Hồ sơ">
          <Avatar avatar={profile.avatar} size={56} ring={SHOP_COLORS[profile.color as ShopColor]?.hex} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{profile.shop_name}</div>
            <div className="small muted" style={{ fontWeight: 700 }}>
              Chủ quán: {profile.owner_name} · Lv.{profile.level}
            </div>
            <div className="small muted" style={{ fontWeight: 700 }}>
              Doanh thu: {formatNumber(profile.revenue_total)} ₵ · Uy tín: {formatNumber(profile.reputation)} ★
            </div>
          </div>
        </section>
        <SettingsView gems={profile.gems} email={user.email ?? ""} />
      </div>
    </main>
  );
}
