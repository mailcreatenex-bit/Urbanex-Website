from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get('ADMIN_EMAILS', '').split(',') if e.strip()}
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY', '')
YOUTUBE_HANDLE = os.environ.get('YOUTUBE_HANDLE', '@urbanexbyayandey')

app = FastAPI(title="Urbanex Realty API")
api = APIRouter(prefix="/api")

# =============== Helpers ===============
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:16]}"

async def get_current_user(request: Request) -> Optional[dict]:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    exp = session.get("expires_at")
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < now_utc():
        return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user

async def require_user(request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_admin(request: Request) -> dict:
    user = await require_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# =============== Models ===============
class Property(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: new_id("prop_"))
    title: str
    zone: str
    property_type: str  # apartment | villa | plot | commercial
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    area_sqft: int
    price_inr: int
    status: str = "available"  # available | sold | upcoming
    description: str
    highlights: List[str] = []
    image: str
    gallery: List[str] = []
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime = Field(default_factory=now_utc)

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: new_id("lead_"))
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    source_page: str = "unknown"
    property_interest: Optional[str] = None
    message: Optional[str] = None
    status: str = "new"  # new | contacted | site_visit | negotiation | closed | lost
    notes: List[dict] = []
    tags: List[str] = []
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

class LeadCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    source_page: str = "unknown"
    property_interest: Optional[str] = None
    message: Optional[str] = None

class LeadUpdate(BaseModel):
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    property_interest: Optional[str] = None

class NoteCreate(BaseModel):
    text: str

class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: new_id("inv_"))
    invoice_number: str
    lead_id: Optional[str] = None
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    property_title: str
    amount_inr: int
    payment_schedule: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=now_utc)

class InvoiceCreate(BaseModel):
    lead_id: Optional[str] = None
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    property_title: str
    amount_inr: int
    payment_schedule: str
    notes: Optional[str] = None

class SemanticSearch(BaseModel):
    query: str

# =============== Seed ===============
BURDWAN_ZONES = [
    "Kalibazar", "Renaissance Township", "Borehat", "Goda", "Nawabhat",
    "Ullas", "Bajepratappur", "Khosbagan", "Parbirhata", "Alisha",
    "Baburbag", "Rajbati", "Sripally", "Radhanagar", "Bahir Sarbamangala",
    "Curzon Gate", "Tinkonia", "Golapbag", "Nutanganj",
]

PROP_IMGS = [
    "https://images.pexels.com/photos/8134821/pexels-photo-8134821.jpeg",
    "https://images.pexels.com/photos/30211366/pexels-photo-30211366.jpeg",
    "https://images.unsplash.com/photo-1559998852-f8ab898d889e?w=1600",
    "https://images.pexels.com/photos/36392046/pexels-photo-36392046.jpeg",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600",
    "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1600",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600",
    "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1600",
    "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1600",
    "https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1600",
    "https://images.unsplash.com/photo-1600566753086-00f18fe6ba68?w=1600",
]

