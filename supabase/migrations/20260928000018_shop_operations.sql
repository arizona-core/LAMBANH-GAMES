-- Sweet Shop — vận hành tiệm: hóa đơn (tiền nhà, điện, nước), thuế, vệ sinh, thanh tra,
-- khách ngộ độc thực phẩm và bao lì xì.
--
-- Hóa đơn (shop_bills): tính theo NGÀY THẬT giờ Việt Nam (như nhiệm vụ / doanh thu hôm nay).
--   • Tiền nhà: chỉ tính cho ngày có bán hàng (đơn đầu tiên trong ngày), mức = 50 + 10 × cấp
--     + 10 × mỗi chỗ ngồi thêm. Không chơi thì không mất tiền nhà.
--   • Điện: theo cách nấu mỗi đơn (nướng 2 kWh, chiên 1, hấp 1, làm lạnh 2) × 2 ₵/kWh.
--   • Nước: 1 m³ mỗi đơn (hấp 2), dọn dẹp tiệm cũng tốn nước; 1 ₵/m³.
--   • Thuế kinh doanh: 5% tiền khách trả (kể cả tip).
--   Hóa đơn chốt sổ lúc 0:00, hạn đóng hết ngày hôm sau. Quá hạn: +20% phí trễ hạn;
--   tiền nhà/điện/nước/phạt bị TỰ TRỪ vào xu (lấy tối đa số xu đang có, phần còn lại trừ tiếp
--   lần sau). Thuế KHÔNG tự trừ: trốn thuế thì khi bị thanh tra sẽ bị truy thu + phạt 100% (gấp đôi).
--
-- Vệ sinh (profiles.hygiene 0..100): mỗi đơn −2 (chiên −3). Dọn dẹp → 100%, tốn nước (2 + thiếu/5 m³).
--
-- Thanh tra (inspections): chỉ tới khi tiệm đang mở + chủ tiệm online, tiệm mở ≥ 6 giờ.
--   • An toàn thực phẩm: kiểm tra vệ sinh + khách ngộ độc chưa xử lý. Khách ngộ độc hay báo thanh tra.
--   • Thuế: phát hiện thuế quá hạn chưa đóng → truy thu gấp đôi.
--   Kết quả do server quyết định ngay lúc tới; client hiện "đang kiểm tra" 20 giây rồi mới công bố.
--   Tiền phạt là 1 hóa đơn 'fine', hạn 24 giờ (quá hạn thì tự trừ như tiền nhà).
--
-- Ngộ độc: complete_order tự tung xác suất khi làm sai (sai cách nấu, chưa chín/cháy, nguyên liệu lạ),
--   bếp bẩn, khách "bụng yếu". Khách ngộ độc không trả tiền, tiệm bồi thường bằng giá món, −3 uy tín,
--   đánh giá 1 sao.
--
-- Lì xì (lucky_envelopes): mỗi ngày tối đa 9 bao, nhận khi đạt mốc (online, giao đơn, bán ở chợ,
--   nhiệm vụ, đóng hóa đơn, đạt thanh tra). Tiến độ server tính từ dữ liệu thật. Mở bao: server tung
--   ngẫu nhiên tiền thưởng (0–888 ₵, hiếm khi có gem) hoặc chỉ một lời chúc may mắn.

-- ---------------------------------------------------------------------------
-- 1. Cột mới
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column hygiene smallint not null default 100 check (hygiene between 0 and 100),
  add column online_seconds integer not null default 0 check (online_seconds >= 0),
  add column online_day date;

-- Khách "bụng yếu": dễ ngộ độc gấp đôi, bánh 1–2★ cũng có thể làm họ đau bụng.
alter table public.customers add column sensitive boolean not null default false;
select setseed(0.20261006);
update public.customers set sensitive = random() < 0.12;
update public.customers
set bio = bio || ' Bụng yếu, bánh không kỹ là đau bụng ngay.'
where sensitive;

alter table public.customer_visits drop constraint if exists customer_visits_status_check;
alter table public.customer_visits add constraint customer_visits_status_check
  check (status in ('waiting', 'cooking', 'served', 'dashed', 'left', 'closed', 'poisoned'));

-- ---------------------------------------------------------------------------
-- 2. Bảng
-- ---------------------------------------------------------------------------

create table public.inspections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  kind              text not null check (kind in ('food', 'tax')),
  result            text not null check (result in ('pass', 'warning', 'fined')),
  inspector         text not null,
  hygiene           smallint check (hygiene between 0 and 100),
  findings          jsonb not null default '[]'::jsonb,   -- [{ text, fine }]
  fine              bigint not null default 0 check (fine >= 0),
  reputation_delta  integer not null default 0,
  created_at        timestamptz not null default now(),
  reveal_at         timestamptz not null                 -- client hiện "đang kiểm tra" tới lúc này
);

create index inspections_user_idx on public.inspections (user_id, created_at desc);

create table public.shop_bills (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  kind           text not null check (kind in ('rent', 'electric', 'water', 'tax', 'fine')),
  day            date not null,                            -- ngày phát sinh (giờ VN)
  units          integer not null default 0 check (units >= 0),  -- số ngày / kWh / m³ / số đơn chịu thuế
  base           bigint not null default 0 check (base >= 0),    -- doanh thu chịu thuế (tax)
  amount         bigint not null default 0 check (amount >= 0),
  late_fee       bigint not null default 0 check (late_fee >= 0),
  paid           bigint not null default 0 check (paid >= 0),
  status         text not null default 'open' check (status in ('open', 'due', 'paid', 'audited')),
  autopaid       boolean not null default false,          -- bị tự trừ vì quá hạn
  due_at         timestamptz,
  inspection_id  uuid references public.inspections (id) on delete set null,
  note           text,
  created_at     timestamptz not null default now(),
  paid_at        timestamptz,
  check (paid <= amount + late_fee),
  check ((status = 'open') = (due_at is null))
);

-- Mỗi ngày 1 hóa đơn cho mỗi loại (trừ tiền phạt: mỗi biên bản 1 hóa đơn).
create unique index shop_bills_daily_uniq on public.shop_bills (user_id, day, kind) where kind <> 'fine';
create index shop_bills_unpaid_idx on public.shop_bills (user_id, due_at) where status in ('open', 'due');
create index shop_bills_user_idx on public.shop_bills (user_id, created_at desc);

create table public.envelope_catalog (
  code         text primary key,
  title        text not null,
  description  text not null,
  metric       text not null check (metric in ('online_minutes', 'serve', 'market_sale', 'quests', 'bill_pay', 'inspection_pass')),
  target       integer not null check (target > 0),
  sort         integer not null default 0
);

