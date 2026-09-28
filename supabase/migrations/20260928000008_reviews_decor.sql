-- Sweet Shop — đánh giá của khách + trang trí tiệm (bàn ghế, đồ treo, theme).
--
-- Đánh giá: tự sinh khi đơn được giao (served) hoặc khi khách bỏ đi trong bực bội (left).
--   Số sao + lời nhận xét do SERVER quyết định theo chất lượng đơn và tính cách khách.
--   Chủ tiệm trả lời được mỗi đánh giá 1 lần; trả lời lịch sự (≥10 ký tự, không từ bậy) +1 uy tín.
-- Trang trí: decor_type (seating/wall/floor/ceiling/theme), seats = số chỗ ngồi.
--   Tiệm có sẵn 2 chỗ ngồi; mỗi chỗ ngồi thêm → +3 lượt khách/ngày game (tối đa 90).
--   Theme đổi màu tường/sàn/quầy, chọn theme đang dùng bằng set_theme.

-- ---------------------------------------------------------------------------
-- Trang trí
-- ---------------------------------------------------------------------------

alter table public.upgrade_catalog
  add column decor_type text check (decor_type in ('seating', 'wall', 'floor', 'ceiling', 'theme')),
  add column seats integer not null default 0 check (seats between 0 and 8);

update public.upgrade_catalog set decor_type = 'seating', seats = 2 where code = 'decor_table';
update public.upgrade_catalog set decor_type = 'floor'   where code = 'decor_plant';
update public.upgrade_catalog set decor_type = 'wall'    where code = 'decor_neon';
update public.upgrade_catalog set decor_type = 'ceiling' where code = 'decor_lamp';
update public.upgrade_catalog set description = '+2 chỗ ngồi · +5 uy tín' where code = 'decor_table';

insert into public.upgrade_catalog (code, kind, tier, name, description, cost_coins, cost_gems, unlock_level, effect, sort, decor_type, seats) values
  ('seat_wood',        'decor', 1, 'Bộ bàn ghế gỗ',       '+2 chỗ ngồi · +3 uy tín',   400,   0, 1,  3, 20, 'seating', 2),
  ('seat_iron',        'decor', 1, 'Bàn sắt ban công',    '+2 chỗ ngồi · +4 uy tín',   700,   0, 3,  4, 21, 'seating', 2),
  ('seat_sofa',        'decor', 1, 'Sofa êm ái',          '+3 chỗ ngồi · +8 uy tín',     0,  60, 1,  8, 22, 'seating', 3),
  ('seat_bar',         'decor', 1, 'Quầy bar 4 ghế',      '+4 chỗ ngồi · +8 uy tín',  1500,   0, 5,  8, 23, 'seating', 4),
  ('wall_painting',    'decor', 1, 'Tranh bánh ngọt',     '+3 uy tín',                  250,   0, 1,  3, 30, 'wall', 0),
  ('wall_clock',       'decor', 1, 'Đồng hồ treo tường',  '+3 uy tín',                  300,   0, 1,  3, 31, 'wall', 0),
  ('wall_shelf',       'decor', 1, 'Kệ treo cốc',         '+4 uy tín',                  350,   0, 2,  4, 32, 'wall', 0),
  ('wall_curtain',     'decor', 1, 'Rèm cửa sổ',          '+2 uy tín',                  200,   0, 1,  2, 33, 'wall', 0),
  ('floor_rug',        'decor', 1, 'Thảm tròn',           '+3 uy tín',                  300,   0, 1,  3, 40, 'floor', 0),
  ('floor_bigplant',   'decor', 1, 'Chậu cây lớn',        '+4 uy tín',                  450,   0, 2,  4, 41, 'floor', 0),
  ('floor_cakecase',   'decor', 1, 'Tủ bánh kính',        '+6 uy tín',                  800,   0, 3,  6, 42, 'floor', 0),
  ('ceil_lantern',     'decor', 1, 'Đèn lồng',            '+6 uy tín',                    0,  40, 1,  6, 50, 'ceiling', 0),
  ('ceil_garland',     'decor', 1, 'Dây cờ trang trí',    '+2 uy tín',                  200,   0, 1,  2, 51, 'ceiling', 0),
  ('theme_pastel',     'decor', 1, 'Theme Pastel',        'Đổi kiểu cả tiệm · +5 uy tín', 1200, 0, 2,  5, 60, 'theme', 0),
  ('theme_wood',       'decor', 1, 'Theme Gỗ mộc',        'Đổi kiểu cả tiệm · +5 uy tín', 1500, 0, 4,  5, 61, 'theme', 0),
  ('theme_midautumn',  'decor', 1, 'Theme Trung Thu',     'Đổi kiểu cả tiệm · +8 uy tín',    0, 80, 1,  8, 62, 'theme', 0),
  ('theme_xmas',       'decor', 1, 'Theme Giáng sinh',    'Đổi kiểu cả tiệm · +8 uy tín',    0, 100, 1, 8, 63, 'theme', 0);