SEED_PROPERTIES = [
    {"title": "Renaissance Residency 3BHK", "zone": "Renaissance Township", "property_type": "apartment", "bedrooms": 3, "bathrooms": 3, "area_sqft": 1450, "price_inr": 6800000, "description": "Premium 3BHK with balcony overlooking the township courtyard. Modular kitchen, vitrified flooring, RCC framed structure.", "highlights": ["Covered parking", "24/7 security", "Landscaped garden", "Vaastu compliant"]},
    {"title": "Kalibazar Boutique Villa", "zone": "Kalibazar", "property_type": "villa", "bedrooms": 4, "bathrooms": 4, "area_sqft": 2600, "price_inr": 14500000, "description": "Detached 4BHK villa in the heart of old Burdwan. Private lawn, terrace garden, imported fittings throughout.", "highlights": ["Corner plot", "Private lawn", "Home theatre room", "Servant quarter"]},
    {"title": "Nawabhat Skyline Flat 2BHK", "zone": "Nawabhat", "property_type": "apartment", "bedrooms": 2, "bathrooms": 2, "area_sqft": 980, "price_inr": 3900000, "description": "East-facing 2BHK with abundant natural light, close to GT Road connectivity and schools.", "highlights": ["Lift", "Power backup", "Piped gas ready", "School proximity"]},
    {"title": "Borehat Plot – Investment Grade", "zone": "Borehat", "property_type": "plot", "area_sqft": 2400, "price_inr": 2800000, "description": "Rectangular NA plot on 20-ft blacktop road. Clear title, mutation done. Prime for custom home build.", "highlights": ["Corner plot", "Clear title", "20ft frontage", "NA converted"]},
    {"title": "Goda Green Duplex 3BHK", "zone": "Goda", "property_type": "villa", "bedrooms": 3, "bathrooms": 3, "area_sqft": 1850, "price_inr": 9600000, "description": "Contemporary duplex with double-height living room, private terrace and covered car porch.", "highlights": ["Duplex layout", "Car porch", "Terrace garden", "Modular kitchen"]},
    {"title": "Ullas Heights Premium 4BHK", "zone": "Ullas", "property_type": "apartment", "bedrooms": 4, "bathrooms": 4, "area_sqft": 1980, "price_inr": 11200000, "description": "Top-floor duplex apartment with panoramic city view, private terrace and imported wooden flooring.", "highlights": ["Top floor", "Private terrace", "Wooden flooring", "Two car parks"]},
    {"title": "Khosbagan Studio Suite", "zone": "Khosbagan", "property_type": "apartment", "bedrooms": 1, "bathrooms": 1, "area_sqft": 620, "price_inr": 2400000, "description": "Compact studio ideal for young professionals or rental yield. Fully furnished delivery option.", "highlights": ["Furnished option", "Rental ready", "Compact layout", "Prime lane"]},
    {"title": "Bajepratappur Family 3BHK", "zone": "Bajepratappur", "property_type": "apartment", "bedrooms": 3, "bathrooms": 2, "area_sqft": 1320, "price_inr": 5400000, "description": "Family-oriented society flat with children's play area and community hall on premises.", "highlights": ["Play area", "Community hall", "Gated society", "Backup power"]},
    {"title": "Parbirhata Commercial Space", "zone": "Parbirhata", "property_type": "commercial", "area_sqft": 850, "price_inr": 6200000, "description": "Ground-floor commercial cabin on main road. Ideal for clinic, boutique or franchise outlet.", "highlights": ["Ground floor", "Main road", "Signage rights", "Shutter frontage"]},
    {"title": "Alisha Farmhouse Plot", "zone": "Alisha", "property_type": "plot", "area_sqft": 5400, "price_inr": 5800000, "description": "Weekend-home farmhouse plot with pond frontage. Mango and litchi trees on site.", "highlights": ["Pond frontage", "Fruit trees", "Weekend home", "5400 sqft"]},
    {"title": "Baburbag Heritage 3BHK", "zone": "Baburbag", "property_type": "villa", "bedrooms": 3, "bathrooms": 3, "area_sqft": 2100, "price_inr": 10800000, "description": "Restored heritage-style villa with modern interiors, hand-crafted mouldings and mosaic flooring.", "highlights": ["Heritage design", "Mosaic flooring", "Restored", "Private courtyard"]},
    {"title": "Sripally Skyline 2BHK", "zone": "Sripally", "property_type": "apartment", "bedrooms": 2, "bathrooms": 2, "area_sqft": 1080, "price_inr": 4600000, "description": "New-launch 2BHK with contemporary layout, ready for possession in 6 months.", "highlights": ["New launch", "Possession soon", "RERA approved", "Smart layout"]},
]

async def ensure_seed():
    count = await db.properties.count_documents({})
    if count >= 12:
        return
    await db.properties.delete_many({})
    docs = []
    for i, p in enumerate(SEED_PROPERTIES):
        prop = Property(
            **p,
            image=PROP_IMGS[i % len(PROP_IMGS)],
            gallery=[PROP_IMGS[(i + k) % len(PROP_IMGS)] for k in range(1, 4)],
        ).model_dump()
        prop["created_at"] = prop["created_at"].isoformat()
        docs.append(prop)
    await db.properties.insert_many(docs)

@app.on_event("startup")
async def _startup():
    await ensure_seed()

# =============== Public content ===============
@api.get("/")
async def root():
    return {"service": "Urbanex Realty API", "status": "ok"}

