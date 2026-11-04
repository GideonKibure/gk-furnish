# Admin CMS, customer accounts & Snippe setup

## 1. Database

Run these in the Supabase SQL Editor, in order, if they have not been run yet:

1. [`drizzle/migrations/0003_admin_cms_payments.sql`](drizzle/migrations/0003_admin_cms_payments.sql)
2. [`drizzle/migrations/0005_general_audience_copy.sql`](drizzle/migrations/0005_general_audience_copy.sql)
3. [`drizzle/migrations/0006_customers_cart_payment_policy.sql`](drizzle/migrations/0006_customers_cart_payment_policy.sql) — customer profiles, saved carts, multi-item orders, receipts and advance tiers. **Run this before deploying the cart and checkout code**, otherwise checkout cannot save orders.
4. [`drizzle/migrations/0007_storefront_prd_gaps.sql`](drizzle/migrations/0007_storefront_prd_gaps.sql) — product SKU/status/discounts/free delivery, hidden categories, delivery or collection with a confirmed delivery fee, order archiving, quotation versions, product reviews and notifications.

   The admin portal keeps working before 0007 is run. Until then: products can only be deleted (not archived), the new product fields are not saved, orders cannot be archived and have no delivery fee step, the Reviews page and the notification bell stay hidden, and quotes are kept in the old format.
5. [`drizzle/migrations/0008_business_operations.sql`](drizzle/migrations/0008_business_operations.sql) — business operations: audit log, more order statuses, refunds, delivery records, product costs, inventory and stock movements, suppliers, purchase orders, production jobs, quality checks, expenses, capital and assets, and a private `business-receipts` storage bucket. **Run it after 0007.**

6. [`drizzle/migrations/0009_loan_repayments.sql`](drizzle/migrations/0009_loan_repayments.sql) — loan repayments (principal and interest) and a "repay by" date on loans, so each loan shows what is still owed. **Run it after 0008.**

   The run order is **0006 → 0007 → 0008 → 0009**. Each file is safe to run more than once. Before 0009 is run, loans show the full amount borrowed and repayments can't be recorded. Before 0008 is run, the Operations and Finance pages say "Run migration 0008", the dashboard's net profit stays empty, and orders cannot use the new statuses, refunds or delivery records. Every new table has row-level security switched on with no browser access: the portal reads and writes them through admin-only server functions.

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
- Order statuses (after 0008): Pending → Awaiting payment → Confirmed → Processing → In production → Ready → Out for delivery → Delivered → Completed, plus Cancelled and Refunded. *Awaiting payment* and *Processing* have no extra rules.
- An order cannot be moved to *In production* or *Ready* until the advance is paid **and** the specifications are marked as agreed.
- An order cannot be moved to *Out for delivery*, *Delivered* or *Completed* until the delivery fee is confirmed (delivery orders, after 0007) and the balance is TSh 0.
- *Cancelled* is only set with **Cancel order** and a reason. If money has been paid, refund it first.
- *Refunded* is only set by refunds: **Refund** on a completed payment, with a reason. When everything paid has been refunded, the order becomes *Refunded*.
- Each status change is written once to the order history, with who made it and why.
- The delivery fee is confirmed on the order (**Orders → open an order → Confirm delivery fee**, or **Free delivery**). The order total becomes goods + delivery fee; the advance stays based on the goods.
- Stock is reduced once the advance is paid.
- Every completed payment gets a receipt number (`RCT-<order>-<n>`), downloadable by the customer and the admin.

## 6. TikTok & contact

Update TikTok and other contact details under **Admin → Site settings**. After 0007, the collection address for orders picked up at the workshop is set there too.

## 7. Admin portal map

