-- Test luồng kinh tế + khách/đơn hàng + RLS. Chạy: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(113);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- ---------------------------------------------------------------- hồ sơ
select lives_ok(
  $$ select public.create_profile('00000000-0000-0000-0000-00000000000a', 'Minh Anh', 'Tiệm Bánh Nắng', 'a1', 'caramel') $$,
  'tạo hồ sơ A');
select is((select slug from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'tiem-banh-nang', 'slug bỏ dấu tiếng Việt');
select is((select coins from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  500::bigint, 'xu khởi đầu 500');
select is((select qty from public.inventory where user_id = '00000000-0000-0000-0000-00000000000a' and ingredient_code = 'sauce_garlic'),
  3, 'khởi đầu có sẵn sốt');
select is((select qty from public.inventory where user_id = '00000000-0000-0000-0000-00000000000a' and ingredient_code = 'yeast'),
  4, 'khởi đầu có men nở để làm bánh mì');

-- ---------------------------------------------------------------- sổ công thức (docs/Bakery_Recipe_Database.docx)
select is((select count(*) from public.recipes)::int, 72, 'đủ 72 món theo tài liệu');
select is((select count(*) from public.recipes r
           where not exists (select 1 from public.recipe_ingredients ri where ri.recipe_code = r.code))::int,
  0, 'món nào cũng có nguyên liệu');
select is((select count(*) from public.recipe_ingredients ri join public.ingredients i on i.code = ri.ingredient_code
           where i.kind <> 'base')::int, 0, 'công thức chỉ dùng nguyên liệu gốc (sốt/topping là bước riêng)');
select is((select array_agg(ingredient_code order by ingredient_code) from public.recipe_ingredients where recipe_code = 'bread'),
  array['flour', 'salt', 'sugar', 'water', 'yeast'], 'bánh mì trắng = bột + nước + men + muối + đường');
select is((select array_agg(code order by code) from public.recipes where cook_method = 'chill'),
  array['chocolate_mousse', 'chocolate_tart', 'panna_cotta', 'tiramisu'], 'món làm lạnh');

select throws_ok(
  $$ select public.create_profile('00000000-0000-0000-0000-00000000000b', 'Lan', 'tiem banh nang', 'a2', 'mint') $$,
  'P0001', 'SHOP_NAME_TAKEN', 'tên quán trùng (khác dấu/hoa thường) bị chặn');
select throws_ok(
  $$ select public.create_profile('00000000-0000-0000-0000-00000000000b', 'Lan', 'Tiệm VCL', 'a2', 'mint') $$,
  'P0001', 'NAME_NOT_ALLOWED', 'lọc từ bậy');
select throws_ok(
  $$ select public.create_profile('00000000-0000-0000-0000-00000000000a', 'Minh Anh', 'Quán Khác', 'a1', 'caramel') $$,
  'P0001', 'PROFILE_EXISTS', 'không tạo hồ sơ 2 lần');
select lives_ok(
  $$ select public.create_profile('00000000-0000-0000-0000-00000000000b', 'Lan', 'Tiệm của Lan', 'a2', 'mint') $$,
  'tạo hồ sơ B');

-- ---------------------------------------------------------------- mua nguyên liệu
select is((public.buy_ingredient('00000000-0000-0000-0000-00000000000a', 'flour', 5) ->> 'spent')::int, 20, 'mua 5 bột = 20 xu');
select is((select coins from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 480::bigint, 'trừ xu đúng');
select throws_ok($$ select public.buy_ingredient('00000000-0000-0000-0000-00000000000a', 'flour', 0) $$,
  'P0001', 'INVALID_INPUT', 'số lượng 0 bị chặn');
select throws_ok($$ select public.buy_ingredient('00000000-0000-0000-0000-00000000000a', 'chocolate', 99) $$,
  'P0001', 'INSUFFICIENT_COINS', 'không đủ xu');

-- ---------------------------------------------------------------- đồng hồ game (1 giây thật = 1 phút game)
select is(public._game_clock(to_timestamp(420)) ->> 'hour', '7', '420 giây sau nửa đêm UTC = 7:00 game');
select ok(public._game_open(to_timestamp(420)), '7:00 game mở cửa');
select ok(not public._game_open(to_timestamp(419)), '6:59 game còn đóng');
select ok(not public._game_open(to_timestamp(1440)), '0:00 game (ngày mới) đóng cửa');

-- ---------------------------------------------------------------- đông / vắng theo giờ
select is(public._traffic_level(12 * 60), 'rush', '12:00 trưa là giờ cao điểm');
select is(public._traffic_level(14 * 60), 'quiet', '14:00 chiều vắng khách');
select is(public._traffic_level(3 * 60), 'closed', '3:00 sáng đóng cửa');
-- Mô phỏng 1 giờ game (60 giây thật) ở giờ cao điểm và giờ vắng: cao điểm nhiều khách hơn.
create temp table t_traffic as
  select sum(public._traffic_mult(12 * 60 + m)) as rush, sum(public._traffic_mult(14 * 60 + m)) as quiet
  from generate_series(0, 59) m;
select ok((select rush > quiet * 3 from t_traffic), 'cao điểm trưa đông hơn giờ vắng > 3 lần');
select ok((select avg(public._traffic_mult(m)) from generate_series(420, 1439) m) between 0.9 and 1.2,
  'trung bình cả ngày ≈ 1 (tổng khách/ngày không đổi nhiều)');

-- ---------------------------------------------------------------- 500 khách
select is((select count(*) from public.customers)::int, 500, 'có 500 khách NPC');
select ok((select count(*) from public.customers where impatient) > 0
      and (select count(*) from public.customers where dine_and_dash) > 0
      and (select count(*) from public.customers where picky) > 0, 'có đủ khách hay hối / hay quịt / khó khăn');

-- ---------------------------------------------------------------- sinh khách (chỉ giờ mở cửa)
select is((public._customer_tick_at('00000000-0000-0000-0000-00000000000a', to_timestamp(1440 * 20000 + 60)) ->> 'generated')::int,
  0, 'giờ đóng cửa (0:01) không có khách');
update public.profiles set visits_until = null where id = '00000000-0000-0000-0000-00000000000a';
select setseed(0.42);  -- sinh khách ngẫu nhiên → cố định seed để test không chập chờn
select ok((public._customer_tick_at('00000000-0000-0000-0000-00000000000a', to_timestamp(1440 * 20000 + 600)) ->> 'generated')::int > 0,
  'giờ mở cửa (10:00) có khách ghé');
select ok((select count(*) from public.customer_visits where user_id = '00000000-0000-0000-0000-00000000000a'
           and status in ('waiting', 'cooking')) <= 2,
  'giờ thường: tối đa 2 khách cùng lúc');
select is((public._customer_tick_at('00000000-0000-0000-0000-00000000000a', to_timestamp(1440 * 20000 + 600)) ->> 'generated')::int,
  0, 'gọi tick lại ngay không sinh trùng');
-- Cao điểm trưa 12:00: tiệm đang có 1 khách chờ bánh → chỉ thêm tối đa 2 khách (tổng 3).
delete from public.customer_visits where user_id = '00000000-0000-0000-0000-00000000000a';
insert into public.customer_visits (user_id, customer_id, recipe_code, arrive_at, leave_at, status)
values ('00000000-0000-0000-0000-00000000000a', 1, 'bread',
        to_timestamp(1440 * 20000 + 700), to_timestamp(1440 * 20000 + 940), 'cooking');
select ok((public._customer_tick_at('00000000-0000-0000-0000-00000000000a', to_timestamp(1440 * 20000 + 720)) ->> 'generated')::int
          between 1 and 2,
  'giờ cao điểm có khách ghé, nhưng khách đang chờ bánh cũng tính vào giới hạn');
select is((select count(*) from public.customer_visits where user_id = '00000000-0000-0000-0000-00000000000a'
           and status in ('waiting', 'cooking'))::int, 3,
  'giờ cao điểm: tối đa 3 khách cùng lúc');

-- Dựng đơn cố định: khách dễ tính, không quịt, hào phóng; Bánh mì + sốt bơ tỏi + phô mai.
delete from public.customer_visits;
update public.customers set dine_and_dash = false, dine_dash_pct = 0, picky = false, min_quality = 1, spend = 3 where id = 1;
insert into public.customer_visits (id, user_id, customer_id, recipe_code, sauce_code, topping_code, arrive_at, leave_at)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 1, 'bread',
        'sauce_garlic', 'top_cheese', now() - interval '5 seconds', now() + interval '60 seconds');

-- ---------------------------------------------------------------- nhận đơn
select throws_ok($$ select public.accept_order('00000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111') $$,
  'P0001', 'CUSTOMER_GONE', 'không nhận đơn của tiệm khác');
select lives_ok($$ select public.accept_order('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111') $$,
  'nhận đơn');
select is((select status from public.customer_visits where id = '11111111-1111-1111-1111-111111111111'), 'cooking',
  'khách chuyển sang chờ bánh');
select ok((public.accept_order('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111') ->> 'session_id') is not null,
  'mở lại đơn đang làm trả đúng phiên');

-- ---------------------------------------------------------------- giao bánh
select throws_ok($$ select public.complete_order('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
  array['flour', 'water', 'yeast', 'salt', 'sugar'], 'bake', array[95, 95], 'sauce_garlic', 'top_cheese', 'bag') $$,
  'P0001', 'TOO_FAST', 'giao quá nhanh bị chặn');
update public.bake_sessions set started_at = now() - interval '1 minute'
  where visit_id = '11111111-1111-1111-1111-111111111111';
select throws_ok($$ select public.complete_order('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
  array['flour', 'flour'], 'bake', array[95, 95], null, null, 'bag') $$,
  'P0001', 'INVALID_INPUT', 'không cho bỏ trùng nguyên liệu');
select throws_ok($$ select public.complete_order('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
  array['flour', 'water', 'yeast', 'salt', 'sugar'], 'bake', array[95, 150], null, null, 'bag') $$,
  'P0001', 'INVALID_INPUT', 'điểm ngoài 0..100 bị chặn');

create temp table t_result as
  select public.complete_order('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
    array['flour', 'water', 'yeast', 'salt', 'sugar'], 'bake', array[95, 95], 'sauce_garlic', 'top_cheese', 'bag') as r;
select is(((select r from t_result) ->> 'quality')::int, 5, 'làm đúng hết + canh giờ tốt → 5 sao');
-- bánh mì trắng: giá vốn 16 → 3★ = 2×16 + 2 = 34; 5★ = 51, + 2×5 (sốt) + 2×7 (topping) = 75, tip 25 → 100
select is(((select r from t_result) ->> 'paid')::int, 100, 'giá bánh + sốt/topping + tip');
select is((select status from public.customer_visits where id = '11111111-1111-1111-1111-111111111111'), 'served', 'đơn đã giao');
select is((select qty from public.inventory where user_id = '00000000-0000-0000-0000-00000000000a' and ingredient_code = 'flour'),
  15, 'trừ nguyên liệu theo định lượng công thức (2 bột)');
select is((select revenue_total from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 100::bigint, 'cộng doanh thu');
select throws_ok($$ select public.complete_order('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
  array['flour', 'water', 'yeast', 'salt', 'sugar'], 'bake', array[95, 95], null, null, 'bag') $$,
  'P0001', 'CUSTOMER_GONE', 'không giao 1 đơn 2 lần');

-- Đánh giá tự sinh sau khi giao
select is((select stars from public.reviews where visit_id = '11111111-1111-1111-1111-111111111111')::int, 5,
  'khách để lại đánh giá 5 sao');
select ok((select char_length(comment) from public.reviews where visit_id = '11111111-1111-1111-1111-111111111111') > 5,
  'đánh giá có lời nhận xét');
select is((public.reply_review('00000000-0000-0000-0000-00000000000a',
  (select id from public.reviews where visit_id = '11111111-1111-1111-1111-111111111111'),
  'Cảm ơn bạn rất nhiều, hẹn gặp lại nhé!') ->> 'reputation_gained')::int, 1, 'trả lời lịch sự +1 uy tín');
select throws_ok(format($q$ select public.reply_review('00000000-0000-0000-0000-00000000000a', %L, 'Cảm ơn lần nữa') $q$,
  (select id from public.reviews where visit_id = '11111111-1111-1111-1111-111111111111')),
  'P0001', 'ALREADY_REPLIED', 'mỗi đánh giá trả lời 1 lần');

-- Làm sai quy trình: thiếu men/muối/nước/đường, sai cách nấu, sai sốt → mất sao, không tip
insert into public.customer_visits (id, user_id, customer_id, recipe_code, sauce_code, topping_code, arrive_at, leave_at)
values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000a', 1, 'bread',
        'sauce_garlic', null, now() - interval '5 seconds', now() + interval '60 seconds');
select public.accept_order('00000000-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222');
update public.bake_sessions set started_at = now() - interval '1 minute'
  where visit_id = '22222222-2222-2222-2222-222222222222';
create temp table t_bad as
  select public.complete_order('00000000-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222',
    array['flour'], 'fry', array[95, 95], 'sauce_condensed', null, 'bag') as r;
select is(((select r from t_bad) ->> 'quality')::int, 1, 'thiếu nguyên liệu + sai cách nấu → 1 sao');
select is(((select r from t_bad) ->> 'tip')::int, 0, 'sai nước chấm → không tip');

-- Khách quịt: luôn quịt → không trả tiền
update public.customers set dine_and_dash = true, dine_dash_pct = 100 where id = 2;
insert into public.customer_visits (id, user_id, customer_id, recipe_code, arrive_at, leave_at)
values ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-00000000000a', 2, 'bread',
        now() - interval '5 seconds', now() + interval '60 seconds');
select public.accept_order('00000000-0000-0000-0000-00000000000a', '33333333-3333-3333-3333-333333333333');
update public.bake_sessions set started_at = now() - interval '1 minute'
  where visit_id = '33333333-3333-3333-3333-333333333333';
select is((public.complete_order('00000000-0000-0000-0000-00000000000a', '33333333-3333-3333-3333-333333333333',
    array['flour', 'water', 'yeast', 'salt', 'sugar'], 'bake', array[90, 90], null, null, 'bag') ->> 'dashed')::boolean, true, 'khách quịt không trả tiền');

-- Khách hết kiên nhẫn bỏ đi lúc chủ tiệm đang online (hay hối → −1 uy tín)
update public.profiles set reputation = 5, last_seen_at = now() - interval '10 seconds'
  where id = '00000000-0000-0000-0000-00000000000a';
update public.customers set impatient = true where id = 3;
insert into public.customer_visits (user_id, customer_id, recipe_code, arrive_at, leave_at)
values ('00000000-0000-0000-0000-00000000000a', 3, 'bread', now() - interval '2 minutes', now() - interval '1 minute');
select is((public._customer_tick_at('00000000-0000-0000-0000-00000000000a', now()) ->> 'reputation_lost')::int, 1,
  'khách hay hối bỏ đi → chê quán');
select is((select min(stars) from public.reviews r join public.customer_visits v on v.id = r.visit_id
  where v.customer_id = 3 and v.status = 'left')::int, 1, 'khách bỏ đi để lại đánh giá 1 sao');

-- ---------------------------------------------------------------- đóng cửa khi offline / tự đóng cửa
select is((select max(patience_seconds) from public.customers)::int, 240, 'khách chờ tối đa 4 phút');
select is((select count(*) from public.customers where patience_seconds <> 240)::int, 0,
  'mọi khách đều chờ 4 phút');

-- Chủ tiệm offline 10 phút: khách hết hạn ra về lặng lẽ, không trừ uy tín, không đánh giá.
update public.profiles set last_seen_at = now() - interval '10 minutes' where id = '00000000-0000-0000-0000-00000000000a';
insert into public.customer_visits (id, user_id, customer_id, recipe_code, arrive_at, leave_at)
values ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-00000000000a', 3, 'bread',
        now() - interval '5 minutes', now() - interval '4 minutes');
