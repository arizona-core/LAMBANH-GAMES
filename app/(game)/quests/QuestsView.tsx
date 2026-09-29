"use client";

import { useCallback, useEffect, useState } from "react";
import { CoinIcon, GemIcon, IconCheck, IconClock } from "@/components/icons";
import { useAction } from "@/components/useAction";
import { callAction } from "@/lib/api/actions";
import { errorMessage } from "@/lib/game/errors";
import { formatNumber } from "@/lib/game/format";
import { questDone, sortQuests, type DailyQuests, type Quest } from "@/lib/game/quests";
import { useToast } from "@/lib/store/toast";

function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
}

export function QuestsView() {
  const push = useToast((s) => s.push);
  const [data, setData] = useState<DailyQuests | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const res = await callAction("daily-quests", {});
    if (!res.ok) {
      setFailed(true);
      push(errorMessage(res.error), "error");
      return;
    }
    setFailed(false);
    setData(res.data);
  }, [push]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  // Qua 0:00 (giờ VN) → tải bộ nhiệm vụ mới.
  const resetsAt = data?.resets_at;
  useEffect(() => {
    if (!resetsAt) return;
    const id = setTimeout(load, Math.max(0, new Date(resetsAt).getTime() - Date.now()) + 2000);
    return () => clearTimeout(id);
  }, [resetsAt, load]);
  const resetsIn = resetsAt ? new Date(resetsAt).getTime() - now : 0;

  if (!data) {
    return (
      <p className="empty" style={{ padding: 24 }}>
        {failed ? (
          <button type="button" className="btn btn--soft" onClick={load}>
            Tải lại nhiệm vụ
          </button>
        ) : (
          "Đang tải nhiệm vụ…"
        )}
      </p>
    );
  }

  const claimed = data.quests.filter((q) => q.claimed).length;
  const ready = data.quests.filter((q) => !q.claimed && questDone(q)).length;

  return (
    <>
      <section className="card stack" style={{ gap: 8 }} aria-label="Tổng quan nhiệm vụ">
        <div className="row" style={{ gap: 8 }}>
          <strong style={{ fontSize: 18 }}>
            Đã xong {claimed}/{data.quests.length}
          </strong>
          <span className="spacer" />
          <span className="row small muted" style={{ gap: 4, fontWeight: 700 }}>
            <IconClock size={16} /> Làm mới sau {formatCountdown(resetsIn)}
          </span>
        </div>
        <Bar value={claimed} max={data.quests.length} />
        <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
          {ready > 0
            ? `Có ${ready} nhiệm vụ đã xong — bấm “Nhận” để lấy thưởng!`
            : "Mỗi ngày 15 nhiệm vụ ngẫu nhiên. Tiến độ tự cập nhật khi bạn giao đơn, mua hàng…"}
        </p>
      </section>

      <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {sortQuests(data.quests).map((q) => (
          <QuestCard
            key={q.code}
            quest={q}
            onClaimed={() =>
              setData((d) => d && { ...d, quests: d.quests.map((x) => (x.code === q.code ? { ...x, claimed: true } : x)) })
            }
          />
        ))}
      </ul>
    </>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <span
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      style={{ display: "block", height: 10, borderRadius: 5, background: "#eee0c6", overflow: "hidden" }}
    >
      <span
        style={{
          display: "block",
          height: "100%",
          width: `${ratio * 100}%`,
          background: ratio >= 1 ? "var(--mint)" : "var(--caramel)",
          transition: "width .4s ease",
        }}
      />
    </span>
  );
}

function QuestCard({ quest: q, onClaimed }: { quest: Quest; onClaimed: () => void }) {
  const { run, busy } = useAction("claim-quest");
  const done = questDone(q);

  async function claim() {
    const res = await run(
      { code: q.code },
      {
        success: (d) =>
          [`+${formatNumber(d.coins)} ₵`, d.gems ? `+${d.gems} gem` : null, `+${d.xp} XP`, d.leveled_up ? `Lên cấp ${d.level}!` : null]
            .filter(Boolean)
            .join(" · "),
      },
    );
    if (res) onClaimed();
  }

  return (
    <li className="card stack" style={{ gap: 8, opacity: q.claimed ? 0.65 : 1 }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 16 }}>{q.title}</strong>
          <p className="small muted" style={{ margin: "2px 0 0", fontWeight: 700 }}>
            {q.description}
          </p>
        </div>
        {q.claimed ? (
          <span className="badge row" style={{ gap: 4, color: "var(--mint-strong)" }}>
            <IconCheck size={14} /> Đã nhận
          </span>
        ) : (
          <button type="button" className="btn btn--primary btn--sm" disabled={!done || busy} onClick={claim}>
            {busy ? "…" : "Nhận"}
          </button>
        )}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <span style={{ flex: 1 }}>
          <Bar value={q.progress} max={q.target} />
        </span>
        <span className="small" style={{ fontWeight: 800, minWidth: 64, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {formatNumber(q.progress)}/{formatNumber(q.target)}
        </span>
      </div>
      <div className="row small" style={{ gap: 12, fontWeight: 800, flexWrap: "wrap" }}>
        <span className="row" style={{ gap: 4 }}>
          <CoinIcon /> +{formatNumber(q.reward_coins)}
        </span>
        {q.reward_gems > 0 && (
          <span className="row" style={{ gap: 4 }}>
            <GemIcon /> +{q.reward_gems}
          </span>
        )}
        <span className="muted">+{q.reward_xp} XP</span>
      </div>
    </li>
  );
}
