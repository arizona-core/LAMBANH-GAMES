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