@api.get("/config/public")
async def public_config():
    return {
        "zones": BURDWAN_ZONES,
        "whatsapp": "919933333333",
        "brand": {"name": "Urbanex Realty", "founder": "Ayan Dey", "city": "Burdwan"},
    }

@api.get("/properties")
async def list_properties(zone: Optional[str] = None, property_type: Optional[str] = None):
    q = {}
    if zone: q["zone"] = zone
    if property_type: q["property_type"] = property_type
    items = await db.properties.find(q, {"_id": 0}).to_list(200)
    return items

@api.get("/properties/{pid}")
async def get_property(pid: str):
    item = await db.properties.find_one({"id": pid}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Property not found")
    return item

# =============== Auth ===============
@api.post("/auth/session")
async def auth_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id required")
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(401, "Invalid session")
    data = r.json()
    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(400, "No email returned")
    is_admin = email in ADMIN_EMAILS
    # Upsert user
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": data.get("name") or email.split("@")[0],
            "picture": data.get("picture"),
            "is_admin": is_admin,
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(dict(user))
        # Create lead for non-admins
        if not is_admin:
            lead = Lead(
                name=user["name"],
                email=email,
                source_page="google_login",
                property_interest="signup",
                message="Auto-captured on Google login",
            ).model_dump()
            lead["created_at"] = lead["created_at"].isoformat()
            lead["updated_at"] = lead["updated_at"].isoformat()
            await db.leads.insert_one(lead)
    else:
        # keep admin flag fresh
        await db.users.update_one({"email": email}, {"$set": {"is_admin": is_admin, "picture": data.get("picture")}})
        user["is_admin"] = is_admin

    session_token = data.get("session_token") or new_id("sess_")
    expires_at = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": now_utc().isoformat(),
    })
    response.set_cookie(
        "session_token", session_token,
        max_age=7 * 24 * 60 * 60, httponly=True, secure=True, samesite="none", path="/",
    )
    return {
        "user": {"user_id": user["user_id"], "email": user["email"], "name": user["name"], "picture": user.get("picture"), "is_admin": is_admin},
        "session_token": session_token,
    }

@api.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return {"user_id": user["user_id"], "email": user["email"], "name": user["name"], "picture": user.get("picture"), "is_admin": user.get("is_admin", False)}

@api.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# =============== Leads ===============
@api.post("/leads")
async def create_lead(payload: LeadCreate):
    lead = Lead(**payload.model_dump()).model_dump()
    lead["created_at"] = lead["created_at"].isoformat()
    lead["updated_at"] = lead["updated_at"].isoformat()
    await db.leads.insert_one(dict(lead))
    return {"ok": True, "id": lead["id"]}

@api.get("/admin/leads")
async def admin_leads(request: Request, status: Optional[str] = None, source: Optional[str] = None, q: Optional[str] = None):
    await require_admin(request)
    query = {}
    if status: query["status"] = status
    if source: query["source_page"] = source
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"property_interest": {"$regex": q, "$options": "i"}},
            {"message": {"$regex": q, "$options": "i"}},
        ]
    items = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items

