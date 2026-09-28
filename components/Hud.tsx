import Link from "next/link";
import { formatNumber } from "@/lib/game/format";
import { levelProgress } from "@/lib/game/level";
import { SHOP_COLORS, type ShopColor } from "@/lib/game/constants";
import type { Profile } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CoinIcon, GemIcon } from "./icons";

export function Hud({ profile }: { profile: Profile }) {
  const progress = levelProgress(profile.xp, profile.level);
  const ring = SHOP_COLORS[profile.color as ShopColor]?.hex;
  return (
    <div className="hud">
      <Link href="/settings" className="hud__shop" aria-label="Hồ sơ & cài đặt">
        <Avatar avatar={profile.avatar} ring={ring} />
        <div style={{ minWidth: 0 }}>
          <div className="hud__name">{profile.shop_name}</div>
          <div className="row" style={{ gap: 6, marginTop: 3 }}>
            <span className="badge">Lv.{profile.level}</span>
            <span className="xpbar" role="progressbar" aria-label="Kinh nghiệm" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${progress * 100}%` }} />
            </span>
          </div>
        </div>
      </Link>
      <div className="row" style={{ gap: 8 }}>
        <span className="pill" aria-label={`${profile.coins} xu`}>
          <CoinIcon />
          {formatNumber(profile.coins)}
        </span>
        <span className="pill" style={{ paddingLeft: 8 }} aria-label={`${profile.gems} gem`}>
          <GemIcon />
          {formatNumber(profile.gems)}
        </span>
      </div>
    </div>
  );
}
