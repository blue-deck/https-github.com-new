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
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
AUTH_RECOVERY_STATE_SECRET=...
JOB_APPLICATION_MEDIA_SIGNING_SECRET=...
CRON_SECRET=...
```

Use `NEXT_PUBLIC_SITE_URL=https://www.bluedeck.app` in production. The configured
hostname is also the exact hostname accepted from Cloudflare Turnstile, so local,
preview and production environments must use intentional, matching widget keys.

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it in browser code.
`TURNSTILE_SECRET_KEY` is also server-only. BlueDeck forwards login, signup,
confirmation-resend and password-reset challenge tokens to Supabase Auth, which
is the sole verifier and consumes each token at the public authentication
boundary. This keeps direct Auth API calls protected as well as the BlueDeck
server routes.
`AUTH_RECOVERY_STATE_SECRET` is a dedicated server-only random secret of at
least 43 characters. It seals the one-time recovery transaction and must not be
reused for any other purpose. `CRON_SECRET` is a dedicated random secret of at
least 32 characters; Vercel sends it as the retention worker's bearer token.
`JOB_APPLICATION_MEDIA_SIGNING_SECRET` is a dedicated random secret (at least
32 characters) used for short-lived employer media capabilities. Recurring
checklist renewal has no public HTTP endpoint or application secret; its single
hourly production schedule runs entirely inside Postgres through `pg_cron`.

Production authentication also requires coordinated provider configuration:

- use a real Cloudflare Turnstile site/secret pair restricted to the public host;
  Supabase Auth performs the single server-side verification for every public
  password, signup, recovery and confirmation-resend request;
- treat each Turnstile token as single-use: the application route validates the
  request shape and forwards the token once, and Supabase Auth consumes it. Do
  not add a pre-verification call without implementing a second independent
  challenge token;
- prefer a verified custom SMTP sender and a recovery email template link using
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`; the application
  also accepts Supabase's immutable default `ConfirmationURL` flow and removes
  its fragment credentials from browser history immediately;
- keep Auth JWT lifetime short, require the configured password policy/current
  password checks, and enable password-change security notifications through a
  verified custom SMTP sender;
- verify the daily `/api/maintenance/retention` cron invocation and alert on a
  non-2xx result or a nonzero failed queue count.

The committed Supabase Auth configuration intentionally mirrors production and
keeps localhost out of the recovery allow-list. Run end-to-end local email-link
tests against an isolated local or staging Supabase project; never relax the
linked production redirects for developer convenience.

Keep Supabase Auth CAPTCHA enabled: it is the public enforcement boundary for
the browser-visible Auth API. Never release authentication changes with
placeholder credentials. Keep the exact BlueDeck recovery redirect allow-listed
and verify both the custom token-hash flow and the default `ConfirmationURL`
fallback before each release.

When deploying through BlueDeck's Sites/Cloudflare runtime, set
`BLUDECK_TRUSTED_PROXY=cloudflare`. Do not copy that value to unrelated hosts;
Vercel is detected from its own runtime marker and uses its edge-overwritten
forwarding header instead.

`www.bluedeck.app` on Vercel is the canonical public deployment and the sole
owner of the daily retention schedule in `vercel.json`. The private Sites build
is a secondary runtime and intentionally has no duplicate scheduled trigger;
running two physical-deletion workers would add risk without improving
retention guarantees. Database-native recurring work remains owned by the
single reviewed `pg_cron` jobs in the migrations.

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

The one-time legacy task-photo repair can be inspected without mutation after
the retention migration is installed:

```bash
node --env-file=.env.local scripts/repair-legacy-task-photo-path.mjs
```

Only a reviewed release should add `--apply`; the script refuses unexpected
projects or ambiguous repair sets and never prints object paths.

## Verification

```bash
npm test
npm run check
```

Lint, type checking and the production build must all pass before deployment.

## Operational Checks

- Public health endpoint: `/api/health`
- Public sitemap: `/sitemap.xml`
- Robots policy: `/robots.txt`
- Public legal pages: `/privacy`, `/terms`
- Public company pages: `/about`, `/contact`, `/services`, `/management`, `/trust`
