-- Sweet Shop — đồng hồ game, 500 khách NPC, làm bánh THEO ĐƠN.
--
-- Đồng hồ: chung cả server, 1 giây thật = 1 phút game (1 giờ game = 1 phút thật,
--   1 ngày game = 24 phút thật). Tiệm mở 7:00 → 24:00 (17 phút thật).
-- Khách: 500 NPC cố định có tính cách (hay hối / hay quịt / khó khăn) + món, sốt, topping ưa thích.
--   Chỉ khi người chơi ĐANG MỞ APP (gọi customer-tick) server mới sinh lượt ghé,
--   ~45 lượt/ngày game (nhiều hơn khi uy tín cao), tối đa 4 khách chờ ở quầy.
-- Làm theo đơn: nhận đơn → chọn nguyên liệu → trộn → chọn cách nấu + canh lửa → nước chấm/sốt
--   → topping → đóng gói → giao. Server chấm từng bước, tính tiền, quyết định khách có quịt.
-- Bỏ bánh làm sẵn (baked_goods, start_bake/finish_bake, sell_to_npc); chợ chỉ bán nguyên liệu.

-- ---------------------------------------------------------------------------
-- Dọn cơ chế bánh làm sẵn
-- ---------------------------------------------------------------------------

drop function if exists public.sell_to_npc(uuid, text, integer, integer);
drop function if exists public.start_bake(uuid, text);
drop function if exists public.finish_bake(uuid, uuid, integer[]);
drop function if exists public._add_goods(uuid, text, integer, integer);
drop table if exists public.baked_goods;
delete from public.market_listings where kind = 'baked';

create or replace function public._take_item(p_user uuid, p_kind text, p_code text, p_quality integer, p_qty integer)
returns void language plpgsql set search_path = '' as $$
begin
  update public.inventory set qty = qty - p_qty
  where user_id = p_user and ingredient_code = p_code and qty >= p_qty;
  if not found then
    perform public._fail('NOT_ENOUGH_ITEMS');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Danh mục: loại nguyên liệu, sốt, topping, cách nấu, đóng gói
-- ---------------------------------------------------------------------------

alter table public.ingredients add column kind text not null default 'base'
  check (kind in ('base', 'sauce', 'topping'));

insert into public.ingredients (code, name, price, image, sort, kind) values
  ('sauce_garlic',   'Sốt bơ tỏi',   5, null, 20, 'sauce'),
  ('sauce_condensed','Sữa đặc',      4, null, 21, 'sauce'),
  ('sauce_choco',    'Sốt socola',   6, null, 22, 'sauce'),
  ('sauce_caramel',  'Sốt caramel',  6, null, 23, 'sauce'),
  ('sauce_jam',      'Mứt dâu',      7, null, 24, 'sauce'),
  ('top_sprinkles',  'Cốm màu',      3, null, 30, 'topping'),
  ('top_cheese',     'Phô mai',      7, null, 31, 'topping'),
  ('top_cream',      'Kem tươi',     6, null, 32, 'topping'),
  ('top_almond',     'Hạnh nhân',    8, null, 33, 'topping'),
  ('top_chocochip',  'Socola chip',  6, null, 34, 'topping');

alter table public.recipes
  add column cook_method text not null default 'bake' check (cook_method in ('bake', 'fry', 'steam')),
  add column packaging text not null default 'box' check (packaging in ('box', 'bag'));

insert into public.recipes (code, name, unlock_level, min_play_seconds, base_price, xp, image, sort, cook_method, packaging)
values ('donut', 'Bánh rán (donut)', 2, 7, 52, 14, null, 3, 'fry', 'bag');
insert into public.recipe_ingredients (recipe_code, ingredient_code, qty) values
  ('donut', 'flour', 2), ('donut', 'egg', 1), ('donut', 'sugar', 1), ('donut', 'oil', 2);