create temp table t_offline as
  select public._customer_tick_at('00000000-0000-0000-0000-00000000000a', now()) as r;
select is(((select r from t_offline) ->> 'closed_offline')::int, 1, 'offline → khách hết hạn được cho về');
select is(((select r from t_offline) ->> 'reputation_lost')::int, 0, 'offline → không trừ uy tín');
select is((select count(*) from public.reviews where visit_id = '44444444-4444-4444-4444-444444444444')::int, 0,
  'offline → không có đánh giá 1 sao');

-- Tự đóng cửa: khách đang chờ về hết, không sinh khách mới.
insert into public.customer_visits (user_id, customer_id, recipe_code, arrive_at, leave_at)
values ('00000000-0000-0000-0000-00000000000a', 4, 'bread', now(), now() + interval '60 seconds');
select ok((public.set_shop_open('00000000-0000-0000-0000-00000000000a', false) ->> 'sent_home')::int >= 1,
  'đóng cửa → khách đang chờ ra về');
select is((select count(*) from public.customer_visits where user_id = '00000000-0000-0000-0000-00000000000a' and status = 'waiting')::int,
  0, 'không còn khách chờ');
select is((public._customer_tick_at('00000000-0000-0000-0000-00000000000a', to_timestamp(1440 * 20001 + 720)) ->> 'generated')::int,
  0, 'tiệm đóng cửa không sinh khách dù giờ cao điểm');
