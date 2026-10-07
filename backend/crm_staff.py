"""CRM team mode: add people who help you, give each new lead to whoever has the most room, move leads nobody answered, and see how everyone is doing.

A team member signs in with Google like anyone else; being on this list lets them into the CRM for THEIR leads only
(see STAFF_RULES in server.py). Everything else stays yours.
"""
import asyncio
import logging
from datetime import timedelta
from typing import List, Optional

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field

import server as S


async def team_settings() -> dict:
    doc = await S.db.settings.find_one({"_id": "crm_team"}, {"_id": 0}) or {}
    return {"auto_assign": doc.get("auto_assign", True), "rebalance_minutes": doc.get("rebalance_minutes", 30), "cursor": doc.get("cursor", 0)}


async def open_counts() -> dict:
    out: dict = {}
    async for l in S.db.leads.find({"status": {"$nin": ["closed", "lost"]}, "spam": {"$ne": True}, "owner_email": {"$ne": None}}, {"_id": 0, "owner_email": 1}):
        out[l["owner_email"]] = out.get(l["owner_email"], 0) + 1
    return out


async def pick_owner(exclude: Optional[str] = None) -> Optional[str]:
    """The team member with the fewest open leads who still has room. None means: keep it for yourself."""
    staff = [m async for m in S.db.staff.find({"active": True}, {"_id": 0})]
    if not staff:
        return None
    counts = await open_counts()
    cands = [m for m in staff if m["email"] != exclude and counts.get(m["email"], 0) < m.get("capacity", 40)]
    if not cands:
        return None
    cands.sort(key=lambda m: (counts.get(m["email"], 0), m["email"]))
    return cands[0]["email"]


async def assign_hook(lead_id: str, created: bool):
    if not created:
        return
    cfg = await team_settings()
    if not cfg["auto_assign"]:
        return
    lead = await S.db.leads.find_one({"id": lead_id}, {"_id": 0, "owner_email": 1, "spam": 1, "name": 1, "phone": 1, "property_interest": 1})
    if not lead or lead.get("owner_email") or lead.get("spam"):
        return
    owner = await pick_owner()
    if not owner:
        return
    await S.db.leads.update_one({"id": lead_id, "owner_email": None}, {"$set": {"owner_email": owner}, "$push": {"activities": S.stamp_activity("assigned", f"Given to {owner}", by="automation")}})
    S.spawn(S.send_email([owner], f"New lead for you: {lead['name']}", f"{lead['name']} {lead.get('phone') or ''}\n{lead.get('property_interest') or ''}\n\nOpen the CRM: {S.PUBLIC_SITE_URL}/admin/leads?lead={lead_id}"))


S.LEAD_HOOKS.append(assign_hook)


async def rebalance_pass() -> int:
    """A lead nobody has answered for a while moves to someone else; everything a removed team member had is given out again."""
    cfg = await team_settings()
    now = S.now_utc()
    moved = 0
    active = {m["email"] async for m in S.db.staff.find({"active": True}, {"_id": 0, "email": 1})}
    async for l in S.db.leads.find({"owner_email": {"$ne": None}, "status": {"$nin": ["closed", "lost"]}, "spam": {"$ne": True}}, {"_id": 0}):
        gone = l["owner_email"] not in active
        stuck = (l.get("status") == "new" and not l.get("first_contacted_at") and not l.get("reassigned_at")
                 and (now - S.parse_dt(l["created_at"])) > timedelta(minutes=cfg["rebalance_minutes"]))
        if not (gone or stuck):
            continue
        new = await pick_owner(exclude=l["owner_email"])
        await S.db.leads.update_one({"id": l["id"]}, {"$set": {"owner_email": new, "reassigned_at": now.isoformat()},
                                                      "$push": {"activities": S.stamp_activity("assigned", f"Moved from {l['owner_email']} to {new or 'you'}: " + ("no longer on the team" if gone else "no reply in time"), by="automation")}})
        if new:
            S.spawn(S.send_email([new], f"A lead was given to you: {l['name']}", f"{l['name']} {l.get('phone') or ''}\n\n{S.PUBLIC_SITE_URL}/admin/leads?lead={l['id']}"))
        else:
            await S.notify_admin("lead_waiting", f"{l['name']} came back to you", "Nobody on the team could take it", link=f"/admin/leads?lead={l['id']}")
        moved += 1
    return moved


