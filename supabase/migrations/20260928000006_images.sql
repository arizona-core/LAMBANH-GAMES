-- Chỗ gắn ảnh: ảnh khách NPC + vị trí đặt đồ trang trí trong tiệm.
-- Ảnh thật do người dùng gửi sau → cập nhật cột image bằng migration mới khi có file.

alter table public.customers add column image text;

-- Vị trí đặt đồ trang trí trong cảnh tiệm (theo % khung cảnh), null = không hiện trong cảnh.
alter table public.upgrade_catalog
  add column scene_slot text check (scene_slot in ('floor_left', 'floor_right', 'wall_left', 'wall_right', 'ceiling', 'window'));

update public.upgrade_catalog set scene_slot = 'floor_left'  where code = 'decor_table';
update public.upgrade_catalog set scene_slot = 'floor_right' where code = 'decor_plant';
update public.upgrade_catalog set scene_slot = 'wall_right'  where code = 'decor_neon';
update public.upgrade_catalog set scene_slot = 'ceiling'     where code = 'decor_lamp';

-- Trả kèm ảnh khách trong dữ liệu đơn.
create or replace function public._visit_json(p_visit uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', v.id, 'status', v.status, 'arrive_at', v.arrive_at, 'leave_at', v.leave_at,
    'recipe', v.recipe_code, 'recipe_name', r.name, 'recipe_image', r.image,
    'sauce', v.sauce_code, 'sauce_name', s.name, 'topping', v.topping_code, 'topping_name', t.name,
    'customer', jsonb_build_object(
      'id', c.id, 'name', c.name, 'gender', c.gender, 'personality', c.personality, 'bio', c.bio,
      'impatient', c.impatient, 'dine_and_dash', c.dine_and_dash, 'picky', c.picky,
      'min_quality', c.min_quality, 'look', c.look, 'image', c.image)
  )
  from public.customer_visits v
  join public.customers c on c.id = v.customer_id
  join public.recipes r on r.code = v.recipe_code
  left join public.ingredients s on s.code = v.sauce_code
  left join public.ingredients t on t.code = v.topping_code
  where v.id = p_visit;
$$;

revoke execute on function public._visit_json(uuid) from public, anon, authenticated;
