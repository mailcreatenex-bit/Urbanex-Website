package com.urbanex.callsync

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/** One simple screen: the server address, the key, the recordings folder, and a status line. */
class MainActivity : Activity() {
    private lateinit var url: EditText
    private lateinit var key: EditText
    private lateinit var folderText: TextView
    private lateinit var statusText: TextView
    private var folder = ""

    private fun dp(n: Int) = (n * resources.displayMetrics.density).toInt()

    private fun button(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ).apply { topMargin = dp(10) }
    }

    private fun label(text: String) = TextView(this).apply {
        this.text = text
        textSize = 13f
        setPadding(0, dp(16), 0, dp(2))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        folder = Prefs.folder(this)
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(28), dp(20), dp(28))
        }
        col.addView(TextView(this).apply {
            text = "Urbanex Recorder"
            textSize = 24f
        })
        col.addView(TextView(this).apply {
            text = "Sends every new call recording from your phone recorder folder to the Urbanex CRM, where the AI listens to it."
            setPadding(0, dp(6), 0, 0)
        })
        col.addView(label("Server address"))
        url = EditText(this).apply {
            setText(Prefs.url(this@MainActivity))
            inputType = InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine()
        }
        col.addView(url)
        col.addView(label("Key (the CALL_WEBHOOK_SECRET from the server settings)"))
        key = EditText(this).apply {
            setText(Prefs.key(this@MainActivity))
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setSingleLine()
        }
        col.addView(key)
        col.addView(label("Folder where your phone saves call recordings"))
        folderText = TextView(this).apply {
            text = if (folder.isEmpty()) "Not chosen" else Uri.decode(folder)
        }
        col.addView(folderText)
        col.addView(button("Choose the recordings folder") {
            startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), REQ_FOLDER)
        })
        col.addView(button("Save and start") { saveAndStart() })
        col.addView(button("Send new recordings now") { runNow() })
        col.addView(button("Allow it to work in the background") {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        })
        statusText = TextView(this).apply { setPadding(0, dp(22), 0, 0) }
        col.addView(statusText)
        setContentView(ScrollView(this).apply { addView(col) })
        refreshStatus()
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    private fun refreshStatus() {
        statusText.text = "Status: ${Prefs.status(this)}"
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_FOLDER && resultCode == RESULT_OK) {
            val uri = data?.data ?: return
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            folder = uri.toString()
            folderText.text = Uri.decode(folder)
        }
    }

    private fun saveAndStart() {
        if (url.text.isNullOrBlank() || key.text.isNullOrBlank() || folder.isEmpty()) {
            Toast.makeText(this, "Fill in the address, the key and choose the folder.", Toast.LENGTH_LONG).show()
            return
        }
        // only recordings made from now on are sent, unless this folder was already set up before
        val since = if (Prefs.folder(this) == folder && Prefs.since(this) > 0) Prefs.since(this) else System.currentTimeMillis()
        Prefs.save(this, url.text.toString(), key.text.toString(), folder, since)
        if (checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            // lets it find the number when the file is named after the contact
            requestPermissions(arrayOf(Manifest.permission.READ_CONTACTS), REQ_CONTACTS)
        }
        val net = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "callsync-periodic",
            ExistingPeriodicWorkPolicy.UPDATE,
            PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).setConstraints(net).build(),
        )
        Prefs.setStatus(this, "Started. New recordings are sent about every 15 minutes.")
        refreshStatus()
        runNow()
    }

    private fun runNow() {
        val net = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        WorkManager.getInstance(this).enqueueUniqueWork(
            "callsync-now",
            ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(net).build(),
        )
        Toast.makeText(this, "Checking for new recordings...", Toast.LENGTH_SHORT).show()
        statusText.postDelayed({ refreshStatus() }, 4000)
        statusText.postDelayed({ refreshStatus() }, 15000)
    }

    companion object {
        private const val REQ_FOLDER = 41
        private const val REQ_CONTACTS = 42
    }
}
