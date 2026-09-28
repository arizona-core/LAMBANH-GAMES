"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { IconCheck } from "@/components/icons";
import { useAction } from "@/components/useAction";
import { AVATARS, SHOP_COLORS, type Avatar as AvatarKey, type ShopColor } from "@/lib/game/constants";
import { createClient } from "@/lib/supabase/client";

// Gần giống public._slugify (server mới là nơi quyết định tên có hợp lệ/trùng không).
function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type NameState = "idle" | "checking" | "free" | "taken" | "invalid";

export function OnboardingForm({ suggestedOwner }: { suggestedOwner: string }) {
  const router = useRouter();
  const { run, busy } = useAction("create-profile");
  const [ownerName, setOwnerName] = useState(suggestedOwner);
  const [shopName, setShopName] = useState("");
  const [avatar, setAvatar] = useState<AvatarKey>("a1");
  const [color, setColor] = useState<ShopColor>("caramel");
  // Kết quả kiểm tra trùng tên gần nhất từ server (theo slug).
  const [checked, setChecked] = useState<{ slug: string; taken: boolean } | null>(null);

  const slug = slugify(shopName);
  const validLocally = shopName.trim().length >= 3 && slug.length > 0;
  const nameState: NameState = !shopName.trim()
    ? "idle"
    : !validLocally
      ? "invalid"
      : checked?.slug !== slug
        ? "checking"
        : checked.taken
          ? "taken"
          : "free";

  useEffect(() => {
    if (!validLocally) return;
    let active = true;
    const t = setTimeout(async () => {
      const { data } = await createClient().from("public_profiles").select("id").eq("slug", slug).maybeSingle();
      if (active) setChecked({ slug, taken: !!data });
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [slug, validLocally]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run({ ownerName, shopName, avatar, color }, { refresh: false });
    if (res) {
      router.replace("/shop?welcome=1");
      router.refresh();
    }
  }

  const canSubmit = ownerName.trim().length >= 2 && nameState === "free" && !busy;

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 18, flex: 1 }}>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: 8 }}>
          Chọn ảnh đại diện
        </legend>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          {AVATARS.map((a, i) => (
            <label key={a} style={{ cursor: "pointer", position: "relative" }}>
              <input
                type="radio"
                name="avatar"
                value={a}
                checked={avatar === a}
                onChange={() => setAvatar(a)}
                className="sr-only"
                aria-label={`Avatar ${i + 1}`}
              />
              <Avatar avatar={a} size={54} ring={avatar === a ? "var(--primary)" : "transparent"} />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="owner">Tên chủ quán</label>
        <input
          id="owner"
          className="input"
          value={ownerName}
          maxLength={24}
          autoComplete="nickname"
          onChange={(e) => setOwnerName(e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="shop">Tên quán</label>
        <input
          id="shop"
          className="input"
          value={shopName}
          maxLength={32}
          placeholder="Tiệm Bánh Nắng"
          onChange={(e) => setShopName(e.target.value)}
          aria-describedby="shop-hint"
          required
        />
        <span id="shop-hint" aria-live="polite" className={`hint ${nameState === "free" ? "hint--ok" : nameState === "taken" || nameState === "invalid" ? "hint--bad" : ""}`}>
          {nameState === "idle" && "3–32 ký tự, không trùng với quán khác."}
          {nameState === "checking" && "Đang kiểm tra…"}
          {nameState === "free" && `Tên còn trống · sweetshop.game/${slug}`}
          {nameState === "taken" && "Tên này đã có quán dùng."}
          {nameState === "invalid" && "Tên quán cần ít nhất 3 ký tự chữ/số."}
        </span>
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: 8 }}>
          Màu chủ đạo của quán
        </legend>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          {(Object.keys(SHOP_COLORS) as ShopColor[]).map((c) => (
            <label key={c} style={{ cursor: "pointer" }} title={SHOP_COLORS[c].label}>
              <input
                type="radio"
                name="color"
                value={c}
                checked={color === c}
                onChange={() => setColor(c)}
                className="sr-only"
                aria-label={SHOP_COLORS[c].label}
              />
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: SHOP_COLORS[c].hex,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  boxShadow: color === c ? "0 0 0 3px var(--bg-cream), 0 0 0 5px var(--ink-strong)" : "none",
                }}
              >
                {color === c && <IconCheck size={18} />}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="spacer" />
      <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={!canSubmit}>
        {busy ? "Đang mở tiệm…" : "Mở tiệm ngay"}
      </button>
    </form>
  );
}
