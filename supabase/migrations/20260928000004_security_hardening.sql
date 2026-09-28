-- Sweet Shop — gia cố bảo mật sau rà soát (security-reviewer).
--  1. Mini-game: điểm do client gửi nên bot luôn đạt tối đa được → giới hạn LỢI ÍCH:
--     trần 150 mẻ/ngày, từ mẻ thứ 61 trong 24h tối đa 3★ ("đầu bếp mệt").
--  2. Chợ: chặn chuyển xu giữa acc chính/phụ — dải giá 50%..200%, mở từ cấp 3 + tiệm ≥ 24h,
--     trần 3.000 ₵/ngày mua từ cùng 1 người bán, trần 20.000 ₵/ngày tiền bán ở chợ.
--  3. Deadlock finish_bake ↔ start_bake: luôn khóa profile TRƯỚC rồi mới khóa dòng con.
--  4. Throttle theo request (đếm cả request lỗi) — Edge Function gọi public.throttle() trước.
--  6. Thu hồi toàn bộ quyền bảng của anon/authenticated, chỉ cấp lại SELECT.
--  7. create_profile gọi song song: advisory lock để trả đúng PROFILE_EXISTS.

-- ---------------------------------------------------------------------------
-- 6. Quyền bảng tối thiểu
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant select on public.ingredients, public.recipes, public.recipe_ingredients, public.upgrade_catalog
  to anon, authenticated;
grant select on public.profiles, public.inventory, public.baked_goods, public.bake_sessions,
  public.upgrades, public.market_listings, public.transactions_log
  to authenticated;
grant select on public.public_profiles, public.leaderboard, public.market_feed to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Throttle theo request (transaction riêng, nên request thất bại vẫn bị đếm)
-- ---------------------------------------------------------------------------

create table public.action_throttle (
  user_id       uuid not null references auth.users (id) on delete cascade,
  action        text not null,
  window_start  timestamptz not null default now(),
  hits          integer not null default 0,
  primary key (user_id, action)
);
alter table public.action_throttle enable row level security; -- không policy: client không đọc/ghi

create or replace function public.throttle(p_user uuid, p_action text, p_max integer, p_window_seconds integer)
returns boolean language sql security definer set search_path = '' as $$
  insert into public.action_throttle as t (user_id, action, window_start, hits)
  values (p_user, p_action, now(), 1)
  on conflict (user_id, action) do update set
    hits = case when t.window_start < now() - make_interval(secs => p_window_seconds) then 1 else t.hits + 1 end,
    window_start = case when t.window_start < now() - make_interval(secs => p_window_seconds) then now() else t.window_start end
  returning hits <= p_max;
$$;

-- ---------------------------------------------------------------------------
-- 7. create_profile an toàn khi gọi song song
-- ---------------------------------------------------------------------------

