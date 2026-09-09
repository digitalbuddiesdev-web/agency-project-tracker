-- Agency Project Tracker — one-shot portfolio seed.
--
-- 1. Edit the email on the LAST line to the account you signed up with in the app.
-- 2. Run the ENTIRE file in the Supabase SQL Editor.
--    You should see a result row containing a number (12 = all seeded, 0 = already seeded).
--    "Success, no rows returned" means you stopped before the final line — scroll to the bottom.
--
-- Safe to re-run (skips projects already present for that user).

-- Drop the old auth-session-based function if it exists (from an earlier version).
drop function if exists public.seed_portfolio();

create or replace function public.seed_portfolio(p_email text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  i int := 0;
  uid uuid;
begin
  uid := (select id from auth.users where email = lower(trim(p_email)) limit 1);
  if uid is null then
    raise exception 'No user found for email %. Sign up in the app first, then re-run with that email.', p_email;
  end if;

  if not exists (select 1 from public.projects where owner_id = uid and name = 'Physio Prime (Web)') then
    insert into public.projects
      (owner_id, name, client, status, type, start, last_activity, duration, hours, location, tech, scope, team, billing, folder)
    values
      (uid, '9PM Bar & Cafe', '9PM Bar & Cafe', 'Production Ready', 'Marketing Website', '2026-09-07', '2026-09-07', 1, 16, 'Mohanbagh, Palolem, South Goa',
       'React 18 (CRA), Tailwind CSS 3.4, Lucide React', 'High-conversion SPA for a South Goa DJ bar: lineups, cocktails, kitchen, Google reviews, reservations, gallery, Instagram.', 'Digital Buddies', 'Project', '9-pm/'),
      (uid, 'BVG Choir', 'BVG — The Indian Choir of England', 'Design Phase', 'Organization Website', '2026-08-27', '2026-08-27', 1, 8, 'London, UK',
       'TBD (Frontend), PostgreSQL (RSVP)', 'London-based Indian choir site: music, events, membership tiers, gallery, heritage. Awaiting client sign-off on 3 design directions.', 'Digital Buddies', 'Project', 'BVG/'),
      (uid, 'BD Estate', 'BD Estate', 'In Development', 'Full-Stack Web Application', '2026-07-22', '2026-07-24', 3, 30, 'Remote',
       'React 18 + Vite, Express 4, MongoDB (Mongoose 7), JWT, Tailwind, Framer Motion', 'Real estate & property investment platform: marketing site, investor dashboard, full admin panel (properties, investors, leads, blog, transactions).', 'Digital Buddies', 'Project', 'db_estate/'),
      (uid, 'Digital Buddies ERP', 'Digital Buddies (Internal)', 'Active', 'Internal ERP', '2026-06-26', '2026-06-30', 5, 60, 'Internal',
       'React 19 + Vite 8, Tailwind 4, Supabase (Postgres + Auth + Realtime)', 'Internal company OS: employees, clients, projects, CRM, HR, attendance, time tracking. 24 tables, RLS, role-based access.', 'Digital Buddies', 'Internal', 'Digital-Buddies-ERP/'),
      (uid, 'La Jhinga Seafood & Cafe', 'La Jhinga Seafood & Cafe', 'Production Ready', 'Marketing Website', '2026-09-07', '2026-09-07', 1, 12, 'Palolem Beach, South Goa',
       'React 18 (CRA), Tailwind CSS 3.4, Lucide React', 'Conversion-optimized SPA: click-to-call, WhatsApp reservations, gallery, Google reviews, Instagram. Sister brand to 9PM.', 'Digital Buddies', 'Project', 'la-jhinga/'),
      (uid, 'NEO_MAX ERP', 'Digital Buddies (Internal)', 'Built', 'Multi-Department ERP/CRM (SaaS)', '2026-08-06', '2026-08-07', 2, 40, 'Internal',
       'React 19 + Vite 8, React Router 7, Tailwind 4, Supabase (Postgres + RLS)', 'Productized multi-tenant ERP/CRM with role-based access and org-scoped data isolation. Demo (localStorage) + SaaS (Supabase) builds.', 'Digital Buddies', 'Internal', 'NEO_MAX/'),
      (uid, 'Physio Prime (Web)', 'Physio Prime (physio-prime.in)', 'Built', 'Full-Stack Web Application', '2026-08-10', '2026-09-07', 29, 220, 'Remote',
       'React 19 + Vite 8 + TS, Express 5, Supabase Postgres + Drizzle ORM, Razorpay, Twilio, Resend', 'Physiotherapy marketplace: search doctors, book home-visit/video appointments, Razorpay payments, WhatsApp/SMS, verified reviews. Patient/doctor/admin roles.', 'Digital Buddies', 'Project', 'physio-prime/'),
      (uid, 'Physio Prime (App)', 'Physio Prime (physio-prime.in)', 'MVP Complete', 'Mobile Application', '2026-09-03', '2026-09-03', 1, 30, 'Remote',
       'React Native + Expo SDK 57, TypeScript, NativeWind 4, TanStack Query, Supabase Auth, Razorpay', 'Patient mobile app mirroring Physio Prime web: browse therapists, book appointments, pay, manage bookings, read blog. Consumes Express REST API.', 'Digital Buddies', 'Project', 'physio-prime-app/'),
      (uid, 'Pohewala', 'Pohewala', 'Active Dev', 'Marketing Website + Lead Gen', '2026-08-01', '2026-09-07', 38, 90, 'Taj Nagar, Nagpur, Maharashtra',
       'Next.js 16, TypeScript 6, Tailwind 4, PostgreSQL (pg), WhatsApp Cloud API, Framer Motion', 'India-first Poha QSR chain site: franchise/lead capture with WhatsApp alerts, admin panel, SEO. Capture enquiries into DB.', 'Digital Buddies', 'Project', 'pohewala/'),
      (uid, 'Sumam''s Boutique', 'Sumam''s Boutique', 'Mid-Development', 'E-Commerce Platform', '2026-09-03', '2026-09-07', 5, 45, 'Remote',
       'Next.js 16, Tailwind 3.4, Supabase (Postgres + Auth + Storage + RLS), Razorpay + Stripe, Zod', 'Bengal-heritage saree & jewellery store: full storefront + checkout + admin CMS (products, orders, customers, content, media).', 'Digital Buddies', 'Project', 'Sumams/'),
       (uid, 'Kasauti (Trading)', 'Digital Buddies (Internal)', 'Research', 'Trader Evaluation Platform (Prop-Firm)', '2026-09-04', '2026-09-07', 4, 20, 'Internal',
        'Spec: Next.js + NestJS + PostgreSQL + Redis (per 22-system-architecture). Blockchain: pending legal decision', 'India-focused trader-evaluation platform. 40-doc spec package in Trading/docs/. BLOCKED on SEBI 2024 advisory legal decision before coding.', 'Digital Buddies', 'Internal', 'Trading/'),
      (uid, 'Tikhori Foods', 'Tikhori Foods', 'In Development', 'Marketing Website', '2026-07-23', '2026-09-03', 42, null, 'India',
       'React 19 + Vite 7, TypeScript 5, Tailwind 4, Framer Motion', 'Single-page marketing site for a spice brand: hero, our story, product showcase, what-makes-us-different, farm-to-jar process, testimonials, gallery, and contact sections.', 'Digital Buddies', 'Project', 'tikhori_foods/');

    i := 12;
  end if;

  return i;
end;
$$;

-- IMPORTANT: edit this email to YOUR signed-up account, then run the whole file.
select public.seed_portfolio('aditya.kanojiya.dev@gmail.com');
