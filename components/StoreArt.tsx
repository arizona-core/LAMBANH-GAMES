/* eslint-disable @next/next/no-img-element -- ảnh nhỏ đã tối ưu sẵn (webp), không cần next/image */
import { THEMES } from "@/game/shop/layout";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

// Hình minh hoạ SVG cho từng món trong Cửa hàng (viewBox 64×64).
// Có ảnh thật (assets/source/store/<mã>.png → npm run assets:build) thì dùng ảnh, xem STORE_IMAGES.
const ART: Record<string, React.ReactNode> = {
  oven_1: (
    <>
      <rect x="12" y="12" width="40" height="42" rx="6" fill="#CFD8DC" stroke="#78909C" strokeWidth="2" />
      <rect x="17" y="24" width="30" height="24" rx="3" fill="#37474F" />
      <rect x="21" y="28" width="22" height="16" rx="2" fill="#FFA94D" opacity="0.7" />
      <circle cx="22" cy="18" r="2.2" fill="#546E7A" />
      <circle cx="32" cy="18" r="2.2" fill="#546E7A" />
      <circle cx="42" cy="18" r="2.2" fill="#546E7A" />
    </>
  ),
  oven_2: (
    <>
      <path d="M10 54V34a22 20 0 0 1 44 0v20z" fill="#B5532E" stroke="#7A2F19" strokeWidth="2" />
      <path d="M10 40h44M10 47h44M20 34v6M32 28v6M44 34v6" stroke="#7A2F19" strokeWidth="1.2" />
      <path d="M22 54V44a10 9 0 0 1 20 0v10z" fill="#2B1A12" />
      <path d="M26 54c0-5 3-5 3-9 3 3 2 5 3 5 1-3 3-4 3-6 3 3 3 7 3 10z" fill="#FF7A1A" />
      <path d="M30 54c0-3 2-3 2-5 2 2 2 3 2 5z" fill="#FFD54F" />
    </>
  ),
  oven_3: (
    <>
      <rect x="14" y="8" width="36" height="48" rx="5" fill="#2F3B45" stroke="#1B252C" strokeWidth="2" />
      <rect x="20" y="12" width="24" height="6" rx="2" fill="#4DD0E1" />
      <rect x="18" y="24" width="28" height="26" rx="3" fill="#1B252C" />
      <rect x="22" y="28" width="20" height="18" rx="2" fill="#FFB74D" opacity="0.5" />
    </>
  ),
  display_1: (
    <>
      <rect x="8" y="44" width="48" height="10" rx="2" fill="#C9722E" />
      <rect x="10" y="22" width="44" height="22" rx="3" fill="#D6EEFB" opacity="0.8" stroke="#90A4AE" strokeWidth="1.5" />
      <rect x="10" y="20" width="44" height="3" rx="1.5" fill="#FFF59D" />
      <Cakes y={34} n={3} />
    </>
  ),
  display_2: (
    <>
      <rect x="8" y="48" width="48" height="8" rx="2" fill="#C9722E" />
      <rect x="10" y="10" width="44" height="38" rx="3" fill="#BFE3F5" opacity="0.85" stroke="#78909C" strokeWidth="1.5" />
      <path d="M10 29h44" stroke="#fff" strokeWidth="2" />
      <Cakes y={19} n={3} />
      <Cakes y={38} n={3} />
    </>
  ),
  display_3: (
    <>
      <rect x="6" y="46" width="52" height="10" rx="2" fill="#F5F0E6" stroke="#E7B23C" strokeWidth="2" />
      <path d="M12 46V24a20 14 0 0 1 40 0v22z" fill="#FFF8E1" opacity="0.85" stroke="#E7B23C" strokeWidth="2" />
      <Cakes y={36} n={3} />
      <path d="M48 12l1.5 3.5L53 17l-3.5 1.5L48 22l-1.5-3.5L43 17l3.5-1.5z" fill="#FFD54F" />
    </>
  ),
  decor_table: <TableArt top="#C9722E" seat="#A0561A" />,
  seat_wood: <TableArt top="#B07A45" seat="#8D5A2B" />,
  seat_iron: <TableArt top="#5B5F66" seat="#3F4349" />,
  seat_sofa: (
    <>
      <rect x="8" y="22" width="48" height="18" rx="7" fill="#E28B9B" stroke="#B84A60" strokeWidth="2" />
      <rect x="6" y="34" width="52" height="14" rx="6" fill="#EFA3B1" stroke="#B84A60" strokeWidth="2" />
      <path d="M12 48v6M52 48v6" stroke="#7A3E12" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  seat_bar: (
    <>
      <rect x="6" y="18" width="52" height="8" rx="3" fill="#6D4C41" />
      <path d="M10 26v12M54 26v12" stroke="#4E342E" strokeWidth="3" />
      {[14, 26, 38, 50].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="40" rx="5" ry="2.5" fill="#A0561A" />
          <path d={`M${x} 42v12`} stroke="#4E342E" strokeWidth="2" />
        </g>
      ))}
    </>
  ),
  decor_neon: (
    <>
      <rect x="6" y="18" width="52" height="28" rx="6" fill="#2B1D3A" stroke="#E28B9B" strokeWidth="2.5" />
      <text x="32" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill="#FFD1DC" fontFamily="Baloo 2, sans-serif">
        Sweet
      </text>
    </>
  ),
  wall_painting: (
    <>
      <rect x="10" y="12" width="44" height="38" rx="3" fill="#FFF6E9" stroke="#A0561A" strokeWidth="3" />
      <path d="M22 40h20l-3-12H25z" fill="#C9722E" />
      <path d="M22 28a10 7 0 0 1 20 0z" fill="#F8BBD0" />
      <circle cx="32" cy="20" r="3" fill="#D32F2F" />
    </>
  ),
  wall_clock: (
    <>
      <circle cx="32" cy="32" r="20" fill="#fff" stroke="#7A3E12" strokeWidth="3.5" />
      <path d="M32 32V19M32 32l9 5" stroke="#4A2B1A" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  wall_shelf: (
    <>
      <rect x="8" y="40" width="48" height="5" rx="2" fill="#A0561A" />
      <path d="M14 45l4 8M50 45l-4 8" stroke="#7A3E12" strokeWidth="2.5" />
      <rect x="14" y="26" width="10" height="14" rx="2" fill="#fff" stroke="#B98F55" />
      <rect x="27" y="24" width="10" height="16" rx="2" fill="#E28B9B" />
      <rect x="40" y="27" width="10" height="13" rx="2" fill="#8FB6E0" />
    </>
  ),
  wall_curtain: (
    <>
      <rect x="14" y="14" width="36" height="34" fill="#9ED3F3" stroke="#fff" strokeWidth="3" />
      <rect x="8" y="10" width="48" height="4" rx="2" fill="#7A3E12" />
      <path d="M10 14h12c-2 12-6 22-12 38z" fill="#E28B9B" />
      <path d="M54 14H42c2 12 6 22 12 38z" fill="#E28B9B" />
    </>
  ),
  decor_plant: <PlantArt big={false} />,
  floor_bigplant: <PlantArt big />,
  floor_rug: (
    <>
      <ellipse cx="32" cy="36" rx="26" ry="16" fill="#E28B9B" />
      <ellipse cx="32" cy="36" rx="19" ry="11" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="4 3" />
    </>
  ),
  floor_cakecase: (
    <>
      <rect x="10" y="40" width="44" height="14" rx="2" fill="#C9722E" />
      <rect x="12" y="14" width="40" height="26" rx="2" fill="#D6EEFB" opacity="0.85" stroke="#90A4AE" strokeWidth="1.5" />
      <Cakes y={30} n={3} />
    </>
  ),
  decor_lamp: (
    <>
      <path d="M32 4v14" stroke="#7A3E12" strokeWidth="2" />
      <path d="M16 32a16 14 0 0 1 32 0z" fill="#E7B23C" stroke="#C9922A" strokeWidth="2" />
      <ellipse cx="32" cy="44" rx="18" ry="8" fill="#FFE9A8" opacity="0.7" />
      <circle cx="32" cy="34" r="4" fill="#FFF6D0" />
    </>
  ),
  ceil_lantern: (
    <>
      <path d="M32 4v10" stroke="#7A3E12" strokeWidth="2" />
      <rect x="24" y="14" width="16" height="4" rx="1" fill="#FFD54F" />
      <ellipse cx="32" cy="32" rx="15" ry="15" fill="#C62828" />
      <path d="M32 17v30M22 20c-4 8-4 16 0 24M42 20c4 8 4 16 0 24" stroke="#8E1B1B" strokeWidth="1.5" />
      <rect x="24" y="46" width="16" height="4" rx="1" fill="#FFD54F" />
      <path d="M32 50v8" stroke="#FFD54F" strokeWidth="2" />
    </>
  ),
  ceil_garland: (
    <>
      <path d="M4 16c14 10 42 10 56 0" stroke="#7A3E12" strokeWidth="1.5" fill="none" />
      {[
        [10, 19, "#E28B9B"],
        [20, 22, "#6FA678"],
        [32, 23, "#E7B23C"],
        [44, 22, "#7C6BD6"],
        [54, 19, "#E28B9B"],
      ].map(([x, y, c]) => (
        <path key={x} d={`M${Number(x) - 5} ${y}h10l-5 12z`} fill={String(c)} />
      ))}
    </>
  ),
};