update public.recipes set cook_method = 'steam', packaging = 'box' where code = 'sponge';
update public.recipes set packaging = 'bag' where code in ('bread', 'cookie', 'croissant');
update public.recipes set sort = sort + 1 where code not in ('bread', 'sponge', 'donut');

-- Nguyên liệu khởi đầu cho tiệm mới cũng gồm vài loại sốt/topping.
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

  perform public._add_inventory(p_user, 'flour', 12);
  perform public._add_inventory(p_user, 'egg', 6);
  perform public._add_inventory(p_user, 'sugar', 4);
  perform public._add_inventory(p_user, 'oil', 6);
  perform public._add_inventory(p_user, 'sauce_garlic', 3);
  perform public._add_inventory(p_user, 'sauce_condensed', 3);
  perform public._add_inventory(p_user, 'top_sprinkles', 3);
  perform public._add_inventory(p_user, 'top_cheese', 3);

  perform public._log(p_user, 'signup_bonus', 500, 10, null, '{}'::jsonb);
  return jsonb_build_object('slug', v_slug);
end $$;

-- ---------------------------------------------------------------------------
-- Chợ: chỉ nguyên liệu (kể cả sốt/topping)
-- ---------------------------------------------------------------------------

create or replace function public.create_listing(
  p_user uuid, p_kind text, p_item text, p_quality integer, p_qty integer, p_price bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v     public.profiles;
  v_ref bigint;
  v_id  uuid;
begin
  if p_kind is distinct from 'ingredient' or p_quality is not null
     or p_qty is null or p_qty not between 1 and 999
     or p_price is null or p_price not between 1 and 1000000 then
    perform public._fail('INVALID_INPUT');
  end if;
  select price into v_ref from public.ingredients where code = p_item;
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
  if p_price * 100 < v_ref * p_qty * 50 or p_price > v_ref * p_qty * 2 then
    perform public._fail('PRICE_OUT_OF_RANGE');
  end if;

  perform public._take_item(p_user, 'ingredient', p_item, null, p_qty);
  insert into public.market_listings (seller_id, kind, item_code, quality, qty, price)
  values (p_user, 'ingredient', p_item, null, p_qty, p_price)
  returning id into v_id;

  perform public._log(p_user, 'listing_create', 0, 0, v_id,
    jsonb_build_object('item', p_item, 'qty', p_qty, 'price', p_price));
  return jsonb_build_object('listing_id', v_id);
end $$;

create or replace function public.buy_listing(p_user uuid, p_listing uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c_pair_cap   constant bigint := 3000;
  c_income_cap constant bigint := 20000;
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
  perform public._add_inventory(p_user, l.item_code, l.qty);

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
  perform public._add_inventory(p_user, l.item_code, l.qty);
  update public.market_listings set status = 'cancelled', closed_at = now() where id = l.id;
  perform public._log(p_user, 'listing_cancel', 0, 0, l.id, '{}'::jsonb);
  return jsonb_build_object('listing_id', l.id);
end $$;

-- ---------------------------------------------------------------------------
-- Đồng hồ game
-- ---------------------------------------------------------------------------

create or replace function public._game_minute(p_at timestamptz)
returns integer language sql immutable set search_path = '' as $$
  select (floor(extract(epoch from p_at))::bigint % 1440)::integer;
$$;

create or replace function public._game_open(p_at timestamptz)
returns boolean language sql immutable set search_path = '' as $$
  select public._game_minute(p_at) >= 420;
$$;

create or replace function public._game_clock(p_at timestamptz)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'minute_of_day', m, 'hour', m / 60, 'minute', m % 60, 'open', m >= 420
  ) from (select public._game_minute(p_at) as m) x;
$$;

-- ---------------------------------------------------------------------------
-- 500 khách NPC
-- ---------------------------------------------------------------------------

create table public.customers (
  id                integer primary key,
  name              text not null,
  gender            text not null check (gender in ('m', 'f')),
  personality       text not null,
  bio               text not null default '',
  impatient         boolean not null default false, -- HAY HỐI: chờ ít, bỏ đi thì chê quán
  patience_seconds  integer not null check (patience_seconds between 10 and 300),
  dine_and_dash     boolean not null default false, -- QUỊT: có tỉ lệ không trả tiền
  dine_dash_pct     integer not null default 0 check (dine_dash_pct between 0 and 100),
  picky             boolean not null default false, -- KHÓ KHĂN: đòi đủ sao, chấm gắt
  min_quality       smallint not null default 1 check (min_quality between 1 and 5),
  favorite_recipe   text not null references public.recipes (code),
  favorite_sauce    text references public.ingredients (code),   -- null = không dùng sốt
  favorite_topping  text references public.ingredients (code),   -- null = không topping
  spend             smallint not null default 1 check (spend between 1 and 3), -- độ hào phóng (tip)
  look              smallint not null check (look between 0 and 11),
  created_at        timestamptz not null default now()
);

alter table public.customers enable row level security;
create policy "customers readable" on public.customers for select to authenticated using (true);
grant select on public.customers to authenticated;

select setseed(0.20260928);

insert into public.customers (
  id, name, gender, personality, bio, impatient, patience_seconds, dine_and_dash, dine_dash_pct,
  picky, min_quality, favorite_recipe, favorite_sauce, favorite_topping, spend, look
)
select
  g.id,
  g.ho || ' ' || g.dem || ' ' || g.ten,
  g.gender,
  case
    when g.impatient and g.picky then 'Khó chiều'
    when g.impatient then 'Nóng tính'
    when g.picky then 'Kỹ tính'
    when g.dash then 'Lém lỉnh'
    when g.spend = 3 then 'Hào phóng'
    else (array['Vui vẻ', 'Hiền lành', 'Dễ tính', 'Tiết kiệm', 'Thân thiện'])[1 + floor(g.r_pers * 5)::int]
  end,
  concat_ws(' ',
    case when g.impatient then 'Đợi lâu là bỏ đi, còn chê quán chậm.' end,
    case when g.dash then 'Thỉnh thoảng ăn xong… quên trả tiền.' end,
    case when g.picky then 'Chỉ chịu bánh từ ' || g.min_q || ' sao trở lên.' end,
    case when not (g.impatient or g.dash or g.picky) then 'Khách dễ chịu, làm đúng món là vui.' end
  ),
  g.impatient,
  case when g.impatient then 40 + floor(g.r_pat * 21)::int else 70 + floor(g.r_pat * 51)::int end,
  g.dash,
  case when g.dash then 10 + floor(g.r_dash * 21)::int else 0 end,
  g.picky,
  g.min_q,
  (array['bread', 'sponge', 'donut', 'cookie', 'croissant', 'cupcake', 'fruit_tart', 'choco_cake', 'berry_choco'])[1 + floor(g.r_fav * 9)::int],
  case when g.r_sauce < 0.2 then null
       else (array['sauce_garlic', 'sauce_condensed', 'sauce_choco', 'sauce_caramel', 'sauce_jam'])[1 + floor(g.r_sauce2 * 5)::int] end,
  case when g.r_top < 0.2 then null
       else (array['top_sprinkles', 'top_cheese', 'top_cream', 'top_almond', 'top_chocochip'])[1 + floor(g.r_top2 * 5)::int] end,
  g.spend,
  floor(g.r_look * 12)::int
from (
  select
    i as id,
    gd as gender,
    (array['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'])[1 + floor(random() * 16)::int] as ho,
    case gd
      when 'm' then (array['Văn', 'Minh', 'Quốc', 'Đức', 'Hữu', 'Gia', 'Thành', 'Anh'])[1 + floor(random() * 8)::int]
      else (array['Thị', 'Ngọc', 'Thu', 'Minh', 'Bảo', 'Khánh', 'Mai', 'Thanh'])[1 + floor(random() * 8)::int]
    end as dem,
    case gd
      when 'm' then (array['An', 'Bình', 'Cường', 'Dũng', 'Hải', 'Hiếu', 'Hoàng', 'Huy', 'Khang', 'Khoa', 'Long', 'Nam', 'Phúc', 'Quân', 'Sơn', 'Tài', 'Thắng', 'Tuấn', 'Việt', 'Vinh'])[1 + floor(random() * 20)::int]
      else (array['Anh', 'Chi', 'Dung', 'Hà', 'Hạnh', 'Hoa', 'Hương', 'Lan', 'Linh', 'Loan', 'Mai', 'My', 'Ngân', 'Nhi', 'Oanh', 'Phương', 'Quyên', 'Thảo', 'Trang', 'Vy'])[1 + floor(random() * 20)::int]
    end as ten,
    random() < 0.25 as impatient,
    random() < 0.12 as dash,
    pk as picky,
    case when pk then 4 + floor(random() * 2)::int else 1 + floor(random() * 3)::int end as min_q,
    1 + floor(random() ^ 2 * 3)::int as spend,
    random() as r_pers, random() as r_pat, random() as r_dash, random() as r_fav,
    random() as r_sauce, random() as r_sauce2, random() as r_top, random() as r_top2, random() as r_look
  from (
    select i, case when random() < 0.5 then 'm' else 'f' end as gd, random() < 0.2 as pk
    from generate_series(1, 500) i
  ) base
) g;

-- ---------------------------------------------------------------------------
-- Lượt ghé + đơn hàng
-- ---------------------------------------------------------------------------

alter table public.profiles add column visits_until timestamptz;

create table public.customer_visits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  customer_id   integer not null references public.customers (id),
  recipe_code   text not null references public.recipes (code),
  sauce_code    text references public.ingredients (code),
  topping_code  text references public.ingredients (code),
  arrive_at     timestamptz not null,
  leave_at      timestamptz not null,
  status        text not null default 'waiting' check (status in ('waiting', 'cooking', 'served', 'dashed', 'left')),
  quality       smallint check (quality between 1 and 5),
  paid          bigint check (paid >= 0),
  tip           bigint check (tip >= 0),
  reputation_delta integer,
  result        jsonb,
  created_at    timestamptz not null default now(),
  check (leave_at > arrive_at)
);

