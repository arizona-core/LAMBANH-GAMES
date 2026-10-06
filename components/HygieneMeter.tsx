import { hygieneLevel } from "@/lib/game/operations";

const COLOR = { clean: "var(--mint)", dirty: "var(--coin)", filthy: "var(--danger)" } as const;

/** Thanh mức vệ sinh 0..100%: xanh (sạch) → vàng (hơi bẩn) → đỏ (bẩn, dễ bị phạt). */
export function HygieneMeter({ value, height = 10 }: { value: number; height?: number }) {
  return (
    <span
      role="progressbar"
      aria-label="Vệ sinh tiệm"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ display: "block", flex: 1, height, borderRadius: height / 2, background: "#eee0c6", overflow: "hidden" }}
    >
      <span
        style={{
          display: "block",
          height: "100%",
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: COLOR[hygieneLevel(value)],
          transition: "width .4s ease",
        }}
      />
    </span>
  );
}
