"use client";

import { useEffect, useRef } from "react";
import type { IsoShopConfig, SceneCustomer } from "@/game/scenes/IsoShopScene";

type Game = { sync: (l: SceneCustomer[]) => void; setHour: (h: number) => void; destroy: () => void };

/** Bọc Phaser: tạo cảnh 1 lần theo theme/đồ trang trí, đồng bộ khách và giờ game khi thay đổi. */
export function ShopIso({ config, customers }: { config: IsoShopConfig; customers: SceneCustomer[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const latest = useRef({ customers, hour: config.hour });
  const decorKey = config.decor.slice().sort().join(",");

  useEffect(() => {
    latest.current = { customers, hour: config.hour };
    gameRef.current?.sync(customers);
  }, [customers, config.hour]);

  useEffect(() => {
    gameRef.current?.setHour(config.hour);
  }, [config.hour]);

  useEffect(() => {
    if (!parentRef.current) return;
    let cancelled = false;
    const parent = parentRef.current;
    import("@/game/createShopGame").then(({ createShopGame }) => {
      if (cancelled) return;
      const game = createShopGame(parent, { ...config, hour: latest.current.hour });
      gameRef.current = game;
      game.sync(latest.current.customers);
    });
    return () => {
      cancelled = true;
      gameRef.current?.destroy();
      gameRef.current = null;
    };
    // Chỉ tạo lại khi đổi theme / đồ trang trí / ảnh chủ tiệm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.theme, decorKey, config.chefImage]);

  return <div ref={parentRef} style={{ width: "100%", aspectRatio: "1 / 0.8" }} aria-hidden="true" />;
}
