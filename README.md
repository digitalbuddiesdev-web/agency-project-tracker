# Agency Project Tracker

A web-based project tracker for Digital Buddies, backed by Supabase with per-user accounts. Track projects with dates, duration, status, client, scope, tech stack, team, hours, and billing.

## Stack

- React 18 + Vite 5
- Supabase (Postgres + Auth + RLS) — per-user data isolation

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create the database table (required before first use)**

   Open the Supabase dashboard → **SQL Editor** and run the contents of
   [`supabase/schema.sql`](supabase/schema.sql). This creates the `projects`
   table and enables Row-Level Security so each user only sees their own rows.

3. **Configure env**

   Copy `.env` (already populated) or create `.env.local` with:
   ```
   VITE_SUPABASE_URL=https://qokrbtaoijvmxzqdjfje.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```

4. **Run**
   ```
   npm run dev
   ```
   Open the printed URL (e.g. http://localhost:5173).

## Usage

- **Sign up** with an email/password on first visit (per-user account).
- Each user has their own isolated project list via RLS.
- Add / edit / delete projects with the buttons in the table.
- Filter by status, search, sort.
- Export filtered list to CSV or JSON.

## Build for production

```
npm run build
npm run preview
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, etc.).

## Security note

- The anon/publishable key is safe to ship in the frontend — it is restricted by RLS.
- The **Postgres connection string** (`postgresql://postgres:...@db...`) is the
  database superuser credential and must **never** be placed in the frontend,
  committed, or shared. It is only needed for admin SQL via the dashboard.
