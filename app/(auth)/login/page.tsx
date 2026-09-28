/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/supabase/server";
import { LoginButtons } from "./LoginButtons";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { user } = await getCurrentPlayer();
  if (user) redirect("/");
  const { error, reason } = await searchParams;
  const reasonText = typeof reason === "string" ? reason : null;

  return (
    <main className="app" style={{ background: "#F6D9A8" }}>
      <div className="screen" style={{ alignItems: "center", justifyContent: "space-between", padding: "56px 28px 36px" }}>
        <div className="stack" style={{ alignItems: "center", textAlign: "center", gap: 14 }}>
          <img src="/images/cake-shop-hero.webp" alt="" width={200} height={236} style={{ objectFit: "contain" }} />
          <h1 style={{ fontSize: 40 }}>Sweet Shop</h1>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 20, color: "#7A3E12" }}>Chào mừng, đầu bếp!</p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
            Đăng nhập để lưu tiệm bánh của bạn và cạnh tranh với người chơi khác.
          </p>
        </div>

        <div className="stack" style={{ width: "100%", gap: 14 }}>
          {error && (
            <p role="alert" className="hint hint--bad" style={{ textAlign: "center" }}>
              Đăng nhập chưa thành công, thử lại nhé.
              {reasonText && (
                <>
                  <br />
                  <span style={{ fontWeight: 600 }}>Chi tiết: {reasonText}</span>
                </>
              )}
            </p>
          )}
          <LoginButtons devLogin={process.env.NODE_ENV === "development"} />
          <p className="small muted" style={{ textAlign: "center", margin: 0 }}>
            Bằng việc tiếp tục, bạn đồng ý với Điều khoản &amp; Chính sách bảo mật.
          </p>
        </div>
      </div>
    </main>
  );
}
