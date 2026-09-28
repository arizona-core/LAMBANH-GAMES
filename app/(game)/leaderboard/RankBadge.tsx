/* eslint-disable @next/next/no-img-element -- ảnh huy hiệu nhỏ đã tối ưu sẵn */
import { CoinIcon, GemIcon } from "@/components/icons";
import { formatNumber } from "@/lib/game/format";

/** Phần thưởng mùa theo hạng (hiện CHỈ HIỂN THỊ, chưa trao — xem docs/PLAN.md). */
export const SEASON_REWARDS: { from: number; to: number; coins: number; gems: number; label: string }[] = [
  { from: 1, to: 1, coins: 5000, gems: 100, label: "Top 1" },
  { from: 2, to: 2, coins: 3000, gems: 70, label: "Top 2" },
  { from: 3, to: 3, coins: 2000, gems: 50, label: "Top 3" },
  { from: 4, to: 10, coins: 1000, gems: 20, label: "Top 4–10" },
];

export function rewardFor(rank: number) {
  return SEASON_REWARDS.find((r) => rank >= r.from && rank <= r.to) ?? null;
}

function badgeImage(rank: number) {
  if (rank === 1) return "/images/rank/badge-5.webp";
  if (rank === 2) return "/images/rank/badge-4.webp";
  if (rank === 3) return "/images/rank/badge-3.webp";
  if (rank <= 10) return "/images/rank/badge-2.webp";
  return "/images/rank/badge-1.webp";
}

/** Huy hiệu hạng: ảnh khung + số hạng ở giữa. */
export function RankBadge({ rank, size = 36, seal = false }: { rank: number; size?: number; seal?: boolean }) {
  const src = seal ? "/images/rank/seal.webp" : badgeImage(rank);
  // Tâm phần trống của huy hiệu hơi lệch lên với loại có ruy băng.
  const offsetY = !seal && rank <= 3 ? -size * 0.08 : 0;
  return (
    <span
      style={{ position: "relative", width: size, height: size, display: "inline-flex", flexShrink: 0 }}
      role="img"
      aria-label={`Hạng ${rank}`}
    >
      <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: "contain" }} />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `translateY(${offsetY}px)`,
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: rank >= 100 ? size * 0.26 : size * 0.36,
          color: seal ? "#8a5a12" : "#7a3e12",
          textShadow: "0 1px 0 rgba(255,255,255,0.7)",
        }}
      >
        {rank}
      </span>
    </span>
  );
}

export function RewardPill({ rank, compact = false }: { rank: number; compact?: boolean }) {
  const r = rewardFor(rank);
  if (!r) return null;
  return (
    <span
      className="row"
      style={{
        gap: 4,
        fontSize: compact ? 11 : 12,
        fontWeight: 800,
        background: "#fff3d6",
        border: "1px solid #f1d38a",
        borderRadius: 999,
        padding: compact ? "1px 6px" : "2px 8px",
        whiteSpace: "nowrap",
      }}
      aria-label={`Thưởng ${r.coins} xu và ${r.gems} gem`}
    >
      <CoinIcon />
      {formatNumber(r.coins)}
      <GemIcon size={14} />
      {r.gems}
    </span>
  );
}
