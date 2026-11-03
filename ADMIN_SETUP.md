# Admin CMS, customer accounts & Snippe setup

## 1. Database

Run these in the Supabase SQL Editor, in order, if they have not been run yet:

1. [`drizzle/migrations/0003_admin_cms_payments.sql`](drizzle/migrations/0003_admin_cms_payments.sql)
2. [`drizzle/migrations/0005_general_audience_copy.sql`](drizzle/migrations/0005_general_audience_copy.sql)
3. [`drizzle/migrations/0006_customers_cart_payment_policy.sql`](drizzle/migrations/0006_customers_cart_payment_policy.sql) — customer profiles, saved carts, multi-item orders, receipts and advance tiers. **Run this before deploying the cart and checkout code**, otherwise checkout cannot save orders.

## 2. Create an admin user

1. In Supabase → Authentication → Users, create a user with email + password.
2. Copy the user’s UUID and run:

```sql
INSERT INTO public.admin_users (user_id)
VALUES ('PASTE-USER-UUID-HERE');
```

3. Open `/account/login` and sign in with that email and password. Everyone uses this one sign-in page: admins are taken to `/admin`, customers to `/account`. A signed-in admin also sees an **Open admin portal** button on My account.

Forgotten passwords are reset from `/account/forgot` for everyone. Admin accounts must choose a strong password (12+ characters, upper and lower case, a number and a symbol).

## 3. Customer login (Supabase Auth)

In Supabase → Authentication → URL configuration:

- **Site URL:** `https://gkfurnish.co.tz`
- **Redirect URLs:** add
  - `https://gkfurnish.co.tz/auth/callback`
  - `https://gkfurnish.co.tz/account/reset`
  - `https://gk-furnish.vercel.app/auth/callback`
  - `https://gk-furnish.vercel.app/account/reset`
  - `http://localhost:8080/auth/callback`
  - `http://localhost:8080/account/reset`

  If you added the old `/admin/reset` URLs, you can remove them once any reset emails sent before the switch have expired. Those old links still work: `/admin/reset` forwards to `/account/reset`.

Email and password sign-up is on by default. Under Authentication → Emails you can edit the confirmation and password reset emails.

### Sign in with Google

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** (type: Web application).
2. Add the authorised redirect URI shown in Supabase → Authentication → Providers → Google (it looks like `https://YOUR-PROJECT.supabase.co/auth/v1/callback`).
3. Paste the client ID and secret into Supabase → Authentication → Providers → Google and enable it.

## 4. Snippe mobile money payments

Add these environment variables in Vercel (Project → Settings → Environment Variables), then redeploy:

| Variable | Purpose |
|---|---|
| `SNIPPE_API_KEY` | API key from [snippe.sh](https://snippe.sh) (`snp_…`) |
| `SNIPPE_WEBHOOK_SECRET` | Webhook signing secret |
| `SNIPPE_WEBHOOK_URL` | `https://gkfurnish.co.tz/api/webhooks/snippe` |

Register the same webhook URL in the Snippe dashboard. Networks: M-Pesa, Airtel Money, HaloPesa and Mixx by Yas, detected from the phone number. Snippe's minimum payment is TSh 500.

Until the API key is set, checkout still saves the order and tells the customer that payment will be confirmed on WhatsApp or by phone. The admin can record cash, bank or mobile money payments on each order, and each one gets a receipt.

## 5. Payment policy

- Advance tiers are set in **Admin → Site settings → Advance payment tiers** (defaults: 50% standard, 60% custom or from TSh 1,000,000, 70% large from TSh 3,000,000 or 10+ items).
- An order cannot be moved to *In production* or *Ready* until the advance is paid **and** the specifications are marked as agreed.
- An order cannot be moved to *Out for delivery* or *Completed* until the balance is TSh 0.
- Stock is reduced once the advance is paid.
- Every completed payment gets a receipt number (`RCT-<order>-<n>`), downloadable by the customer and the admin.

## 6. TikTok & contact

Update TikTok and other contact details under **Admin → Site settings**.
