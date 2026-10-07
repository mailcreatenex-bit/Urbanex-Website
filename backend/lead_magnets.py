"""Ways to capture more leads, all of them funnelled through the one lead door (ingest_lead):

* "WhatsApp me the price": name + number, no sign-in needed.
* The Vastu report: a shareable report page, sent to the person's WhatsApp; a poor score marks the lead hot.
* Alerts: "save this and tell me when a similar home comes up" (exit offer, empty concierge search, tools).
* Free checks: a limited number of free plot-document checks / land-report previews each week.
* Referral links for past clients, with a thank-you tracker.
* An instant WhatsApp reply to a new lead (by default only at night, when you cannot answer).
Every message goes through the Outbox in crm_auto, so quiet hours, opt-outs and "ask me first" still apply.
"""
import logging
import re
import secrets
from datetime import timedelta
from typing import List, Literal, Optional

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field

import server as S
import crm_auto
import site_future

INSTANT = ("instant_reply", "price_reply", "vastu_report")     # replies to someone who has just written to us: allowed even at night
for _k in INSTANT:
    if _k not in crm_auto.KINDS:
        crm_auto.KINDS.append(_k)
        crm_auto.DEFAULT_MODES[_k] = "auto"      # the person just asked for it; it still waits in the Outbox if the WhatsApp API is not connected
crm_auto.INSTANT_KINDS = set(INSTANT)

MY_SOURCES = {"quick_price", "vastu_compass", "free_check", "alert_signup", "missed_call"}


def first(name: Optional[str]) -> str:
    n = (name or "").strip().split(" ")[0]
    return n if n and n.lower() != "unknown" else "there"


def money(n) -> str:
    try:
        n = int(n)
    except (TypeError, ValueError):
        return ""
    if n >= 10_000_000:
        return f"₹{n / 10_000_000:.2f}".rstrip("0").rstrip(".") + " crore"
    if n >= 100_000:
        return f"₹{n / 100_000:.1f}".rstrip("0").rstrip(".") + " lakh"
    return f"₹{n:,}"


async def me() -> str:
    return (await crm_auto.auto_settings())["me"]


async def guard(request: Request, phone: str, token: Optional[str]) -> List[str]:
    S.rate_limit(request, "leads", 10)
    await S.require_human(request, token)
    return await S.track_submission(request, "lead", phone)


# ---------------------------------------------------------------- referrals
async def tag_referral(request: Request, lead_id: str):
    code = (request.headers.get("x-referral") or "").strip().lower()
    if not re.fullmatch(r"[a-z0-9]{4,16}", code):
        return
    ref = await S.db.referrals.find_one({"code": code}, {"_id": 0, "name": 1})
    lead = await S.db.leads.find_one({"id": lead_id}, {"_id": 0, "referred_by": 1})
    if not ref or lead is None or lead.get("referred_by"):
        return
    await S.db.leads.update_one({"id": lead_id}, {"$set": {"referred_by": code}, "$addToSet": {"tags": f"ref-{code}"},
                                                      "$push": {"activities": S.stamp_activity("referral", f"Came through {ref['name']}'s referral link")}})


S.tag_referral = tag_referral


class ReferralIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: Optional[str] = Field(default=None, max_length=30)
    reward_note: Optional[str] = Field(default=None, max_length=200)


class ReferralPatch(BaseModel):
    reward_note: Optional[str] = Field(default=None, max_length=200)
    rewarded: Optional[bool] = None


@S.api.post("/admin/referrals")
async def referral_create(payload: ReferralIn, request: Request):
    await S.require_admin(request)
    code = (re.sub(r"[^a-z]", "", payload.name.lower())[:4] or "ref") + secrets.token_hex(2)
    doc = {"code": code, "name": payload.name.strip(), "phone": payload.phone, "reward_note": payload.reward_note, "rewarded": False, "clicks": 0, "created_at": S.now_utc().isoformat()}
    await S.db.referrals.insert_one(dict(doc))
    return {**doc, "link": f"{S.PUBLIC_SITE_URL}/r/{code}", "leads": 0, "closed": 0}


