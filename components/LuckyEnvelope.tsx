// Bao lì xì vẽ bằng SVG: thân đỏ, viền vàng, nắp gập, dấu tròn chữ "Lộc".
// open = nắp lật lên (dùng khi mở bao).

export function LuckyEnvelope({ size = 72, open = false }: { size?: number; open?: boolean }) {
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 100 130" aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <rect x="6" y="10" width="88" height="114" rx="10" fill="#B3261E" />
      <rect x="6" y="10" width="88" height="114" rx="10" fill="none" stroke="#E7B23C" strokeWidth="4" />
      <rect x="14" y="18" width="72" height="98" rx="6" fill="none" stroke="#E7B23C" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
      {/* Hoa văn mây góc dưới */}
      <path d="M20 108c4-6 12-6 14 0M66 108c4-6 12-6 14 0" fill="none" stroke="#E7B23C" strokeWidth="2" strokeLinecap="round" />
      {/* Nắp gập */}
      <path
        d={open ? "M6 20 50 -18 94 20Z" : "M6 20 50 54 94 20Z"}
        fill="#C9372C"
        stroke="#E7B23C"
        strokeWidth="3"
        strokeLinejoin="round"
        style={{ transition: "d .35s ease" }}
      />
      {/* Dấu "Lộc" */}
      <circle cx="50" cy="70" r="17" fill="#E7B23C" stroke="#C9922A" strokeWidth="2" />
      <text
        x="50"
        y="76"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontWeight="700"
        fontSize="16"
        fill="#8B1A12"
      >
        Lộc
      </text>
    </svg>
  );
}
