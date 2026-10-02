-- Sweet Shop — thống kê đánh giá lưu sẵn + giới hạn số đánh giá giữ lại mỗi quán.
--
-- Trước đây /shop và /reviews tải TOÀN BỘ cột stars để tự đếm (mỗi lần mở tiệm đọc N dòng, N tăng mãi)
-- và bị PostgREST cắt ở 1000 dòng → quá 1000 đánh giá thì tổng kẹt ở 1.000, điểm TB không đổi nữa.
-- Hồ sơ quán (public_profiles) cũng count + avg trên toàn bộ đánh giá mỗi lần xem.
--
-- Giờ:
--   • profiles.review_counts = số đánh giá 1★..5★ từ trước tới nay (5 phần tử). Trigger tăng bộ đếm
--     ngay khi có đánh giá mới, cùng transaction với lúc sinh đánh giá. Client không ghi được profiles.
--   • Mỗi quán chỉ giữ khoảng 200–250 đánh giá mới nhất (màn Đánh giá hiện 100): cứ 50 đánh giá mới thì
--     xoá những cái cũ hơn đánh giá thứ 200. Bộ đếm là trọn đời nên điểm TB không đổi khi xoá.
--     Nhiệm vụ "trả lời đánh giá" đếm ở transactions_log nên không bị ảnh hưởng.

alter table public.profiles
  add column review_counts integer[] not null default '{0,0,0,0,0}'
    check (cardinality(review_counts) = 5);

-- Điền bộ đếm từ đánh giá hiện có (trước khi dọn).
update public.profiles p
set review_counts = s.counts
from (
  select user_id, array[
    count(*) filter (where stars = 1), count(*) filter (where stars = 2), count(*) filter (where stars = 3),
    count(*) filter (where stars = 4), count(*) filter (where stars = 5)
  ]::integer[] as counts
  from public.reviews
  group by user_id
) s
where s.user_id = p.id;

-- Dọn 1 lần: mỗi quán giữ 200 đánh giá mới nhất.
delete from public.reviews r
using (
  select id from (
    select id, row_number() over (partition by user_id order by created_at desc) as rn
    from public.reviews
  ) x
  where rn > 200
) old
where r.id = old.id;

-- ---------------------------------------------------------------------------
-- Trigger: tăng bộ đếm + dọn theo đợt
-- ---------------------------------------------------------------------------

create or replace function public._reviews_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c_keep   constant integer := 200;
  c_every  constant integer := 50;
  v_total  integer;
  v_cutoff timestamptz;
begin
  update public.profiles
  set review_counts[new.stars] = review_counts[new.stars] + 1
  where id = new.user_id
  returning review_counts[1] + review_counts[2] + review_counts[3] + review_counts[4] + review_counts[5]
  into v_total;

  -- Dọn theo đợt thay vì mỗi lần: 1 lần quét index (user_id, created_at desc) cho mỗi 50 đánh giá.
  if v_total % c_every = 0 then
    select created_at into v_cutoff from public.reviews
    where user_id = new.user_id
    order by created_at desc
    offset c_keep - 1 limit 1;
    if found then
      delete from public.reviews where user_id = new.user_id and created_at < v_cutoff;
    end if;
  end if;
  return null;
end $$;

create trigger reviews_after_insert
after insert on public.reviews
for each row execute function public._reviews_after_insert();

-- ---------------------------------------------------------------------------
-- View công khai: đọc bộ đếm thay vì count/avg trên bảng reviews (giữ nguyên tên + kiểu cột).
-- ---------------------------------------------------------------------------

create or replace view public.public_profiles
with (security_invoker = false) as
  select p.id, p.owner_name, p.shop_name::text as shop_name, p.slug, p.avatar, p.color, p.level, p.reputation,
         p.revenue_total, p.bio, p.avatar_url, p.last_seen_at, p.created_at, p.active_theme,
         s.n as review_count,
         round(s.star_sum::numeric / nullif(s.n, 0), 2) as review_avg
  from public.profiles p
  cross join lateral (
    select p.review_counts[1] + p.review_counts[2] + p.review_counts[3] + p.review_counts[4] + p.review_counts[5] as n,
           p.review_counts[1] + 2 * p.review_counts[2] + 3 * p.review_counts[3]
             + 4 * p.review_counts[4] + 5 * p.review_counts[5] as star_sum
  ) s;

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to authenticated;

revoke execute on function public._reviews_after_insert() from public, anon, authenticated;
