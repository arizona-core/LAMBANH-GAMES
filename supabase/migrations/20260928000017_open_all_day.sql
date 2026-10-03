-- Sweet Shop — tiệm mở cả ngày lẫn đêm, không còn giờ đóng cửa 0:00–7:00 (giờ game).
--
-- Tiệm chỉ đóng khi chủ tiệm tự bấm "Đóng cửa" (profiles.shop_open = false) hoặc offline.
-- 0:00–7:00 là "đêm khuya": vắng khách (hệ số 0.4, như 23–24h) thay vì hệ số 0 (đóng cửa).
-- Các khung giờ khác giữ nguyên như migration 0009.

create or replace function public._traffic_mult(p_minute_of_day integer)
returns numeric language sql immutable set search_path = '' as $$
  select case
    when p_minute_of_day < 420 then 0.4          -- 0–7h: đêm khuya, vắng
    when p_minute_of_day < 540 then 1.3          -- 7–9h: bữa sáng
    when p_minute_of_day < 660 then 0.8          -- 9–11h
    when p_minute_of_day < 780 then 1.8          -- 11–13h: cao điểm trưa
    when p_minute_of_day < 960 then 0.5          -- 13–16h: vắng
    when p_minute_of_day < 1080 then 0.9         -- 16–18h
    when p_minute_of_day < 1260 then 1.7         -- 18–21h: cao điểm tối
    when p_minute_of_day < 1380 then 0.8         -- 21–23h
    else 0.4                                      -- 23–24h: vắng
  end::numeric;
$$;

create or replace function public._game_open(p_at timestamptz)
returns boolean language sql immutable set search_path = '' as $$
  select true;
$$;

create or replace function public._game_clock(p_at timestamptz)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'minute_of_day', m, 'hour', m / 60, 'minute', m % 60, 'open', true
  ) from (select public._game_minute(p_at) as m) x;
$$;

revoke execute on function
  public._traffic_mult(integer), public._game_open(timestamptz), public._game_clock(timestamptz)
from public, anon, authenticated;