create table public.lucky_envelopes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  day         date not null,
  source      text not null references public.envelope_catalog (code),
  created_at  timestamptz not null default now(),
  opened_at   timestamptz,
  coins       integer check (coins >= 0),
  gems        integer check (gems >= 0),
  wish        text,
  unique (user_id, day, source),
  check ((opened_at is null) = (coins is null))
);

create index lucky_envelopes_unopened_idx on public.lucky_envelopes (user_id, created_at) where opened_at is null;

insert into public.envelope_catalog (code, title, description, metric, target, sort) values
  ('online_10',    'Ghé tiệm',           'Online 10 phút trong ngày',            'online_minutes',  10, 1),
  ('online_30',    'Chăm chỉ',           'Online 30 phút trong ngày',            'online_minutes',  30, 2),
  ('online_60',    'Trực quầy cả buổi',  'Online 60 phút trong ngày',            'online_minutes',  60, 3),
  ('serve_10',     'Mở hàng',            'Giao 10 đơn cho khách',                'serve',           10, 4),
  ('serve_30',     'Đắt hàng',           'Giao 30 đơn cho khách',                'serve',           30, 5),
  ('sell_1',       'Bán ở chợ',          'Bán được 1 lô hàng ở Chợ',             'market_sale',      1, 6),
  ('quests_5',     'Siêng nhiệm vụ',     'Nhận thưởng 5 nhiệm vụ hằng ngày',     'quests',           5, 7),
  ('bills_1',      'Sòng phẳng',         'Tự đóng 1 hóa đơn hoặc thuế',          'bill_pay',         1, 8),
  ('inspect_pass', 'Tiệm chuẩn',         'Được thanh tra chấm “Đạt”',            'inspection_pass',  1, 9);

alter table public.inspections      enable row level security;
alter table public.shop_bills       enable row level security;
alter table public.envelope_catalog enable row level security;
alter table public.lucky_envelopes  enable row level security;

create policy "own inspections" on public.inspections     for select to authenticated using ((select auth.uid()) = user_id);
create policy "own bills"       on public.shop_bills      for select to authenticated using ((select auth.uid()) = user_id);
create policy "own envelopes"   on public.lucky_envelopes for select to authenticated using ((select auth.uid()) = user_id);
create policy "catalog readable" on public.envelope_catalog for select to anon, authenticated using (true);

-- Chỉ đọc. Mọi ghi đi qua hàm kinh tế bên dưới (service_role).
grant select on public.inspections, public.shop_bills, public.lucky_envelopes to authenticated;
grant select on public.envelope_catalog to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Bảng giá & công thức (trùng lib/game/operations.ts — client chỉ dùng để hiển thị)
-- ---------------------------------------------------------------------------

create or replace function public._vn_day(p_at timestamptz)
returns date language sql immutable set search_path = '' as $$
  select (p_at at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

-- 12345 → '12.345' (dùng trong biên bản thanh tra).
create or replace function public._fmt_coins(p_n bigint)
returns text language sql immutable set search_path = '' as $$
  select replace(to_char(p_n, 'FM999,999,999,990'), ',', '.');
$$;

create or replace function public._rent_for(p_level integer, p_seats integer)
returns bigint language sql immutable set search_path = '' as $$
  select (50 + 10 * p_level + 10 * greatest(0, p_seats - 2))::bigint;
$$;

-- kWh điện theo cách nấu.
create or replace function public._electric_units(p_method text)
returns integer language sql immutable set search_path = '' as $$
  select case p_method when 'bake' then 2 when 'chill' then 2 else 1 end;
$$;

-- m³ nước mỗi đơn (rửa dụng cụ; hấp tốn thêm nước).
create or replace function public._water_units(p_method text)
returns integer language sql immutable set search_path = '' as $$
  select case p_method when 'steam' then 2 else 1 end;
$$;

-- m³ nước để dọn tiệm từ mức vệ sinh hiện tại lên 100%.
create or replace function public._clean_water(p_hygiene integer)
returns integer language sql immutable set search_path = '' as $$
  select 2 + (100 - greatest(0, least(100, p_hygiene))) / 5;
$$;

-- Bảng giá gửi cho client hiển thị.
create or replace function public._ops_rates(p_level integer, p_seats integer)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'rent', public._rent_for(p_level, p_seats),
    'electric_price', 2, 'water_price', 1, 'tax_pct', 5, 'late_fee_pct', 20,
    'electric_units', jsonb_build_object('bake', 2, 'fry', 1, 'steam', 1, 'chill', 2),
    'water_units', jsonb_build_object('bake', 1, 'fry', 1, 'steam', 2, 'chill', 1)
  );
$$;

-- Xác suất (%) khách bị ngộ độc. 0 khi làm đúng, bếp sạch, khách khoẻ.
create or replace function public._poison_chance(
  p_wrong_method boolean, p_cook_score integer, p_extra integer, p_hygiene integer, p_sensitive boolean, p_quality integer
) returns integer language sql immutable set search_path = '' as $$
  select least(70,
    (case when p_wrong_method then 30 else 0 end        -- sai cách nấu (vd chiên món phải nướng)
     + case when p_cook_score < 30 then 15 else 0 end   -- lấy bánh ra quá sớm (sống) hoặc quá trễ (cháy)
     + 8 * greatest(0, p_extra)                         -- bỏ nguyên liệu lạ vào
     + case when p_hygiene < 25 then 20 when p_hygiene < 50 then 8 else 0 end)  -- bếp bẩn
    * case when p_sensitive then 2 else 1 end
    + case when p_sensitive and p_quality <= 2 then 5 else 0 end);
$$;

-- ---------------------------------------------------------------------------
-- 4. Hóa đơn
-- ---------------------------------------------------------------------------

-- Cộng dồn hóa đơn hôm nay sau mỗi đơn: tiền nhà (đơn đầu tiên trong ngày), điện, nước, thuế.
create or replace function public._accrue_bills(p_user uuid, p_level integer, p_method text, p_revenue bigint)
returns void language plpgsql set search_path = '' as $$
declare
  v_day   date := public._today();
  v_elec  integer := public._electric_units(p_method);
  v_water integer := public._water_units(p_method);
