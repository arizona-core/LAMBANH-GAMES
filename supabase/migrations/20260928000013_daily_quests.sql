-- Sweet Shop — nhiệm vụ hằng ngày.
--
-- Danh mục 51 nhiệm vụ (quest_catalog). Mỗi ngày (giờ Việt Nam) lần đầu người chơi mở màn Nhiệm vụ,
-- server bốc ngẫu nhiên 15 nhiệm vụ đủ cấp, mỗi NHÓM (grp) tối đa 1 cái → 15 nhiệm vụ khác nhau.
-- Tiến độ KHÔNG lưu dạng bộ đếm client gửi lên: server tính lại từ dữ liệu thật trong ngày
-- (customer_visits đã giao, transactions_log) mỗi lần đọc/nhận thưởng → không thể gian lận tiến độ.
-- Nhận thưởng: mỗi nhiệm vụ 1 lần/ngày, cộng xu/gem/XP trong 1 transaction, ghi transactions_log.

create table public.quest_catalog (
  code          text primary key,
  grp           text not null,                 -- mỗi ngày tối đa 1 nhiệm vụ / nhóm
  title         text not null,
  description   text not null,
  metric        text not null check (metric in (
    'serve', 'serve_q', 'serve_method', 'serve_pack', 'serve_picky', 'serve_impatient', 'serve_dash',
    'serve_sauce', 'serve_topping', 'serve_exact', 'serve_distinct', 'serve_rush', 'serve_quiet',
    'serve_window', 'serve_recipe', 'serve_minlvl', 'revenue', 'tips', 'rep',
    'buy_qty', 'buy_kinds', 'reply', 'checkin', 'market_list', 'market_buy', 'upgrade')),
  param         text,                          -- mã cách nấu / đóng gói / món
  n1            integer,                       -- ngưỡng số (số sao, cấp món, phút game bắt đầu)
  n2            integer,                       -- phút game kết thúc (serve_window)
  target        integer not null check (target > 0),
  reward_coins  integer not null default 0 check (reward_coins >= 0),
  reward_gems   integer not null default 0 check (reward_gems between 0 and 10),
  reward_xp     integer not null default 0 check (reward_xp >= 0),
  min_level     integer not null default 1 check (min_level >= 1),
  sort          integer not null default 0
);

create table public.daily_quests (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  day         date not null,
  quest_code  text not null references public.quest_catalog (code),
  claimed_at  timestamptz,
  created_at  timestamptz not null default now(),
  primary key (user_id, day, quest_code)
);

alter table public.quest_catalog enable row level security;
alter table public.daily_quests enable row level security;
create policy "catalog readable" on public.quest_catalog for select to anon, authenticated using (true);
create policy "own quests" on public.daily_quests for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.quest_catalog, public.daily_quests to authenticated;