async def team_loop():
    while True:
        try:
            await rebalance_pass()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logging.warning(f"Team rebalance failed: {type(e).__name__}: {S.redact(str(e))}")
        await asyncio.sleep(300)


S.EXT_LOOPS.append(team_loop)


class StaffIn(BaseModel):
    email: str = Field(max_length=200, pattern=S.EMAIL_RE)
    name: str = Field(min_length=1, max_length=80)
    active: bool = True
    capacity: int = Field(default=40, ge=1, le=500)


@S.api.get("/admin/crm/team")
async def team_list(request: Request):
    await S.require_admin(request)
    counts = await open_counts()
    month = S.now_utc().astimezone(S.ZoneInfo("Asia/Kolkata")).replace(day=1, hour=0, minute=0, second=0, microsecond=0).astimezone(S.timezone.utc).isoformat()
    out = []
    async for m in S.db.staff.find({}, {"_id": 0}).sort("name", 1):
        mine = [l async for l in S.db.leads.find({"owner_email": m["email"]}, {"_id": 0, "status": 1, "first_contacted_at": 1, "created_at": 1, "closed_at": 1, "spam": 1})]
        waits = [(S.parse_dt(l["first_contacted_at"]) - S.parse_dt(l["created_at"])).total_seconds() / 60 for l in mine if l.get("first_contacted_at") and not l.get("spam")]
        out.append({**m, "open": counts.get(m["email"], 0), "untouched": sum(1 for l in mine if l.get("status") == "new" and not l.get("first_contacted_at")),
                    "closed_this_month": sum(1 for l in mine if l.get("status") == "closed" and (l.get("closed_at") or "") >= month),
                    "avg_first_reply_minutes": round(sum(waits) / len(waits)) if waits else None})
    return {"members": out, "settings": await team_settings(), "unassigned": await S.db.leads.count_documents({"owner_email": None, "status": {"$nin": ["closed", "lost"]}, "spam": {"$ne": True}})}


@S.api.post("/admin/crm/team")
async def team_add(payload: StaffIn, request: Request):
    await S.require_admin(request)
    email = payload.email.lower()
    doc = {**payload.model_dump(), "email": email, "created_at": S.now_utc().isoformat()}
    await S.db.staff.update_one({"email": email}, {"$set": doc}, upsert=True)
    return doc


@S.api.patch("/admin/crm/team/{email}")
async def team_edit(email: str, payload: StaffIn, request: Request):
    await S.require_admin(request)
    r = await S.db.staff.update_one({"email": email.lower()}, {"$set": {"name": payload.name, "active": payload.active, "capacity": payload.capacity}})
    if r.matched_count == 0:
        raise HTTPException(404, "Team member not found")
    return {"ok": True}


@S.api.delete("/admin/crm/team/{email}")
async def team_remove(email: str, request: Request):
    await S.require_admin(request)
    await S.db.staff.delete_one({"email": email.lower()})
    await rebalance_pass()                        # their leads are given out again straight away
    return {"ok": True}


class TeamSettingsIn(BaseModel):
    auto_assign: Optional[bool] = None
    rebalance_minutes: Optional[int] = Field(default=None, ge=5, le=1440)


@S.api.put("/admin/crm/team/settings")
async def team_settings_save(payload: TeamSettingsIn, request: Request):
    await S.require_admin(request)
    data = payload.model_dump(exclude_none=True)
    if data:
        await S.db.settings.update_one({"_id": "crm_team"}, {"$set": data}, upsert=True)
    return await team_settings()


class AssignIn(BaseModel):
    ids: List[str] = Field(min_length=1, max_length=300)
    owner_email: Optional[str] = Field(default=None, max_length=200)      # empty = keep them for yourself


@S.api.post("/admin/leads/bulk-assign")
async def bulk_assign(payload: AssignIn, request: Request):
    await S.require_admin(request)
    owner = payload.owner_email.lower() if payload.owner_email else None
    if owner and not await S.db.staff.find_one({"email": owner}, {"_id": 1}):
        raise HTTPException(404, "Team member not found")
    r = await S.db.leads.update_many({"id": {"$in": payload.ids}}, {"$set": {"owner_email": owner}})
    return {"changed": r.modified_count}