begin
  insert into public.shop_bills (user_id, kind, day, units, amount)
  values (p_user, 'rent', v_day, 1, public._rent_for(p_level, public._seat_count(p_user)))
  on conflict (user_id, day, kind) where kind <> 'fine' do nothing;

  insert into public.shop_bills (user_id, kind, day, units, amount)
  values (p_user, 'electric', v_day, v_elec, 2 * v_elec)
  on conflict (user_id, day, kind) where kind <> 'fine'
  do update set units = public.shop_bills.units + excluded.units, amount = public.shop_bills.amount + excluded.amount;

  insert into public.shop_bills (user_id, kind, day, units, amount)
  values (p_user, 'water', v_day, v_water, v_water)
  on conflict (user_id, day, kind) where kind <> 'fine'
  do update set units = public.shop_bills.units + excluded.units, amount = public.shop_bills.amount + excluded.amount;

  if p_revenue > 0 then
    insert into public.shop_bills (user_id, kind, day, units, base, amount)
    values (p_user, 'tax', v_day, 1, p_revenue, p_revenue * 5 / 100)
    on conflict (user_id, day, kind) where kind <> 'fine'
    do update set units = public.shop_bills.units + 1,
                  base = public.shop_bills.base + excluded.base,
                  amount = (public.shop_bills.base + excluded.base) * 5 / 100;
  end if;
end $$;

-- Chốt sổ ngày cũ, tính phí trễ hạn, tự trừ hóa đơn quá hạn (trừ thuế). Trả về số xu đã tự trừ.
-- Người gọi phải khoá profile trước.
create or replace function public._settle_bills(p_user uuid, p_now timestamptz)
returns bigint language plpgsql set search_path = '' as $$
declare
  v_today date := public._vn_day(p_now);
  v_coins bigint;
  v_total bigint := 0;
  v_take  bigint;
  b       public.shop_bills;
begin
  update public.shop_bills
  set status = case when amount > 0 then 'due' else 'paid' end,
      due_at = (day + 2)::timestamp at time zone 'Asia/Ho_Chi_Minh',
      paid_at = case when amount > 0 then null else p_now end
  where user_id = p_user and status = 'open' and day < v_today;

  update public.shop_bills set late_fee = (amount * 20 + 99) / 100
  where user_id = p_user and status = 'due' and due_at <= p_now and late_fee = 0;

  select coins into v_coins from public.profiles where id = p_user;
  for b in
    select * from public.shop_bills
    where user_id = p_user and status = 'due' and due_at <= p_now and kind <> 'tax'
    order by due_at, created_at
    for update
  loop
    exit when v_coins <= 0;
    v_take := least(v_coins, b.amount + b.late_fee - b.paid);
    update public.shop_bills
    set paid = paid + v_take,
        autopaid = true,
        status = case when paid + v_take >= amount + late_fee then 'paid' else 'due' end,
        paid_at = case when paid + v_take >= amount + late_fee then p_now else null end
    where id = b.id;
    perform public._log(p_user, 'bill_autopay', -v_take, 0, b.id,
      jsonb_build_object('kind', b.kind, 'day', b.day, 'late_fee', b.late_fee));
    v_coins := v_coins - v_take;
    v_total := v_total + v_take;
  end loop;

  if v_total > 0 then
    update public.profiles set coins = coins - v_total, updated_at = now() where id = p_user;
  end if;
  return v_total;
end $$;

create or replace function public._bill_json(b public.shop_bills, p_now timestamptz)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', b.id, 'kind', b.kind, 'day', b.day, 'units', b.units, 'base', b.base, 'amount', b.amount,
    'late_fee', b.late_fee, 'paid', b.paid, 'owed', b.amount + b.late_fee - b.paid, 'status', b.status,
    'autopaid', b.autopaid, 'due_at', b.due_at, 'overdue', b.status = 'due' and b.due_at <= p_now,
    'note', b.note, 'paid_at', b.paid_at, 'inspection_id', b.inspection_id
  );
$$;

-- Tóm tắt hóa đơn chưa đóng (cho thanh trên màn Tiệm).
create or replace function public._bills_summary(p_user uuid, p_now timestamptz)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'count', count(*),
    'owed', coalesce(sum(amount + late_fee - paid), 0),
    'overdue', count(*) filter (where due_at <= p_now),
    'tax_overdue', coalesce(sum(amount + late_fee - paid) filter (where kind = 'tax' and due_at <= p_now), 0)
  )
  from public.shop_bills
  where user_id = p_user and status = 'due';
$$;

