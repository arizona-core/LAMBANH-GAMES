-- Sweet Shop — schema lõi + RLS.
-- Nguyên tắc: client chỉ ĐỌC (theo RLS). Mọi GHI đi qua hàm kinh tế (migration 0002),
-- chỉ service_role (Edge Function) được gọi.

create extension if not exists citext with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Danh mục tĩnh (công khai)
-- ---------------------------------------------------------------------------

create table public.ingredients (
  code        text primary key,
  name        text not null,
  price       integer not null check (price > 0),        -- giá mua từ nhà cung cấp NPC
  image       text,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.recipes (
  code              text primary key,
  name              text not null,
  unlock_level      integer not null default 1 check (unlock_level >= 1),
  min_play_seconds  integer not null check (min_play_seconds between 3 and 120), -- chống bot
  base_price        integer not null check (base_price > 0),                     -- giá NPC ở 3 sao
  xp                integer not null check (xp > 0),
  image             text,
  sort              integer not null default 0,
  created_at        timestamptz not null default now()
);

create table public.recipe_ingredients (
  recipe_code      text not null references public.recipes (code) on delete cascade,
  ingredient_code  text not null references public.ingredients (code),
  qty              integer not null check (qty > 0),
  primary key (recipe_code, ingredient_code)
);

create table public.upgrade_catalog (
  code          text primary key,
  kind          text not null check (kind in ('oven', 'display', 'decor')),
  tier          integer not null default 1,
  name          text not null,
  description   text not null default '',
  cost_coins    bigint not null default 0 check (cost_coins >= 0),
  cost_gems     bigint not null default 0 check (cost_gems >= 0),
  unlock_level  integer not null default 1,
  requires_code text references public.upgrade_catalog (code),
  -- oven: + điểm chất lượng; display: + % giá bán NPC; decor: + uy tín một lần
  effect        integer not null default 0 check (effect >= 0),
  image         text,
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),
  check (cost_coins > 0 or cost_gems > 0)
);

-- ---------------------------------------------------------------------------
-- Dữ liệu người chơi
-- ---------------------------------------------------------------------------

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  owner_name      text not null check (char_length(owner_name) between 2 and 24),
  shop_name       extensions.citext not null unique check (char_length(shop_name) between 3 and 32),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  avatar          text not null check (avatar in ('a1', 'a2', 'a3', 'a4')),
  color           text not null check (color in ('caramel', 'strawberry', 'mint', 'ocean', 'lavender', 'honey')),
  level           integer not null default 1 check (level >= 1),
  xp              bigint not null default 0 check (xp >= 0),
  coins           bigint not null default 0 check (coins >= 0),
  gems            bigint not null default 0 check (gems >= 0),
  reputation      integer not null default 0 check (reputation >= 0),
  revenue_total   bigint not null default 0 check (revenue_total >= 0),
  revenue_today   bigint not null default 0 check (revenue_today >= 0),
  revenue_day     date,
  checkin_streak  integer not null default 0,
  last_checkin    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_revenue_idx on public.profiles (revenue_total desc);
create index profiles_reputation_idx on public.profiles (reputation desc);

create table public.inventory (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  ingredient_code  text not null references public.ingredients (code),
  qty              integer not null default 0 check (qty >= 0),
  primary key (user_id, ingredient_code)
);

-- Bánh đã làm, gộp theo (công thức, số sao).
create table public.baked_goods (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  recipe_code  text not null references public.recipes (code),
  quality      smallint not null check (quality between 1 and 5),
  qty          integer not null default 0 check (qty >= 0),
  primary key (user_id, recipe_code, quality)
);

-- Phiên làm bánh: server ghi thời điểm bắt đầu để chặn gửi kết quả quá nhanh (bot).
create table public.bake_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  recipe_code   text not null references public.recipes (code),
  status        text not null default 'active' check (status in ('active', 'done', 'abandoned')),
  quality       smallint check (quality between 1 and 5),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create unique index bake_sessions_one_active on public.bake_sessions (user_id) where status = 'active';
create index bake_sessions_user_idx on public.bake_sessions (user_id, started_at desc);

create table public.upgrades (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  upgrade_code  text not null references public.upgrade_catalog (code),
  purchased_at  timestamptz not null default now(),
  primary key (user_id, upgrade_code)
);

