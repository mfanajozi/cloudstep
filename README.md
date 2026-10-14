# CloudSTep

> POPIA-compliant client journey automation for South African professional services.
> SineThamsanqa Business Solutions — [www.cloudst.co.za](https://www.cloudst.co.za)

CloudSTep keeps your clients informed at every milestone of their journey (property transfers, legal matters, financial onboarding, vehicle handovers, construction projects) with auto-dispatched WhatsApp / SMS / Email updates. It also surfaces a marketing hub for birthdays and anniversaries and a self-serve customer portal.

## Stack

- **Frontend:** React 19 + Vite 6 + TypeScript + Tailwind v4
- **Auth:** [Clerk](https://clerk.com) (self-serve client sign-up, agent onboarding)
- **Database:** [Supabase](https://supabase.com) (Postgres + RLS)
- **Hosting:** Vercel (recommended)

## Run Locally

**Prerequisites:** Node.js 20+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the project root with the following (use your own values):
   ```bash
   # Clerk (browser-safe publishable key)
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

   # Supabase (browser-safe anon key only)
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...

   # Supabase JWT template name (matches what you configure in Clerk)
   # Optional. Defaults to "supabase".
   ```

   ⚠️ **Never** commit or expose `SUPABASE_SERVICE_ROLE_KEY` or `CLERK_SECRET_KEY` to the browser. They are server-side only and must live in your hosting provider's secret env vars (if/when you add a backend).

3. Apply the database schema. In the Supabase SQL editor, run the contents of [`schema_updates.sql`](./schema_updates.sql) to add the required client-profile columns, indexes, RLS policies, and timestamp trigger.

4. Configure a Clerk **JWT template** named `supabase` that maps `auth.jwt() ->> 'sub'` to your Supabase user id. (This is how RLS policies verify the caller.)

5. Start the dev server:
   ```bash
   npm run dev
   ```
   Open <http://localhost:3000>.

## Build

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
  App.tsx                 # Auth routing + auto-link client profiles
  components/
    Dashboard.tsx         # Agent pipelines, archive/restore, invite link modal
    MarketingHub.tsx      # Birthday & anniversary quick-dispatch
    ClientPortal.tsx      # Logged-in client journey view + soft-delete
    TemplateBuilder.tsx   # Master journey template editor
    NotificationSettings.tsx
    StatsOverview.tsx
    Onboarding.tsx        # First-run industry selection
  data.ts                 # Seed templates & dummy client
  lib/
    supabase.ts           # Clerk-JWT-aware Supabase client
  types.ts
schema_updates.sql        # Required Postgres schema additions
```

## Deployment (Vercel)

1. Push this repository to GitHub.
2. In Vercel: **New Project** → Import the GitHub repo.
3. Vercel auto-detects Vite. Set:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add environment variables (Project Settings → Environment Variables):
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. In your Clerk dashboard, add the Vercel domain to **Allowed Origins** and **Allowed Redirect URLs**.
6. Deploy.

## CloudStep Renewal Reminder

A standalone product inside this app at `#/renewals`: a set-once renewal and compliance reminder engine (spec: `planning/cloudstep-renewal-reminder.md`). It shares CloudStep sign-in and the `users` table, and keeps everything else in its own `rr_*` tables.

### How it fits together

| Piece | Where | Role |
| --- | --- | --- |
| Engine | `src/renewals/engine/` | Recurrence (fixed/completion anchors, month-end and 29 Feb), reminder ladders (5-nudge cap, no backfill), SA public holidays, quiet hours, statuses, plans. Shared by browser and server so the timeline preview and the scheduler cannot disagree. |
| Console | `src/renewals/` | Dashboard, calendar, entities (provider dashboard), channels, integrations, team, reports, settings. Plain CRUD goes through the Neon Data API under RLS. |
| Function | `functions/renewals/` (Neon Function `renewals`) | Cron every 5 min: reschedule → dispatch → events → weekly digest → retention. Also serves Mark-as-done links (`/a/:token`), the client portal (`/p/:token`), the app API (`/api/*`, Neon Auth JWT) and the inbound API (`/v1/*`, API key). |
| Schema | `schema_renewals.sql` | Additive, idempotent. Tables, triggers (change log, plan limits, reschedule flag), RLS and RPCs. |

### Access (aligned with `users.role`)

- `users.role = 'admin'` → platform admin: full access to every Renewal Reminder account and can change plans.
- `users.role = 'owner'` → can create one Renewal Reminder account and is its **Owner**.
- Per-account roles in `rr_members`: **Admin**, **Contributor** (optionally limited to entities), **Viewer**, **Watcher**. Invites are single-use links; the token proves the invitee received it.
- **Client (portal)**: no login, a per-entity secret link.
- Webhook secrets and API keys are readable by owner/admin only. Delivery, job, completion and change logs are written only by the function and triggers.

### Delivery

Email (Resend) is always on. Slack and Teams post to incoming-webhook URLs. WhatsApp and SMS go to the account's **relay webhook** as a signed `reminder.relay` event, and an n8n / Make / Zapier flow sends them. A failed non-email channel falls back to email immediately; two failures in a row notify the owner.

### Setup

1. Apply `schema_renewals.sql` to the Neon branch (after `schema_updates.sql`).
2. Put the function secrets in your env file (see `.env.example`): `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`.
3. Deploy the function and its 5-minute trigger (declared in `neon.ts`):
   ```bash
   npx neonctl@8.4.4 login
   npx neonctl@8.4.4 deploy --env .env.local
   npx neonctl@8.4.4 functions get renewals   # copy invocation_url
   ```
4. Set `VITE_RENEWALS_API_URL` to that URL in the web app's environment (and on Vercel), then rebuild.

### Webhooks

Outbound events are `POST`ed with `X-CloudStep-Event`, `X-CloudStep-Delivery`, `X-CloudStep-Timestamp` and `X-CloudStep-Signature: sha256=HMAC_SHA256(secret, "timestamp.rawBody")`. Inbound: `Authorization: Bearer csr_…` against `/v1/renewals`, `/v1/entities`, `/v1/templates`. Full reference is in the console under **Integrations**.

## Security Notes

- All client passwords are handled exclusively by Clerk — the agent never sees or sets them.
- The portal recognises the logged-in Clerk user and auto-links them to the matching `clients` row by `clerk_user_id` (preferred) or by email (fallback).
- "Delete My Profile" is a soft-delete (`status = 'deleted_by_user'`) for POPIA compliance — records are retained by the business but the client loses portal access.
- RLS policies in `schema_updates.sql` restrict clients to read/update only their own row.

## License

© SineThamsanqa Business Solutions. All rights reserved.