select lives_ok($$ select public.set_shop_open('00000000-0000-0000-0000-00000000000a', true) $$, 'mở cửa lại');
select throws_ok($q$ select public.set_theme('00000000-0000-0000-0000-00000000000a', 'theme_xmas') $q$,
  'P0001', 'NOT_OWNED', 'chưa mua theme thì không dùng được');

-- ---------------------------------------------------------------- chợ (chỉ nguyên liệu)
select throws_ok($$ select public.create_listing('00000000-0000-0000-0000-00000000000a', 'ingredient', 'flour', null, 5, 20) $$,
  'P0001', 'MARKET_LOCKED', 'chợ khóa khi cấp thấp');
update public.profiles set level = 3, created_at = now() - interval '2 days'
  where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.create_listing('00000000-0000-0000-0000-00000000000a', 'baked', 'bread', 5, 1, 45) $$,
  'P0001', 'INVALID_INPUT', 'không còn rao bán bánh làm sẵn');
select throws_ok($$ select public.create_listing('00000000-0000-0000-0000-00000000000a', 'ingredient', 'flour', null, 5, 41) $$,
  'P0001', 'PRICE_OUT_OF_RANGE', 'giá > 200% bị chặn');
create temp table t_listing as
  select (public.create_listing('00000000-0000-0000-0000-00000000000a', 'ingredient', 'flour', null, 5, 20) ->> 'listing_id')::uuid as id;
