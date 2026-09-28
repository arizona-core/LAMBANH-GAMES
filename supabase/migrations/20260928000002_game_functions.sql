-- Sweet Shop — hàm kinh tế phía server.
--
-- Vì sao logic nằm trong Postgres (không nằm trong Edge Function):
--   supabase-js không chạy được transaction nhiều câu lệnh. Mỗi hàm dưới đây chạy trọn
--   trong 1 transaction, khóa dòng bằng FOR UPDATE nên không bị race/double-spend.
--   Edge Function lo phần xác thực JWT + validate input (zod), rồi gọi hàm qua rpc()
--   bằng service_role. Client KHÔNG được execute các hàm này (xem cuối file).
--
-- Lỗi nghiệp vụ được raise với message là MÃ LỖI (vd 'INSUFFICIENT_COINS'), errcode P0001.

-- ---------------------------------------------------------------------------
-- Tiện ích nội bộ
-- ---------------------------------------------------------------------------

create or replace function public._fail(p_code text)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception using message = p_code, errcode = 'P0001';
end $$;

create or replace function public._today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

create or replace function public._level_for_xp(p_xp bigint)
returns integer language sql immutable set search_path = '' as $$
  select 1 + floor(sqrt(greatest(p_xp, 0) / 30.0))::integer;
$$;

-- Hệ số giá theo số sao (phần trăm của base_price): 1★ 60% … 3★ 100% … 5★ 150%.
create or replace function public._quality_pct(p_quality integer)
returns integer language sql immutable set search_path = '' as $$
  select (array[60, 80, 100, 125, 150])[p_quality];
$$;

create or replace function public._slugify(p_text text)
returns text language sql stable set search_path = '' as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(p_text, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

-- Bộ lọc từ bậy tối giản (so trên chuỗi đã bỏ dấu). Mở rộng danh sách khi cần.
create or replace function public._is_bad_name(p_text text)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1
    -- Chỉ chặn nguyên từ (giữa dấu '-'); tránh từ đa nghĩa phổ biến như "các", "bưởi".
    from unnest(array['dcm', 'dmm', 'dm', 'dkm', 'vcl', 'vkl', 'vl', 'cmm', 'clm', 'cc', 'fuck', 'shit', 'bitch', 'admin', 'moderator', 'sweetshop'])
      as w(word)
    where public._slugify(p_text) ~ ('(^|-)' || w.word || '(-|$)')
  );
$$;

create or replace function public._log(
  p_user uuid, p_kind text, p_coins bigint, p_gems bigint, p_ref uuid, p_meta jsonb
) returns void language sql set search_path = '' as $$
  insert into public.transactions_log (user_id, kind, coins_delta, gems_delta, ref_id, meta)
  values (p_user, p_kind, p_coins, p_gems, p_ref, coalesce(p_meta, '{}'::jsonb));
$$;

-- Giới hạn tần suất dựa trên transactions_log (chống bot/smurf).
create or replace function public._rate_limit(p_user uuid, p_kind text, p_max integer, p_window interval)
returns void language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.transactions_log
      where user_id = p_user and kind = p_kind and created_at > now() - p_window) >= p_max then
    perform public._fail('RATE_LIMITED');
  end if;
end $$;

create or replace function public._lock_profile(p_user uuid)
returns public.profiles language plpgsql set search_path = '' as $$
declare
  v public.profiles;
begin
  select * into v from public.profiles where id = p_user for update;
  if not found then
    perform public._fail('NO_PROFILE');
  end if;
  return v;
end $$;

-- Hiệu ứng lớn nhất của các nâng cấp đã mua theo loại (oven/display).
create or replace function public._upgrade_bonus(p_user uuid, p_kind text)
returns integer language sql stable set search_path = '' as $$
  select coalesce(max(c.effect), 0)::integer
  from public.upgrades u
  join public.upgrade_catalog c on c.code = u.upgrade_code
  where u.user_id = p_user and c.kind = p_kind;
$$;

create or replace function public._add_inventory(p_user uuid, p_code text, p_qty integer)
returns void language sql set search_path = '' as $$
  insert into public.inventory (user_id, ingredient_code, qty) values (p_user, p_code, p_qty)
  on conflict (user_id, ingredient_code) do update set qty = public.inventory.qty + excluded.qty;
$$;

create or replace function public._add_goods(p_user uuid, p_recipe text, p_quality integer, p_qty integer)
returns void language sql set search_path = '' as $$
  insert into public.baked_goods (user_id, recipe_code, quality, qty) values (p_user, p_recipe, p_quality, p_qty)
  on conflict (user_id, recipe_code, quality) do update set qty = public.baked_goods.qty + excluded.qty;
$$;

