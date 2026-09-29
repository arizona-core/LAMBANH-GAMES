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

// Nguyên liệu gốc chưa có ảnh: bao bột (đồ khô), hũ (sữa/kem/hương liệu), quả tròn (trái cây).
const SACK_COLORS: Record<string, string> = {
  yeast: "#E9D8A6", salt: "#F4F4F4", tapioca: "#FDFCF8", rice_flour: "#FBF6EC", glutinous_flour: "#F6F1E4",
  almond_flour: "#E8C9A0", cocoa: "#7A4524", matcha: "#8DB356", oats: "#D9BC87",
  brown_sugar: "#B9793D", mung_bean: "#E6C74C", sesame: "#EFE3C4", biscuit: "#D39B5A",
  pork_floss: "#C98A4B", macadamia: "#EAD7B0", almond: "#C9955C",
};
const JAR_COLORS: Record<string, string> = {
  water: "#CFE6F5", cream: "#FFFDF6", cheese: "#F4C542", cream_cheese: "#FFF5DC",
  mascarpone: "#FFF8E6", sour_cream: "#F7F4EA", coconut_milk: "#FBFAF5", salted_egg: "#F29A38",
  white_chocolate: "#F6ECD6", vanilla: "#F3E3B5", cinnamon: "#A0592A", coffee: "#5A3A22",
  gelatin: "#F5EFD9", olive_oil: "#B8B63E",
};
const FRUIT_COLORS: Record<string, string> = {
  apple: "#D8434E", banana: "#F2CF4A", lemon: "#F2DC4A", blueberry: "#4F5FA8", cherry: "#A51F35",
  fruit: "#F08A3C", carrot: "#EE8434", garlic: "#F4EEE2", herbs: "#5E9E55", pandan: "#3F8F4A",
};

function sackArt(color: string) {
  return (
    <>
      <path d="M20 16h24l-3 6 7 26a6 6 0 0 1-6 7H22a6 6 0 0 1-6-7l7-26z" fill={color} stroke="#8A6337" strokeWidth="2" />
      <path d="M23 22h18" stroke="#8A6337" strokeWidth="2" />
    </>
  );
}

function jarArt(color: string) {
  return (
    <>
      <rect x="22" y="10" width="20" height="7" rx="2" fill="#B98F55" />
      <rect x="16" y="17" width="32" height="38" rx="7" fill={color} stroke="#8A6337" strokeWidth="2" />
      <rect x="21" y="29" width="22" height="12" rx="2" fill="#FFF6E9" opacity="0.8" />
    </>
  );
}

function fruitArt(color: string) {
  return (
    <>
      <circle cx="32" cy="36" r="17" fill={color} stroke="#8A6337" strokeWidth="2" />
      <path d="M32 19c0-5 3-8 8-9" stroke="#6A4A2A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <ellipse cx="25" cy="30" rx="4" ry="6" fill="#fff" opacity="0.35" />
    </>
  );
}

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
    (SACK_COLORS[code] ? sackArt(SACK_COLORS[code])
      : JAR_COLORS[code] ? jarArt(JAR_COLORS[code])
      : FRUIT_COLORS[code] ? fruitArt(FRUIT_COLORS[code])
      : SAUCE_COLORS[code] ? sauceArt(SAUCE_COLORS[code])
      : TOPPING_COLORS[code] ? toppingArt(TOPPING_COLORS[code])
      : null);
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
