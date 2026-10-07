"""CRM deals: a link for a lead to pick their own visit time, a calendar feed for your phone, WhatsApp visit reminders,
the document checklist for each deal, and bank / loan-agent hand-off with your commission tracked.
"""
import asyncio
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request, Response
from pydantic import BaseModel, Field

import server as S
import crm_auto

IST = ZoneInfo("Asia/Kolkata")


# ---------------------------------------------------------------- "pick your own visit time" link
class VisitLinkIn(BaseModel):
    property_id: Optional[str] = Field(default=None, max_length=100)
    mode: Literal["onsite", "video"] = "onsite"


@S.api.post("/admin/leads/{lid}/visit-link")
async def make_visit_link(lid: str, payload: VisitLinkIn, request: Request):
    await S.require_admin(request)
    lead = await S.db.leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    prop = None
    if payload.property_id:
        prop = await S.find_property(payload.property_id)
        if not prop:
            raise HTTPException(404, "Property not found")
    if payload.mode == "onsite" and not prop:
        raise HTTPException(422, "Choose the property they will visit")
    if payload.mode == "video" and not lead.get("email"):
        raise HTTPException(422, "A video call needs the customer's e-mail address")
    token = secrets.token_urlsafe(14)
    await S.db.visit_links.insert_one({"token": token, "lead_id": lid, "property_id": prop["id"] if prop else None, "mode": payload.mode, "used": False,
                                       "expires_at": (S.now_utc() + timedelta(days=14)).isoformat(), "created_at": S.now_utc().isoformat()})
    link = f"{S.PUBLIC_SITE_URL}/book-visit/{token}"
    title = prop["title"] if prop else "a video call"
    first = (lead.get("name") or "").split(" ")[0] or "there"
    text = f"Hi {first}, you can pick a time for {title} here, whichever suits you best: {link} - Ayan, Urbanex Realty"
    await S.db.leads.update_one({"id": lid}, {"$push": {"activities": S.stamp_activity("visit_link", f"Sent a link to book {title}")}})
    return {"link": link, "text": text}


async def link_or_404(token: str) -> dict:
    row = await S.db.visit_links.find_one({"token": token}, {"_id": 0})
    if not row or S.parse_dt(row["expires_at"]) < S.now_utc():
        raise HTTPException(404, "This link has expired. Ask Ayan for a new one.")
    return row


@S.api.get("/visit-links/{token}")
async def visit_link_info(token: str):
    row = await link_or_404(token)
    lead = await S.db.leads.find_one({"id": row["lead_id"]}, {"_id": 0, "name": 1})
    prop = await S.find_property(row["property_id"]) if row.get("property_id") else None
    return {"name": (lead or {}).get("name"), "mode": row["mode"], "used": row["used"], "property": {"id": prop["id"], "title": prop["title"], "zone": prop.get("zone")} if prop else None}


class VisitLinkBook(BaseModel):
    slot: datetime


