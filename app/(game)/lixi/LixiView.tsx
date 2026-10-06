"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LuckyEnvelope } from "@/components/LuckyEnvelope";
import { Modal } from "@/components/Modal";
import { CoinIcon, GemIcon, IconCheck, IconClock, IconEnvelope } from "@/components/icons";
import { callAction } from "@/lib/api/actions";
import { errorMessage } from "@/lib/game/errors";
import { formatNumber } from "@/lib/game/format";
import { ENVELOPE_MAX_COINS, type Envelope, type EnvelopeMilestone, type EnvelopeReward, type EnvelopeState } from "@/lib/game/operations";
import { useToast } from "@/lib/store/toast";
import styles from "./lixi.module.css";

/** Bao đang mở trong animation tối thiểu bao lâu (cho cảm giác hồi hộp). */
const SHAKE_MS = 900;
/** Tải lại tiến độ (thời gian online tăng dần khi đang mở app). */
const RELOAD_MS = 60_000;

export function LixiView() {
  const router = useRouter();
  const push = useToast((s) => s.push);
  const [data, setData] = useState<EnvelopeState | null>(null);
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState<{ envelope: Envelope; reward: EnvelopeReward | null } | null>(null);

  const load = useCallback(async () => {
    const res = await callAction("lucky-envelopes", {});
    if (!res.ok) {
      setFailed(true);
      push(errorMessage(res.error), "error");
      return;
    }
    setFailed(false);
    setData(res.data);
    if (res.data.new > 0) push(`Bạn vừa nhận ${res.data.new} bao lì xì mới!`, "success");
  }, [push]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(() => document.visibilityState === "visible" && load(), RELOAD_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  // Qua 0:00 (giờ VN) → mốc mới.
  const resetsAt = data?.resets_at;
  useEffect(() => {
    if (!resetsAt) return;
    const id = setTimeout(load, Math.max(0, new Date(resetsAt).getTime() - Date.now()) + 2000);
    return () => clearTimeout(id);
  }, [resetsAt, load]);

  async function open(envelope: Envelope) {
    setOpening({ envelope, reward: null });
    const [res] = await Promise.all([
      callAction("open-envelope", { envelopeId: envelope.id }),
      new Promise((r) => setTimeout(r, SHAKE_MS)),
    ]);
    if (!res.ok) {
      push(errorMessage(res.error), "error");
      setOpening(null);
      load();
      return;
    }
    const reward = res.data;
    setOpening({ envelope, reward });
    setData(
      (d) =>
        d && {
          ...d,
          unopened: d.unopened.filter((e) => e.id !== envelope.id),
          opened_today: [
            { id: envelope.id, title: envelope.title, coins: reward.coins, gems: reward.gems, wish: reward.wish, opened_at: new Date().toISOString() },
            ...d.opened_today,
          ],
        },
    );
    router.refresh(); // HUD xu/gem
  }

  if (!data) {
    return (
      <p className="empty" style={{ padding: 24 }}>
        {failed ? (
          <button type="button" className="btn btn--soft" onClick={load}>
            Tải lại lì xì
          </button>
        ) : (
          "Đang tải túi lì xì…"
        )}
      </p>
    );
  }

  const earnedToday = data.milestones.filter((m) => m.earned).length;
  const coinsToday = data.opened_today.reduce((s, e) => s + e.coins, 0);
  const gemsToday = data.opened_today.reduce((s, e) => s + e.gems, 0);
  const next = opening?.reward ? data.unopened[0] : undefined;

  return (
    <>
      <section className={`card stack ${styles.bag}`} aria-labelledby="bag-title">
        <div className="row" style={{ gap: 8 }}>
          <IconEnvelope size={22} color="#b3261e" />
          <h2 id="bag-title" style={{ fontSize: 18 }}>
            Túi lì xì
          </h2>
          <span className="spacer" />
          <span className="badge">{data.unopened.length} bao chưa mở</span>
        </div>
        {data.unopened.length === 0 ? (
          <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
            Chưa có bao nào. Hoàn thành các mốc bên dưới để nhận lì xì — mỗi bao có thể có tới {formatNumber(ENVELOPE_MAX_COINS)} ₵
            (đôi khi kèm gem), hoặc chỉ là một lời chúc may mắn!
          </p>
        ) : (
          <>
            <div className={styles.grid}>
              {data.unopened.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={styles.envelope}
                  onClick={() => open(e)}
                  disabled={!!opening}
                  aria-label={`Mở bao lì xì: ${e.title}`}
                >
                  <LuckyEnvelope size={64} />
                  {e.title}
                </button>
              ))}
            </div>
            <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
              Chạm vào bao để mở. Có thể trúng tới {formatNumber(ENVELOPE_MAX_COINS)} ₵ hoặc chỉ nhận lời chúc may mắn.
            </p>
          </>
        )}
      </section>

      <section className="stack" aria-labelledby="ms-title">
        <div className="row" style={{ gap: 8 }}>
          <h2 id="ms-title" style={{ fontSize: 18 }}>
            Nhận lì xì hôm nay
          </h2>
          <span className="spacer" />
          <span className="small muted" style={{ fontWeight: 800 }}>
            {earnedToday}/{data.milestones.length} bao
          </span>
        </div>
        <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {data.milestones.map((m) => (
            <MilestoneCard key={m.code} milestone={m} />
          ))}
        </ul>
        <p className="small muted row" style={{ margin: 0, gap: 4, fontWeight: 700 }}>
          <IconClock size={14} /> Mốc làm mới lúc 0:00 mỗi ngày. Bao chưa mở được giữ lại.
        </p>
      </section>

      {data.opened_today.length > 0 && (
        <section className="card stack" style={{ gap: 6 }} aria-labelledby="opened-title">
          <div className="row" style={{ gap: 8 }}>
            <h2 id="opened-title" style={{ fontSize: 18 }}>
              Đã mở hôm nay
            </h2>
            <span className="spacer" />
            <strong className="row" style={{ gap: 4 }}>
              <CoinIcon /> +{formatNumber(coinsToday)}
              {gemsToday > 0 && (
                <>
                  {" "}
                  <GemIcon /> +{gemsToday}
                </>
              )}
            </strong>
          </div>
          {data.opened_today.map((e) => (
            <div key={e.id} className="row small" style={{ gap: 8, fontWeight: 700 }}>
              <span>{e.title}</span>
              <span className="muted" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                · {e.wish}
              </span>
              <strong style={{ color: e.coins > 0 ? "#b3261e" : "var(--ink-muted)" }}>
                {e.coins > 0 ? `+${formatNumber(e.coins)} ₵` : "Lời chúc"}
                {e.gems > 0 && ` +${e.gems} gem`}
              </strong>
            </div>
          ))}
        </section>
      )}

      {opening && (
        <Modal title="Mở lì xì" onClose={() => opening.reward && setOpening(null)}>
          <div className={styles.stage} aria-live="polite">
            {!opening.reward ? (
              <>
                <span className={styles.shake}>
                  <LuckyEnvelope size={110} />
                </span>
                <strong>Đang mở bao “{opening.envelope.title}”…</strong>
              </>
            ) : (
              <>
                <span className={styles.sparkles}>
                  <LuckyEnvelope size={84} open />
                </span>
                <div className={`stack ${styles.pop}`} style={{ alignItems: "center", gap: 6 }}>
                  {opening.reward.lucky ? (
                    <>
                      <span className={styles.amount}>+{formatNumber(opening.reward.coins)} ₵</span>
                      {opening.reward.gems > 0 && (
                        <span className="row" style={{ gap: 4, fontWeight: 800, fontSize: 18 }}>
                          <GemIcon size={20} /> +{opening.reward.gems} gem
                        </span>
                      )}
                    </>
                  ) : (
                    <span className={styles.wish} style={{ color: "#b3261e" }}>
                      Chúc may mắn lần sau!
                    </span>
                  )}
                  <p className={styles.wish}>“{opening.reward.wish}”</p>
                </div>
                <div className="row" style={{ gap: 8, width: "100%" }}>
                  {next && (
                    <button type="button" className="btn btn--primary" style={{ flex: 1 }} onClick={() => open(next)}>
                      Mở bao tiếp
                    </button>
                  )}
                  <button type="button" className={`btn ${next ? "btn--white" : "btn--primary"}`} style={{ flex: 1 }} onClick={() => setOpening(null)}>
                    Xong
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function MilestoneCard({ milestone: m }: { milestone: EnvelopeMilestone }) {
  const unit = m.code.startsWith("online") ? " phút" : "";
  const ratio = m.target > 0 ? Math.min(1, m.progress / m.target) : 0;
  return (
    <li className="card row" style={{ gap: 10, opacity: m.earned ? 0.75 : 1 }}>
      <span style={{ flexShrink: 0 }}>
        <LuckyEnvelope size={28} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }} className="stack">
        <div className="row" style={{ gap: 6 }}>
          <strong>{m.title}</strong>
          <span className="spacer" />
          {m.earned ? (
            <span className="badge row" style={{ gap: 4, color: "var(--mint-strong)" }}>
              <IconCheck size={14} /> Đã nhận bao
            </span>
          ) : (
            <span className="small" style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {formatNumber(m.progress)}/{formatNumber(m.target)}
              {unit}
            </span>
          )}
        </div>
        <span className="small muted" style={{ fontWeight: 700 }}>
          {m.description}
        </span>
        {!m.earned && (
          <span
            role="progressbar"
            aria-label={m.title}
            aria-valuenow={m.progress}
            aria-valuemin={0}
            aria-valuemax={m.target}
            style={{ display: "block", height: 8, borderRadius: 4, background: "#eee0c6", overflow: "hidden" }}
          >
            <span style={{ display: "block", height: "100%", width: `${ratio * 100}%`, background: "var(--strawberry-strong)" }} />
          </span>
        )}
      </div>
    </li>
  );
}
