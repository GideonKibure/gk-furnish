-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_sw text,
  slug text NOT NULL UNIQUE,
  description text,
  description_sw text,
  image_key text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are publicly readable" ON public.categories FOR SELECT USING (true);

-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  name_sw text,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  description_sw text,
  short_description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  material text,
  dimensions text,
  features text[] NOT NULL DEFAULT '{}',
  available_colors text[] NOT NULL DEFAULT '{}',
  image_key text,
  stock_quantity int NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are publicly readable" ON public.products FOR SELECT USING (true);
CREATE INDEX products_category_idx ON public.products(category_id);

-- Product images
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_key text,
  image_url text,
  alt_text text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Product images are publicly readable" ON public.product_images FOR SELECT USING (true);
CREATE INDEX product_images_product_idx ON public.product_images(product_id);

-- Order number sequence + generator
CREATE SEQUENCE public.order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'GK-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 4, '0');
$$;

-- Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT public.generate_order_number(),
  customer_name text NOT NULL,
  phone text NOT NULL,
  email text,
  delivery_location text NOT NULL,
  preferred_color text,
  preferred_size text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','in_production','ready','out_for_delivery','completed','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.orders TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit an order" ON public.orders FOR INSERT WITH CHECK (true);

-- Order items
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.order_items TO anon, authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);

