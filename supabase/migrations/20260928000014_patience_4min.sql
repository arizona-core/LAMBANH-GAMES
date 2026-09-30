-- Sweet Shop — mỗi khách chờ tối đa 4 phút (240 giây), cả lúc xếp hàng ở quầy lẫn lúc chờ bánh.
-- Thay cho 60 giây / 40 giây (khách hay hối) ở migration 0012. Khách hay hối vẫn chê quán (−1 uy tín)
-- nếu bỏ về vì chờ lâu.

update public.customers set patience_seconds = 240;

-- Khách đang chờ ở quầy được nới hạn ngay.
update public.customer_visits
set leave_at = arrive_at + interval '240 seconds'
where status = 'waiting' and leave_at < arrive_at + interval '240 seconds';

-- Nhận đơn (bản 0012): chờ bánh 240 giây cho mọi khách.
create or replace function public.accept_order(p_user uuid, p_visit uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c_wait constant integer := 240;
  v    public.profiles;
  cv   public.customer_visits;
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

    update public.customer_visits
    set status = 'cooking', leave_at = now() + make_interval(secs => c_wait)
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
grant execute on function public.accept_order(uuid, uuid) to service_role;
