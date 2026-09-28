"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CustomerAvatar, TraitChips } from "@/components/CustomerAvatar";
import { CoinIcon, IconBack, IconCheck } from "@/components/icons";
import { ItemImage } from "@/components/ItemImage";
import { Modal } from "@/components/Modal";
import { Stars } from "@/components/Stars";
import { useAction } from "@/components/useAction";
import type { BakeStep } from "@/game/scenes/BakeScene";
import { formatNumber } from "@/lib/game/format";
import {
  COOK_METHODS,
  orderText,
  PACKAGING,
  type AcceptResult,
  type CookMethod,
  type OrderResult,
  type Packaging,
} from "@/lib/game/orders";
import { previewStars } from "@/lib/game/scoring";
import styles from "./order.module.css";

type Item = { code: string; name: string; image: string | null; kind: "base" | "sauce" | "topping"; have: number };
type RecipeInfo = {
  code: string;
  name: string;
  image: string | null;
  cookMethod: CookMethod;
  packaging: Packaging;
  difficulty: number;
  ingredients: { ingredient_code: string; qty: number }[];
};

const STEPS = ["Nguyên liệu", "Cách nấu", "Trộn & nấu", "Nước chấm", "Topping", "Đóng gói", "Giao"] as const;
const GAME_STEPS: BakeStep[] = ["mix", "cook"];

