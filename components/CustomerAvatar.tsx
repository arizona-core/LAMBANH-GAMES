// Avatar khách NPC: 12 kiểu (look 0..11 = 3 màu da × 4 màu tóc), dáng tóc theo giới tính.
const SKINS = ["#F6C99B", "#E7C6A6", "#D9A77E"];
const HAIRS = ["#3B2416", "#6B3A16", "#A0561A", "#2B2B2B"];
const SHIRTS = ["#8FB6E0", "#E0A9B4", "#A8CDA0", "#F3D9AE", "#C9B6EE", "#F4B183"];

export function CustomerAvatar({
  look,
  gender,
  size = 44,
  mood = "normal",
}: {
  look: number;
  gender: "m" | "f";
  size?: number;
  mood?: "normal" | "happy" | "angry";
}) {
  const skin = SKINS[look % 3];
  const hair = HAIRS[Math.floor(look / 3) % 4];
  const shirt = SHIRTS[look % SHIRTS.length];
  const mouth =
    mood === "happy" ? "M16 25c2 2.5 6 2.5 8 0" : mood === "angry" ? "M16 27c2-2 6-2 8 0" : "M16.5 25.5h7";
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="20" cy="20" r="20" fill="#FFF6E9" />
      <path d="M7 40c0-8 6-13 13-13s13 5 13 13z" fill={shirt} />
      {gender === "f" && <path d="M10 22c0-9 4-14 10-14s10 5 10 14l-3 4V17H13v9z" fill={hair} />}
      <circle cx="20" cy="19" r="8" fill={skin} />
      <path
        d={gender === "f" ? "M12 18c0-6 3.5-9 8-9s8 3 8 9c-2-3-5-4.5-8-4.5s-6 1.5-8 4.5z" : "M12.5 16c0-5 3.3-7.5 7.5-7.5s7.5 2.5 7.5 7.5c-2-1.8-4.7-2.6-7.5-2.6s-5.5.8-7.5 2.6z"}
        fill={hair}
      />
      <circle cx="17" cy="20" r="1.1" fill="#4A2B1A" />
      <circle cx="23" cy="20" r="1.1" fill="#4A2B1A" />
      {mood === "angry" && <path d="M15 17.2l3 1M25 17.2l-3 1" stroke="#4A2B1A" strokeWidth="1.1" strokeLinecap="round" />}
      <path d={mouth} stroke="#4A2B1A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function TraitChips({ impatient, dineAndDash, picky, minQuality }: {
  impatient: boolean;
  dineAndDash: boolean;
  picky: boolean;
  minQuality: number;
}) {
  const chips: [string, string, string][] = [];
  if (impatient) chips.push(["Hay hối", "#fbe3e0", "#9b2a1f"]);
  if (dineAndDash) chips.push(["Hay quịt", "#f3e6ce", "#6e3810"]);
  if (picky) chips.push([`Khó tính · ≥${minQuality}★`, "#efe3fb", "#4d3d9e"]);
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
