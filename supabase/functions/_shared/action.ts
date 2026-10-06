// Khuôn chung cho mọi Edge Function kinh tế:
//   (1) xác thực user từ JWT  (2) validate input bằng zod
//   (3) gọi hàm Postgres qua rpc() bằng service_role — hàm đó chạy trọn trong 1 transaction
//   (4) trả JSON { ok, data? , error? }
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.2";
import { z } from "npm:zod@4.6.5";

export { z };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// service_role CHỈ tồn tại ở đây (server). Không bao giờ gửi xuống client.
export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((s) => s.trim());

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// Mã lỗi nghiệp vụ do hàm Postgres raise (errcode P0001). Mã khác → INTERNAL, không lộ chi tiết.
const KNOWN_ERRORS = new Set([
  "NO_PROFILE", "PROFILE_EXISTS", "INVALID_NAME", "NAME_NOT_ALLOWED", "SHOP_NAME_TAKEN",
  "INVALID_INPUT", "NOT_FOUND", "INSUFFICIENT_COINS", "INSUFFICIENT_GEMS", "NOT_ENOUGH_ITEMS",
  "LEVEL_TOO_LOW", "RATE_LIMITED", "SESSION_NOT_FOUND", "TOO_FAST", "ALREADY_OWNED",
  "REQUIRES_PREVIOUS", "MARKET_LOCKED", "TOO_MANY_LISTINGS", "PRICE_OUT_OF_RANGE",
  "LISTING_UNAVAILABLE", "CANNOT_BUY_OWN", "ALREADY_CLAIMED", "MARKET_LIMIT",
  "CUSTOMER_GONE", "CUSTOMER_NOT_ARRIVED", "ORDER_IN_PROGRESS", "NOT_OWNED", "ALREADY_REPLIED",
  "QUEST_CLAIMED", "QUEST_NOT_DONE", "ALREADY_CLEAN", "ALREADY_OPENED",
]);

// Tối đa THROTTLE_MAX request / THROTTLE_WINDOW_SECONDS giây cho mỗi (user, action).
const THROTTLE_MAX = 20;
const THROTTLE_WINDOW_SECONDS = 10;

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<unknown>;

export class ActionError extends Error {}

const rpc: Rpc = async (fn, args) => {
  const { data, error } = await admin.rpc(fn, args);
  if (error) {
    if (error.code === "P0001" && KNOWN_ERRORS.has(error.message)) throw new ActionError(error.message);
    console.error(`[${fn}]`, error);
    throw new ActionError("INTERNAL");
  }
  return data;
};

export function serveAction<S extends z.ZodType>(
  schema: S,
  run: (ctx: { userId: string; input: z.infer<S>; rpc: Rpc }) => Promise<unknown>,
) {
  Deno.serve(async (req) => {
    const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
    if (req.method !== "POST") return reply(405, { ok: false, error: "METHOD_NOT_ALLOWED" });

    // (1) Xác thực: xác minh JWT với Auth server (auth.uid() chỉ có trong SQL, ở Deno phải tự làm).
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply(401, { ok: false, error: "UNAUTHORIZED" });
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return reply(401, { ok: false, error: "UNAUTHORIZED" });

    // Throttle theo user + action (transaction riêng → request thất bại vẫn bị đếm).
    const action = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "unknown";
    const { data: allowed, error: throttleError } = await admin.rpc("throttle", {
      p_user: auth.user.id,
      p_action: action,
      p_max: THROTTLE_MAX,
      p_window_seconds: THROTTLE_WINDOW_SECONDS,
    });
    if (throttleError) console.error("[throttle]", throttleError);
    if (allowed === false) return reply(429, { ok: false, error: "RATE_LIMITED" });

    // (2) Validate input — không tin bất cứ thứ gì từ client.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return reply(400, { ok: false, error: "INVALID_INPUT" });

    // (3) + (4)
    try {
      const data = await run({ userId: auth.user.id, input: parsed.data, rpc });
      return reply(200, { ok: true, data });
    } catch (err) {
      const code = err instanceof ActionError ? err.message : "INTERNAL";
      if (!(err instanceof ActionError)) console.error(err);
      return reply(code === "INTERNAL" ? 500 : 400, { ok: false, error: code });
    }
  });
}

// Schema dùng chung
export const Code = z.string().regex(/^[a-z0-9_]{1,40}$/);
export const Quality = z.number().int().min(1).max(5);
