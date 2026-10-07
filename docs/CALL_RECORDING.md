# Recording business calls into the CRM

The CRM can listen to your call recordings with AI and add the customer, what they want and a follow-up. It can receive
recordings three ways. **Recording the call itself needs a phone service or app; the website cannot do that part.**

| Way | You need | What happens |
|---|---|---|
| **A. Upload by hand** | nothing | CRM → AI add → Call recordings. Choose files; the number is read from the file name, the form, or the call itself. |
| **B. Google Drive folder** | a recorder that saves to Drive, plus a Google service account (below) | New audio files in your folder are picked up every 10 minutes. |
| **C. Phone-system webhook** | a cloud telephony number (Exotel, MyOperator, Knowlarity, Ozonetel, Twilio ...) | The phone system posts each recording to the site as soon as it is ready. |

## Before you record anyone
Tell callers. In India you should say "this call may be recorded" (most cloud telephony numbers can play this automatically). Keep the
recordings private. The CRM keeps a summary and a transcript of **business** calls only; calls the AI decides are personal are not kept.

## How the recording gets to Drive (pick one)
* **Cloud telephony number** (best for a "business number"): the service records every call on its servers. Use C (webhook), or have the
  service or a Zapier/Make flow copy recordings into a Drive folder and use B.
* **Your own Android phone**: a call-recorder app that uploads to Google Drive. Newer Android versions limit call recording and many apps
  cannot record the other person's voice, so test a real call first. File names should include the number (most apps do).

## B. Connect Google Drive (one time, about 10 minutes)
1. Google Cloud console → create a project → enable the **Google Drive API**.
2. IAM → Service accounts → create one → Keys → add key → JSON. Keep the file private.
3. In Google Drive create a folder (e.g. "Call recordings") and **share it with the service account's e-mail address as Viewer**.
4. Open the folder: the long text at the end of its address is the folder id.
5. In `backend/.env` set `DRIVE_CALLS_FOLDER_ID=<folder id>` and either `GOOGLE_SERVICE_ACCOUNT_JSON_FILE=/path/to/key.json`
   (preferred) or `GOOGLE_SERVICE_ACCOUNT_JSON='{...}'`. Restart the backend.
6. CRM → Calls shows "Drive connected". Press "Check Drive now" to try it.

Formats: MP3, M4A, WAV, OGG, FLAC, AAC. **AMR is not supported** (convert it). Files over 14 MB (about 15 minutes of MP3) are skipped; send a shorter or compressed copy.

## C. Phone-system webhook
Set `CALL_WEBHOOK_SECRET=<a long random string>` in `backend/.env`. Point the service's "recording ready" callback to
`POST https://<your-site>/api/calls/webhook` with header `X-Webhook-Key: <that string>` and JSON:

```json
{"call_id": "unique id", "from": "+919830012345", "to": "+919933333333", "direction": "incoming",
 "recording_url": "https://...", "duration": 95, "started_at": "2026-10-07T10:15:00+05:30", "contact_name": "optional"}
```
The recording link must be a public https address. Duplicates (same `call_id`) are ignored.

## What the AI puts in the CRM
* Customer name and number (from the phone system or file name first, then from what is said in the call).
* What they want: BHK, type, area, budget, sale or rent.
* A short summary, things you promised, a follow-up date, and the transcript (open it from CRM → Calls).
* The lead is created, or the call is added to the lead that already has that number.

AI can mishear names and numbers, especially on poor lines. Check the details before you rely on them.
