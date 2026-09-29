-- Sweet Shop — sổ công thức chuẩn theo docs/Bakery_Recipe_Database.docx (72 món, bakery_001 → bakery_072).
--
-- Công thức cũ bị sai (vd bánh mì = bột + dầu). Migration này:
--   1. Bổ sung nguyên liệu gốc theo tài liệu + cột category để nhóm trong kho/tô trộn.
--   2. Thêm cách nấu 'chill' (làm lạnh) cho tiramisu, panna cotta, mousse, tart socola.
--   3. Ghi lại toàn bộ 72 công thức. GIỮ NGUYÊN mã món cũ (bread, sponge, donut, cookie, croissant,
--      cupcake, fruit_tart, choco_cake, berry_choco) vì khách/đơn/log đang tham chiếu:
--        cupcake → Vanilla Cupcake (bakery_030), berry_choco → Black Forest (bakery_026).
--   4. Giá/XP/thời gian tối thiểu tính theo công thức (xem mục 4) thay vì gõ tay từng món.
--   5. Chia lại món ưa thích của 500 khách, bộ nguyên liệu khởi đầu mới, bù nguyên liệu cơ bản
--      cho tiệm đã có (bánh mì giờ cần men/muối/nước).
--
-- Bán thành phẩm trong tài liệu (sponge, pastry, choux, custard, lemon curd, kem hạnh nhân…) được
-- tách thành nguyên liệu gốc vì game chưa có chuỗi chế biến trung gian:
--   sponge = bột mì + trứng + đường · pastry/tart shell/puff pastry = bột mì + bơ
--   choux = bột mì + trứng + bơ + sữa · custard = sữa + trứng + đường · lemon curd = chanh + trứng + đường + bơ
--   chocolate chip → socola · parsley → thảo mộc · lòng trắng trứng → trứng.

-- ---------------------------------------------------------------------------
-- 1. Nguyên liệu
-- ---------------------------------------------------------------------------

alter table public.ingredients add column category text
  check (category in ('flour', 'dairy', 'sweet', 'fruit', 'nut'));

insert into public.ingredients (code, name, price, image, sort, kind, category) values
  -- Bột, men & gia vị nền
  ('flour',           'Bột mì',          4, '/images/items/flour.webp',      1, 'base', 'flour'),
  ('yeast',           'Men nở',          3, null,                            2, 'base', 'flour'),
  ('salt',            'Muối',            1, null,                            3, 'base', 'flour'),
  ('water',           'Nước',            1, null,                            4, 'base', 'flour'),
  ('rice_flour',      'Bột gạo',         4, null,                            5, 'base', 'flour'),
  ('glutinous_flour', 'Bột nếp',         5, null,                            6, 'base', 'flour'),
  ('tapioca',         'Bột năng',        4, null,                            7, 'base', 'flour'),
  ('almond_flour',    'Bột hạnh nhân',  14, null,                            8, 'base', 'flour'),
  ('cocoa',           'Bột cacao',       8, null,                            9, 'base', 'flour'),
  ('matcha',          'Bột matcha',     14, null,                           10, 'base', 'flour'),
  ('oats',            'Yến mạch',        5, null,                           11, 'base', 'flour'),
  -- Sữa, trứng, bơ
  ('egg',             'Trứng',           5, '/images/items/egg.webp',       20, 'base', 'dairy'),
  ('milk',            'Sữa',             4, null,                           21, 'base', 'dairy'),
  ('butter',          'Bơ',              8, null,                           22, 'base', 'dairy'),
  ('cream',           'Whipping cream',  9, null,                           23, 'base', 'dairy'),
  ('cheese',          'Phô mai',         9, null,                           24, 'base', 'dairy'),
  ('cream_cheese',    'Cream cheese',   12, null,                           25, 'base', 'dairy'),
  ('mascarpone',      'Mascarpone',     15, null,                           26, 'base', 'dairy'),
  ('sour_cream',      'Kem chua',        9, null,                           27, 'base', 'dairy'),
  ('coconut_milk',    'Nước cốt dừa',    6, null,                           28, 'base', 'dairy'),
  ('salted_egg',      'Trứng muối',     10, null,                           29, 'base', 'dairy'),
  -- Đường, hương liệu, dầu
  ('sugar',           'Đường',           3, '/images/items/sugar.webp',     40, 'base', 'sweet'),
  ('brown_sugar',     'Đường nâu',       4, null,                           41, 'base', 'sweet'),
  ('chocolate',       'Socola',         12, null,                           42, 'base', 'sweet'),
  ('white_chocolate', 'Socola trắng',   14, null,                           43, 'base', 'sweet'),
  ('vanilla',         'Vani',            6, null,                           44, 'base', 'sweet'),
  ('cinnamon',        'Quế',             5, null,                           45, 'base', 'sweet'),
  ('coffee',          'Cà phê',          7, null,                           46, 'base', 'sweet'),
  ('gelatin',         'Gelatin',         6, null,                           47, 'base', 'sweet'),
  ('oil',             'Dầu ăn',          6, '/images/items/oil.webp',       48, 'base', 'sweet'),
  ('olive_oil',       'Dầu olive',      10, null,                           49, 'base', 'sweet'),
  -- Trái cây, rau củ, lá thơm
  ('strawberry',      'Dâu tây',         9, '/images/items/strawberry.webp', 60, 'base', 'fruit'),
  ('apple',           'Táo',             7, null,                           61, 'base', 'fruit'),
  ('banana',          'Chuối',           4, null,                           62, 'base', 'fruit'),
  ('lemon',           'Chanh',           4, null,                           63, 'base', 'fruit'),
  ('blueberry',       'Việt quất',      12, null,                           64, 'base', 'fruit'),
  ('cherry',          'Anh đào',        12, null,                           65, 'base', 'fruit'),
  ('fruit',           'Trái cây tươi',  10, null,                           66, 'base', 'fruit'),
  ('carrot',          'Cà rốt',          3, null,                           67, 'base', 'fruit'),
  ('garlic',          'Tỏi',             3, null,                           68, 'base', 'fruit'),
  ('herbs',           'Thảo mộc',        4, null,                           69, 'base', 'fruit'),
  ('pandan',          'Lá dứa',          3, null,                           70, 'base', 'fruit'),
  -- Hạt & đồ khô
  ('almond',          'Hạnh nhân',      12, null,                           80, 'base', 'nut'),
  ('macadamia',       'Hạt macadamia',  16, null,                           81, 'base', 'nut'),
  ('sesame',          'Mè',              3, null,                           82, 'base', 'nut'),
  ('mung_bean',       'Đậu xanh',        4, null,                           83, 'base', 'nut'),
  ('biscuit',         'Bánh quy vụn',    6, null,                           84, 'base', 'nut'),
  ('pork_floss',      'Chà bông',       12, null,                           85, 'base', 'nut')
