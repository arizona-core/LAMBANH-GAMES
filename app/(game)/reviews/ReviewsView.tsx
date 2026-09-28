"use client";

import { useState } from "react";
import { CustomerAvatar } from "@/components/CustomerAvatar";
import { Stars } from "@/components/Stars";
import { useAction } from "@/components/useAction";
import { formatNumber } from "@/lib/game/format";

export type ReviewItem = {
  id: string;
  stars: number;
  comment: string;
  reply: string | null;
  createdAt: string;
  customer: { name: string; image: string | null; look: number; personality: string };
  order: string;
};

type Filter = "all" | "unreplied" | 1 | 2 | 3 | 4 | 5;

const QUICK_REPLIES = [
  "Cảm ơn bạn rất nhiều, hẹn gặp lại nhé!",
  "Xin lỗi bạn vì trải nghiệm chưa tốt, lần sau tiệm sẽ làm tốt hơn!",
  "Cảm ơn góp ý, tiệm sẽ làm nhanh hơn ạ.",
];

const timeFmt = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

export function ReviewsView({
  avg,
  total,
  counts,
  items,
  reputation,
}: {
  avg: number;
  total: number;
  counts: number[];
  items: ReviewItem[];
  reputation: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const max = Math.max(1, ...counts);
  const shown = items.filter((r) =>
    filter === "all" ? true : filter === "unreplied" ? !r.reply : r.stars === filter,
  );

  return (
    <>
      <section className="card row" style={{ alignItems: "center", gap: 16 }} aria-label="Tổng quan">
        <div style={{ textAlign: "center", minWidth: 96 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 40, color: "var(--ink-strong)", lineHeight: 1 }}>
            {total ? avg.toFixed(1).replace(".", ",") : "–"}
          </div>
          <Stars value={Math.round(avg)} size={14} />
          <div className="small muted" style={{ fontWeight: 700 }}>
            {formatNumber(total)} đánh giá
          </div>
        </div>
        <div className="stack" style={{ flex: 1, gap: 4 }}>
          {[5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="row small" style={{ gap: 6, fontWeight: 800 }}>
              <span style={{ width: 12 }}>{s}</span>
              <span style={{ flex: 1, height: 8, borderRadius: 4, background: "#eee0c6", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${(counts[s - 1] / max) * 100}%`, background: "var(--coin)" }} />
              </span>
              <span className="muted" style={{ width: 28, textAlign: "right" }}>
                {counts[s - 1]}
              </span>
            </div>
          ))}
        </div>
      </section>
      <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
        Uy tín tiệm: {formatNumber(reputation)} ★ · Trả lời có tâm (từ 10 ký tự) được +1 uy tín.
      </p>

      <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="tablist" aria-label="Lọc đánh giá">
        {(["all", "unreplied", 5, 4, 3, 2, 1] as Filter[]).map((f) => (
          <button
            key={String(f)}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className="tab"
            style={{ flex: "0 0 auto", padding: "7px 12px", fontSize: 13 }}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Tất cả" : f === "unreplied" ? "Chưa trả lời" : `${f}★`}
          </button>
        ))}
      </div>

      <div className="stack" role="tabpanel">
        {shown.length === 0 ? (
          <p className="empty">
            {total === 0 ? "Chưa có đánh giá nào. Phục vụ khách để nhận đánh giá đầu tiên!" : "Không có đánh giá phù hợp."}
          </p>
        ) : (
          shown.map((r) => <ReviewCard key={r.id} review={r} />)
        )}
      </div>
    </>
  );
}

function ReviewCard({ review }: { review: ReviewItem }) {
  const { run, busy } = useAction("reply-review");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  async function send(reply: string) {
    const res = await run(
      { reviewId: review.id, reply },
      { success: (d) => (d.reputation_gained ? "Đã trả lời · +1 uy tín" : "Đã trả lời") },
    );
    if (res) setOpen(false);
  }

  return (
    <article className="card stack" style={{ gap: 8 }}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <CustomerAvatar look={review.customer.look} image={review.customer.image} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <strong>{review.customer.name}</strong>
            <span className="badge">{review.customer.personality}</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <Stars value={review.stars} size={14} />
            <span className="small muted" style={{ fontWeight: 700 }}>
              {timeFmt.format(new Date(review.createdAt))}
            </span>
          </div>
        </div>
      </div>
      <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.5 }}>“{review.comment}”</p>
      {review.order && (
        <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
          Đã gọi: {review.order}
        </p>
      )}

      {review.reply ? (
        <div style={{ background: "#fff3e2", borderRadius: 12, padding: "8px 12px", borderLeft: "4px solid var(--primary)" }}>
          <div className="small" style={{ fontWeight: 800, color: "var(--primary)" }}>
            Chủ tiệm trả lời
          </div>
          <div className="small" style={{ fontWeight: 700 }}>
            {review.reply}
          </div>
        </div>
      ) : open ? (
        <div className="stack" style={{ gap: 6 }}>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {QUICK_REPLIES.map((q) => (
              <button key={q} type="button" className="btn btn--soft btn--sm" style={{ textAlign: "left" }} onClick={() => setText(q)}>
                {q}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor={`reply-${review.id}`}>
            Nội dung trả lời
          </label>
          <textarea
            id={`reply-${review.id}`}
            className="input"
            style={{ minHeight: 70, padding: 10, resize: "vertical" }}
            maxLength={200}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Viết lời cảm ơn hoặc xin lỗi khách…"
          />
          <div className="row">
            <button type="button" className="btn btn--white btn--sm" onClick={() => setOpen(false)}>
              Huỷ
            </button>
            <span className="spacer" />
            <button type="button" className="btn btn--primary btn--sm" disabled={busy || text.trim().length < 2} onClick={() => send(text)}>
              Gửi trả lời
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn--soft btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
          Trả lời
        </button>
      )}
    </article>
  );
}
