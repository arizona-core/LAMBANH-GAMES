"use client";

import { GemIcon, IconCheck } from "@/components/icons";
import { useAction } from "@/components/useAction";

// Phần thưởng hiển thị — trùng công thức public.claim_daily (server mới là nơi quyết định).
function reward(day: number) {
  return { coins: 50 + 10 * Math.min(day, 7), gems: day % 7 === 0 ? 10 : 2 };
}

export function DailyView({ streak, claimedToday }: { streak: number; claimedToday: boolean }) {
  const { run, busy } = useAction("claim-daily");
  // Số ô đã nhận trong tuần hiện tại (0..7) và số thứ tự ngày của ô đầu tuần.
  const done = claimedToday ? ((streak - 1) % 7) + 1 : streak % 7;
  const weekStart = streak - done + 1;

  return (
    <>
      <p className="muted" style={{ margin: 0, fontWeight: 700 }}>
        Chuỗi hiện tại: <strong style={{ color: "var(--ink)" }}>{streak} ngày</strong>. Điểm danh liên tục 7 ngày để nhận
        thưởng lớn!
      </p>
      <ol className="grid-4" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {Array.from({ length: 7 }, (_, i) => {
          const day = weekStart + i;
          const r = reward(day);
          const isDone = i < done;
          const isNext = !claimedToday && i === done;
          return (
            <li
              key={i}
              className="card stack"
              style={{
                alignItems: "center",
                gap: 4,
                padding: "10px 6px",
                gridColumn: i === 6 ? "span 2" : undefined,
                background: isDone ? "#e3f0dc" : isNext ? "#fff" : "#f7ecd9",
                boxShadow: isNext ? "0 0 0 2px var(--primary), 0 4px 0 var(--shadow-card)" : undefined,
              }}
            >
              <span className="small" style={{ fontWeight: 800 }}>
                Ngày {i + 1}
              </span>
              {isDone ? (
                <IconCheck size={22} color="var(--mint-strong)" aria-label="Đã nhận" />
              ) : (
                <GemIcon size={22} />
              )}
              <span className="small" style={{ fontWeight: 800 }}>
                +{r.gems} gem
              </span>
              <span className="small muted" style={{ fontWeight: 700 }}>
                +{r.coins} ₵
              </span>
            </li>
          );
        })}
      </ol>
      <div className="spacer" />
      <button
        type="button"
        className="btn btn--gem btn--block btn--lg"
        disabled={busy || claimedToday}
        onClick={() => run({}, { success: (d) => `Nhận +${d.coins} ₵ và +${d.gems} gem! Chuỗi ${d.streak} ngày.` })}
      >
        {claimedToday ? "Hôm nay đã nhận — quay lại ngày mai" : busy ? "Đang nhận…" : "Điểm danh"}
      </button>
    </>
  );
}
