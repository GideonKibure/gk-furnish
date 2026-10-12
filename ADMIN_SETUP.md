# Admin CMS & Snippe setup

## 1. Database

Run [`drizzle/migrations/0003_admin_cms_payments.sql`](drizzle/migrations/0003_admin_cms_payments.sql) in the Supabase SQL Editor (or use the appended section at the end of `supabase-setup.sql` on a fresh project).

## 2. Create an admin user

1. In Supabase → Authentication → Users, create a user with email + password.
2. Copy the user’s UUID and run:

```sql
INSERT INTO public.admin_users (user_id)
VALUES ('PASTE-USER-UUID-HERE');
```

3. Open `/admin/login` and sign in with that email and password.

## 3. Snippe payments (when ready)

Add these environment variables in your hosting environment:

| Variable | Purpose |
|---|---|
| `SNIPPE_API_KEY` | API key from [snippe.sh](https://snippe.sh) (`snp_…`) |
| `SNIPPE_WEBHOOK_SECRET` | Webhook signing secret |
| `SNIPPE_WEBHOOK_URL` | Public URL: `https://YOUR-DOMAIN/api/webhooks/snippe` |

Until keys are set, orders still save and customers are directed to WhatsApp to finish payment. Advance amount is **TSh 10,000**; full payment uses the product line total. Networks: Airtel Money, M-Pesa, HaloPesa / Halotel, Yas (Mixx) — auto-detected from the MSISDN.

## 4. TikTok & contact

Update TikTok and other contact details under **Admin → Site settings**.
