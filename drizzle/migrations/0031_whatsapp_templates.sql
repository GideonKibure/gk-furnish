-- Owner-editable WhatsApp replies. The app uses the built-in lines until this column exists.
alter table public.site_settings
  add column if not exists whatsapp_templates jsonb not null default '{}'::jsonb;
