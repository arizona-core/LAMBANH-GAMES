"use client";

import { useCallback, useEffect, useState } from "react";
import { HygieneMeter } from "@/components/HygieneMeter";
import { InspectionReport } from "@/components/InspectionReport";
import { CoinIcon, IconAlert, IconBroom, IconReceipt, IconShield } from "@/components/icons";
import { useAction } from "@/components/useAction";
import { callAction } from "@/lib/api/actions";
import { errorMessage } from "@/lib/game/errors";
import { formatNumber } from "@/lib/game/format";
import {
  BILL_KINDS,
  billUsage,
  formatDay,
  formatDeadline,
  HYGIENE_FINE,
  HYGIENE_LABEL,
  HYGIENE_RISK,
  hygieneLevel,
  totalOwed,
  type Bill,
  type BillsData,
} from "@/lib/game/operations";
import { useToast } from "@/lib/store/toast";
import styles from "./bills.module.css";

export function BillsView() {
  const push = useToast((s) => s.push);
  const [data, setData] = useState<BillsData | null>(null);
  const [failed, setFailed] = useState(false);
  const pay = useAction("pay-bills");
  const clean = useAction("clean-shop");

  const load = useCallback(async () => {
    const res = await callAction("get-bills", {});
    if (!res.ok) {
      setFailed(true);
      push(errorMessage(res.error), "error");
      return;
    }
    setFailed(false);
    setData(res.data);
    if (res.data.autopaid > 0) {
      push(`Đã tự trừ ${formatNumber(res.data.autopaid)} ₵ cho hóa đơn quá hạn (kèm phí trễ ${res.data.rates.late_fee_pct}%)`, "error");
    }
  }, [push]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  async function payBills(bills: Bill[]) {
    // Luôn gửi đúng danh sách đang thấy (server tối đa 50/lần) để không đóng nhầm hóa đơn vừa phát sinh.
    const res = await pay.run(
      { billIds: bills.slice(0, 50).map((b) => b.id) },
      { success: (d) => `Đã đóng ${d.count} hóa đơn · −${formatNumber(d.paid)} ₵` },
    );
    if (res) load();
  }

  async function cleanShop() {
    const res = await clean.run({}, { success: (d) => `Tiệm sạch bong! Tốn ${d.water} m³ nước (cộng vào hóa đơn nước)` });
    if (res) load();
  }

  if (!data) {
    return (
      <p className="empty" style={{ padding: 24 }}>
        {failed ? (
          <button type="button" className="btn btn--soft" onClick={load}>
            Tải lại
          </button>
        ) : (
          "Đang tính hóa đơn…"
        )}
      </p>
    );
  }

  const level = hygieneLevel(data.hygiene);
  const owedAll = totalOwed(data.due);
  const todayTotal = data.today.reduce((s, b) => s + b.amount, 0);
  const busy = pay.busy || clean.busy;

  return (
    <>
      {/* ---------- Vệ sinh ---------- */}
      <section className="card stack" style={{ gap: 8 }} aria-labelledby="hygiene-title">
        <div className="row" style={{ gap: 8 }}>
          <IconBroom size={22} color="var(--primary)" />
          <h2 id="hygiene-title" style={{ fontSize: 18 }}>
            Vệ sinh tiệm
          </h2>
          <span className="spacer" />
          <strong style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>{data.hygiene}%</strong>
        </div>
        <HygieneMeter value={data.hygiene} height={12} />
        <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
          <strong style={{ color: level === "clean" ? "var(--mint-strong)" : level === "dirty" ? "#7a5514" : "var(--danger)" }}>
            {HYGIENE_LABEL[level]}.
          </strong>{" "}
          Mỗi đơn làm tiệm bẩn đi 2% (món chiên 3%). Dưới {HYGIENE_RISK}% khách dễ bị ngộ độc, dưới {HYGIENE_FINE}% thanh tra sẽ
          phạt.
        </p>
        <button type="button" className="btn btn--primary btn--block" onClick={cleanShop} disabled={busy || data.hygiene >= 100}>
          {data.hygiene >= 100
            ? "Tiệm đang sạch bong"
            : `Dọn dẹp · tốn ${data.clean_water} m³ nước (${formatNumber(data.clean_water * data.rates.water_price)} ₵)`}
        </button>
      </section>

      {/* ---------- Cần đóng ---------- */}
      <section className="card stack" style={{ gap: 4 }} aria-labelledby="due-title">
        <div className="row" style={{ gap: 8 }}>
          <IconReceipt size={22} color="var(--primary)" />
          <h2 id="due-title" style={{ fontSize: 18 }}>
            Cần đóng
          </h2>
          <span className="spacer" />
          {data.due.length > 0 && <span className="badge">{data.due.length} hóa đơn</span>}
        </div>
        {data.due.length === 0 ? (
          <p className="small muted" style={{ margin: "4px 0 0", fontWeight: 700 }}>
            Không có hóa đơn nào cần đóng. Hóa đơn hôm nay chốt sổ lúc 0:00.
          </p>
        ) : (
          <>
            {data.due.map((b) => (
              <BillRow key={b.id} bill={b} taxPct={data.rates.tax_pct} lateFeePct={data.rates.late_fee_pct}>
                <button
                  type="button"
                  className={`btn btn--sm ${b.kind === "fine" || b.overdue ? "btn--primary" : "btn--soft"}`}
                  disabled={busy || data.coins < b.owed}
                  onClick={() => payBills([b])}
                >
                  Đóng
                </button>
              </BillRow>
            ))}
            <div className={styles.total}>
              Tổng <CoinIcon /> {formatNumber(owedAll)}
              <span className="spacer" />
              <button type="button" className="btn btn--primary btn--sm" disabled={busy || data.coins < owedAll} onClick={() => payBills(data.due)}>
                Đóng tất cả
              </button>
            </div>
            {data.coins < owedAll && (
              <p className="small" style={{ margin: 0, fontWeight: 700, color: "var(--danger)" }}>
                Bạn chưa đủ xu để đóng hết — đóng từng hóa đơn, ưu tiên tiền phạt và thuế.
              </p>
            )}
          </>
        )}
        <p className="small muted" style={{ margin: "6px 0 0", fontWeight: 700 }}>
          Quá hạn bị cộng {data.rates.late_fee_pct}% phí trễ hạn. Tiền nhà, điện, nước và tiền phạt quá hạn sẽ bị tự trừ vào xu. Thuế
          không tự trừ, nhưng nếu thanh tra phát hiện nợ thuế quá hạn sẽ bị truy thu và phạt gấp đôi.
        </p>
      </section>

      {/* ---------- Hôm nay (tạm tính) ---------- */}
      <section className="card stack" style={{ gap: 4 }} aria-labelledby="today-title">
        <h2 id="today-title" style={{ fontSize: 18 }}>
          Hôm nay · tạm tính
        </h2>
        {data.today.length === 0 ? (
          <p className="small muted" style={{ margin: "4px 0 0", fontWeight: 700 }}>
            Chưa bán đơn nào hôm nay — chưa tính tiền nhà, điện, nước.
          </p>
        ) : (
          <>
            {data.today.map((b) => (
              <BillRow key={b.id} bill={b} taxPct={data.rates.tax_pct} lateFeePct={data.rates.late_fee_pct} />
            ))}
            <div className={styles.total}>
              Dự kiến <CoinIcon /> {formatNumber(todayTotal)}
            </div>
          </>
        )}
        <p className="small muted" style={{ margin: "6px 0 0", fontWeight: 700 }}>
          Chốt sổ lúc 0:00 (giờ Việt Nam), hạn đóng hết ngày hôm sau. Không mở bán thì không mất tiền nhà.
        </p>
      </section>

      {/* ---------- Bảng giá ---------- */}
      <section className="card stack" style={{ gap: 8 }} aria-labelledby="rates-title">
        <h2 id="rates-title" style={{ fontSize: 18 }}>
          Bảng giá
        </h2>
        <dl className={styles.rates}>
          <dt>Tiền nhà (theo cấp + số chỗ ngồi)</dt>
          <dd>{formatNumber(data.rates.rent)} ₵/ngày bán</dd>
          <dt>
            Điện · nướng {data.rates.electric_units.bake}, chiên {data.rates.electric_units.fry}, hấp {data.rates.electric_units.steam}, làm lạnh{" "}
            {data.rates.electric_units.chill} kWh/đơn
          </dt>
          <dd>{data.rates.electric_price} ₵/kWh</dd>
          <dt>Nước · 1 m³/đơn (hấp {data.rates.water_units.steam}), dọn dẹp tốn thêm</dt>
          <dd>{data.rates.water_price} ₵/m³</dd>
          <dt>Thuế kinh doanh</dt>
          <dd>{data.rates.tax_pct}% doanh thu</dd>
          <dt>Phí trễ hạn</dt>
          <dd>+{data.rates.late_fee_pct}%</dd>
        </dl>
      </section>

      {/* ---------- Thanh tra ---------- */}
      <section className="stack" aria-labelledby="insp-title">
        <div className="row" style={{ gap: 8 }}>
          <IconShield size={22} color="var(--primary)" />
          <h2 id="insp-title" style={{ fontSize: 18 }}>
            Thanh tra gần đây
          </h2>
        </div>
        {data.inspections.length === 0 ? (
          <p className="card small muted" style={{ margin: 0, fontWeight: 700 }}>
            Chưa có đoàn thanh tra nào ghé. Thanh tra tới bất chợt khi tiệm đang mở — giữ tiệm sạch và đóng thuế đúng hạn nhé!
          </p>
        ) : (
          data.inspections.map((i) => (
            <article key={i.id} className="card">
              <InspectionReport inspection={i} compact />
            </article>
          ))
        )}
      </section>

      {/* ---------- Đã đóng ---------- */}
      {data.history.length > 0 && (
        <section className="card stack" style={{ gap: 4 }} aria-labelledby="history-title">
          <h2 id="history-title" style={{ fontSize: 18 }}>
            Đã đóng gần đây
          </h2>
          {data.history.map((b) => (
            <div key={b.id} className="row small" style={{ gap: 8, fontWeight: 700, padding: "4px 0" }}>
              <span>
                {BILL_KINDS[b.kind]} · {formatDay(b.day)}
              </span>
              <span className="spacer" />
              <span className="muted">
                {b.status === "audited" ? "Gộp vào tiền phạt" : b.autopaid ? "Tự trừ" : "Đã đóng"}
              </span>
              <strong style={{ minWidth: 64, textAlign: "right" }}>{formatNumber(b.amount + b.late_fee)} ₵</strong>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function BillRow({
  bill: b,
  taxPct,
  lateFeePct,
  children,
}: {
  bill: Bill;
  taxPct: number;
  lateFeePct: number;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.billRow}>
      <span className={`${styles.billIcon} ${b.kind === "tax" ? styles.billIcon_tax : b.kind === "fine" ? styles.billIcon_fine : ""}`}>
        {b.kind === "fine" ? <IconShield size={20} /> : <IconReceipt size={20} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>
          {BILL_KINDS[b.kind]}
          {b.status !== "open" && <span className="muted"> · {formatDay(b.day)}</span>}
        </strong>
        <div className="small muted" style={{ fontWeight: 700 }}>
          {billUsage(b, taxPct)}
        </div>
        {b.status === "due" && b.due_at && (
          <div className="small" style={{ fontWeight: 700 }}>
            {b.overdue ? (
              <span className={styles.overdue}>
                <IconAlert size={13} style={{ verticalAlign: -2 }} /> Quá hạn ·{" "}
                {b.kind === "tax" ? "thanh tra phát hiện sẽ phạt gấp đôi" : `+${lateFeePct}% phí, sẽ bị tự trừ`}
              </span>
            ) : (
              <span className="muted">Hạn {formatDeadline(b.due_at)}</span>
            )}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right" }}>
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatNumber(b.status === "open" ? b.amount : b.owed)} ₵</strong>
        {b.late_fee > 0 && (
          <div className="small" style={{ fontWeight: 700, color: "var(--danger)" }}>
            gồm phí trễ {formatNumber(b.late_fee)}
          </div>
        )}
        {b.paid > 0 && b.status === "due" && (
          <div className="small muted" style={{ fontWeight: 700 }}>
            đã trừ {formatNumber(b.paid)}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
