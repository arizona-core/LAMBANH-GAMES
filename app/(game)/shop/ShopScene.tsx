/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CoinIcon, IconCalendar, IconPlus } from "@/components/icons";
import { ItemImage } from "@/components/ItemImage";
import { Modal } from "@/components/Modal";
import { Stars } from "@/components/Stars";
import { useAction } from "@/components/useAction";
import { formatNumber } from "@/lib/game/format";
import { npcUnitPrice } from "@/lib/game/scoring";
import styles from "./shop.module.css";

export type DisplayGood = {
  recipeCode: string;
  quality: number;
  qty: number;
  name: string;
  image: string | null;
  basePrice: number;
};

const CUSTOMER_COLORS = [
  ["#F6C99B", "#8FB6E0"],
  ["#E7C6A6", "#E0A9B4"],
  ["#F6C99B", "#A8CDA0"],
];

const TUTORIAL_KEY = "sweetshop.tutorial.v1";

export function ShopScene({
  goods,
  displayBonus,
  revenueToday,
  canClaimDaily,
  welcome,
}: {
  goods: DisplayGood[];
  displayBonus: number;
  revenueToday: number;
  canClaimDaily: boolean;
  welcome: boolean;
}) {
  const [selected, setSelected] = useState<DisplayGood | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    try {
      // Đọc localStorage chỉ có ở browser → phải set sau khi mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowTip(welcome || !localStorage.getItem(TUTORIAL_KEY));
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

  const totalGoods = goods.reduce((n, g) => n + g.qty, 0);
  const customers = Math.min(3, totalGoods);
  const slots = [0, 1, 2].map((i) => goods[i] ?? null);

  return (
    <>
      {canClaimDaily && (
        <Link href="/daily" className={`card row ${styles.daily}`}>
          <IconCalendar />
          <span style={{ fontWeight: 800 }}>Điểm danh hôm nay nhận xu &amp; gem</span>
          <span className="spacer" />
          <span className="btn btn--gem btn--sm">Nhận</span>
        </Link>
      )}

      <section className={styles.scene} aria-label="Cửa tiệm">
        <div className={styles.waiting}>
          {customers > 0 ? `${customers} khách đang chờ` : "Chưa có khách — hãy làm bánh!"}
        </div>
        <div className={styles.revenue}>
          <div className="small muted" style={{ fontSize: 11, fontWeight: 700 }}>
            Doanh thu hôm nay
          </div>
          <div style={{ fontWeight: 800, color: "var(--mint-strong)" }}>+ {formatNumber(revenueToday)} ₵</div>
        </div>

        <div className={styles.customers} aria-hidden="true">
          {CUSTOMER_COLORS.slice(0, customers).map(([skin, shirt], i) => (
            <svg key={i} width="40" height="52" viewBox="0 0 40 52" className={styles.customer} style={{ animationDelay: `${i * 0.3}s` }}>
              <circle cx="20" cy="14" r="10" fill={skin} />
              <path d="M6 52c0-10 6-18 14-18s14 8 14 18z" fill={shirt} />
            </svg>
          ))}
        </div>

        <div className={styles.counter}>
          {slots.map((g, i) =>
            g ? (
              <button
                key={`${g.recipeCode}-${g.quality}`}
                type="button"
                className={styles.slot}
                onClick={() => setSelected(g)}
                aria-label={`${g.name} ${g.quality} sao, còn ${g.qty}. Bán cho khách`}
              >
                <ItemImage code={g.recipeCode} image={g.image} name={g.name} size={44} />
                <span className={styles.slotQty}>×{g.qty}</span>
                <Stars value={g.quality} size={10} />
              </button>
            ) : (
              <Link key={`empty-${i}`} href="/kitchen" className={`${styles.slot} ${styles.slotEmpty}`}>
                <IconPlus size={20} />
                <span>Trống</span>
              </Link>
            ),
          )}
        </div>
      </section>

      {goods.length > 3 && (
        <button type="button" className="btn btn--white btn--sm" onClick={() => setShowAll(true)}>
          Xem cả tủ bánh ({goods.length} loại)
        </button>
      )}

      {showTip && (
        <div className={`card row ${styles.tip}`} role="note">
          <img src="/images/mascot-chef.webp" alt="" width={64} height={64} />
          <div style={{ flex: 1 }}>
            <strong>Bếp trưởng Cam</strong>
            <p className="small" style={{ margin: "2px 0 8px" }}>
              Vào bếp làm chiếc bánh đầu tiên, rồi chạm vào bánh trong tủ kính để bán cho khách nhé!
            </p>
            <button type="button" className="btn btn--soft btn--sm" onClick={dismissTip}>
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      <Link href="/kitchen" className="btn btn--primary btn--block btn--lg">
        Vào bếp làm bánh
      </Link>

      {showAll && (
        <Modal title="Tủ bánh" onClose={() => setShowAll(false)}>
          <div className="stack">
            {goods.map((g) => (
              <button
                key={`${g.recipeCode}-${g.quality}`}
                type="button"
                className="card row"
                style={{ border: 0, cursor: "pointer", textAlign: "left" }}
                onClick={() => {
                  setShowAll(false);
                  setSelected(g);
                }}
              >
                <ItemImage code={g.recipeCode} image={g.image} name={g.name} size={48} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{g.name}</div>
                  <Stars value={g.quality} size={12} />
                </div>
                <span style={{ fontWeight: 800 }}>×{g.qty}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {selected && <SellModal good={selected} displayBonus={displayBonus} onClose={() => setSelected(null)} />}
    </>
  );
}

function SellModal({ good, displayBonus, onClose }: { good: DisplayGood; displayBonus: number; onClose: () => void }) {
  const { run, busy } = useAction("sell-npc");
  const [qty, setQty] = useState(1);
  const unit = npcUnitPrice(good.basePrice, good.quality, displayBonus);

  async function sell() {
    const res = await run(
      { recipe: good.recipeCode, quality: good.quality, qty },
      { success: (d) => `Khách đã mua! +${formatNumber(d.earned)} ₵` },
    );
    if (res) onClose();
  }

  return (
    <Modal title="Bán cho khách" onClose={onClose}>
      <div className="row">
        <ItemImage code={good.recipeCode} image={good.image} name={good.name} size={64} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{good.name}</div>
          <Stars value={good.quality} />
          <div className="small muted">Trong tủ: {good.qty}</div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: "center", gap: 14 }}>
        <button type="button" className="icon-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Bớt 1">
          −
        </button>
        <span style={{ fontWeight: 800, fontSize: 22, minWidth: 40, textAlign: "center" }} aria-live="polite">
          {qty}
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setQty((q) => Math.min(good.qty, 50, q + 1))}
          aria-label="Thêm 1"
        >
          +
        </button>
        <button type="button" className="btn btn--soft btn--sm" onClick={() => setQty(Math.min(good.qty, 50))}>
          Tất cả
        </button>
      </div>

      <p className="row small" style={{ justifyContent: "center", margin: 0, fontWeight: 700 }}>
        Giá khách trả khoảng <CoinIcon /> {formatNumber(unit * qty)}
        {displayBonus > 0 && <span className="muted">(tủ trưng bày +{displayBonus}%)</span>}
      </p>

      <button type="button" className="btn btn--primary btn--block btn--lg" onClick={sell} disabled={busy}>
        {busy ? "Đang bán…" : `Bán ${qty} chiếc`}
      </button>
    </Modal>
  );
}