create index transactions_log_user_created_idx on public.transactions_log (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Danh mục
-- ---------------------------------------------------------------------------

insert into public.quest_catalog (code, grp, title, description, metric, param, n1, n2, target, reward_coins, reward_gems, reward_xp, min_level, sort) values
  -- Giao đơn
  ('serve_3',        'serve',       'Mở hàng',                'Giao 3 đơn cho khách',                          'serve',          null,        null, null,  3,  60, 0, 10, 1,  1),
  ('serve_8',        'serve',       'Chăm chỉ',               'Giao 8 đơn cho khách',                          'serve',          null,        null, null,  8, 150, 1, 20, 1,  2),
  ('serve_15',       'serve',       'Ngày bận rộn',           'Giao 15 đơn cho khách',                         'serve',          null,        null, null, 15, 300, 3, 35, 3,  3),
  ('serve_25',       'serve',       'Không ngơi tay',         'Giao 25 đơn cho khách',                         'serve',          null,        null, null, 25, 500, 5, 50, 6,  4),
  -- Chất lượng
  ('q4_3',           'q4',          'Bánh ngon',              'Giao 3 đơn đạt từ 4 sao',                       'serve_q',        null,        4,    null,  3,  90, 0, 12, 1, 10),
  ('q4_8',           'q4',          'Tiệm uy tín',            'Giao 8 đơn đạt từ 4 sao',                       'serve_q',        null,        4,    null,  8, 200, 2, 25, 3, 11),
  ('q5_2',           'q5',          'Hoàn hảo',               'Giao 2 đơn đạt 5 sao',                          'serve_q',        null,        5,    null,  2, 100, 1, 15, 1, 12),
  ('q5_5',           'q5',          'Bàn tay vàng',           'Giao 5 đơn đạt 5 sao',                          'serve_q',        null,        5,    null,  5, 220, 2, 30, 3, 13),
  -- Cách nấu
  ('bake_5',         'm_bake',      'Lò luôn đỏ lửa',         'Giao 5 món nướng',                              'serve_method',   'bake',      null, null,  5, 100, 0, 12, 1, 20),
  ('fry_3',          'm_fry',       'Chảo dầu sôi',           'Giao 3 món chiên',                              'serve_method',   'fry',       null, null,  3,  90, 0, 12, 2, 21),
  ('steam_2',        'm_steam',     'Xửng hấp thơm',          'Giao 2 món hấp',                                'serve_method',   'steam',     null, null,  2,  90, 1, 12, 5, 22),
  ('chill_2',        'm_chill',     'Mát lạnh',               'Giao 2 món làm lạnh',                           'serve_method',   'chill',     null, null,  2, 150, 2, 20, 22, 23),
  -- Đóng gói
  ('bag_4',          'p_bag',       'Túi giấy xinh',          'Giao 4 đơn đóng túi giấy',                      'serve_pack',     'bag',       null, null,  4,  80, 0, 10, 1, 30),
  ('box_4',          'p_box',       'Hộp quà ngọt',           'Giao 4 đơn đóng hộp giấy',                      'serve_pack',     'box',       null, null,  4,  80, 0, 10, 1, 31),
  -- Khách đặc biệt
  ('picky_2',        'picky',       'Chiều khách khó tính',   'Làm hài lòng 2 khách kỹ tính (đủ số sao họ đòi)', 'serve_picky',  null,        null, null,  2, 120, 1, 15, 1, 40),
  ('impatient_3',    'impatient',   'Nhanh như chớp',         'Giao kịp 3 đơn cho khách nóng tính',            'serve_impatient', null,       null, null,  3, 100, 0, 12, 1, 41),
  ('dash_1',         'dash',        'Khách lém lỉnh',         'Giao 1 đơn cho khách hay quịt mà vẫn thu được tiền', 'serve_dash', null,        null, null,  1,  80, 1, 10, 1, 42),
  -- Sốt & topping
  ('sauce_4',        'sauce',       'Thêm chút sốt',          'Giao 4 đơn có nước chấm/sốt',                   'serve_sauce',    null,        null, null,  4,  80, 0, 10, 1, 50),
  ('topping_4',      'topping',     'Rắc topping',            'Giao 4 đơn có topping',                         'serve_topping',  null,        null, null,  4,  80, 0, 10, 1, 51),
  ('exact_5',        'exact',       'Đúng ý khách',           'Giao 5 đơn đúng sốt & topping khách gọi',       'serve_exact',    null,        null, null,  5, 120, 1, 15, 1, 52),
  -- Đa dạng món
  ('distinct_3',     'distinct',    'Thực đơn phong phú',     'Giao 3 món bánh khác nhau',                     'serve_distinct', null,        null, null,  3,  90, 0, 12, 1, 60),
  ('distinct_6',     'distinct',    'Đầu bếp đa tài',         'Giao 6 món bánh khác nhau',                     'serve_distinct', null,        null, null,  6, 200, 2, 25, 4, 61),
  ('hard_3',         'hard',        'Thợ lành nghề',          'Giao 3 món từ cấp 5 trở lên',                   'serve_minlvl',   null,        5,    null,  3, 150, 1, 18, 6, 62),
  -- Khung giờ (giờ game)
  ('rush_4',         'rush',        'Giờ cao điểm',           'Giao 4 đơn trong giờ cao điểm (11–13h, 18–21h)', 'serve_rush',    null,        null, null,  4, 120, 1, 15, 1, 70),
  ('quiet_3',        'quiet',       'Giờ vắng không nghỉ',    'Giao 3 đơn trong giờ vắng khách',               'serve_quiet',    null,        null, null,  3,  90, 0, 12, 1, 71),
  ('morning_3',      'morning',     'Bữa sáng',               'Giao 3 đơn từ 7:00 đến 11:00 (giờ game)',        'serve_window',   null,        420,  660,   3,  90, 0, 12, 1, 72),
  ('night_3',        'night',       'Cú đêm',                 'Giao 3 đơn từ 21:00 đến 24:00 (giờ game)',       'serve_window',   null,        1260, 1440,  3,  90, 0, 12, 1, 73),
  -- Doanh thu, tip, uy tín
  ('revenue_300',    'revenue',     'Buôn may bán đắt',       'Thu 300 ₵ từ khách trong ngày',                 'revenue',        null,        null, null,  300,  80, 0, 10, 1, 80),
  ('revenue_1000',   'revenue',     'Két đầy xu',             'Thu 1.000 ₵ từ khách trong ngày',               'revenue',        null,        null, null, 1000, 180, 1, 20, 3, 81),
  ('revenue_3000',   'revenue',     'Đại gia tiệm bánh',      'Thu 3.000 ₵ từ khách trong ngày',               'revenue',        null,        null, null, 3000, 400, 3, 40, 8, 82),
  ('tips_50',        'tips',        'Tiền boa',               'Nhận tổng 50 ₵ tiền tip',                       'tips',           null,        null, null,   50,  80, 0, 10, 1, 83),
  ('tips_150',       'tips',        'Khách hào phóng',        'Nhận tổng 150 ₵ tiền tip',                      'tips',           null,        null, null,  150, 180, 1, 20, 4, 84),
  ('rep_3',          'rep',         'Được lòng khách',        'Tăng 3 uy tín nhờ phục vụ tốt',                 'rep',            null,        null, null,    3, 100, 1, 12, 1, 85),
  -- Món cụ thể (chỉ bốc khi đã mở khoá món)
  ('r_bread_3',      'r_bread',     'Mẻ bánh mì sớm',         'Giao 3 Bánh mì trắng',                          'serve_recipe',   'bread',     null, null,  3,  70, 0, 10, 1, 90),
  ('r_sponge_2',     'r_sponge',    'Bông lan mềm xốp',       'Giao 2 Bánh bông lan',                          'serve_recipe',   'sponge',    null, null,  2,  70, 0, 10, 1, 91),
  ('r_baguette_2',   'r_baguette',  'Vỏ giòn ruột mềm',       'Giao 2 Baguette',                               'serve_recipe',   'baguette',  null, null,  2,  70, 0, 10, 1, 92),
  ('r_donut_2',      'r_donut',     'Donut tròn xoe',         'Giao 2 Donut',                                  'serve_recipe',   'donut',     null, null,  2,  80, 0, 10, 2, 93),
  ('r_cookie_3',     'r_cookie',    'Hũ bánh quy',            'Giao 3 Chocolate Chip Cookie',                  'serve_recipe',   'cookie',    null, null,  3,  90, 0, 12, 2, 94),
  ('r_croissant_2',  'r_croissant', 'Ngàn lớp bơ',            'Giao 2 Croissant',                              'serve_recipe',   'croissant', null, null,  2,  90, 1, 12, 3, 95),
  ('r_cupcake_2',    'r_cupcake',   'Cupcake xinh xắn',       'Giao 2 Vanilla Cupcake',                        'serve_recipe',   'cupcake',   null, null,  2,  90, 1, 12, 4, 96),
  ('r_fruit_tart_2', 'r_fruit_tart','Tart trái cây',          'Giao 2 Fruit Tart',                             'serve_recipe',   'fruit_tart',null, null,  2, 110, 1, 14, 5, 97),
  ('r_choco_cake_2', 'r_choco_cake','Mê socola',              'Giao 2 Chocolate Cake',                         'serve_recipe',   'choco_cake',null, null,  2, 130, 1, 16, 7, 98),
  ('r_berry_choco_1','r_berry_choco','Rừng đen huyền thoại',  'Giao 1 Black Forest',                           'serve_recipe',   'berry_choco',null, null, 1, 150, 2, 18, 10, 99),
  -- Mua sắm & hoạt động khác
  ('buy_10',         'buy_qty',     'Đi chợ sáng',            'Mua 10 nguyên liệu từ nhà cung cấp',            'buy_qty',        null,        null, null, 10,  50, 0,  8, 1, 110),
  ('buy_30',         'buy_qty',     'Nhập hàng lớn',          'Mua 30 nguyên liệu từ nhà cung cấp',            'buy_qty',        null,        null, null, 30, 120, 1, 15, 3, 111),
  ('buy_kinds_5',    'buy_kinds',   'Kho đầy đủ',             'Mua 5 loại nguyên liệu khác nhau',              'buy_kinds',      null,        null, null,  5,  80, 0, 10, 1, 112),
  ('checkin_1',      'checkin',     'Ghé tiệm mỗi ngày',      'Điểm danh hôm nay',                             'checkin',        null,        null, null,  1,  40, 1,  5, 1, 120),
  ('reply_2',        'reply',       'Chủ tiệm tận tâm',       'Trả lời 2 đánh giá của khách',                  'reply',          null,        null, null,  2,  80, 1, 10, 1, 121),
  ('market_list_1',  'market_list', 'Mở sạp ở chợ',           'Rao bán 1 món ở Chợ',                           'market_list',    null,        null, null,  1,  80, 0, 10, 4, 122),
  ('market_buy_1',   'market_buy',  'Săn hàng ở chợ',         'Mua 1 món ở Chợ của người chơi khác',           'market_buy',     null,        null, null,  1,  80, 0, 10, 4, 123),
  ('upgrade_1',      'upgrade',     'Tân trang tiệm',         'Mua 1 nâng cấp hoặc đồ trang trí',              'upgrade',        null,        null, null,  1, 100, 2, 10, 2, 124);

-- Món trong nhiệm vụ phải tồn tại và không bốc trước khi mở khoá.
do $$
begin
  if exists (
    select 1 from public.quest_catalog q left join public.recipes r on r.code = q.param
    where q.metric = 'serve_recipe' and (r.code is null or q.min_level < r.unlock_level)
  ) then
    raise exception 'nhiệm vụ món: mã món sai hoặc min_level thấp hơn cấp mở khoá';
  end if;
  if (select count(distinct grp) from public.quest_catalog where min_level = 1) < 15 then
    raise exception 'cấp 1 phải có ít nhất 15 nhóm nhiệm vụ';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tiến độ (server tính từ dữ liệu thật trong ngày giờ Việt Nam)
-- ---------------------------------------------------------------------------

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
    -- Đơn đã giao trong ngày: 'served' (đã trả tiền) + 'dashed' (giao rồi nhưng khách quịt).
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
      where cv.user_id = p_user and cv.status in ('served', 'dashed')
        and cv.created_at >= v_from - interval '10 minutes'
        and coalesce(cv.served_at, cv.arrive_at) >= v_from and coalesce(cv.served_at, cv.arrive_at) < v_to
    ) v
    join public.recipes r on r.code = v.recipe_code
    join public.customers c on c.id = v.customer_id;
  end if;
  return least(coalesce(v_n, 0), 2147483647)::integer;