@S.api.get("/admin/referrals")
async def referral_list(request: Request):
    await S.require_admin(request)
    out = []
    async for r in S.db.referrals.find({}, {"_id": 0}).sort("created_at", -1):
        n = await S.db.leads.count_documents({"referred_by": r["code"]})
        c = await S.db.leads.count_documents({"referred_by": r["code"], "status": "closed"})
        out.append({**r, "link": f"{S.PUBLIC_SITE_URL}/r/{r['code']}", "leads": n, "closed": c})
    return out


@S.api.patch("/admin/referrals/{code}")
async def referral_patch(code: str, payload: ReferralPatch, request: Request):
    await S.require_admin(request)
    sets = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not sets or not (await S.db.referrals.update_one({"code": code}, {"$set": sets})).matched_count:
        raise HTTPException(404, "Referral not found")
    return {"ok": True}


@S.api.get("/r/{code}")
async def referral_open(code: str):
    if not re.fullmatch(r"[a-z0-9]{4,16}", code):
        raise HTTPException(404, "Link not found")
    r = await S.db.referrals.find_one_and_update({"code": code}, {"$inc": {"clicks": 1}}, projection={"_id": 0, "name": 1})
    if not r:
        raise HTTPException(404, "Link not found")
    return {"code": code, "name": first(r["name"])}


# ---------------------------------------------------------------- a visit link made for a lead (same thing the CRM button makes)
async def visit_link(lead_id: str, property_id: Optional[str]) -> Optional[str]:
    if not property_id:
        return None
    token = secrets.token_urlsafe(14)
    await S.db.visit_links.insert_one({"token": token, "lead_id": lead_id, "property_id": property_id, "mode": "onsite", "used": False,
                                       "expires_at": (S.now_utc() + timedelta(days=14)).isoformat(), "created_at": S.now_utc().isoformat()})
    return f"{S.PUBLIC_SITE_URL}/book-visit/{token}"


async def listing_for(kind: str, ref: Optional[str]) -> Optional[dict]:
    if not ref:
        return None
    if kind == "video":
        v = await S.db.videos.find_one({"video_id": ref, "hidden": {"$ne": True}}, {"_id": 0})
        return {"title": v["title"], "zone": v.get("zone"), "property_type": v.get("property_type"), "bedrooms": v.get("bedrooms"), "price_inr": v.get("price_inr"), "url": f"{S.PUBLIC_SITE_URL}/properties/video/{ref}", "property_id": None} if v else None
    p = await S.find_property(ref)
    return {"title": p["title"], "zone": p.get("zone"), "property_type": p.get("property_type"), "bedrooms": p.get("bedrooms"), "price_inr": p.get("price_inr"), "url": f"{S.PUBLIC_SITE_URL}/properties/{p.get('slug') or p['id']}", "property_id": p["id"]} if p else None


def wa_to_us(text: str) -> str:
    from urllib.parse import quote
    return f"https://wa.me/{S.WHATSAPP_NUMBER}?text={quote(text)}"


# ---------------------------------------------------------------- 1. WhatsApp me the price
class QuickIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: S.Phone
    kind: Literal["property", "video", "general"] = "general"
    ref_id: Optional[str] = Field(default=None, max_length=100)
    note: Optional[str] = Field(default=None, max_length=300)      # e.g. the numbers from a calculator they just used
    turnstile_token: S.TurnstileToken = None


