/* eslint-disable @next/next/no-img-element -- ảnh chân dung nhỏ đã tối ưu sẵn */
// Avatar khách NPC: ảnh chân dung nếu có (customers.image), chưa có thì hiện dấu "?".

export function CustomerAvatar({
  look,
  image,
  size = 44,
  mood = "normal",
}: {
  look: number;
  /** Giữ để sau này chọn ảnh theo giới tính. */
  gender?: "m" | "f";
  image?: string | null;
  size?: number;
  mood?: "normal" | "happy" | "angry";
}) {
  if (image) {
    return (
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          background: "#FFF6E9",
          boxShadow: mood === "angry" ? "0 0 0 3px var(--danger)" : mood === "happy" ? "0 0 0 3px var(--mint)" : undefined,
        }}
      />
    );
  }
  // Chưa có ảnh chân dung → dấu "?" (ảnh sẽ được bổ sung sau).
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: ["#FFE0C4", "#F6D2DA", "#D9EAD3", "#D6E4F5"][look % 4],
        color: "var(--ink-strong)",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: Math.round(size * 0.5),
        boxShadow: mood === "angry" ? "0 0 0 3px var(--danger)" : mood === "happy" ? "0 0 0 3px var(--mint)" : "0 2px 0 var(--shadow-hud)",
        lineHeight: 1,
      }}
    >
      ?
    </span>
  );
}

export function TraitChips({ impatient, dineAndDash, picky, minQuality, sensitive = false }: {
  impatient: boolean;
  dineAndDash: boolean;
  picky: boolean;
  minQuality: number;
  /** Bụng yếu: làm sai là dễ ngộ độc. */
  sensitive?: boolean;
}) {
  const chips: [string, string, string][] = [];
  if (impatient) chips.push(["Hay hối", "#fbe3e0", "#9b2a1f"]);
  if (dineAndDash) chips.push(["Hay quịt", "#f3e6ce", "#6e3810"]);
  if (picky) chips.push([`Khó tính · ≥${minQuality}★`, "#efe3fb", "#4d3d9e"]);
  if (sensitive) chips.push(["Bụng yếu", "#e3f0dc", "#2f6a3b"]);
  if (chips.length === 0) return null;
  return (
    <span className="row" style={{ gap: 4, flexWrap: "wrap" }}>
      {chips.map(([label, bg, fg]) => (
        <span key={label} style={{ background: bg, color: fg, fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "1px 8px" }}>
          {label}
        </span>
      ))}
    </span>
  );
}
