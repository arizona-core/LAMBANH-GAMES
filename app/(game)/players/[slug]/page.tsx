import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Stars } from "@/components/Stars";
import { isOnline, lastSeenText } from "@/lib/game/avatar";
import { SHOP_COLORS, type ShopColor } from "@/lib/game/constants";
import { formatCompact, formatNumber } from "@/lib/game/format";
import { requirePlayer } from "@/lib/game/queries";
import styles from "../players.module.css";

export const metadata: Metadata = { title: "Hồ sơ quán" };

const THEME_NAME: Record<string, string> = {
  default: "Mặc định",
  theme_pastel: "Pastel",
  theme_wood: "Gỗ mộc",
  theme_midautumn: "Trung Thu",
  theme_xmas: "Giáng sinh",
};

const dateFmt = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function PlayerProfilePage({ params }: PageProps<"/players/[slug]">) {
  const { slug } = await params;
  const { supabase, profile: me } = await requirePlayer();
  const [{ data: p }, { data: rank }] = await Promise.all([
    supabase.from("public_profiles").select("*").eq("slug", slug).maybeSingle(),
    supabase.from("leaderboard").select("revenue_rank, reputation_rank").eq("slug", slug).maybeSingle(),
  ]);
  if (!p) notFound();

  const isMe = p.id === me.id;
  const online = isMe || isOnline(p.last_seen_at);
  const color = SHOP_COLORS[p.color as ShopColor]?.hex;

  return (
    <main className="app">
      <div className="screen screen--with-nav">
        <ScreenHeader title="Hồ sơ quán" back="/players" />

        <section className={`card ${styles.hero}`} style={{ borderTop: `6px solid ${color ?? "var(--primary)"}` }}>
          <span className={styles.avatarWrap}>
            <Avatar avatar={p.avatar ?? "a1"} photo={p.avatar_url} size={96} ring={color} />
            <span className={online ? styles.dotOn : styles.dotOff} style={{ width: 18, height: 18 }} aria-hidden="true" />
          </span>
          <h2 style={{ fontSize: 24 }}>{p.shop_name}</h2>
          <span className="small muted" style={{ fontWeight: 700 }}>
            Chủ quán: {p.owner_name} · Lv.{p.level}
          </span>
          <span className={`small ${online ? styles.statusOn : styles.statusOff}`} style={{ maxWidth: "none" }}>
            {online ? "● Đang online" : `Hoạt động ${lastSeenText(p.last_seen_at)}`}
          </span>
          <p className={styles.bio}>
            {p.bio ? p.bio : <span className="muted">{isMe ? "Bạn chưa viết tiểu sử quán." : "Quán này chưa có tiểu sử."}</span>}
          </p>
          {isMe && (
            <Link href="/settings" className="btn btn--soft btn--sm">
              Sửa hồ sơ
            </Link>
          )}
        </section>

        <section className={styles.stats} aria-label="Thành tích">
          <div className={`card ${styles.stat}`}>
            <strong>{formatCompact(p.revenue_total ?? 0)} ₵</strong>
            <span className="small muted" style={{ fontWeight: 700 }}>
              Doanh thu · hạng {rank?.revenue_rank ?? "–"}
            </span>
          </div>
          <div className={`card ${styles.stat}`}>
            <strong>{formatNumber(p.reputation ?? 0)} ★</strong>
            <span className="small muted" style={{ fontWeight: 700 }}>
              Uy tín · hạng {rank?.reputation_rank ?? "–"}
            </span>
          </div>
          <div className={`card ${styles.stat}`}>
            <strong>{p.review_count ? String(p.review_avg ?? 0).replace(".", ",") : "–"}</strong>
            <span className="small muted" style={{ fontWeight: 700 }}>
              {formatNumber(p.review_count ?? 0)} đánh giá
            </span>
          </div>
        </section>

        <section className="card stack" style={{ gap: 6 }}>
          {!!p.review_count && (
            <div className="row" style={{ gap: 8 }}>
              <Stars value={Math.round(Number(p.review_avg ?? 0))} />
              <span className="small muted" style={{ fontWeight: 700 }}>
                Điểm đánh giá trung bình của khách
              </span>
            </div>
          )}
          <div className="small" style={{ fontWeight: 700 }}>
            Kiểu tiệm: {THEME_NAME[p.active_theme ?? "default"] ?? "Mặc định"}
          </div>
          <div className="small muted" style={{ fontWeight: 700 }}>
            Mở tiệm từ {p.created_at ? dateFmt.format(new Date(p.created_at)) : "–"}
          </div>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