create or replace function public.create_profile(
  p_user uuid, p_owner_name text, p_shop_name text, p_avatar text, p_color text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner text := btrim(p_owner_name);
  v_shop  text := btrim(regexp_replace(p_shop_name, '\s+', ' ', 'g'));
  v_slug  text;
begin
  perform pg_advisory_xact_lock(hashtext('create_profile:' || p_user::text));
  if exists (select 1 from public.profiles where id = p_user) then
    perform public._fail('PROFILE_EXISTS');
  end if;
  perform public._validate_names(v_owner, v_shop);
  v_slug := public._slugify(v_shop);

  begin
    insert into public.profiles (id, owner_name, shop_name, slug, avatar, color, coins, gems)
    values (p_user, v_owner, v_shop, v_slug, p_avatar, p_color, 500, 10);
  exception
    when unique_violation then perform public._fail('SHOP_NAME_TAKEN');
    when check_violation then perform public._fail('INVALID_INPUT');
  end;

  perform public._add_inventory(p_user, 'flour', 10);
  perform public._add_inventory(p_user, 'egg', 6);
  perform public._add_inventory(p_user, 'sugar', 4);
  perform public._add_inventory(p_user, 'oil', 4);

  perform public._log(p_user, 'signup_bonus', 500, 10, null, '{}'::jsonb);
  return jsonb_build_object('slug', v_slug);
end $$;

-- ---------------------------------------------------------------------------
-- 1 + 3. Làm bánh: trần mẻ/ngày, "đầu bếp mệt", thứ tự khóa profile → session
-- ---------------------------------------------------------------------------

create or replace function public.start_bake(p_user uuid, p_recipe text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v    public.profiles;
  r    public.recipes;
  v_id uuid;
begin
  v := public._lock_profile(p_user);
  select * into r from public.recipes where code = p_recipe;
  if not found then
    perform public._fail('NOT_FOUND');
  end if;
  if v.level < r.unlock_level then
    perform public._fail('LEVEL_TOO_LOW');
  end if;
  perform public._rate_limit(p_user, 'bake', 150, interval '1 day');

  if exists (
    select 1 from public.recipe_ingredients ri
    left join public.inventory i on i.user_id = p_user and i.ingredient_code = ri.ingredient_code
    where ri.recipe_code = p_recipe and coalesce(i.qty, 0) < ri.qty
  ) then
    perform public._fail('NOT_ENOUGH_ITEMS');
  end if;

  update public.bake_sessions set status = 'abandoned', completed_at = now()
  where user_id = p_user and status = 'active';

  insert into public.bake_sessions (user_id, recipe_code) values (p_user, p_recipe) returning id into v_id;
  return jsonb_build_object(
    'session_id', v_id,
    'min_play_seconds', r.min_play_seconds,
    'oven_bonus', public._upgrade_bonus(p_user, 'oven')
  );
end $$;

create or replace function public.finish_bake(p_user uuid, p_session uuid, p_scores integer[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c_fresh_bakes constant integer := 60;  -- số mẻ/24h được vượt 3★
  s         public.bake_sessions;
  r         public.recipes;
  v         public.profiles;
  v_score   integer;
  v_quality integer;
  v_tired   boolean;
  v_xp      bigint;
  v_level   integer;
  ing       record;
begin
  if p_scores is null or array_length(p_scores, 1) is distinct from 3
     or exists (select 1 from unnest(p_scores) x where x is null or x not between 0 and 100) then
    perform public._fail('INVALID_INPUT');
  end if;

  -- Khóa profile TRƯỚC (cùng thứ tự với start_bake) để không deadlock.
  v := public._lock_profile(p_user);

  select * into s from public.bake_sessions
  where id = p_session and user_id = p_user and status = 'active' for update;
  if not found then
    perform public._fail('SESSION_NOT_FOUND');
  end if;
  select * into r from public.recipes where code = s.recipe_code;

  if now() - s.started_at < make_interval(secs => r.min_play_seconds) then
    perform public._fail('TOO_FAST');
  end if;
  if now() - s.started_at > interval '30 minutes' then
    update public.bake_sessions set status = 'abandoned', completed_at = now() where id = s.id;
    return jsonb_build_object('expired', true);
  end if;

  for ing in select ingredient_code, qty from public.recipe_ingredients where recipe_code = r.code loop
    perform public._take_item(p_user, 'ingredient', ing.ingredient_code, null, ing.qty);
  end loop;

  v_score := least(100, (p_scores[1] + p_scores[2] + p_scores[3]) / 3 + public._upgrade_bonus(p_user, 'oven'));
  v_quality := case
    when v_score >= 90 then 5
    when v_score >= 75 then 4
    when v_score >= 55 then 3
    when v_score >= 35 then 2
    else 1
  end;

  -- Điểm canh giờ đến từ client (bot có thể gửi 100) → giới hạn lợi ích: làm quá nhiều mẻ
  -- trong 24h thì bánh tối đa 3★. Người chơi thật hiếm khi chạm ngưỡng này.
  v_tired := (select count(*) from public.transactions_log
              where user_id = p_user and kind = 'bake' and created_at > now() - interval '1 day') >= c_fresh_bakes;
  if v_tired then
    v_quality := least(v_quality, 3);
  end if;

  perform public._add_goods(p_user, r.code, v_quality, 1);

  v_xp := v.xp + r.xp;
  v_level := public._level_for_xp(v_xp);
  update public.profiles set xp = v_xp, level = v_level, updated_at = now() where id = p_user;

  update public.bake_sessions set status = 'done', quality = v_quality, completed_at = now() where id = s.id;
  perform public._log(p_user, 'bake', 0, 0, s.id,
    jsonb_build_object('recipe', r.code, 'quality', v_quality, 'scores', to_jsonb(p_scores), 'tired', v_tired));

  return jsonb_build_object(
    'quality', v_quality, 'score', v_score, 'xp_gained', r.xp,
    'level', v_level, 'leveled_up', v_level > v.level, 'tired', v_tired
  );
end $$;

-- ---------------------------------------------------------------------------
-- 2. Chợ: chống chuyển xu giữa tài khoản
-- ---------------------------------------------------------------------------

create or replace function public._market_eligible(p public.profiles)
returns boolean language sql stable set search_path = '' as $$
  select p.level >= 3 and p.created_at <= now() - interval '1 day';
$$;

create or replace function public.create_listing(
  p_user uuid, p_kind text, p_item text, p_quality integer, p_qty integer, p_price bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v     public.profiles;
  v_ref bigint;
  v_id  uuid;
begin
  if p_kind not in ('ingredient', 'baked')
     or p_qty is null or p_qty not between 1 and 999
     or p_price is null or p_price not between 1 and 1000000
     or (p_kind = 'ingredient' and p_quality is not null)
     or (p_kind = 'baked' and (p_quality is null or p_quality not between 1 and 5)) then
    perform public._fail('INVALID_INPUT');
  end if;

  if p_kind = 'ingredient' then
    select price into v_ref from public.ingredients where code = p_item;
  else
    select base_price * public._quality_pct(p_quality) / 100 into v_ref from public.recipes where code = p_item;
  end if;
  if v_ref is null then
    perform public._fail('NOT_FOUND');
  end if;

  v := public._lock_profile(p_user);
  if not public._market_eligible(v) then
    perform public._fail('MARKET_LOCKED');
  end if;
  if (select count(*) from public.market_listings where seller_id = p_user and status = 'active') >= 10 then
    perform public._fail('TOO_MANY_LISTINGS');
  end if;
  perform public._rate_limit(p_user, 'listing_create', 30, interval '1 day');

  -- Giá/đơn vị trong 50%..200% giá tham chiếu (bản cũ 20%..500% quá rộng, dùng để chuyển xu).
  if p_price * 100 < v_ref * p_qty * 50 or p_price > v_ref * p_qty * 2 then
    perform public._fail('PRICE_OUT_OF_RANGE');
  end if;

  perform public._take_item(p_user, p_kind, p_item, p_quality, p_qty);
  insert into public.market_listings (seller_id, kind, item_code, quality, qty, price)
  values (p_user, p_kind, p_item, p_quality, p_qty, p_price)
  returning id into v_id;

  perform public._log(p_user, 'listing_create', 0, 0, v_id,
    jsonb_build_object('kind', p_kind, 'item', p_item, 'quality', p_quality, 'qty', p_qty, 'price', p_price));
  return jsonb_build_object('listing_id', v_id);
end $$;

create or replace function public.buy_listing(p_user uuid, p_listing uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c_pair_cap   constant bigint := 3000;   -- ₵/24h một người mua trả cho cùng 1 người bán
  c_income_cap constant bigint := 20000;  -- ₵/24h một người bán nhận từ chợ
  l      public.market_listings;
  buyer  public.profiles;
  v_fee  bigint;
begin
  select * into l from public.market_listings where id = p_listing for update;
  if not found or l.status <> 'active' then
    perform public._fail('LISTING_UNAVAILABLE');
  end if;
  if l.seller_id = p_user then
    perform public._fail('CANNOT_BUY_OWN');
  end if;

  perform 1 from public.profiles where id in (p_user, l.seller_id) order by id for update;
  buyer := public._lock_profile(p_user);

  if not public._market_eligible(buyer) then
    perform public._fail('MARKET_LOCKED');
  end if;
  perform public._rate_limit(p_user, 'market_buy', 50, interval '1 day');
  if buyer.coins < l.price then
    perform public._fail('INSUFFICIENT_COINS');
  end if;

  v_fee := public.market_fee(l.price);

  if coalesce((select sum(-coins_delta) from public.transactions_log
               where user_id = p_user and kind = 'market_buy' and created_at > now() - interval '1 day'
                 and meta->>'seller_id' = l.seller_id::text), 0) + l.price > c_pair_cap
     or coalesce((select sum(coins_delta) from public.transactions_log
                  where user_id = l.seller_id and kind = 'market_sale' and created_at > now() - interval '1 day'), 0)
        + (l.price - v_fee) > c_income_cap then
    perform public._fail('MARKET_LIMIT');
  end if;

  update public.profiles set coins = coins - l.price, updated_at = now() where id = p_user;
  update public.profiles set coins = coins + (l.price - v_fee), updated_at = now() where id = l.seller_id;

  if l.kind = 'ingredient' then
    perform public._add_inventory(p_user, l.item_code, l.qty);
  else
    perform public._add_goods(p_user, l.item_code, l.quality, l.qty);
  end if;

  update public.market_listings
  set status = 'sold', buyer_id = p_user, fee = v_fee, closed_at = now()
  where id = l.id;

  perform public._log(p_user, 'market_buy', -l.price, 0, l.id, jsonb_build_object('seller_id', l.seller_id));
  perform public._log(l.seller_id, 'market_sale', l.price - v_fee, 0, l.id,
    jsonb_build_object('buyer_id', p_user, 'fee', v_fee));
  return jsonb_build_object('paid', l.price, 'fee', v_fee, 'coins', buyer.coins - l.price);
end $$;

-- ---------------------------------------------------------------------------
-- Quyền hàm (các hàm mới/tạo lại)
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.throttle(uuid, text, integer, integer),
  public.create_profile(uuid, text, text, text, text),
  public.start_bake(uuid, text),
  public.finish_bake(uuid, uuid, integer[]),
  public.create_listing(uuid, text, text, integer, integer, bigint),
  public.buy_listing(uuid, uuid)
to service_role;
