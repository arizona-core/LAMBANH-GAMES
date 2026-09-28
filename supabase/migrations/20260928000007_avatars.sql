-- Ảnh chân dung: gán cho một số khách NPC + cho chủ tiệm chọn làm avatar (đổi miễn phí).
-- Ảnh nằm ở public/images/customers/ (nguồn: assets/source/customers/, chạy npm run assets:build).
-- Khách chưa có ảnh hiển thị dấu "?".

update public.customers set image = '/images/customers/alien.webp'       where id = 6;    -- Lý Văn Huy (Lém lỉnh)
update public.customers set image = '/images/customers/glasses-man.webp' where id = 219;
update public.customers set image = '/images/customers/old-dad.webp'     where id = 410;
update public.customers set image = '/images/customers/curly-man.webp'   where id = 430;
update public.customers set image = '/images/customers/cap-man.webp'     where id = 473;
update public.customers set image = '/images/customers/asian-girl.webp'  where id = 7;    -- Dương Bảo Dung (Kỹ tính)

-- Avatar chủ tiệm: 4 kiểu vẽ (a1..a4) + ảnh chân dung (p_*).
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check check (avatar in (
  'a1', 'a2', 'a3', 'a4',
  'p_glasses', 'p_olddad', 'p_curly', 'p_girl', 'p_cap', 'p_alien'
));

create or replace function public.update_avatar(p_user uuid, p_avatar text, p_color text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public._lock_profile(p_user);
  perform public._rate_limit(p_user, 'update_avatar', 30, interval '1 day');
  begin
    update public.profiles set avatar = p_avatar, color = coalesce(p_color, color), updated_at = now()
    where id = p_user;
  exception when check_violation then
    perform public._fail('INVALID_INPUT');
  end;
  perform public._log(p_user, 'update_avatar', 0, 0, null, jsonb_build_object('avatar', p_avatar, 'color', p_color));
  return jsonb_build_object('avatar', p_avatar);
end $$;

revoke execute on function public.update_avatar(uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_avatar(uuid, text, text) to service_role;