@S.api.post("/enquiry/quick")
async def enquiry_quick(payload: QuickIn, request: Request):
    flags = await guard(request, payload.phone, payload.turnstile_token)
    item = await listing_for(payload.kind, payload.ref_id)
    title = item["title"] if item else None
    wants = {"zones": [item["zone"]] if item and item.get("zone") else [], "property_type": item.get("property_type") if item else None, "bedrooms": item.get("bedrooms") if item else None}
    r = await S.ingest_lead(name=payload.name, phone=payload.phone, source="quick_price", interest=title, message=f"Asked for the price of {title}" if title else (payload.note or "Asked to be contacted"),
                            wants=wants, tags=["wants-price"] + ([] if title else ["tool"]), flags=flags)
    await tag_referral(request, r["id"])
    await S.db.leads.update_one({"id": r["id"]}, {"$set": {"priority": "hot"}})
    if item and not r.get("spam"):
        lead = await S.db.leads.find_one({"id": r["id"]}, {"_id": 0, "language": 1})
        link = await visit_link(r["id"], item.get("property_id"))
        who, mine = first(payload.name), await me()
        price = f"The price is {money(item['price_inr'])}." if item.get("price_inr") else "I will share the price when we speak."
        if (lead or {}).get("language") == "bn":
            text = f"নমস্কার {who}, {title} সম্পর্কে জানতে চাওয়ার জন্য ধন্যবাদ। {'দাম ' + money(item['price_inr']) + '।' if item.get('price_inr') else 'দামটা ফোনে জানাব।'} বিস্তারিত: {item['url']}" + (f" দেখতে আসার সময় বেছে নিন: {link}" if link else "") + f" - {mine}, আরবানেক্স রিয়েলটি"
        else:
            text = f"Hi {who}, thanks for asking about {title}. {price} Details: {item['url']}" + (f" Pick a time to see it: {link}" if link else "") + f" - {mine}, Urbanex Realty"
        await crm_auto.queue_message(r["id"], "price_reply", text=text)
    return {"ok": True, "id": r["id"], "whatsapp": wa_to_us(f"Hi Ayan, I asked for the price of {title}." if title else "Hi Ayan, please contact me.")}


# ---------------------------------------------------------------- 5. alerts: "tell me when a similar home comes up"
class AlertIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: S.Phone
    source: Literal["exit_offer", "concierge", "tool"] = "exit_offer"
    zone: Optional[str] = Field(default=None, max_length=60)
    property_type: Optional[Literal["apartment", "villa", "plot", "commercial"]] = None
    bedrooms: Optional[int] = Field(default=None, ge=0, le=10)
    budget_inr: Optional[int] = Field(default=None, ge=1000, le=10**11)
    listing_type: Optional[Literal["sale", "rent"]] = None
    note: Optional[str] = Field(default=None, max_length=200)
    turnstile_token: S.TurnstileToken = None


@S.api.post("/enquiry/alert")
async def enquiry_alert(payload: AlertIn, request: Request):
    flags = await guard(request, payload.phone, payload.turnstile_token)
    wants = {"zones": [payload.zone] if payload.zone else [], "property_type": payload.property_type, "bedrooms": payload.bedrooms, "budget_inr": payload.budget_inr, "listing_type": payload.listing_type}
    bits = [f"{payload.bedrooms} BHK" if payload.bedrooms else None, payload.property_type, f"in {payload.zone}" if payload.zone else None, f"for {payload.listing_type}" if payload.listing_type else None]
    desc = " ".join(b for b in bits if b) or "home"
    r = await S.ingest_lead(name=payload.name, phone=payload.phone, source="alert_signup", interest=desc, message=f"Wants an alert for a similar home ({payload.source}). {payload.note or ''}".strip(),
                            wants=wants, tags=["alert-signup", payload.source], flags=flags)
    await tag_referral(request, r["id"])
    await S.db.leads.update_one({"id": r["id"]}, {"$set": {"digest_opt_in": True}})
    if not r.get("spam"):
        await crm_auto.queue_message(r["id"], "instant_reply", text=f"Hi {first(payload.name)}, done! I will message you the moment a {desc} comes up, before it is widely shared. - {await me()}, Urbanex Realty")
    return {"ok": True, "id": r["id"]}


# ---------------------------------------------------------------- 2. the Vastu report
class ReportIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: S.Phone
    facing: Optional[Literal["N", "NE", "E", "SE", "S", "SW", "W", "NW"]] = None
    rooms: dict = Field(default={}, max_length=20)
    turnstile_token: S.TurnstileToken = None


