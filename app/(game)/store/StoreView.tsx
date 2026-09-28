"use client";

import Link from "next/link";
import { useState } from "react";
import { CoinIcon, GemIcon, IconCalendar, IconCheck, IconLock } from "@/components/icons";
import { useAction } from "@/components/useAction";
import { formatNumber } from "@/lib/game/format";
import type { UpgradeCatalogItem } from "@/lib/types";

type Tab = "upgrade" | "decor" | "gem";

export function StoreView({
  catalog,
  owned,
  level,
  coins,
  gems,
  activeTheme,
}: {
  catalog: UpgradeCatalogItem[];
  owned: string[];
  level: number;
  coins: number;
  gems: number;
  activeTheme: string;
}) {
  const [tab, setTab] = useState<Tab>("upgrade");
  const ownedSet = new Set(owned);
  const items = catalog.filter((c) => (tab === "decor" ? c.kind === "decor" : c.kind !== "decor"));

  return (
    <>
      <div className="tabs" role="tablist">
        {(
          [
            ["upgrade", "Nâng cấp"],
            ["decor", "Trang trí"],
            ["gem", "Gem"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" className="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "gem" ? (
        <GemInfo />
      ) : (
        <div role="tabpanel" className="stack">
          {(tab === "decor" ? DECOR_GROUPS : [["", "Nâng cấp tiệm"] as const]).map(([type, title]) => {
            const group = tab === "decor" ? items.filter((i) => (i.decor_type ?? "floor") === type) : items;
            if (group.length === 0) return null;
            return (
              <section key={title} className="stack">
                {tab === "decor" && (
                  <h2 style={{ fontSize: 17 }}>
                    {title}
                    {type === "seating" && (
                      <span className="small muted" style={{ fontFamily: "var(--font-body)", fontWeight: 700, marginLeft: 6 }}>
                        mỗi chỗ ngồi thêm khách ghé đông hơn
                      </span>
                    )}
                  </h2>
                )}
                {type === "theme" && (
                  <ThemeDefault active={activeTheme === "default"} />
                )}
                {group.map((item) => (
                  <UpgradeCard
                    key={item.code}
                    item={item}
                    owned={ownedSet.has(item.code)}
                    prevOwned={!item.requires_code || ownedSet.has(item.requires_code)}
                    level={level}
                    coins={coins}
                    gems={gems}
                    activeTheme={activeTheme}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

const KIND_LABEL: Record<string, string> = { oven: "Lò nướng", display: "Tủ trưng bày", decor: "Trang trí" };

const DECOR_GROUPS = [
  ["seating", "Bàn ghế"],
  ["wall", "Treo tường"],
  ["floor", "Đặt sàn"],
  ["ceiling", "Treo trần"],
  ["theme", "Kiểu tiệm (theme)"],
] as const;

function UseThemeButton({ theme, active }: { theme: string; active: boolean }) {
  const { run, busy } = useAction("set-theme");
  if (active) {
    return (
      <span className="row small" style={{ gap: 4, color: "var(--mint-strong)", fontWeight: 800 }}>
        <IconCheck size={16} /> Đang dùng
      </span>
    );
  }
  return (
    <button type="button" className="btn btn--soft btn--sm" disabled={busy} onClick={() => run({ theme }, { success: () => "Đã đổi kiểu tiệm!" })}>
      Dùng
    </button>
  );
}

function ThemeDefault({ active }: { active: boolean }) {
  return (
    <article className="card row">
      <div className="thumb" style={{ width: 52, height: 52 }} aria-hidden="true">
        <CoinIcon />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800 }}>Theme mặc định</div>
        <div className="small muted" style={{ fontWeight: 700 }}>Tông kem – caramel</div>
      </div>
      <UseThemeButton theme="default" active={active} />
    </article>
  );
}

function UpgradeCard({
  item,
  owned,
  prevOwned,
  level,
  coins,
  gems,
  activeTheme,
}: {
  item: UpgradeCatalogItem;
  owned: boolean;
  prevOwned: boolean;
  level: number;
  coins: number;
  gems: number;
  activeTheme: string;
}) {
  const { run, busy } = useAction("buy-upgrade");
  const lockedByLevel = level < item.unlock_level;
  const affordable = coins >= item.cost_coins && gems >= item.cost_gems;
  const usesGems = item.cost_gems > 0;

  let action: React.ReactNode;
  if (owned && item.decor_type === "theme") {
    action = <UseThemeButton theme={item.code} active={activeTheme === item.code} />;
  } else if (owned) {
    action = (
      <span className="row small" style={{ gap: 4, color: "var(--mint-strong)", fontWeight: 800 }}>
        <IconCheck size={16} /> Đã có
      </span>
    );
  } else if (lockedByLevel || !prevOwned) {
    action = (
      <span className="row small muted" style={{ gap: 4, fontWeight: 800 }}>
        <IconLock size={16} /> {lockedByLevel ? `Cấp ${item.unlock_level}` : "Cần cấp trước"}
      </span>
    );
  } else {
    action = (
      <button
        type="button"
        className={`btn btn--sm ${usesGems ? "btn--gem" : "btn--primary"}`}
        disabled={busy || !affordable}
        onClick={() => run({ code: item.code }, { success: () => `Đã mua ${item.name}!` })}
      >
        {usesGems ? `${formatNumber(item.cost_gems)} gem` : `${formatNumber(item.cost_coins)} ₵`}
      </button>
    );
  }

  return (
    <article className="card row" style={{ opacity: owned ? 0.85 : 1 }}>
      <div
        className="thumb"
        style={{ width: 52, height: 52, background: usesGems ? "var(--gem-bg)" : "var(--placeholder-bg)" }}
        aria-hidden="true"
      >
        {usesGems ? <GemIcon size={26} /> : <CoinIcon />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="small muted" style={{ fontWeight: 700 }}>
          {KIND_LABEL[item.kind]}
          {item.kind !== "decor" && ` · Bậc ${item.tier}`}
        </div>
        <div style={{ fontWeight: 800 }}>{item.name}</div>
        <div className="small" style={{ fontWeight: 700, color: "var(--mint-strong)" }}>
          {item.description}
        </div>
      </div>
      {action}
    </article>
  );
}

function GemInfo() {
  return (
    <div role="tabpanel" className="stack">
      <div className="card stack" style={{ background: "var(--gem-bg)", boxShadow: "none", border: "2px solid #c9b6ee" }}>
        <div className="row">
          <GemIcon size={28} />
          <strong style={{ color: "var(--gem-border)", fontSize: 17 }}>Gem chỉ kiếm được trong game</strong>
        </div>
        <p className="small" style={{ margin: 0, fontWeight: 700, lineHeight: 1.5 }}>
          Sweet Shop không bán gem bằng tiền thật. Nhận gem miễn phí từ:
        </p>
        <ul className="small" style={{ margin: 0, paddingLeft: 18, fontWeight: 700, lineHeight: 1.7 }}>
          <li>Điểm danh mỗi ngày (+2 gem, ngày thứ 7 liên tiếp +10 gem)</li>
          <li>Quà mở tiệm (+10 gem)</li>
          <li>Sự kiện &amp; giải đấu theo mùa (sắp có)</li>
        </ul>
      </div>
      <Link href="/daily" className="btn btn--gem btn--block btn--lg">
        <IconCalendar /> Đi điểm danh
      </Link>
    </div>
  );
}
