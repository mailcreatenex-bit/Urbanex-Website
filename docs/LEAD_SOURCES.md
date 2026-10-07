# Getting leads from everywhere into the CRM

Every enquiry, from any source, goes through one door in the server. It cleans the phone number,
joins an existing lead if the same person writes again, scores spam, detects Bengali / Hindi / English,
notifies you, and starts the follow-up sequence. Nothing below is required: each source switches on
when its settings are filled in `backend/.env`. **Check the Inbox tab in the CRM**: it shows which
sources are connected and the last things that arrived.

| Source | What you need | Works without an account? |
|---|---|---|
| Website forms, visit bookings | nothing | yes |
| Missed calls | a phone system that can call a webhook | no |
| 99acres, MagicBricks, Housing e-mails | a mailbox + `INBOX_SECRET` or `IMAP_*` | no |
| Facebook / Instagram lead forms | a Meta app + `META_*` | no |
| WhatsApp chats and automatic sending | WhatsApp Business Cloud API + `WHATSAPP_*` | no |
| Business cards, handwritten notes, phone contacts | nothing (uses Gemini) | yes |
| Call recordings | see `docs/CALL_RECORDING.md` | no |

Without the WhatsApp Cloud API the CRM still prepares every message (follow-ups, wishes, reminders,
daily digest) and puts it in **Messages**. You tap *Send* and WhatsApp opens with the text ready.

## Portal e-mails (99acres, MagicBricks, Housing)

Option A, the server reads the mailbox: set `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD` (a Gmail
"app password") and optionally `IMAP_FOLDER`. Create a Gmail filter that labels portal mails and
use that label as the folder. It is read every two minutes.

Option B, you forward mail: send the mail body as JSON to `POST /api/inbox/email` with the header
`X-Inbox-Key: <INBOX_SECRET>`: `{"from": "...", "subject": "...", "text": "..."}`.
Any automation tool (Zapier, Make, Apps Script) can do this.

The server first tries fixed patterns for each portal, then asks Gemini if they do not match.

## Facebook and Instagram lead forms

1. Create a Meta app, add the *Webhooks* product, and subscribe the Page to `leadgen`.
2. Callback URL: `https://YOUR-SITE/api/inbox/meta`. Verify token: your `META_VERIFY_TOKEN`.
3. Put the app secret in `META_APP_SECRET` (signatures are checked) and a Page access token with
   `leads_retrieval` in `META_PAGE_TOKEN`.

## WhatsApp Business Cloud API

1. In Meta for Developers create a WhatsApp app and add your business number.
2. Webhook callback `https://YOUR-SITE/api/inbox/whatsapp`, verify token `WHATSAPP_VERIFY_TOKEN`,
   app secret `WHATSAPP_APP_SECRET`.
3. `WHATSAPP_TOKEN` (permanent token) and `WHATSAPP_PHONE_ID` allow the server to send.
   Messages sent outside the 24 hour chat window must be approved templates; until you have those,
   keep the modes in **Automation** on "ask me first".
4. A customer who writes *STOP* is never messaged again by the automation.

Sending stays quiet between 21:00 and 08:00 IST, and nobody gets two automatic messages in a row.

## Missed calls

Point your phone system (Exotel, Knowlarity, MyOperator, a Tasker rule on your phone...) at
`POST /api/calls/missed` with the header `X-Webhook-Key: <CALL_WEBHOOK_SECRET>` and
`{"from": "98300 11223", "at": "2026-10-07T10:15:00+05:30"}`. The caller becomes a lead with a task
to call back in 10 minutes, and you are told straight away.

## Phone contacts and business cards

In the CRM choose **Add with AI**, then *Phone contacts* (Chrome on Android lets you pick people;
anywhere else upload a `.vcf` file) or *Business card* (photo). Add where you met them, for example
"Kolkata property fair": it becomes a tag, so a message can be worded for that context.

## What is not possible from a website

* Hearing a call while it is happening. The CRM gives a short brief **before** you call (what they
  want, what was said last, what to avoid) and scores the call afterwards.
* Reading your phone's call log or contacts silently. The browser only allows what you choose to share.