@S.api.post("/vastu/report")
async def vastu_report(payload: ReportIn, request: Request):
    flags = await guard(request, payload.phone, payload.turnstile_token)
    rooms = {}
    for k, dirs in payload.rooms.items():
        if k not in site_future.ROOMS or not isinstance(dirs, list):
            raise HTTPException(422, "Unknown room")
        ok = [d for d in dirs if d in site_future.DIRS]
        if ok:
            rooms[k] = ok[:4]
    if not rooms:
        raise HTTPException(422, "Place at least one room")
    res = site_future.check_layout(payload.facing, rooms)
    token = secrets.token_urlsafe(9)
    await S.db.vastu_reports.insert_one({"token": token, "name": first(payload.name), "facing": payload.facing, "rooms": rooms, "result": res, "created_at": S.now_utc().isoformat()})
    low = res["score"] is not None and res["score"] < 60
    r = await S.ingest_lead(name=payload.name, phone=payload.phone, source="vastu_compass", interest="Vastu-first construction design",
                            message=f"Vastu report score {res['score']}/100 ({res['grade']}), plot faces {payload.facing or 'unknown'}. To fix: " + "; ".join(f"{i['label']} in {i['direction_name']}" for i in res["must_fix"][:5]),
                            tags=["vastu", "vastu-low" if low else "vastu-ok"], flags=flags)
    await tag_referral(request, r["id"])
    if low:
        await S.db.leads.update_one({"id": r["id"]}, {"$set": {"priority": "hot"}})
    link = f"{S.PUBLIC_SITE_URL}/vastu/report/{token}"
    if not r.get("spam"):
        n = len(res["must_fix"])
        await crm_auto.queue_message(r["id"], "vastu_report", text=f"Hi {first(payload.name)}, your Vastu report: {res['score']}/100 ({res['grade']})" + (f", {n} thing{'s' if n != 1 else ''} to fix" if n else "") +
                                     f". See it here: {link} If you would like it redrawn Vastu-first, just reply here. - {await me()}, Urbanex Realty")
    return {"ok": True, "token": token, "link": link, "score": res["score"]}