create index customer_visits_open_idx on public.customer_visits (user_id, arrive_at) where status in ('waiting', 'cooking');
create index customer_visits_user_idx on public.customer_visits (user_id, created_at desc);
create unique index customer_visits_one_cooking on public.customer_visits (user_id) where status = 'cooking';

alter table public.customer_visits enable row level security;
create policy "own visits" on public.customer_visits for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.customer_visits to authenticated;

alter table public.bake_sessions add column visit_id uuid references public.customer_visits (id) on delete cascade;

create or replace function public._visit_json(p_visit uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', v.id, 'status', v.status, 'arrive_at', v.arrive_at, 'leave_at', v.leave_at,
    'recipe', v.recipe_code, 'recipe_name', r.name, 'recipe_image', r.image,
    'sauce', v.sauce_code, 'sauce_name', s.name, 'topping', v.topping_code, 'topping_name', t.name,
    'customer', jsonb_build_object(
      'id', c.id, 'name', c.name, 'gender', c.gender, 'personality', c.personality, 'bio', c.bio,
      'impatient', c.impatient, 'dine_and_dash', c.dine_and_dash, 'picky', c.picky,
      'min_quality', c.min_quality, 'look', c.look)
  )
  from public.customer_visits v
  join public.customers c on c.id = v.customer_id
  join public.recipes r on r.code = v.recipe_code
  left join public.ingredients s on s.code = v.sauce_code
  left join public.ingredients t on t.code = v.topping_code
  where v.id = p_visit;
