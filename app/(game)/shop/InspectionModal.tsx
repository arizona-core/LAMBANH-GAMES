"use client";

import { useState } from "react";
import { InspectionReport } from "@/components/InspectionReport";
import { IconShield } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { useAction } from "@/components/useAction";
import { formatNumber } from "@/lib/game/format";
import { inspectionProgress, inspectionRevealed, type Inspection } from "@/lib/game/operations";

/**
 * Đoàn thanh tra tới tiệm: 20 giây đầu hiện "đang kiểm tra", sau đó công bố biên bản
 * (kết quả đã do server quyết định ngay lúc đoàn tới). Bị phạt thì nộp ngay được ở đây.
 */
export function InspectionModal({
  inspection: i,
  serverNow,
  onClose,
}: {
  inspection: Inspection;
  serverNow: number;
  onClose: () => void;
}) {
  const pay = useAction("pay-bills");
  const [paid, setPaid] = useState(false);
  const revealed = inspectionRevealed(i, serverNow);
  const fineDue = i.fine_bill?.status === "due" && !paid ? i.fine_bill : null;

  async function payFine() {
    if (!fineDue) return;
    const res = await pay.run({ billIds: [fineDue.id] }, { success: (d) => `Đã nộp phạt ${formatNumber(d.paid)} ₵` });
    if (res) setPaid(true);
  }

  return (
    <Modal title="Đoàn thanh tra" onClose={onClose}>
      {!revealed ? (
        <div className="stack" style={{ alignItems: "center", textAlign: "center", gap: 10 }} aria-live="polite">
          <span
            aria-hidden="true"
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "#34507f",
              color: "#ffd54f",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 0 #1f3357",
            }}
          >
            <IconShield size={40} />
          </span>
          <strong style={{ fontSize: 17 }}>
            {i.kind === "food" ? "Thanh tra an toàn thực phẩm" : "Cán bộ thuế"} {i.inspector} đang kiểm tra tiệm…
          </strong>
          <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
            {i.kind === "food"
              ? "Kiểm tra bếp, kho nguyên liệu, vệ sinh và phản ánh ngộ độc của khách."
              : "Kiểm tra sổ sách và các hóa đơn thuế đã đến hạn."}
          </p>
          <span
            role="progressbar"
            aria-label="Tiến độ kiểm tra"
            aria-valuenow={Math.round(inspectionProgress(i, serverNow) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ display: "block", width: "100%", height: 10, borderRadius: 5, background: "#eee0c6", overflow: "hidden" }}
          >
            <span
              style={{
                display: "block",
                height: "100%",
                width: `${inspectionProgress(i, serverNow) * 100}%`,
                background: "#34507f",
                transition: "width 1s linear",
              }}
            />
          </span>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }} aria-live="polite">
          <InspectionReport inspection={paid && i.fine_bill ? { ...i, fine_bill: { ...i.fine_bill, status: "paid", owed: 0 } } : i} />
          {fineDue ? (
            <>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn--primary" style={{ flex: 1 }} onClick={payFine} disabled={pay.busy}>
                  Nộp phạt {formatNumber(fineDue.owed)} ₵
                </button>
                <button type="button" className="btn btn--white" style={{ flex: 1 }} onClick={onClose}>
                  Để sau
                </button>
              </div>
              <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
                Hạn nộp phạt 24 giờ. Quá hạn sẽ bị tự trừ vào xu kèm 20% phí trễ hạn.
              </p>
            </>
          ) : (
            <button type="button" className="btn btn--primary btn--block" onClick={onClose}>
              Đã hiểu
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
