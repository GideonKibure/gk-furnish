-- Admin CMS, payments, site content, offer popups
-- Run in Supabase SQL Editor if not applying via drizzle.

-- Admin allow-list (Supabase Auth user IDs)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read own row" ON public.admin_users
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Product primary image URL (uploaded); image_key remains bundled fallback
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text;

-- Order payment fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','pending','paid','failed')),
  ADD COLUMN IF NOT EXISTS payment_kind text NOT NULL DEFAULT 'none'
    CHECK (payment_kind IN ('advance','full','none')),
  ADD COLUMN IF NOT EXISTS amount_due numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS snippe_reference text,
  ADD COLUMN IF NOT EXISTS payment_phone text;

-- Payments audit trail
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_kind text NOT NULL CHECK (payment_kind IN ('advance','full')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'TZS',
  phone text,
  provider text,
  snippe_reference text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','failed','expired')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS payments_order_idx ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS payments_snippe_ref_idx ON public.payments(snippe_reference);

-- Site-wide settings (single row)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  phone_display text,
  phone_dial text,
  whatsapp_number text,
  email text,
  location text,
  tagline text,
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Site settings are publicly readable" ON public.site_settings
  FOR SELECT USING (true);

INSERT INTO public.site_settings (
  id, phone_display, phone_dial, whatsapp_number, email, location, tagline,
  instagram_url, facebook_url, tiktok_url
) VALUES (
  1,
  '+255 692 713 993',
  '+255692713993',
  '255692713993',
  'gideonkibure@gmail.com',
  'Mbeya, Tanzania',
  'Locally made furniture from Mbeya, Tanzania',
  'https://www.instagram.com/gkbottlebloom/',
  'https://facebook.com',
  'https://www.tiktok.com'
) ON CONFLICT (id) DO NOTHING;

-- Editable bilingual page sections
CREATE TABLE IF NOT EXISTS public.page_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  section_key text NOT NULL,
  content_en text NOT NULL DEFAULT '',
  content_sw text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_key, section_key)
);
GRANT SELECT ON public.page_sections TO anon, authenticated;
GRANT ALL ON public.page_sections TO service_role;
ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Page sections are publicly readable" ON public.page_sections
  FOR SELECT USING (true);

INSERT INTO public.page_sections (page_key, section_key, content_en, content_sw) VALUES
  ('home', 'hero_title', 'Furniture built for the way you work, rest and live', 'Samani zilizojengwa kwa ajili ya kufanya kazi, kupumzika na kuishi'),
  ('home', 'hero_subtitle', 'Modern, durable and affordable furniture made by hand for offices, schools and homes across Tanzania.', 'Samani za kisasa, imara na nafuu zilizotengenezwa kwa mikono kwa ofisi, shule na nyumba nchini Tanzania.'),
  ('home', 'custom_title', 'Can''t find what you''re looking for?', 'Hujapata unachotafuta?'),
  ('home', 'custom_body', 'Tell us what you need — the size, the material, the colour — and we''ll build it for you.', 'Tuambie unachohitaji — ukubwa, nyenzo, rangi — nasi tutakutengenezea.'),
  ('about', 'lead', 'GK Furniture is a furniture workshop in Mbeya, Tanzania, making chairs, tables, beds and lamps by hand.', 'GK Furniture ni warsha ya samani Mbeya, Tanzania, inayotengeneza viti, meza, vitanda na taa kwa mikono.'),
  ('about', 'story', 'GK Furniture started from a simple problem: students needed furniture that was strong enough to last, small enough for a hostel room and cheap enough to actually afford.', 'GK Furniture ilianza kutokana na tatizo rahisi: wanafunzi walihitaji samani imara, ndogo kwa hosteli na nafuu.'),
  ('about', 'mission', 'To make durable, well-made furniture that students and young households in Tanzania can genuinely afford.', 'Kutengeneza samani imara na bora ambazo wanafunzi na familia changa Tanzania wanaweza kumudu.'),
  ('about', 'vision', 'To be the furniture workshop people in our region recommend first — for honest prices and work that lasts.', 'Kuwa warsha ya kwanza inayopendekezwa katika eneo letu — kwa bei za uaminifu na kazi inayodumu.'),
  ('faq', 'subtitle', 'If your question isn''t here, message us on WhatsApp and we''ll answer directly.', 'Ikiwa swali lako halipo hapa, tutumie ujumbe WhatsApp nasi tutajibu moja kwa moja.'),
  ('process', 'subtitle', 'Seven steps from your first message to the day you collect or receive your furniture.', 'Hatua saba kutoka ujumbe wako wa kwanza hadi siku unayopokea samani yako.'),
  ('contact', 'subtitle', 'Message us, call us, or send a note through the form. We reply fastest on WhatsApp.', 'Tutumie ujumbe, tupigie, au tuma fomu. Tunajibu haraka zaidi kwenye WhatsApp.'),
  ('gallery', 'subtitle', 'Finished pieces, rooms we''ve furnished and work in progress in the workshop.', 'Vipande vilivyomalizika, vyumba tulivyopamba na kazi inayoendelea warshani.'),
  ('footer', 'blurb', 'A furniture workshop in Mbeya making durable, affordable chairs, tables, beds and lamps by hand.', 'Warsha ya samani Mbeya inayotengeneza viti, meza, vitanda na taa imara na nafuu kwa mikono.')
ON CONFLICT (page_key, section_key) DO NOTHING;

-- Offer / urgency popups above the nav
CREATE TABLE IF NOT EXISTS public.offer_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_en text NOT NULL,
  message_sw text,
  delay_seconds int NOT NULL DEFAULT 3 CHECK (delay_seconds >= 0),
  duration_seconds int NOT NULL DEFAULT 12 CHECK (duration_seconds >= 1),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.offer_popups TO anon, authenticated;
GRANT ALL ON public.offer_popups TO service_role;
ALTER TABLE public.offer_popups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active offer popups are publicly readable" ON public.offer_popups
  FOR SELECT USING (is_active = true);

-- Public product images bucket (create if missing via storage API; SQL for policies)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-order-references', 'custom-order-references', false)
ON CONFLICT (id) DO NOTHING;