-- Màn "Chi phí & thuế": chốt sổ + tự trừ rồi trả toàn bộ dữ liệu.
create or replace function public.get_bills(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v      public.profiles;
  v_auto bigint;
  v_now  timestamptz := now();
begin
  perform public._lock_profile(p_user);
  v_auto := public._settle_bills(p_user, v_now);
  select * into v from public.profiles where id = p_user;
  return jsonb_build_object(
    'day', public._vn_day(v_now),
    'coins', v.coins,
    'hygiene', v.hygiene,
    'clean_water', public._clean_water(v.hygiene),
    'autopaid', v_auto,
    'rates', public._ops_rates(v.level, public._seat_count(p_user)),
    'today', coalesce((
      select jsonb_agg(public._bill_json(b, v_now) order by b.kind)
      from public.shop_bills b where b.user_id = p_user and b.status = 'open'
    ), '[]'::jsonb),
    'due', coalesce((
      select jsonb_agg(public._bill_json(b, v_now) order by b.due_at, b.kind)
      from public.shop_bills b where b.user_id = p_user and b.status = 'due'
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(public._bill_json(b, v_now) order by b.paid_at desc nulls last, b.created_at desc)
      from public.shop_bills b
      where b.id in (
        select id from public.shop_bills
        where user_id = p_user and status in ('paid', 'audited') and amount > 0
        order by paid_at desc nulls last, created_at desc
        limit 20
      )
    ), '[]'::jsonb),
    'inspections', coalesce((
      select jsonb_agg(public._inspection_json(i.id) order by i.created_at desc)
      from (select id, created_at from public.inspections where user_id = p_user order by created_at desc limit 10) i
    ), '[]'::jsonb)
  );
end $$;

-- Đóng hóa đơn: p_ids = null → đóng tất cả hóa đơn đang chờ. Đủ xu mới đóng (không đóng một phần).
create or replace function public.pay_bills(p_user uuid, p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v        public.profiles;
  v_now    timestamptz := now();
  v_total  bigint;
  v_n      integer;
  v_ontime integer;
  v_kinds  jsonb;
begin
  if p_ids is not null and (cardinality(p_ids) not between 1 and 50) then
    perform public._fail('INVALID_INPUT');
  end if;
  perform public._lock_profile(p_user);
  perform public._settle_bills(p_user, v_now);
  v := public._lock_profile(p_user);

  perform 1 from public.shop_bills
  where user_id = p_user and status = 'due' and (p_ids is null or id = any (p_ids))
  for update;
  select count(*), coalesce(sum(amount + late_fee - paid), 0), count(*) filter (where due_at > v_now),
         coalesce(jsonb_agg(distinct kind), '[]'::jsonb)
  into v_n, v_total, v_ontime, v_kinds
  from public.shop_bills
  where user_id = p_user and status = 'due' and (p_ids is null or id = any (p_ids));

  if v_n = 0 then
    perform public._fail('NOT_FOUND');
  end if;
  if v.coins < v_total then
    perform public._fail('INSUFFICIENT_COINS');
  end if;
  perform public._rate_limit(p_user, 'bill_pay', 100, interval '1 day');

  update public.profiles set coins = coins - v_total, updated_at = now() where id = p_user;
  update public.shop_bills
  set paid = amount + late_fee, status = 'paid', paid_at = v_now
  where user_id = p_user and status = 'due' and (p_ids is null or id = any (p_ids));
  perform public._log(p_user, 'bill_pay', -v_total, 0, null,
    jsonb_build_object('count', v_n, 'on_time', v_ontime, 'kinds', v_kinds));

  return jsonb_build_object('paid', v_total, 'count', v_n, 'coins', v.coins - v_total);
end $$;

-- Dọn dẹp tiệm: vệ sinh về 100%, tốn nước (cộng vào hóa đơn nước hôm nay).
create or replace function public.clean_shop(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v       public.profiles;
  v_water integer;
begin
  v := public._lock_profile(p_user);
  if v.hygiene >= 100 then
    perform public._fail('ALREADY_CLEAN');
  end if;
  perform public._rate_limit(p_user, 'clean_shop', 60, interval '1 day');
  v_water := public._clean_water(v.hygiene);

  insert into public.shop_bills (user_id, kind, day, units, amount)
  values (p_user, 'water', public._today(), v_water, v_water)
  on conflict (user_id, day, kind) where kind <> 'fine'
  do update set units = public.shop_bills.units + excluded.units, amount = public.shop_bills.amount + excluded.amount;

  update public.profiles set hygiene = 100, updated_at = now() where id = p_user;
  perform public._log(p_user, 'clean_shop', 0, 0, null, jsonb_build_object('from', v.hygiene, 'water', v_water));
  return jsonb_build_object('hygiene', 100, 'water', v_water);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Thanh tra
-- ---------------------------------------------------------------------------

create or replace function public._inspection_json(p_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id, 'kind', i.kind, 'result', i.result, 'inspector', i.inspector, 'hygiene', i.hygiene,
    'findings', i.findings, 'fine', i.fine, 'reputation_delta', i.reputation_delta,
    'created_at', i.created_at, 'reveal_at', i.reveal_at,
    'fine_bill', (
      select jsonb_build_object('id', b.id, 'status', b.status, 'owed', b.amount + b.late_fee - b.paid, 'due_at', b.due_at)
      from public.shop_bills b where b.inspection_id = i.id and b.kind = 'fine' limit 1
    )
  )
  from public.inspections i where i.id = p_id;
$$;

-- Đoàn thanh tra tới: chấm ngay, ghi biên bản, lập hóa đơn phạt, cộng/trừ uy tín.
create or replace function public._run_inspection(p_user uuid, p_kind text, p_now timestamptz)
returns uuid language plpgsql set search_path = '' as $$
declare
  v        public.profiles;
  v_id     uuid := gen_random_uuid();
  v_find   jsonb := '[]'::jsonb;
  v_fine   bigint := 0;
  v_one    bigint;
  v_rep    integer;
  v_result text;
  v_name   text;
  v_last   timestamptz;
  v_n      integer;
  v_owed   bigint;
begin
  select * into v from public.profiles where id = p_user;

  if p_kind = 'food' then
    v_name := public._pick(array['Nguyễn Văn Nghiêm', 'Trần Thị Cẩn', 'Hoàng Minh Sạch', 'Đỗ Thu Kỹ']);
    v_one := 50 + 15 * v.level;
    if v.hygiene < 20 then
      v_fine := v_fine + 2 * v_one;
      v_find := v_find || jsonb_build_object('text', 'Tiệm rất bẩn (vệ sinh ' || v.hygiene || '%)', 'fine', 2 * v_one);
    elsif v.hygiene < 40 then
      v_fine := v_fine + v_one;
      v_find := v_find || jsonb_build_object('text', 'Vệ sinh kém (' || v.hygiene || '%)', 'fine', v_one);
    elsif v.hygiene < 70 then
      v_find := v_find || jsonb_build_object('text', 'Tiệm hơi bẩn (' || v.hygiene || '%) — nhắc nhở dọn dẹp', 'fine', 0);
    end if;

    -- Khách ngộ độc từ lần kiểm tra trước (trong 24 giờ).
    select max(created_at) into v_last from public.inspections where user_id = p_user and kind = 'food';
    select count(*) into v_n from public.customer_visits
    where user_id = p_user and status = 'poisoned'
      and served_at > greatest(coalesce(v_last, '-infinity'::timestamptz), p_now - interval '1 day');
    if v_n > 0 then
      v_one := v_n * (100 + 20 * v.level);
      v_fine := v_fine + v_one;
      v_find := v_find || jsonb_build_object('text', v_n || ' khách bị ngộ độc thực phẩm', 'fine', v_one);
    end if;

    v_result := case when v_fine > 0 then 'fined' when jsonb_array_length(v_find) > 0 then 'warning' else 'pass' end;
    v_rep := case v_result when 'pass' then 2 when 'warning' then 0 else case when v_n > 0 then -5 else -3 end end;
  else
    v_name := public._pick(array['Lê Minh Chính', 'Phạm Thu Thanh', 'Vũ Đức Liêm', 'Bùi Ngọc Minh']);
    select coalesce(sum(amount + late_fee - paid), 0) into v_owed from public.shop_bills
    where user_id = p_user and kind = 'tax' and status = 'due' and due_at <= p_now;
    if v_owed > 0 then
      -- Trốn thuế: truy thu + phạt 100% (hóa đơn thuế cũ gộp vào tiền phạt, đóng lại bên dưới).
      v_fine := 2 * v_owed;
      v_find := v_find || jsonb_build_object('text', 'Nợ thuế quá hạn ' || public._fmt_coins(v_owed) || ' ₵ — truy thu + phạt 100%', 'fine', v_fine);
    else
      select coalesce(sum(amount + late_fee - paid), 0) into v_owed from public.shop_bills
      where user_id = p_user and kind = 'tax' and status = 'due';
      if v_owed > 0 then
        v_find := v_find || jsonb_build_object('text', 'Còn ' || public._fmt_coins(v_owed) || ' ₵ thuế chưa tới hạn — nhắc đóng đúng hạn', 'fine', 0);
      end if;
    end if;
    v_result := case when v_fine > 0 then 'fined' when jsonb_array_length(v_find) > 0 then 'warning' else 'pass' end;
    v_rep := case v_result when 'pass' then 1 when 'warning' then 0 else -3 end;
  end if;

  insert into public.inspections (id, user_id, kind, result, inspector, hygiene, findings, fine, reputation_delta, created_at, reveal_at)
  values (v_id, p_user, p_kind, v_result, v_name, case when p_kind = 'food' then v.hygiene end,
          v_find, v_fine, v_rep, p_now, p_now + interval '20 seconds');

  if p_kind = 'tax' and v_fine > 0 then
    update public.shop_bills set status = 'audited', inspection_id = v_id
    where user_id = p_user and kind = 'tax' and status = 'due' and due_at <= p_now;
  end if;
  if v_fine > 0 then
    insert into public.shop_bills (user_id, kind, day, units, amount, status, due_at, inspection_id, note)
    values (p_user, 'fine', public._vn_day(p_now), 1, v_fine, 'due', p_now + interval '1 day', v_id,
            case p_kind when 'food' then 'Phạt vi phạm an toàn thực phẩm' else 'Truy thu thuế + phạt trốn thuế' end);
  end if;
  if v_rep <> 0 then
    update public.profiles set reputation = greatest(0, reputation + v_rep), updated_at = now() where id = p_user;
  end if;
  perform public._log(p_user, 'inspection', 0, 0, v_id,
    jsonb_build_object('kind', p_kind, 'result', v_result, 'fine', v_fine, 'reputation', v_rep));
  return v_id;
end $$;

-- Tung xác suất thanh tra ở mỗi nhịp khách (~15 giây/lần khi đang mở màn Tiệm).
--   Thực phẩm: ~1 lần / 3,5 giờ chơi; vệ sinh < 40% → ~1 lần / 50 phút; mỗi khách ngộ độc gần đây +3%/nhịp.
--   Thuế: ~1 lần / 5 giờ chơi; đang nợ thuế quá hạn → ~1 lần / 50 phút.
--   Mỗi loại cách nhau ≥ 40 phút, 2 lần bất kỳ cách nhau ≥ 10 phút, tối đa 4 lần / 24 giờ.
create or replace function public._maybe_inspect(p_user uuid, p_now timestamptz)
returns uuid language plpgsql set search_path = '' as $$
declare
  v           public.profiles;
  v_last_food timestamptz;
  v_last_tax  timestamptz;
  v_last_any  timestamptz;
  v_count     integer;
  v_reports   integer;
  v_p_food    numeric;
  v_p_tax     numeric;
begin
  select * into v from public.profiles where id = p_user;
  if not v.shop_open or v.last_seen_at is null or v.last_seen_at < p_now - interval '90 seconds'
     or v.created_at > p_now - interval '6 hours' then
    return null;
  end if;

  select max(created_at) filter (where kind = 'food'), max(created_at) filter (where kind = 'tax'),
         max(created_at), count(*)
  into v_last_food, v_last_tax, v_last_any, v_count
  from public.inspections where user_id = p_user and created_at > p_now - interval '1 day';
  if v_count >= 4 or v_last_any > p_now - interval '10 minutes' then
    return null;
  end if;

  select count(*) into v_reports from public.customer_visits
  where user_id = p_user and status = 'poisoned'
    and served_at > greatest(coalesce(v_last_food, '-infinity'::timestamptz), p_now - interval '1 hour');
  v_p_food := 0.0012 + case when v.hygiene < 40 then 0.004 else 0 end + 0.03 * v_reports;
  v_p_tax := 0.0008 + case when exists (
    select 1 from public.shop_bills
    where user_id = p_user and kind = 'tax' and status = 'due' and due_at <= p_now
  ) then 0.004 else 0 end;

  if (v_last_food is null or v_last_food < p_now - interval '40 minutes') and random() < v_p_food then
    return public._run_inspection(p_user, 'food', p_now);
  end if;
  if (v_last_tax is null or v_last_tax < p_now - interval '40 minutes') and random() < v_p_tax then
    return public._run_inspection(p_user, 'tax', p_now);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Lì xì
-- ---------------------------------------------------------------------------

create or replace function public._envelope_progress(p_user uuid, p_day date)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_from   timestamptz := p_day::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_to     timestamptz := (p_day + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_online integer;
  v_serve  integer;
  v_sale   integer;
  v_quests integer;
  v_bills  integer;
  v_pass   integer;
begin
  select case when online_day = p_day then online_seconds / 60 else 0 end into v_online
  from public.profiles where id = p_user;

  select count(*) into v_serve from public.customer_visits
  where user_id = p_user and status in ('served', 'dashed', 'poisoned')
    and created_at >= v_from - interval '10 minutes'
    and coalesce(served_at, arrive_at) >= v_from and coalesce(served_at, arrive_at) < v_to;

  select count(*) filter (where kind = 'market_sale'), count(*) filter (where kind = 'quest_reward'),
         count(*) filter (where kind = 'bill_pay')
  into v_sale, v_quests, v_bills
  from public.transactions_log
  where user_id = p_user and created_at >= v_from and created_at < v_to
    and kind in ('market_sale', 'quest_reward', 'bill_pay');

  select count(*) into v_pass from public.inspections
  where user_id = p_user and result = 'pass' and created_at >= v_from and created_at < v_to;

  return jsonb_build_object(
    'online_minutes', coalesce(v_online, 0), 'serve', v_serve, 'market_sale', v_sale,
    'quests', v_quests, 'bill_pay', v_bills, 'inspection_pass', v_pass
  );
end $$;

-- Phát bao lì xì cho các mốc đã đạt hôm nay (mỗi mốc 1 bao/ngày). Trả về số bao mới.
create or replace function public._grant_envelopes(p_user uuid)
returns integer language plpgsql set search_path = '' as $$
declare
  v_day  date := public._today();
  v_prog jsonb;
  v_n    integer;
begin
  if (select count(*) from public.lucky_envelopes where user_id = p_user and day = v_day)
     >= (select count(*) from public.envelope_catalog) then
    return 0;
  end if;
  v_prog := public._envelope_progress(p_user, v_day);
  insert into public.lucky_envelopes (user_id, day, source)
  select p_user, v_day, e.code from public.envelope_catalog e
  where coalesce((v_prog ->> e.metric)::integer, 0) >= e.target
  on conflict (user_id, day, source) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.get_envelopes(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_day  date := public._today();
  v_new  integer;
  v_prog jsonb;
begin
  perform public._lock_profile(p_user);
  v_new := public._grant_envelopes(p_user);
  v_prog := public._envelope_progress(p_user, v_day);
  return jsonb_build_object(
    'day', v_day,
    'resets_at', (v_day + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh',
    'new', v_new,
    'milestones', (
      select jsonb_agg(jsonb_build_object(
        'code', e.code, 'title', e.title, 'description', e.description, 'target', e.target,
        'progress', least(e.target, coalesce((v_prog ->> e.metric)::integer, 0)),
        'earned', exists (select 1 from public.lucky_envelopes l where l.user_id = p_user and l.day = v_day and l.source = e.code)
      ) order by e.sort)
      from public.envelope_catalog e
    ),
    'unopened', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'source', l.source, 'title', e.title, 'day', l.day, 'created_at', l.created_at)
                       order by l.created_at)
      from public.lucky_envelopes l join public.envelope_catalog e on e.code = l.source
      where l.user_id = p_user and l.opened_at is null
    ), '[]'::jsonb),
    'opened_today', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'title', e.title, 'coins', l.coins, 'gems', l.gems, 'wish', l.wish, 'opened_at', l.opened_at)
                       order by l.opened_at desc)
      from public.lucky_envelopes l join public.envelope_catalog e on e.code = l.source
      where l.user_id = p_user and l.opened_at is not null and l.opened_at >= v_day::timestamp at time zone 'Asia/Ho_Chi_Minh'
    ), '[]'::jsonb)
  );
