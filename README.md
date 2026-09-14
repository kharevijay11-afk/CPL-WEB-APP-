# CPL Auction

A full-stack Cricket Players Auction web app using React, Supabase Auth, Supabase Database, and Supabase Realtime. It is ready for free deployment on Vercel or Netlify.

## Features

- Admin/Auctioneer dashboard with Supabase email/password authentication.
- Multiple tournaments with separate teams, players, auction logs, and settings.
- Tournament profile with name, start date, end date, address, logo URL, and description.
- Edit/delete tables for tournaments, teams, and players.
- Print-ready A4 tournament pamphlet from the Admin dashboard.
- Tournament size configuration for 2, 4, 8, 10, 12, 14, or 16 teams.
- Team budget, remaining purse, roster size, and standings tracking.
- Player import from CSV or modern Excel XLSX with photo URL, category, T-shirt size, and T-shirt number fields.
- Public player registration form with camera/gallery photo upload, payment screenshot upload, Aadhaar upload, paid amount, and admin review.
- Player login using 10-digit mobile number and first word of the player's name.
- Live auction room with realtime bid updates across Admin, Player, and Projector views.
- Currency toggle between Points and INR.
- Bid validation against remaining team budget and roster capacity.

## Supabase Setup

1. Create a free project at [Supabase](https://supabase.com).
2. Open `SQL Editor`.
3. Paste the full contents of [`database/schema.sql`](database/schema.sql).
4. Run the SQL.
5. Go to `Authentication > Users` and create an admin user with email `admin@cpl.com` and password `admin123`.
6. Copy that user's UUID.
7. Return to `SQL Editor` and run:

```sql
insert into public.admin_users (user_id, display_name)
values ('PASTE_AUTH_USER_UUID_HERE', 'Auction Admin');
```

The app admin login is fixed as:

- Admin ID: `admin`
- Password: `admin123`

8. Go to `Project Settings > API`.
9. Copy the `Project URL` and `anon public` key.

## Existing Database Update

If your database was created before tournament management was added, run this once in Supabase SQL Editor:

```text
database/add-tournament-management.sql
```

If you already ran the old schema before photo and T-shirt fields were added, run this once in Supabase SQL Editor:

```text
database/add-player-photo-shirt-fields.sql
```

If you want the public player registration form with file uploads, run this once in Supabase SQL Editor:

```text
database/add-player-registration-workflow.sql
```

This creates:

- `player_registrations` table.
- `cpl-player-photos` public storage bucket.
- `cpl-registration-documents` private storage bucket.
- Upload policies for player registration.
- Admin-only read policy for payment screenshot and Aadhaar files.

## Local Configuration

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key
```

Never put the Supabase service-role key in this frontend app.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Deploy on Vercel

1. Push this project to GitHub.
2. Import it in [Vercel](https://vercel.com).
3. Framework preset: `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add these environment variables in Vercel Project Settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Deploy.

## Deploy on Netlify

1. Push this project to GitHub.
2. Import it in [Netlify](https://netlify.com).
3. Build command: `npm run build`.
4. Publish directory: `dist`.
5. Add these environment variables in Site configuration:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy.

## Player Import Template

The Admin dashboard includes a `Download template CSV` button. Headers:

```csv
full_name,mobile_number,photo_url,base_price,category,tshirt_size,tshirt_number,stats
```

`stats` should be valid JSON when possible:

```json
{"runs":1200,"strike_rate":142}
```

## Player Login Rule

- Username: player's 10-digit mobile number.
- Password: first word of the player's full name, case-insensitive.
- Player login works inside the currently selected tournament.

Example: `Virat Kohli` uses password `virat`.
# CPL-WEB-APP-
# CPL-WEB-APP-