end $$;

-- Bốc 15 nhiệm vụ cho hôm nay nếu chưa có (mỗi nhóm tối đa 1).
create or replace function public._ensure_daily_quests(p_user uuid, p_level integer, p_day date)
returns void language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.daily_quests where user_id = p_user and day = p_day) then
    return;
  end if;
  insert into public.daily_quests (user_id, day, quest_code)
  select p_user, p_day, g.code
  from (
    select distinct on (grp) code from public.quest_catalog
    where min_level <= p_level
    order by grp, random()
  ) g
  order by random()
  limit 15;
end $$;

create or replace function public._quests_json(p_user uuid, p_day date)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', q.code, 'title', q.title, 'description', q.description, 'target', q.target,
    'progress', least(q.target, public._quest_progress(p_user, p_day, q)),
    'reward_coins', q.reward_coins, 'reward_gems', q.reward_gems, 'reward_xp', q.reward_xp,
    'claimed', d.claimed_at is not null
  ) order by q.sort), '[]'::jsonb)
  from public.daily_quests d join public.quest_catalog q on q.code = d.quest_code
  where d.user_id = p_user and d.day = p_day;
$$;

-- Danh sách nhiệm vụ hôm nay + tiến độ.
create or replace function public.get_daily_quests(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v     public.profiles;
  v_day date := public._today();
begin
  v := public._lock_profile(p_user);
  perform public._ensure_daily_quests(p_user, v.level, v_day);
  return jsonb_build_object(
    'day', v_day,
    'resets_at', (v_day + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh',
    'quests', public._quests_json(p_user, v_day)
  );
end $$;

-- Nhận thưởng 1 nhiệm vụ đã hoàn thành hôm nay.
create or replace function public.claim_quest(p_user uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v       public.profiles;
  d       public.daily_quests;
  q       public.quest_catalog;
  v_day   date := public._today();
  v_xp    bigint;
  v_level integer;
begin
  v := public._lock_profile(p_user);
  select * into d from public.daily_quests
  where user_id = p_user and day = v_day and quest_code = p_code for update;
  if not found then
    perform public._fail('NOT_FOUND');
  end if;
  if d.claimed_at is not null then
    perform public._fail('QUEST_CLAIMED');
  end if;
  select * into q from public.quest_catalog where code = p_code;
  if public._quest_progress(p_user, v_day, q) < q.target then
    perform public._fail('QUEST_NOT_DONE');
  end if;
  perform public._rate_limit(p_user, 'quest_reward', 20, interval '1 day');

  v_xp := v.xp + q.reward_xp;
  v_level := public._level_for_xp(v_xp);
  update public.profiles
  set coins = coins + q.reward_coins, gems = gems + q.reward_gems, xp = v_xp, level = v_level, updated_at = now()
  where id = p_user;
  update public.daily_quests set claimed_at = now()
  where user_id = p_user and day = v_day and quest_code = p_code;
  perform public._log(p_user, 'quest_reward', q.reward_coins, q.reward_gems, null,
    jsonb_build_object('quest', p_code, 'day', v_day, 'xp', q.reward_xp));

  return jsonb_build_object(
    'coins', q.reward_coins, 'gems', q.reward_gems, 'xp', q.reward_xp,
    'level', v_level, 'leveled_up', v_level > v.level
  );
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_daily_quests(uuid), public.claim_quest(uuid, text) to service_role;
