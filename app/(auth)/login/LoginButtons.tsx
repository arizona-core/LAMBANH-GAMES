"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

export function LoginButtons({ devLogin }: { devLogin: boolean }) {
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setBusy(false);
  }

  return (
    <>
      <button type="button" className="btn btn--white btn--block btn--lg" onClick={signInWithGoogle} disabled={busy}>
        <GoogleIcon />
        Đăng nhập bằng Google
      </button>
      {devLogin && <DevLogin />}
    </>
  );
}

// CHỈ hiện khi `npm run dev`: đăng nhập email/mật khẩu với Supabase local để thử game
// khi chưa cấu hình Google OAuth. Production chỉ có Google (tắt Email provider).
function DevLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("dev1@sweetshop.local");
  const [password, setPassword] = useState("devpassword");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = createClient();
    let { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) ({ error } = await supabase.auth.signUp({ email, password }));
    if (error) return setMsg(error.message);
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card stack" style={{ gap: 8, border: "2px dashed var(--border)" }}>
      <span className="small" style={{ fontWeight: 800 }}>
        Đăng nhập dev (chỉ ở local)
      </span>
      <label className="sr-only" htmlFor="dev-email">
        Email
      </label>
      <input id="dev-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="sr-only" htmlFor="dev-password">
        Mật khẩu
      </label>
      <input
        id="dev-password"
        className="input"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {msg && <span className="hint hint--bad">{msg}</span>}
      <button className="btn btn--soft btn--block" type="submit">
        Vào game (dev)
      </button>
    </form>
  );
}