on conflict (code) do update set
  name = excluded.name, price = excluded.price, image = coalesce(excluded.image, public.ingredients.image),
  sort = excluded.sort, category = excluded.category;

-- Topping trùng tên nguyên liệu gốc → đặt tên rõ hơn (mã giữ nguyên).
update public.ingredients set name = 'Phô mai bào'   where code = 'top_cheese';
update public.ingredients set name = 'Hạnh nhân lát' where code = 'top_almond';

-- ---------------------------------------------------------------------------
-- 2. Cách nấu 'chill' (làm lạnh)
-- ---------------------------------------------------------------------------

alter table public.recipes drop constraint if exists recipes_cook_method_check;
alter table public.recipes add constraint recipes_cook_method_check
  check (cook_method in ('bake', 'fry', 'steam', 'chill'));

-- ---------------------------------------------------------------------------
-- 3. 72 công thức (thứ tự = thứ tự mở khoá; ~3 món mỗi cấp, cấp 1 → 25)
-- ---------------------------------------------------------------------------

create temp table _book (
  sort serial, doc_id text, code text, name text, lvl integer, method text, pack text, image text, items jsonb
);

insert into _book (doc_id, code, name, lvl, method, pack, image, items) values
  -- Cấp 1
  ('bakery_001', 'bread',         'Bánh mì trắng',           1, 'bake',  'bag', '/images/items/bread.webp',     '{"flour":2,"water":1,"yeast":1,"salt":1,"sugar":1}'),
  ('bakery_057', 'sponge',        'Bánh bông lan',           1, 'bake',  'box', null,                           '{"egg":2,"flour":1,"sugar":1,"milk":1}'),
  ('bakery_007', 'baguette',      'Baguette',                1, 'bake',  'bag', null,                           '{"flour":2,"water":1,"yeast":1,"salt":1}'),
  -- Cấp 2
  ('bakery_055', 'donut',         'Donut',                   2, 'fry',   'bag', null,                           '{"flour":2,"yeast":1,"milk":1,"egg":1,"sugar":1}'),
  ('bakery_035', 'cookie',        'Chocolate Chip Cookie',   2, 'bake',  'bag', '/images/items/cookie.webp',    '{"flour":1,"butter":1,"sugar":1,"chocolate":1}'),
  ('bakery_037', 'butter_cookie', 'Butter Cookie',           2, 'bake',  'bag', null,                           '{"flour":1,"butter":1,"sugar":1}'),
  -- Cấp 3
  ('bakery_011', 'croissant',     'Croissant',               3, 'bake',  'bag', '/images/items/croissant.webp', '{"flour":2,"butter":2,"milk":1,"yeast":1,"sugar":1}'),
  ('bakery_002', 'milk_bread',    'Bánh mì sữa',             3, 'bake',  'bag', null,                           '{"flour":2,"milk":1,"egg":1,"butter":1,"yeast":1,"sugar":1}'),
  ('bakery_003', 'butter_bread',  'Bánh mì bơ',              3, 'bake',  'bag', null,                           '{"flour":2,"butter":1,"milk":1,"sugar":1,"yeast":1}'),
  -- Cấp 4
  ('bakery_030', 'cupcake',       'Vanilla Cupcake',         4, 'bake',  'box', null,                           '{"flour":1,"egg":1,"butter":1,"sugar":1,"vanilla":1}'),
  ('bakery_062', 'banh_tieu',     'Bánh tiêu',               4, 'fry',   'bag', null,                           '{"flour":2,"yeast":1,"sugar":1,"sesame":1}'),
  ('bakery_006', 'garlic_bread',  'Bánh mì tỏi',             4, 'bake',  'bag', null,                           '{"flour":2,"yeast":1,"butter":1,"garlic":1,"herbs":1}'),
  -- Cấp 5
  ('bakery_044', 'fruit_tart',    'Fruit Tart',              5, 'bake',  'box', '/images/items/fruit-tart.webp', '{"flour":1,"butter":1,"milk":1,"egg":1,"sugar":1,"fruit":2}'),
  ('bakery_004', 'cheese_bread',  'Bánh mì phô mai',         5, 'bake',  'bag', null,                           '{"flour":2,"milk":1,"yeast":1,"cheese":1}'),
  ('bakery_047', 'pudding',       'Pudding',                 5, 'steam', 'box', null,                           '{"milk":1,"egg":2,"sugar":1,"vanilla":1}'),
  -- Cấp 6
  ('bakery_034', 'banana_muffin', 'Banana Muffin',           6, 'bake',  'box', null,                           '{"banana":2,"flour":1,"egg":1,"butter":1}'),
  ('bakery_032', 'blueberry_muffin', 'Blueberry Muffin',     6, 'bake',  'box', null,                           '{"flour":1,"blueberry":1,"milk":1,"egg":1}'),
  ('bakery_005', 'chocolate_bread', 'Bánh mì chocolate',     6, 'bake',  'bag', null,                           '{"flour":2,"cocoa":1,"chocolate":1,"milk":1,"yeast":1}'),
  -- Cấp 7
  ('bakery_019', 'choco_cake',    'Chocolate Cake',          7, 'bake',  'box', '/images/items/choco-cake.webp', '{"flour":1,"cocoa":1,"egg":2,"sugar":1,"butter":1}'),
  ('bakery_039', 'oatmeal_cookie', 'Oatmeal Cookie',         7, 'bake',  'bag', null,                           '{"oats":1,"flour":1,"butter":1,"sugar":1}'),
  ('bakery_059', 'banh_chuoi',    'Bánh chuối',              7, 'bake',  'box', null,                           '{"banana":2,"flour":1,"egg":1,"sugar":1}'),
  -- Cấp 8
  ('bakery_046', 'egg_tart',      'Egg Tart',                8, 'bake',  'box', null,                           '{"egg":1,"milk":1,"sugar":1,"flour":1,"butter":1}'),
  ('bakery_054', 'churros',       'Churros',                 8, 'fry',   'bag', null,                           '{"flour":1,"water":1,"sugar":1,"oil":1}'),
  ('bakery_033', 'chocolate_muffin', 'Chocolate Muffin',     8, 'bake',  'box', null,                           '{"flour":1,"cocoa":1,"chocolate":1}'),
  -- Cấp 9
  ('bakery_009', 'brioche',       'Brioche',                 9, 'bake',  'bag', null,                           '{"flour":2,"egg":1,"butter":1,"milk":1,"sugar":1,"yeast":1}'),
  ('bakery_072', 'pound_cake',    'Pound Cake',              9, 'bake',  'box', null,                           '{"butter":1,"sugar":1,"egg":1,"flour":1}'),
  ('bakery_067', 'madeleine',     'Madeleine',               9, 'bake',  'box', null,                           '{"flour":1,"egg":1,"butter":1,"sugar":1}'),
  -- Cấp 10
  ('bakery_026', 'berry_choco',   'Black Forest',           10, 'bake',  'box', '/images/items/berry-choco.webp', '{"flour":1,"cocoa":1,"egg":1,"sugar":1,"cherry":1,"cream":1}'),
  ('bakery_031', 'chocolate_cupcake', 'Chocolate Cupcake',  10, 'bake',  'box', null,                           '{"flour":1,"cocoa":1,"egg":1,"butter":1}'),
  ('bakery_069', 'cinnamon_roll', 'Cinnamon Roll',          10, 'bake',  'box', null,                           '{"flour":2,"cinnamon":1,"butter":1,"sugar":1}'),
  -- Cấp 11
  ('bakery_010', 'focaccia',      'Focaccia',               11, 'bake',  'bag', null,                           '{"flour":2,"olive_oil":1,"yeast":1,"herbs":1}'),
  ('bakery_008', 'ciabatta',      'Ciabatta',               11, 'bake',  'bag', null,                           '{"flour":2,"water":1,"yeast":1,"olive_oil":1}'),
  ('bakery_061', 'banh_bo',       'Bánh bò',                11, 'steam', 'box', null,                           '{"rice_flour":2,"yeast":1,"sugar":1,"coconut_milk":1}'),
  -- Cấp 12
  ('bakery_018', 'vanilla_cake',  'Vanilla Cake',           12, 'bake',  'box', null,                           '{"flour":1,"egg":2,"sugar":1,"butter":1,"vanilla":1}'),
  ('bakery_070', 'banana_bread',  'Banana Bread',           12, 'bake',  'box', null,                           '{"banana":2,"flour":1,"egg":1,"butter":1}'),
  ('bakery_064', 'brownie',       'Brownie',                12, 'bake',  'box', null,                           '{"chocolate":1,"cocoa":1,"butter":1,"egg":1,"sugar":1}'),
  -- Cấp 13
  ('bakery_022', 'lemon_cake',    'Lemon Cake',             13, 'bake',  'box', null,                           '{"flour":1,"lemon":1,"egg":1,"sugar":1,"butter":1}'),
  ('bakery_065', 'blondie',       'Blondie',                13, 'bake',  'box', null,                           '{"butter":1,"brown_sugar":1,"flour":1,"egg":1}'),
  ('bakery_071', 'marble_cake',   'Marble Cake',            13, 'bake',  'box', null,                           '{"flour":1,"egg":1,"sugar":1,"butter":1,"vanilla":1,"cocoa":1}'),
  -- Cấp 14
  ('bakery_041', 'apple_pie',     'Apple Pie',              14, 'bake',  'box', null,                           '{"apple":2,"flour":1,"butter":1,"sugar":1,"cinnamon":1}'),
  ('bakery_036', 'double_choco_cookie', 'Double Chocolate Cookie', 14, 'bake', 'bag', null,                     '{"flour":1,"cocoa":1,"chocolate":1,"butter":1}'),
  ('bakery_063', 'banh_cam',      'Bánh cam',               14, 'fry',   'bag', null,                           '{"glutinous_flour":2,"mung_bean":1,"sugar":1,"sesame":1}'),
  -- Cấp 15
  ('bakery_021', 'carrot_cake',   'Carrot Cake',            15, 'bake',  'box', null,                           '{"carrot":2,"flour":1,"egg":1,"cinnamon":1,"cream_cheese":1}'),
  ('bakery_023', 'strawberry_cake', 'Strawberry Cake',      15, 'bake',  'box', null,                           '{"flour":1,"egg":1,"sugar":1,"strawberry":2,"cream":1}'),
  ('bakery_060', 'banh_da_lon',   'Bánh da lợn',            15, 'steam', 'box', null,                           '{"tapioca":2,"pandan":1,"mung_bean":1,"sugar":1}'),
  -- Cấp 16
  ('bakery_038', 'matcha_cookie', 'Matcha Cookie',          16, 'bake',  'bag', null,                           '{"flour":1,"matcha":1,"butter":1,"sugar":1}'),
  ('bakery_042', 'apple_tart',    'Apple Tart',             16, 'bake',  'box', null,                           '{"apple":2,"flour":1,"butter":1,"sugar":1}'),
  ('bakery_014', 'danish',        'Danish Pastry',          16, 'bake',  'box', null,                           '{"flour":1,"butter":2,"milk":1,"egg":1,"sugar":1}'),
  -- Cấp 17
  ('bakery_015', 'apple_danish',  'Apple Danish',           17, 'bake',  'box', null,                           '{"flour":1,"butter":1,"apple":1,"sugar":1,"cinnamon":1}'),
  ('bakery_016', 'fruit_danish',  'Fruit Danish',           17, 'bake',  'box', null,                           '{"flour":1,"butter":1,"milk":1,"egg":1,"sugar":1,"fruit":1}'),
  ('bakery_017', 'palmier',       'Palmier',                17, 'bake',  'bag', null,                           '{"flour":1,"butter":1,"sugar":2}'),
  -- Cấp 18
  ('bakery_012', 'chocolate_croissant', 'Chocolate Croissant', 18, 'bake', 'bag', null,                         '{"flour":2,"butter":2,"milk":1,"yeast":1,"sugar":1,"chocolate":1}'),
  ('bakery_043', 'lemon_tart',    'Lemon Tart',             18, 'bake',  'box', null,                           '{"lemon":1,"egg":1,"sugar":1,"flour":1,"butter":1}'),
  ('bakery_024', 'matcha_cake',   'Matcha Cake',            18, 'bake',  'box', null,                           '{"flour":1,"matcha":1,"egg":2,"cream":1}'),
  -- Cấp 19
  ('bakery_020', 'red_velvet',    'Red Velvet',             19, 'bake',  'box', null,                           '{"flour":1,"cocoa":1,"egg":1,"cream_cheese":1}'),
  ('bakery_027', 'cheesecake',    'Cheesecake',             19, 'bake',  'box', null,                           '{"cream_cheese":2,"egg":1,"sugar":1,"biscuit":1}'),
  ('bakery_040', 'macadamia_cookie', 'Macadamia Cookie',    19, 'bake',  'bag', null,                           '{"flour":1,"butter":1,"white_chocolate":1,"macadamia":1}'),
  -- Cấp 20
  ('bakery_053', 'cream_puff',    'Cream Puff',             20, 'bake',  'box', null,                           '{"flour":1,"egg":1,"butter":1,"milk":1,"cream":1}'),
  ('bakery_056', 'banh_su_kem',   'Bánh su kem',            20, 'bake',  'box', null,                           '{"flour":1,"egg":1,"butter":1,"milk":1,"sugar":1}'),
  ('bakery_029', 'basque_cheesecake', 'Basque Cheesecake',  20, 'bake',  'box', null,                           '{"cream_cheese":2,"egg":1,"cream":1,"sugar":1}'),
  -- Cấp 21
  ('bakery_028', 'ny_cheesecake', 'New York Cheesecake',    21, 'bake',  'box', null,                           '{"cream_cheese":2,"egg":1,"sour_cream":1}'),
  ('bakery_052', 'eclair',        'Éclair',                 21, 'bake',  'box', null,                           '{"flour":1,"egg":1,"butter":1,"milk":1,"sugar":1,"chocolate":1}'),
  -- Cấp 22
  ('bakery_051', 'profiterole',   'Profiterole',            22, 'bake',  'box', null,                           '{"flour":1,"egg":1,"butter":1,"milk":1,"sugar":1,"chocolate":1}'),
  ('bakery_049', 'panna_cotta',   'Panna Cotta',            22, 'chill', 'box', null,                           '{"cream":1,"milk":1,"sugar":1,"gelatin":1}'),
  ('bakery_045', 'chocolate_tart', 'Chocolate Tart',        22, 'chill', 'box', null,                           '{"chocolate":1,"cream":1,"flour":1,"butter":1}'),
  -- Cấp 23
  ('bakery_050', 'chocolate_mousse', 'Chocolate Mousse',    23, 'chill', 'box', null,                           '{"chocolate":1,"cream":1,"gelatin":1}'),
  ('bakery_048', 'creme_brulee',  'Crème Brûlée',           23, 'bake',  'box', null,                           '{"cream":1,"egg":1,"sugar":1,"vanilla":1}'),
  ('bakery_013', 'almond_croissant', 'Almond Croissant',    23, 'bake',  'bag', null,                           '{"flour":2,"butter":2,"milk":1,"yeast":1,"sugar":1,"almond":1}'),
  -- Cấp 24
  ('bakery_066', 'financier',     'Financier',              24, 'bake',  'box', null,                           '{"almond_flour":1,"egg":1,"butter":1}'),
  ('bakery_025', 'tiramisu',      'Tiramisu Cake',          24, 'chill', 'box', null,                           '{"flour":1,"egg":1,"sugar":1,"coffee":1,"mascarpone":1,"cocoa":1}'),
  ('bakery_058', 'bong_lan_trung_muoi', 'Bông lan trứng muối', 24, 'bake', 'box', null,                         '{"flour":1,"egg":2,"sugar":1,"butter":1,"salted_egg":1,"pork_floss":1}'),
  -- Cấp 25
  ('bakery_068', 'macaron',       'Macaron',                25, 'bake',  'box', null,                           '{"almond_flour":1,"egg":1,"sugar":1}');

