-- Test luồng kinh tế + khách/đơn hàng + RLS. Chạy: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(76);

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
select ok((public._customer_tick_at('00000000-0000-0000-0000-00000000000a', to_timestamp(1440 * 20000 + 600)) ->> 'generated')::int > 0,
  'giờ mở cửa (10:00) có khách ghé');
select ok((select count(*) from public.customer_visits where user_id = '00000000-0000-0000-0000-00000000000a' and status = 'waiting') <= 4,
  'quầy tối đa 4 khách chờ');
select is((public._customer_tick_at('00000000-0000-0000-0000-00000000000a', to_timestamp(1440 * 20000 + 600)) ->> 'generated')::int,
  0, 'gọi tick lại ngay không sinh trùng');

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
  array['flour', 'oil'], 'bake', array[95, 95], 'sauce_garlic', 'top_cheese', 'bag') $$,
  'P0001', 'TOO_FAST', 'giao quá nhanh bị chặn');
update public.bake_sessions set started_at = now() - interval '1 minute'
  where visit_id = '11111111-1111-1111-1111-111111111111';
select throws_ok($$ select public.complete_order('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
  array['flour', 'flour'], 'bake', array[95, 95], null, null, 'bag') $$,
  'P0001', 'INVALID_INPUT', 'không cho bỏ trùng nguyên liệu');
select throws_ok($$ select public.complete_order('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
  array['flour', 'oil'], 'bake', array[95, 150], null, null, 'bag') $$,
  'P0001', 'INVALID_INPUT', 'điểm ngoài 0..100 bị chặn');

create temp table t_result as
  select public.complete_order('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
    array['flour', 'oil'], 'bake', array[95, 95], 'sauce_garlic', 'top_cheese', 'bag') as r;
select is(((select r from t_result) ->> 'quality')::int, 5, 'làm đúng hết + canh giờ tốt → 5 sao');
-- 30 × 150% = 45, + 2×5 (sốt) + 2×7 (topping) = 69, tip = 3 × 5 × 5 / 3 = 25 → 94
select is(((select r from t_result) ->> 'paid')::int, 94, 'giá bánh + sốt/topping + tip');
select is((select status from public.customer_visits where id = '11111111-1111-1111-1111-111111111111'), 'served', 'đơn đã giao');
select is((select qty from public.inventory where user_id = '00000000-0000-0000-0000-00000000000a' and ingredient_code = 'flour'),
  15, 'trừ nguyên liệu theo định lượng công thức (2 bột)');
select is((select revenue_total from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 94::bigint, 'cộng doanh thu');
select throws_ok($$ select public.complete_order('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
  array['flour', 'oil'], 'bake', array[95, 95], null, null, 'bag') $$,
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

-- Làm sai quy trình: thiếu dầu, sai cách nấu, sai sốt → mất sao, không tip
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
    array['flour', 'oil'], 'bake', array[90, 90], null, null, 'bag') ->> 'dashed')::boolean, true, 'khách quịt không trả tiền');

-- Khách hết kiên nhẫn bỏ đi (hay hối → −1 uy tín)
update public.profiles set reputation = 5 where id = '00000000-0000-0000-0000-00000000000a';
update public.customers set impatient = true where id = 3;
insert into public.customer_visits (user_id, customer_id, recipe_code, arrive_at, leave_at)
values ('00000000-0000-0000-0000-00000000000a', 3, 'bread', now() - interval '2 minutes', now() - interval '1 minute');
select is((public._customer_tick_at('00000000-0000-0000-0000-00000000000a', now()) ->> 'reputation_lost')::int, 1,
  'khách hay hối bỏ đi → chê quán');
select is((select min(stars) from public.reviews r join public.customer_visits v on v.id = r.visit_id
  where v.customer_id = 3 and v.status = 'left')::int, 1, 'khách bỏ đi để lại đánh giá 1 sao');
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

-- ---------------------------------------------------------------- RLS / quyền client
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is((select count(*) from public.profiles)::int, 1, 'client chỉ thấy hồ sơ của mình');
select is((select count(*) from public.public_profiles
  where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'))::int, 2,
  'view công khai thấy quán người khác');
select throws_ok($$ update public.profiles set coins = 999999 $$, '42501', null, 'client không sửa được xu');
select throws_ok($$ select public.complete_order('00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
  array['flour'], 'bake', array[100, 100], null, null, 'bag') $$, '42501', null, 'client không gọi trực tiếp hàm kinh tế');

reset role;
set local role anon;
select throws_ok($$ select * from public.leaderboard $$, '42501', null, 'anon không đọc BXH');

reset role;
select * from finish();
rollback;
