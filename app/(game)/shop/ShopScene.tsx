/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CustomerAvatar, TraitChips } from "@/components/CustomerAvatar";
import { HygieneMeter } from "@/components/HygieneMeter";
import { InstallAppButton } from "@/components/InstallAppButton";
import { LuckyEnvelope } from "@/components/LuckyEnvelope";
import { Stars } from "@/components/Stars";
import { IconBroom, IconCalendar, IconCheck, IconClock, IconReceipt } from "@/components/icons";
import { useAction } from "@/components/useAction";
import { callAction } from "@/lib/api/actions";
import { LATEST_UPDATE, UPDATES_SEEN_KEY, formatUpdateDate } from "@/lib/game/changelog";
import { formatGameTime, formatMinute, gameClock, nextRush, trafficLevel } from "@/lib/game/clock";
import { errorMessage } from "@/lib/game/errors";
import { formatNumber } from "@/lib/game/format";
import {
  HYGIENE_FINE,
  HYGIENE_RISK,
  INSPECTOR_STAY_MS,
  inspectionRevealed,
  type BillsSummary,
  type Inspection,
} from "@/lib/game/operations";
import { orderText, type Visit } from "@/lib/game/orders";
import { useToast } from "@/lib/store/toast";
import type { SceneCustomer } from "@/game/scenes/IsoShopScene";
import { InspectionModal } from "./InspectionModal";
import { ShopIso } from "./ShopIso";
import styles from "./shop.module.css";

const TUTORIAL_KEY = "sweetshop.tutorial.v2";
/** localStorage: biên bản thanh tra cuối cùng người chơi đã xem (để không hiện lại). */
const INSPECTION_SEEN_KEY = "sweetshop.inspection.seen";
const TICK_MS = 15_000;

