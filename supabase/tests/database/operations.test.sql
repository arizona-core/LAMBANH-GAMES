-- Test vận hành tiệm: ngộ độc, vệ sinh, hóa đơn, thuế, thanh tra, lì xì + RLS. Chạy: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(84);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'ops-a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'ops-b@test.local');
select public.create_profile('00000000-0000-0000-0000-0000000000a1', 'Ops A', 'Tiệm Vận Hành A', 'a1', 'caramel');
select public.create_profile('00000000-0000-0000-0000-0000000000b1', 'Ops B', 'Tiệm Vận Hành B', 'a2', 'mint');

-- Đủ nguyên liệu cho nhiều đơn bánh mì.
select public._add_inventory('00000000-0000-0000-0000-0000000000a1', code, 100)
from unnest(array['flour', 'water', 'yeast', 'salt', 'sugar', 'sauce_garlic', 'top_cheese']) code;

-- Dựng 1 đơn đang làm, đã qua thời gian tối thiểu.
create function pg_temp.order_ready(p_user uuid, p_visit uuid, p_customer integer, p_sauce text, p_topping text)
returns void language plpgsql as $$
begin
  insert into public.customer_visits (id, user_id, customer_id, recipe_code, sauce_code, topping_code, arrive_at, leave_at)
  values (p_visit, p_user, p_customer, 'bread', p_sauce, p_topping, now() - interval '5 seconds', now() + interval '60 seconds');
  perform public.accept_order(p_user, p_visit);
  update public.bake_sessions set started_at = now() - interval '1 minute' where visit_id = p_visit;
end $$;

-- ---------------------------------------------------------------- xác suất ngộ độc
select is(public._poison_chance(false, 90, 0, 100, false, 5), 0, 'làm đúng, bếp sạch → không ngộ độc');
select is(public._poison_chance(true, 90, 0, 100, false, 2), 30, 'sai cách nấu → 30%');
select is(public._poison_chance(false, 10, 0, 100, false, 3), 15, 'lấy bánh ra quá sớm/trễ → 15%');
select is(public._poison_chance(false, 90, 2, 100, false, 3), 16, 'mỗi nguyên liệu lạ +8%');
select is(public._poison_chance(false, 90, 0, 40, false, 5), 8, 'bếp bẩn (< 50%) → 8%');
select is(public._poison_chance(false, 90, 0, 10, false, 5), 20, 'bếp rất bẩn (< 25%) → 20%');
select is(public._poison_chance(false, 90, 0, 100, true, 2), 5, 'khách bụng yếu + bánh 2★ → 5% dù làm đúng');
select is(public._poison_chance(true, 10, 3, 0, true, 1), 70, 'tối đa 70%');
select ok((select count(*) from public.customers where sensitive) between 25 and 110, 'có khoảng 12% khách bụng yếu');

-- ---------------------------------------------------------------- đơn đúng: hóa đơn + vệ sinh
update public.customers set dine_and_dash = false, dine_dash_pct = 0, picky = false, min_quality = 1, spend = 3, sensitive = false
where id in (1, 2);
select pg_temp.order_ready('00000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000001', 1, 'sauce_garlic', 'top_cheese');
create temp table t_ok as
  select public.complete_order('00000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000001',
    array['flour', 'water', 'yeast', 'salt', 'sugar'], 'bake', array[95, 95], 'sauce_garlic', 'top_cheese', 'bag') as r;
select is(((select r from t_ok) ->> 'poisoned')::boolean, false, 'làm đúng không ngộ độc');
select is(((select r from t_ok) ->> 'paid')::int, 100, 'tiền đơn như cũ');
select is((select hygiene from public.profiles where id = '00000000-0000-0000-0000-0000000000a1')::int, 98, 'mỗi đơn nướng −2% vệ sinh');

create temp table t_bills as
  select kind, units, base, amount, status from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000a1';
select is((select amount from t_bills where kind = 'rent')::int, 60, 'tiền nhà cấp 1, 2 chỗ ngồi = 60 ₵/ngày');
select is((select units || '/' || amount from t_bills where kind = 'electric'), '2/4', 'nướng 2 kWh × 2 ₵');
select is((select units || '/' || amount from t_bills where kind = 'water'), '1/1', 'mỗi đơn 1 m³ nước');
select is((select base || '/' || amount from t_bills where kind = 'tax'), '100/5', 'thuế 5% tiền khách trả');
select is((select count(*) from t_bills where status = 'open')::int, 4, 'hóa đơn hôm nay đang tạm tính');

