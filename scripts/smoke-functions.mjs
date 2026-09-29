// Smoke test end-to-end cho Edge Functions trên Supabase local.
// Yêu cầu: `npx supabase start` và `npx supabase functions serve` đang chạy.
// Chạy: node scripts/smoke-functions.mjs
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8" }));
const URL = status.API_URL;
const admin = createClient(URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function makePlayer(tag) {
  const email = `smoke-${tag}-${Date.now()}@test.local`;
  const password = "smoke-password-123";
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(URL, status.ANON_KEY, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return client;
}

async function call(client, fn, body) {
  const { data: session } = await client.auth.getSession();
  const res = await fetch(`${URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
      apikey: status.ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

let failures = 0;
function expect(label, cond, detail) {
  console.log(`${cond ? "ok  " : "FAIL"} ${label}${cond ? "" : "  → " + JSON.stringify(detail)}`);
  if (!cond) failures++;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const a = await makePlayer("a");
const b = await makePlayer("b");
const tag = Date.now().toString(36);

let r = await call(a, "create-profile", { ownerName: "Smoke A", shopName: `Smoke ${tag} A`, avatar: "a1", color: "caramel" });
expect("create-profile A", r.ok, r);
r = await call(b, "create-profile", { ownerName: "Smoke B", shopName: `Smoke ${tag} B`, avatar: "a2", color: "mint" });
expect("create-profile B", r.ok, r);

r = await call(a, "buy-ingredient", { code: "flour", qty: 4 });
expect("buy-ingredient", r.ok && r.data.spent === 16, r);
r = await call(a, "buy-ingredient", { code: "flour", qty: -1 });
expect("buy-ingredient chặn qty âm", !r.ok && r.error === "INVALID_INPUT", r);
r = await call(a, "buy-ingredient", { code: "flour", qty: 1, coins: 999999 });
expect("chặn field lạ (strict)", !r.ok && r.error === "INVALID_INPUT", r);

// Khách + đơn hàng (phụ thuộc giờ game: 1 giây thật = 1 phút game, mở 7:00–24:00).
r = await call(a, "customer-tick", {});
expect("customer-tick", r.ok && Array.isArray(r.data.visits), r);
if (!r.data?.clock?.open) {
  console.log(`skip đơn hàng: tiệm đang đóng cửa (giờ game ${r.data?.clock?.hour}:${r.data?.clock?.minute})`);
} else {
  // Chờ khách đầu tiên tới quầy (tối đa ~60 giây).
  let visit = null;
  for (let i = 0; i < 16 && !visit; i++) {
    const t = await call(a, "customer-tick", {});
    visit = t.data?.visits?.find((v) => new Date(v.arrive_at) <= new Date(t.data.server_now));
    if (!visit) await sleep(4000);
  }
  expect("có khách tới quầy", !!visit, null);
  if (visit) {
    const { data: needs } = await a.from("recipe_ingredients").select("ingredient_code, qty").eq("recipe_code", visit.recipe);
    const { data: recipe } = await a.from("recipes").select("cook_method, packaging").eq("code", visit.recipe).single();
    // Mua đủ nguyên liệu + sốt/topping khách gọi.
    for (const n of needs) await call(a, "buy-ingredient", { code: n.ingredient_code, qty: n.qty });
    for (const extra of [visit.sauce, visit.topping]) if (extra) await call(a, "buy-ingredient", { code: extra, qty: 1 });

    r = await call(a, "accept-order", { visitId: visit.id });
    expect("accept-order", r.ok && r.data.session_id, r);
    const body = {
      visitId: visit.id,
      ingredients: needs.map((n) => n.ingredient_code),
      method: recipe.cook_method,
      scores: [95, 95],
      sauce: visit.sauce,
      topping: visit.topping,
      packaging: recipe.packaging,
    };
    r = await call(a, "complete-order", body);
    expect("complete-order quá nhanh bị chặn", !r.ok && r.error === "TOO_FAST", r);
    await sleep(((r.ok ? 0 : 12) + 1) * 1000);
    r = await call(a, "complete-order", body);
    expect("complete-order làm đúng → ≥4 sao", r.ok && r.data.quality >= 4, r);
  }
}

// Đóng / mở cửa tiệm.
r = await call(a, "set-shop-open", { open: false });
expect("set-shop-open đóng cửa", r.ok && r.data.shop_open === false, r);
r = await call(a, "customer-tick", {});
expect("tiệm đóng không sinh khách", r.ok && r.data.shop_open === false && r.data.generated === 0, r);
r = await call(a, "set-shop-open", { open: "yes" });
expect("set-shop-open input sai bị chặn", !r.ok && r.error === "INVALID_INPUT", r);
r = await call(a, "set-shop-open", { open: true });
expect("set-shop-open mở cửa", r.ok && r.data.shop_open === true, r);

r = await call(a, "claim-daily", {});
expect("claim-daily", r.ok, r);
r = await call(a, "claim-daily", {});
expect("claim-daily lần 2 bị chặn", !r.ok && r.error === "ALREADY_CLAIMED", r);

r = await call(a, "create-listing", { kind: "ingredient", item: "flour", qty: 2, price: 8 });
expect("create-listing khóa ở cấp 1", !r.ok && r.error === "MARKET_LOCKED", r);

// Client không tự sửa được xu (RLS + revoke)
const { error: updError } = await a.from("profiles").update({ coins: 999999 }).neq("coins", -1);
expect("client không update được profiles", !!updError, updError);
const { error: rpcError } = await a.rpc("buy_ingredient", { p_user: "00000000-0000-0000-0000-000000000000", p_code: "flour", p_qty: 1 });
expect("client không gọi trực tiếp rpc kinh tế", !!rpcError, rpcError);

// Throttle đếm cả request lỗi: 25 lần liên tiếp → phải bị chặn (tối đa 20/10 giây).
const burst = [];
for (let i = 0; i < 25; i++) burst.push(await call(b, "claim-daily", {}));
expect("throttle chặn spam request", burst.some((x) => x.error === "RATE_LIMITED"), burst.at(-1));

const res = await fetch(`${URL}/functions/v1/claim-daily`, { method: "POST", body: "{}" });
expect("không có JWT → 401", res.status === 401, res.status);

console.log(failures ? `\n${failures} lỗi` : "\nTất cả đều ổn");
process.exit(failures ? 1 : 0);
