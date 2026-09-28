import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app" style={{ alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", gap: 12 }}>
      <h1 style={{ fontSize: 28 }}>Không tìm thấy trang</h1>
      <p className="muted" style={{ margin: 0, fontWeight: 700 }}>
        Có vẻ chiếc bánh này chưa có trong thực đơn.
      </p>
      <Link href="/" className="btn btn--primary btn--lg" style={{ marginTop: 8 }}>
        Về tiệm
      </Link>
    </main>
  );
}
