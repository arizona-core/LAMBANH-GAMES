/* eslint-disable @next/next/no-img-element -- ảnh xếp hạng nhỏ đã tối ưu sẵn */
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { CoinIcon, GemIcon } from "@/components/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SHOP_COLORS, type ShopColor } from "@/lib/game/constants";
import { formatCompact, formatNumber } from "@/lib/game/format";
import { requirePlayer } from "@/lib/game/queries";
import type { LeaderboardRow } from "@/lib/types";
import { RankBadge, RewardPill, SEASON_REWARDS } from "./RankBadge";
import styles from "./leaderboard.module.css";

export const metadata: Metadata = { title: "Bảng xếp hạng" };

export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  const { supabase, profile } = await requirePlayer();
  const by = (await searchParams).by === "stars" ? "stars" : "revenue";
  const rankCol = by === "stars" ? "reputation_rank" : "revenue_rank";

  const [{ data: top }, { data: me }] = await Promise.all([
    supabase.from("leaderboard").select("*").order(rankCol).limit(50),
    supabase.from("leaderboard").select("*").eq("id", profile.id).maybeSingle(),
  ]);
  const rows = top ?? [];
  const value = (r: LeaderboardRow) =>
    by === "stars" ? `${formatCompact(r.reputation ?? 0)} ★` : `${formatCompact(r.revenue_total ?? 0)} ₵`;
  const rank = (r: LeaderboardRow) => (by === "stars" ? r.reputation_rank : r.revenue_rank) ?? 0;
  const podium = [rows[1], rows[0], rows[2]];

  return (
    <main className="app">
      <div className="screen screen--with-nav">
        <ScreenHeader title="Bảng xếp hạng" />

        <section className={styles.banner} aria-label="Mùa giải">
          <img src="/images/rank/podium.webp" alt="" width={96} height={94} />
          <div style={{ flex: 1 }}>
            <strong style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--ink-strong)" }}>Mùa 1</strong>
            <p className="small" style={{ margin: "2px 0 6px", fontWeight: 700 }}>
              Top 10 nhận xu &amp; gem, Top 1 được vương miện pha lê.
            </p>
            <span className={styles.soon}>Trao thưởng: sắp ra mắt</span>
          </div>
        </section>

        <div className="tabs" role="tablist">
          <Link href="/leaderboard" role="tab" className="tab" aria-selected={by === "revenue"}>
            Doanh thu
          </Link>
          <Link href="/leaderboard?by=stars" role="tab" className="tab" aria-selected={by === "stars"}>
            Số sao
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="empty">Chưa có ai trên bảng. Phục vụ khách để ghi danh!</p>
        ) : (
          <>
            <ol className={styles.podium} aria-label="Top 3">
              {podium.map((r, i) => {
                const place = [2, 1, 3][i];
                if (!r) return <li key={`empty-${i}`} className={styles.podiumItem} aria-hidden="true" />;
                return (
                  <li key={r.id} className={styles.podiumItem} data-place={place}>
                    <div className={styles.avatarWrap}>
                      {place === 1 && <img src="/images/rank/crown.webp" alt="Vương miện" className={styles.crown} />}
                      <Avatar
                        avatar={r.avatar ?? "a1"}
                        size={place === 1 ? 68 : 54}
                        ring={place === 1 ? "#7c6bd6" : SHOP_COLORS[r.color as ShopColor]?.hex}
                      />
                    </div>
                    <span className={styles.podiumName}>{r.shop_name}</span>
                    <span className={styles.podiumBar}>
                      <RankBadge rank={place} size={place === 1 ? 52 : 44} />
                      <span>{value(r)}</span>
                    </span>
                    <RewardPill rank={place} compact />
                  </li>
                );
              })}
            </ol>

            <ol className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {rows.slice(3).map((r) => (
                <Row key={r.id} r={r} rank={rank(r)} value={value(r)} me={r.id === profile.id} />
              ))}
            </ol>
          </>
        )}

        <details className="card">
          <summary style={{ fontWeight: 800, cursor: "pointer" }}>Phần thưởng mỗi mùa</summary>
          <ul className="stack" style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
            {SEASON_REWARDS.map((t) => (
              <li key={t.label} className="row" style={{ gap: 10 }}>
                <RankBadge rank={t.from} size={34} />
                <strong style={{ minWidth: 70 }}>{t.label}</strong>
                <span className="row small" style={{ gap: 4, fontWeight: 800 }}>
                  <CoinIcon /> {formatNumber(t.coins)}
                </span>
                <span className="row small" style={{ gap: 4, fontWeight: 800 }}>
                  <GemIcon /> {t.gems}
                </span>
                {t.from === 1 && <img src="/images/rank/crown.webp" alt="Vương miện" width={26} height={26} />}
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ margin: "10px 0 0", fontWeight: 700 }}>
            Áp dụng cho cả BXH Doanh thu và BXH Số sao. Việc trao thưởng sẽ bật ở bản cập nhật sau.
          </p>
        </details>

        {me && (
          <ul className={styles.me} aria-label="Hạng của bạn">
            <Row r={me} rank={rank(me)} value={value(me)} me />
          </ul>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function Row({ r, rank, value, me }: { r: LeaderboardRow; rank: number; value: string; me?: boolean }) {
  return (
    <li
      className="card row"
      style={{
        gap: 8,
        boxShadow: me ? "0 0 0 2px var(--primary), 0 4px 0 var(--shadow-card)" : undefined,
        background: rank <= 10 ? "#fffaf0" : undefined,
      }}
    >
      <RankBadge rank={rank} size={40} seal={!!me && rank > 10} />
      <Avatar avatar={r.avatar ?? "a1"} size={34} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r.shop_name}
          {me && (
            <span className="badge" style={{ marginLeft: 6 }}>
              BẠN
            </span>
          )}
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="small muted" style={{ fontWeight: 800 }}>
            Lv.{r.level}
          </span>
          <RewardPill rank={rank} compact />
        </span>
      </span>
      <span style={{ fontWeight: 800, minWidth: 56, textAlign: "right" }}>{value}</span>
    </li>
  );
}