end $$;

-- Phần thưởng theo 2 số ngẫu nhiên [0, 1): p_roll chọn bậc, p_pick chọn mức trong bậc. Kỳ vọng ~77 ₵/bao.
--   30% chỉ có lời chúc · 30% 10–50 ₵ · 22% 68–99 ₵ · 12% 168–268 ₵ · 3% 368–568 ₵
--   2% 88 ₵ + 2 gem · 1% 888 ₵ + 2 gem.
create or replace function public._envelope_reward(p_roll double precision, p_pick double precision)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'coins', case
      when p_roll < 0.30 then 0
      when p_roll < 0.60 then (array[10, 20, 36, 50])[1 + floor(p_pick * 4)::int]
      when p_roll < 0.82 then (array[68, 86, 99])[1 + floor(p_pick * 3)::int]
      when p_roll < 0.94 then (array[168, 186, 268])[1 + floor(p_pick * 3)::int]
      when p_roll < 0.97 then (array[368, 568])[1 + floor(p_pick * 2)::int]
      when p_roll < 0.99 then 88
      else 888
    end,
    'gems', case when p_roll >= 0.97 then 2 else 0 end
  );
$$;

-- Mở bao lì xì: server tung ngẫu nhiên tiền thưởng hoặc chỉ một lời chúc.
create or replace function public.open_envelope(p_user uuid, p_envelope uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e        public.lucky_envelopes;
  v_reward jsonb := public._envelope_reward(random(), random());
  v_coins  integer := (v_reward ->> 'coins')::integer;
  v_gems   integer := (v_reward ->> 'gems')::integer;
  v_wish   text;
begin
  perform public._lock_profile(p_user);
  select * into e from public.lucky_envelopes where id = p_envelope and user_id = p_user for update;
  if not found then
    perform public._fail('NOT_FOUND');
  end if;
  if e.opened_at is not null then
    perform public._fail('ALREADY_OPENED');
  end if;
  perform public._rate_limit(p_user, 'envelope_open', 60, interval '1 day');

  v_wish := public._pick(array[
    'An khang thịnh vượng', 'Vạn sự như ý', 'Tấn tài tấn lộc', 'Buôn may bán đắt', 'Khách vào nườm nượp',
    'Tiền vô như nước', 'Phát tài phát lộc', 'Sức khoẻ dồi dào', 'Mã đáo thành công', 'Lò lúc nào cũng đỏ lửa',
    'Bánh nướng vàng ươm, khách thương ghé hoài', 'Năm mới bình an, tiệm luôn đông khách']);

  update public.lucky_envelopes set opened_at = now(), coins = v_coins, gems = v_gems, wish = v_wish where id = e.id;
  if v_coins > 0 or v_gems > 0 then
    update public.profiles set coins = coins + v_coins, gems = gems + v_gems, updated_at = now() where id = p_user;
  end if;
  perform public._log(p_user, 'envelope_open', v_coins, v_gems, e.id, jsonb_build_object('source', e.source));
  return jsonb_build_object('coins', v_coins, 'gems', v_gems, 'wish', v_wish, 'lucky', v_coins > 0);
end $$;

-- ---------------------------------------------------------------------------
-- 7. Online: đếm thời gian hoạt động trong ngày (cho lì xì)
-- ---------------------------------------------------------------------------

-- Ghi lần hoạt động + cộng thời gian online từ lần trước (nếu trong 90 giây, tối đa 60 giây/lần).
create or replace function public._touch_online(p_user uuid, p_now timestamptz)
returns timestamptz language sql set search_path = '' as $$
  update public.profiles p
  set online_seconds = case when p.online_day = public._vn_day(p_now) then p.online_seconds else 0 end
        + case when p.last_seen_at > p_now - interval '90 seconds' and p.last_seen_at < p_now
               then least(60, floor(extract(epoch from p_now - p.last_seen_at)))::integer else 0 end,
      online_day = public._vn_day(p_now),
      last_seen_at = p_now
  where p.id = p_user
  returning p.last_seen_at;
$$;

create or replace function public.heartbeat(p_user uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('last_seen_at', public._touch_online(p_user, now()));
$$;

-- ---------------------------------------------------------------------------
-- 8. Nhịp khách: thêm phần vận hành (hóa đơn, thanh tra, lì xì)
-- ---------------------------------------------------------------------------

create or replace function public._ops_tick(p_user uuid, p_now timestamptz)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_auto bigint;
  v_new  integer;
  v_insp uuid;
  v      public.profiles;
begin
  v_auto := public._settle_bills(p_user, p_now);
  perform public._maybe_inspect(p_user, p_now);
  v_new := public._grant_envelopes(p_user);
  select * into v from public.profiles where id = p_user;
  select id into v_insp from public.inspections
  where user_id = p_user and created_at > p_now - interval '3 minutes'
  order by created_at desc limit 1;

  return jsonb_build_object(
    'hygiene', v.hygiene,
    'coins', v.coins,
    'autopaid', v_auto,
    'bills', public._bills_summary(p_user, p_now),
    'inspection', case when v_insp is not null then public._inspection_json(v_insp) end,
    'envelopes_new', v_new,
    'envelopes_unopened', (select count(*) from public.lucky_envelopes where user_id = p_user and opened_at is null)
  );
end $$;

-- Xử lý nhịp TRƯỚC rồi mới ghi lần hoạt động (để biết người chơi vừa offline hay không).
create or replace function public.customer_tick(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  v_result := public._customer_tick_at(p_user, now());
  v_result := v_result || jsonb_build_object('ops', public._ops_tick(p_user, now()));
  perform public._touch_online(p_user, now());
  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Đơn hàng: ngộ độc + vệ sinh + hóa đơn (bản 0011 + phần mới)
-- ---------------------------------------------------------------------------

create or replace function public._visit_json(p_visit uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', v.id, 'status', v.status, 'arrive_at', v.arrive_at, 'leave_at', v.leave_at,
    'recipe', v.recipe_code, 'recipe_name', r.name, 'recipe_image', r.image,
    'sauce', v.sauce_code, 'sauce_name', s.name, 'topping', v.topping_code, 'topping_name', t.name,
    'customer', jsonb_build_object(
      'id', c.id, 'name', c.name, 'gender', c.gender, 'personality', c.personality, 'bio', c.bio,
      'impatient', c.impatient, 'dine_and_dash', c.dine_and_dash, 'picky', c.picky,
      'min_quality', c.min_quality, 'look', c.look, 'image', c.image, 'sensitive', c.sensitive)
  )
  from public.customer_visits v
  join public.customers c on c.id = v.customer_id
  join public.recipes r on r.code = v.recipe_code
  left join public.ingredients s on s.code = v.sauce_code
  left join public.ingredients t on t.code = v.topping_code
  where v.id = p_visit;
$$;

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
  v_dirt   integer;
  v_poison_pct integer;
  v_poisoned boolean;
  v_comp   bigint;
begin
  if p_ingredients is null or cardinality(p_ingredients) > 12
     or p_method not in ('bake', 'fry', 'steam', 'chill') or p_packaging not in ('box', 'bag')
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

  -- Ngộ độc: chỉ khi làm sai / bếp bẩn / khách bụng yếu (xem _poison_chance).
  v_poison_pct := public._poison_chance(p_method <> r.cook_method, p_scores[2], v_extra, v.hygiene, c.sensitive, v_q);
  v_poisoned := v_poison_pct > 0 and random() * 100 < v_poison_pct;

  v_xp := v.xp + r.xp;
  v_level := public._level_for_xp(v_xp);
  v_dirt := case when p_method = 'fry' then 3 else 2 end;
  update public.bake_sessions set status = 'done', quality = v_q, completed_at = now() where id = s.id;
  -- Điện/nước dùng cho mọi đơn đã nấu; thuế chỉ tính trên tiền khách thật sự trả.
  perform public._accrue_bills(p_user, v.level, p_method, case when v_poisoned or v_dash then 0 else v_paid end);

  if v_poisoned then
    -- Khách không trả tiền, tiệm bồi thường viện phí bằng giá món (tối đa số xu đang có).
    v_comp := least(v.coins, v_price);
    v_notes := v_notes || 'Khách bị ngộ độc thực phẩm'::text;
    update public.profiles
    set coins = coins - v_comp, reputation = greatest(0, reputation - 3),
        xp = v_xp, level = v_level, hygiene = greatest(0, hygiene - v_dirt), updated_at = now()
    where id = p_user;
    update public.customer_visits
    set status = 'poisoned', quality = v_q, paid = 0, tip = 0, reputation_delta = -3,
        result = jsonb_build_object('notes', to_jsonb(v_notes), 'compensation', v_comp)
    where id = cv.id;
    perform public._log(p_user, 'order', -v_comp, 0, cv.id,
      jsonb_build_object('customer', c.id, 'recipe', r.code, 'quality', v_q, 'poisoned', true,
                         'compensation', v_comp, 'poison_pct', v_poison_pct, 'scores', to_jsonb(p_scores)));
    return jsonb_build_object('dashed', false, 'poisoned', true, 'paid', 0, 'tip', 0, 'compensation', v_comp,
      'quality', v_q, 'score', v_score, 'reputation_delta', -3, 'notes', to_jsonb(v_notes),
      'xp_gained', r.xp, 'level', v_level, 'leveled_up', v_level > v.level, 'customer', c.name,
      'hygiene', greatest(0, v.hygiene - v_dirt));
  end if;

  if v_dash then
    update public.profiles
    set xp = v_xp, level = v_level, hygiene = greatest(0, hygiene - v_dirt), updated_at = now()
    where id = p_user;
    update public.customer_visits set status = 'dashed', quality = v_q, paid = 0, tip = 0, reputation_delta = 0,
      result = jsonb_build_object('notes', to_jsonb(v_notes), 'lost', v_paid) where id = cv.id;
    perform public._log(p_user, 'order', 0, 0, cv.id,
      jsonb_build_object('customer', c.id, 'recipe', r.code, 'quality', v_q, 'dashed', true, 'scores', to_jsonb(p_scores)));
    return jsonb_build_object('dashed', true, 'poisoned', false, 'lost', v_paid, 'quality', v_q, 'score', v_score,
      'notes', to_jsonb(v_notes), 'xp_gained', r.xp, 'level', v_level, 'leveled_up', v_level > v.level,
      'customer', c.name, 'hygiene', greatest(0, v.hygiene - v_dirt));
  end if;

  update public.profiles
  set coins = coins + v_paid,
      revenue_total = revenue_total + v_paid,
      revenue_today = case when revenue_day = v_today then revenue_today + v_paid else v_paid end,
      revenue_day = v_today,
      reputation = greatest(0, reputation + v_rep),
      xp = v_xp, level = v_level,
      hygiene = greatest(0, hygiene - v_dirt),
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
    'dashed', false, 'poisoned', false, 'paid', v_paid, 'tip', v_tip, 'quality', v_q, 'score', v_score,
    'reputation_delta', v_rep, 'notes', to_jsonb(v_notes), 'tired', v_tired,
    'xp_gained', r.xp, 'level', v_level, 'leveled_up', v_level > v.level, 'customer', c.name,
    'hygiene', greatest(0, v.hygiene - v_dirt)
  );
end $$;

-- ---------------------------------------------------------------------------
-- 10. Đánh giá + mốc giờ giao cho đơn ngộ độc / quịt
-- ---------------------------------------------------------------------------

-- served_at = lúc giao bánh (cả khi khách quịt hoặc ngộ độc).
create or replace function public._visits_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('served', 'dashed', 'poisoned') and old.status is distinct from new.status then
    new.served_at := now();
  end if;
  return new;
end $$;

create or replace function public._visits_after_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c        public.customers;
  v_stars  integer;
  v_wrong  boolean;
begin
  if new.status = old.status then
    return new;
  end if;
  select * into c from public.customers where id = new.customer_id;

  if new.status = 'served' then
    v_wrong := coalesce(new.result->'notes' ? 'Sai nước chấm/topping khách gọi', false);
    v_stars := new.quality - case when c.picky and new.quality < 5 then 1 else 0 end
                           - case when v_wrong then 1 else 0 end;
    v_stars := greatest(1, least(5, v_stars));
    insert into public.reviews (user_id, visit_id, customer_id, stars, comment)
    values (new.user_id, new.id, c.id, v_stars, public._review_comment(v_stars, c, false, v_wrong))
    on conflict (visit_id) do nothing;
  elsif new.status = 'poisoned' then
    insert into public.reviews (user_id, visit_id, customer_id, stars, comment)
    values (new.user_id, new.id, c.id, 1, public._pick(array[
      'Ăn xong đau bụng cả đêm, phải đi viện!', 'Bánh có vấn đề, tôi bị ngộ độc rồi.',
      'Không đảm bảo vệ sinh, tôi sẽ báo thanh tra!', 'Đau bụng quá, không bao giờ quay lại.',
      'Bánh sống/khét mà vẫn bán cho khách, quá tệ.']))
    on conflict (visit_id) do nothing;
  elsif new.status = 'left' and (c.impatient or old.status = 'cooking') then
    insert into public.reviews (user_id, visit_id, customer_id, stars, comment)
    values (new.user_id, new.id, c.id, 1, public._review_comment(1, c, true, false))
    on conflict (visit_id) do nothing;
  end if;
  return new;
end $$;

-- Nhiệm vụ: đơn bị ngộ độc vẫn tính là "đã giao" (như đơn bị quịt); doanh thu/tip chỉ tính đơn đã trả tiền.
create or replace function public._quest_progress(p_user uuid, p_day date, q public.quest_catalog)
returns integer language plpgsql stable set search_path = '' as $$
declare
  v_from timestamptz := p_day::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_to   timestamptz := (p_day + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_n    bigint;
begin
  if q.metric in ('buy_qty', 'buy_kinds', 'reply', 'checkin', 'market_list', 'market_buy', 'upgrade') then
    select case q.metric
      when 'buy_qty'     then coalesce(sum((t.meta->>'qty')::bigint) filter (where t.kind = 'buy_ingredient'), 0)
      when 'buy_kinds'   then count(distinct t.meta->>'item') filter (where t.kind = 'buy_ingredient')
      when 'reply'       then count(*) filter (where t.kind = 'review_reply')
      when 'checkin'     then count(*) filter (where t.kind = 'daily_checkin')
      when 'market_list' then count(*) filter (where t.kind = 'listing_create')
      when 'market_buy'  then count(*) filter (where t.kind = 'market_buy')
      when 'upgrade'     then count(*) filter (where t.kind = 'buy_upgrade')
    end into v_n
    from public.transactions_log t
    where t.user_id = p_user and t.created_at >= v_from and t.created_at < v_to;
  else
    select case q.metric
      when 'serve'           then count(*)
      when 'serve_q'         then count(*) filter (where v.quality >= q.n1)
      when 'serve_method'    then count(*) filter (where r.cook_method = q.param)
      when 'serve_pack'      then count(*) filter (where r.packaging = q.param)
      when 'serve_recipe'    then count(*) filter (where v.recipe_code = q.param)
      when 'serve_minlvl'    then count(*) filter (where r.unlock_level >= q.n1)
      when 'serve_picky'     then count(*) filter (where c.picky and v.status = 'served' and v.quality >= c.min_quality)
      when 'serve_impatient' then count(*) filter (where c.impatient)
      when 'serve_dash'      then count(*) filter (where c.dine_and_dash and v.status = 'served')
      when 'serve_sauce'     then count(*) filter (where v.sauce_code is not null)
      when 'serve_topping'   then count(*) filter (where v.topping_code is not null)
      when 'serve_exact'     then count(*) filter (where v.status = 'served' and v.tip > 0)
      when 'serve_distinct'  then count(distinct v.recipe_code)
      when 'serve_rush'      then count(*) filter (where public._traffic_mult(public._game_minute(v.done_at)) >= 1.5)
      when 'serve_quiet'     then count(*) filter (where public._traffic_mult(public._game_minute(v.done_at)) between 0.01 and 0.5)
      when 'serve_window'    then count(*) filter (where public._game_minute(v.done_at) >= q.n1 and public._game_minute(v.done_at) < q.n2)
      when 'revenue'         then coalesce(sum(v.paid) filter (where v.status = 'served'), 0)
      when 'tips'            then coalesce(sum(v.tip) filter (where v.status = 'served'), 0)
      when 'rep'             then coalesce(sum(greatest(v.reputation_delta, 0)) filter (where v.status = 'served'), 0)
    end into v_n
    from (
      select cv.*, coalesce(cv.served_at, cv.arrive_at) as done_at
      from public.customer_visits cv
      where cv.user_id = p_user and cv.status in ('served', 'dashed', 'poisoned')
        and cv.created_at >= v_from - interval '10 minutes'
        and coalesce(cv.served_at, cv.arrive_at) >= v_from and coalesce(cv.served_at, cv.arrive_at) < v_to
    ) v
    join public.recipes r on r.code = v.recipe_code
    join public.customers c on c.id = v.customer_id;
  end if;
  return least(coalesce(v_n, 0), 2147483647)::integer;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Quyền
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.customer_tick(uuid),
  public.heartbeat(uuid),
  public.complete_order(uuid, uuid, text[], text, integer[], text, text, text),
  public.get_bills(uuid),
  public.pay_bills(uuid, uuid[]),
  public.clean_shop(uuid),
  public.get_envelopes(uuid),
  public.open_envelope(uuid, uuid)
to service_role;
