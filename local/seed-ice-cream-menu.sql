-- Ice cream categories + items for restaurant org branches. Idempotent.

WITH restaurant_branches AS (
  SELECT b.id AS branch_id, b.organization_id
  FROM pops_branches b
  JOIN organizations o ON o.id = b.organization_id
  WHERE o.system_type = 'restaurant'
    AND o.status = 'active'
),
wanted_cats AS (
  SELECT * FROM (VALUES
    ('Scoops', 10),
    ('Sundaes', 20),
    ('Shakes', 30),
    ('Cones', 40),
    ('Cakes', 50)
  ) AS t(name, sort_order)
),
ins_cats AS (
  INSERT INTO pops_menu_categories (organization_id, branch_id, name, sort_order, is_active)
  SELECT rb.organization_id, rb.branch_id, wc.name, wc.sort_order, true
  FROM restaurant_branches rb
  CROSS JOIN wanted_cats wc
  WHERE NOT EXISTS (
    SELECT 1 FROM pops_menu_categories c
    WHERE c.branch_id = rb.branch_id AND c.name = wc.name
  )
  RETURNING id, branch_id, name
),
all_cats AS (
  SELECT id, branch_id, name FROM ins_cats
  UNION ALL
  SELECT c.id, c.branch_id, c.name
  FROM pops_menu_categories c
  JOIN restaurant_branches rb ON rb.branch_id = c.branch_id
  JOIN wanted_cats wc ON wc.name = c.name
),
wanted_items AS (
  SELECT * FROM (VALUES
    ('Scoops', 'Chocolate Scoop', 350, true, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=400&q=60'),
    ('Scoops', 'Vanilla Scoop', 320, false, 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&w=400&q=60'),
    ('Scoops', 'Strawberry Scoop', 340, true, 'https://images.unsplash.com/photo-1633933358116-a27b902fad35?auto=format&fit=crop&w=400&q=60'),
    ('Scoops', 'Pistachio Scoop', 380, false, 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=400&q=60'),
    ('Sundaes', 'Hot Fudge Sundae', 650, true, 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=400&q=60'),
    ('Sundaes', 'Banana Split', 720, false, 'https://images.unsplash.com/photo-1488900128323-21503983a07e?auto=format&fit=crop&w=400&q=60'),
    ('Sundaes', 'Brownie Sundae', 690, false, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=400&q=60'),
    ('Shakes', 'Chocolate Shake', 480, false, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=60'),
    ('Shakes', 'Strawberry Shake', 470, true, 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=400&q=60'),
    ('Shakes', 'Mango Shake', 490, false, 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=400&q=60'),
    ('Cones', 'Vanilla Cone', 280, false, 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=400&q=60'),
    ('Cones', 'Chocolate Dip Cone', 320, true, 'https://images.unsplash.com/photo-1505394033641-40c6ad1178d7?auto=format&fit=crop&w=400&q=60'),
    ('Cones', 'Waffle Cone Duo', 420, false, 'https://images.unsplash.com/photo-1488900128323-21503983a07e?auto=format&fit=crop&w=400&q=60'),
    ('Cakes', 'Ice Cream Cake Slice', 550, false, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=400&q=60'),
    ('Cakes', 'Cheesecake Cup', 520, false, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=400&q=60')
  ) AS t(cat_name, item_name, price_pkr, featured, image_url)
)
INSERT INTO pops_menu_items (
  organization_id, branch_id, category_id, name, image_url, price_pkr,
  featured, is_active, sort_order, discountable, simple_price
)
SELECT
  rb.organization_id,
  rb.branch_id,
  ac.id,
  wi.item_name,
  wi.image_url,
  wi.price_pkr,
  wi.featured,
  true,
  0,
  true,
  true
FROM restaurant_branches rb
JOIN wanted_items wi ON true
JOIN all_cats ac ON ac.branch_id = rb.branch_id AND ac.name = wi.cat_name
WHERE NOT EXISTS (
  SELECT 1 FROM pops_menu_items i
  WHERE i.branch_id = rb.branch_id AND i.name = wi.item_name
);