export function OrderFlow({ visitId, ingredients, recipes }: { visitId: string; ingredients: Item[]; recipes: RecipeInfo[] }) {
  const router = useRouter();
  const accept = useAction("accept-order");
  const { run: completeRun, busy: delivering } = useAction("complete-order");

  const [order, setOrder] = useState<AcceptResult | null>(null);
  const [step, setStep] = useState(0);
  const [bowl, setBowl] = useState<string[]>([]);
  const [method, setMethod] = useState<CookMethod | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [gameStep, setGameStep] = useState(0);
  const [sauce, setSauce] = useState<string | null | undefined>(undefined);
  const [topping, setTopping] = useState<string | null | undefined>(undefined);
  const [packaging, setPackaging] = useState<Packaging | null>(null);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [showBook, setShowBook] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const startedAt = useRef(0);

  const acceptRun = accept.run;
  useEffect(() => {
    let active = true;
    acceptRun({ visitId }, { refresh: false }).then((res) => {
      if (!active) return;
      if (!res) return router.replace("/shop");
      startedAt.current = Date.now();
      setOrder(res);
    });
    return () => {
      active = false;
    };
  }, [visitId, acceptRun, router]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const recipe = recipes.find((r) => r.code === order?.recipe);
  const base = ingredients.filter((i) => i.kind === "base");
  const sauces = ingredients.filter((i) => i.kind === "sauce");
  const toppings = ingredients.filter((i) => i.kind === "topping");
  const needQty = (code: string) => recipe?.ingredients.find((ri) => ri.ingredient_code === code)?.qty ?? 1;

  const secondsLeft = order ? Math.max(0, Math.ceil((new Date(order.leave_at).getTime() - now) / 1000)) : 0;

  // ---------- Phaser (bước 3)
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ tap: () => void; destroy: () => void } | null>(null);

  useEffect(() => {
    if (step !== 2 || !parentRef.current || !recipe || !method) return;
    let cancelled = false;
    const parent = parentRef.current;
    import("@/game/createBakeGame").then(({ createBakeGame }) => {
      if (cancelled) return;
      gameRef.current = createBakeGame(parent, {
        recipeImage: recipe.image,
        method,
        difficulty: recipe.difficulty,
        steps: GAME_STEPS,
        onStep: (s, last) => {
          setGameStep(s);
          if (last !== null) setScores((prev) => [...prev, last]);
        },
        onComplete: (final) => {
          setScores(final);
          setStep(3);
        },
      });
    });
    return () => {
      cancelled = true;
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, [step, recipe, method]);

  useEffect(() => {
    if (step !== 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        gameRef.current?.tap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  // ---------- Giao (bước 7)
  const deliver = useCallback(async () => {
    if (!order || !method || !packaging || sauce === undefined || topping === undefined) return;
    // Server chặn giao sớm hơn thời gian tối thiểu → đợi cho đủ (thường đã đủ).
    const readyAt = startedAt.current + (order.min_play_seconds + 0.5) * 1000;
    while (Date.now() < readyAt) await new Promise((r) => setTimeout(r, 250));
    const res = await completeRun(
      {
        visitId,
        ingredients: bowl,
        method,
        scores: [scores[0] ?? 0, scores[1] ?? 0],
        sauce,
        topping,
        packaging,
      },
      { refresh: false },
    );
    if (res) {
      setResult(res);
      router.refresh();
    } else {
      router.refresh();
    }
  }, [order, method, packaging, sauce, topping, completeRun, visitId, bowl, scores, router]);

  if (!order || !recipe) {
    return (
      <div className="screen" style={{ alignItems: "center", justifyContent: "center" }}>
        <p className="muted" style={{ fontWeight: 800 }}>
          Đang nhận đơn…
        </p>
      </div>
    );
  }

  const c = order.customer;

  return (
    <div className="screen" style={{ gap: 10 }}>
      <header className="header">
        <Link href="/shop" className="icon-btn" aria-label="Về quầy (đơn vẫn giữ)">
          <IconBack size={20} />
        </Link>
        <h1 style={{ fontSize: 20 }}>{result ? "Đã giao đơn" : `Đơn của ${c.name.split(" ").pop()}`}</h1>
        <button type="button" className="btn btn--white btn--sm" onClick={() => setShowBook(true)}>
          Sổ công thức
        </button>
      </header>

      <section className={`card row ${styles.customer}`} aria-label="Khách hàng">
        <CustomerAvatar look={c.look} gender={c.gender} image={c.image} size={52} mood={result ? (result.dashed ? "normal" : "happy") : secondsLeft < 20 ? "angry" : "normal"} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <strong>{c.name}</strong>
            <span className="badge">{c.personality}</span>
          </div>
          <TraitChips impatient={c.impatient} dineAndDash={c.dine_and_dash} picky={c.picky} minQuality={c.min_quality} />
          <p className="small" style={{ margin: "4px 0 0", fontWeight: 800 }}>
            Gọi: {orderText(order)}
          </p>
        </div>
        {!result && (
          <span className={secondsLeft < 20 ? styles.timerHot : styles.timer} aria-label={`Khách còn chờ ${secondsLeft} giây`}>
            {secondsLeft}s
          </span>
        )}
      </section>

      {!result && (
        <ol className={styles.steps} aria-label="Các bước">
          {STEPS.map((label, i) => (
            <li key={label} className={i === step ? styles.stepActive : i < step ? styles.stepDone : undefined} aria-current={i === step ? "step" : undefined}>
              {i < step ? <IconCheck size={12} /> : `${i + 1}.`} {label}
            </li>
          ))}
        </ol>
      )}

      {result ? (
        <ResultCard result={result} />
      ) : step === 0 ? (
        <section className="stack">
          <p className={styles.hint}>Bỏ nguyên liệu của món <strong>{recipe.name}</strong> vào tô (chạm để thêm/bớt).</p>
          <div className="grid-4">
            {base.map((i) => {
              const picked = bowl.includes(i.code);
              const lacking = i.have < needQty(i.code);
              return (
                <button
                  key={i.code}
                  type="button"
                  className={`${styles.pick} ${picked ? styles.pickOn : ""}`}
                  aria-pressed={picked}
                  disabled={!picked && lacking}
                  onClick={() => setBowl((b) => (picked ? b.filter((x) => x !== i.code) : [...b, i.code]))}
                >
                  <ItemImage code={i.code} image={i.image} name={i.name} size={44} />
                  <span>{i.name}</span>
                  <span className={styles.have}>{lacking && !picked ? "Hết" : `có ${i.have}`}</span>
                </button>
              );
            })}
          </div>
          <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
            Trong tô: {bowl.length ? bowl.map((code) => ingredients.find((i) => i.code === code)?.name).join(", ") : "trống"}
          </p>
          <button type="button" className="btn btn--primary btn--block btn--lg" disabled={bowl.length === 0} onClick={() => setStep(1)}>
            Xong, chọn cách nấu
          </button>
        </section>
      ) : step === 1 ? (
        <section className="stack">
          <p className={styles.hint}>Món này nấu bằng cách nào?</p>
          <div className="row">
            {(Object.keys(COOK_METHODS) as CookMethod[]).map((m) => (
              <button key={m} type="button" className={`${styles.choice} ${method === m ? styles.pickOn : ""}`} aria-pressed={method === m} onClick={() => setMethod(m)}>
                {COOK_METHODS[m]}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--primary btn--block btn--lg" disabled={!method} onClick={() => setStep(2)}>
            Bắt đầu trộn &amp; {method ? COOK_METHODS[method].toLowerCase() : "nấu"}
          </button>
        </section>
      ) : step === 2 ? (
        <section className="stack">
          <p className={styles.instruction}>
            <strong>{gameStep === 0 ? "Trộn đều!" : `Canh lửa — ${method ? COOK_METHODS[method] : ""}!`}</strong>
            <span>Chạm khi kim chạy vào vùng vàng</span>
          </p>
          <div ref={parentRef} className={styles.canvas} />
          <div className="row" style={{ justifyContent: "center", gap: 8, fontWeight: 800 }}>
            Tay nghề <Stars value={previewStars(scores, order.oven_bonus)} size={18} />
          </div>
          <button type="button" className="btn btn--primary btn--block btn--xl" onPointerDown={() => gameRef.current?.tap()}>
            CHẠM!
          </button>
        </section>
      ) : step === 3 || step === 4 ? (
        <ExtraPicker
          title={step === 3 ? "Thêm nước chấm / sốt" : "Thêm topping"}
          noneLabel={step === 3 ? "Không sốt" : "Không topping"}
          items={step === 3 ? sauces : toppings}
          value={step === 3 ? sauce : topping}
          onChange={step === 3 ? setSauce : setTopping}
          onNext={() => setStep(step + 1)}
        />
      ) : step === 5 ? (
        <section className="stack">
          <p className={styles.hint}>Đóng gói bánh vào…</p>
          <div className="row">
            {(Object.keys(PACKAGING) as Packaging[]).map((p) => (
              <button key={p} type="button" className={`${styles.choice} ${packaging === p ? styles.pickOn : ""}`} aria-pressed={packaging === p} onClick={() => setPackaging(p)}>
                {PACKAGING[p]}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--primary btn--block btn--lg" disabled={!packaging} onClick={() => setStep(6)}>
            Đóng gói xong
          </button>
        </section>
      ) : (
        <section className="card stack">
          <h2 style={{ fontSize: 18 }}>Kiểm tra trước khi giao</h2>
          <ul className={styles.summary}>
            <li>Nguyên liệu: {bowl.map((code) => ingredients.find((i) => i.code === code)?.name).join(", ")}</li>
            <li>Cách nấu: {method && COOK_METHODS[method]}</li>
            <li>Sốt: {sauce ? ingredients.find((i) => i.code === sauce)?.name : "không"}</li>
            <li>Topping: {topping ? ingredients.find((i) => i.code === topping)?.name : "không"}</li>
            <li>Đóng gói: {packaging && PACKAGING[packaging]}</li>
          </ul>
          <button type="button" className="btn btn--primary btn--block btn--lg" onClick={deliver} disabled={delivering}>
            {delivering ? "Đang giao…" : "Giao cho khách"}
          </button>
        </section>
      )}

      {showBook && (
        <Modal title="Sổ công thức" onClose={() => setShowBook(false)}>
          <div className="stack">
            {recipes.map((r) => (
              <div key={r.code} className="card small" style={{ fontWeight: 700 }}>
                <strong style={{ fontSize: 15 }}>{r.name}</strong>
                <div>
                  {r.ingredients
                    .map((ri) => `${ingredients.find((i) => i.code === ri.ingredient_code)?.name} ×${ri.qty}`)
                    .join(" · ")}
                </div>
                <div className="muted">
                  {COOK_METHODS[r.cookMethod]} · {PACKAGING[r.packaging]}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function ExtraPicker({
  title,
  noneLabel,
  items,
  value,
  onChange,
  onNext,
}: {
  title: string;
  noneLabel: string;
  items: Item[];
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  onNext: () => void;
}) {
  return (
    <section className="stack">
      <p className={styles.hint}>{title} — xem khách gọi gì ở trên nhé!</p>
      <div className="grid-3">
        <button type="button" className={`${styles.pick} ${value === null ? styles.pickOn : ""}`} aria-pressed={value === null} onClick={() => onChange(null)}>
          <span style={{ fontSize: 13 }}>{noneLabel}</span>
        </button>
        {items.map((i) => (
          <button
            key={i.code}
            type="button"
            className={`${styles.pick} ${value === i.code ? styles.pickOn : ""}`}
            aria-pressed={value === i.code}
            disabled={i.have < 1}
            onClick={() => onChange(i.code)}
          >
            <ItemImage code={i.code} image={i.image} name={i.name} size={40} />
            <span>{i.name}</span>
            <span className={styles.have}>{i.have < 1 ? "Hết" : `có ${i.have}`}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--primary btn--block btn--lg" disabled={value === undefined} onClick={onNext}>
        Tiếp tục
      </button>
    </section>
  );
}

function ResultCard({ result }: { result: OrderResult }) {
  return (
    <section className="card stack" aria-live="polite" style={{ alignItems: "center", textAlign: "center" }}>
      <Stars value={result.quality} size={30} />
      {result.dashed ? (
        <>
          <h2 style={{ fontSize: 22, color: "var(--danger)" }}>Khách quịt tiền!</h2>
          <p className="muted" style={{ margin: 0, fontWeight: 700 }}>
            {result.customer} ăn xong rồi lẻn đi, mất {formatNumber(result.lost ?? 0)} ₵. Khách &quot;hay quịt&quot; thì cẩn thận nhé.
          </p>
        </>
      ) : (
        <>
          <h2 style={{ fontSize: 22 }}>{result.quality >= 4 ? "Khách rất hài lòng!" : result.quality >= 3 ? "Khách tạm hài lòng" : "Khách không vui lắm"}</h2>
          <p className="row" style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>
            <CoinIcon /> +{formatNumber(result.paid ?? 0)}
            {(result.tip ?? 0) > 0 && <span className="small muted">(tip {formatNumber(result.tip ?? 0)})</span>}
          </p>
          {result.reputation_delta !== undefined && result.reputation_delta !== 0 && (
            <p className="small" style={{ margin: 0, fontWeight: 800, color: result.reputation_delta > 0 ? "var(--mint-strong)" : "var(--danger)" }}>
              Uy tín {result.reputation_delta > 0 ? "+" : ""}
              {result.reputation_delta}
            </p>
          )}
        </>
      )}
      {result.notes.length > 0 && (
        <ul className="small" style={{ margin: 0, paddingLeft: 18, textAlign: "left", fontWeight: 700, color: "var(--ink-muted)" }}>
          {result.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <p className="small" style={{ margin: 0, fontWeight: 800 }}>
        +{result.xp_gained} XP{result.leveled_up && ` · Lên cấp ${result.level}!`}
      </p>
      {result.tired && (
        <p className="small muted" style={{ margin: 0, fontWeight: 700 }}>
          Đầu bếp đã làm rất nhiều đơn hôm nay — bánh tối đa 3★ cho tới khi nghỉ ngơi.
        </p>
      )}
      <Link href="/shop" className="btn btn--primary btn--block btn--lg">
        Về quầy đón khách tiếp
      </Link>
    </section>
  );
}
