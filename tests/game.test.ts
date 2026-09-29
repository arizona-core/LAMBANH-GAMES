// Unit test cho logic hiển thị ở client. Các công thức phải trùng với server
// (supabase/migrations/20260928000002_game_functions.sql) — test DB nằm ở supabase/tests.
import { describe, expect, it } from "vitest";
import { formatCompact, formatNumber, todayVN } from "@/lib/game/format";
import { levelProgress, xpForLevel } from "@/lib/game/level";
import { marketFee, npcUnitPrice, previewStars, scoreTap, starsForScore } from "@/lib/game/scoring";

describe("scoreTap", () => {
  const zone = { start: 0.4, width: 0.2 };

  it("tâm vùng vàng = 100 điểm", () => {
    expect(scoreTap(0.5, zone)).toBe(100);
  });

  it("mép vùng vàng = 70 điểm", () => {
    expect(scoreTap(0.4, zone)).toBe(70);
    expect(scoreTap(0.6, zone)).toBe(70);
  });

  it("càng xa vùng càng ít điểm, không âm", () => {
    expect(scoreTap(0.2, zone)).toBeLessThan(70);
    expect(scoreTap(0, zone)).toBe(0);
    expect(scoreTap(1, zone)).toBe(0);
  });
});

describe("số sao (trùng public.finish_bake)", () => {
  it.each([
    [100, 5],
    [90, 5],
    [89, 4],
    [75, 4],
    [55, 3],
    [35, 2],
    [34, 1],
    [0, 1],
  ])("điểm %i → %i sao", (score, stars) => {
    expect(starsForScore(score)).toBe(stars);
  });

  it("cộng thưởng lò và làm tròn xuống trung bình", () => {
    expect(previewStars([95, 92, 98])).toBe(5);
    expect(previewStars([80, 80, 81], 10)).toBe(5);
    expect(previewStars([])).toBe(0);
  });
});

describe("giá & phí (trùng server)", () => {
  it("bánh mì 5 sao = 45 xu (khớp test DB)", () => {
    expect(npcUnitPrice(30, 5, 0)).toBe(45);
  });

  it("tủ trưng bày cộng %", () => {
    expect(npcUnitPrice(100, 3, 20)).toBe(120);
  });

  it("phí chợ 5% làm tròn lên", () => {
    expect(marketFee(20)).toBe(1);
    expect(marketFee(100)).toBe(5);
    expect(marketFee(101)).toBe(6);
    expect(marketFee(1)).toBe(1);
  });
});

describe("cấp độ", () => {
  it("ngưỡng XP khớp public._level_for_xp", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(30);
    expect(xpForLevel(10)).toBe(2430);
  });

  it("tiến độ trong khoảng 0..1", () => {
    expect(levelProgress(0, 1)).toBe(0);
    expect(levelProgress(15, 1)).toBe(0.5);
    expect(levelProgress(9999, 1)).toBe(1);
  });
});

describe("định dạng", () => {
  it("phân tách hàng nghìn kiểu Việt Nam", () => {
    expect(formatNumber(2480)).toBe("2.480");
  });

  it("rút gọn số lớn", () => {
    expect(formatCompact(4800)).toBe("4.800");
    expect(formatCompact(18400)).toBe("18,4k");
  });

  it("ngày theo giờ Việt Nam", () => {
    // 2026-09-27 18:00 UTC = 2026-09-28 01:00 giờ VN
    expect(todayVN(new Date("2026-09-27T18:00:00Z"))).toBe("2026-09-28");
  });
});

describe("đồng hồ game (1 giây thật = 1 phút game)", () => {
  it("7:00 mở cửa, 6:59 đóng cửa", async () => {
    const { gameClock, formatGameTime } = await import("@/lib/game/clock");
    expect(gameClock(420_000).open).toBe(true);
    expect(formatGameTime(gameClock(420_000))).toBe("07:00");
    expect(gameClock(419_000).open).toBe(false);
    expect(gameClock(419_000).secondsToOpen).toBe(1);
  });

  it("ngày game dài 24 phút thật", async () => {
    const { gameClock } = await import("@/lib/game/clock");
    expect(gameClock(1440_000).minuteOfDay).toBe(0);
    expect(gameClock(1439_000).secondsToClose).toBe(1);
  });
});

describe("mô tả đơn", () => {
  it("ghép món · sốt · topping", async () => {
    const { orderText } = await import("@/lib/game/orders");
    expect(orderText({ recipe_name: "Bánh mì", sauce_name: "Sốt bơ tỏi", topping_name: null })).toBe(
      "Bánh mì · sốt bơ tỏi · không topping",
    );
  });
});

describe("lượng khách theo giờ (trùng public._traffic_mult)", () => {
  it("trưa & tối là cao điểm, chiều vắng, đêm đóng cửa", async () => {
    const { trafficLevel } = await import("@/lib/game/clock");
    expect(trafficLevel(12 * 60)).toBe("rush");
    expect(trafficLevel(19 * 60)).toBe("rush");
    expect(trafficLevel(14 * 60)).toBe("quiet");
    expect(trafficLevel(8 * 60)).toBe("normal");
    expect(trafficLevel(3 * 60)).toBe("closed");
  });

  it("báo giờ cao điểm kế tiếp", async () => {
    const { nextRush } = await import("@/lib/game/clock");
    expect(nextRush(9 * 60)).toEqual({ start: 660, end: 780, inSeconds: 120 });
    expect(nextRush(14 * 60)?.start).toBe(1080);
    expect(nextRush(23 * 60)?.start).toBe(660);
    expect(nextRush(12 * 60)).toBeNull();
  });
});

describe("độ khó mini-game theo cấp mở khoá món", () => {
  it("cấp 1 dễ nhất, tăng mỗi 3 cấp, tối đa 9", async () => {
    const { recipeDifficulty } = await import("@/lib/game/orders");
    expect(recipeDifficulty(1)).toBe(1);
    expect(recipeDifficulty(3)).toBe(1);
    expect(recipeDifficulty(4)).toBe(2);
    expect(recipeDifficulty(25)).toBe(9);
    expect(recipeDifficulty(99)).toBe(9);
  });
});

describe("nhiệm vụ hằng ngày", () => {
  const q = (code: string, progress: number, target: number, claimed = false) => ({
    code, title: code, description: "", target, progress, reward_coins: 0, reward_gems: 0, reward_xp: 0, claimed,
  });

  it("xếp: nhận được ngay → đang làm (gần xong trước) → đã nhận", async () => {
    const { sortQuests } = await import("@/lib/game/quests");
    const sorted = sortQuests([q("claimed", 3, 3, true), q("half", 1, 2), q("ready", 5, 5), q("little", 1, 10)]);
    expect(sorted.map((x) => x.code)).toEqual(["ready", "half", "little", "claimed"]);
  });
});
