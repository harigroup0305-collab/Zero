# ZERO — Supabase database setup

This repository currently uses browser localStorage. These files prepare the secure cloud database; cloud sync is **not active yet**.

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

## 5. Current implementation status
- [x] Database schema and per-user Row Level Security policy drafted.
- [x] Supabase project created and SQL applied.
- [x] Browser project configuration added.
- [x] Sign-up/sign-in UI and session handling.
- [ ] Local data migration and cloud sync with conflict/error handling.
- [ ] Backup/export and restore verification.

**Important:** No existing ZERO page has been switched to cloud storage yet. Current data remains in each browser's localStorage. Do not delete browser data during setup. Before enabling sync, export/backup existing records from each module.
