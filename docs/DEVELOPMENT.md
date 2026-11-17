# Development

GK Furnish uses pnpm. Do not run `npm install` or `yarn`.

## Staging database

The shop database and a development server must not be the same project. Local `.env` today has no staging switch. `pnpm dev` writes to whatever `SUPABASE_URL` is in that file.

1. In Supabase, create a new project for staging. Do not reuse the live project.
2. In the staging SQL editor, run every file in `drizzle/migrations/` in numeric order, from `0000` through the latest file. Run each file once. They are written to be safe to run again.
3. Copy `.env.example` to `.env` on your machine (this file is gitignored).
4. Fill `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the `VITE_` copies from the **staging** project settings. The service-role key is server only. Never put it in a `VITE_` variable, in git, or in chat.
5. Set `APP_ENV=staging`.
6. Set `SUPABASE_PRODUCTION_URL` to the live project URL (`https://….supabase.co` only, no key). If a development server is still pointed at that host, it prints a warning and continues. It does not block the server.
7. Use staging Snippe keys if Snippe gives you a sandbox. Keep `SNIPPE_API_KEY` and `SNIPPE_WEBHOOK_SECRET` server only. Set `SNIPPE_ENABLED=true` or Snippe will not mark a payment paid. The checkout page can still send a prompt when only the API key is set.

`APP_ENV` is `production`, `staging`, or `development`.

## Gates

From the project folder:

```bash
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

`pnpm test` uses Node's built-in test runner. It does not need Vitest.

## Migrations

Add a new numbered SQL file under `drizzle/migrations/`. Do not drop or rename a column the running site reads. Apply the file yourself in the Supabase SQL editor for the project you are changing. Apply staging first. The running site must keep working before the new SQL is applied.

`0024_allow_payment_confirmation.sql` must be applied on a database before Snippe or the owner can mark a payment paid. Until then, payment updates are rejected by the database.

## Webhooks on your machine

Snippe calls a public URL. Your laptop is not public.

1. Put the webhook secret in `.env` as `SNIPPE_WEBHOOK_SECRET`. Do not pass it on the command line and do not paste it into chat.
2. Start the app with `pnpm dev`.
3. Use a tunnel you trust, and set `SNIPPE_WEBHOOK_URL` to `https://<tunnel>/api/webhooks/snippe`. The server sends that URL when it creates a payment.
4. A request with a bad signature is rejected. Do not log the raw webhook body.
5. The backup check is `GET /api/cron/palmpesa`. If `CRON_SECRET` is set, send `Authorization: Bearer <that secret>`. Do not put the secret in a screenshot.

PalmPesa stays off unless `PAYMENT_MODE` is exactly `palmpesa`.
