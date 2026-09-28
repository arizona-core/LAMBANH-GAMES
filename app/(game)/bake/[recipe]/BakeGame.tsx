"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { IconBack } from "@/components/icons";
import { ItemImage } from "@/components/ItemImage";
import { Stars } from "@/components/Stars";
import { useAction } from "@/components/useAction";
import { STEP_LABELS } from "@/game/steps";
import { previewStars } from "@/lib/game/scoring";
import styles from "./bake.module.css";

type Recipe = { code: string; name: string; image: string | null; minPlaySeconds: number };
type Need = { name: string; need: number; have: number };
type Phase = "intro" | "playing" | "oven" | "result";
type Result = { quality: number; xp_gained: number; level: number; leveled_up: boolean; tired?: boolean };

export function BakeGame({ recipe, difficulty, needs }: { recipe: Recipe; difficulty: number; needs: Need[] }) {
  const router = useRouter();
  const start = useAction("start-bake");
  const { run: finishRun } = useAction("finish-bake");

  const [phase, setPhase] = useState<Phase>("intro");
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [ovenBonus, setOvenBonus] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [waitLeft, setWaitLeft] = useState(0);

  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ tap: () => void; destroy: () => void } | null>(null);
  const sessionRef = useRef<{ id: string; startedAt: number; minPlay: number } | null>(null);

  const enough = needs.every((n) => n.have >= n.need);

  const submit = useCallback(
    async (final: [number, number, number]) => {
      const session = sessionRef.current;
      if (!session) return;
      setPhase("oven");
      // Server chặn nộp sớm hơn thời gian chơi tối thiểu → chờ "bánh trong lò" cho đủ.
      const readyAt = session.startedAt + (session.minPlay + 0.6) * 1000;
      while (Date.now() < readyAt) {
        setWaitLeft(Math.ceil((readyAt - Date.now()) / 1000));
        await new Promise((r) => setTimeout(r, 250));
      }
      setWaitLeft(0);
      const res = await finishRun({ sessionId: session.id, scores: final }, { refresh: false });
      if (res && !res.expired) {
        setResult(res);
        setPhase("result");
      } else {
        setPhase("intro");
      }
      router.refresh();
    },
    [finishRun, router],
  );
  // Scene Phaser giữ callback lúc tạo → đọc bản mới nhất qua ref, tránh phải tạo lại game.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  async function begin() {
    const res = await start.run({ recipe: recipe.code }, { refresh: false });
    if (!res) return;
    sessionRef.current = { id: res.session_id, startedAt: Date.now(), minPlay: res.min_play_seconds };
    setOvenBonus(res.oven_bonus);
    setScores([]);
    setStep(0);
    setResult(null);
    setPhase("playing");
  }

  // Tạo/huỷ Phaser khi vào/ra pha "playing".
  useEffect(() => {
    if (phase !== "playing" || !parentRef.current) return;
    let cancelled = false;
    const parent = parentRef.current;
    import("@/game/createBakeGame").then(({ createBakeGame }) => {
      if (cancelled) return;
      gameRef.current = createBakeGame(parent, {
        recipeImage: recipe.image,
        difficulty,
        onStep: (s, last) => {
          setStep(s);
          if (last !== null) setScores((prev) => [...prev, last]);
        },
        onComplete: (final) => {
          setScores(final);
          submitRef.current(final);
        },
      });
    });
    return () => {
      cancelled = true;
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, [phase, recipe.image, difficulty]);

  // Phím cách / Enter = CHẠM
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        gameRef.current?.tap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const stars = previewStars(scores, ovenBonus);

  return (
    <div className="screen" style={{ gap: 10 }}>
      <header className="header">
        <Link href="/kitchen" className="icon-btn" aria-label="Quay lại bếp">
          <IconBack size={20} />
        </Link>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div className="small" style={{ fontWeight: 700, color: "#8a4d18" }}>
            Đang làm
          </div>
          <h1 style={{ fontSize: 20 }}>{recipe.name}</h1>
        </div>
        <span style={{ width: 44 }} />
      </header>

      <ol className={styles.steps} aria-label="Các bước">
        {STEP_LABELS.map((label, i) => (
          <Fragment key={label}>
            {i > 0 && <li aria-hidden="true">›</li>}
            <li
              className={
                phase === "playing" && i === step ? styles.stepActive : scores.length > i ? styles.stepDone : styles.step
              }
              aria-current={phase === "playing" && i === step ? "step" : undefined}
            >
              {label}
            </li>
          </Fragment>
        ))}
      </ol>

      {phase === "intro" && (
        <section className={`card stack ${styles.intro}`}>
          <div className="row" style={{ justifyContent: "center" }}>
            <ItemImage code={recipe.code} image={recipe.image} name={recipe.name} size={120} />
          </div>
          <p style={{ margin: 0, textAlign: "center", fontWeight: 700 }}>
            3 bước: Trộn → Nướng → Trang trí. Chạm khi kim chạy vào <strong>vùng vàng</strong>. Càng chuẩn, bánh
            càng nhiều sao!
          </p>
          <ul className={styles.needs}>
            {needs.map((n) => (
              <li key={n.name} style={{ color: n.have >= n.need ? "var(--ink)" : "var(--danger)" }}>
                {n.name} ×{n.need} <span className="muted">(có {n.have})</span>
              </li>
            ))}
          </ul>
          {enough ? (
            <button type="button" className="btn btn--primary btn--block btn--lg" onClick={begin} disabled={start.busy}>
              {start.busy ? "Đang chuẩn bị…" : "Bắt đầu làm bánh"}
            </button>
          ) : (
            <Link href="/kitchen?tab=pantry" className="btn btn--soft btn--block btn--lg">
              Thiếu nguyên liệu — đi mua
            </Link>
          )}
        </section>
      )}

      {phase === "playing" && (
        <>
          <p className={styles.instruction}>
            <strong>{step === 0 ? "Trộn đều!" : step === 1 ? "Canh lò!" : "Trang trí!"}</strong>
            <span>Chạm khi kim chạy vào vùng vàng</span>
          </p>
          <div ref={parentRef} className={styles.canvas} />
          <div className="row" style={{ justifyContent: "center", gap: 8, fontWeight: 800 }}>
            Chất lượng <Stars value={stars} size={18} />
          </div>
          <div className="spacer" />
          <button type="button" className="btn btn--primary btn--block btn--xl" onPointerDown={() => gameRef.current?.tap()}>
            CHẠM!
          </button>
        </>
      )}

      {phase === "oven" && (
        <section className={`card stack ${styles.intro}`} aria-live="polite">
          <h2 style={{ textAlign: "center" }}>Bánh đang trong lò…</h2>
          <p className="muted" style={{ textAlign: "center", margin: 0, fontWeight: 700 }}>
            {waitLeft > 0 ? `Còn ${waitLeft} giây` : "Đang lấy bánh ra"}
          </p>
          <div className="row" style={{ justifyContent: "center" }}>
            <Stars value={stars} size={26} />
          </div>
        </section>
      )}

      {phase === "result" && result && (
        <section className={`card stack ${styles.intro}`} aria-live="polite">
          <h2 style={{ textAlign: "center", fontSize: 26 }}>Ra lò!</h2>
          <div className="row" style={{ justifyContent: "center" }}>
            <ItemImage code={recipe.code} image={recipe.image} name={recipe.name} size={110} />
          </div>
          <div className="row" style={{ justifyContent: "center" }}>
            <Stars value={result.quality} size={30} />
          </div>
          <p style={{ textAlign: "center", margin: 0, fontWeight: 800 }}>
            +{result.xp_gained} XP{result.leveled_up && ` · Lên cấp ${result.level}!`}
          </p>
          {result.tired && (
            <p className="small muted" style={{ textAlign: "center", margin: 0, fontWeight: 700 }}>
              Đầu bếp đã làm rất nhiều mẻ hôm nay — bánh tối đa 3★ cho tới khi nghỉ ngơi.
            </p>
          )}
          <div className="row">
            <Link href="/shop" className="btn btn--white btn--block">
              Ra tiệm bán
            </Link>
            <button type="button" className="btn btn--primary btn--block" onClick={() => setPhase("intro")}>
              Làm mẻ nữa
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
