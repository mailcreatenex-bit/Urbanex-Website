# Urbanex Realty — PRD

## Original problem statement
Continuation plan: light-luxury real estate site for Urbanex Realty (Burdwan, WB), founded by Ayan Dey. Home / Properties / Construction / About / Contact / Terms / Privacy + protected Admin CRM. Emergent Google Auth gates "See Price". Lead capture, kanban CRM, Recharts reports, jsPDF invoices, YouTube auto-sync of `@urbanexbyayandey`, Whisper voice notes, semantic lead search, 19-zone Burdwan marquee, testimonials, video showcase, floating WhatsApp, Cre8nex footer credit.

## Architecture
- **Frontend:** React 19 + CRA/Craco, Tailwind + shadcn/ui, framer-motion, Recharts, jsPDF, react-fast-marquee.
- **Backend:** FastAPI + Motor (async Mongo). Endpoints under `/api`.
- **DB:** MongoDB. Collections: `properties`, `leads`, `users`, `user_sessions`, `invoices`, `videos_cache`.
- **Integrations:** Emergent Google Auth (session_id ➜ backend exchange ➜ 7-day httpOnly cookie). Emergent LLM Key (`sk-emergent-885Ac7804EdC2EdA17`) for OpenAI Whisper + semantic search via emergentintegrations. YouTube Data API v3 (key in env).

## Core requirements (static)
- 12 seeded Burdwan properties (auto-seeded on startup).
- 19-zone Burdwan marquee (Kalibazar, Renaissance Township, Borehat, Goda, Nawabhat, Ullas, Bajepratappur, Khosbagan, Parbirhata, Alisha, Baburbag, Rajbati, Sripally, Radhanagar, Bahir Sarbamangala, Curzon Gate, Tinkonia, Golapbag, Nutanganj).
- Price gate: unauthenticated users see blurred price + "Sign in to see price" ➜ Google OAuth ➜ real price revealed.
- Every gated action & every form submission creates a `leads` document.
- Admin allow-list via `ADMIN_EMAILS` env; non-admins never see `/admin/*`.
- Invoices: no GST, Urbanex-branded PDF (navy + gold), stored in DB, re-downloadable.
- Videos: 6-hour Mongo cache from YouTube Data API v3, graceful fallback list if key missing.

## User personas
1. **Ayan (Admin)** — sole operator. Needs a mobile-first CRM: pipeline kanban, voice notes, invoice PDF in one click, CSV export.
2. **Local Burdwan buyer** — cost-sensitive, prefers WhatsApp. Needs friction-free price reveal + direct-to-founder contact.
3. **NRI investor** — video-first browser. Needs high-fidelity walkthroughs, testimonials, transparent construction service.

## Implemented (2026-02-15)
- Home page with scroll-parallax video hero, promo band, zones marquee, 6 featured properties, video showcase (real YouTube), testimonials slider, construction CTA.
- Properties list w/ zone + type filters, price gate, detail page.
- About page: founder journey (hilltop portrait), leadership card (blazer), manifesto.
- Contact page: form + founder side card (office portrait) + direct-WhatsApp CTA.
- Construction page: scroll-video hero, 4 highlights, 5-stage vertical timeline, estimate form.
- Terms + Privacy legal pages.
- Emergent Google Auth: LoginModal, AuthCallback (URL fragment), 7-day cookie session, admin whitelist.
- Admin CRM at `/admin`: leads table, kanban statuses, notes, Whisper voice notes, semantic search (Emergent LLM), CSV export, Recharts reports (4 charts), jsPDF branded invoice generator.
- YouTube Data API v3 sync with 6-hour cache — currently pulling 12 real videos from `@urbanexbyayandey`.
- Cre8nex footer credit + floating WhatsApp button.

## Backlog / P1 (post-review)
- Photo swap: replace stock founder portraits with the 4 actual Ayan Dey photos once received.
- Property image regeneration via Gemini Nano Banana for locale authenticity.
- Cre8nex logo PNG upgrade in footer.
- Property CMS: admin CRUD for properties + upload via object storage.
- Email notifications to admin on new lead (Resend/SES).
- WhatsApp Business API for automated lead follow-ups.

## Backlog / P2
- SEO metadata + sitemap.xml.
- PWA install prompt.
- Multi-lingual UI (Bengali).
- Payments (Razorpay for booking token amounts).

## Tech notes
- Frontend uses `withCredentials: true` axios so session cookie flows on same-origin.
- `AuthProvider` skips `/auth/me` when `session_id` is present in the hash — prevents race with AuthCallback.
- `LoginModal` uses `window.location.origin + "/"` as redirect (no hardcoding).
