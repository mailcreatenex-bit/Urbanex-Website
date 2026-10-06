# Urbanex Android app (Capacitor wrapper)

The app is this same React site packaged for Android. Inside the app the site detects `window.Capacitor` and unlocks the tools
that cannot run on a plain website (see `frontend/src/lib/appShell.js`).

**Status: scaffold only.** It has not been built or tested here (no Java or Android SDK on this machine), and it is not on the Play Store.

## What you need
- Node 18+, JDK 17 and Android Studio (with an Android SDK) on your own computer
- A Google Play Console account (one-time fee) to publish

## Build
```bash
cd mobile
npm install
cd ../frontend && yarn build && cd ../mobile      # builds the site into frontend/build
npx cap add android                              # first time only
npx cap sync android
npx cap open android                             # Android Studio: Build > Generate Signed Bundle / APK
```

## Before you ship
1. In `backend/.env` add the app origins to `CORS_ORIGINS`: `https://localhost,capacitor://localhost` (the app serves pages from there).
2. Set `REACT_APP_BACKEND_URL` to your live API before building the site.
3. After the app is on the Play Store, set `REACT_APP_ANDROID_APP_URL` (the Play link) in the frontend `.env` and rebuild the website. The "use the app" pop-up then shows the Download button.

## Banglar Bhumi inside the app
The official portal sends `X-Frame-Options: SAMEORIGIN`, so it can only be shown as a full page, not inside another page. In the app the
search button opens it in the system browser sheet. A deeper integration (auto-filling the district, mouza and plot into the official form
inside an in-app browser) needs an in-app-browser plugin that can run a script on the page, plus a look at the live form. It also needs the
visitor to sign in to the portal with their own mobile number (the portal requires it for Know Your Property), which the app must never read or store.
