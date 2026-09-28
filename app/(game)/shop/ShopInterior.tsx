/* eslint-disable @next/next/no-img-element -- ảnh trang trí nhỏ đã tối ưu sẵn */
// Cảnh nội thất tiệm: cửa sổ đổi màu trời theo giờ game, kệ bánh, sàn gạch, đồ trang trí đã mua.
// Đồ trang trí có ảnh (upgrade_catalog.image) thì hiện ảnh; chưa có thì vẽ SVG tạm.
import styles from "./shop.module.css";

export type DecorItem = { code: string; name: string; image: string | null; slot: string };

/** Màu trời theo giờ game (0..23). */
function sky(hour: number): [string, string] {
  if (hour < 5) return ["#1E2748", "#3A3F6B"];
  if (hour < 8) return ["#F7B28A", "#FBE0B8"];
  if (hour < 16) return ["#8EC9F0", "#D6EEFB"];
  if (hour < 19) return ["#F2956B", "#F9D29B"];
  return ["#27305A", "#4A4F80"];
}

const FALLBACK: Record<string, React.ReactNode> = {
  decor_table: (
    <svg viewBox="0 0 80 60" width="100%" height="100%">
      <rect x="6" y="18" width="68" height="10" rx="3" fill="#A0561A" />
      <rect x="12" y="28" width="7" height="30" fill="#7A3E12" />
      <rect x="61" y="28" width="7" height="30" fill="#7A3E12" />
      <rect x="30" y="8" width="20" height="10" rx="3" fill="#FFF6E9" stroke="#E4CFA8" />
    </svg>
  ),
  decor_plant: (
    <svg viewBox="0 0 50 70" width="100%" height="100%">
      <path d="M25 38c-12-6-16-20-8-28 6 8 9 18 8 28zm0 0c12-6 16-20 8-28-6 8-9 18-8 28zm0 0c-2-12 0-24 0-32 2 8 4 20 0 32z" fill="#6FA678" />
      <path d="M12 40h26l-4 26H16z" fill="#C9722E" />
    </svg>
  ),
  decor_neon: (
    <svg viewBox="0 0 90 44" width="100%" height="100%">
      <rect x="2" y="2" width="86" height="40" rx="10" fill="#2B1D3A" stroke="#E28B9B" strokeWidth="3" />
      <text x="45" y="29" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="700" fontSize="18" fill="#FFD1DC">
        Sweet
      </text>
    </svg>
  ),
  decor_lamp: (
    <svg viewBox="0 0 60 60" width="100%" height="100%">
      <path d="M30 0v18" stroke="#7A3E12" strokeWidth="2" />
      <path d="M12 34c0-10 8-16 18-16s18 6 18 16z" fill="#E7B23C" />
      <ellipse cx="30" cy="42" rx="22" ry="10" fill="#FFE9A8" opacity="0.6" />
    </svg>
  ),
};

export function ShopInterior({
  hour,
  open,
  decor,
  children,
}: {
  hour: number;
  open: boolean;
  decor: DecorItem[];
  children: React.ReactNode;
}) {
  const [top, bottom] = sky(hour);
  return (
    <div className={styles.interior}>
      <div className={styles.window} style={{ background: `linear-gradient(${top}, ${bottom})` }} aria-hidden="true">
        {hour >= 19 || hour < 5 ? <span className={styles.moon} /> : <span className={styles.sun} />}
        <span className={styles.windowBar} />
      </div>
      <div className={`${styles.sign} ${open ? styles.signOpen : ""}`} aria-hidden="true">
        {open ? "MỞ CỬA" : "ĐÓNG CỬA"}
      </div>
      <div className={styles.shelf} aria-hidden="true">
        <img src="/images/items/bread.webp" alt="" />
        <img src="/images/items/croissant.webp" alt="" />
        <img src="/images/items/cookie.webp" alt="" />
      </div>
      {decor.map((d) => (
        <div key={d.code} className={`${styles.decor} ${styles[`slot_${d.slot}`] ?? ""}`} title={d.name}>
          {d.image ? <img src={d.image} alt={d.name} /> : FALLBACK[d.code] ?? null}
        </div>
      ))}
      <div className={styles.floor} aria-hidden="true" />
      {children}
    </div>
  );
}
