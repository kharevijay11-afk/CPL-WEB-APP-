# CPL Auction Project AI Handover

Generated: 2026-09-14

## Project

- Name: `cpl-auction`
- Folder: `F:\CPL APP RJN`
- Type: Vite React single page app
- Backend: Supabase Auth, Database, Realtime, Storage policies
- Main app file: `src/App.jsx`
- Supabase client: `src/lib/supabase.js`

## What This App Does

CPL Auction is a Cricket Players League management app. It supports tournament setup, admin auction control, public player registration, player login, team owner bidding, live projector display, standings, auction history, website content control, and match scoring.

Recent behavior notes:

- Public player registration no longer exposes player criteria. Every public registration saves criteria as `Silver Player`.
- Player criteria can be changed only from Admin Panel > Players > Add/Edit Player.
- Live Auction projector shows a large Sold/Unsold result with player name, points/price, and team name, then returns to "Choose The Next Player".
- Bid increment is currently `1000`.

## Current Run Commands

```powershell
cd "F:\CPL APP RJN"
npm install
npm run dev
```

Open the local URL printed by Vite. It is usually:

```text
http://127.0.0.1:5173
```

Production-style local preview:

```powershell
npm run build
npm run preview
```

## Environment

The app needs a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key
```

Important: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must belong to the same Supabase project. A previous "Save failed. Please try again." issue was caused by a mismatched URL/key pair. The current `.env` was corrected to use the same URL as `.env.example`.

Never put a Supabase service-role key in this frontend app.

## Supabase Setup

For a new Supabase project:

1. Open Supabase Dashboard.
2. Create/open the project.
3. Go to SQL Editor.
4. Paste and run `database/schema.sql`.
5. Go to Authentication > Users.
6. Create an admin user with email `admin@cpl.com` and password `admin123`.
7. Copy the auth user UUID.
8. Run:

```sql
insert into public.admin_users (user_id, display_name)
values ('PASTE_AUTH_USER_UUID_HERE', 'Auction Admin');
```

The app admin screen uses:

```text
Admin ID: admin
Password: admin123
```

## Database Files

- `database/schema.sql`: canonical full schema for a fresh Supabase project.
- `database/add-tournament-management.sql`: migration for tournament-wise data separation.
- `database/add-website-control.sql`: website content table and policies.
- `database/add-team-owner-bidding.sql`: team owner login and bidding support.
- `database/add-match-scoring.sql`: match and ball-by-ball scoring schema.
- `database/add-player-registration-workflow.sql`: registration and storage workflow.
- `database/add-player-criteria.sql`: player criteria/grade support with `Silver Player` as the default.
- `database/set-default-player-criteria-silver.sql`: one-time migration to set blank existing player criteria to `Silver Player`.
- `database/fix-registration-table-only.sql`: quick fix for missing registration table/columns.
- `database/allow-public-player-photo-save.sql`: quick fix for public player insert policy.
- `database/add-player-photo-shirt-fields.sql`: player photo and shirt fields migration.
- `database/add-player-payment-file-columns.sql`: payment/Aadhaar file columns migration.

Do not run every SQL file every time. Run `database/schema.sql` once for a fresh project. Run migration or fix files only when the corresponding table, column, or policy is missing.

## Common Issues

- "Invalid API key": `.env` URL and anon key are from different Supabase projects. Copy both from the same Supabase Project Settings > API page.
- "Player save permission blocked": run `database/allow-public-player-photo-save.sql` in the same Supabase project used by `.env`.
- "Registration table/column not found": run `database/fix-registration-table-only.sql` or the full current `database/schema.sql` on a new database.
- Admin login signs in to Supabase email/password, then checks `admin_users`.
- Public player registration stores compressed image data URLs in `players.stats` for photo, payment screenshot, and Aadhaar references.

## Important Frontend Areas

- `App`: loads Supabase session and realtime data.
- `PublicWebsite`: public tournament website/home view.
- `PlayerRegistration`: public player form.
- `AdminDashboard`: admin tabs for tournament, teams, players, auction, website, match scoring, and reports.
- `LiveAuctionAdmin`: start bidding, place bids, mark sold/unsold.
- `TeamOwnerLogin` and `TeamOwnerDashboard`: team owner access and bid placement.
- `MatchScoring`: live match scoring.
- `PlayerTable`, `TeamTable`, `AuctionLog`: shared display tables.

## Deployment

Vercel:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Netlify:

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Backup Notes

These generated files help future AI/developer continuation:

- `PROJECT_AI_HANDOVER.md`
- `PROJECT_DATABASE_SCHEMA_EXPORT.sql`
- `PROJECT_FILE_INDEX.json`

They are not a full binary backup of the project. For full backup, ZIP the whole folder or initialize Git and commit the project. This folder currently did not report as a Git repository when checked.