-- Trừ hàng; báo lỗi nếu không đủ.
create or replace function public._take_item(p_user uuid, p_kind text, p_code text, p_quality integer, p_qty integer)
returns void language plpgsql set search_path = '' as $$
begin
  if p_kind = 'ingredient' then
    update public.inventory set qty = qty - p_qty
    where user_id = p_user and ingredient_code = p_code and qty >= p_qty;
  else
    update public.baked_goods set qty = qty - p_qty
    where user_id = p_user and recipe_code = p_code and quality = p_quality and qty >= p_qty;
  end if;
  if not found then
    perform public._fail('NOT_ENOUGH_ITEMS');
  end if;
end $$;

create or replace function public._validate_names(p_owner_name text, p_shop_name text)
returns void language plpgsql set search_path = '' as $$
begin
  if p_owner_name is not null and char_length(p_owner_name) not between 2 and 24 then
    perform public._fail('INVALID_NAME');
  end if;
  if char_length(p_shop_name) not between 3 and 32 or public._slugify(p_shop_name) = '' then
    perform public._fail('INVALID_NAME');
  end if;
  if public._is_bad_name(p_shop_name) or (p_owner_name is not null and public._is_bad_name(p_owner_name)) then
    perform public._fail('NAME_NOT_ALLOWED');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Hồ sơ
-- ---------------------------------------------------------------------------

