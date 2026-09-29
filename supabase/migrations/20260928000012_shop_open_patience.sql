-- Sweet Shop — đóng cửa tiệm khi không online + khách chờ tối đa 60 giây (hay hối: 40 giây).
--
-- Đóng cửa:
--   • Tự động: nhịp customer-tick thấy lần hoạt động cuối (last_seen_at) đã quá 90 giây → người chơi
--     vừa offline. Khách hết hạn chờ trong lúc đó chỉ lặng lẽ ra về (status 'closed'):
--     KHÔNG trừ uy tín, KHÔNG để lại đánh giá 1 sao.
--   • Chủ tiệm tự đóng (set_shop_open false): khách đang xếp hàng ra về không phạt, không sinh khách
--     mới cho tới khi mở lại. Đơn đang làm dở vẫn được làm nốt.
-- Kiên nhẫn: chờ ở quầy và chờ bánh sau khi nhận đơn đều tối đa 60 giây (khách hay hối 40 giây).

alter table public.profiles add column shop_open boolean not null default true;

alter table public.customer_visits drop constraint if exists customer_visits_status_check;
alter table public.customer_visits add constraint customer_visits_status_check
  check (status in ('waiting', 'cooking', 'served', 'dashed', 'left', 'closed'));

update public.customers set patience_seconds = case when impatient then 40 else 60 end;
update public.customer_visits v
set leave_at = least(v.leave_at, greatest(v.arrive_at, now()) + make_interval(secs => c.patience_seconds))
from public.customers c
where c.id = v.customer_id and v.status in ('waiting', 'cooking');

-- ---------------------------------------------------------------------------
-- Nhịp khách (bản 0009 + đóng cửa)
-- ---------------------------------------------------------------------------

create or replace function public._customer_tick_at(p_user uuid, p_now timestamptz)
returns jsonb language plpgsql set search_path = '' as $$
declare
  c_open_seconds constant numeric := 1020;
  c_horizon      constant interval := interval '60 seconds';
  c_sit_seconds  constant integer := 40;
  c_offline      constant interval := interval '90 seconds';
  v         public.profiles;
  v_offline boolean;
  v_seats   integer;
  v_per_day numeric;
  v_base    numeric;   -- khoảng cách trung bình giữa 2 lượt ghé ở hệ số 1 (giây)
  v_mult    numeric;
  v_from    timestamptz;
  v_to      timestamptz := p_now + c_horizon;
  v_t       timestamptz;
  v_left    integer := 0;
  v_closed  integer := 0;
  v_penalty integer := 0;
  v_waiting integer;
  v_cap     integer;
  v_group   integer;
  cust      public.customers;
  v_recipe  text;
  v_sauce   text;
  v_topping text;
  v_made    integer := 0;
  v_minute  integer;
