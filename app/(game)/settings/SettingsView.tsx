"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { InstallAppButton } from "@/components/InstallAppButton";
import { IconCheck } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { useAction } from "@/components/useAction";
import { callAction } from "@/lib/api/actions";
import { AVATAR_BUCKET } from "@/lib/game/avatar";
import { AVATARS, RENAME_COST_GEMS, SHOP_COLORS, type AvatarKind, type ShopColor } from "@/lib/game/constants";
import { errorMessage } from "@/lib/game/errors";
import { squareWebp } from "@/lib/game/imageResize";
import { useToast } from "@/lib/store/toast";
import { createClient } from "@/lib/supabase/client";

const PREFS_KEY = "sweetshop.prefs.v1";
type Prefs = { sound: boolean; music: boolean; notifications: boolean };
const DEFAULT_PREFS: Prefs = { sound: true, music: true, notifications: false };

export function SettingsView({
  gems,
  email,
  avatar,
  avatarUrl,
  color,
  bio,
  userId,
  slug,
}: {
  gems: number;
  email: string;
  avatar: string;
  avatarUrl: string | null;
  color: string;
  bio: string;
  userId: string;
  slug: string;
}) {
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

      <BioEditor initial={bio} slug={slug} />
      <InstallAppButton />
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
        <AvatarModal
          current={avatar as AvatarKind}
          currentPhoto={avatarUrl}
          currentColor={color as ShopColor}
          userId={userId}
          onClose={() => setEditingAvatar(false)}
        />
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

function BioEditor({ initial, slug }: { initial: string; slug: string }) {
  const { run, busy } = useAction("update-bio");
  const [bio, setBio] = useState(initial);
  const changed = bio.trim() !== initial.trim();
  return (
    <section className="card stack" style={{ gap: 8 }} aria-label="Tiểu sử quán">
      <label htmlFor="bio" style={{ fontWeight: 800 }}>
        Tiểu sử quán
      </label>
      <textarea
        id="bio"
        className="input"
        style={{ minHeight: 80, padding: 10, resize: "vertical" }}
        maxLength={200}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Giới thiệu tiệm của bạn: món tủ, giờ mở cửa, lời chào khách…"
      />
      <div className="row">
        <span className="small muted" style={{ fontWeight: 700 }}>
          {bio.length}/200 · hiện trên hồ sơ công khai
        </span>
        <span className="spacer" />
        <Link href={`/players/${slug}`} className="btn btn--white btn--sm">
          Xem hồ sơ
        </Link>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={busy || !changed}
          onClick={() => run({ bio }, { success: () => "Đã lưu tiểu sử quán!" })}
        >
          Lưu
        </button>
      </div>
    </section>
  );
}

function AvatarModal({
  current,
  currentPhoto,
  currentColor,
  userId,
  onClose,
}: {
  current: AvatarKind;
  currentPhoto: string | null;
  currentColor: ShopColor;
  userId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const push = useToast((s) => s.push);
  const { run, busy } = useAction("update-avatar");
  const [avatar, setAvatar] = useState<AvatarKind>(current);
  const [color, setColor] = useState<ShopColor>(currentColor);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    const res = await run({ avatar, color }, { success: () => "Đã cập nhật ảnh đại diện!" });
    if (res) onClose();
  }

  // Tải ảnh cá nhân: thu nhỏ ở máy → Storage (thư mục của mình) → server đặt làm avatar và xoá ảnh cũ.
  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return push("Hãy chọn một file ảnh.", "error");
    if (file.size > 15 * 1024 * 1024) return push("Ảnh quá lớn (tối đa 15 MB).", "error");
    setUploading(true);
    try {
      const blob = await squareWebp(file, 256);
      const path = `${userId}/${Date.now()}.webp`;
      const { error } = await createClient()
        .storage.from(AVATAR_BUCKET)
        .upload(path, blob, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
      if (error) return push("Tải ảnh thất bại, thử lại nhé.", "error");
      const res = await callAction("set-avatar-photo", { path });
      if (!res.ok) return push(errorMessage(res.error), "error");
      push("Đã đổi ảnh đại diện!", "success");
      router.refresh();
      onClose();
    } catch {
      push("Không đọc được ảnh này, thử ảnh khác nhé.", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal title="Ảnh đại diện & màu quán" onClose={onClose}>
      <div className="row" style={{ gap: 10 }}>
        <Avatar avatar={avatar} photo={currentPhoto} size={64} ring={SHOP_COLORS[color].hex} />
        <div className="stack" style={{ gap: 6, flex: 1 }}>
          <button type="button" className="btn btn--primary btn--sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Đang tải ảnh…" : "Tải ảnh của bạn lên"}
          </button>
          <span className="small muted" style={{ fontWeight: 700 }}>
            Ảnh được cắt vuông, thu nhỏ còn 256×256. Ảnh cũ sẽ tự xoá.
          </span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Chọn ảnh đại diện"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f);
          }}
        />
      </div>
      <p className="small" style={{ margin: 0, fontWeight: 800 }}>
        Hoặc chọn avatar có sẵn:
      </p>
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }} role="radiogroup" aria-label="Ảnh đại diện">
        {currentPhoto && (
          <button
            type="button"
            role="radio"
            aria-checked={avatar === "custom"}
            aria-label="Ảnh của bạn"
            onClick={() => setAvatar("custom")}
            style={{ border: 0, background: "none", padding: 2, cursor: "pointer" }}
          >
            <Avatar avatar="custom" photo={currentPhoto} size={56} ring={avatar === "custom" ? "var(--primary)" : "transparent"} />
          </button>
        )}
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
