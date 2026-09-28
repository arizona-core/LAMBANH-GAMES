-- Test luồng kinh tế + RLS. Chạy: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

-- Hai người chơi test
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
select is((select qty from public.inventory where user_id = '00000000-0000-0000-0000-00000000000a' and ingredient_code = 'flour'),
  10, 'nguyên liệu khởi đầu');
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

-- ---------------------------------------------------------------- làm bánh
select throws_ok($$ select public.start_bake('00000000-0000-0000-0000-00000000000a', 'croissant') $$,
  'P0001', 'LEVEL_TOO_LOW', 'công thức khóa theo cấp');

create temp table t_session as
  select (public.start_bake('00000000-0000-0000-0000-00000000000a', 'bread') ->> 'session_id')::uuid as id;
grant select on t_session to authenticated;

select throws_ok(
  format($$ select public.finish_bake('00000000-0000-0000-0000-00000000000a', %L, array[100,100,100]) $$, (select id from t_session)),
  'P0001', 'TOO_FAST', 'nộp kết quả quá nhanh bị chặn');
select throws_ok(
  format($$ select public.finish_bake('00000000-0000-0000-0000-00000000000a', %L, array[100,100,500]) $$, (select id from t_session)),
  'P0001', 'INVALID_INPUT', 'điểm ngoài 0..100 bị chặn');
select throws_ok(
  format($$ select public.finish_bake('00000000-0000-0000-0000-00000000000b', %L, array[100,100,100]) $$, (select id from t_session)),
  'P0001', 'SESSION_NOT_FOUND', 'không hoàn thành phiên của người khác');

update public.bake_sessions set started_at = now() - interval '1 minute' where id = (select id from t_session);
select is((public.finish_bake('00000000-0000-0000-0000-00000000000a', (select id from t_session), array[95,92,98]) ->> 'quality')::int,
  5, 'điểm cao → 5 sao');
select is((select qty from public.inventory where user_id = '00000000-0000-0000-0000-00000000000a' and ingredient_code = 'flour'),
  13, 'trừ 2 bột khi hoàn thành');
select is((select qty from public.baked_goods where user_id = '00000000-0000-0000-0000-00000000000a' and recipe_code = 'bread' and quality = 5),
  1, 'có 1 bánh mì 5 sao');
select throws_ok(
  format($$ select public.finish_bake('00000000-0000-0000-0000-00000000000a', %L, array[100,100,100]) $$, (select id from t_session)),
  'P0001', 'SESSION_NOT_FOUND', 'không nộp 1 phiên 2 lần');

-- ---------------------------------------------------------------- bán NPC
select is((public.sell_to_npc('00000000-0000-0000-0000-00000000000a', 'bread', 5, 1) ->> 'earned')::int, 45, '5 sao = 150% giá');
select is((select revenue_total from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 45::bigint, 'cộng doanh thu');
select throws_ok($$ select public.sell_to_npc('00000000-0000-0000-0000-00000000000a', 'bread', 5, 1) $$,
  'P0001', 'NOT_ENOUGH_ITEMS', 'không bán bánh không có');

-- ---------------------------------------------------------------- chợ
select throws_ok($$ select public.create_listing('00000000-0000-0000-0000-00000000000a', 'ingredient', 'flour', null, 5, 20) $$,
  'P0001', 'MARKET_LOCKED', 'chợ khóa ở cấp 1');
update public.profiles set level = 3 where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.create_listing('00000000-0000-0000-0000-00000000000a', 'ingredient', 'flour', null, 5, 20) $$,
  'P0001', 'MARKET_LOCKED', 'tiệm mới mở < 24h chưa dùng chợ (chống acc phụ)');
update public.profiles set created_at = now() - interval '2 days'
  where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.create_listing('00000000-0000-0000-0000-00000000000a', 'ingredient', 'flour', null, 5, 41) $$,
  'P0001', 'PRICE_OUT_OF_RANGE', 'giá > 200% bị chặn');

select throws_ok($$ select public.create_listing('00000000-0000-0000-0000-00000000000a', 'ingredient', 'flour', null, 5, 1) $$,
  'P0001', 'PRICE_OUT_OF_RANGE', 'giá quá thấp (chống chuyển tiền) bị chặn');

create temp table t_listing as
  select (public.create_listing('00000000-0000-0000-0000-00000000000a', 'ingredient', 'flour', null, 5, 20) ->> 'listing_id')::uuid as id;