-- Đơn thứ 2 cùng ngày: không tính thêm tiền nhà.
select pg_temp.order_ready('00000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000002', 1, 'sauce_garlic', 'top_cheese');
select public.complete_order('00000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-000000000002',
  array['flour', 'water', 'yeast', 'salt', 'sugar'], 'bake', array[95, 95], 'sauce_garlic', 'top_cheese', 'bag');
select is((select amount || '/' || units from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'rent'),
  '60/1', 'tiền nhà chỉ tính 1 lần/ngày');

-- ---------------------------------------------------------------- ngộ độc (bếp bẩn + sai cách nấu + khách bụng yếu ≈ 70%/đơn)
update public.profiles set reputation = 50 where id = '00000000-0000-0000-0000-0000000000a1';
update public.customers set sensitive = true where id = 2;
create temp table t_poison (visit uuid, r jsonb, coins_before bigint, rep_before integer, tries integer);
do $$
declare
  i      integer := 0;
  v_id   uuid;
  v_r    jsonb;
  v_c    bigint;
  v_rep  integer;
begin
  loop
    i := i + 1;
    update public.profiles set hygiene = 10 where id = '00000000-0000-0000-0000-0000000000a1';
    v_id := gen_random_uuid();
    perform pg_temp.order_ready('00000000-0000-0000-0000-0000000000a1', v_id, 2, null, null);
    select coins, reputation into v_c, v_rep from public.profiles where id = '00000000-0000-0000-0000-0000000000a1';
    v_r := public.complete_order('00000000-0000-0000-0000-0000000000a1', v_id,
      array['flour', 'water', 'yeast', 'salt', 'sugar'], 'fry', array[90, 90], null, null, 'bag');
    exit when (v_r ->> 'poisoned')::boolean or i >= 20;
  end loop;
  insert into t_poison values (v_id, v_r, v_c, v_rep, i);
end $$;

