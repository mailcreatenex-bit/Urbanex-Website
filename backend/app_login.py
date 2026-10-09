"""Signing in from the Urbanex Recorder phone app.

Google refuses to sign people in inside an app's embedded browser, so the app opens the website in the phone's own browser instead. After
Google sign-in, the website asks for a one-time token (valid for two minutes) and hands it to the app through a link that opens the app.
The app swaps the token for an ordinary session cookie. No password or key is stored on the phone, and a token works only once.
"""
import hashlib
import secrets
from datetime import timedelta

from fastapi import HTTPException, Request, Response
from pydantic import BaseModel, Field

import server as S

TOKEN_MINUTES = 2
APP_SESSION_DAYS = 30


@S.api.post("/auth/app-token")
async def app_token(request: Request):
    """A signed-in person asks for a one-time token to carry into the phone app."""
    S.rate_limit(request, "app_token", 20)
    user = await S.require_user(request)
    token = secrets.token_urlsafe(32)
    await S.db.app_tokens.insert_one({"hash": hashlib.sha256(token.encode()).hexdigest(), "user_id": user["user_id"], "used": False,
                                      "expires_at": S.now_utc() + timedelta(minutes=TOKEN_MINUTES), "created_at": S.now_utc().isoformat()})
    return {"token": token, "expires_in": TOKEN_MINUTES * 60}


class ExchangeIn(BaseModel):
    token: str = Field(min_length=20, max_length=100)


@S.api.post("/auth/app-exchange")
async def app_exchange(payload: ExchangeIn, request: Request, response: Response):
    """The app swaps the one-time token for a session cookie."""
    S.rate_limit(request, "app_exchange", 20)
    digest = hashlib.sha256(payload.token.encode()).hexdigest()
    row = await S.db.app_tokens.find_one_and_update({"hash": digest, "used": False}, {"$set": {"used": True}})     # claimed in one step: it can only be used once
    if not row or S.parse_dt(row["expires_at"]) < S.now_utc():
        raise HTTPException(401, "This sign-in link has expired. Sign in again from the app.")
    user = await S.db.users.find_one({"user_id": row["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "Account not found")
    session_token = S.new_id("sess_") + secrets.token_urlsafe(16)
    await S.db.user_sessions.insert_one({"user_id": user["user_id"], "session_token": session_token, "expires_at": S.now_utc() + timedelta(days=APP_SESSION_DAYS),
                                         "created_at": S.now_utc().isoformat(), "via": "phone_app"})
    response.set_cookie("session_token", session_token, max_age=APP_SESSION_DAYS * 86400, httponly=True, secure=True, samesite=S.COOKIE_SAMESITE, path="/")
    return {"ok": True, "name": user.get("name"), "is_admin": bool(user.get("is_admin"))}
