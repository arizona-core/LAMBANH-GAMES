import { AVATAR_BG, type Avatar as AvatarKey } from "@/lib/game/constants";

// 4 avatar đầu bếp vẽ bằng SVG (khác nhau ở màu da/tóc/mũ).
const LOOKS: Record<AvatarKey, { skin: string; hair: string; hat: boolean }> = {
  a1: { skin: "#F6C99B", hair: "#6B3A16", hat: true },
  a2: { skin: "#E7C6A6", hair: "#3B2416", hat: false },
  a3: { skin: "#F0B98C", hair: "#A0561A", hat: true },
  a4: { skin: "#DDB08A", hair: "#2B2B2B", hat: false },
};

export function Avatar({ avatar, size = 40, ring }: { avatar: string; size?: number; ring?: string }) {
  const key = (avatar in LOOKS ? avatar : "a1") as AvatarKey;
  const look = LOOKS[key];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      style={{ borderRadius: "50%", flexShrink: 0, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }}
    >
      <circle cx="20" cy="20" r="20" fill={AVATAR_BG[key]} />
      <path d="M8 40c0-8 5.4-13 12-13s12 5 12 13z" fill="#fff" />
      <circle cx="20" cy="19" r="8" fill={look.skin} />
      {look.hat ? (
        <path d="M11 13c0-4 4-6 9-6s9 2 9 6c0 1.5-1 2.5-2 2.5H13c-1 0-2-1-2-2.5z" fill="#fff" stroke="#E4CFA8" />
      ) : (
        <path d="M12 17c0-5 3.6-7.5 8-7.5s8 2.5 8 7.5c-2-2-5-3-8-3s-6 1-8 3z" fill={look.hair} />
      )}
      <circle cx="17" cy="20" r="1.2" fill="#4A2B1A" />
      <circle cx="23" cy="20" r="1.2" fill="#4A2B1A" />
      <path d="M17.5 23.5c1.5 1.2 3.5 1.2 5 0" stroke="#4A2B1A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
