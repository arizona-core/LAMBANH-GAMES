import { formatNumber } from "@/lib/game/format";
import { INSPECTION_KINDS, INSPECTION_RESULTS, type Inspection } from "@/lib/game/operations";
import { IconShield } from "./icons";

const RESULT_STYLE: Record<Inspection["result"], { bg: string; fg: string }> = {
  pass: { bg: "#e3f0dc", fg: "var(--mint-strong)" },
  warning: { bg: "#fff3d6", fg: "#7a5514" },
  fined: { bg: "#fde2e0", fg: "var(--danger)" },
};

const TIME = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  hour12: false,
});

/** Biên bản thanh tra: kết quả, cán bộ, các lỗi phát hiện, tiền phạt, uy tín. */
export function InspectionReport({ inspection: i, compact = false }: { inspection: Inspection; compact?: boolean }) {
  const style = RESULT_STYLE[i.result];
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
        <span
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#34507f",
            color: "#ffd54f",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IconShield size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: compact ? 15 : 16 }}>{INSPECTION_KINDS[i.kind]}</strong>
          <div className="small muted" style={{ fontWeight: 700 }}>
            Cán bộ {i.inspector} · {TIME.format(new Date(i.created_at))}
          </div>
        </div>
        <span className="badge" style={{ background: style.bg, color: style.fg }}>
          {INSPECTION_RESULTS[i.result]}
        </span>
      </div>

      {i.kind === "food" && i.hygiene !== null && (
        <p className="small" style={{ margin: 0, fontWeight: 700 }}>
          Vệ sinh lúc kiểm tra: {i.hygiene}%
        </p>
      )}
      {i.findings.length > 0 ? (
        <ul className="small" style={{ margin: 0, paddingLeft: 18, fontWeight: 700 }}>
          {i.findings.map((f) => (
            <li key={f.text}>
              {f.text}
              {f.fine > 0 && <strong style={{ color: "var(--danger)" }}> · phạt {formatNumber(f.fine)} ₵</strong>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small" style={{ margin: 0, fontWeight: 700, color: "var(--mint-strong)" }}>
          {i.kind === "food" ? "Bếp sạch, không có khách ngộ độc. Tiệm đạt chuẩn!" : "Thuế đóng đầy đủ, đúng hạn. Tiệm đạt chuẩn!"}
        </p>
      )}
      <p className="small" style={{ margin: 0, fontWeight: 800 }}>
        {i.fine > 0 && <span style={{ color: "var(--danger)" }}>Tổng phạt {formatNumber(i.fine)} ₵ · </span>}
        <span style={{ color: i.reputation_delta > 0 ? "var(--mint-strong)" : i.reputation_delta < 0 ? "var(--danger)" : "var(--ink-muted)" }}>
          Uy tín {i.reputation_delta > 0 ? "+" : ""}
          {i.reputation_delta}
        </span>
        {i.fine_bill && (
          <span className="muted">
            {" · "}
            {i.fine_bill.status === "paid" ? "đã nộp phạt" : i.fine_bill.status === "due" ? `còn nợ ${formatNumber(i.fine_bill.owed)} ₵` : ""}
          </span>
        )}
      </p>
    </div>
  );
}
