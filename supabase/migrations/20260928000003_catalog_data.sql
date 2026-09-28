-- Sweet Shop — dữ liệu danh mục (nguyên liệu, công thức, nâng cấp).
-- Nằm trong migration (không phải seed.sql) vì production cũng cần dữ liệu này.
-- Cân bằng kinh tế: giá NPC ở 3★ ≈ 2× chi phí nguyên liệu; 5★ = 150% giá 3★.

insert into public.ingredients (code, name, price, image, sort) values
  ('flour',      'Bột mì',   4,  '/images/items/flour.webp',      1),
  ('egg',        'Trứng',    5,  '/images/items/egg.webp',        2),
  ('sugar',      'Đường',    3,  '/images/items/sugar.webp',      3),
  ('oil',        'Dầu ăn',   6,  '/images/items/oil.webp',        4),
  ('butter',     'Bơ',       8,  null,                            5),
  ('milk',       'Sữa',      4,  null,                            6),
  ('strawberry', 'Dâu tây',  9,  '/images/items/strawberry.webp', 7),
  ('chocolate',  'Socola',  12,  null,                            8);

insert into public.recipes (code, name, unlock_level, min_play_seconds, base_price, xp, image, sort) values
  ('bread',       'Bánh mì',             1,  6,  30, 10, '/images/items/bread.webp',       1),
  ('sponge',      'Bánh bông lan',       1,  7,  45, 12, null,                             2),
  ('cookie',      'Bánh quy socola',     2,  7,  58, 15, '/images/items/cookie.webp',      3),
  ('croissant',   'Croissant',           3,  8,  62, 18, '/images/items/croissant.webp',   4),
  ('cupcake',     'Cupcake dâu',         4,  8,  76, 22, null,                             5),
  ('fruit_tart',  'Bánh tart trái cây',  5,  9,  90, 26, '/images/items/fruit-tart.webp',  6),
  ('choco_cake',  'Bánh kem socola',     7, 10, 120, 34, '/images/items/choco-cake.webp',  7),
  ('berry_choco', 'Bánh kem socola dâu', 10, 12, 165, 45, '/images/items/berry-choco.webp', 8);

insert into public.recipe_ingredients (recipe_code, ingredient_code, qty) values
  ('bread', 'flour', 2), ('bread', 'oil', 1),
  ('sponge', 'flour', 2), ('sponge', 'egg', 2), ('sponge', 'sugar', 1),
  ('cookie', 'flour', 1), ('cookie', 'butter', 1), ('cookie', 'sugar', 1), ('cookie', 'chocolate', 1),
  ('croissant', 'flour', 2), ('croissant', 'butter', 2), ('croissant', 'milk', 1),
  ('cupcake', 'flour', 2), ('cupcake', 'butter', 1), ('cupcake', 'strawberry', 2),
  ('fruit_tart', 'flour', 2), ('fruit_tart', 'butter', 1), ('fruit_tart', 'egg', 1), ('fruit_tart', 'strawberry', 2),
  ('choco_cake', 'flour', 3), ('choco_cake', 'egg', 2), ('choco_cake', 'chocolate', 2), ('choco_cake', 'milk', 1),
  ('berry_choco', 'flour', 3), ('berry_choco', 'egg', 3), ('berry_choco', 'butter', 2),
  ('berry_choco', 'strawberry', 2), ('berry_choco', 'sugar', 2);

-- Nâng cấp lò (oven): + điểm chất lượng mỗi mẻ. Tủ trưng bày (display): + % giá bán NPC.
-- Trang trí (decor): + uy tín một lần, mua bằng xu hoặc gem (gem chỉ kiếm trong game).
insert into public.upgrade_catalog (code, kind, tier, name, description, cost_coins, cost_gems, unlock_level, requires_code, effect, sort) values
  ('oven_1',    'oven',    1, 'Lò nướng đối lưu',  '+5 điểm chất lượng mỗi mẻ',   600,  0, 2, null,      5, 1),
  ('oven_2',    'oven',    2, 'Lò gạch',           '+10 điểm chất lượng mỗi mẻ', 2000,  0, 5, 'oven_1', 10, 2),
  ('oven_3',    'oven',    3, 'Lò thông minh',     '+15 điểm chất lượng mỗi mẻ', 6000,  0, 8, 'oven_2', 15, 3),
  ('display_1', 'display', 1, 'Tủ kính đèn LED',   '+10% giá bán cho khách',      500,  0, 2, null,        10, 4),
  ('display_2', 'display', 2, 'Tủ lạnh trưng bày', '+20% giá bán cho khách',     1800,  0, 4, 'display_1', 20, 5),
  ('display_3', 'display', 3, 'Quầy cao cấp',      '+30% giá bán cho khách',     5000,  0, 7, 'display_2', 30, 6);

insert into public.upgrade_catalog (code, kind, tier, name, description, cost_coins, cost_gems, unlock_level, effect, sort) values
  ('decor_table',  'decor', 1, 'Bàn gỗ cổ điển', '+5 uy tín',  500,   0, 1,  5, 10),
  ('decor_plant',  'decor', 1, 'Cây cảnh mini',  '+3 uy tín',  320,   0, 1,  3, 11),
  ('decor_neon',   'decor', 1, 'Biển hiệu neon', '+10 uy tín',   0,  90, 1, 10, 12),
  ('decor_lamp',   'decor', 1, 'Đèn chùm ấm',    '+15 uy tín',   0, 140, 1, 15, 13);