create or replace function public.create_profile(
  p_user uuid, p_owner_name text, p_shop_name text, p_avatar text, p_color text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner text := btrim(p_owner_name);
  v_shop  text := btrim(regexp_replace(p_shop_name, '\s+', ' ', 'g'));
  v_slug  text;
begin
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

  -- Nguyên liệu khởi đầu: đủ làm vài mẻ Bánh mì / Bông lan đầu tiên.
  perform public._add_inventory(p_user, 'flour', 10);
  perform public._add_inventory(p_user, 'egg', 6);
  perform public._add_inventory(p_user, 'sugar', 4);
  perform public._add_inventory(p_user, 'oil', 4);

  perform public._log(p_user, 'signup_bonus', 500, 10, null, '{}'::jsonb);
  return jsonb_build_object('slug', v_slug);
end $$;

create or replace function public.rename_shop(p_user uuid, p_shop_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c_cost constant bigint := 20;
  v      public.profiles;
  v_shop text := btrim(regexp_replace(p_shop_name, '\s+', ' ', 'g'));
  v_slug text;
begin
  v := public._lock_profile(p_user);
  perform public._validate_names(null, v_shop);
  if v.gems < c_cost then
    perform public._fail('INSUFFICIENT_GEMS');
  end if;
  v_slug := public._slugify(v_shop);

  begin
    update public.profiles
    set shop_name = v_shop, slug = v_slug, gems = gems - c_cost, updated_at = now()
    where id = p_user;
  exception when unique_violation then
    perform public._fail('SHOP_NAME_TAKEN');
  end;

  perform public._log(p_user, 'rename_shop', 0, -c_cost, null, jsonb_build_object('from', v.shop_name::text, 'to', v_shop));
  return jsonb_build_object('slug', v_slug, 'gems', v.gems - c_cost);
end $$;

create or replace function public.claim_daily(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v        public.profiles;
  v_today  date := public._today();
  v_streak integer;
  v_coins  bigint;
  v_gems   bigint;
begin
  v := public._lock_profile(p_user);
  if v.last_checkin = v_today then
    perform public._fail('ALREADY_CLAIMED');
  end if;

  v_streak := case when v.last_checkin = v_today - 1 then v.checkin_streak + 1 else 1 end;
  v_coins  := 50 + 10 * least(v_streak, 7);
  v_gems   := case when v_streak % 7 = 0 then 10 else 2 end;

  update public.profiles
  set coins = coins + v_coins, gems = gems + v_gems,
      checkin_streak = v_streak, last_checkin = v_today, updated_at = now()
  where id = p_user;

  perform public._log(p_user, 'daily_checkin', v_coins, v_gems, null, jsonb_build_object('streak', v_streak));
  return jsonb_build_object('streak', v_streak, 'coins', v_coins, 'gems', v_gems);
end $$;

-- ---------------------------------------------------------------------------
-- Nguyên liệu & làm bánh
-- ---------------------------------------------------------------------------

create or replace function public.buy_ingredient(p_user uuid, p_code text, p_qty integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v       public.profiles;
  v_price integer;
  v_total bigint;
begin
  if p_qty is null or p_qty not between 1 and 99 then
    perform public._fail('INVALID_INPUT');
  end if;
  select price into v_price from public.ingredients where code = p_code;
  if not found then
    perform public._fail('NOT_FOUND');
  end if;

  v := public._lock_profile(p_user);
  perform public._rate_limit(p_user, 'buy_ingredient', 300, interval '1 day');
  v_total := v_price::bigint * p_qty;
  if v.coins < v_total then
    perform public._fail('INSUFFICIENT_COINS');
  end if;

  update public.profiles set coins = coins - v_total, updated_at = now() where id = p_user;
  perform public._add_inventory(p_user, p_code, p_qty);
  perform public._log(p_user, 'buy_ingredient', -v_total, 0, null, jsonb_build_object('item', p_code, 'qty', p_qty));
  return jsonb_build_object('coins', v.coins - v_total, 'spent', v_total);
end $$;

create or replace function public.start_bake(p_user uuid, p_recipe text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v        public.profiles;
  r        public.recipes;
  v_id     uuid;
begin
  v := public._lock_profile(p_user);
  select * into r from public.recipes where code = p_recipe;
  if not found then
    perform public._fail('NOT_FOUND');
  end if;
  if v.level < r.unlock_level then
    perform public._fail('LEVEL_TOO_LOW');
  end if;
  perform public._rate_limit(p_user, 'bake', 400, interval '1 day');

  -- Chỉ kiểm tra đủ nguyên liệu; trừ thật khi hoàn thành (finish_bake) để bỏ dở không mất đồ.
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

-- p_scores: điểm canh giờ của 3 bước (Trộn, Nướng, Trang trí), mỗi bước 0..100.
create or replace function public.finish_bake(p_user uuid, p_session uuid, p_scores integer[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s          public.bake_sessions;
  r          public.recipes;
  v          public.profiles;
  v_score    integer;
  v_quality  integer;
  v_xp       bigint;
  v_level    integer;
  ing        record;
begin
  if p_scores is null or array_length(p_scores, 1) is distinct from 3
     or exists (select 1 from unnest(p_scores) x where x is null or x not between 0 and 100) then
    perform public._fail('INVALID_INPUT');
  end if;

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

  v := public._lock_profile(p_user);

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

  perform public._add_goods(p_user, r.code, v_quality, 1);

  v_xp := v.xp + r.xp;
  v_level := public._level_for_xp(v_xp);
  update public.profiles set xp = v_xp, level = v_level, updated_at = now() where id = p_user;

  update public.bake_sessions set status = 'done', quality = v_quality, completed_at = now() where id = s.id;
  perform public._log(p_user, 'bake', 0, 0, s.id,
    jsonb_build_object('recipe', r.code, 'quality', v_quality, 'scores', to_jsonb(p_scores)));

  return jsonb_build_object(
    'quality', v_quality, 'score', v_score, 'xp_gained', r.xp,
    'level', v_level, 'leveled_up', v_level > v.level
  );
end $$;

create or replace function public.sell_to_npc(p_user uuid, p_recipe text, p_quality integer, p_qty integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v       public.profiles;
  v_base  integer;
  v_unit  bigint;
  v_total bigint;
  v_rep   integer;
  v_today date := public._today();
begin
  if p_qty is null or p_qty not between 1 and 50 or p_quality is null or p_quality not between 1 and 5 then
    perform public._fail('INVALID_INPUT');
  end if;
  select base_price into v_base from public.recipes where code = p_recipe;
  if not found then
    perform public._fail('NOT_FOUND');
  end if;

  v := public._lock_profile(p_user);
  perform public._rate_limit(p_user, 'npc_sale', 500, interval '1 day');
  perform public._take_item(p_user, 'baked', p_recipe, p_quality, p_qty);

  -- Làm tròn xuống ở mỗi bước; mọi giá trị là số nguyên.
  v_unit  := (v_base::bigint * public._quality_pct(p_quality) / 100)
             * (100 + public._upgrade_bonus(p_user, 'display')) / 100;
  v_total := v_unit * p_qty;
  v_rep   := case when p_quality >= 4 then (p_quality - 3) * p_qty else 0 end;

  update public.profiles
  set coins = coins + v_total,
      revenue_total = revenue_total + v_total,
      revenue_today = case when revenue_day = v_today then revenue_today + v_total else v_total end,
      revenue_day = v_today,
      reputation = reputation + v_rep,
      updated_at = now()
  where id = p_user;

  perform public._log(p_user, 'npc_sale', v_total, 0, null,
    jsonb_build_object('recipe', p_recipe, 'quality', p_quality, 'qty', p_qty, 'unit', v_unit));
  return jsonb_build_object('earned', v_total, 'unit_price', v_unit, 'reputation_gained', v_rep);
end $$;

create or replace function public.buy_upgrade(p_user uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.profiles;
  c public.upgrade_catalog;
begin
  select * into c from public.upgrade_catalog where code = p_code;
  if not found then
    perform public._fail('NOT_FOUND');
  end if;

  v := public._lock_profile(p_user);
  if exists (select 1 from public.upgrades where user_id = p_user and upgrade_code = p_code) then
    perform public._fail('ALREADY_OWNED');
  end if;
  if c.requires_code is not null
     and not exists (select 1 from public.upgrades where user_id = p_user and upgrade_code = c.requires_code) then
    perform public._fail('REQUIRES_PREVIOUS');
  end if;
  if v.level < c.unlock_level then
    perform public._fail('LEVEL_TOO_LOW');
  end if;
  if v.coins < c.cost_coins then
    perform public._fail('INSUFFICIENT_COINS');
  end if;
  if v.gems < c.cost_gems then
    perform public._fail('INSUFFICIENT_GEMS');
  end if;

  update public.profiles
  set coins = coins - c.cost_coins,
      gems = gems - c.cost_gems,
      reputation = reputation + case when c.kind = 'decor' then c.effect else 0 end,
      updated_at = now()
  where id = p_user;
  insert into public.upgrades (user_id, upgrade_code) values (p_user, p_code);

  perform public._log(p_user, 'buy_upgrade', -c.cost_coins, -c.cost_gems, null, jsonb_build_object('upgrade', p_code));
  return jsonb_build_object('coins', v.coins - c.cost_coins, 'gems', v.gems - c.cost_gems);
end $$;

-- ---------------------------------------------------------------------------
-- Chợ người chơi (phí 5%, làm tròn LÊN để luôn hút tiền khỏi nền kinh tế)
-- ---------------------------------------------------------------------------

create or replace function public.market_fee(p_price bigint)
returns bigint language sql immutable set search_path = '' as $$
  select (p_price * 5 + 99) / 100;
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
  if v.level < 2 then
    perform public._fail('MARKET_LOCKED');
  end if;
  if (select count(*) from public.market_listings where seller_id = p_user and status = 'active') >= 10 then
    perform public._fail('TOO_MANY_LISTINGS');
  end if;
  perform public._rate_limit(p_user, 'listing_create', 30, interval '1 day');

  -- Giá/đơn vị phải trong khoảng 20%..500% giá tham chiếu: chặn "chuyển tiền" giữa acc phụ.
  if p_price * 100 < v_ref * p_qty * 20 or p_price > v_ref * p_qty * 5 then
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

  -- Khóa 2 hồ sơ theo thứ tự id cố định để tránh deadlock.
  perform 1 from public.profiles where id in (p_user, l.seller_id) order by id for update;
  buyer := public._lock_profile(p_user);

  if buyer.level < 2 then
    perform public._fail('MARKET_LOCKED');
  end if;
  perform public._rate_limit(p_user, 'market_buy', 50, interval '1 day');
  if (select count(*) from public.transactions_log
      where user_id = p_user and kind = 'market_buy' and created_at > now() - interval '1 day'
        and meta->>'seller_id' = l.seller_id::text) >= 10 then
    perform public._fail('RATE_LIMITED');
  end if;
  if buyer.coins < l.price then
    perform public._fail('INSUFFICIENT_COINS');
  end if;

  v_fee := public.market_fee(l.price);

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

create or replace function public.cancel_listing(p_user uuid, p_listing uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l public.market_listings;
begin
  select * into l from public.market_listings
  where id = p_listing and seller_id = p_user and status = 'active' for update;
  if not found then
    perform public._fail('LISTING_UNAVAILABLE');
  end if;

  if l.kind = 'ingredient' then
    perform public._add_inventory(p_user, l.item_code, l.qty);
  else
    perform public._add_goods(p_user, l.item_code, l.quality, l.qty);
  end if;
  update public.market_listings set status = 'cancelled', closed_at = now() where id = l.id;
  perform public._log(p_user, 'listing_cancel', 0, 0, l.id, '{}'::jsonb);
  return jsonb_build_object('listing_id', l.id);
end $$;

-- ---------------------------------------------------------------------------
-- Quyền: CHỈ service_role (Edge Function) được gọi. Client không execute được gì.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function
  public.create_profile(uuid, text, text, text, text),
  public.rename_shop(uuid, text),
  public.claim_daily(uuid),
  public.buy_ingredient(uuid, text, integer),
  public.start_bake(uuid, text),
  public.finish_bake(uuid, uuid, integer[]),
  public.sell_to_npc(uuid, text, integer, integer),
  public.buy_upgrade(uuid, text),
  public.create_listing(uuid, text, text, integer, integer, bigint),
  public.buy_listing(uuid, uuid),
  public.cancel_listing(uuid, uuid)
to service_role;