@S.api.get("/vastu/report/{token}")
async def vastu_report_get(token: str):
    d = await S.db.vastu_reports.find_one({"token": token}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Report not found")
    return d


# ---------------------------------------------------------------- 7. free checks, a few every week
FREE_TYPES = {"plot_documents": "free plot document check", "land_report_preview": "free land report preview"}


def week_start():
    now = S.now_utc().astimezone(S.IST)
    mon = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    return mon


async def free_limit() -> int:
    d = await S.db.settings.find_one({"_id": "free_checks"}, {"_id": 0}) or {}
    return int(d.get("limit", 10))


async def free_status() -> dict:
    start = week_start()
    used = await S.db.free_checks.count_documents({"created_at": {"$gte": start.astimezone(S.timezone.utc).isoformat()}, "status": {"$ne": "waitlist"}})
    lim = await free_limit()
    return {"limit": lim, "used": used, "left": max(0, lim - used), "resets_on": (start + timedelta(days=7)).date().isoformat(), "types": [{"key": k, "label": v} for k, v in FREE_TYPES.items()]}


@S.api.get("/free-checks/status")
async def free_checks_status():
    return await free_status()


class FreeIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: S.Phone
    kind: Literal["plot_documents", "land_report_preview"] = "plot_documents"
    details: Optional[str] = Field(default=None, max_length=500)
    turnstile_token: S.TurnstileToken = None


@S.api.post("/free-checks")
async def free_checks_create(payload: FreeIn, request: Request):
    flags = await guard(request, payload.phone, payload.turnstile_token)
    st = await free_status()
    status = "booked" if st["left"] > 0 else "waitlist"
    label = FREE_TYPES[payload.kind]
    r = await S.ingest_lead(name=payload.name, phone=payload.phone, source="free_check", interest=label, message=f"{label.capitalize()} ({status}). {payload.details or ''}".strip(),
                            tags=["free-check", payload.kind, status], flags=flags)
    await tag_referral(request, r["id"])
    await S.db.leads.update_one({"id": r["id"]}, {"$set": {"priority": "hot"}})
    item = {"id": S.new_id("fc_"), "lead_id": r["id"], "name": payload.name.strip(), "kind": payload.kind, "details": payload.details, "status": status, "created_at": S.now_utc().isoformat()}
    await S.db.free_checks.insert_one(dict(item))
    if not r.get("spam"):
        who, mine = first(payload.name), await me()
        if status == "booked":
            text = (f"Hi {who}, your {label} is booked. Please send clear photos of the papers on this chat (khatian, deed, mutation, tax receipt, plot map). "
                    f"I will go through them and call you. - {mine}, Urbanex Realty")
        else:
            text = f"Hi {who}, this week's free checks are all taken. You are on the list and I will contact you when the next ones open on {st['resets_on']}. - {mine}, Urbanex Realty"
        await crm_auto.queue_message(r["id"], "instant_reply", text=text)
    return {"ok": True, "status": status, "left": max(0, st["left"] - (1 if status == "booked" else 0)), "resets_on": st["resets_on"],
            "whatsapp": wa_to_us(f"Hi Ayan, I booked a {label}. I am sending the documents now.")}


@S.api.get("/admin/free-checks")
async def free_checks_admin(request: Request):
    await S.require_admin(request)
    items = [x async for x in S.db.free_checks.find({}, {"_id": 0}).sort("created_at", -1).limit(100)]
    return {**(await free_status()), "items": items}


class FreePatch(BaseModel):
    status: Literal["booked", "done", "waitlist"]


@S.api.patch("/admin/free-checks/{fid}")
async def free_checks_patch(fid: str, payload: FreePatch, request: Request):
    await S.require_admin(request)
    if not (await S.db.free_checks.update_one({"id": fid}, {"$set": {"status": payload.status}})).matched_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


class FreeLimit(BaseModel):
    limit: int = Field(ge=0, le=500)


@S.api.put("/admin/free-checks/limit")
async def free_checks_limit(payload: FreeLimit, request: Request):
    await S.require_admin(request)
    await S.db.settings.update_one({"_id": "free_checks"}, {"$set": {"limit": payload.limit}}, upsert=True)
    return await free_status()


# ---------------------------------------------------------------- 10. an instant reply to a new lead
async def instant_scope() -> str:
    d = await S.db.settings.find_one({"_id": "crm_instant"}, {"_id": 0}) or {}
    return d.get("scope", "night") if d.get("scope") in ("night", "always") else "night"


class InstantIn(BaseModel):
    scope: Literal["night", "always"]


@S.api.get("/admin/crm/instant")
async def instant_get(request: Request):
    await S.require_admin(request)
    return {"scope": await instant_scope()}


@S.api.put("/admin/crm/instant")
async def instant_put(payload: InstantIn, request: Request):
    await S.require_admin(request)
    await S.db.settings.update_one({"_id": "crm_instant"}, {"$set": {"scope": payload.scope}}, upsert=True)
    return {"scope": payload.scope}


async def instant_hook(lead_id: str, created: bool):
    if not created:
        return
    try:
        lead = await S.db.leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead or lead.get("spam") or not lead.get("phone") or lead.get("source_page") in MY_SOURCES:
            return
        cfg = await crm_auto.auto_settings()
        if await instant_scope() == "night" and not crm_auto.in_quiet_hours(cfg):
            return
        prop = None
        if lead.get("property_interest"):
            prop = await S.db.properties.find_one({"title": lead["property_interest"], **S.LIVE}, {"_id": 0, "id": 1, "slug": 1, "title": 1})
        link = await visit_link(lead_id, prop["id"]) if prop else None
        who, mine = first(lead.get("name")), cfg["me"]
        night = crm_auto.in_quiet_hours(cfg)
        when = "I will call you first thing in the morning." if night else "I will call you shortly."
        if prop:
            body = f"Thank you for your interest in {prop['title']}. Details: {S.PUBLIC_SITE_URL}/properties/{prop.get('slug') or prop['id']}" + (f" Pick a time to visit: {link}" if link else "")
        else:
            body = "Thank you for getting in touch. To find the right home, reply with the area and your budget."
        await crm_auto.queue_message(lead_id, "instant_reply", text=f"Hi {who}, this is {mine} from Urbanex Realty. {body} {when}")
    except Exception as e:
        logging.warning(f"Instant reply failed: {type(e).__name__}: {e}")


S.LEAD_HOOKS.append(instant_hook)
