# The Barham Lakes — Booking System

A full booking system in the same pattern as the Needham Market FC site:
**static pages + Supabase (Postgres + Auth) + Netlify Functions + Stripe**.

Members book an exclusive night-stay on a water, the calendar greys out taken
and blacked-out nights, a **30% deposit** is taken through Stripe to confirm,
and the owner manages everything from a private admin dashboard.

## Files

| File | What it is |
|------|-----------|
| `bookings.html` | Public booking page — night calendar, live pricing, deposit checkout |
| `account.html` | Sign in / create account + "my stays" (Supabase Auth) |
| `admin-bookings.html` | **Owner login** → manage bookings, **syndicate members** + **blackout dates** |
| `syndicate.html` | Public — apply, pay and join the syndicate online |
| `booking-config.js` | Your Supabase keys, waters, seasonal rates, ticket prices (edit this) |
| `schema.sql` | Database tables, the availability view + security rules |
| `schema-syndicate.sql` | Adds the memberships table (run after schema.sql) |
| `netlify/functions/create-checkout.js` | Starts the Stripe deposit payment |
| `netlify/functions/stripe-webhook.js` | Confirms the booking once the deposit is paid |
| `netlify.toml`, `package.json` | Netlify + dependency config |

---

## Setup (about 30–40 minutes, once)

### 1. Supabase (the database + logins) — free tier is fine
1. Create an account at supabase.com → **New project**. Note the project name & password.
2. Open **SQL Editor → New query**, paste all of `schema.sql`, click **Run**. Then do the same with `schema-syndicate.sql`.
3. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key
   - **service_role** key (secret — used only by the Netlify functions)

### 2. Fill in `booking-config.js`
Replace `BARHAM_SUPABASE_URL` and `BARHAM_SUPABASE_ANON_KEY` with the Project URL
and **anon** key. Adjust the waters and seasonal `nightly` rates to Simon's real prices.

### 3. Stripe (the deposits)
1. Create a Stripe account (or use the existing Barham one) → switch on **Test mode** first.
2. **Developers → API keys** → copy the **Secret key** (`sk_test_…`).
3. After the site is deployed (step 5), add a webhook: **Developers → Webhooks → Add endpoint**
   → URL `https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook`
   → event `checkout.session.completed` → copy the **Signing secret** (`whsec_…`).

### 4. Deploy to Netlify (GitHub)
1. Put this whole folder in a GitHub repo, push to `main`.
2. In Netlify → **Add new site → Import from GitHub** → pick the repo.
3. In **Site configuration → Environment variables**, add:

```
SUPABASE_URL                = https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY   = (the service_role key)
STRIPE_SECRET_KEY           = sk_test_...
STRIPE_WEBHOOK_SECRET       = whsec_...        (add after step 3)
SITE_URL                    = https://YOUR-SITE.netlify.app
```

4. Deploy. (Netlify installs the npm packages and builds the functions automatically.)

### 5. Make yourself / Simon the admin
1. Go to `account.html` on the live site → **Create account** with the owner's email → verify the email.
2. Back in Supabase **SQL Editor**, run (using that email):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'owner@thebarhamlakes.co.uk');
```

3. Now `admin-bookings.html` will let that account in. **It's `noindex` and not linked from the public site** — share the URL only with the owner.

### 6. Test end-to-end
- Book a stay as a normal user → pay the deposit with Stripe test card `4242 4242 4242 4242`, any future date, any CVC.
- The booking flips to **confirmed / deposit paid**, shows in **My Account**, and appears in the **admin dashboard**.
- In admin, add a **blackout** range and confirm those nights grey out on `bookings.html`.

### Going live
Swap Stripe to **live mode** (new `sk_live_…` key + a live webhook secret), update the two
Netlify env vars, redeploy. Point `thebarhamlakes.co.uk` at the Netlify site when ready.

---

## How it works (quick tour)
- The browser talks to Supabase directly with the **anon** key. **Row Level Security** means a
  visitor can only ever read the no-personal-data `public_bookings` view and their own bookings;
  only an **admin** can see everyone's bookings or edit them. (Same model as the FC site.)
- Deposits never touch the browser's trust: `create-checkout` re-reads the real price from the
  database, so the amount can't be tampered with.
- **Blackout dates** live in `blocked_dates` and feed the same availability view, so blocking a
  water instantly removes those nights from the public calendar.

## Notes / next steps
- Prices in `booking-config.js` are **placeholders** — set Simon's real seasonal rates.
- Confirmation emails: the booking already posts to a Netlify Form (`booking-request`) so the
  owner gets notified. For branded guest emails, add a Resend/Postmark step in the webhook later.
- This is a working foundation; syndicate applications/renewals can reuse the same auth + tables.