select throws_ok(format($$ select public.buy_listing('00000000-0000-0000-0000-00000000000a', %L) $$, (select id from t_listing)),
  'P0001', 'CANNOT_BUY_OWN', 'không tự mua của mình');
select is((public.buy_listing('00000000-0000-0000-0000-00000000000b', (select id from t_listing)) ->> 'fee')::int,
  1, 'phí 5% làm tròn lên');
select is((select qty from public.inventory where user_id = '00000000-0000-0000-0000-00000000000b' and ingredient_code = 'flour'),
  17, 'người mua nhận hàng');

-- ---------------------------------------------------------------- điểm danh + throttle
select lives_ok($$ select public.claim_daily('00000000-0000-0000-0000-00000000000a') $$, 'điểm danh');
select throws_ok($$ select public.claim_daily('00000000-0000-0000-0000-00000000000a') $$,
  'P0001', 'ALREADY_CLAIMED', 'không điểm danh 2 lần/ngày');
-- ---------------------------------------------------------------- nhiệm vụ hằng ngày
select is((select count(*) from public.quest_catalog)::int, 51, 'danh mục 51 nhiệm vụ');
select is(jsonb_array_length(public.get_daily_quests('00000000-0000-0000-0000-00000000000b') -> 'quests'), 15,
  'mỗi ngày 15 nhiệm vụ');
