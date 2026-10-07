"""The offline test files share one in-memory database. New test files take a snapshot first and put it back afterwards."""
TOUCHED = ("properties", "leads", "videos", "call_logs", "listing_matches", "notifications", "contacts", "interests", "listing_payments", "visits", "posts", "land_reports",
           "inbox_log", "messages", "outbox", "partners", "submissions", "users", "user_sessions", "watchlist", "spend", "weekly_reports", "staff")
SETTINGS = ["listing_settings", "drive_calls", "crm", "crm_sequences", "crm_auto", "crm_spend", "imap", "auto_merge", "crm_staff", "blog", "land_report", "crm_templates"]


async def snapshot(server):
    return {name: {str(d["_id"]) async for d in server.db[name].find({}, {"_id": 1})} for name in TOUCHED}


async def restore(server, before):
    for name, ids in before.items():
        async for d in server.db[name].find({}, {"_id": 1}):
            if str(d["_id"]) not in ids:
                await server.db[name].delete_one({"_id": d["_id"]})
    await server.db.settings.delete_many({"_id": {"$in": SETTINGS}})
