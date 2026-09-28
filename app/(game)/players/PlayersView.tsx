"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { isOnline, lastSeenText } from "@/lib/game/avatar";
import { SHOP_COLORS, type ShopColor } from "@/lib/game/constants";
import styles from "./players.module.css";

export type PlayerItem = {
  id: string;
  ownerName: string;
  shopName: string;
  slug: string;
  avatar: string;
  avatarUrl: string | null;
  color: string;
  level: number;
  reputation: number;
  lastSeen: string | null;
};

type Filter = "all" | "online";

export function PlayersView({ players, meId }: { players: PlayerItem[]; meId: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  // Cập nhật mỗi 30 giây để trạng thái online / "x phút trước" không bị cũ.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const withStatus = players.map((p) => ({ ...p, online: p.id === meId || isOnline(p.lastSeen, now) }));
  const onlineCount = withStatus.filter((p) => p.online).length;
  const term = q.trim().toLowerCase();
  const shown = withStatus
    .filter((p) => (filter === "online" ? p.online : true))
    .filter((p) => !term || p.shopName.toLowerCase().includes(term) || p.ownerName.toLowerCase().includes(term))
    .sort((a, b) => Number(b.online) - Number(a.online));

  return (
    <>
      <p className="row small" style={{ margin: 0, fontWeight: 800, gap: 6 }}>
        <span className={styles.dotOn} aria-hidden="true" /> {onlineCount} đang online · {players.length} tiệm
      </p>
      <label className="sr-only" htmlFor="player-search">
        Tìm người chơi
      </label>
      <input
        id="player-search"
        className="input"
        placeholder="Tìm tên quán hoặc chủ quán…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="tabs" role="tablist">
        <button type="button" role="tab" className="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>
          Tất cả
        </button>
        <button type="button" role="tab" className="tab" aria-selected={filter === "online"} onClick={() => setFilter("online")}>
          Đang online ({onlineCount})
        </button>
      </div>

      <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }} role="tabpanel">
        {shown.length === 0 && <li className="empty">Không tìm thấy người chơi.</li>}
        {shown.map((p) => (
          <li key={p.id}>
            <Link href={`/players/${p.slug}`} className="card row" style={{ gap: 10 }}>
              <span className={styles.avatarWrap}>
                <Avatar avatar={p.avatar} photo={p.avatarUrl} size={44} ring={SHOP_COLORS[p.color as ShopColor]?.hex} />
                <span className={p.online ? styles.dotOn : styles.dotOff} aria-hidden="true" />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className={styles.name}>
                  {p.shopName}
                  {p.id === meId && (
                    <span className="badge" style={{ marginLeft: 6 }}>
                      BẠN
                    </span>
                  )}
                </span>
                <span className="small muted" style={{ fontWeight: 700 }}>
                  {p.ownerName} · Lv.{p.level} · {p.reputation} ★
                </span>
              </span>
              <span className={`small ${p.online ? styles.statusOn : styles.statusOff}`}>
                {p.online ? "Online" : lastSeenText(p.lastSeen, now)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
