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
  const art = FALLBACK_ART[code];
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
