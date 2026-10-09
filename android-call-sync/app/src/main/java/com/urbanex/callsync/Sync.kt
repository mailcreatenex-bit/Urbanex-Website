package com.urbanex.callsync

import android.content.Context
import android.net.Uri
import android.provider.ContactsContract
import androidx.documentfile.provider.DocumentFile
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okio.BufferedSink
import okio.source
import java.io.IOException
import java.text.SimpleDateFormat
import java.time.Instant
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

/** Looks in the recordings folder, and sends every new call recording to the Urbanex server. */
object Sync {
    private val AUDIO = mapOf(
        "mp3" to "audio/mpeg",
        "m4a" to "audio/mp4",
        "aac" to "audio/aac",
        "wav" to "audio/wav",
        "ogg" to "audio/ogg",
        "oga" to "audio/ogg",
        "opus" to "audio/ogg",
        "flac" to "audio/flac",
    )
    private const val MAX_BYTES = 14L * 1024 * 1024
    private const val SETTLE_MS = 20_000L // a file still being written is left for the next round

    private val http = OkHttpClient.Builder()
        .connectTimeout(70, TimeUnit.SECONDS) // the free server can take about a minute to wake up
        .writeTimeout(120, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .build()

    /** Returns true when everything that could be sent was sent (or nothing is waiting); false means "try again later". */
    fun run(c: Context): Boolean {
        val url = Prefs.url(c)
        val key = Prefs.key(c)
        val folder = Prefs.folder(c)
        if (url.isEmpty() || key.isEmpty() || folder.isEmpty()) {
            Prefs.setStatus(c, "Set the address, the key and the recordings folder first.")
            return true
        }
        val root = DocumentFile.fromTreeUri(c, Uri.parse(folder))
        if (root == null || !root.canRead()) {
            Prefs.setStatus(c, "Cannot read the recordings folder. Choose it again.")
            return true
        }
        val since = Prefs.since(c)
        val now = System.currentTimeMillis()
        val done = Prefs.done(c)
        var sent = 0
        var failed = false
        var waiting = 0
        for (f in listAudio(root, 2)) {
            val id = "${f.uri}|${f.length()}|${f.lastModified()}"
            if (id in done || f.lastModified() < since) continue
            if (now - f.lastModified() < SETTLE_MS) {
                waiting++
                continue
            }
            if (f.length() > MAX_BYTES || f.length() <= 0) {
                Prefs.markDone(c, id)
                continue
            }
            when (upload(c, url, key, f)) {
                Outcome.SENT -> {
                    Prefs.markDone(c, id)
                    Prefs.addSent(c)
                    sent++
                }
                Outcome.SKIP -> Prefs.markDone(c, id)
                Outcome.WRONG_KEY -> {
                    Prefs.setStatus(c, "The server refused the key. Check the key in the app.")
                    return true
                }
                Outcome.RETRY -> failed = true
            }
        }
        val stamp = SimpleDateFormat("d MMM, HH:mm", Locale.getDefault()).format(Date())
        val message = when {
            failed -> "$stamp: server not reachable, will try again."
            sent > 0 -> "$stamp: sent $sent new recording(s). Total sent: ${Prefs.sentCount(c)}."
            waiting > 0 -> "$stamp: waiting for a recording to finish."
            else -> "$stamp: nothing new. Total sent: ${Prefs.sentCount(c)}."
        }
        Prefs.setStatus(c, message)
        return !failed
    }

    private fun listAudio(dir: DocumentFile, depth: Int): List<DocumentFile> {
        val out = ArrayList<DocumentFile>()
        for (f in dir.listFiles()) {
            if (f.isDirectory) {
                if (depth > 0) out.addAll(listAudio(f, depth - 1))
            } else {
                val ext = (f.name ?: "").substringAfterLast('.', "").lowercase(Locale.ROOT)
                if (ext in AUDIO) out.add(f)
            }
        }
        return out
    }

    private enum class Outcome { SENT, SKIP, WRONG_KEY, RETRY }

    private fun upload(c: Context, base: String, key: String, f: DocumentFile): Outcome {
        val name = f.name ?: "recording.m4a"
        val ext = name.substringAfterLast('.', "").lowercase(Locale.ROOT)
        val type = (AUDIO[ext] ?: "application/octet-stream").toMediaType()
        val body = object : RequestBody() {
            override fun contentType() = type
            override fun contentLength() = f.length()
            override fun writeTo(sink: BufferedSink) {
                c.contentResolver.openInputStream(f.uri)?.source()?.use { sink.writeAll(it) }
            }
        }
        val form = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("file", name, body)
            .addFormDataPart("started_at", Instant.ofEpochMilli(f.lastModified()).toString())
        // Many phones name the file after the contact, not the number: look the number up in your contacts
        val compact = name.replace(Regex("[\\s\\-+()]"), "")
        if (!Regex("\\d{10}").containsMatchIn(compact)) {
            contactNumber(c, name)?.let { form.addFormDataPart("phone", it) }
        }
        val req = Request.Builder()
            .url("$base/api/calls/device-upload")
            .header("X-Webhook-Key", key)
            .post(form.build())
            .build()
        return try {
            http.newCall(req).execute().use { r ->
                when (r.code) {
                    200, 202 -> Outcome.SENT
                    401, 403 -> Outcome.WRONG_KEY
                    413, 415, 422 -> Outcome.SKIP
                    else -> Outcome.RETRY
                }
            }
        } catch (e: IOException) {
            Outcome.RETRY
        } catch (e: SecurityException) {
            Outcome.RETRY
        }
    }

    /** A file called "Call recording Rahul Sen_230101_101010.m4a" gives the number saved for "Rahul Sen", if the contacts permission was given. */
    private fun contactNumber(c: Context, fileName: String): String? {
        val cleaned = fileName.substringBeforeLast('.')
            .replace(Regex("(?i)call\\s*recording|incoming|outgoing|voice|rec"), " ")
            .replace(Regex("[_\\-]?\\d{6,}[_\\-\\d]*"), " ")
            .replace('_', ' ')
            .trim()
            .replace(Regex("\\s+"), " ")
        if (cleaned.length < 2) return null
        return try {
            c.contentResolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
                "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} = ? COLLATE NOCASE",
                arrayOf(cleaned),
                null,
            )?.use { if (it.moveToFirst()) it.getString(0) else null }
        } catch (e: SecurityException) {
            null
        }
    }
}