alter table public.profiles add column active_theme text not null default 'default';

create or replace function public._seat_count(p_user uuid)
returns integer language sql stable set search_path = '' as $$
  select 2 + coalesce(sum(c.seats), 0)::integer
  from public.upgrades u join public.upgrade_catalog c on c.code = u.upgrade_code
  where u.user_id = p_user;
$$;

create or replace function public.set_theme(p_user uuid, p_theme text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public._lock_profile(p_user);
  if p_theme <> 'default' and not exists (
    select 1 from public.upgrades u join public.upgrade_catalog c on c.code = u.upgrade_code
    where u.user_id = p_user and u.upgrade_code = p_theme and c.decor_type = 'theme'
  ) then
    perform public._fail('NOT_OWNED');
  end if;
  update public.profiles set active_theme = p_theme, updated_at = now() where id = p_user;
  return jsonb_build_object('theme', p_theme);
end $$;

-- ---------------------------------------------------------------------------
-- Đánh giá
-- ---------------------------------------------------------------------------

alter table public.customer_visits add column served_at timestamptz;

create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  visit_id     uuid not null unique references public.customer_visits (id) on delete cascade,
  customer_id  integer not null references public.customers (id),
  stars        smallint not null check (stars between 1 and 5),
  comment      text not null,
  reply        text check (char_length(reply) between 2 and 200),
  replied_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index reviews_user_idx on public.reviews (user_id, created_at desc);

alter table public.reviews enable row level security;
create policy "own reviews" on public.reviews for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.reviews to authenticated;

create or replace function public._pick(p_options text[])
returns text language sql volatile set search_path = '' as $$
  select p_options[1 + floor(random() * cardinality(p_options))::int];
$$;

create or replace function public._review_comment(p_stars integer, c public.customers, p_left boolean, p_wrong_extras boolean)
returns text language sql volatile set search_path = '' as $$
  select case
    when p_left then public._pick(array[
      'Đợi mãi chẳng ai phục vụ, bỏ về luôn!', 'Chậm quá, lần sau không ghé nữa.',
      'Quán đông mà ít người làm, chờ mỏi chân.', 'Chờ lâu quá trời, tui đi quán khác.'])
    when p_wrong_extras and p_stars <= 3 then public._pick(array[
      'Gọi một đằng ra một nẻo, sốt/topping sai hết.', 'Mình dặn kỹ rồi mà vẫn làm sai món thêm.',
      'Bánh tạm được nhưng làm nhầm topping của mình.'])
    when p_stars = 5 and c.picky then public._pick(array[
      'Hiếm lắm mới gặp chỗ làm chuẩn thế này. Đạt!', 'Khó tính như tôi cũng phải khen: hoàn hảo.',
      'Đúng vị, đúng độ, trình bày đẹp. 10 điểm.'])
    when p_stars = 5 then public._pick(array[
      'Ngon xuất sắc, nhất định quay lại!', 'Bánh thơm, nóng hổi, chủ quán dễ thương quá.',
      'Tuyệt vời! Sẽ giới thiệu bạn bè.', 'Ăn một miếng mê luôn, 5 sao!'])
    when p_stars = 4 then public._pick(array[
      'Ngon, giá hợp lý. Sẽ quay lại.', 'Bánh ổn, chỉ cần đẹp hơn chút nữa.',
      'Khá ngon, phục vụ nhanh.', 'Hài lòng, lần sau thử món khác.'])
    when p_stars = 3 and c.picky then public._pick(array[
      'Tạm. Nướng chưa tới, chưa xứng với giá.', 'Bình thường thôi, tôi kỳ vọng hơn.'])
    when p_stars = 3 then public._pick(array[
      'Tạm được, không có gì đặc biệt.', 'Ăn được, nhưng hơi khô.', 'Bình thường.'])
    when c.impatient then public._pick(array[
      'Vừa chậm vừa dở, thất vọng.', 'Làm lâu mà bánh chẳng ra gì.'])
    else public._pick(array[
      'Bánh bị hỏng rồi, không ngon.', 'Không đúng như mong đợi.', 'Chắc do hôm nay quán xui, bánh tệ quá.'])
  end;
$$;

create or replace function public._visits_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'served' and old.status is distinct from 'served' then
    new.served_at := now();
  end if;
  return new;
end $$;

create trigger customer_visits_before_update
before update of status on public.customer_visits
for each row execute function public._visits_before_update();

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
  elsif new.status = 'left' and (c.impatient or old.status = 'cooking') then
    insert into public.reviews (user_id, visit_id, customer_id, stars, comment)
    values (new.user_id, new.id, c.id, 1, public._review_comment(1, c, true, false))
    on conflict (visit_id) do nothing;
  end if;
  return new;
end $$;

create trigger customer_visits_after_update
after update of status on public.customer_visits
for each row execute function public._visits_after_update();

create or replace function public.reply_review(p_user uuid, p_review uuid, p_reply text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r       public.reviews;
  v_text  text := btrim(regexp_replace(coalesce(p_reply, ''), '\s+', ' ', 'g'));
  v_bonus integer;
begin
  perform public._lock_profile(p_user);
  select * into r from public.reviews where id = p_review and user_id = p_user for update;
  if not found then
    perform public._fail('NOT_FOUND');
  end if;
  if r.reply is not null then
    perform public._fail('ALREADY_REPLIED');
  end if;
  if char_length(v_text) not between 2 and 200 then
    perform public._fail('INVALID_INPUT');
  end if;
  if public._is_bad_name(v_text) then
    perform public._fail('NAME_NOT_ALLOWED');
  end if;
  perform public._rate_limit(p_user, 'review_reply', 100, interval '1 day');

  -- Trả lời có tâm (≥10 ký tự) → khách thấy được quan tâm: +1 uy tín.
  v_bonus := case when char_length(v_text) >= 10 then 1 else 0 end;
  update public.reviews set reply = v_text, replied_at = now() where id = r.id;
  update public.profiles set reputation = reputation + v_bonus, updated_at = now() where id = p_user;
  perform public._log(p_user, 'review_reply', 0, 0, r.id, jsonb_build_object('bonus', v_bonus));
  return jsonb_build_object('reputation_gained', v_bonus);
end $$;

-- ---------------------------------------------------------------------------
-- Tick: chỗ ngồi tăng lượt khách + trả về khách vừa ăn xong (đang ngồi ghế)
-- ---------------------------------------------------------------------------

create or replace function public._customer_tick_at(p_user uuid, p_now timestamptz)
returns jsonb language plpgsql set search_path = '' as $$
declare
  c_open_seconds constant numeric := 1020;
  c_horizon      constant interval := interval '60 seconds';
  c_max_waiting  constant integer := 4;
  c_sit_seconds  constant integer := 40;
  v         public.profiles;
  v_seats   integer;
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
  v_seats := public._seat_count(p_user);

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

  v_per_day := least(90, 45 + v.reputation / 20 + 3 * (v_seats - 2));
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
    'seats', v_seats,
    'visits', coalesce((
      select jsonb_agg(public._visit_json(id) order by arrive_at)
      from public.customer_visits where user_id = p_user and status in ('waiting', 'cooking')
    ), '[]'::jsonb),
    'seated', coalesce((
      select jsonb_agg(public._visit_json(id) || jsonb_build_object('served_at', served_at) order by served_at)
      from (
        select id, served_at from public.customer_visits
        where user_id = p_user and status = 'served' and served_at > p_now - make_interval(secs => c_sit_seconds)
        order by served_at desc limit v_seats
      ) s
    ), '[]'::jsonb)
  );
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.customer_tick(uuid), public.accept_order(uuid, uuid),
  public.complete_order(uuid, uuid, text[], text, integer[], text, text, text),
  public.create_profile(uuid, text, text, text, text), public.create_listing(uuid, text, text, integer, integer, bigint),
  public.buy_listing(uuid, uuid), public.cancel_listing(uuid, uuid), public.update_avatar(uuid, text, text),
  public.set_theme(uuid, text), public.reply_review(uuid, uuid, text)
to service_role;
