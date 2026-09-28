import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SHOP_COLORS, type ShopColor } from "@/lib/game/constants";
import { formatCompact } from "@/lib/game/format";
import { requirePlayer } from "@/lib/game/queries";
import type { LeaderboardRow } from "@/lib/types";
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
  const value = (r: LeaderboardRow) => (by === "stars" ? `${formatCompact(r.reputation ?? 0)} ★` : formatCompact(r.revenue_total ?? 0));
  const rank = (r: LeaderboardRow) => (by === "stars" ? r.reputation_rank : r.revenue_rank) ?? 0;
  const podium = [rows[1], rows[0], rows[2]];

  return (
    <main className="app">
      <div className="screen screen--with-nav">
        <ScreenHeader title="Bảng xếp hạng" />
        <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
          Mùa 1 · xếp theo {by === "stars" ? "uy tín (sao)" : "doanh thu bán cho khách"}
        </p>

        <div className="tabs" role="tablist">
          <Link href="/leaderboard" role="tab" className="tab" aria-selected={by === "revenue"}>
            Doanh thu
          </Link>
          <Link href="/leaderboard?by=stars" role="tab" className="tab" aria-selected={by === "stars"}>
            Số sao
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="empty">Chưa có ai trên bảng. Bán bánh để ghi danh!</p>
        ) : (
          <>
            <ol className={styles.podium} aria-label="Top 3">
              {podium.map((r, i) =>
                r ? (
                  <li key={r.id} className={styles.podiumItem} data-place={[2, 1, 3][i]}>
                    <Avatar avatar={r.avatar ?? "a1"} size={i === 1 ? 64 : 52} ring={SHOP_COLORS[r.color as ShopColor]?.hex} />
                    <span className={styles.podiumName}>{r.shop_name}</span>
                    <span className={styles.podiumBar}>
                      <strong>{rank(r)}</strong>
                      <span>{value(r)}</span>
                    </span>
                  </li>
                ) : (
                  <li key={`empty-${i}`} className={styles.podiumItem} aria-hidden="true" />
                ),
              )}
            </ol>

            <ol className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {rows.slice(3).map((r) => (
                <Row key={r.id} r={r} rank={rank(r)} value={value(r)} me={r.id === profile.id} />
              ))}
            </ol>
          </>
        )}

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
    <li className="card row" style={me ? { boxShadow: "0 0 0 2px var(--primary), 0 4px 0 var(--shadow-card)" } : undefined}>
      <span style={{ width: 28, textAlign: "center", fontWeight: 800, color: "var(--ink-muted)" }}>{rank}</span>
      <Avatar avatar={r.avatar ?? "a1"} size={36} />
      <span style={{ flex: 1, fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {r.shop_name}
        {me && (
          <span className="badge" style={{ marginLeft: 6 }}>
            BẠN
          </span>
        )}
      </span>
      <span className="small" style={{ fontWeight: 800 }}>
        Lv.{r.level}
      </span>
      <span style={{ fontWeight: 800, minWidth: 56, textAlign: "right" }}>{value}</span>
    </li>
  );
}