@api.patch("/admin/leads/{lid}")
async def update_lead(lid: str, patch: LeadUpdate, request: Request):
    await require_admin(request)
    update = {k: v for k, v in patch.model_dump().items() if v is not None}
    update["updated_at"] = now_utc().isoformat()
    r = await db.leads.update_one({"id": lid}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Lead not found")
    doc = await db.leads.find_one({"id": lid}, {"_id": 0})
    return doc

@api.post("/admin/leads/{lid}/notes")
async def add_note(lid: str, note: NoteCreate, request: Request):
    user = await require_admin(request)
    entry = {"id": new_id("note_"), "text": note.text, "author": user["email"], "created_at": now_utc().isoformat()}
    r = await db.leads.update_one({"id": lid}, {"$push": {"notes": entry}, "$set": {"updated_at": now_utc().isoformat()}})
    if r.matched_count == 0:
        raise HTTPException(404, "Lead not found")
    return entry

@api.post("/admin/leads/{lid}/transcribe")
async def transcribe(lid: str, request: Request, audio: UploadFile = File(...)):
    user = await require_admin(request)
    audio_bytes = await audio.read()
    # Use Emergent LLM key + OpenAI Whisper via emergentintegrations
    text = ""
    try:
        from emergentintegrations.llm.openai.whisper import OpenAIWhisper  # type: ignore
        w = OpenAIWhisper(api_key=EMERGENT_LLM_KEY)
        text = await w.transcribe_audio(audio_bytes=audio_bytes, filename=audio.filename or "note.webm")
    except Exception as e:
        # Fallback: store note anyway
        text = f"[Transcription unavailable: {type(e).__name__}]"
    entry = {"id": new_id("note_"), "text": text, "author": user["email"], "voice": True, "created_at": now_utc().isoformat()}
    await db.leads.update_one({"id": lid}, {"$push": {"notes": entry}, "$set": {"updated_at": now_utc().isoformat()}})
    return entry

@api.post("/admin/leads/semantic")
async def semantic_search(payload: SemanticSearch, request: Request):
    await require_admin(request)
    leads = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    if not leads:
        return {"matches": [], "reasoning": "No leads yet."}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        import json as _json
        # Build compact index
        compact = [
            {"id": l["id"], "name": l.get("name"), "interest": l.get("property_interest"),
             "message": l.get("message"), "status": l.get("status"), "tags": l.get("tags", [])}
            for l in leads[:200]
        ]
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"semantic_{new_id()}",
            system_message="You are a CRM assistant. Given a natural-language filter and a JSON list of leads, return ONLY a JSON array of matching lead IDs, most relevant first. No prose.",
        ).with_model("openai", "gpt-4o-mini")
        msg = UserMessage(text=f"Query: {payload.query}\nLeads: {_json.dumps(compact)}\nReturn: JSON array of ids only.")
        raw = await chat.send_message(msg)
        # Extract array
        import re
        m = re.search(r"\[.*\]", raw, re.S)
        ids = _json.loads(m.group(0)) if m else []
        matches = [l for l in leads if l["id"] in ids]
        # preserve order
        order = {i: idx for idx, i in enumerate(ids)}
        matches.sort(key=lambda x: order.get(x["id"], 999))
        return {"matches": matches, "reasoning": "AI-matched"}
    except Exception as e:
        # Fallback: substring search
        q = payload.query.lower()
        matches = [l for l in leads if q in (l.get("message") or "").lower() or q in (l.get("property_interest") or "").lower() or q in (l.get("name") or "").lower()]
        return {"matches": matches, "reasoning": f"Keyword fallback ({type(e).__name__})"}

