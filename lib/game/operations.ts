// Vận hành tiệm: hóa đơn (tiền nhà, điện, nước), thuế, vệ sinh, thanh tra, lì xì.
// Kiểu dữ liệu khớp các hàm SQL ở migration 0018 + nhãn hiển thị. Số tiền, tiền phạt, phần thưởng
// đều do SERVER quyết định; các công thức dưới đây chỉ để HIỂN THỊ trước (comment "trùng server").
import { formatNumber } from "./format";
import type { CookMethod } from "./orders";

// ---------------------------------------------------------------------------
// Hóa đơn
// ---------------------------------------------------------------------------

export type BillKind = "rent" | "electric" | "water" | "tax" | "fine";

export const BILL_KINDS: Record<BillKind, string> = {
  rent: "Tiền nhà",
  electric: "Tiền điện",
  water: "Tiền nước",
  tax: "Thuế kinh doanh",
  fine: "Tiền phạt",
};

export type Bill = {
  id: string;
  kind: BillKind;
  /** Ngày phát sinh (YYYY-MM-DD, giờ VN). */
  day: string;
  units: number;
  /** Doanh thu chịu thuế (chỉ hóa đơn thuế). */
  base: number;
  amount: number;
  late_fee: number;
  paid: number;
  /** Còn phải đóng = amount + late_fee − paid. */
  owed: number;
  status: "open" | "due" | "paid" | "audited";
  /** Bị tự trừ vì quá hạn. */
  autopaid: boolean;
  due_at: string | null;
  overdue: boolean;
  note: string | null;
  paid_at: string | null;
  inspection_id: string | null;
};

export type OpsRates = {
  rent: number;
  electric_price: number;
  water_price: number;
  tax_pct: number;
  late_fee_pct: number;
  electric_units: Record<CookMethod, number>;
  water_units: Record<CookMethod, number>;
};

export type BillsSummary = { count: number; owed: number; overdue: number; tax_overdue: number };

/** Kết quả get-bills (public.get_bills). */
export type BillsData = {
  day: string;
  coins: number;
  hygiene: number;
  /** m³ nước để dọn tiệm lên 100%. */
  clean_water: number;
  /** Xu vừa bị tự trừ cho hóa đơn quá hạn. */
  autopaid: number;
  rates: OpsRates;
  today: Bill[];
  due: Bill[];
  history: Bill[];
  inspections: Inspection[];
};

/** Dòng mô tả lượng dùng: "12 kWh", "5% × 1.200 ₵"… */
export function billUsage(b: Pick<Bill, "kind" | "units" | "base" | "note">, taxPct = 5): string {
  switch (b.kind) {
    case "rent":
      return "1 ngày bán hàng";
    case "electric":
      return `${formatNumber(b.units)} kWh`;
    case "water":
      return `${formatNumber(b.units)} m³`;
    case "tax":
      return `${taxPct}% × ${formatNumber(b.base)} ₵ doanh thu`;
    case "fine":
      return b.note ?? "Biên bản thanh tra";
  }
}

export function totalOwed(bills: Pick<Bill, "owed">[]): number {
  return bills.reduce((sum, b) => sum + b.owed, 0);
}

/** "2026-10-05" → "05/10" */
export function formatDay(day: string): string {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}

const DEADLINE = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  hour12: false,
});

