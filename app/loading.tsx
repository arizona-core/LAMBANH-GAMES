// Màn chờ (Splash) — hiển thị khi chuyển trang đang tải dữ liệu server.
export default function Loading() {
  return (
    <div
      className="app"
      style={{ background: "#F6D9A8", alignItems: "center", justifyContent: "center", gap: 18 }}
      aria-busy="true"
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 32,
          background: "#fff",
          boxShadow: "0 8px 0 #E3B77B",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="80" height="80" viewBox="0 0 96 96" aria-hidden="true">
          <path d="M22 52h52l-8 30a6 6 0 0 1-6 5H36a6 6 0 0 1-6-5z" fill="#D98A3D" />
          <path d="M30 60h36M34 74h28" stroke="#9C5A1E" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M48 16c10 0 14 8 14 8s10-2 12 8c8 2 6 14-2 16H24c-9-2-10-14-1-16 1-9 11-9 13-7 2-8 8-9 12-9z"
            fill="#E28B9B"
          />
          <circle cx="48" cy="20" r="6" fill="#C64C63" />
        </svg>
      </div>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, color: "#7A3E12", margin: 0 }}>
        Sweet Shop
      </p>
      <p className="muted" style={{ margin: 0, fontWeight: 700 }}>
        Đang mở cửa tiệm…
      </p>
    </div>
  );
}
