package com.urbanex.callsync

import android.content.Context

/** Everything the app remembers: where to send, the key, which folder to watch, and which files were already sent. */
object Prefs {
    private fun sp(c: Context) = c.getSharedPreferences("callsync", Context.MODE_PRIVATE)

    fun url(c: Context): String = sp(c).getString("url", "https://urbanex-realty.netlify.app") ?: ""
    fun key(c: Context): String = sp(c).getString("key", "") ?: ""
    fun folder(c: Context): String = sp(c).getString("folder", "") ?: ""
    fun since(c: Context): Long = sp(c).getLong("since", 0L)
    fun status(c: Context): String = sp(c).getString("status", "Not started yet") ?: ""
    fun sentCount(c: Context): Int = sp(c).getInt("sent", 0)

    /** The business SIM: only calls made or received on it are sent. -1 means "every call on this phone". */
    fun simSub(c: Context): Int = sp(c).getInt("simSub", -1)
    fun simIcc(c: Context): String = sp(c).getString("simIcc", "") ?: ""
    fun simLabel(c: Context): String = sp(c).getString("simLabel", "All calls on this phone") ?: ""

    fun setSim(c: Context, sub: Int, icc: String, label: String) {
        sp(c).edit().putInt("simSub", sub).putString("simIcc", icc).putString("simLabel", label).apply()
    }

    fun loggedIn(c: Context): Boolean = sp(c).getBoolean("loggedIn", false)
    fun setLoggedIn(c: Context, v: Boolean) {
        sp(c).edit().putBoolean("loggedIn", v).apply()
    }

    /** "urbanex.example.com/" and " https://urbanex.example.com " both become "https://urbanex.example.com". */
    fun normalizeUrl(raw: String): String {
        val t = raw.trim().trimEnd('/')
        return if (t.isEmpty() || t.startsWith("http://") || t.startsWith("https://")) t else "https://$t"
    }

    fun save(c: Context, url: String, key: String, folder: String, sinceMs: Long) {
        sp(c).edit()
            .putString("url", normalizeUrl(url))
            .putString("key", key.trim())
            .putString("folder", folder)
            .putLong("since", sinceMs)
            .apply()
    }

    fun setStatus(c: Context, text: String) {
        sp(c).edit().putString("status", text).apply()
    }

    fun addSent(c: Context) {
        sp(c).edit().putInt("sent", sentCount(c) + 1).apply()
    }

    fun done(c: Context): MutableSet<String> = HashSet(sp(c).getStringSet("done", emptySet()) ?: emptySet())

    fun markDone(c: Context, id: String) {
        val set = done(c)
        if (set.size > 2000) set.clear() // the server ignores a file it has already heard, so forgetting is harmless
        set.add(id)
        sp(c).edit().putStringSet("done", set).apply()
    }
}
