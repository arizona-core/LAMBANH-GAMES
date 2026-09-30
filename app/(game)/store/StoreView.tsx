"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GemIcon, IconCalendar, IconCheck, IconLock } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { StoreArt } from "@/components/StoreArt";
import { useAction } from "@/components/useAction";
import { callAction } from "@/lib/api/actions";
import { gameClock } from "@/lib/game/clock";
import { formatNumber } from "@/lib/game/format";
import type { UpgradeCatalogItem } from "@/lib/types";
import { ShopIso } from "../shop/ShopIso";

type Tab = "upgrade" | "decor" | "gem";
type Preview = { title: string; theme: string; decor: string[]; hour: number };

export function StoreView({
  catalog,
  owned,
  level,
  coins,
  gems,
  activeTheme,
  chefImage,
}: {
  catalog: UpgradeCatalogItem[];
  owned: string[];
  level: number;
  coins: number;
  gems: number;
  activeTheme: string;
  chefImage: string | null;
}) {
  const [tab, setTab] = useState<Tab>("upgrade");
  const [preview, setPreview] = useState<Preview | null>(null);
  const ownedSet = new Set(owned);
  const items = catalog.filter((c) => (tab === "decor" ? c.kind === "decor" : c.kind !== "decor"));

  const openPreview = (item: UpgradeCatalogItem | null) => {
    const hour = gameClock(Date.now()).hour;
    if (!item) return setPreview({ title: "Theme mặc định", theme: "default", decor: owned, hour });
    const isTheme = item.decor_type === "theme";
    // Lò/tủ: xem đúng bậc đang chọn (bỏ các bậc khác cùng loại khỏi cảnh).
    const base = item.kind === "decor" ? owned : owned.filter((c) => !c.startsWith(`${item.kind}_`));
    setPreview({
      title: item.name,
      theme: isTheme ? item.code : activeTheme,
      decor: base.includes(item.code) ? base : [...base, item.code],
      hour,
    });
  };

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
          {tab === "upgrade" && <CurrentBonuses catalog={catalog} owned={ownedSet} />}
          {(tab === "decor" ? DECOR_GROUPS : UPGRADE_GROUPS).map(([type, title, hint]) => {
            const group = items.filter((i) => (tab === "decor" ? (i.decor_type ?? "floor") === type : i.kind === type));
            if (group.length === 0) return null;
            return (
              <section key={title} className="stack">
                <h2 style={{ fontSize: 17 }}>
                  {title}
                  {hint && (
                    <span className="small muted" style={{ fontFamily: "var(--font-body)", fontWeight: 700, marginLeft: 6 }}>
                      {hint}
                    </span>
                  )}
                </h2>
                {type === "theme" && <ThemeDefault active={activeTheme === "default"} onPreview={() => openPreview(null)} />}
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
                    onPreview={() => openPreview(item)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}

      {preview && (
        <Modal title={`Xem trước: ${preview.title}`} onClose={() => setPreview(null)}>
          <div style={{ borderRadius: 18, overflow: "hidden", background: "linear-gradient(#f6e7cc, #ead9be)" }}>
            <ShopIso
              config={{ theme: preview.theme, decor: preview.decor, chefImage, hour: preview.hour }}
              customers={[]}
            />
          </div>
          <p className="small muted" style={{ margin: "8px 0", fontWeight: 700 }}>
            Tiệm của bạn khi có món này (cùng đồ đã mua).
          </p>
          <button type="button" className="btn btn--soft btn--block" onClick={() => setPreview(null)}>
            Đóng
          </button>
        </Modal>
      )}
    </>
  );
}

const KIND_LABEL: Record<string, string> = { oven: "Lò nướng", display: "Tủ trưng bày", decor: "Trang trí" };

const UPGRADE_GROUPS = [
  ["oven", "Lò nướng", "đổi lò trong tiệm · bánh lên sao dễ hơn"],
  ["display", "Tủ trưng bày", "tủ bánh trên quầy · khách trả giá cao hơn"],
] as const;

const DECOR_GROUPS = [
  ["seating", "Bàn ghế", "mỗi chỗ ngồi thêm khách ghé đông hơn"],
  ["wall", "Treo tường", ""],
  ["floor", "Đặt sàn", ""],
  ["ceiling", "Treo trần", ""],
  ["theme", "Kiểu tiệm (theme)", "đổi cả tường, sàn, quầy + đồ trang trí riêng"],
] as const;

/** Hiệu ứng nâng cấp đang có (chỉ hiển thị; server tự tính khi chấm đơn/tính tiền). */
function CurrentBonuses({ catalog, owned }: { catalog: UpgradeCatalogItem[]; owned: Set<string> }) {
  const best = (kind: string) =>
    catalog.filter((c) => c.kind === kind && owned.has(c.code)).reduce((m, c) => Math.max(m, c.effect), 0);
  const oven = best("oven");
  const display = best("display");
  return (
    <div className="card row" style={{ gap: 16, flexWrap: "wrap", background: "#e3f0dc", boxShadow: "none", border: "2px solid #b9d7ae" }}>
      <span className="small" style={{ fontWeight: 800 }}>
        Lò hiện tại: <span style={{ color: "var(--mint-strong)" }}>+{oven} điểm chất lượng</span>
      </span>
      <span className="small" style={{ fontWeight: 800 }}>
        Tủ hiện tại: <span style={{ color: "var(--mint-strong)" }}>+{display}% giá bán</span>
      </span>
    </div>
  );
}

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

function PreviewButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn--white btn--sm" onClick={onClick}>
      Xem trước
    </button>
  );
}

function ThemeDefault({ active, onPreview }: { active: boolean; onPreview: () => void }) {
  return (
    <article className="card row">
      <StoreArt code="default" name="Theme mặc định" size={56} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800 }}>Theme mặc định</div>
        <div className="small muted" style={{ fontWeight: 700 }}>
          Tông kem – caramel
        </div>
      </div>
      <div className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
        <UseThemeButton theme="default" active={active} />
        <PreviewButton onClick={onPreview} />
      </div>
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
  onPreview,
}: {
  item: UpgradeCatalogItem;
  owned: boolean;
  prevOwned: boolean;
  level: number;
  coins: number;
  gems: number;
  activeTheme: string;
  onPreview: () => void;
}) {
  const router = useRouter();
  const { run, busy } = useAction("buy-upgrade");
  const lockedByLevel = level < item.unlock_level;
  const affordable = coins >= item.cost_coins && gems >= item.cost_gems;
  const usesGems = item.cost_gems > 0;
  const isTheme = item.decor_type === "theme";

  async function buy() {
    const res = await run(
      { code: item.code },
      {
        success: () => (isTheme ? `Đã mua ${item.name} và trang trí lại tiệm!` : `Đã mua ${item.name}! Ra Tiệm xem nhé.`),
        refresh: !isTheme,
      },
    );
    // Mua theme xong áp dụng luôn cho tiệm.
    if (res && isTheme) {
      await callAction("set-theme", { theme: item.code });
      router.refresh();
    }
  }

  let action: React.ReactNode;
  if (owned && isTheme) {
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
        <IconLock size={16} /> {lockedByLevel ? `Cấp ${item.unlock_level}` : "Cần bậc trước"}
      </span>
    );
  } else {
    action = (
      <button type="button" className={`btn btn--sm ${usesGems ? "btn--gem" : "btn--primary"}`} disabled={busy || !affordable} onClick={buy}>
        {usesGems ? (
          <>
            <GemIcon size={14} /> {formatNumber(item.cost_gems)}
          </>
        ) : (
          `${formatNumber(item.cost_coins)} ₵`
        )}
      </button>
    );
  }

  return (
    <article className="card row" style={{ opacity: owned && !isTheme ? 0.85 : 1, alignItems: "center" }}>
      <StoreArt code={item.code} name={item.name} size={60} />
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
      <div className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
        {action}
        <PreviewButton onClick={onPreview} />
      </div>
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
          <li>Nhiệm vụ hằng ngày (tới 5 gem mỗi nhiệm vụ)</li>
          <li>Quà mở tiệm (+10 gem)</li>
        </ul>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <Link href="/daily" className="btn btn--gem btn--lg" style={{ flex: 1 }}>
          <IconCalendar /> Điểm danh
        </Link>
        <Link href="/quests" className="btn btn--soft btn--lg" style={{ flex: 1 }}>
          Nhiệm vụ
        </Link>
      </div>
    </div>
  );
}
