-- Sweet Shop — mỗi lúc chỉ 2–3 khách trong tiệm.
--
-- Thay cho quầy chứa 4 khách (cao điểm 6) ở migration 0009/0012:
--   • Giờ thường / vắng: tối đa 2 khách cùng lúc. Giờ cao điểm: tối đa 3.
--   • Tính cả khách đang chờ bánh (status 'cooking'), không chỉ khách xếp hàng — đủ chỗ thì
--     khách mới không vào cho tới khi có người được phục vụ xong hoặc bỏ về.
--   • Giờ cao điểm vẫn có nhóm 2–3 khách vào cùng lúc, nhưng không vượt giới hạn trên.

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
  v_present integer;   -- khách đang trong tiệm: xếp hàng (kể cả sắp tới) + đang chờ bánh
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
    select count(*) into v_present from public.customer_visits
    where user_id = p_user and status in ('waiting', 'cooking');

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
      v_cap := case when v_mult >= 1.5 then 3 else 2 end;
      v_group := case when v_mult >= 1.5 and random() < 0.25 then 2 + floor(random() * 2)::int else 1 end;

      for g in 1..v_group loop
        exit when v_present >= v_cap;
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
        v_present := v_present + 1;
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

revoke execute on function public._customer_tick_at(uuid, timestamptz) from public, anon, authenticated;
