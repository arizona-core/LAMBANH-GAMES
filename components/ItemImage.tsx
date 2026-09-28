/* eslint-disable @next/next/no-img-element -- ảnh nhỏ đã tối ưu sẵn (webp), không cần next/image */
import { IconImage } from "./icons";

// Nguyên liệu chưa có ảnh Vecteezy → vẽ icon SVG đơn giản.
const FALLBACK_ART: Record<string, React.ReactNode> = {
  butter: (
    <>
      <rect x="10" y="22" width="44" height="22" rx="4" fill="#F7E08A" stroke="#C9A94A" strokeWidth="2" />
      <path d="M10 30h44" stroke="#C9A94A" strokeWidth="2" />
    </>
  ),
  milk: (
    <>
      <path d="M22 14h20l4 10v28a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V24z" fill="#fff" stroke="#9DB6D6" strokeWidth="2" />
      <rect x="22" y="30" width="20" height="12" rx="2" fill="#D6E4F5" />
    </>
  ),
  chocolate: (
    <>
      <rect x="14" y="12" width="36" height="40" rx="4" fill="#6B3A16" stroke="#4A2B1A" strokeWidth="2" />
      <path d="M14 25h36M14 38h36M26 12v40M38 12v40" stroke="#4A2B1A" strokeWidth="2" />
    </>
  ),
};

// Sốt: chai màu theo loại. Topping: chén nhỏ với hạt màu.
const SAUCE_COLORS: Record<string, string> = {
  sauce_garlic: "#E9D27A",
  sauce_condensed: "#F7F0DC",
  sauce_choco: "#5A2E14",
  sauce_caramel: "#C9772E",
  sauce_jam: "#C63A4E",
};
const TOPPING_COLORS: Record<string, string[]> = {
  top_sprinkles: ["#E28B9B", "#6FA678", "#7C6BD6", "#E7B23C"],
  top_cheese: ["#F4C542"],
  top_cream: ["#FFFFFF"],
  top_almond: ["#C9955C"],
  top_chocochip: ["#4A2B1A"],
};

function sauceArt(color: string) {
  return (
    <>
      <rect x="26" y="8" width="12" height="8" rx="2" fill="#B98F55" />
      <path d="M22 18h20l2 8v26a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V26z" fill={color} stroke="#8A6337" strokeWidth="2" />
      <rect x="24" y="32" width="16" height="10" rx="2" fill="#FFF6E9" opacity="0.85" />
    </>
  );
}

function toppingArt(colors: string[]) {
  const dots = [
    [24, 30], [32, 27], [40, 30], [28, 34], [36, 34],
  ];
  return (
    <>
      <path d="M10 34h44a22 16 0 0 1-44 0z" fill="#fff" stroke="#D9B98A" strokeWidth="2" />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="4" fill={colors[i % colors.length]} stroke="#8A6337" strokeWidth="1" />
      ))}
    </>
  );
}

export function ItemImage({
  code,
  image,
  name,
  size = 56,
}: {
  code: string;
  image: string | null | undefined;
  name: string;
  size?: number;
}) {
  if (image) {
    return (
      <div className="thumb" style={{ width: size, height: size }}>
        <img src={image} alt={name} loading="lazy" />
      </div>
    );
  }
  const art =
    FALLBACK_ART[code] ??
    (SAUCE_COLORS[code] ? sauceArt(SAUCE_COLORS[code]) : TOPPING_COLORS[code] ? toppingArt(TOPPING_COLORS[code]) : null);
  if (art) {
    return (
      <div className="thumb" style={{ width: size, height: size }}>
        <svg viewBox="0 0 64 64" width="80%" height="80%" role="img" aria-label={name}>
          {art}
        </svg>
      </div>
    );
  }
  return (
    <div className="thumb thumb--placeholder" style={{ width: size, height: size, color: "#B98F55" }}>
      <IconImage size={Math.round(size * 0.4)} aria-label={name} />
    </div>
  );
}
