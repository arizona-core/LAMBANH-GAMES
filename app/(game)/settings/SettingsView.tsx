"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { IconCheck } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { useAction } from "@/components/useAction";
import { AVATARS, RENAME_COST_GEMS, SHOP_COLORS, type Avatar as AvatarKey, type ShopColor } from "@/lib/game/constants";
import { createClient } from "@/lib/supabase/client";

const PREFS_KEY = "sweetshop.prefs.v1";
type Prefs = { sound: boolean; music: boolean; notifications: boolean };
const DEFAULT_PREFS: Prefs = { sound: true, music: true, notifications: false };

export function SettingsView({ gems, email, avatar, color }: { gems: number; email: string; avatar: string; color: string }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState(false);
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

      <button type="button" className="btn btn--soft btn--block" onClick={() => setEditingAvatar(true)}>
        Đổi ảnh đại diện &amp; màu quán · miễn phí
      </button>
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
      {editingAvatar && (
        <AvatarModal current={avatar as AvatarKey} currentColor={color as ShopColor} onClose={() => setEditingAvatar(false)} />
      )}
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

function AvatarModal({
  current,
  currentColor,
  onClose,
}: {
  current: AvatarKey;
  currentColor: ShopColor;
  onClose: () => void;
}) {
  const { run, busy } = useAction("update-avatar");
  const [avatar, setAvatar] = useState<AvatarKey>(current);
  const [color, setColor] = useState<ShopColor>(currentColor);

  async function save() {
    const res = await run({ avatar, color }, { success: () => "Đã cập nhật ảnh đại diện!" });
    if (res) onClose();
  }

  return (
    <Modal title="Ảnh đại diện & màu quán" onClose={onClose}>
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }} role="radiogroup" aria-label="Ảnh đại diện">
        {AVATARS.map((a, i) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={avatar === a}
            aria-label={`Avatar ${i + 1}`}
            onClick={() => setAvatar(a)}
            style={{ border: 0, background: "none", padding: 2, cursor: "pointer" }}
          >
            <Avatar avatar={a} size={56} ring={avatar === a ? "var(--primary)" : "transparent"} />
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }} role="radiogroup" aria-label="Màu quán">
        {(Object.keys(SHOP_COLORS) as ShopColor[]).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={SHOP_COLORS[c].label}
            onClick={() => setColor(c)}
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: 0,
              cursor: "pointer",
              background: SHOP_COLORS[c].hex,
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: color === c ? "0 0 0 3px var(--bg-cream), 0 0 0 5px var(--ink-strong)" : "none",
            }}
          >
            {color === c && <IconCheck size={16} />}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--primary btn--block btn--lg" onClick={save} disabled={busy}>
        {busy ? "Đang lưu…" : "Lưu"}
      </button>
    </Modal>
  );
}
