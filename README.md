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

The app expects these values in `.env.local` locally and in Vercel production:

```bash
NEXT_PUBLIC_SITE_URL=https://www.bluedeck.app
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it in browser code.

## Production Foundation

Run `supabase-production-hardening.sql` in Supabase SQL Editor after the initial
database setup. It is idempotent and keeps the critical production foundation in
one place:

- required profile, crew, yacht, invitation, checklist and contract columns
- unique indexes used by profile sync and yacht membership flows
- storage buckets for crew documents, portfolio photos, task proof and yacht files
- baseline RLS/storage policies for authenticated BlueDeck users

## Verification

```bash
npm run build
npx eslint app/page.tsx app/login/page.tsx app/api/auth/signup/route.ts app/api/health/route.ts
```

The full repository contains older operational modules, so broad linting can
surface legacy warnings. Production build must stay clean before deployment.

## Operational Checks

- Public health endpoint: `/api/health`
- Public sitemap: `/sitemap.xml`
- Robots policy: `/robots.txt`
- Public legal pages: `/privacy`, `/terms`
- Public company pages: `/about`, `/contact`, `/services`, `/management`, `/trust`
