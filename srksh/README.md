# Sri Ramakrishna Students Home (SRKSH) — Website + HPL Management

React + TypeScript + Vite + Tailwind CSS on the front end; Supabase (Postgres, Auth, Storage) as the backend.
Public site, protected admin dashboard, dynamic gallery, HPL teams / sports / results, and an automatically calculated leaderboard.

Nothing is hardcoded: team names, players, sports, results and points all come from the database.
Until Supabase is configured the site shows a "Backend not configured" banner and nothing can be loaded or saved.

## 1. Accounts you need (all have free tiers)

| Service | Why | Needed values |
|---|---|---|
| [Supabase](https://supabase.com) | Database, admin login, image storage | Project URL and **anon (public)** key |
| [Vercel](https://vercel.com) | Hosts the site | A GitHub repo containing this project |
| [GitHub](https://github.com) | Source for Vercel deploys | — |

Never put the Supabase **service_role** key in this project or in Vercel's `VITE_` variables. It is not used.

## 2. Supabase setup (once)

1. Create a project at supabase.com.
2. **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, click **Run**. This creates all tables, row-level-security policies, the leaderboard view, the atomic `save_sport_result` function and the `srksh-media` storage bucket (public read, admin-only write, JPG/PNG/WebP, 5 MB). It is safe to re-run.
3. **Create your admin** (there is deliberately no public sign-up page):
   1. **Authentication → Users → Add user → Create new user**: enter your email and a strong password, tick *Auto Confirm User*.
   2. In the SQL Editor run (use your email):
      ```sql
      insert into public.profiles (id, email)
      select id, email from auth.users where email = 'you@example.com';
      ```
   3. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up".
   Only users with a row in `profiles` are treated as admins; every write is enforced by Postgres RLS, not by the front end.
4. **Project Settings → API**: copy the *Project URL* and the *anon public* key.

## 3. Run locally

```bash
cp .env.example .env      # then fill in the two values
npm install
npm run dev               # http://localhost:5173
npm run build             # production build into dist/
```

`.env`:
```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

## 4. Deploy to Vercel (free tier)

1. Push this folder to a GitHub repository.
2. Vercel → **Add New → Project** → import the repo. Framework preset: **Vite** (build `npm run build`, output `dist`).
3. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then deploy.
4. `vercel.json` rewrites every path to `index.html`, so direct visits to `/hpl/results`, `/admin/sports/...` etc. work.
5. In Supabase **Authentication → URL Configuration**, set *Site URL* to your Vercel URL.

(Render static sites also work: build `npm run build`, publish `dist`, and add a rewrite `/* → /index.html`.)

## 5. Using the admin dashboard

Go to `/admin` (link in the footer) and sign in.

**HPL management** (left sidebar, collapsible on mobile)
1. **Settings → Create the first edition** (e.g. "HPL 2026"). Set status and an optional tie-break rule. "Start new edition" begins a fresh season; old editions and all their results are kept and can be made current again.
2. **Teams → Add team**: name, colour, logo, captain + photo, and any number of members (Add member). Duplicate names within a team are rejected.
3. **Sports → Add sport**: any name/category/image/status. Open a sport to:
   - add participating teams (dropdown of saved teams) and tick players from each roster; manual players are allowed with a warning if not on the roster; a player can be in any number of sports;
   - record **Results and Points**: winner, runner-up and extra placements, each with free-form points; status *Pending* (no points counted) or *Completed*.
4. **Leaderboard** is read-only: it is a database view summing points from *completed* results, with competition ranking (1, 1, 3) and all teams shown including zero points.

**Website content**: *About Photos* (four fixed slots with title/caption; slot 1 also feeds the homepage hero) and *Gallery* (multi-upload with title, caption, category, progress, edit/replace/delete).

## 6. Data integrity rules (enforced in the database)

- One result per sport; placements are replaced atomically, so editing/correcting a result can never double count.
- A team can hold only one placement per sport, and only participating teams can be placed.
- Pending results contribute nothing and show no winners publicly.
- Teams that appear in saved results cannot be deleted. Removing a roster member keeps the player's name on past sport lists.
- Storage and table writes require an admin; public visitors have read-only access.

## 7. Project layout

```
supabase/schema.sql        tables, RLS, leaderboard view, save_sport_result(), storage
src/lib/                   supabase client, auth, data hooks, helpers
src/components/            layout, UI kit, leaderboard, HPL cards, homepage sections
src/pages/                 public pages (Home, About, Gallery, HPL…)
src/pages/admin/           login, dashboard, teams, sports, results, settings, gallery, about photos
vercel.json                SPA rewrite
```

## 8. Notes

- Photographs are placeholders (clearly labelled) until you upload real ones.
- No address, phone, email or social links are invented; add them under Settings → Footer contact details.
- Public pages read fresh data from Supabase on every page load.