select ok(((select r from t_poison) ->> 'poisoned')::boolean, 'làm sai ở bếp bẩn → khách ngộ độc');
select is((select status from public.customer_visits where id = (select visit from t_poison)), 'poisoned', 'đơn ghi trạng thái ngộ độc');
select is(((select r from t_poison) ->> 'paid')::int, 0, 'khách ngộ độc không trả tiền');
select ok(((select r from t_poison) ->> 'compensation')::int > 0, 'tiệm phải bồi thường');
select is((select coins from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  (select coins_before - (r ->> 'compensation')::bigint from t_poison), 'trừ đúng tiền bồi thường');
select is((select reputation from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  (select rep_before - 3 from t_poison), 'ngộ độc −3 uy tín');
select is((select stars from public.reviews where visit_id = (select visit from t_poison))::int, 1, 'khách ngộ độc để lại 1 sao');
select ok((select served_at is not null from public.customer_visits where id = (select visit from t_poison)), 'ghi giờ giao bánh');
select is((select base from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'tax'),
  (select sum(paid)::bigint from public.customer_visits where user_id = '00000000-0000-0000-0000-0000000000a1' and status = 'served'),
  'thuế chỉ tính trên tiền khách đã trả');
select ok((select units from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'electric')
          >= 4 + (select tries from t_poison), 'đơn ngộ độc vẫn tốn điện');

-- ---------------------------------------------------------------- dọn dẹp
update public.profiles set hygiene = 30 where id = '00000000-0000-0000-0000-0000000000a1';
create temp table t_water as select units from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'water';
select is((public.clean_shop('00000000-0000-0000-0000-0000000000a1') ->> 'water')::int, 16, 'dọn từ 30% tốn 2 + 70/5 = 16 m³');
select is((select hygiene from public.profiles where id = '00000000-0000-0000-0000-0000000000a1')::int, 100, 'dọn xong sạch 100%');
select is((select units from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'water'),
  (select units + 16 from t_water), 'nước dọn dẹp cộng vào hóa đơn nước');
select throws_ok($$ select public.clean_shop('00000000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'ALREADY_CLEAN', 'tiệm đã sạch thì không dọn nữa');

-- ---------------------------------------------------------------- chốt sổ, trễ hạn, tự trừ
select is(public._settle_bills('00000000-0000-0000-0000-0000000000a1', now() + interval '1 day'), 0::bigint,
  'sang ngày mới: chốt sổ, chưa quá hạn nên chưa tự trừ');
select is((select count(*) from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000a1' and status = 'due')::int, 4,
  'hóa đơn hôm qua chuyển sang chờ đóng');
select is((select due_at from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'rent'),
  ((public._today() + 2)::timestamp at time zone 'Asia/Ho_Chi_Minh'), 'hạn đóng: hết ngày hôm sau');

create temp table t_settle as
  select sum(amount + (amount * 20 + 99) / 100)::bigint as expected,
         (select coins from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') as coins_before
  from public.shop_bills
  where user_id = '00000000-0000-0000-0000-0000000000a1' and kind in ('rent', 'electric', 'water');
select is(public._settle_bills('00000000-0000-0000-0000-0000000000a1', now() + interval '3 days'), (select expected from t_settle),
  'quá hạn: tự trừ tiền nhà/điện/nước kèm phí trễ 20%');
select is((select coins from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  (select coins_before - expected from t_settle), 'xu bị trừ đúng');
select is((select count(*) from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000a1'
           and kind in ('rent', 'electric', 'water') and status = 'paid' and autopaid)::int, 3, 'đánh dấu tự trừ');
select is((select status from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'tax'), 'due',
  'thuế không tự trừ (trốn thuế thì chờ thanh tra)');
select is((select late_fee from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'tax'),
  (select (amount * 20 + 99) / 100 from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'tax'),
  'thuế quá hạn cũng bị phí trễ 20%');

-- Nghèo: chỉ trừ được số xu đang có, phần còn lại nợ tiếp.
insert into public.shop_bills (user_id, kind, day, amount, status, due_at)
values ('00000000-0000-0000-0000-0000000000b1', 'rent', public._today() - 3, 100, 'due', now() - interval '1 hour');
update public.profiles set coins = 30 where id = '00000000-0000-0000-0000-0000000000b1';
select is(public._settle_bills('00000000-0000-0000-0000-0000000000b1', now()), 30::bigint, 'không đủ xu: trừ hết số đang có');
select is((select paid || '/' || status from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'rent'),
  '30/due', 'phần còn lại vẫn nợ');
select is((select coins from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 0::bigint, 'xu không âm');
delete from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000b1';
delete from public.transactions_log where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'bill_autopay';

-- ---------------------------------------------------------------- thanh tra thuế
update public.profiles set reputation = 50 where id = '00000000-0000-0000-0000-0000000000a1';
create temp table t_tax as
  select amount + late_fee - paid as owed from public.shop_bills
  where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'tax';
create temp table t_insp_tax as
  select public._run_inspection('00000000-0000-0000-0000-0000000000a1', 'tax', now() + interval '3 days') as id;
select is((select result from public.inspections where id = (select id from t_insp_tax)), 'fined', 'trốn thuế bị lập biên bản');
select is((select fine from public.inspections where id = (select id from t_insp_tax)), (select 2 * owed from t_tax),
  'truy thu + phạt 100% = gấp đôi số thuế nợ');
select is((select status from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'tax'), 'audited',
  'hóa đơn thuế cũ gộp vào tiền phạt');
select is((select amount || '/' || status from public.shop_bills where inspection_id = (select id from t_insp_tax) and kind = 'fine'),
  (select 2 * owed || '/due' from t_tax), 'lập hóa đơn phạt');
select is((select reputation from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 47, 'trốn thuế −3 uy tín');

-- ---------------------------------------------------------------- thanh tra an toàn thực phẩm
update public.profiles set hygiene = 30 where id = '00000000-0000-0000-0000-0000000000a1';
create temp table t_insp_food as
  select public._run_inspection('00000000-0000-0000-0000-0000000000a1', 'food', now()) as id;
select is((select result from public.inspections where id = (select id from t_insp_food)), 'fined', 'bếp bẩn + có khách ngộ độc → phạt');
select is((select jsonb_array_length(findings) from public.inspections where id = (select id from t_insp_food)), 2,
  'biên bản ghi 2 lỗi: vệ sinh + ngộ độc');
select is((select fine from public.inspections where id = (select id from t_insp_food)),
  (select (50 + 15 * level) + (100 + 20 * level) from public.profiles where id = '00000000-0000-0000-0000-0000000000a1')::bigint,
  'phạt vệ sinh kém + 1 khách ngộ độc theo cấp');
select is((select reputation from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 42, 'có ngộ độc −5 uy tín');
select is((select hygiene from public.inspections where id = (select id from t_insp_food))::int, 30, 'ghi mức vệ sinh lúc kiểm tra');

-- Tiệm sạch, không ngộ độc → đạt, +2 uy tín.
create temp table t_pass as
  select public._run_inspection('00000000-0000-0000-0000-0000000000b1', 'food', now()) as id;
select is((select result || '/' || fine || '/' || reputation_delta from public.inspections where id = (select id from t_pass)),
  'pass/0/2', 'tiệm sạch → đạt, +2 uy tín');
select is((select count(*) from public.shop_bills where user_id = '00000000-0000-0000-0000-0000000000b1')::int, 0,
  'đạt thì không có hóa đơn phạt');

-- Thanh tra chỉ tới tiệm đã mở ≥ 6 giờ, đang mở cửa và chủ tiệm online.
select is(public._maybe_inspect('00000000-0000-0000-0000-0000000000b1', now()), null, 'tiệm mới mở chưa bị thanh tra');
update public.profiles set created_at = now() - interval '2 days', shop_open = false, last_seen_at = now()
where id = '00000000-0000-0000-0000-0000000000b1';
select is(public._maybe_inspect('00000000-0000-0000-0000-0000000000b1', now()), null, 'tiệm đóng cửa không bị thanh tra');

-- ---------------------------------------------------------------- đóng hóa đơn
insert into public.shop_bills (user_id, kind, day, amount, status, due_at)
values ('00000000-0000-0000-0000-0000000000b1', 'fine', public._today(), 100, 'due', now() + interval '1 day');
update public.profiles set coins = 50 where id = '00000000-0000-0000-0000-0000000000b1';
select throws_ok($$ select public.pay_bills('00000000-0000-0000-0000-0000000000b1', null) $$,
  'P0001', 'INSUFFICIENT_COINS', 'không đủ xu thì không đóng được');
update public.profiles set coins = 500 where id = '00000000-0000-0000-0000-0000000000b1';
select is((public.pay_bills('00000000-0000-0000-0000-0000000000b1', null) ->> 'paid')::int, 100, 'đóng tất cả hóa đơn');
select is((select coins from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 400::bigint, 'trừ xu khi đóng');
select throws_ok($$ select public.pay_bills('00000000-0000-0000-0000-0000000000b1', null) $$,
  'P0001', 'NOT_FOUND', 'không còn gì để đóng');
select throws_ok($$ select public.pay_bills('00000000-0000-0000-0000-0000000000b1', '{}') $$,
  'P0001', 'INVALID_INPUT', 'danh sách rỗng bị chặn');
select throws_ok(format($$ select public.pay_bills('00000000-0000-0000-0000-0000000000b1', array[%L]::uuid[]) $$,
  (select id from public.shop_bills where inspection_id = (select id from t_insp_tax) and kind = 'fine')),
  'P0001', 'NOT_FOUND', 'không đóng được hóa đơn của tiệm khác');

-- ---------------------------------------------------------------- thời gian online
update public.profiles set last_seen_at = now() - interval '30 seconds', online_seconds = 700, online_day = public._today()
where id = '00000000-0000-0000-0000-0000000000b1';
select public.heartbeat('00000000-0000-0000-0000-0000000000b1');
select is((select online_seconds from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 730, 'online thêm 30 giây');
update public.profiles set last_seen_at = now() - interval '10 minutes' where id = '00000000-0000-0000-0000-0000000000b1';
select public.heartbeat('00000000-0000-0000-0000-0000000000b1');
select is((select online_seconds from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 730,
  'vắng mặt 10 phút không được tính online');

-- ---------------------------------------------------------------- lì xì
-- B: online 12 phút, đã tự đóng 1 hóa đơn, được thanh tra chấm đạt → 3 bao.
select is(public._grant_envelopes('00000000-0000-0000-0000-0000000000b1'), 3, 'đạt 3 mốc → nhận 3 bao lì xì');
select is(public._grant_envelopes('00000000-0000-0000-0000-0000000000b1'), 0, 'mỗi mốc chỉ 1 bao/ngày');
create temp table t_env as select public.get_envelopes('00000000-0000-0000-0000-0000000000b1') as r;
select is(jsonb_array_length((select r from t_env) -> 'milestones'), 9, '9 mốc lì xì mỗi ngày');
select is(jsonb_array_length((select r from t_env) -> 'unopened'), 3, 'có 3 bao chưa mở');
select is((select count(*) from jsonb_array_elements((select r from t_env) -> 'milestones') m where (m ->> 'earned')::boolean)::int, 3,
  'mốc đã nhận được đánh dấu');

create temp table t_open as
  select (select id from public.lucky_envelopes where user_id = '00000000-0000-0000-0000-0000000000b1' and source = 'online_10') as id,
         (select coins from public.profiles where id = '00000000-0000-0000-0000-0000000000b1') as coins_before;
select throws_ok(format($$ select public.open_envelope('00000000-0000-0000-0000-0000000000a1', %L) $$, (select id from t_open)),
  'P0001', 'NOT_FOUND', 'không mở được bao của người khác');
create temp table t_opened as select public.open_envelope('00000000-0000-0000-0000-0000000000b1', (select id from t_open)) as r;
select ok(((select r from t_opened) ->> 'coins')::int = any (array[0, 10, 20, 36, 50, 68, 86, 99, 168, 186, 268, 368, 568, 88, 888]),
  'tiền lì xì nằm trong bảng thưởng');
select ok(char_length((select r from t_opened) ->> 'wish') > 3, 'bao nào cũng có lời chúc');
select is((select coins from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  (select coins_before + ((select r from t_opened) ->> 'coins')::bigint from t_open), 'cộng xu lì xì');
select throws_ok(format($$ select public.open_envelope('00000000-0000-0000-0000-0000000000b1', %L) $$, (select id from t_open)),
  'P0001', 'ALREADY_OPENED', 'không mở 1 bao 2 lần');

select is((public._envelope_reward(0.1, 0.5) ->> 'coins')::int, 0, '30% chỉ có lời chúc may mắn');
select is(public._envelope_reward(0.995, 0.5), '{"coins": 888, "gems": 2}'::jsonb, 'trúng lớn 888 ₵ + 2 gem');
select ok((select avg((public._envelope_reward(r / 1000.0, p / 4.0) ->> 'coins')::int)
           from generate_series(0, 999) r, generate_series(0, 3) p) between 60 and 95,
  'kỳ vọng ~77 ₵ mỗi bao');

-- Nhịp khách trả thêm phần vận hành.
select ok((public.customer_tick('00000000-0000-0000-0000-0000000000a1') -> 'ops') ?& array['hygiene', 'bills', 'envelopes_unopened'],
  'customer-tick trả hóa đơn, vệ sinh, lì xì');

-- ---------------------------------------------------------------- RLS
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select ok((select count(*) from public.shop_bills) > 0
      and (select count(*) from public.shop_bills where user_id <> '00000000-0000-0000-0000-0000000000a1') = 0,
  'client chỉ thấy hóa đơn của mình');
select is((select count(*) from public.inspections where user_id <> '00000000-0000-0000-0000-0000000000a1')::int, 0,
  'client chỉ thấy biên bản của mình');
select throws_ok($$ update public.shop_bills set status = 'paid' $$, '42501', null, 'client không tự đánh dấu đã đóng');
select throws_ok($$ select public.pay_bills('00000000-0000-0000-0000-0000000000a1', null) $$, '42501', null,
  'client không gọi trực tiếp hàm đóng hóa đơn');
select throws_ok($$ insert into public.lucky_envelopes (user_id, day, source) values ('00000000-0000-0000-0000-0000000000a1', current_date, 'online_10') $$,
  '42501', null, 'client không tự tạo bao lì xì');

reset role;
select * from finish();
rollback;
