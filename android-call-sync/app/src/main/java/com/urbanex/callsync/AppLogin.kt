package com.urbanex.callsync

import android.webkit.CookieManager
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Signing in and out of the website inside the app. */
object AppLogin {
    private val http = OkHttpClient.Builder()
        .connectTimeout(70, TimeUnit.SECONDS) // the free server can take about a minute to wake up
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    /** Swaps the one-time token from the website for a session cookie and gives that cookie to the in-app browser. */
    fun exchange(base: String, token: String): Boolean {
        val body = JSONObject().put("token", token).toString().toRequestBody("application/json".toMediaType())
        val req = Request.Builder().url("$base/api/auth/app-exchange").post(body).build()
        return try {
            http.newCall(req).execute().use { r ->
                if (r.code != 200) return false
                val cookies = r.headers("Set-Cookie")
                if (cookies.isEmpty()) return false
                val cm = CookieManager.getInstance()
                cookies.forEach { cm.setCookie(base, it) }
                cm.flush()
                true
            }
        } catch (e: IOException) {
            false
        }
    }

    fun logout(base: String) {
        val cm = CookieManager.getInstance()
        val cookie = cm.getCookie(base) ?: ""
        try {
            val req = Request.Builder().url("$base/api/auth/logout").header("Cookie", cookie).header("Origin", base)
                .post("{}".toRequestBody("application/json".toMediaType())).build()
            http.newCall(req).execute().close()
        } catch (e: IOException) {
            // the local sign-out below still works
        }
        cm.removeAllCookies(null)
        cm.flush()
    }
}