select is((select count(distinct q.grp) from public.daily_quests d join public.quest_catalog q on q.code = d.quest_code
           where d.user_id = '00000000-0000-0000-0000-00000000000b')::int, 15, '15 nhiệm vụ khác nhóm nhau');
select is((select count(*) from public.daily_quests d join public.quest_catalog q on q.code = d.quest_code
           join public.profiles p on p.id = d.user_id
           where d.user_id = '00000000-0000-0000-0000-00000000000b' and q.min_level > p.level)::int, 0,
  'không bốc nhiệm vụ vượt cấp');
select is(public.get_daily_quests('00000000-0000-0000-0000-00000000000b') -> 'quests',
          public.get_daily_quests('00000000-0000-0000-0000-00000000000b') -> 'quests', 'gọi lại không bốc lại');

-- A đã giao 3 đơn hôm nay (1 đơn 5★, 1 đơn 1★, 1 đơn bị quịt) và đã điểm danh.
delete from public.daily_quests where user_id = '00000000-0000-0000-0000-00000000000a';
insert into public.daily_quests (user_id, day, quest_code) values
  ('00000000-0000-0000-0000-00000000000a', public._today(), 'serve_3'),
  ('00000000-0000-0000-0000-00000000000a', public._today(), 'checkin_1'),
  ('00000000-0000-0000-0000-00000000000a', public._today(), 'serve_25');