do $$
begin
  if (select count(*) from _book) <> 72 or (select count(distinct doc_id) from _book) <> 72 then
    raise exception 'sổ công thức phải đủ 72 món khác nhau';
  end if;
end $$;

-- base_price/xp/min_play_seconds điền tạm, tính lại ở mục 4.
insert into public.recipes (code, name, unlock_level, min_play_seconds, base_price, xp, image, sort, cook_method, packaging)
select code, name, lvl, 10, 1, 1, image, sort, method, pack from _book
on conflict (code) do update set
  name = excluded.name, unlock_level = excluded.unlock_level, image = coalesce(excluded.image, public.recipes.image),
  sort = excluded.sort, cook_method = excluded.cook_method, packaging = excluded.packaging;

delete from public.recipe_ingredients where recipe_code in (select code from _book);
insert into public.recipe_ingredients (recipe_code, ingredient_code, qty)
select b.code, i.key, i.value::integer from _book b, jsonb_each_text(b.items) i;

drop table _book;

-- ---------------------------------------------------------------------------
-- 4. Cân bằng: giá NPC 3★ = 2 × giá vốn + 2 xu/cấp mở khoá; XP = 6 + 4 × cấp;
--    thời gian tối thiểu (chống bot) = 4 giây + 1 giây/nguyên liệu, tối đa 12.
-- ---------------------------------------------------------------------------

