import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mất kết nối" };

// Trang tĩnh được service worker cache sẵn, hiển thị khi mất mạng.
export default function OfflinePage() {
  return (
    <main className="app" style={{ alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", gap: 12 }}>
      <h1 style={{ fontSize: 28 }}>Mất kết nối</h1>
      <p className="muted" style={{ margin: 0, fontWeight: 700, lineHeight: 1.5 }}>
        Sweet Shop cần mạng để lưu tiệm và giao dịch với người chơi khác. Kiểm tra kết nối rồi thử lại nhé.
      </p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- tải lại toàn trang khi có mạng */}
      <a href="/" className="btn btn--primary btn--lg" style={{ marginTop: 8 }}>
        Thử lại
      </a>
    </main>
  );
}
