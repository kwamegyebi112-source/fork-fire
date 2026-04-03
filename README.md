# Fork N' Fire Private Tracker

Mobile-first private sales and expense tracker for Fork N' Fire, built for Vercel with Supabase authentication and database storage.

## What changed

- browser-only `localStorage` storage has been replaced with Supabase tables
- login is required before records can be accessed
- the app is now built with Next.js for Vercel deployment
- records sync across devices because they live in Supabase

## Stack

- Next.js 16
- React 19
- Supabase Auth
- Supabase Postgres

## Setup

1. Install dependencies:
   - `npm install`
2. Create a local env file:
   - copy `.env.local.example` to `.env.local`
3. Add your Supabase project values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Open the Supabase SQL editor and run:
   - `supabase/schema.sql`
5. In Supabase Auth:
   - create the owner account manually
   - disable public signups if you want only approved users to access the app
6. Start the app:
   - `npm run dev`

## Deploying to Vercel

1. Push the project to a Git repository.
2. Import the repo into Vercel.
3. Add the same two environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.

## Notes

- Security comes from Supabase Auth plus Row Level Security policies.
- Data is no longer tied to one phone browser.
- If the owner logs in from another device, the same records are available there.
- The login page is public, but business data is protected behind Supabase Auth and RLS.