export function ShopScene({
  revenueToday,
  canClaimDaily,
  welcome,
  decor,
  theme,
  chefImage,
  reviewSummary,
  onlineCount,
  shopOpen: initialShopOpen,
  hygiene: initialHygiene,
  envelopesUnopened,
}: {
  revenueToday: number;
  canClaimDaily: boolean;
  welcome: boolean;
  decor: string[];
  theme: string;
  chefImage: string | null;
  reviewSummary: { avg: number; total: number };
  onlineCount: number;
  shopOpen: boolean;
  hygiene: number;
  envelopesUnopened: number;
}) {
  const router = useRouter();
  const push = useToast((s) => s.push);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [seated, setSeated] = useState<(Visit & { served_at: string })[]>([]);
  const [offset, setOffset] = useState(0); // server_now − Date.now()
  const [now, setNow] = useState(() => Date.now());
  const [showTip, setShowTip] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [shopOpen, setShopOpen] = useState(initialShopOpen);
  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [hygiene, setHygiene] = useState(initialHygiene);
  const [bills, setBills] = useState<BillsSummary | null>(null);
  const [envelopes, setEnvelopes] = useState(envelopesUnopened);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [seenInspection, setSeenInspection] = useState<string | null>(null);
  // Đóng modal lúc đoàn đang kiểm tra → ẩn tạm, tới lúc công bố kết quả thì hiện lại.
  const [hiddenInspection, setHiddenInspection] = useState<string | null>(null);
  const clean = useAction("clean-shop");
  const errorShown = useRef(false);

  const tick = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const res = await callAction("customer-tick", {});
    if (!res.ok) {
      if (!errorShown.current) push(errorMessage(res.error), "error");
      errorShown.current = true;
      return;
    }
    errorShown.current = false;
    setOffset(new Date(res.data.server_now).getTime() - Date.now());
    setVisits(res.data.visits);
    setSeated(res.data.seated ?? []);
    setShopOpen(res.data.shop_open);
    setLoaded(true);
    // Server cũ (đang deploy dở) chưa trả `ops` → bỏ qua phần vận hành.
    const ops = res.data.ops as typeof res.data.ops | undefined;
    if (ops) {
      setHygiene(ops.hygiene);
      setBills(ops.bills);
      setEnvelopes(ops.envelopes_unopened);
      setInspection(ops.inspection);
      if (ops.envelopes_new > 0) push(`Bạn nhận được ${ops.envelopes_new} bao lì xì! Vào mục Lì xì để mở`, "success");
      if (ops.autopaid > 0) {
        push(`Hóa đơn quá hạn: đã tự trừ ${formatNumber(ops.autopaid)} ₵ (kèm phí trễ hạn)`, "error");
        router.refresh();
      }
    }
    if (res.data.closed_offline > 0) {
      push(`Bạn vừa offline nên tiệm tạm đóng — ${res.data.closed_offline} khách đã về, không bị trừ uy tín`);
    }
    if (res.data.left > 0) {
      push(
        res.data.reputation_lost > 0
          ? `${res.data.left} khách bỏ đi vì chờ lâu (−${res.data.reputation_lost} uy tín)`
          : `${res.data.left} khách đã bỏ đi`,
        "error",
      );
      router.refresh();
    }
  }, [push, router]);

  const toggleShop = useCallback(async () => {
    setToggling(true);
    const res = await callAction("set-shop-open", { open: !shopOpen });
    setToggling(false);
    if (!res.ok) return push(errorMessage(res.error), "error");
    setShopOpen(res.data.shop_open);
    push(
      res.data.shop_open
        ? "Đã mở cửa — khách sẽ bắt đầu ghé"
        : res.data.sent_home > 0
          ? `Đã đóng cửa — ${res.data.sent_home} khách đang chờ đã về (không trừ uy tín)`
          : "Đã đóng cửa — không có khách mới cho tới khi mở lại",
      "success",
    );
    tick();
  }, [shopOpen, push, tick]);

  // Nhịp sinh khách: chỉ chạy khi đang mở app (tab đang hiển thị).
  useEffect(() => {
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, TICK_MS);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tick]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      // Đọc localStorage chỉ có ở browser → phải set sau khi mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowTip(welcome || !localStorage.getItem(TUTORIAL_KEY));
      setHasNewUpdate(localStorage.getItem(UPDATES_SEEN_KEY) !== LATEST_UPDATE);
      setSeenInspection(localStorage.getItem(INSPECTION_SEEN_KEY));
    } catch {
      setShowTip(welcome);
    }
  }, [welcome]);

  function dismissTip() {
    setShowTip(false);
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {}
  }

  async function cleanShop() {
    const res = await clean.run({}, { success: (d) => `Tiệm sạch bong! Tốn ${d.water} m³ nước`, refresh: false });
    if (res) setHygiene(res.hygiene);
  }

  function closeInspection() {
    if (!inspection) return;
    if (!inspectionRevealed(inspection, Date.now() + offset)) {
      setHiddenInspection(inspection.id);
      return;
    }
    setSeenInspection(inspection.id);
    try {
      localStorage.setItem(INSPECTION_SEEN_KEY, inspection.id);
    } catch {}
  }

  const serverNow = now + offset;
  // Tiệm mở cả ngày lẫn đêm; chỉ đóng khi chủ tiệm tự đóng (hoặc offline).
  const clock = gameClock(serverNow);
  const traffic = trafficLevel(clock.minuteOfDay);
  const rushNext = nextRush(clock.minuteOfDay);
  const present = visits.filter(
    (v) =>
      new Date(v.arrive_at).getTime() <= serverNow && new Date(v.leave_at).getTime() > serverNow,
  );
  const cooking = present.find((v) => v.status === "cooking");
  const queue = present.filter((v) => v.status === "waiting");
  const sitting = seated.filter((v) => new Date(v.served_at).getTime() + 40_000 > serverNow);
  // Cán bộ thanh tra đứng trong tiệm ~35 giây kể từ lúc tới.
  const inspectorHere =
    inspection && serverNow < new Date(inspection.created_at).getTime() + INSPECTOR_STAY_MS ? inspection : null;
  const showInspection =
    inspection &&
    inspection.id !== seenInspection &&
    !(hiddenInspection === inspection.id && !inspectionRevealed(inspection, serverNow));

  // Danh sách khách cho cảnh isometric — chỉ đổi khi có người tới/đi/đổi trạng thái.
  const sceneKey = [
    ...present.map((v) => v.id + v.status),
    ...sitting.map((v) => v.id + "s"),
    inspectorHere ? `i${inspectorHere.id}` : "",
  ].join("|");
  const sceneCustomers = useMemo<SceneCustomer[]>(
    () => [
      ...present.map((v) => ({
        id: v.id,
        status: v.status as "waiting" | "cooking",
        image: v.customer.image,
        name: v.customer.name,
        look: v.customer.look,
        impatient: v.customer.impatient,
        order: new Date(v.arrive_at).getTime(),
      })),
      ...sitting.map((v) => ({
        id: v.id,
        status: "seated" as const,
        image: v.customer.image,
        name: v.customer.name,
        look: v.customer.look,
        impatient: v.customer.impatient,
        order: new Date(v.served_at).getTime(),
      })),
      ...(inspectorHere
        ? [
            {
              id: `insp-${inspectorHere.id}`,
              status: "inspector" as const,
              image: null,
              name: "Thanh tra",
              look: 0,
              impatient: false,
              order: new Date(inspectorHere.created_at).getTime(),
              leave:
                inspectorHere.result === "pass"
                  ? { text: "Đạt chuẩn!", color: "#3E7A4A" }
                  : inspectorHere.result === "fined"
                    ? { text: "Lập biên bản!", color: "#B3261E" }
                    : { text: "Nhắc nhở!", color: "#7A5514" },
            },
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sceneKey],
  );

  return (
    <>
      <div
        className={`card row ${shopOpen ? styles.clockOpen : styles.clockClosed}`}
        role="timer"
        aria-live="off"
      >
        <IconClock />
        <strong style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>
          {formatGameTime(clock)}
        </strong>
        <span className="small" style={{ fontWeight: 800 }}>
          {shopOpen ? "Đang mở cửa · bán cả ngày lẫn đêm" : "Bạn đã đóng cửa tiệm"}
        </span>
        <span className="spacer" />
        <button
          type="button"
          className={`btn btn--sm ${shopOpen ? "btn--white" : "btn--primary"}`}
          onClick={toggleShop}
          disabled={toggling}
          aria-pressed={!shopOpen}
        >
          {shopOpen ? "Đóng cửa" : "Mở cửa"}
        </button>
      </div>

      {shopOpen && (
        <div className={`${styles.traffic} ${styles[`traffic_${traffic}`]}`} role="status">
          <span className={styles.trafficDot} aria-hidden="true" />
          <strong>
            {traffic === "rush"
              ? "Giờ cao điểm — khách đông!"
              : traffic === "quiet"
                ? clock.hour < 7
                  ? "Đêm khuya — vắng khách"
                  : "Vắng khách"
                : "Khách bình thường"}
          </strong>
          <span className="small" style={{ fontWeight: 700 }}>
            {traffic === "rush"
              ? "Tối đa 3 khách cùng lúc, có khách đi theo nhóm"
              : rushNext
                ? `Cao điểm tiếp: ${formatMinute(rushNext.start)} (còn ${Math.ceil(rushNext.inSeconds / 60)} phút)`
                : ""}
          </span>
        </div>
      )}

      <section className={`card stack ${hygiene < HYGIENE_FINE ? styles.opsDirty : ""}`} style={{ gap: 10 }} aria-label="Vận hành tiệm">
        <div className="row" style={{ gap: 8 }}>
          <IconBroom size={20} color="var(--primary)" />
          <strong>Vệ sinh</strong>
          <HygieneMeter value={hygiene} />
          <strong style={{ minWidth: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{hygiene}%</strong>
          <button type="button" className="btn btn--soft btn--sm" onClick={cleanShop} disabled={clean.busy || hygiene >= 100}>
            Dọn dẹp
          </button>
        </div>
        {hygiene < HYGIENE_RISK && (
          <p className="small" style={{ margin: 0, fontWeight: 800, color: "var(--danger)" }}>
            {hygiene < HYGIENE_FINE
              ? "Tiệm bẩn! Thanh tra tới sẽ phạt, khách dễ bị ngộ độc — dọn ngay nhé."
              : "Tiệm bắt đầu bẩn — khách dễ bị ngộ độc hơn."}
          </p>
        )}
        <Link href="/bills" className="row" style={{ gap: 8 }}>
          <IconReceipt size={20} color="var(--primary)" />
          <strong>Hóa đơn &amp; thuế</strong>
          <span className="small muted" style={{ fontWeight: 700 }}>
            {!bills ? "…" : bills.count > 0 ? `${bills.count} cần đóng · ${formatNumber(bills.owed)} ₵` : "Đã đóng đủ"}
          </span>
          {bills && bills.overdue > 0 && (
            <span className="badge" style={{ background: "var(--danger)", color: "#fff" }}>
              {bills.overdue} quá hạn
            </span>
          )}
          <span className="spacer" />
          <span className="btn btn--white btn--sm">Xem</span>
        </Link>
      </section>

      <InstallAppButton variant="banner" />

      {canClaimDaily && (
        <Link href="/daily" className={`card row ${styles.daily}`}>
          <IconCalendar />
          <span style={{ fontWeight: 800 }}>Điểm danh hôm nay nhận xu &amp; gem</span>
          <span className="spacer" />
          <span className="btn btn--gem btn--sm">Nhận</span>
        </Link>
      )}

      <Link href="/lixi" className={`card row ${styles.lixi}`} style={{ gap: 10 }}>
        <LuckyEnvelope size={24} />
        <strong>Lì xì</strong>
        <span className="small muted" style={{ fontWeight: 700 }}>
          {envelopes > 0 ? `${envelopes} bao chưa mở` : "Online, giao đơn, bán hàng… để nhận bao"}
        </span>
        <span className="spacer" />
        {envelopes > 0 && (
          <span className="badge" style={{ background: "var(--strawberry-strong)", color: "#fff" }}>
            {envelopes}
          </span>
        )}
        <span className="btn btn--soft btn--sm">{envelopes > 0 ? "Mở" : "Xem"}</span>
      </Link>

      <section aria-label="Cửa tiệm" className={styles.isoWrap}>
        <ShopIso config={{ theme, decor, chefImage, hour: clock.hour }} customers={sceneCustomers} />
        <div className={styles.waiting}>
          {!shopOpen
            ? "Tiệm đang đóng cửa"
            : present.length > 0
              ? `${present.length} khách ở quầy`
              : loaded
                ? "Đang chờ khách…"
                : "Đang mở cửa…"}
        </div>
        <div className={styles.revenue}>
          <div className="small muted" style={{ fontSize: 11, fontWeight: 700 }}>
            Doanh thu hôm nay
          </div>
          <div style={{ fontWeight: 800, color: "var(--mint-strong)" }}>+ {formatNumber(revenueToday)} ₵</div>
        </div>
        <div className={styles.counter}>
          {cooking ? (
            <Link href={`/order/${cooking.id}`} className="btn btn--white btn--block">
              Đang làm đơn của {cooking.customer.name.split(" ").pop()} — tiếp tục
            </Link>
          ) : (
            <span className={styles.counterText}>
              {shopOpen
                ? `${sitting.length} khách đang ngồi ăn · nhận đơn bên dưới`
                : "Bấm “Mở cửa” khi sẵn sàng đón khách"}
            </span>
          )}
        </div>
      </section>

      <Link href="/players" className="card row" style={{ gap: 10 }}>
        <span className={styles.onlineDot} aria-hidden="true" />
        <strong>Người chơi</strong>
        <span className="small muted" style={{ fontWeight: 700 }}>
          {onlineCount} đang online
        </span>
        <span className="spacer" />
        <span className="btn btn--soft btn--sm">Xem</span>
      </Link>

      <Link href="/quests" className="card row" style={{ gap: 10 }}>
        <IconCheck size={20} color="var(--primary)" />
        <strong>Nhiệm vụ hôm nay</strong>
        <span className="small muted" style={{ fontWeight: 700 }}>
          15 nhiệm vụ · nhận xu, gem, XP
        </span>
        <span className="spacer" />
        <span className="btn btn--soft btn--sm">Xem</span>
      </Link>

      <Link href="/updates" className="card row" style={{ gap: 10 }}>
        <IconCalendar />
        <strong>Bản cập nhật</strong>
        <span className="small muted" style={{ fontWeight: 700 }}>
          {formatUpdateDate(LATEST_UPDATE)}
        </span>
        {hasNewUpdate && (
          <span className="badge" style={{ background: "var(--strawberry-strong)", color: "#fff" }}>
            Mới
          </span>
        )}
        <span className="spacer" />
        <span className="btn btn--soft btn--sm">Xem</span>
      </Link>

      <Link href="/reviews" className="card row" style={{ gap: 10 }}>
        <Stars value={Math.round(reviewSummary.avg)} size={16} />
        <strong>{reviewSummary.total ? reviewSummary.avg.toFixed(1).replace(".", ",") : "–"}</strong>
        <span className="small muted" style={{ fontWeight: 700 }}>
          {formatNumber(reviewSummary.total)} đánh giá của khách
        </span>
        <span className="spacer" />
        <span className="btn btn--soft btn--sm">Xem</span>
      </Link>

      {showTip && (
        <div className="card row" role="note" style={{ alignItems: "flex-start" }}>
          <img src="/images/mascot-chef.webp" alt="" width={64} height={64} />
          <div style={{ flex: 1 }}>
            <strong>Bếp trưởng Cam</strong>
            <p className="small" style={{ margin: "2px 0 8px" }}>
              Tiệm mở cả ngày lẫn đêm (1 giờ game = 1 phút). Khách tới sẽ gọi món — nhận đơn, bỏ
              đúng nguyên liệu, nấu, thêm sốt &amp; topping khách thích, đóng gói rồi giao trước khi
              khách hết kiên nhẫn (mỗi khách chờ tối đa 4 phút)! Bận thì bấm “Đóng cửa”;
              tắt app thì tiệm tự đóng, không bị trừ uy tín.
            </p>
            <button type="button" className="btn btn--soft btn--sm" onClick={dismissTip}>
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      <section className="stack" aria-label="Khách đang chờ">
        {queue.map((v) => (
          <QueueCard key={v.id} visit={v} serverNow={serverNow} busy={!!cooking} />
        ))}
        {shopOpen && queue.length === 0 && loaded && !cooking && (
          <p className="empty" style={{ padding: 12 }}>
            Chưa có khách chờ — khách tới liên tục khi tiệm mở cửa.
          </p>
        )}
      </section>

      <Link href="/kitchen" className="btn btn--primary btn--block btn--lg">
        Vào bếp · công thức &amp; nguyên liệu
      </Link>

      {showInspection && inspection && (
        <InspectionModal inspection={inspection} serverNow={serverNow} onClose={closeInspection} />
      )}
    </>
  );
}

function QueueCard({ visit, serverNow, busy }: { visit: Visit; serverNow: number; busy: boolean }) {
  const arrive = new Date(visit.arrive_at).getTime();
  const leave = new Date(visit.leave_at).getTime();
  const left = Math.max(0, Math.ceil((leave - serverNow) / 1000));
  const ratio = Math.max(0, Math.min(1, (leave - serverNow) / (leave - arrive)));
  const c = visit.customer;

  return (
    <article className="card stack" style={{ gap: 8 }}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <CustomerAvatar
          look={c.look}
          gender={c.gender}
          image={c.image}
          size={48}
          mood={ratio < 0.3 ? "angry" : "normal"}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <strong>{c.name}</strong>
            <span className="badge">{c.personality}</span>
          </div>
          <TraitChips
            impatient={c.impatient}
            dineAndDash={c.dine_and_dash}
            picky={c.picky}
            minQuality={c.min_quality}
            sensitive={c.sensitive}
          />
          <p className="small" style={{ margin: "4px 0 0", fontWeight: 800 }}>
            Gọi: {orderText(visit)}
          </p>
        </div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <span
          className={styles.patience}
          role="progressbar"
          aria-label="Kiên nhẫn của khách"
          aria-valuenow={left}
          aria-valuemin={0}
        >
          <span
            style={{
              width: `${ratio * 100}%`,
              background:
                ratio < 0.3 ? "var(--danger)" : ratio < 0.6 ? "var(--coin)" : "var(--mint)",
            }}
          />
        </span>
        <span className="small muted" style={{ fontWeight: 800, minWidth: 34, textAlign: "right" }}>
          {left}s
        </span>
        <Link
          href={`/order/${visit.id}`}
          className="btn btn--primary btn--sm"
          aria-disabled={busy}
          onClick={(e) => busy && e.preventDefault()}
          style={busy ? { opacity: 0.55 } : undefined}
        >
          Nhận đơn
        </Link>
      </div>
    </article>
  );
}