$$;

-- Nhịp sinh khách khi người chơi mở app. Sinh lượt ghé cho 60 giây tới (không bù lúc offline),
-- khách hết kiên nhẫn thì bỏ đi, trả danh sách khách đang chờ/đang làm.
create or replace function public._customer_tick_at(p_user uuid, p_now timestamptz)
returns jsonb language plpgsql set search_path = '' as $$
declare
  c_open_seconds constant numeric := 1020;  -- 7:00 → 24:00 = 17 phút thật
  c_horizon      constant interval := interval '60 seconds';
  c_max_waiting  constant integer := 4;
  v         public.profiles;
  v_per_day numeric;
  v_mean    numeric;
  v_from    timestamptz;
  v_to      timestamptz := p_now + c_horizon;
  v_t       timestamptz;
  v_left    integer;
  v_penalty integer;
  v_waiting integer;
  cust      public.customers;
  v_recipe  text;
  v_sauce   text;
  v_topping text;
  v_made    integer := 0;
begin
  v := public._lock_profile(p_user);

  -- 1. Hết kiên nhẫn → bỏ đi. Hay hối, hoặc đang chờ bánh mà bị bỏ rơi → chê quán (−1 uy tín).
  with gone as (
    update public.customer_visits cv set status = 'left',
      reputation_delta = case when c.impatient or cv.status = 'cooking' then -1 else 0 end
    from public.customers c
    where cv.customer_id = c.id and cv.user_id = p_user
      and cv.status in ('waiting', 'cooking') and cv.leave_at < p_now
    returning cv.reputation_delta
  )
  select count(*), coalesce(-sum(reputation_delta), 0) into v_left, v_penalty from gone;
  if v_penalty > 0 then
    update public.profiles set reputation = greatest(0, reputation - v_penalty) where id = p_user;
  end if;
  update public.bake_sessions bs set status = 'abandoned', completed_at = p_now
  from public.customer_visits cv
  where bs.visit_id = cv.id and bs.status = 'active' and cv.user_id = p_user and cv.status = 'left';

  -- 2. Sinh lượt ghé: 45/ngày game, +1 mỗi 20 uy tín, tối đa 75.
  v_per_day := least(75, 45 + v.reputation / 20);
  v_mean := c_open_seconds / v_per_day;
  v_from := greatest(p_now, coalesce(v.visits_until, p_now));
  select count(*) into v_waiting from public.customer_visits where user_id = p_user and status = 'waiting';
  v_t := v_from + make_interval(secs => -ln(1 - random()) * v_mean);

  while v_t < v_to loop
    if public._game_open(v_t) and v_waiting < c_max_waiting then
      select * into cust from public.customers order by random() limit 1;

      v_recipe := null;
      if random() < 0.6 then
        select code into v_recipe from public.recipes where code = cust.favorite_recipe and unlock_level <= v.level;
      end if;
      if v_recipe is null then
        select code into v_recipe from public.recipes where unlock_level <= v.level order by random() limit 1;
      end if;

      v_sauce := case when random() < 0.7 then cust.favorite_sauce
                      else (select code from public.ingredients where kind = 'sauce' order by random() limit 1) end;
      v_topping := case when random() < 0.7 then cust.favorite_topping
                        else (select code from public.ingredients where kind = 'topping' order by random() limit 1) end;

      insert into public.customer_visits (user_id, customer_id, recipe_code, sauce_code, topping_code, arrive_at, leave_at)
      values (p_user, cust.id, v_recipe, v_sauce, v_topping, v_t, v_t + make_interval(secs => cust.patience_seconds));
      v_waiting := v_waiting + 1;
      v_made := v_made + 1;
    end if;
    v_t := v_t + make_interval(secs => -ln(1 - random()) * v_mean);
  end loop;

  update public.profiles set visits_until = v_to where id = p_user;

  return jsonb_build_object(
    'server_now', p_now,
    'clock', public._game_clock(p_now),
    'left', v_left,
    'reputation_lost', v_penalty,
    'generated', v_made,
    'visits', coalesce((
      select jsonb_agg(public._visit_json(id) order by arrive_at)
      from public.customer_visits where user_id = p_user and status in ('waiting', 'cooking')
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.customer_tick(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  -- Không ghi log mỗi nhịp (quá nhiều); chống spam bằng throttle ở Edge Function.
  return public._customer_tick_at(p_user, now());
end $$;

-- Nhận đơn: khách thôi đếm kiên nhẫn chờ quầy, chuyển sang chờ bánh (có hạn riêng).
create or replace function public.accept_order(p_user uuid, p_visit uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v    public.profiles;
  cv   public.customer_visits;
  c    public.customers;
  r    public.recipes;
  v_session uuid;
  v_wait integer;
begin
  v := public._lock_profile(p_user);
  select * into cv from public.customer_visits where id = p_visit and user_id = p_user for update;
  if not found or cv.status not in ('waiting', 'cooking') or now() > cv.leave_at then
    perform public._fail('CUSTOMER_GONE');
  end if;

  -- Mở lại đơn đang làm (vd tải lại trang) → trả phiên hiện có.
  if cv.status = 'cooking' then
    select id into v_session from public.bake_sessions where visit_id = cv.id and status = 'active';
  else
    if now() < cv.arrive_at then
      perform public._fail('CUSTOMER_NOT_ARRIVED');
    end if;
    if exists (select 1 from public.customer_visits where user_id = p_user and status = 'cooking') then
      perform public._fail('ORDER_IN_PROGRESS');
    end if;
    perform public._rate_limit(p_user, 'order', 600, interval '1 day');

    select * into c from public.customers where id = cv.customer_id;
    v_wait := case when c.impatient then 75 else 120 end;
    update public.customer_visits
    set status = 'cooking', leave_at = now() + make_interval(secs => v_wait)
    where id = cv.id;
    update public.bake_sessions set status = 'abandoned', completed_at = now()
    where user_id = p_user and status = 'active';
    insert into public.bake_sessions (user_id, recipe_code, visit_id)
    values (p_user, cv.recipe_code, cv.id) returning id into v_session;
  end if;

  select * into r from public.recipes where code = cv.recipe_code;
  return public._visit_json(cv.id) || jsonb_build_object(
    'session_id', v_session,
    'min_play_seconds', r.min_play_seconds,
    'oven_bonus', public._upgrade_bonus(p_user, 'oven')
  );
end $$;

-- Giao bánh: server chấm cả quy trình.
--   p_ingredients: nguyên liệu người chơi bỏ vào tô (mỗi mã 1 lần; server dùng đúng định lượng)
--   p_method: bake | fry | steam      p_scores: điểm canh giờ [trộn, nấu] 0..100
--   p_sauce / p_topping: mã hoặc null  p_packaging: box | bag
create or replace function public.complete_order(
  p_user uuid, p_visit uuid, p_ingredients text[], p_method text, p_scores integer[],
  p_sauce text, p_topping text, p_packaging text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c_fresh_orders constant integer := 300;
  v        public.profiles;
  cv       public.customer_visits;
  c        public.customers;
  r        public.recipes;
  s        public.bake_sessions;
  v_needed text[];
  v_missing integer;
  v_extra  integer;
  v_score  integer;
  v_q      integer;
  v_tired  boolean;
  v_extras_ok boolean;
  v_price  bigint;
  v_tip    bigint := 0;
  v_paid   bigint;
  v_rep    integer;
  v_dash   boolean;
  v_notes  text[] := '{}';
  v_xp     bigint;
  v_level  integer;
  v_code   text;
  v_today  date := public._today();
begin
  if p_ingredients is null or cardinality(p_ingredients) > 12
     or p_method not in ('bake', 'fry', 'steam') or p_packaging not in ('box', 'bag')
     or p_scores is null or array_length(p_scores, 1) is distinct from 2
     or exists (select 1 from unnest(p_scores) x where x is null or x not between 0 and 100)
     or (select count(*) from unnest(p_ingredients) x) <> (select count(distinct x) from unnest(p_ingredients) x) then
    perform public._fail('INVALID_INPUT');
  end if;

  v := public._lock_profile(p_user);
  select * into cv from public.customer_visits
  where id = p_visit and user_id = p_user and status = 'cooking' for update;
  if not found or now() > cv.leave_at then
    perform public._fail('CUSTOMER_GONE');
  end if;
  select * into s from public.bake_sessions where visit_id = cv.id and status = 'active' for update;
  select * into c from public.customers where id = cv.customer_id;
  select * into r from public.recipes where code = cv.recipe_code;
  if s.id is null then
    perform public._fail('SESSION_NOT_FOUND');
  end if;
  if now() - s.started_at < make_interval(secs => r.min_play_seconds) then
    perform public._fail('TOO_FAST');
  end if;

  -- Nguyên liệu bỏ vào tô: đúng món trừ theo định lượng công thức, sai món trừ 1 (bị bỏ phí).
  select array_agg(ingredient_code) into v_needed from public.recipe_ingredients where recipe_code = r.code;
  foreach v_code in array p_ingredients loop
    if not exists (select 1 from public.ingredients where code = v_code and kind = 'base') then
      perform public._fail('INVALID_INPUT');
    end if;
    perform public._take_item(p_user, 'ingredient', v_code, null,
      coalesce((select qty from public.recipe_ingredients where recipe_code = r.code and ingredient_code = v_code), 1));
  end loop;
  v_missing := (select count(*) from unnest(v_needed) x where x <> all (p_ingredients));
  v_extra   := (select count(*) from unnest(p_ingredients) x where x <> all (v_needed));

  if p_sauce is not null then
    if not exists (select 1 from public.ingredients where code = p_sauce and kind = 'sauce') then
      perform public._fail('INVALID_INPUT');
    end if;
    perform public._take_item(p_user, 'ingredient', p_sauce, null, 1);
  end if;
  if p_topping is not null then
    if not exists (select 1 from public.ingredients where code = p_topping and kind = 'topping') then
      perform public._fail('INVALID_INPUT');
    end if;
    perform public._take_item(p_user, 'ingredient', p_topping, null, 1);
  end if;

  -- Chấm điểm: canh giờ (trung bình 2 bước) + lò, trừ lỗi quy trình.
  v_score := (p_scores[1] + p_scores[2]) / 2 + public._upgrade_bonus(p_user, 'oven')
             - 25 * v_missing - 15 * v_extra;
  if v_missing > 0 then v_notes := v_notes || ('Thiếu ' || v_missing || ' nguyên liệu'); end if;
  if v_extra > 0 then v_notes := v_notes || ('Thừa ' || v_extra || ' nguyên liệu lạ'); end if;
  if p_method <> r.cook_method then
    v_score := v_score - 40;
    v_notes := v_notes || 'Sai cách nấu'::text;
  end if;
  if p_packaging <> r.packaging then
    v_score := v_score - 10;
    v_notes := v_notes || 'Đóng gói chưa đúng'::text;
  end if;
  v_score := greatest(0, least(100, v_score));
  v_q := case when v_score >= 90 then 5 when v_score >= 75 then 4 when v_score >= 55 then 3
              when v_score >= 35 then 2 else 1 end;

  v_tired := (select count(*) from public.transactions_log
              where user_id = p_user and kind = 'order' and created_at > now() - interval '1 day') >= c_fresh_orders;
  if v_tired then v_q := least(v_q, 3); end if;

  -- Tiền: giá bánh theo sao × tủ trưng bày + tiền sốt/topping (x2 giá vốn).
  v_price := (r.base_price::bigint * public._quality_pct(v_q) / 100)
             * (100 + public._upgrade_bonus(p_user, 'display')) / 100
           + 2 * coalesce((select price from public.ingredients where code = p_sauce), 0)
           + 2 * coalesce((select price from public.ingredients where code = p_topping), 0);

  v_extras_ok := p_sauce is not distinct from cv.sauce_code and p_topping is not distinct from cv.topping_code;
  if v_extras_ok then
    v_tip := c.spend * 5 * v_q / 3;
  else
    v_notes := v_notes || 'Sai nước chấm/topping khách gọi'::text;
  end if;

  v_rep := case
    when c.picky then case when v_q = 5 then 2 when v_q = 4 then 0 else -1 end
    else case when v_q >= 4 then v_q - 3 else 0 end
  end + case when v_extras_ok then 0 else -1 end;

  v_paid := v_price + v_tip;
  if c.picky and v_q < c.min_quality then
    v_paid := v_price / 2;   -- khách khó tính chỉ trả nửa giá, không tip
    v_tip := 0;
    v_notes := v_notes || ('Khách chê: muốn bánh từ ' || c.min_quality || ' sao');
  end if;
  v_dash := c.dine_and_dash and random() * 100 < c.dine_dash_pct;

  v_xp := v.xp + r.xp;
  v_level := public._level_for_xp(v_xp);
  update public.bake_sessions set status = 'done', quality = v_q, completed_at = now() where id = s.id;

  if v_dash then
    update public.profiles set xp = v_xp, level = v_level, updated_at = now() where id = p_user;
    update public.customer_visits set status = 'dashed', quality = v_q, paid = 0, tip = 0, reputation_delta = 0,
      result = jsonb_build_object('notes', to_jsonb(v_notes), 'lost', v_paid) where id = cv.id;
    perform public._log(p_user, 'order', 0, 0, cv.id,
      jsonb_build_object('customer', c.id, 'recipe', r.code, 'quality', v_q, 'dashed', true, 'scores', to_jsonb(p_scores)));
    return jsonb_build_object('dashed', true, 'lost', v_paid, 'quality', v_q, 'score', v_score,
      'notes', to_jsonb(v_notes), 'xp_gained', r.xp, 'level', v_level, 'leveled_up', v_level > v.level,
      'customer', c.name);
  end if;

  update public.profiles
  set coins = coins + v_paid,
      revenue_total = revenue_total + v_paid,
      revenue_today = case when revenue_day = v_today then revenue_today + v_paid else v_paid end,
      revenue_day = v_today,
      reputation = greatest(0, reputation + v_rep),
      xp = v_xp, level = v_level,
      updated_at = now()
  where id = p_user;

  update public.customer_visits
  set status = 'served', quality = v_q, paid = v_paid, tip = v_tip, reputation_delta = v_rep,
      result = jsonb_build_object('notes', to_jsonb(v_notes))
  where id = cv.id;
  perform public._log(p_user, 'order', v_paid, 0, cv.id,
    jsonb_build_object('customer', c.id, 'recipe', r.code, 'quality', v_q, 'tip', v_tip,
                       'scores', to_jsonb(p_scores), 'tired', v_tired));

  return jsonb_build_object(
    'dashed', false, 'paid', v_paid, 'tip', v_tip, 'quality', v_q, 'score', v_score,
    'reputation_delta', v_rep, 'notes', to_jsonb(v_notes), 'tired', v_tired,
    'xp_gained', r.xp, 'level', v_level, 'leveled_up', v_level > v.level, 'customer', c.name
  );
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.customer_tick(uuid),
  public.accept_order(uuid, uuid),
  public.complete_order(uuid, uuid, text[], text, integer[], text, text, text),
  public.create_profile(uuid, text, text, text, text),
  public.create_listing(uuid, text, text, integer, integer, bigint),
  public.buy_listing(uuid, uuid),
  public.cancel_listing(uuid, uuid)
to service_role;
