"use client";

import { useState } from "react";
import { CoinIcon, IconLock } from "@/components/icons";
import { ItemImage } from "@/components/ItemImage";
import { Stars } from "@/components/Stars";
import { useAction } from "@/components/useAction";
import {
  MARKET_FEE_PERCENT,
  MARKET_MIN_ACCOUNT_HOURS,
  MARKET_PRICE_MAX_PCT,
  MARKET_PRICE_MIN_PCT,
  MARKET_UNLOCK_LEVEL,
} from "@/lib/game/constants";
import { formatNumber } from "@/lib/game/format";
import { marketFee } from "@/lib/game/scoring";
import type { MarketFeedRow, MarketListing } from "@/lib/types";

export type SellOption = {
  key: string;
  kind: "ingredient" | "baked";
  item: string;
  quality: number | null;
  name: string;
  image: string | null;
  have: number;
  refPrice: number;
};

type Tab = "buy" | "sell" | "mine";

export function MarketView({
  level,
  accountCreatedAt,
  coins,
  feed,
  mine,
  sellOptions,
  itemNames,
}: {
  level: number;
  accountCreatedAt: string;
  coins: number;
  feed: MarketFeedRow[];
  mine: MarketListing[];
  sellOptions: SellOption[];
  itemNames: Record<string, { name: string; image: string | null }>;
}) {
  const [tab, setTab] = useState<Tab>("buy");
  const [now] = useState(() => Date.now());
  const tooNew = now - new Date(accountCreatedAt).getTime() < MARKET_MIN_ACCOUNT_HOURS * 3600 * 1000;
  const locked = level < MARKET_UNLOCK_LEVEL || tooNew;

  return (
    <>
      <div className="tabs" role="tablist">
        {(
          [
            ["buy", "Mua"],
            ["sell", "Bán"],
            ["mine", "Tin của tôi"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" className="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <p className="small muted" style={{ margin: 0, fontWeight: 700, textAlign: "center" }}>
        Giá do người chơi đặt · phí chợ {MARKET_FEE_PERCENT}% (người bán trả)
      </p>

      {locked && (
        <div className="card row" role="note">
          <IconLock />
          <span style={{ fontWeight: 700 }}>
            Chợ mở khóa từ cấp {MARKET_UNLOCK_LEVEL} và sau {MARKET_MIN_ACCOUNT_HOURS} giờ mở tiệm. Làm thêm vài mẻ bánh nhé!
          </span>
        </div>
      )}

      <div role="tabpanel" className="stack">
        {tab === "buy" && <BuyList feed={feed} coins={coins} locked={locked} />}
        {tab === "sell" && <SellForm options={sellOptions} locked={locked} onDone={() => setTab("mine")} />}
        {tab === "mine" && <MyListings mine={mine} itemNames={itemNames} />}
      </div>
    </>
  );
}

function BuyList({ feed, coins, locked }: { feed: MarketFeedRow[]; coins: number; locked: boolean }) {
  const { run, busy } = useAction("buy-listing");
  if (feed.length === 0) return <p className="empty">Chợ đang vắng. Hãy là người rao bán đầu tiên!</p>;

  return feed.map((l) => (
    <article key={l.id} className="card row">
      <ItemImage code={l.item_code ?? ""} image={l.item_image} name={l.item_name ?? ""} size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800 }}>
          {l.item_name} ×{l.qty}
        </div>
        {l.quality && <Stars value={l.quality} size={12} />}
        <div className="small muted" style={{ fontWeight: 700 }}>
          bởi {l.seller_shop}
        </div>
      </div>
      <div className="stack" style={{ alignItems: "flex-end", gap: 6 }}>
        <span className="row" style={{ gap: 4, fontWeight: 800 }}>
          <CoinIcon /> {formatNumber(l.price ?? 0)}
        </span>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={busy || locked || coins < (l.price ?? 0)}
          onClick={() =>
            run({ listingId: l.id! }, { success: (d) => `Đã mua ${l.item_name} ×${l.qty} (−${formatNumber(d.paid)} ₵)` })
          }
        >
          Mua
        </button>
      </div>
    </article>
  ));
}

function SellForm({ options, locked, onDone }: { options: SellOption[]; locked: boolean; onDone: () => void }) {
  const { run, busy } = useAction("create-listing");
  const [key, setKey] = useState(options[0]?.key ?? "");
  const opt = options.find((o) => o.key === key);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState<number | "">("");

  if (options.length === 0) return <p className="empty">Kho trống. Mua nguyên liệu hoặc làm bánh trước đã.</p>;
  if (!opt) return null;

  const safeQty = Math.min(Math.max(1, qty), opt.have);
  const suggested = opt.refPrice * safeQty;
  const min = Math.ceil((opt.refPrice * safeQty * MARKET_PRICE_MIN_PCT) / 100);
  const max = Math.floor((opt.refPrice * safeQty * MARKET_PRICE_MAX_PCT) / 100);
  const p = price === "" ? suggested : price;
  const fee = marketFee(p);
  const valid = p >= min && p <= max;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!opt) return;
    const input =
      opt.kind === "ingredient"
        ? { kind: "ingredient" as const, item: opt.item, qty: safeQty, price: p }
        : { kind: "baked" as const, item: opt.item, quality: opt.quality!, qty: safeQty, price: p };
    const res = await run(input, { success: () => "Đã đăng tin rao bán!" });
    if (res) {
      setPrice("");
      setQty(1);
      onDone();
    }
  }

  return (
    <form className="card stack" onSubmit={submit} style={{ gap: 14 }}>
      <div className="field">
        <label htmlFor="sell-item">Mặt hàng</label>
        <select
          id="sell-item"
          className="input"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setQty(1);
            setPrice("");
          }}
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.name}
              {o.quality ? ` ${"★".repeat(o.quality)}` : ""} (có {o.have})
            </option>
          ))}
        </select>
      </div>

      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="sell-qty">Số lượng</label>
          <input
            id="sell-qty"
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={opt.have}
            value={qty}
            onChange={(e) => {
              setQty(Number(e.target.value) || 1);
              setPrice("");
            }}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="sell-price">Giá cả lô (₵)</label>
          <input
            id="sell-price"
            className="input"
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={p}
            onChange={(e) => setPrice(e.target.value === "" ? "" : Math.floor(Number(e.target.value)))}
            aria-describedby="sell-price-hint"
          />
        </div>
      </div>

      <p id="sell-price-hint" className={`hint ${valid ? "" : "hint--bad"}`} style={{ margin: 0 }}>
        Giá gợi ý {formatNumber(suggested)} ₵ · cho phép {formatNumber(min)}–{formatNumber(max)} ₵
      </p>
      <p className="row small" style={{ margin: 0, fontWeight: 700 }}>
        Phí chợ {formatNumber(fee)} ₵ · Bạn nhận <CoinIcon /> {formatNumber(Math.max(0, p - fee))}
      </p>

      <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy || locked || !valid}>
        {busy ? "Đang đăng…" : "Rao bán"}
      </button>
    </form>
  );
}