| Section | Pages |
|---|---|
| Overview | Dashboard: orders, sales (completed payments), outstanding balances, net profit and a sales chart for 7 days to 12 months, grouped in Dar es Salaam time. It also lists quotes to send, accepted quotes, orders waiting for an advance, delivery fees to confirm, low stock, overdue production and overdue purchase orders |
| Sales | Orders (tabs, search, filters, CSV export; on each order: payments, refunds, delivery record, cancel, and send lines to production or a partner), Custom requests (quotes as PDF), Customers (read-only), Payments (read-only register with receipts and CSV) |
| Catalogue | Products, Categories, Reviews (approve or reject) |
| Content | Page content, Site images, Offer popups, Messages |
| Operations | Inventory, Production, Suppliers, Purchases |
| Finance | Expenses, Capital & assets, Reports |
| Settings | Site settings (contact, advance tiers), Account & security |

Staff notifications (the bell) cover new orders, new custom requests and quote replies, plus low stock, overdue production jobs and overdue purchase orders. Each overdue or low-stock item notifies at most once a day.

## 8. Business operations (after 0008)

- **Inventory**: raw materials, work in progress, finished goods, partner stock and damaged items, each with a unit, reorder level, average unit cost and location. Stock only changes through movements: purchase received, used or produced in production, sold, adjustment, damage, return, transfer or opening stock. The movement history shows who made each change and why. A finished-goods item linked to a product keeps that product's shop stock in step. Sales and edits on the Products page then become movements too. Items at or below their reorder level are highlighted, and the page shows the total stock value.
- **Production**: jobs (`JOB-2026-0001`) made in-house or by a partner, created standalone or from an order line (**Send to production** on the order). A job moves through Queued, Materials ready, Cutting, Assembly, Finishing, Quality check and Completed, or On hold. Using materials takes them out of stock. Estimated and actual costs are compared, quality checks are recorded, and jobs past their target date are marked overdue.
- **Suppliers**: contact details, payment terms, active or inactive, a 1–5 rating, and what you still owe each supplier.
- **Purchases**: purchase orders (`PO-2026-0001`) with lines, created standalone or from an order line (**Order from partner** on the order). Receiving records accepted and rejected quantities and defects; accepted quantities go into stock. Supplier payments and the balance due are shown, with balance = goods + transport + inspection − payments.
- **Expenses**: rent, utilities, transport, materials, wages, marketing, payment fees, maintenance and other. Receipts upload to the private `business-receipts` bucket and open through short-lived links. Expenses can be filtered, exported to CSV and archived.
- **Capital & assets**: owner funds, gifts and loans (with terms and a repay-by date), and a register of business assets (cost, purchase date, useful life, disposal). Each loan has a **Repayments** button: record the principal and interest paid, and the page shows borrowed, repaid and still owed. Principal repaid can't exceed what was borrowed. Reports list "We owe lenders" (today's balances, with overdue loans flagged), and the cashbook shows principal and interest as cash out.
- **Reports**: for any period, sales by period, product and category, plus a profit and loss statement. Revenue is counted on a **cash basis**: customer payments completed in the period minus refunds in the period. The cost of goods is the actual costs of production jobs completed in the period plus the landed cost of partner goods bought for customer orders on purchase orders received in the period, with transport and inspection shared by line value. Gross profit is revenue minus that cost; net profit is gross profit minus operating expenses. The page also shows a cashbook by payment method, what customers owe, what is owed to suppliers and stock value, each with CSV export. Warnings flag records that may be incomplete.

### Business rules

- **BR-08** Every sensitive change is written to the audit log: price changes, payments and refunds, stock adjustments, status changes, deletions and archives.
- **BR-09** Production for a customer order needs the advance paid and the specifications agreed. A job for that order can only start without them if an exception reason is recorded.
- **BR-10** Stock cannot go below zero unless the movement is explicitly authorised.
- **BR-11** Every purchase order must have a supplier.
- **BR-12** Every refund needs a reason and cannot exceed what is left of the payment.
- **BR-13 / BR-14** Owner funds, gifts and loans are cash in, never revenue. Repaying loan principal is cash out, never an expense; loan interest paid is an expense ("Loan interest") and lowers profit.
- **BR-15** Payment fees are recorded as expenses.
- There are no staff roles yet: every admin user has full access.