create temp table t_quests as
  select q ->> 'code' as code, (q ->> 'progress')::int as progress
  from jsonb_array_elements(public.get_daily_quests('00000000-0000-0000-0000-00000000000a') -> 'quests') q;
select is((select progress from t_quests where code = 'serve_3'), 3, 'tiến độ tính từ đơn đã giao');
select is((select progress from t_quests where code = 'checkin_1'), 1, 'tiến độ điểm danh');
create temp table t_coins as select coins from public.profiles where id = '00000000-0000-0000-0000-00000000000a';
select is((public.claim_quest('00000000-0000-0000-0000-00000000000a', 'serve_3') ->> 'coins')::int, 60, 'nhận thưởng nhiệm vụ');
select is((select coins from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  (select coins + 60 from t_coins), 'cộng xu thưởng');
select throws_ok($$ select public.claim_quest('00000000-0000-0000-0000-00000000000a', 'serve_3') $$,
  'P0001', 'QUEST_CLAIMED', 'không nhận 2 lần');
select throws_ok($$ select public.claim_quest('00000000-0000-0000-0000-00000000000a', 'serve_25') $$,
  'P0001', 'QUEST_NOT_DONE', 'chưa xong thì không nhận được');
select throws_ok($$ select public.claim_quest('00000000-0000-0000-0000-00000000000a', 'upgrade_1') $$,
  'P0001', 'NOT_FOUND', 'không nhận nhiệm vụ không được giao');

select ok(public.throttle('00000000-0000-0000-0000-00000000000a', 't', 1, 60), 'throttle lần 1 qua');
select ok(not public.throttle('00000000-0000-0000-0000-00000000000a', 't', 1, 60), 'throttle lần 2 bị chặn');

-- ---------------------------------------------------------------- avatar
select is((select count(*) from public.customers where image is not null)::int, 6, '6 khách đã có ảnh chân dung');
select lives_ok($q$ select public.update_avatar('00000000-0000-0000-0000-00000000000a', 'p_alien', 'ocean') $q$, 'đổi avatar ảnh + màu');
select is((select avatar || '/' || color from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'p_alien/ocean', 'đã lưu avatar mới');
select throws_ok($q$ select public.update_avatar('00000000-0000-0000-0000-00000000000a', 'hacker', null) $q$,
  'P0001', 'INVALID_INPUT', 'avatar ngoài danh sách bị chặn');

-- ---------------------------------------------------------------- hồ sơ công khai
select lives_ok($q$ select public.update_bio('00000000-0000-0000-0000-00000000000a', 'Tiệm bánh nhà làm, mở cửa 7h sáng!') $q$, 'cập nhật tiểu sử');
select throws_ok($q$ select public.update_bio('00000000-0000-0000-0000-00000000000a', 'quán vcl') $q$, 'P0001', 'NAME_NOT_ALLOWED', 'tiểu sử lọc từ bậy');
select ok((public.heartbeat('00000000-0000-0000-0000-00000000000a') ->> 'last_seen_at') is not null, 'heartbeat ghi lần hoạt động');
select is((public.set_avatar_photo('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a/1790000000000.webp') ->> 'avatar_url'),
  '00000000-0000-0000-0000-00000000000a/1790000000000.webp', 'đặt avatar ảnh tải lên');
select is((select avatar from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'custom', 'avatar = custom');
select is((public.update_avatar('00000000-0000-0000-0000-00000000000a', 'a2', null) ->> 'old_url'),
  '00000000-0000-0000-0000-00000000000a/1790000000000.webp', 'đổi sang avatar có sẵn trả về ảnh cũ để xoá');
select ok((select avatar_url is null from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'avatar_url đã được xoá');

-- ---------------------------------------------------------------- thống kê đánh giá + dọn đánh giá cũ
select is((select review_counts[1] + review_counts[2] + review_counts[3] + review_counts[4] + review_counts[5]
           from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  (select count(*)::int from public.reviews where user_id = '00000000-0000-0000-0000-00000000000a'),
  'bộ đếm đánh giá khớp số đánh giá');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'c@test.local');
select lives_ok(
  $$ select public.create_profile('00000000-0000-0000-0000-00000000000c', 'Chi', 'Tiệm Chấm Điểm', 'a3', 'honey') $$,
  'tạo hồ sơ C');
do $$
declare
  v_visit uuid;
begin
  for i in 1..260 loop
    insert into public.customer_visits (user_id, customer_id, recipe_code, arrive_at, leave_at, status)
    values ('00000000-0000-0000-0000-00000000000c', 1, 'bread', now() - interval '1 hour', now(), 'closed')
    returning id into v_visit;
    insert into public.reviews (user_id, visit_id, customer_id, stars, comment, created_at)
    values ('00000000-0000-0000-0000-00000000000c', v_visit, 1, 1 + i % 5, 'r' || i, now() - make_interval(secs => 1000 - i));
  end loop;
end $$;
select is((select count(*)::int from public.reviews where user_id = '00000000-0000-0000-0000-00000000000c'), 210,
  'mỗi 50 đánh giá dọn 1 lần, chỉ giữ 200 mới nhất (+ phần mới từ lần dọn trước)');
select ok(not exists (select 1 from public.reviews where user_id = '00000000-0000-0000-0000-00000000000c' and comment in ('r1', 'r50')),
  'đánh giá cũ nhất đã bị dọn');
select is((select review_counts from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  array[52, 52, 52, 52, 52], 'bộ đếm vẫn đủ 260 đánh giá sau khi dọn');
select is((select review_count || '/' || review_avg from public.public_profiles where id = '00000000-0000-0000-0000-00000000000c'),
  '260/3.00', 'hồ sơ công khai đọc từ bộ đếm');

-- ---------------------------------------------------------------- RLS / quyền client
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is((select count(*) from public.profiles)::int, 1, 'client chỉ thấy hồ sơ của mình');
select is((select count(*) from public.public_profiles
  where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'))::int, 2,
  'view công khai thấy quán người khác');
select throws_ok($$ update public.profiles set coins = 999999 $$, '42501', null, 'client không sửa được xu');
select is((select count(*) from public.daily_quests where user_id <> '00000000-0000-0000-0000-00000000000a')::int, 0,
  'client chỉ thấy nhiệm vụ của mình');
select throws_ok($$ select public.claim_quest('00000000-0000-0000-0000-00000000000a', 'checkin_1') $$,
  '42501', null, 'client không tự nhận thưởng nhiệm vụ');
select throws_ok($$ select public.complete_order('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
  array['flour'], 'bake', array[100, 100], null, null, 'bag') $$, '42501', null, 'client không gọi trực tiếp hàm kinh tế');

reset role;
set local role anon;
select throws_ok($$ select * from public.leaderboard $$, '42501', null, 'anon không đọc BXH');

reset role;
select * from finish();
rollback;
