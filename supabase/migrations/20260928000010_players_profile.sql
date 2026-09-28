-- Sweet Shop — danh sách người chơi (online/offline), hồ sơ quán, tiểu sử, avatar tải lên.
--
-- Online: last_seen_at cập nhật mỗi nhịp customer-tick / heartbeat (~30 giây khi mở app).
--   Online = hoạt động trong 90 giây gần nhất.
-- Avatar tải lên: Supabase Storage bucket 'avatars' (công khai để đọc), mỗi người chỉ ghi vào
--   thư mục <user_id>/. Ảnh đã được thu nhỏ ở client (≤ 256px webp). Khi đổi avatar, Edge Function
--   xoá mọi ảnh cũ trong thư mục của người đó để tránh tốn dung lượng.

alter table public.profiles
  add column bio text not null default '' check (char_length(bio) <= 200),
  add column avatar_url text,
  add column last_seen_at timestamptz;

create index profiles_last_seen_idx on public.profiles (last_seen_at desc nulls last);

alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check check (avatar in (
  'a1', 'a2', 'a3', 'a4',
  'p_glasses', 'p_olddad', 'p_curly', 'p_girl', 'p_cap', 'p_alien',
  'custom'
));
alter table public.profiles add constraint profiles_custom_avatar_url
  check ((avatar = 'custom') = (avatar_url is not null));

-- ---------------------------------------------------------------------------
-- View công khai: thêm tiểu sử, avatar tải lên, lần hoạt động cuối, số liệu đánh giá.
-- (create or replace view chỉ cho thêm cột ở cuối → giữ nguyên thứ tự cột cũ.)
-- ---------------------------------------------------------------------------

create or replace view public.public_profiles
with (security_invoker = false) as
  select p.id, p.owner_name, p.shop_name::text as shop_name, p.slug, p.avatar, p.color, p.level, p.reputation,
         p.revenue_total, p.bio, p.avatar_url, p.last_seen_at, p.created_at, p.active_theme,
         (select count(*) from public.reviews r where r.user_id = p.id)::integer as review_count,
         (select round(avg(r.stars)::numeric, 2) from public.reviews r where r.user_id = p.id) as review_avg
  from public.profiles p;

create or replace view public.leaderboard
with (security_invoker = false) as
  select
    id, shop_name::text as shop_name, slug, avatar, color, level, reputation, revenue_total,
    rank() over (order by revenue_total desc, created_at) as revenue_rank,
    rank() over (order by reputation desc, created_at)    as reputation_rank,
    avatar_url
  from public.profiles;

revoke all on public.public_profiles, public.leaderboard from anon, authenticated;
grant select on public.public_profiles, public.leaderboard to authenticated;

-- ---------------------------------------------------------------------------
-- Hàm
-- ---------------------------------------------------------------------------

create or replace function public.heartbeat(p_user uuid)
returns jsonb language sql security definer set search_path = '' as $$
  update public.profiles set last_seen_at = now() where id = p_user
  returning jsonb_build_object('last_seen_at', last_seen_at);
$$;

create or replace function public.update_bio(p_user uuid, p_bio text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_bio text := btrim(regexp_replace(coalesce(p_bio, ''), '[ \t]+', ' ', 'g'));
begin
  perform public._lock_profile(p_user);
  if char_length(v_bio) > 200 then
    perform public._fail('INVALID_INPUT');
  end if;
  if v_bio <> '' and public._is_bad_name(v_bio) then
    perform public._fail('NAME_NOT_ALLOWED');
  end if;
  perform public._rate_limit(p_user, 'update_bio', 30, interval '1 day');
  update public.profiles set bio = v_bio, updated_at = now() where id = p_user;
  perform public._log(p_user, 'update_bio', 0, 0, null, '{}'::jsonb);
  return jsonb_build_object('bio', v_bio);
end $$;

-- Đặt avatar = ảnh đã tải lên. Edge Function đã kiểm tra file thuộc thư mục của người dùng.
-- Trả về avatar_url cũ để Edge Function xoá file cũ.
create or replace function public.set_avatar_photo(p_user uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.profiles;
begin
  v := public._lock_profile(p_user);
  perform public._rate_limit(p_user, 'update_avatar', 30, interval '1 day');
  update public.profiles set avatar = 'custom', avatar_url = p_url, updated_at = now() where id = p_user;
  perform public._log(p_user, 'update_avatar', 0, 0, null, jsonb_build_object('avatar', 'custom'));
  return jsonb_build_object('avatar_url', p_url, 'old_url', v.avatar_url);
end $$;

-- Đổi sang avatar có sẵn: xoá luôn avatar_url (Edge Function xoá file trong Storage).
create or replace function public.update_avatar(p_user uuid, p_avatar text, p_color text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.profiles;
begin
  v := public._lock_profile(p_user);
  if p_avatar = 'custom' and v.avatar_url is null then
    perform public._fail('INVALID_INPUT');
  end if;
  perform public._rate_limit(p_user, 'update_avatar', 30, interval '1 day');
  begin
    update public.profiles
    set avatar = p_avatar,
        avatar_url = case when p_avatar = 'custom' then avatar_url else null end,
        color = coalesce(p_color, color),
        updated_at = now()
    where id = p_user;
  exception when check_violation then
    perform public._fail('INVALID_INPUT');
  end;
  perform public._log(p_user, 'update_avatar', 0, 0, null, jsonb_build_object('avatar', p_avatar, 'color', p_color));
  return jsonb_build_object('avatar', p_avatar, 'old_url', case when p_avatar = 'custom' then null else v.avatar_url end);
end $$;

-- customer_tick cũng tính là "đang online".
create or replace function public.customer_tick(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set last_seen_at = now() where id = p_user;
  return public._customer_tick_at(p_user, now());
end $$;

-- ---------------------------------------------------------------------------
-- Storage: bucket avatars (đọc công khai; ghi/xoá chỉ trong thư mục của chính mình)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "avatar upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatar delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.heartbeat(uuid), public.update_bio(uuid, text), public.set_avatar_photo(uuid, text),
  public.update_avatar(uuid, text, text), public.customer_tick(uuid)
to service_role;
