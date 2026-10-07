"""Stays awake on a free host that puts the server to sleep after 15 quiet minutes.

When KEEPALIVE_URL is set (the server's own public address, for example https://urbanex-api.onrender.com), the server asks for its own
front page every 10 minutes. That request comes in from outside, through the host's front door, so the host sees traffic and does not
put the server to sleep. Nothing is sent anywhere else. Leave KEEPALIVE_URL empty on a paid or always-on server.
"""
import asyncio
import logging
import os

import httpx

import server as S

KEEPALIVE_URL = os.environ.get("KEEPALIVE_URL", "").strip().rstrip("/")
EVERY_SECONDS = 600


async def ping_once(url: str) -> int:
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as hc:
        r = await hc.get(f"{url}/api/")
    return r.status_code


async def keepalive_loop():
    if not KEEPALIVE_URL:
        return
    await asyncio.sleep(120)
    while True:
        try:
            await ping_once(KEEPALIVE_URL)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logging.warning(f"Keep-alive ping failed: {type(e).__name__}")
        await asyncio.sleep(EVERY_SECONDS)


S.EXT_LOOPS.append(keepalive_loop)