@S.api.post("/visit-links/{token}/book")
async def visit_link_book(token: str, payload: VisitLinkBook, request: Request):
    S.rate_limit(request, "visit_link", 10)
    row = await link_or_404(token)
    if row["used"]:
        raise HTTPException(409, "This link was already used. Ask Ayan if you need to change the time.")
    err = S.slot_error(payload.slot, row["mode"])
    if err:
        raise HTTPException(422, err)
    lead = await S.db.leads.find_one({"id": row["lead_id"]}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    prop = await S.find_property(row["property_id"]) if row.get("property_id") else None
    if row.get("property_id") and (not prop or prop.get("status") == "sold"):
        raise HTTPException(409, "This property is no longer available")
    key = S.slot_str(payload.slot)
    if await S.db.visits.find_one({"slot": key, "status": {"$in": ["pending", "confirmed"]}}, {"_id": 1}):
        raise HTTPException(409, "That time was just taken, please pick another")
    title = prop["title"] if prop else "Video consultation"
    visit = {"id": S.new_id("visit_"), "property_id": prop["id"] if prop else None, "property_title": title, "name": lead["name"], "phone": lead.get("phone"), "email": lead.get("email"),
             "note": "Booked from the link Ayan sent", "mode": row["mode"], "tz": "Asia/Kolkata", "meeting_url": None, "slot": key, "status": "confirmed", "lead_id": lead["id"],
             "reminded_24h": False, "reminded_1h": False, "created_at": S.now_utc().isoformat()}
    try:
        await S.db.visits.insert_one(dict(visit))
    except S.DuplicateKeyError:
        raise HTTPException(409, "That time was just taken, please pick another")
    await S.db.visit_links.update_one({"token": token}, {"$set": {"used": True, "visit_id": visit["id"]}})
    when = S.when_text(payload.slot)
    sets: dict = {"updated_at": S.now_utc().isoformat()}
    if lead.get("status") in ("new", "contacted"):
        sets["status"] = "site_visit"
    await S.db.leads.update_one({"id": lead["id"]}, {"$set": sets, "$push": {"activities": S.stamp_activity("visit", f"Booked {title} for {when}", by="customer")}})
    await S.notify_admin("visit", f"{lead['name']} picked a time: {when}", f"{title} · {lead.get('phone') or ''}", link="/admin/visits")
    return {"ok": True, "when": when, "title": title}


# ---------------------------------------------------------------- calendar feed (subscribe in Google Calendar or Apple Calendar)
async def calendar_token(create: bool = True) -> Optional[str]:
    doc = await S.db.settings.find_one({"_id": "calendar"}, {"_id": 0}) or {}
    if doc.get("token") or not create:
        return doc.get("token")
    tok = secrets.token_urlsafe(24)
    await S.db.settings.update_one({"_id": "calendar"}, {"$set": {"token": tok}}, upsert=True)
    return tok


@S.api.get("/admin/crm/calendar")
async def calendar_link(request: Request):
    await S.require_admin(request)
    tok = await calendar_token()
    return {"url": f"{S.PUBLIC_SITE_URL}/api/calendar/{tok}.ics"}


def ics_escape(t: str) -> str:
    return (t or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def ics_fold(line: str) -> str:
    out, b = [], line.encode()
    while len(b) > 74:
        cut = 74
        while cut > 0 and (b[cut] & 0xC0) == 0x80:
            cut -= 1
        out.append(b[:cut].decode())
        b = b[cut:]
        b = b" " + b
    out.append(b.decode())
    return "\r\n".join(out)


@S.api.get("/calendar/{token}.ics")
async def calendar_feed(token: str):
    good = await calendar_token(create=False)
    if not good or not secrets.compare_digest(token.encode(), good.encode()):
        raise HTTPException(404, "Not found")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Urbanex Realty//Visits//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Urbanex visits", "X-WR-TIMEZONE:Asia/Kolkata"]
    since = (S.now_utc() - timedelta(days=7)).isoformat()
    async for v in S.db.visits.find({"status": {"$in": ["pending", "confirmed", "completed"]}, "slot": {"$gte": since}}, {"_id": 0}).sort("slot", 1):
        start = S.parse_dt(v["slot"]).astimezone(timezone.utc)
        end = start + timedelta(hours=1)
        desc = f"{v.get('name')} {v.get('phone') or ''}\n" + (f"Join: {v['meeting_url']}\n" if v.get("meeting_url") else "") + (v.get("note") or "")
        lines += ["BEGIN:VEVENT", f"UID:{v['id']}@urbanex", f"DTSTAMP:{S.now_utc().strftime('%Y%m%dT%H%M%SZ')}", f"DTSTART:{start.strftime('%Y%m%dT%H%M%SZ')}", f"DTEND:{end.strftime('%Y%m%dT%H%M%SZ')}",
                  ics_fold(f"SUMMARY:{ics_escape(('Video call: ' if v.get('mode') == 'video' else 'Visit: ') + str(v.get('name')) + ' - ' + str(v.get('property_title')))}"),
                  ics_fold(f"DESCRIPTION:{ics_escape(desc)}"), f"STATUS:{'TENTATIVE' if v.get('status') == 'pending' else 'CONFIRMED'}",
                  "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Visit in 1 hour", "END:VALARM", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    return Response(content="\r\n".join(lines) + "\r\n", media_type="text/calendar; charset=utf-8", headers={"Cache-Control": "no-store"})


# ---------------------------------------------------------------- WhatsApp reminders to the customer before a visit
async def visit_reminders_pass() -> int:
    now = S.now_utc()
    made = 0
    for flag, hours in (("wa_24h", 24), ("wa_2h", 2)):
        async for v in S.db.visits.find({"status": "confirmed", flag: {"$ne": True}, "slot": {"$gt": S.slot_str(now), "$lte": S.slot_str(now + timedelta(hours=hours))}}, {"_id": 0}):
            lid = v.get("lead_id")
            if not lid and v.get("phone"):
                lead = await S.db.leads.find_one({"phone_key": S.phone_key(v["phone"])}, {"_id": 0, "id": 1})
                lid = lead["id"] if lead else None
            await S.db.visits.update_one({"id": v["id"]}, {"$set": {flag: True}})
            if lid:
                when = S.parse_dt(v["slot"]).astimezone(IST).strftime("on %a %d %b at %I:%M %p")
                if await crm_auto.queue_message(lid, "visit_reminder", listing_ref=f"visit:{v['id']}:{flag}", property=v["property_title"], when=when):
                    made += 1
    return made


async def deals_loop():
    while True:
        try:
            await visit_reminders_pass()
            await checklist_pass()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logging.warning(f"Deals pass failed: {type(e).__name__}: {S.redact(str(e))}")
        await asyncio.sleep(600)


S.EXT_LOOPS.append(deals_loop)


# ---------------------------------------------------------------- document checklist for a deal
CHECKLISTS = {
    "plot_purchase": [("buyer_kyc", "Buyer's ID and address proof (Aadhaar, PAN)", "buyer"), ("seller_kyc", "Seller's ID and address proof", "seller"), ("title_deed", "Title deed and the previous deeds (chain of ownership)", "seller"),
                      ("khatian", "Latest khatian / record of rights (LR and RS)", "seller"), ("mutation", "Mutation certificate in the seller's name", "seller"), ("khajna", "Latest khajna (land revenue) receipts", "seller"),
                      ("conversion", "Land conversion (if the land is farm land)", "seller"), ("encumbrance", "No-dues and non-encumbrance proof", "seller"), ("agreement", "Sale agreement signed", "us"),
                      ("payment", "Token and payment receipts", "buyer"), ("registration", "Registration done and slip collected", "us"), ("post_mutation", "Mutation applied in the buyer's name", "us")],
    "flat_purchase": [("buyer_kyc", "Buyer's ID and address proof (Aadhaar, PAN)", "buyer"), ("seller_kyc", "Seller or builder's ID and papers", "seller"), ("title_deed", "Title deed and previous deeds", "seller"),
                      ("plan", "Approved building plan and completion certificate", "seller"), ("tax", "Property tax and maintenance no-dues", "seller"), ("agreement", "Agreement for sale signed", "us"),
                      ("loan", "Loan sanction letter (if a loan is taken)", "buyer"), ("payment", "Payment receipts", "buyer"), ("registration", "Registration done and slip collected", "us")],
    "rent": [("tenant_kyc", "Tenant's ID and address proof", "buyer"), ("owner_kyc", "Owner's ID and ownership proof", "seller"), ("agreement", "Rent agreement signed", "us"),
             ("deposit", "Security deposit receipt", "buyer"), ("police", "Police verification form", "buyer")],
    "loan": [("kyc", "ID and address proof (Aadhaar, PAN)", "buyer"), ("income", "Income proof (salary slips or ITR for 2 years)", "buyer"), ("bank", "Bank statements for 6 months", "buyer"),
             ("property_papers", "Property papers for the bank's legal check", "seller"), ("application", "Loan application form signed", "buyer"), ("sanction", "Sanction letter received", "us")],
}
ITEM_STATUS = ("pending", "received", "verified", "na")


class ChecklistInit(BaseModel):
    type: Literal["plot_purchase", "flat_purchase", "rent", "loan"]
    due_in_days: int = Field(default=7, ge=1, le=90)


@S.api.post("/admin/leads/{lid}/checklist")
async def init_checklist(lid: str, payload: ChecklistInit, request: Request):
    await S.require_admin(request)
    lead = await S.db.leads.find_one({"id": lid}, {"_id": 0, "deal_docs": 1})
    if not lead:
        raise HTTPException(404, "Lead not found")
    have = {d["key"] for d in lead.get("deal_docs") or []}
    due = (S.now_utc() + timedelta(days=payload.due_in_days)).astimezone(IST).strftime("%Y-%m-%d")
    add = [{"key": k, "label": label, "party": party, "status": "pending", "due": due, "note": None, "list": payload.type} for k, label, party in CHECKLISTS[payload.type] if k not in have]
    if add:
        await S.db.leads.update_one({"id": lid}, {"$push": {"deal_docs": {"$each": add}, "activities": S.stamp_activity("checklist", f"Document checklist started ({payload.type.replace('_', ' ')})")}})
    return (await S.db.leads.find_one({"id": lid}, {"_id": 0, "deal_docs": 1}))["deal_docs"]


class ChecklistPatch(BaseModel):
    status: Optional[Literal["pending", "received", "verified", "na"]] = None
    note: Optional[str] = Field(default=None, max_length=200)
    due: Optional[str] = Field(default=None, max_length=10)


@S.api.patch("/admin/leads/{lid}/checklist/{key}")
async def patch_checklist(lid: str, key: str, payload: ChecklistPatch, request: Request):
    await S.require_admin(request)
    data = payload.model_dump(exclude_unset=True)
    sets = {f"deal_docs.$.{k}": (S.good_date(v) if k == "due" else v) for k, v in data.items()}
    if data.get("status") in ("received", "verified"):
        sets["deal_docs.$.done_at"] = S.now_utc().isoformat()
    r = await S.db.leads.update_one({"id": lid, "deal_docs.key": key}, {"$set": sets})
    if r.matched_count == 0:
        raise HTTPException(404, "Item not found")
    return {"ok": True}


async def checklist_pass() -> int:
    """Once a day: ask the customer for the papers that are late, and tell you what is still missing."""
    today = S.now_utc().astimezone(IST).strftime("%Y-%m-%d")
    st = await S.db.settings.find_one({"_id": "crm_auto_state"}, {"_id": 0}) or {}
    if st.get("checklist_on") == today:
        return 0
    await S.db.settings.update_one({"_id": "crm_auto_state"}, {"$set": {"checklist_on": today}}, upsert=True)
    asked = 0
    async for l in S.db.leads.find({"deal_docs.status": "pending", "status": {"$nin": ["lost"]}, "spam": {"$ne": True}}, {"_id": 0}):
        late = [d for d in l["deal_docs"] if d["status"] == "pending" and (d.get("due") or "9999") <= today]
        if not late:
            continue
        mine = [d for d in late if d["party"] in ("buyer", "seller")]
        if mine:
            items = "\n".join(f"• {d['label']}" for d in mine[:6])
            lang = l.get("language") if l.get("language") in ("en", "bn", "hi") else "en"
            first = (l.get("name") or "").split(" ")[0] or "there"
            text = {"en": f"Hi {first}, to move ahead we still need these papers:\n{items}\nPlease send photos on WhatsApp when you can. - Ayan, Urbanex Realty",
                    "bn": f"নমস্কার {first}, এগোতে আমাদের এই কাগজগুলো এখনও দরকার:\n{items}\nসময় পেলে হোয়াটসঅ্যাপে ছবি পাঠিয়ে দেবেন। - আয়ান, আরবানেক্স রিয়েলটি",
                    "hi": f"नमस्ते {first}, आगे बढ़ने के लिए हमें ये कागज़ात अभी चाहिए:\n{items}\nसमय मिलने पर WhatsApp पर फोटो भेजिए। - अयान, अर्बनेक्स रियल्टी"}[lang]
            if await crm_auto.queue_message(l["id"], "doc_reminder", text=text, allow_closed=True):
                asked += 1
        await S.notify_admin("documents", f"{len(late)} paper{'s' if len(late) > 1 else ''} pending for {l['name']}", "; ".join(d["label"][:40] for d in late[:3]), link=f"/admin/leads?lead={l['id']}")
    return asked


@S.api.get("/admin/crm/checklists")
async def checklists_overview(request: Request):
    await S.require_admin(request)
    out = []
    async for l in S.db.leads.find({"deal_docs.0": {"$exists": True}}, {"_id": 0, "id": 1, "name": 1, "status": 1, "deal_docs": 1}):
        docs = l["deal_docs"]
        out.append({"id": l["id"], "name": l["name"], "status": l["status"], "total": len(docs), "done": sum(1 for d in docs if d["status"] in ("received", "verified", "na")),
                    "pending": [d["label"] for d in docs if d["status"] == "pending"][:4]})
    return out


# ---------------------------------------------------------------- banks and loan agents: hand-off and your commission
class PartnerIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    kind: Literal["bank", "agent", "other"] = "bank"
    phone: Optional[str] = Field(default=None, max_length=30)
    email: Optional[str] = Field(default=None, max_length=200, pattern=S.EMAIL_RE)
    commission_pct: float = Field(default=0.5, ge=0, le=20)
    notes: Optional[str] = Field(default=None, max_length=300)


@S.api.get("/admin/crm/partners")
async def list_partners(request: Request):
    await S.require_admin(request)
    return await S.db.partners.find({}, {"_id": 0}).sort("name", 1).to_list(100)


@S.api.post("/admin/crm/partners")
async def add_partner(payload: PartnerIn, request: Request):
    await S.require_admin(request)
    doc = {"id": S.new_id("par_"), **payload.model_dump(), "created_at": S.now_utc().isoformat()}
    await S.db.partners.insert_one(dict(doc))
    return doc


@S.api.patch("/admin/crm/partners/{pid}")
async def edit_partner(pid: str, payload: PartnerIn, request: Request):
    await S.require_admin(request)
    r = await S.db.partners.update_one({"id": pid}, {"$set": payload.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Partner not found")
    return await S.db.partners.find_one({"id": pid}, {"_id": 0})


@S.api.delete("/admin/crm/partners/{pid}")
async def delete_partner(pid: str, request: Request):
    await S.require_admin(request)
    await S.db.partners.delete_one({"id": pid})
    return {"ok": True}


class LoanRefer(BaseModel):
    partner_id: str = Field(min_length=3, max_length=60)
    amount_inr: int = Field(ge=100000, le=10**10)
    note: Optional[str] = Field(default=None, max_length=300)


@S.api.post("/admin/leads/{lid}/loan/refer")
async def loan_refer(lid: str, payload: LoanRefer, request: Request):
    user = await S.require_admin(request)
    lead = await S.db.leads.find_one({"id": lid}, {"_id": 0})
    par = await S.db.partners.find_one({"id": payload.partner_id}, {"_id": 0})
    if not lead or not par:
        raise HTTPException(404, "Lead or partner not found")
    now = S.now_utc().isoformat()
    loan = {"needed": True, "partner_id": par["id"], "partner_name": par["name"], "amount_inr": payload.amount_inr, "status": "referred", "referred_at": now,
            "commission_pct": par["commission_pct"], "commission_inr": None, "commission_paid": False, "history": [{"status": "referred", "at": now}]}
    text = (f"Loan enquiry from Urbanex Realty\nCustomer: {lead['name']}\nPhone: {lead.get('phone') or '-'}\nLoan needed: {S.inr_text(payload.amount_inr)}"
            + (f"\nProperty: {lead['property_interest']}" if lead.get("property_interest") else "") + (f"\nNote: {payload.note}" if payload.note else ""))
    await S.db.leads.update_one({"id": lid}, {"$set": {"loan": loan, "updated_at": now}, "$push": {"activities": S.stamp_activity("loan", f"Referred to {par['name']} for {S.inr_text(payload.amount_inr)}", by=user["email"])}})
    if par.get("email"):
        S.spawn(S.send_email([par["email"]], f"Loan enquiry: {lead['name']}", text + "\n\n- Urbanex Realty"))
    return {"loan": loan, "share_text": text, "emailed": bool(par.get("email") and S.SMTP_HOST)}


class LoanUpdate(BaseModel):
    status: Optional[Literal["referred", "documents", "sanctioned", "disbursed", "rejected"]] = None
    sanctioned_inr: Optional[int] = Field(default=None, ge=0, le=10**10)
    disbursed_inr: Optional[int] = Field(default=None, ge=0, le=10**10)
    commission_inr: Optional[int] = Field(default=None, ge=0, le=10**9)
    commission_paid: Optional[bool] = None


@S.api.patch("/admin/leads/{lid}/loan")
async def loan_update(lid: str, payload: LoanUpdate, request: Request):
    await S.require_admin(request)
    lead = await S.db.leads.find_one({"id": lid}, {"_id": 0, "loan": 1})
    if not lead or not lead.get("loan"):
        raise HTTPException(404, "No loan hand-off on this lead")
    loan = lead["loan"]
    data = payload.model_dump(exclude_unset=True)
    now = S.now_utc().isoformat()
    if data.get("status") and data["status"] != loan.get("status"):
        loan.setdefault("history", []).append({"status": data["status"], "at": now})
    loan.update({k: v for k, v in data.items() if v is not None})
    if loan.get("status") == "disbursed" and loan.get("commission_inr") is None and loan.get("disbursed_inr"):
        loan["commission_inr"] = int(round(loan["disbursed_inr"] * (loan.get("commission_pct") or 0) / 100))
    await S.db.leads.update_one({"id": lid}, {"$set": {"loan": loan, "updated_at": now}})
    return loan


@S.api.get("/admin/crm/loans")
async def loans_overview(request: Request):
    await S.require_admin(request)
    rows, tot = [], {"referred": 0, "sanctioned": 0, "disbursed": 0, "rejected": 0, "commission_earned": 0, "commission_paid": 0, "commission_due": 0, "disbursed_inr": 0}
    async for l in S.db.leads.find({"loan.needed": True}, {"_id": 0, "id": 1, "name": 1, "loan": 1}):
        ln = l["loan"]
        tot["referred"] += 1
        tot[ln["status"]] = tot.get(ln["status"], 0) + 1 if ln["status"] in ("sanctioned", "disbursed", "rejected") else tot.get(ln["status"], 0)
        if ln.get("status") == "disbursed":
            tot["disbursed_inr"] += ln.get("disbursed_inr") or 0
            c = ln.get("commission_inr") or 0
            tot["commission_earned"] += c
            tot["commission_paid" if ln.get("commission_paid") else "commission_due"] += c
        rows.append({"id": l["id"], "name": l["name"], **{k: ln.get(k) for k in ("partner_name", "amount_inr", "status", "commission_pct", "commission_inr", "commission_paid", "referred_at")}})
    return {"totals": tot, "items": rows}
