# Host Urbanex for free

Four free services, about 30 minutes, no card needed for any of them.

| Part | Service | Free plan |
|---|---|---|
| Website (the pages) | **Netlify** | Free, commercial use allowed |
| Server (the API) | **Render** | Free web service, sleeps when idle |
| Database | **MongoDB Atlas** | M0, 512 MB, free forever |
| Keeps the server awake | **UptimeRobot** | Free, pings every 5 minutes |

The code is already prepared: `netlify.toml` and `render.yaml` are in the repository root.
The site and the API share one address (Netlify forwards `/api/*` to Render), so Google sign-in cookies work in every browser.

## 1. The database (MongoDB Atlas)

1. Sign up at mongodb.com/atlas, create a **free M0 cluster** (Mumbai or Singapore region is closest).
2. **Database Access**: add a user with a password (write the password down).
3. **Network Access**: add `0.0.0.0/0` (Render's address changes, so it must be open; the password protects it).
4. **Connect > Drivers**: copy the connection string (it starts with `mongodb+srv://` and has `@cluster0` in the middle) and replace the `<password>` part with the password from step 2.

## 2. The server (Render)

1. Sign up at render.com with your GitHub account and allow it to see the `Urbanex-Website` repository.
2. **New > Blueprint**, choose the repository. Render reads `render.yaml` and creates `urbanex-api`.
3. It asks for the values below. Fill them in (you can change them later under *Environment*):

| Name | Value |
|---|---|
| `MONGO_URL` | the Atlas string from step 1 |
| `CORS_ORIGINS`, `PUBLIC_SITE_URL`, `PUBLIC_API_URL` | your site address from step 3, e.g. `https://urbanex.netlify.app` (no slash at the end). Put a temporary value first, then fix it after step 3 |
| `ADMIN_EMAILS` | your Google e-mail(s), comma separated. These people become admin |
| `GEMINI_API_KEY` | your Gemini key (the AI features) |
| `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID` | your YouTube key and channel id (the video tours) |
| `WHATSAPP_NUMBER` | your number, digits only with country code, e.g. `919830012345` |

4. Wait for the first deploy (about 5 minutes). Your server address is shown at the top, like `https://urbanex-api.onrender.com`.
   Open `https://urbanex-api.onrender.com/api/` and you should see `{"service":"Urbanex Realty API","status":"ok"}`.

If the address is different from `urbanex-api.onrender.com`, edit the `to = ...` line in `netlify.toml`, commit and push.

## 3. The website (Netlify)

1. Sign up at netlify.com with GitHub. **Add new site > Import an existing project > GitHub >** `Urbanex-Website`.
2. Netlify reads `netlify.toml`, so leave the build settings as they are. Choose the **`main`** branch and deploy.
3. You get an address like `https://something.netlify.app`. Under **Site configuration > Change site name** you can make it `urbanex`.
4. Go back to Render and set `CORS_ORIGINS`, `PUBLIC_SITE_URL` and `PUBLIC_API_URL` to this address, then save (it redeploys).
5. Optional: add your own domain under **Domain management** (the domain costs money, the hosting does not).

## 4. Keep the server awake (UptimeRobot)

Without this, the first visitor after 15 quiet minutes waits about a minute while Render wakes up, and the automatic jobs
(lead follow-ups, video sync, reminders) pause while it sleeps.

1. Sign up at uptimerobot.com (free).
2. **Add new monitor**: type *HTTP(s)*, URL `https://YOUR-SITE.netlify.app/api/`, interval **5 minutes**.

One always-on service uses about 744 of Render's 750 free hours a month, so this fits.

## 5. Check it works

* The home page loads and the video tours appear (the first sync takes a few minutes).
* Sign in with Google using an address from `ADMIN_EMAILS`: the CRM button appears in the header.
* Add a property in Admin and open it on your phone.

## What the free plan cannot do

* **Speed:** the free server is small, so AI answers and big pages are slower than on a paid server.
* **Photos and documents:** uploads are saved in the database as well as on disk, so they survive restarts. The 512 MB database fills up
  with roughly 150 to 250 photos; check Atlas under *Metrics* now and then.
* **Old chat assistant and voice-note transcription** need an extra package that is too big for the free server
  (`backend/requirements-emergent.txt`). They fall back to simple modes. All Gemini features work.
* **Sleep:** if UptimeRobot is paused, the site is slow for the first visitor.
* **Free tiers can change.** When the business grows, Render's cheapest paid plan (about $7 a month) removes the sleeping and the memory limit.

## Costs later

Nothing here charges you automatically: Render, Netlify, Atlas M0 and UptimeRobot only bill if you choose a paid plan.
