# Urbanex Call Sync: your own phone app for call recordings

A small Android app for **your phone only**. It does not record calls itself (Android does not let ordinary apps do that well).
Your phone's own call recorder saves each call to a folder; this app watches that folder and sends every new recording to the
Urbanex CRM, where the AI listens to it, adds the customer and what they want, and sets a follow-up. No Google Drive is needed.

```
Phone's call recorder  ->  recordings folder  ->  Urbanex Call Sync  ->  your server  ->  AI  ->  CRM > Calls
```

## What is in the app
Three tabs at the bottom:
* **Leads**: your real CRM (leads, inbox, plan, insights...) inside the app. Pull down to refresh.
* **Website**: the website admin (properties, videos, owner listings, land reports, team...), also inside the app.
* **Calls**: the call-recording setup (3 easy steps), below.

**Signing in:** press "Sign in with Google" in the app. It opens your phone's browser (Google does not allow sign-in inside an app), you sign in as
an admin, and it brings you straight back to the app with the CRM open. No password or key is stored on the phone. The sign-in lasts 30 days.
"Sign out of the CRM" is on the Calls tab.

## 1. Turn on your phone's recorder
Use the recorder that came with the phone. Names differ:
* **Google Phone app:** Settings > Call recording > choose "Always record" for the numbers you want (it plays a notice to the caller).
* **Samsung:** Phone > Settings > Record calls > Auto record calls.
* **Xiaomi, Realme, Oppo, Vivo:** Phone > Settings > Call recording > Automatically record.
Phones sold without a recorder need a cloud business number instead (see `CALL_RECORDING.md`). Choose **m4a or mp3** format if the
recorder offers a choice. **AMR files are not supported** and are skipped.

**It must record every call by itself.** Switch the recorder to automatic ("Always record" / "Auto record all calls"). No app can press Record for
you on a modern Android phone: only the phone's own recorder is allowed to capture both sides of a call, so it is that recorder you set to automatic.

Tell callers that calls may be recorded.

## 2. Make the key
The app proves it is yours with a long secret. Make one (for example 40 random letters and numbers, from a password manager) and set it
on the server as `CALL_WEBHOOK_SECRET` (Render > urbanex-api > Environment). Keep it private. The same secret is used by phone-system
webhooks.

## 3. Get the app (no Android Studio needed)
1. On your phone open `https://github.com/mailcreatenex-bit/Urbanex-Website/releases/tag/latest-apk` (no GitHub login needed) and download **UrbanexCRM.apk**.
2. Open the downloaded file. Android asks to allow installing from that source (your browser or file manager): allow it. If Play Protect warns that
   the app is unknown, choose "Install anyway". It is your own build.

## 4. Set it up (once)
1. **Server address:** `https://urbanex-realty.netlify.app`.
2. **Key:** the secret from step 2.
3. **Choose the recordings folder:** pick the folder where your recorder saves files (often `Recordings`, `Recordings/Call`,
   `MIUI/sound_recorder/call_rec`, `Music/Recordings/Call`). Android asks you to allow access to that one folder only.
4. **Choose the business SIM** (needs the call-log and phone permissions). Only calls on that SIM are sent, so personal calls on your other SIM never leave the
   phone. The app finds each recording's call in the phone's call log, and also takes the exact number and direction from it. If it cannot match
   calls on your phone model, choose "All calls on this phone": the AI still ignores calls that are not about property.
   On Android 13 or newer, if the call-log permission is greyed out: Settings > Apps > UrbanexCRM > the three dots at the top right > **Allow restricted settings**, then try again.
5. **Save and start.** Allow the contacts permission (it is only used to find a customer's number when the file is named after them).
6. Press **Allow it to work in the background** and set the app to "Unrestricted"/"Don't optimise". Phones that stop background apps
   (Xiaomi, Oppo, Vivo, Realme) also need "Autostart" on for the app.

New recordings are then sent about every 15 minutes, and the **Send new recordings now** button does it at once. Only recordings made
after you press "Save and start" are sent.

## Which recordings reach the CRM
Every recording that is sent is listened to by the AI. Only calls about **property, land, construction, rent, loans or visits** become leads. Any
other call is thrown away: nothing from it is kept. Choosing the business SIM stops personal calls from being sent at all.

## Google Drive: not needed
This app sends straight to your server, so there is no Drive folder to set up. A Drive folder is only for the other route (a sync app
that copies recordings to Drive). In that case, put the folder id in `DRIVE_CALLS_FOLDER_ID` and the service account key in
`GOOGLE_SERVICE_ACCOUNT_JSON` in the Render settings (see `CALL_RECORDING.md`, section B).

## What to expect
* The first request after a quiet spell can take a minute (the free server wakes up). The app waits.
* A recording appears in the CRM **Calls** tab a minute or two after it is sent. Calls the AI judges personal are not kept.
* The same file is never processed twice.
* Files over 14 MB (about 15 minutes) are skipped.
* If the file name has no number, the app looks the name up in your contacts; otherwise the AI tries to pick the number from the call.

## If something does not work
* **"The server refused the key"**: the key in the app differs from `CALL_WEBHOOK_SECRET` on the server.
* **Nothing is sent**: open the recordings folder in a file manager and check that files really appear there after a call. Some phones
  record only to a hidden location; in that case use a cloud number.
* **Only your voice is on the recording**: that is a limit of the phone's recorder, not of this app. Try the Google Phone app's recorder.
* **Stops after a few days**: the phone is stopping the app in the background; check the battery settings in step 4.5.
