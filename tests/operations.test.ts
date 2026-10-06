// Unit test hiển thị cho vận hành tiệm (hóa đơn, vệ sinh, thanh tra). Công thức trùng server
// (supabase/migrations/20260928000018_shop_operations.sql) — test DB ở supabase/tests/database/operations.test.sql.
import { describe, expect, it } from "vitest";
import {
  billUsage,
  cleanWater,
  formatDay,
  formatDeadline,
  hygieneLevel,
  inspectionProgress,
  inspectionRevealed,
  totalOwed,
} from "@/lib/game/operations";

describe("vệ sinh (trùng public._run_inspection / _clean_water)", () => {
  it.each([
    [100, "clean"],
    [70, "clean"],
    [69, "dirty"],
    [40, "dirty"],
    [39, "filthy"],
    [0, "filthy"],
  ] as const)("%i%% → %s", (h, level) => {
    expect(hygieneLevel(h)).toBe(level);
  });

  it("nước dọn dẹp = 2 + phần thiếu / 5 m³", () => {
    expect(cleanWater(100)).toBe(2);
    expect(cleanWater(30)).toBe(16);
    expect(cleanWater(0)).toBe(22);
    expect(cleanWater(-5)).toBe(22);
  });
});

describe("hóa đơn", () => {
  it("mô tả lượng dùng theo loại", () => {
    expect(billUsage({ kind: "rent", units: 1, base: 0, note: null })).toBe("1 ngày bán hàng");
    expect(billUsage({ kind: "electric", units: 24, base: 0, note: null })).toBe("24 kWh");
    expect(billUsage({ kind: "water", units: 1500, base: 0, note: null })).toBe("1.500 m³");
    expect(billUsage({ kind: "tax", units: 3, base: 12000, note: null })).toBe("5% × 12.000 ₵ doanh thu");
    expect(billUsage({ kind: "fine", units: 1, base: 0, note: "Phạt vi phạm an toàn thực phẩm" })).toBe(
      "Phạt vi phạm an toàn thực phẩm",
    );
  });

  it("tổng còn phải đóng", () => {
    expect(totalOwed([{ owed: 60 }, { owed: 12 }, { owed: 0 }])).toBe(72);
    expect(totalOwed([])).toBe(0);
  });

  it("ngày và hạn đóng theo giờ Việt Nam", () => {
    expect(formatDay("2026-10-05")).toBe("05/10");
    // Hạn 0:00 ngày 07/10 (giờ VN) = 17:00 UTC ngày 06/10 → hiển thị "hết ngày 06/10".
    expect(formatDeadline("2026-10-06T17:00:00Z")).toBe("23:59 06/10");
  });
});

describe("thanh tra", () => {
  const i = { created_at: "2026-10-06T08:00:00Z", reveal_at: "2026-10-06T08:00:20Z" };
  const t = (s: number) => new Date("2026-10-06T08:00:00Z").getTime() + s * 1000;

  it("20 giây đầu đang kiểm tra, sau đó công bố kết quả", () => {
    expect(inspectionRevealed(i, t(5))).toBe(false);
    expect(inspectionRevealed(i, t(20))).toBe(true);
  });

  it("tiến độ kiểm tra 0..1", () => {
    expect(inspectionProgress(i, t(-3))).toBe(0);
    expect(inspectionProgress(i, t(10))).toBeCloseTo(0.5);
    expect(inspectionProgress(i, t(99))).toBe(1);
  });
});
