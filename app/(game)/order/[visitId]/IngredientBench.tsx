"use client";

import { useRef, useState } from "react";
import { ItemImage } from "@/components/ItemImage";
import { batterColor, hexColor } from "@/lib/game/cooking";
import { INGREDIENT_CATEGORIES, type IngredientCategory } from "@/lib/game/orders";
import styles from "./order.module.css";

export type BenchItem = {
  code: string;
  name: string;
  image: string | null;
  category: IngredientCategory | null;
  have: number;
};

type Drag = { code: string; id: number; x0: number; y0: number; el: HTMLElement; ghost: HTMLElement | null };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Bản sao ảnh nguyên liệu bay theo ngón tay / bay vào tô (gắn vào body, không nhận chạm). */
function cloneThumb(tile: HTMLElement): HTMLElement | null {
  const thumb = tile.querySelector<HTMLElement>(".thumb");
  if (!thumb) return null;
  const rect = thumb.getBoundingClientRect();
  const ghost = thumb.cloneNode(true) as HTMLElement;
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    pointerEvents: "none",
    zIndex: "1000",
    filter: "drop-shadow(0 6px 6px rgba(58, 36, 18, 0.25))",
  });
  document.body.appendChild(ghost);
  return ghost;
}

/**
 * Bước 1: kệ nguyên liệu (cuộn ngang theo nhóm) + tô trộn.
 * Kéo món xuống tô (vuốt ngang để cuộn kệ) hoặc chạm để món bay vào tô; chạm lại / bấm chip để bỏ ra.
 */