@api.get("/admin/leads/export")
async def export_leads(request: Request):
    await require_admin(request)
    leads = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    import csv, io
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "name", "phone", "email", "source_page", "property_interest", "status", "message", "created_at"])
    for l in leads:
        w.writerow([l.get("id"), l.get("name"), l.get("phone"), l.get("email"), l.get("source_page"), l.get("property_interest"), l.get("status"), l.get("message"), l.get("created_at")])
    return Response(content=buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=urbanex_leads.csv"})

# =============== Reports ===============
@api.get("/admin/reports/overview")
async def reports_overview(request: Request):
    await require_admin(request)
    leads = await db.leads.find({}, {"_id": 0}).to_list(5000)
    # Aggregations
    by_status: dict = {}
    by_source: dict = {}
    by_interest: dict = {}
    by_day: dict = {}
    for l in leads:
        by_status[l.get("status", "new")] = by_status.get(l.get("status", "new"), 0) + 1
        by_source[l.get("source_page", "unknown")] = by_source.get(l.get("source_page", "unknown"), 0) + 1
        interest = (l.get("property_interest") or "unspecified").lower()
        by_interest[interest] = by_interest.get(interest, 0) + 1
        d = (l.get("created_at") or "")[:10]
        if d:
            by_day[d] = by_day.get(d, 0) + 1
    # Zone heat from properties + leads (using property_interest matched to zones)
    props = await db.properties.find({}, {"_id": 0}).to_list(500)
    zones = {p["zone"]: 0 for p in props}
    for l in leads:
        pi = (l.get("property_interest") or "").lower()
        for z in list(zones.keys()):
            if z.lower() in pi:
                zones[z] += 1
    return {
        "total_leads": len(leads),
        "by_status": [{"name": k, "value": v} for k, v in by_status.items()],
        "by_source": [{"name": k, "value": v} for k, v in by_source.items()],
        "by_interest": [{"name": k, "value": v} for k, v in by_interest.items()],
        "by_day": [{"date": k, "value": v} for k, v in sorted(by_day.items())],
        "zones_heat": [{"zone": k, "value": v} for k, v in sorted(zones.items(), key=lambda x: -x[1])[:12]],
    }

# =============== Invoices ===============
@api.get("/admin/invoices")
async def list_invoices(request: Request):
    await require_admin(request)
    items = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items

@api.post("/admin/invoices")
async def create_invoice(payload: InvoiceCreate, request: Request):
    await require_admin(request)
    count = await db.invoices.count_documents({})
    number = f"URBX-{now_utc().year}-{count + 1:04d}"
    inv = Invoice(invoice_number=number, **payload.model_dump()).model_dump()
    inv["created_at"] = inv["created_at"].isoformat()
    await db.invoices.insert_one(dict(inv))
    return inv

# =============== YouTube ===============
@api.get("/videos")
async def get_videos():
    cache = await db.videos_cache.find_one({"_id": "youtube_latest"})
    now = now_utc()
    if cache:
        try:
            fetched = datetime.fromisoformat(cache["fetched_at"])
            if fetched.tzinfo is None:
                fetched = fetched.replace(tzinfo=timezone.utc)
            if now - fetched < timedelta(hours=6):
                return cache.get("videos", [])
        except Exception:
            pass
    videos = await _fetch_youtube_videos()
    if videos:
        await db.videos_cache.update_one(
            {"_id": "youtube_latest"},
            {"$set": {"videos": videos, "fetched_at": now.isoformat()}},
            upsert=True,
        )
    else:
        # fallback list
        videos = _fallback_videos()
    return videos

def _fallback_videos():
    return [
        {"video_id": "dQw4w9WgXcQ", "title": "Urbanex Site Walkthrough — Renaissance Township", "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", "published": "2025-10-01"},
        {"video_id": "9bZkp7q19f0", "title": "Kalibazar Villa Tour", "thumbnail": "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg", "published": "2025-09-10"},
        {"video_id": "M7lc1UVf-VE", "title": "Construction Timelapse — Goda Duplex", "thumbnail": "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg", "published": "2025-08-20"},
    ]

async def _fetch_youtube_videos():
    if not YOUTUBE_API_KEY:
        return []
    handle = YOUTUBE_HANDLE.lstrip("@")
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            # Resolve channel id from handle
            ch = await hc.get("https://www.googleapis.com/youtube/v3/channels", params={
                "part": "contentDetails,snippet", "forHandle": handle, "key": YOUTUBE_API_KEY,
            })
            data = ch.json()
            items = data.get("items", [])
            if not items:
                # try search fallback
                s = await hc.get("https://www.googleapis.com/youtube/v3/search", params={
                    "part": "snippet", "q": handle, "type": "channel", "key": YOUTUBE_API_KEY, "maxResults": 1,
                })
                sdata = s.json()
                if not sdata.get("items"):
                    return []
                channel_id = sdata["items"][0]["snippet"]["channelId"]
                ch2 = await hc.get("https://www.googleapis.com/youtube/v3/channels", params={
                    "part": "contentDetails", "id": channel_id, "key": YOUTUBE_API_KEY,
                })
                items = ch2.json().get("items", [])
                if not items:
                    return []
            uploads_playlist = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]
            pl = await hc.get("https://www.googleapis.com/youtube/v3/playlistItems", params={
                "part": "snippet", "playlistId": uploads_playlist, "maxResults": 12, "key": YOUTUBE_API_KEY,
            })
            pldata = pl.json()
            vids = []
            for it in pldata.get("items", []):
                sn = it["snippet"]
                vids.append({
                    "video_id": sn["resourceId"]["videoId"],
                    "title": sn["title"],
                    "thumbnail": (sn.get("thumbnails", {}).get("high") or sn.get("thumbnails", {}).get("default") or {}).get("url"),
                    "published": sn.get("publishedAt", "")[:10],
                })
            return vids
    except Exception as e:
        logging.warning(f"YouTube fetch failed: {e}")
        return []

# ---------- Include ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
