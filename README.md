# The Barham Lakes

Website + booking platform for The Barham Lakes — exclusive lodge/lake bookings
and syndicate membership. Static front-end, **Supabase** (Postgres + Auth),
**Netlify Functions** and **Stripe**. Built by AJH Technology.

## Live site
Deployed on Netlify → auto-deploys on every push to `main`.

## What's here
| Path | Purpose |
|------|---------|
| `index.html` | Homepage |
| `bookings.html` | Public booking page (night calendar, seasonal pricing, deposits) |
| `syndicate.html` | Apply & pay for syndicate membership |
| `account.html` | Sign in / create account + "my stays" |
| `admin-bookings.html` | Owner dashboard — bookings, syndicate, blackout dates (admin-only) |
| `booking-config.js` | Supabase keys, waters, seasonal rates, ticket prices |
| `schema.sql`, `schema-syndicate.sql` | Database tables + row-level security |
| `netlify/functions/` | Stripe checkout + webhook |
| `SETUP.md` | **Full step-by-step setup — read this first** |

## Deploy / update
1. First-time setup: follow **`SETUP.md`** (Supabase project, config keys, Stripe, Netlify env vars, make admin).
2. After that, **just `git push`** — Netlify rebuilds and redeploys automatically. No manual uploads.

## Environment variables (set in Netlify → Site configuration → Environment variables)
See `.env.example`. Real keys live only in Netlify, never in the repo.

## Quick local preview
Open the `.html` files in a browser to see the design. Live data and payments only
work once the site is deployed with the environment variables set.

---
© The Barham Lakes. Built and maintained by AJH Technology · ajhtechnology.digital