function Cakes({ y, n }: { y: number; n: number }) {
  const colors = ["#F8BBD0", "#8D6E63", "#FFF3C4"];
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const x = 16 + (i * 32) / Math.max(1, n - 1) - 5;
        return (
          <g key={i}>
            <rect x={x} y={y - 6} width="10" height="7" rx="1.5" fill={colors[i % 3]} />
            <rect x={x} y={y - 8} width="10" height="2.5" rx="1" fill="#FFFAF0" />
            <circle cx={x + 5} cy={y - 9.5} r="1.6" fill="#D32F2F" />
          </g>
        );
      })}
    </>
  );
}

function TableArt({ top, seat }: { top: string; seat: string }) {
  return (
    <>
      <ellipse cx="32" cy="26" rx="18" ry="7" fill={top} />
      <path d="M32 33v16M24 50h16" stroke={seat} strokeWidth="3" strokeLinecap="round" />
      <rect x="4" y="34" width="11" height="6" rx="2" fill={seat} />
      <path d="M6 40v12M13 40v12" stroke={seat} strokeWidth="2" />
      <rect x="49" y="34" width="11" height="6" rx="2" fill={seat} />
      <path d="M51 40v12M58 40v12" stroke={seat} strokeWidth="2" />
    </>
  );
}

function PlantArt({ big }: { big: boolean }) {
  const s = big ? 1.2 : 0.9;
  return (
    <g transform={`translate(32 34) scale(${s}) translate(-32 -34)`}>
      <path d="M22 40h20l-3 16H25z" fill="#C9722E" />
      <circle cx="32" cy="24" r="11" fill="#6FA678" />
      <circle cx="23" cy="31" r="8" fill="#4F8A5C" />
      <circle cx="41" cy="30" r="8" fill="#4F8A5C" />
    </g>
  );
}