const STATUS_LABEL: Record<string, string> = { active: "Đang bán", sold: "Đã bán", cancelled: "Đã hủy" };

function MyListings({
  mine,
  itemNames,
}: {
  mine: MarketListing[];
  itemNames: Record<string, { name: string; image: string | null }>;
}) {
  const { run, busy } = useAction("cancel-listing");
  if (mine.length === 0) return <p className="empty">Bạn chưa rao bán gì.</p>;

  return mine.map((l) => {
    const info = itemNames[`${l.kind}:${l.item_code}`] ?? { name: l.item_code, image: null };
    return (
      <article key={l.id} className="card row" style={{ opacity: l.status === "active" ? 1 : 0.75 }}>
        <ItemImage code={l.item_code} image={info.image} name={info.name} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800 }}>
            {info.name} ×{l.qty}
          </div>
          {l.quality && <Stars value={l.quality} size={12} />}
          <div className="small muted" style={{ fontWeight: 700 }}>
            {STATUS_LABEL[l.status]} · {formatNumber(l.price)} ₵
            {l.status === "sold" && l.fee !== null && ` (nhận ${formatNumber(l.price - l.fee)} ₵)`}
          </div>
        </div>
        {l.status === "active" && (
          <button
            type="button"
            className="btn btn--danger btn--sm"
            disabled={busy}
            onClick={() => run({ listingId: l.id }, { success: () => "Đã hủy tin, hàng về kho." })}
          >
            Hủy
          </button>
        )}
      </article>
    );
  });
}
