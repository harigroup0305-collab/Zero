# ZERO — Supabase database setup

ZERO now uses Supabase Auth and per-user cloud sync for the watchlist, trading journal, investment holdings, and finance transactions. Browser localStorage remains as a local cache.

## 1. Create a Supabase project
1. Open https://supabase.com/dashboard and create a project.
2. Save the database password somewhere secure.
3. In Project Settings → API, copy the Project URL and the anon/publishable key.

## 2. Create the database table
1. Open the project's SQL Editor.
2. Paste and run the contents of [schema.sql](schema.sql).
3. Confirm that the `public.zero_user_data` table exists and Row Level Security is enabled.

The table stores one JSON array per user and module (`watchlist`, `trades`, `holdings`, `finance`). Policies restrict every row to the authenticated owner using `auth.uid() = user_id`.

## 3. Configure the website
1. Copy `supabase-config.js.example` to `supabase-config.js`.
2. Replace the project URL and anon/publishable key with your own values.
3. Keep the service_role/secret key private; never add it to website JavaScript.

Because this is a public GitHub Pages repository, do not commit private credentials. The browser anon/publishable key is designed to be public, but only safe when the RLS policies above are active.

## 4. Authentication

The site now includes `login.html` with email/password sign-in and registration using Supabase Auth. App pages redirect unauthenticated visitors to the login page. The browser uses the public publishable key; database access remains restricted by the `authenticated` RLS policies.

In Supabase Dashboard → Authentication → URL Configuration, set **Site URL** to `https://harigroup0305-collab.github.io/Zero/` and add that same URL plus `https://harigroup0305-collab.github.io/Zero/login.html` to the allowed Redirect URLs. Email confirmation is enabled by default on hosted projects; new users must verify their email before signing in.

## 5. Cloud synchronization
- [x] Per-user cloud sync for watchlist, trades, holdings, and finance.
- [x] Initial local data migration when a cloud record does not yet exist.
- [x] Merge existing local and cloud records to reduce accidental overwrites.
- [x] Demo finance sample data is excluded from initial migration.

The first signed-in load waits for cloud synchronization before rendering each module. When both local and cloud records exist, entries are merged and duplicate identical entries are collapsed. Keep browser data intact until you have verified the records on your account. Export CSV backups periodically; the app does not yet provide a dedicated restore screen.