-- Tin rao ở chợ. Hàng được giữ (escrow) trong listing cho tới khi bán hoặc hủy.
-- price = giá trọn lô (không phải giá/đơn vị), đúng như bản thiết kế chợ.
create table public.market_listings (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('ingredient', 'baked')),
  item_code   text not null,
  quality     smallint check (quality between 1 and 5),
  qty         integer not null check (qty between 1 and 999),
  price       bigint not null check (price between 1 and 1000000),
  status      text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  buyer_id    uuid references public.profiles (id) on delete set null,
  fee         bigint check (fee >= 0),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz,
  check ((kind = 'baked') = (quality is not null))
);

create index market_listings_active_idx on public.market_listings (created_at desc) where status = 'active';
create index market_listings_seller_idx on public.market_listings (seller_id, status);
create index market_listings_buyer_idx on public.market_listings (buyer_id);

-- Nhật ký mọi thay đổi kinh tế (audit + đếm giới hạn tần suất).
create table public.transactions_log (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         text not null,
  coins_delta  bigint not null default 0,
  gems_delta   bigint not null default 0,
  ref_id       uuid,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index transactions_log_user_kind_idx on public.transactions_log (user_id, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.ingredients         enable row level security;
alter table public.recipes             enable row level security;
alter table public.recipe_ingredients  enable row level security;
alter table public.upgrade_catalog     enable row level security;
alter table public.profiles            enable row level security;
alter table public.inventory           enable row level security;
alter table public.baked_goods         enable row level security;
alter table public.bake_sessions       enable row level security;
alter table public.upgrades            enable row level security;
alter table public.market_listings     enable row level security;
alter table public.transactions_log    enable row level security;

-- Danh mục: ai cũng đọc được, không ai (ngoài migration) ghi.
create policy "catalog readable" on public.ingredients        for select to anon, authenticated using (true);
create policy "catalog readable" on public.recipes            for select to anon, authenticated using (true);
create policy "catalog readable" on public.recipe_ingredients for select to anon, authenticated using (true);
create policy "catalog readable" on public.upgrade_catalog    for select to anon, authenticated using (true);

-- Dữ liệu người chơi: chỉ đọc của chính mình. KHÔNG có policy insert/update/delete.
create policy "own profile"   on public.profiles         for select to authenticated using ((select auth.uid()) = id);
create policy "own inventory" on public.inventory        for select to authenticated using ((select auth.uid()) = user_id);
create policy "own goods"     on public.baked_goods      for select to authenticated using ((select auth.uid()) = user_id);
create policy "own sessions"  on public.bake_sessions    for select to authenticated using ((select auth.uid()) = user_id);
create policy "own upgrades"  on public.upgrades         for select to authenticated using ((select auth.uid()) = user_id);
create policy "own log"       on public.transactions_log for select to authenticated using ((select auth.uid()) = user_id);

-- Chợ: tin đang mở ai cũng xem; tin đã đóng chỉ người bán/mua xem.
create policy "market readable" on public.market_listings for select to authenticated
  using (status = 'active' or (select auth.uid()) in (seller_id, buyer_id));

-- Phòng thủ nhiều lớp: thu hồi quyền ghi của client ngay cả khi ai đó lỡ thêm policy.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- View công khai (chỉ các cột an toàn). Chạy với quyền chủ view để đọc hồ sơ người khác
-- mà không phải mở RLS của bảng profiles (không lộ xu/gem/điểm danh).
-- ---------------------------------------------------------------------------

create view public.public_profiles
with (security_invoker = false) as
  select id, owner_name, shop_name::text as shop_name, slug, avatar, color, level, reputation, revenue_total
  from public.profiles;

create view public.leaderboard
with (security_invoker = false) as
  select
    id, shop_name::text as shop_name, slug, avatar, color, level, reputation, revenue_total,
    rank() over (order by revenue_total desc, created_at) as revenue_rank,
    rank() over (order by reputation desc, created_at)    as reputation_rank
  from public.profiles;

create view public.market_feed
with (security_invoker = false) as
  select
    l.id, l.seller_id, p.shop_name::text as seller_shop, l.kind, l.item_code,
    coalesce(i.name, r.name) as item_name, coalesce(i.image, r.image) as item_image,
    l.quality, l.qty, l.price, l.created_at
  from public.market_listings l
  join public.profiles p on p.id = l.seller_id
  left join public.ingredients i on l.kind = 'ingredient' and i.code = l.item_code
  left join public.recipes r     on l.kind = 'baked'      and r.code = l.item_code
  where l.status = 'active';

revoke all on public.public_profiles, public.leaderboard, public.market_feed from anon, authenticated;
grant select on public.public_profiles, public.leaderboard, public.market_feed to authenticated;