/** Hạn đóng hiển thị theo giờ VN: hạn lúc 0:00 → "23:59 06/10" (hết ngày hôm trước). */
export function formatDeadline(iso: string): string {
  const parts = Object.fromEntries(DEADLINE.formatToParts(new Date(new Date(iso).getTime() - 60_000)).map((p) => [p.type, p.value]));
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}`;
}

// ---------------------------------------------------------------------------
// Vệ sinh — ngưỡng trùng server (_run_inspection, _poison_chance, _clean_water)
// ---------------------------------------------------------------------------

/** Từ mức này trở lên thanh tra chấm đạt. */
export const HYGIENE_OK = 70;
/** Dưới mức này khách dễ bị ngộ độc hơn. */
export const HYGIENE_RISK = 50;
/** Dưới mức này thanh tra lập biên bản phạt. */
export const HYGIENE_FINE = 40;

export type HygieneLevel = "clean" | "dirty" | "filthy";

export function hygieneLevel(h: number): HygieneLevel {
  if (h >= HYGIENE_OK) return "clean";
  if (h >= HYGIENE_FINE) return "dirty";
  return "filthy";
}

export const HYGIENE_LABEL: Record<HygieneLevel, string> = {
  clean: "Sạch sẽ",
  dirty: "Hơi bẩn",
  filthy: "Bẩn — dễ bị phạt",
};

/** m³ nước để dọn tiệm lên 100% — trùng public._clean_water. */
export function cleanWater(hygiene: number): number {
  return 2 + Math.floor((100 - Math.max(0, Math.min(100, hygiene))) / 5);
}

// ---------------------------------------------------------------------------
// Thanh tra
// ---------------------------------------------------------------------------

export type InspectionFinding = { text: string; fine: number };

export type Inspection = {
  id: string;
  kind: "food" | "tax";
  result: "pass" | "warning" | "fined";
  inspector: string;
  hygiene: number | null;
  findings: InspectionFinding[];
  fine: number;
  reputation_delta: number;
  created_at: string;
  /** Trước lúc này client hiện "đang kiểm tra". */
  reveal_at: string;
  fine_bill: { id: string; status: Bill["status"]; owed: number; due_at: string | null } | null;
};

export const INSPECTION_KINDS: Record<Inspection["kind"], string> = {
  food: "Thanh tra an toàn thực phẩm",
  tax: "Kiểm tra thuế",
};

export const INSPECTION_RESULTS: Record<Inspection["result"], string> = {
  pass: "Đạt",
  warning: "Nhắc nhở",
  fined: "Phạt",
};

/** Cán bộ thanh tra ở lại trong cảnh tiệm bao lâu kể từ lúc tới. */
export const INSPECTOR_STAY_MS = 35_000;

export function inspectionRevealed(i: Pick<Inspection, "reveal_at">, serverNow: number): boolean {
  return serverNow >= new Date(i.reveal_at).getTime();
}

/** Phần khung "đang kiểm tra" đã trôi qua (0..1). */
export function inspectionProgress(i: Pick<Inspection, "created_at" | "reveal_at">, serverNow: number): number {
  const start = new Date(i.created_at).getTime();
  const end = new Date(i.reveal_at).getTime();
  return end > start ? Math.max(0, Math.min(1, (serverNow - start) / (end - start))) : 1;
}

// ---------------------------------------------------------------------------
// Nhịp khách (customer-tick → ops)
// ---------------------------------------------------------------------------

export type OpsTick = {
  hygiene: number;
  coins: number;
  autopaid: number;
  bills: BillsSummary;
  /** Lần thanh tra gần nhất trong 3 phút (null nếu không có). */
  inspection: Inspection | null;
  envelopes_new: number;
  envelopes_unopened: number;
};

// ---------------------------------------------------------------------------
// Lì xì
// ---------------------------------------------------------------------------

export type EnvelopeMilestone = {
  code: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  earned: boolean;
};

export type Envelope = { id: string; source: string; title: string; day: string; created_at: string };

export type OpenedEnvelope = {
  id: string;
  title: string;
  coins: number;
  gems: number;
  wish: string;
  opened_at: string;
};

/** Kết quả lucky-envelopes (public.get_envelopes). */
export type EnvelopeState = {
  day: string;
  resets_at: string;
  /** Số bao vừa được phát ở lần gọi này. */
  new: number;
  milestones: EnvelopeMilestone[];
  unopened: Envelope[];
  opened_today: OpenedEnvelope[];
};

export type EnvelopeReward = { coins: number; gems: number; wish: string; lucky: boolean };

/** Thưởng cao nhất của 1 bao — trùng public._envelope_reward (chỉ để hiển thị). */
export const ENVELOPE_MAX_COINS = 888;