export function IngredientBench({
  items,
  bowl,
  needQty,
  onAdd,
  onRemove,
}: {
  items: BenchItem[];
  bowl: string[];
  needQty: (code: string) => number;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
}) {
  const cats = (Object.keys(INGREDIENT_CATEGORIES) as IngredientCategory[]).filter((c) => items.some((i) => i.category === c));
  const [cat, setCat] = useState<IngredientCategory>(cats[0] ?? "flour");
  const [hot, setHot] = useState(false);
  const [plop, setPlop] = useState(0);
  const bowlRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);

  const byCode = new Map(items.map((i) => [i.code, i]));
  const shelf = items.filter((i) => i.category === cat);

  const overBowl = (x: number, y: number) => {
    const r = bowlRef.current?.getBoundingClientRect();
    return !!r && x >= r.left - 16 && x <= r.right + 16 && y >= r.top - 40 && y <= r.bottom + 16;
  };

  const add = (code: string) => {
    if (bowl.includes(code)) return;
    onAdd(code);
    setPlop((n) => n + 1);
  };

  /** Chạm: món bay vòng cung từ kệ vào tô. */
  const flyIn = (tile: HTMLElement, code: string) => {
    add(code);
    const bowlRect = bowlRef.current?.getBoundingClientRect();
    if (!bowlRect || reducedMotion()) return;
    const ghost = cloneThumb(tile);
    if (!ghost) return;
    const from = ghost.getBoundingClientRect();
    const dx = bowlRect.left + bowlRect.width / 2 - (from.left + from.width / 2);
    const dy = bowlRect.top + bowlRect.height * 0.25 - (from.top + from.height / 2);
    const anim = ghost.animate(
      [
        { transform: "translate(0, 0) scale(1)" },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 70}px) scale(0.95) rotate(-12deg)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.45) rotate(8deg)`, opacity: 0.4 },
      ],
      { duration: 460, easing: "ease-in" },
    );
    anim.onfinish = () => ghost.remove();
  };

  const endDrag = () => {
    drag.current?.ghost?.remove();
    drag.current = null;
    setHot(false);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>, code: string) => {
    if (e.button !== 0 || e.currentTarget.disabled) return;
    drag.current = { code, id: e.pointerId, x0: e.clientX, y0: e.clientY, el: e.currentTarget, ghost: null };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.ghost) {
      if (Math.hypot(dx, dy) < 8) return;
      // Vuốt ngang trên điện thoại = cuộn kệ (touch-action: pan-x), không nhấc món.
      if (e.pointerType !== "mouse" && Math.abs(dx) > Math.abs(dy)) {
        drag.current = null;
        return;
      }
      d.el.setPointerCapture(e.pointerId);
      d.ghost = cloneThumb(d.el);
      if (d.ghost) d.ghost.style.transition = "none";
    }
    if (d.ghost) {
      const w = d.ghost.offsetWidth;
      d.ghost.style.left = `${e.clientX - w / 2}px`;
      d.ghost.style.top = `${e.clientY - w / 2}px`;
      d.ghost.style.transform = "scale(1.15)";
    }
    setHot(overBowl(e.clientX, e.clientY));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !d.ghost) {
      drag.current = null;
      return; // chạm thường → onClick lo
    }
    suppressClick.current = true;
    const dropped = overBowl(e.clientX, e.clientY);
    endDrag();
    if (dropped) add(d.code);
  };

  const onClick = (e: React.MouseEvent<HTMLButtonElement>, code: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (bowl.includes(code)) onRemove(code);
    else flyIn(e.currentTarget, code);
  };

  const color = hexColor(batterColor(bowl));

  return (
    <section className={styles.bench}>
      <div className={styles.catTabs} role="tablist" aria-label="Nhóm nguyên liệu">
        {cats.map((c) => {
          const n = bowl.filter((code) => byCode.get(code)?.category === c).length;
          return (
            <button key={c} type="button" role="tab" aria-selected={cat === c} className="tab" style={{ flex: "0 0 auto", padding: "7px 12px", fontSize: 13 }} onClick={() => setCat(c)}>
              {INGREDIENT_CATEGORIES[c]}
              {n > 0 && <span className={styles.catCount}>{n}</span>}
            </button>
          );
        })}
      </div>

      <div className={styles.shelf} role="tabpanel" aria-label={INGREDIENT_CATEGORIES[cat]}>
        {shelf.map((i) => {
          const picked = bowl.includes(i.code);
          const lacking = i.have < needQty(i.code);
          return (
            <button
              key={i.code}
              type="button"
              className={`${styles.pick} ${styles.shelfItem} ${picked ? styles.pickOn : ""}`}
              aria-pressed={picked}
              disabled={!picked && lacking}
              onPointerDown={(e) => onPointerDown(e, i.code)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={endDrag}
              onClick={(e) => onClick(e, i.code)}
            >
              <ItemImage code={i.code} image={i.image} name={i.name} size={44} />
              <span>{i.name}</span>
              <span className={styles.have}>{picked ? "Trong tô" : lacking ? "Hết" : `có ${i.have}`}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.bowlWrap}>
        <div ref={bowlRef} className={`${styles.bowl} ${hot ? styles.bowlHot : ""}`} role="group" aria-label="Tô trộn">
          <div key={plop} className={`${styles.batter} ${plop ? styles.plop : ""}`} style={{ background: bowl.length ? color : undefined }}>
            {bowl.slice(-8).map((code, k) => {
              const it = byCode.get(code);
              return (
                <span key={code} className={styles.floating} style={{ transform: `rotate(${(k % 3) * 9 - 9}deg)` }} aria-hidden="true">
                  <ItemImage code={code} image={it?.image} name={it?.name ?? code} size={26} />
                </span>
              );
            })}
          </div>
          {bowl.length === 0 && <span className={styles.bowlEmpty}>Thả nguyên liệu vào tô</span>}
        </div>
      </div>

      <div className={styles.bowlList} aria-live="polite">
        {bowl.length === 0 ? (
          <span className="small muted" style={{ fontWeight: 700 }}>
            Kéo nguyên liệu xuống tô hoặc chạm để thêm · vuốt ngang để xem thêm
          </span>
        ) : (
          bowl.map((code) => (
            <button key={code} type="button" className={styles.bowlChip} onClick={() => onRemove(code)} aria-label={`Bỏ ${byCode.get(code)?.name ?? code} ra khỏi tô`}>
              {byCode.get(code)?.name ?? code} <span aria-hidden="true">×</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