/** Mini phòng tiệm theo bảng màu theme + biểu tượng riêng. */
function ThemeArt({ code }: { code: string }) {
  const t = THEMES[code] ?? THEMES.default;
  return (
    <>
      <path d="M4 22 32 8l28 14v14L32 50 4 36z" fill={hex(t.floorA)} />
      <path d="M4 22 32 8v28L4 50z" fill={hex(t.wall)} />
      <path d="M32 8l28 14v28L32 36z" fill={hex(t.wallSide)} />
      <path d="M4 50 32 36l28 14-28 14z" fill={hex(t.floorB)} />
      <rect x="14" y="36" width="16" height="7" rx="2" fill={hex(t.counter)} transform="skewY(-26)" />
      {code === "theme_xmas" && <path d="M46 44l-8 14h16z M46 36l-6 10h12z" fill="#2E7D32" />}
      {code === "theme_midautumn" && <ellipse cx="46" cy="26" rx="6" ry="7" fill="#C62828" />}
      {code === "theme_pastel" && <circle cx="46" cy="26" r="6" fill="#B39DDB" />}
      {code === "theme_wood" && <rect x="40" y="24" width="12" height="9" rx="1" fill="#2E4A3A" stroke="#8D6448" strokeWidth="1.5" />}
    </>
  );
}

/** Mã món đã có ảnh thật ở public/images/store/<mã>.webp (thêm mã vào đây sau khi chạy assets:build). */
const STORE_IMAGES = new Set<string>([]);

export function StoreArt({ code, name, size = 56 }: { code: string; name: string; size?: number }) {
  if (STORE_IMAGES.has(code)) {
    return (
      <div className="thumb" style={{ width: size, height: size }}>
        <img src={`/images/store/${code}.webp`} alt={name} loading="lazy" />
      </div>
    );
  }
  const art = code.startsWith("theme_") || code === "default" ? <ThemeArt code={code} /> : ART[code];
  return (
    <div className="thumb" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width="84%" height="84%" role="img" aria-label={name}>
        {art}
      </svg>
    </div>
  );
}