-- Order status history
CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.order_status_history TO service_role;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.log_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO public.order_status_history (order_id, status) VALUES (NEW.id, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_status_log
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status();

-- Custom orders
CREATE TABLE public.custom_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE DEFAULT public.generate_order_number(),
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  furniture_type text NOT NULL,
  design_description text NOT NULL,
  preferred_dimensions text,
  preferred_material text,
  preferred_color text,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  budget_range text,
  delivery_location text NOT NULL,
  additional_requirements text,
  reference_image_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.custom_orders TO anon, authenticated;
GRANT ALL ON public.custom_orders TO service_role;
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit a custom request" ON public.custom_orders FOR INSERT WITH CHECK (true);

-- Contact messages
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  subject text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can send a message" ON public.contact_messages FOR INSERT WITH CHECK (true);

-- Demo data
INSERT INTO public.categories (name, name_sw, slug, description, description_sw, image_key, sort_order) VALUES
('Chairs', 'Viti', 'chairs', 'Study, student and dining chairs built to last through long days.', 'Viti vya kusomea, vya wanafunzi na vya mezani vilivyotengenezwa kudumu.', 'chairs', 1),
('Tables', 'Meza', 'tables', 'Study tables and desks sized for hostel rooms and home offices.', 'Meza za kusomea zinazofaa vyumba vya hosteli na ofisi za nyumbani.', 'tables', 2),
('Beds', 'Vitanda', 'beds', 'Strong single and double bed frames in solid local timber.', 'Vitanda imara vya mtu mmoja na wawili kutoka mbao bora za hapa.', 'beds', 3),
('Table Lamps', 'Taa za Meza', 'table-lamps', 'Handmade wooden lamps that make a study corner feel like home.', 'Taa za mbao zilizotengenezwa kwa mikono kwa pembe yako ya kusomea.', 'lamps', 4),
('Custom Furniture', 'Samani Maalum', 'custom-furniture', 'Anything you can describe, built to your measurements.', 'Chochote unachoeleza, kinatengenezwa kwa vipimo vyako.', 'chairs', 5);

INSERT INTO public.products (category_id, name, name_sw, slug, short_description, description, price, material, dimensions, features, available_colors, image_key, stock_quantity, is_available, is_featured)
SELECT c.id, v.name, v.name_sw, v.slug, v.short_desc, v.descr, v.price, v.material, v.dims, v.features, v.colors, v.image_key, v.stock, v.avail, v.feat
FROM (VALUES
  ('chairs','Study Chair','Kiti cha Kusomea','study-chair','Strong and comfortable chair designed for long study sessions.','A solid wooden study chair with a shaped backrest and padded seat, built for students who spend long hours at the desk. Finished by hand in our Mbeya workshop.',30000,'Wood + fabric','45cm W x 48cm D x 86cm H', ARRAY['Strong wooden construction','Shaped backrest for comfort','Padded, easy-clean seat','Durable matte finish','Sized for hostel desks'], ARRAY['Natural wood','Dark walnut','Navy seat'],'chairs',12,true,true),
  ('chairs','Student Chair','Kiti cha Mwanafunzi','student-chair','Light, stackable chair that fits any hostel room.','A simple, light chair that moves easily between desk, table and visitors. Built from the same hardwood frame as our study chair at a lower price.',22000,'Wood','42cm W x 45cm D x 84cm H', ARRAY['Light and easy to move','Stackable design','Sanded smooth edges','Affordable everyday seating'], ARRAY['Natural wood','Dark walnut'],'chairs',20,true,true),
  ('chairs','Dining Chair','Kiti cha Mezani','dining-chair','Everyday dining chair with a clean modern line.','A comfortable dining chair with a woven fabric seat and gently curved back, made to match our tables.',35000,'Wood + fabric','45cm W x 50cm D x 88cm H', ARRAY['Woven fabric seat','Curved back support','Matches GK dining tables','Hardwood joints'], ARRAY['Natural wood','Dark walnut','Cream seat'],'chairs',8,true,false),
  ('tables','Study Table','Meza ya Kusomea','study-table','A proper desk for books, a laptop and a lamp.','Our most popular desk. Wide enough for a laptop and open books, with one drawer for stationery and slim legs that keep the room feeling open.',85000,'Wood','110cm W x 55cm D x 75cm H', ARRAY['One stationery drawer','Fits a laptop and open books','Slim tapered legs','Scratch-resistant top','Stable hardwood frame'], ARRAY['Natural wood','Dark walnut'],'tables',6,true,true),
  ('tables','Student Desk','Dawati la Mwanafunzi','student-desk','Compact desk made for small hostel rooms.','A smaller desk designed around standard hostel room space, with a lower shelf for books.',65000,'Wood','90cm W x 45cm D x 75cm H', ARRAY['Compact footprint','Lower book shelf','Easy to move','Smooth sanded finish'], ARRAY['Natural wood','Dark walnut'],'tables',10,true,true),
  ('tables','Small Side Table','Meza Ndogo','small-side-table','Handy table for a lamp, books or a kettle.','A small, sturdy side table that works beside a bed or chair.',38000,'Wood','45cm W x 45cm D x 55cm H', ARRAY['Sturdy four-leg frame','Good beside a bed','Light to carry'], ARRAY['Natural wood','Dark walnut'],'tables',14,true,false),
  ('beds','Single Bed','Kitanda cha Mtu Mmoja','single-bed','Solid single bed frame with a simple headboard.','A strong single bed frame in solid timber with slats that support a standard mattress. Built to survive moving between rooms.',180000,'Wood','95cm W x 195cm L x 90cm H', ARRAY['Solid timber frame','Supportive slat base','Simple flat headboard','Fits a standard single mattress','Assembles and disassembles easily'], ARRAY['Natural wood','Dark walnut'],'beds',4,true,true),
  ('beds','Double Bed','Kitanda cha Watu Wawili','double-bed','Double bed frame built for daily use.','A wider version of our single bed with a reinforced centre rail for long-term stability.',260000,'Wood','140cm W x 195cm L x 90cm H', ARRAY['Reinforced centre rail','Solid timber frame','Supportive slat base','Fits a standard double mattress'], ARRAY['Natural wood','Dark walnut'],'beds',3,true,false),
  ('table-lamps','Wooden Table Lamp','Taa ya Mbao','wooden-table-lamp','Turned wooden lamp with a warm linen shade.','A hand-turned wooden lamp base with a linen shade that gives a soft, warm light - good for reading without lighting the whole room.',45000,'Wood + fabric shade','28cm diameter x 45cm H', ARRAY['Hand-turned wooden base','Soft warm linen shade','Good reading light','Stable weighted base'], ARRAY['Natural wood','Dark walnut'],'lamps',9,true,true),
  ('table-lamps','Decorative Table Lamp','Taa ya Mapambo','decorative-table-lamp','A sculptural lamp for a desk or bedside.','A slimmer decorative lamp with a shaped base, made as much for the look as the light.',52000,'Wood + fabric shade','24cm diameter x 50cm H', ARRAY['Sculptural shaped base','Slim profile','Warm ambient light'], ARRAY['Natural wood','Dark walnut'],'lamps',5,true,false),
  ('custom-furniture','Custom Chair','Kiti Maalum','custom-chair','Tell us the shape, size and finish you want.','A chair built to your own measurements, material and colour. Share your idea and we will quote before any work begins.',0,'Your choice','Made to your measurements', ARRAY['Built to your measurements','Your choice of material','Your choice of colour','Quoted before work begins'], ARRAY['Your choice'],'chairs',0,true,false),
  ('custom-furniture','Custom Table','Meza Maalum','custom-table','A table built to your exact space.','A table made to fit your room, with the height, width and finish you need.',0,'Your choice','Made to your measurements', ARRAY['Built to your measurements','Your choice of material','Your choice of colour','Quoted before work begins'], ARRAY['Your choice'],'tables',0,true,false)
) AS v(cat_slug,name,name_sw,slug,short_desc,descr,price,material,dims,features,colors,image_key,stock,avail,feat)
JOIN public.categories c ON c.slug = v.cat_slug;