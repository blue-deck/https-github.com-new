# BlueDeck

BlueDeck is a private yacht management website for owners, captains and crew.
It combines account-based access, yacht workspaces, crew profiles, document
records, contracts, checklist workflows and public company pages.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Required Environment

The app expects these values in `.env.local` locally and in the production
hosting environment:

```bash
NEXT_PUBLIC_SITE_URL=https://www.bluedeck.app
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
JOB_APPLICATION_MEDIA_SIGNING_SECRET=...
CRON_SECRET=...
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it in browser code.
`TURNSTILE_SECRET_KEY` is also server-only and is used to verify real password
reset security challenges before BlueDeck sends reset emails.
`JOB_APPLICATION_MEDIA_SIGNING_SECRET` is a dedicated random secret (at least
32 characters) used for short-lived employer media capabilities. `CRON_SECRET`
protects the optional manual checklist-renewal endpoint; the durable production
schedule itself runs inside Postgres through `pg_cron`.

## Database Changes

The ordered files in `supabase/migrations/` are the only production database
source of truth. Do not run legacy root-level SQL setup scripts or recreate
policies manually in the SQL Editor; doing so can overwrite later RLS and
private-storage hardening.

Review pending migrations before applying them, then use the linked Supabase
CLI project:

```bash
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Run the transactional checks in `supabase/tests/` against a disposable or
staging database before production changes.

## Verification

```bash
npm run check
```

Lint, type checking and the production build must all pass before deployment.

## Operational Checks

- Public health endpoint: `/api/health`
- Public sitemap: `/sitemap.xml`
- Robots policy: `/robots.txt`
- Public legal pages: `/privacy`, `/terms`
- Public company pages: `/about`, `/contact`, `/services`, `/management`, `/trust`
