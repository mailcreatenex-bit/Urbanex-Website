# Urbanex Realty

Light-luxury real estate site and admin CRM for Urbanex Realty (Burdwan, WB).

- `backend/` FastAPI + MongoDB (Motor). Copy `.env.example` to `.env`.
- `frontend/` React (CRA/Craco) + Tailwind + shadcn/ui. Copy `.env.example` to `.env`.

## Run
    cd backend && pip install -r requirements-dev.txt && uvicorn server:app --reload --port 8001
    cd frontend && yarn install && yarn start

## Tests
Run the API tests against a running backend:

    TEST_ADMIN_TOKEN=<session token of an admin user> REACT_APP_BACKEND_URL=http://localhost:8001 pytest backend/tests

Create the admin session yourself in your own dev database; never commit tokens.

## Security notes
- Secrets live only in `.env` files (git-ignored). Rotate any key that was ever committed.
- Property prices are withheld by the API until the user is signed in.
- `CORS_ORIGINS` must list explicit origins; the rate limiter is in-process (per worker).

## Features
- **Property CMS** (Admin > Properties): add/edit/delete listings, upload photos (stored in `backend/uploads`, set `UPLOAD_DIR` to a persistent volume in production), set RERA no., verified badge, document checklist, map pin.
- **Search**: text, zone, type, BHK, area, status, possession, furnishing, price (signed-in only), sorting, map view with "search this area", saved searches with new-match alerts.
- **Alerts**: leads, visit bookings and new reviews appear in the CRM bell (plus desktop notifications). Optional email (SMTP) and webhook (Slack/Discord/Zapier/WhatsApp gateway); see `backend/.env.example`.
- **Site visits**: public booking in IST, double-booking protected, admin confirm/cancel/complete, 24h and 1h reminders.
- **Calculators**: EMI, buying costs (stamp duty/registration are editable estimates), rental yield.
- **Shortlist, compare (up to 3), share** (WhatsApp link previews via `/api/share/...`, PDF brochure).
- **Reviews** (signed-in users, admin-moderated) and **Guides/blog** (admin-written area guides).
- **Fake-entry protection** on every public form: Indian mobile format check (10 digits starting 6-9, obvious dummies like 9999999999 or 9876543210 rejected; numbers are stored as +91XXXXXXXXXX), optional Cloudflare Turnstile bot check, and warning flags (not blocks) when one device uses 3+ numbers, one number comes from 3+ devices, or one network uses 5+ numbers; 8+ different numbers from one device in a day is refused. Flags show as "check" badges in Admin > Leads and Admin > Interested.
- **YouTube auto-sync + video catalogue** (`/videos`): every upload on the channel (including the whole back catalogue) is pulled in automatically (new uploads within ~10 minutes; set `YOUTUBE_API_KEY`, `YOUTUBE_HANDLE`, optional `YOUTUBE_SYNC_MINUTES`). Location, type, bedrooms, area and price are read from the title/description and can be corrected in Admin > Videos (edits are kept). Visitors filter by location, type, BHK and budget band.
- **"Interested" price gate** (videos and properties): prices are never in public API responses. Pressing Interested asks for name + phone once (remembered in a cookie and on the Google account), then unlocks that listing's price; later presses are one click. Admin > Interested shows who is interested in what (with CSV export); each person also becomes one CRM lead with a note per interest.
- **Find-your-zone quiz** (`/zone-quiz`): 8 questions rank 3 zones with reasons computed from our listings and straight-line landmark distances; shareable result links; a lead form sends the answers to the CRM.
- **Weekly digest**: double-opt-in email (optional WhatsApp via `DIGEST_WEBHOOK_URL`), new matching listings + data-derived market snapshot + Ayan's note + latest video; manage in Admin > Digest.
- **Wishlist alerts**: hearts sync to the account when signed in; price drops and sold/available changes notify watchers (bell + email).
- **AI assistant**: chat widget grounded in live listings (prices only for signed-in users), keyword fallback if the AI service is down, WhatsApp hand-off.
- **NRI desk** (`/nri`): video-call booking in the visitor's time zone, live INR conversion (ECB rates), site-update videos (Admin > Guides, category "site-update"), general POA/remittance guide.
- **SEO/i18n**: per-page meta + JSON-LD, `/api/sitemap.xml`, lazy-loaded admin bundle, English/Bengali toggle.

## Before launch
- Set `PUBLIC_SITE_URL`, `CORS_ORIGINS`, and the domain in `frontend/public/robots.txt`.
- Fix each property's map pin (seeded pins are zone-approximate; nearby distances use indicative landmark coordinates in `backend/server.py`).
- Have a Bengali speaker review `frontend/src/i18n/bn.js`.
- Run `yarn install` in `frontend/` to refresh `yarn.lock` (adds `leaflet`).