update public.recipes r set
  base_price = 2 * c.cost + 2 * r.unlock_level,
  xp = 6 + 4 * r.unlock_level,
  min_play_seconds = least(12, 4 + c.n)
from (
  select ri.recipe_code, sum(ri.qty * i.price)::integer as cost, count(*)::integer as n
  from public.recipe_ingredients ri join public.ingredients i on i.code = ri.ingredient_code
  group by ri.recipe_code
) c
where c.recipe_code = r.code;

-- ---------------------------------------------------------------------------
-- 5. Khách, nguyên liệu khởi đầu, bù cho tiệm cũ
-- ---------------------------------------------------------------------------

-- Món ưa thích trải đều cả 72 món (khách gọi món chưa mở khoá thì server tự chọn món khác).
select setseed(0.20260929);
with book as (select array_agg(code order by sort) as codes from public.recipes)
update public.customers set favorite_recipe = book.codes[1 + floor(random() * cardinality(book.codes))::int]
from book;

create or replace function public.create_profile(
  p_user uuid, p_owner_name text, p_shop_name text, p_avatar text, p_color text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner text := btrim(p_owner_name);
  v_shop  text := btrim(regexp_replace(p_shop_name, '\s+', ' ', 'g'));
  v_slug  text;
begin
  perform pg_advisory_xact_lock(hashtext('create_profile:' || p_user::text));
  if exists (select 1 from public.profiles where id = p_user) then
    perform public._fail('PROFILE_EXISTS');
  end if;
  perform public._validate_names(v_owner, v_shop);
  v_slug := public._slugify(v_shop);

  begin
    insert into public.profiles (id, owner_name, shop_name, slug, avatar, color, coins, gems)
    values (p_user, v_owner, v_shop, v_slug, p_avatar, p_color, 500, 10);
  exception
    when unique_violation then perform public._fail('SHOP_NAME_TAKEN');
    when check_violation then perform public._fail('INVALID_INPUT');
  end;

  -- Đủ làm vài mẻ 3 món cấp 1: bánh mì trắng, bánh bông lan, baguette.
  perform public._add_inventory(p_user, 'flour', 12);
  perform public._add_inventory(p_user, 'egg', 6);
  perform public._add_inventory(p_user, 'sugar', 6);
  perform public._add_inventory(p_user, 'milk', 4);
  perform public._add_inventory(p_user, 'yeast', 4);
  perform public._add_inventory(p_user, 'salt', 4);
  perform public._add_inventory(p_user, 'water', 6);
  perform public._add_inventory(p_user, 'sauce_garlic', 3);
  perform public._add_inventory(p_user, 'sauce_condensed', 3);
  perform public._add_inventory(p_user, 'top_sprinkles', 3);
  perform public._add_inventory(p_user, 'top_cheese', 3);

  perform public._log(p_user, 'signup_bonus', 500, 10, null, '{}'::jsonb);
  return jsonb_build_object('slug', v_slug);
end $$;

-- Tiệm đã có: bánh mì giờ cần men/muối/nước → tặng mỗi thứ một ít để không bị kẹt đơn đầu tiên.
insert into public.inventory (user_id, ingredient_code, qty)
select p.id, g.code, g.qty
from public.profiles p
cross join (values ('yeast', 4), ('salt', 4), ('water', 6), ('milk', 2)) as g (code, qty)
on conflict (user_id, ingredient_code) do update set qty = public.inventory.qty + excluded.qty;

insert into public.transactions_log (user_id, kind, meta)
select id, 'recipe_book_grant', '{"yeast":4,"salt":4,"water":6,"milk":2}'::jsonb from public.profiles;

-- ---------------------------------------------------------------------------
-- 6. Giao bánh: chấp nhận cách nấu 'chill' (phần còn lại giữ nguyên bản 0005)
-- ---------------------------------------------------------------------------

create or replace function public.complete_order(
  p_user uuid, p_visit uuid, p_ingredients text[], p_method text, p_scores integer[],
  p_sauce text, p_topping text, p_packaging text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c_fresh_orders constant integer := 300;
  v        public.profiles;
  cv       public.customer_visits;
  c        public.customers;
  r        public.recipes;
  s        public.bake_sessions;
  v_needed text[];
  v_missing integer;
  v_extra  integer;
  v_score  integer;
  v_q      integer;
  v_tired  boolean;
  v_extras_ok boolean;
  v_price  bigint;
  v_tip    bigint := 0;
  v_paid   bigint;
  v_rep    integer;
  v_dash   boolean;
  v_notes  text[] := '{}';
  v_xp     bigint;
  v_level  integer;
  v_code   text;
  v_today  date := public._today();
begin
  if p_ingredients is null or cardinality(p_ingredients) > 12
     or p_method not in ('bake', 'fry', 'steam', 'chill') or p_packaging not in ('box', 'bag')
     or p_scores is null or array_length(p_scores, 1) is distinct from 2
     or exists (select 1 from unnest(p_scores) x where x is null or x not between 0 and 100)
     or (select count(*) from unnest(p_ingredients) x) <> (select count(distinct x) from unnest(p_ingredients) x) then
    perform public._fail('INVALID_INPUT');
  end if;

  v := public._lock_profile(p_user);
  select * into cv from public.customer_visits
  where id = p_visit and user_id = p_user and status = 'cooking' for update;
  if not found or now() > cv.leave_at then
    perform public._fail('CUSTOMER_GONE');
  end if;
  select * into s from public.bake_sessions where visit_id = cv.id and status = 'active' for update;
  select * into c from public.customers where id = cv.customer_id;
  select * into r from public.recipes where code = cv.recipe_code;
  if s.id is null then
    perform public._fail('SESSION_NOT_FOUND');
  end if;
  if now() - s.started_at < make_interval(secs => r.min_play_seconds) then
    perform public._fail('TOO_FAST');
  end if;

  -- Nguyên liệu bỏ vào tô: đúng món trừ theo định lượng công thức, sai món trừ 1 (bị bỏ phí).
  select array_agg(ingredient_code) into v_needed from public.recipe_ingredients where recipe_code = r.code;
  foreach v_code in array p_ingredients loop
    if not exists (select 1 from public.ingredients where code = v_code and kind = 'base') then
      perform public._fail('INVALID_INPUT');
    end if;
    perform public._take_item(p_user, 'ingredient', v_code, null,
      coalesce((select qty from public.recipe_ingredients where recipe_code = r.code and ingredient_code = v_code), 1));
  end loop;
  v_missing := (select count(*) from unnest(v_needed) x where x <> all (p_ingredients));
  v_extra   := (select count(*) from unnest(p_ingredients) x where x <> all (v_needed));

  if p_sauce is not null then
    if not exists (select 1 from public.ingredients where code = p_sauce and kind = 'sauce') then
      perform public._fail('INVALID_INPUT');
    end if;
    perform public._take_item(p_user, 'ingredient', p_sauce, null, 1);
  end if;
  if p_topping is not null then
    if not exists (select 1 from public.ingredients where code = p_topping and kind = 'topping') then
      perform public._fail('INVALID_INPUT');
    end if;
    perform public._take_item(p_user, 'ingredient', p_topping, null, 1);
  end if;

  -- Chấm điểm: canh giờ (trung bình 2 bước) + lò, trừ lỗi quy trình.
  v_score := (p_scores[1] + p_scores[2]) / 2 + public._upgrade_bonus(p_user, 'oven')
             - 25 * v_missing - 15 * v_extra;
  if v_missing > 0 then v_notes := v_notes || ('Thiếu ' || v_missing || ' nguyên liệu'); end if;
  if v_extra > 0 then v_notes := v_notes || ('Thừa ' || v_extra || ' nguyên liệu lạ'); end if;
  if p_method <> r.cook_method then
    v_score := v_score - 40;
    v_notes := v_notes || 'Sai cách nấu'::text;
  end if;
  if p_packaging <> r.packaging then
    v_score := v_score - 10;
    v_notes := v_notes || 'Đóng gói chưa đúng'::text;
  end if;
  v_score := greatest(0, least(100, v_score));
  v_q := case when v_score >= 90 then 5 when v_score >= 75 then 4 when v_score >= 55 then 3
              when v_score >= 35 then 2 else 1 end;

  v_tired := (select count(*) from public.transactions_log
              where user_id = p_user and kind = 'order' and created_at > now() - interval '1 day') >= c_fresh_orders;
  if v_tired then v_q := least(v_q, 3); end if;

  -- Tiền: giá bánh theo sao × tủ trưng bày + tiền sốt/topping (x2 giá vốn).
  v_price := (r.base_price::bigint * public._quality_pct(v_q) / 100)
             * (100 + public._upgrade_bonus(p_user, 'display')) / 100
           + 2 * coalesce((select price from public.ingredients where code = p_sauce), 0)
           + 2 * coalesce((select price from public.ingredients where code = p_topping), 0);

  v_extras_ok := p_sauce is not distinct from cv.sauce_code and p_topping is not distinct from cv.topping_code;
  if v_extras_ok then
    v_tip := c.spend * 5 * v_q / 3;
  else
    v_notes := v_notes || 'Sai nước chấm/topping khách gọi'::text;
  end if;

  v_rep := case
    when c.picky then case when v_q = 5 then 2 when v_q = 4 then 0 else -1 end
    else case when v_q >= 4 then v_q - 3 else 0 end
  end + case when v_extras_ok then 0 else -1 end;

  v_paid := v_price + v_tip;
  if c.picky and v_q < c.min_quality then
    v_paid := v_price / 2;   -- khách khó tính chỉ trả nửa giá, không tip
    v_tip := 0;
    v_notes := v_notes || ('Khách chê: muốn bánh từ ' || c.min_quality || ' sao');
  end if;
  v_dash := c.dine_and_dash and random() * 100 < c.dine_dash_pct;

  v_xp := v.xp + r.xp;
  v_level := public._level_for_xp(v_xp);
  update public.bake_sessions set status = 'done', quality = v_q, completed_at = now() where id = s.id;

  if v_dash then
    update public.profiles set xp = v_xp, level = v_level, updated_at = now() where id = p_user;
    update public.customer_visits set status = 'dashed', quality = v_q, paid = 0, tip = 0, reputation_delta = 0,
      result = jsonb_build_object('notes', to_jsonb(v_notes), 'lost', v_paid) where id = cv.id;
    perform public._log(p_user, 'order', 0, 0, cv.id,
      jsonb_build_object('customer', c.id, 'recipe', r.code, 'quality', v_q, 'dashed', true, 'scores', to_jsonb(p_scores)));
    return jsonb_build_object('dashed', true, 'lost', v_paid, 'quality', v_q, 'score', v_score,
      'notes', to_jsonb(v_notes), 'xp_gained', r.xp, 'level', v_level, 'leveled_up', v_level > v.level,
      'customer', c.name);
  end if;

  update public.profiles
  set coins = coins + v_paid,
      revenue_total = revenue_total + v_paid,
      revenue_today = case when revenue_day = v_today then revenue_today + v_paid else v_paid end,
      revenue_day = v_today,
      reputation = greatest(0, reputation + v_rep),
      xp = v_xp, level = v_level,
      updated_at = now()
  where id = p_user;

  update public.customer_visits
  set status = 'served', quality = v_q, paid = v_paid, tip = v_tip, reputation_delta = v_rep,
      result = jsonb_build_object('notes', to_jsonb(v_notes))
  where id = cv.id;
  perform public._log(p_user, 'order', v_paid, 0, cv.id,
    jsonb_build_object('customer', c.id, 'recipe', r.code, 'quality', v_q, 'tip', v_tip,
                       'scores', to_jsonb(p_scores), 'tired', v_tired));

  return jsonb_build_object(
    'dashed', false, 'paid', v_paid, 'tip', v_tip, 'quality', v_q, 'score', v_score,
    'reputation_delta', v_rep, 'notes', to_jsonb(v_notes), 'tired', v_tired,
    'xp_gained', r.xp, 'level', v_level, 'leveled_up', v_level > v.level, 'customer', c.name
  );
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.complete_order(uuid, uuid, text[], text, integer[], text, text, text),
  public.create_profile(uuid, text, text, text, text)
to service_role;