begin
  v := public._lock_profile(p_user);
  v_seats := public._seat_count(p_user);
  -- last_seen_at là lần hoạt động TRƯỚC nhịp này (customer_tick cập nhật sau khi gọi hàm này).
  v_offline := v.last_seen_at is null or v.last_seen_at < p_now - c_offline;

  if v_offline then
    -- Người chơi vừa offline: tiệm coi như đóng cửa, khách hết hạn ra về không phạt.
    update public.customer_visits set status = 'closed', reputation_delta = 0
    where user_id = p_user and status in ('waiting', 'cooking') and leave_at < p_now;
    get diagnostics v_closed = row_count;
  else
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
  end if;
  update public.bake_sessions bs set status = 'abandoned', completed_at = p_now
  from public.customer_visits cv
  where bs.visit_id = cv.id and bs.status = 'active' and cv.user_id = p_user and cv.status in ('left', 'closed');

  if v.shop_open then
    v_per_day := least(90, 45 + v.reputation / 20 + 3 * (v_seats - 2));
    v_base := c_open_seconds / v_per_day;
    v_from := greatest(p_now, coalesce(v.visits_until, p_now));
    select count(*) into v_waiting from public.customer_visits where user_id = p_user and status = 'waiting';

    -- Bước thời gian: khoảng cách ngẫu nhiên (phân phối mũ) co giãn theo hệ số giờ tại thời điểm đó.
    v_t := v_from;
    loop
      v_minute := public._game_minute(v_t);
      v_mult := public._traffic_mult(v_minute);
      if v_mult = 0 then
        -- Đang đóng cửa theo giờ game: nhảy tới 7:00 (hoặc hết cửa sổ).
        v_t := v_t + make_interval(secs => 420 - v_minute);
      else
        v_t := v_t + make_interval(secs => -ln(1 - random()) * v_base / v_mult);
      end if;
      exit when v_t >= v_to;

      v_minute := public._game_minute(v_t);
      v_mult := public._traffic_mult(v_minute);
      continue when v_mult = 0;
      v_cap := case when v_mult >= 1.5 then 6 else 4 end;
      v_group := case when v_mult >= 1.5 and random() < 0.25 then 2 + floor(random() * 2)::int else 1 end;

      for g in 1..v_group loop
        exit when v_waiting >= v_cap;
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
        -- Khách trong nhóm vào cách nhau 1–2 giây.
        insert into public.customer_visits (user_id, customer_id, recipe_code, sauce_code, topping_code, arrive_at, leave_at)
        values (p_user, cust.id, v_recipe, v_sauce, v_topping,
                v_t + make_interval(secs => (g - 1) * 1.5),
                v_t + make_interval(secs => (g - 1) * 1.5 + cust.patience_seconds));
        v_waiting := v_waiting + 1;
        v_made := v_made + 1;
      end loop;
    end loop;

    update public.profiles set visits_until = v_to where id = p_user;
  end if;

  return jsonb_build_object(
    'server_now', p_now,
    'clock', public._game_clock(p_now),
    'traffic', public._traffic_level(public._game_minute(p_now)),
    'shop_open', v.shop_open,
    'left', v_left,
    'closed_offline', v_closed,
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

-- Xử lý nhịp TRƯỚC rồi mới ghi last_seen_at, để nhịp biết người chơi vừa offline hay không.
create or replace function public.customer_tick(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  v_result := public._customer_tick_at(p_user, now());
  update public.profiles set last_seen_at = now() where id = p_user;
  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- Chủ tiệm tự đóng / mở cửa
-- ---------------------------------------------------------------------------

create or replace function public.set_shop_open(p_user uuid, p_open boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v       public.profiles;
  v_sent  integer := 0;
begin
  if p_open is null then
    perform public._fail('INVALID_INPUT');
  end if;
  v := public._lock_profile(p_user);
  if v.shop_open = p_open then
    return jsonb_build_object('shop_open', p_open, 'sent_home', 0);
  end if;
  perform public._rate_limit(p_user, 'shop_toggle', 100, interval '1 day');

  if not p_open then
    -- Khách đang xếp hàng (kể cả sắp tới) ra về, không phạt. Đơn đang làm dở giữ nguyên.
    update public.customer_visits set status = 'closed', reputation_delta = 0
    where user_id = p_user and status = 'waiting';
    get diagnostics v_sent = row_count;
  end if;
  update public.profiles
  set shop_open = p_open, visits_until = case when p_open then null else visits_until end, updated_at = now()
  where id = p_user;

  perform public._log(p_user, 'shop_toggle', 0, 0, null, jsonb_build_object('open', p_open, 'sent_home', v_sent));
  return jsonb_build_object('shop_open', p_open, 'sent_home', v_sent);
end $$;

-- ---------------------------------------------------------------------------
-- Nhận đơn (bản 0005): chờ bánh tối đa 60 giây, khách hay hối 40 giây
-- ---------------------------------------------------------------------------

create or replace function public.accept_order(p_user uuid, p_visit uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v    public.profiles;
  cv   public.customer_visits;
  c    public.customers;
  r    public.recipes;
  v_session uuid;
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
    update public.customer_visits
    set status = 'cooking', leave_at = now() + make_interval(secs => case when c.impatient then 40 else 60 end)
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

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.customer_tick(uuid), public.accept_order(uuid, uuid), public.set_shop_open(uuid, boolean)
to service_role;