select is((select qty from public.inventory where user_id = '00000000-0000-0000-0000-00000000000a' and ingredient_code = 'flour'),
  8, 'hàng rao bán được giữ (escrow)');
select throws_ok(format($$ select public.buy_listing('00000000-0000-0000-0000-00000000000a', %L) $$, (select id from t_listing)),
  'P0001', 'CANNOT_BUY_OWN', 'không tự mua của mình');
select is((public.buy_listing('00000000-0000-0000-0000-00000000000b', (select id from t_listing)) ->> 'fee')::int,
  1, 'phí 5% làm tròn lên');
select is((select coins from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 480 + 45 + 19::bigint,
  'người bán nhận giá trừ phí');
select is((select qty from public.inventory where user_id = '00000000-0000-0000-0000-00000000000b' and ingredient_code = 'flour'),
  15, 'người mua nhận hàng');
select throws_ok(format($$ select public.buy_listing('00000000-0000-0000-0000-00000000000b', %L) $$, (select id from t_listing)),
  'P0001', 'LISTING_UNAVAILABLE', 'không mua lại tin đã bán');

-- Trần 3.000 ₵/ngày mua từ cùng 1 người bán
update public.profiles set coins = 100000 where id = '00000000-0000-0000-0000-00000000000b';
insert into public.transactions_log (user_id, kind, coins_delta, meta)
  values ('00000000-0000-0000-0000-00000000000b', 'market_buy', -2990, jsonb_build_object('seller_id', '00000000-0000-0000-0000-00000000000a'));
create temp table t_listing2 as
  select (public.create_listing('00000000-0000-0000-0000-00000000000a', 'ingredient', 'flour', null, 5, 20) ->> 'listing_id')::uuid as id;
select throws_ok(format($$ select public.buy_listing('00000000-0000-0000-0000-00000000000b', %L) $$, (select id from t_listing2)),
  'P0001', 'MARKET_LIMIT', 'chặn chuyển xu giữa 2 tài khoản qua chợ');

-- "Đầu bếp mệt": sau 60 mẻ/24h bánh tối đa 3★ dù client gửi điểm 100
insert into public.transactions_log (user_id, kind) select '00000000-0000-0000-0000-00000000000a', 'bake' from generate_series(1, 60);
update public.profiles set coins = coins + 100 where id = '00000000-0000-0000-0000-00000000000a';
select public.buy_ingredient('00000000-0000-0000-0000-00000000000a', 'oil', 2);
create temp table t_session2 as
  select (public.start_bake('00000000-0000-0000-0000-00000000000a', 'bread') ->> 'session_id')::uuid as id;
update public.bake_sessions set started_at = now() - interval '1 minute' where id = (select id from t_session2);
select is((public.finish_bake('00000000-0000-0000-0000-00000000000a', (select id from t_session2), array[100,100,100]) ->> 'quality')::int,
  3, 'làm quá nhiều mẻ → tối đa 3 sao');

-- Throttle theo request
select ok(public.throttle('00000000-0000-0000-0000-00000000000a', 't', 2, 60), 'throttle lần 1 qua');
select ok(public.throttle('00000000-0000-0000-0000-00000000000a', 't', 2, 60), 'throttle lần 2 qua');
select ok(not public.throttle('00000000-0000-0000-0000-00000000000a', 't', 2, 60), 'throttle lần 3 bị chặn');

-- ---------------------------------------------------------------- điểm danh
select lives_ok($$ select public.claim_daily('00000000-0000-0000-0000-00000000000a') $$, 'điểm danh');
select throws_ok($$ select public.claim_daily('00000000-0000-0000-0000-00000000000a') $$,
  'P0001', 'ALREADY_CLAIMED', 'không điểm danh 2 lần/ngày');

-- ---------------------------------------------------------------- RLS / quyền client
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is((select count(*) from public.profiles)::int, 1, 'client chỉ thấy hồ sơ của mình');
select is((select count(*) from public.public_profiles
  where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'))::int, 2,
  'view công khai thấy quán người khác');
select throws_ok($$ update public.profiles set coins = 999999 $$, '42501', null, 'client không sửa được xu');
select throws_ok($$ select public.buy_ingredient('00000000-0000-0000-0000-00000000000a', 'flour', 1) $$,
  '42501', null, 'client không gọi trực tiếp hàm kinh tế');

reset role;
set local role anon;
select throws_ok($$ select * from public.leaderboard $$, '42501', null, 'anon không đọc BXH');

reset role;
select * from finish();
rollback;
