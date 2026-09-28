"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { useAction } from "@/components/useAction";
import { RENAME_COST_GEMS } from "@/lib/game/constants";
import { createClient } from "@/lib/supabase/client";

const PREFS_KEY = "sweetshop.prefs.v1";
type Prefs = { sound: boolean; music: boolean; notifications: boolean };
const DEFAULT_PREFS: Prefs = { sound: true, music: true, notifications: false };

export function SettingsView({ gems, email }: { gems: number; email: string }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      // Chỉ đọc được localStorage sau khi mount ở browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(saved) });
    } catch {}
  }, []);

  function toggle(key: keyof Prefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {}
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <section className="card stack" aria-label="Tùy chọn">
        {(
          [
            ["sound", "Âm thanh"],
            ["music", "Nhạc nền"],
            ["notifications", "Thông báo"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="row" style={{ justifyContent: "space-between", fontWeight: 800, cursor: "pointer" }}>
            {label}
            <input type="checkbox" role="switch" checked={prefs[key]} onChange={() => toggle(key)} style={{ width: 22, height: 22, accentColor: "var(--primary)" }} />
          </label>
        ))}
        <div className="row" style={{ justifyContent: "space-between", fontWeight: 800 }}>
          Ngôn ngữ <span className="muted">Tiếng Việt</span>
        </div>
      </section>

      <button type="button" className="btn btn--soft btn--block" onClick={() => setRenaming(true)}>
        Đổi tên quán · {RENAME_COST_GEMS} gem
      </button>

      <div className="spacer" />
      <p className="small muted" style={{ textAlign: "center", margin: 0, fontWeight: 700 }}>
        Đăng nhập: {email}
      </p>
      <button type="button" className="btn btn--danger btn--block" onClick={signOut}>
        Đăng xuất
      </button>

      {renaming && <RenameModal gems={gems} onClose={() => setRenaming(false)} />}
    </>
  );
}

function RenameModal({ gems, onClose }: { gems: number; onClose: () => void }) {
  const { run, busy } = useAction("rename-shop");
  const [name, setName] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run({ shopName: name }, { success: () => "Đã đổi tên quán!" });
    if (res) onClose();
  }

  return (
    <Modal title="Đổi tên quán" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="field">
          <label htmlFor="rename">Tên quán mới</label>
          <input id="rename" className="input" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} required />
        </div>
        <p className="hint" style={{ margin: 0 }}>
          Phí {RENAME_COST_GEMS} gem · bạn đang có {gems} gem
        </p>
        <button type="submit" className="btn btn--gem btn--block btn--lg" disabled={busy || gems < RENAME_COST_GEMS || name.trim().length < 3}>
          {busy ? "Đang đổi…" : "Xác nhận"}
        </button>
      </form>
    </Modal>
  );
}
