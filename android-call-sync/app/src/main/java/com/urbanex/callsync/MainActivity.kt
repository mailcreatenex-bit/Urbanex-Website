package com.urbanex.callsync

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.telephony.SubscriptionManager
import android.view.View
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.widget.doAfterTextChanged
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import java.util.concurrent.TimeUnit

/**
 * UrbanexCRM. Three tabs: Leads (the CRM) and Website (the admin), both the real website inside the app, and Calls (the recorder setup).
 * Sign-in happens in the phone's browser (Google does not allow it inside an app), then comes back through a link.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var refreshCrm: SwipeRefreshLayout
    private lateinit var refreshSite: SwipeRefreshLayout
    private lateinit var webCrm: WebView
    private lateinit var webSite: WebView
    private lateinit var loginPanel: View
    private lateinit var recorderPanel: View
    private lateinit var nav: BottomNavigationView
    private lateinit var etUrl: TextInputEditText
    private lateinit var etKey: TextInputEditText
    private lateinit var tvFolder: TextView
    private lateinit var tvSim: TextView
    private lateinit var tvSent: TextView
    private lateinit var tvStatus: TextView
    private lateinit var tvState: TextView
    private lateinit var tvKeyState: TextView
    private lateinit var tvFolderState: TextView
    private lateinit var tvSimState: TextView
    private lateinit var advancedBox: View

    private var folder = ""
    private var tab = R.id.tab_crm
    private var loadedCrm = false
    private var loadedSite = false
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var lastCheck = 0L

    private fun base() = Prefs.url(this).trimEnd('/')

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        refreshCrm = findViewById(R.id.refreshCrm)
        refreshSite = findViewById(R.id.refreshSite)
        webCrm = findViewById(R.id.webCrm)
        webSite = findViewById(R.id.webSite)
        loginPanel = findViewById(R.id.loginPanel)
        recorderPanel = findViewById(R.id.recorderPanel)
        nav = findViewById(R.id.nav)
        etUrl = findViewById(R.id.etUrl)
        etKey = findViewById(R.id.etKey)
        tvFolder = findViewById(R.id.tvFolder)
        tvSim = findViewById(R.id.tvSim)
        tvSent = findViewById(R.id.tvSent)
        tvStatus = findViewById(R.id.tvStatus)
        tvState = findViewById(R.id.tvState)
        tvKeyState = findViewById(R.id.tvKeyState)
        tvFolderState = findViewById(R.id.tvFolderState)
        tvSimState = findViewById(R.id.tvSimState)
        advancedBox = findViewById(R.id.advancedBox)

        setupWeb(webCrm, refreshCrm)
        setupWeb(webSite, refreshSite)

        folder = Prefs.folder(this)
        etUrl.setText(Prefs.url(this))
        etKey.setText(Prefs.key(this))
        tvFolder.text = folderName()
        tvSim.text = Prefs.simLabel(this)
        findViewById<View>(R.id.btnAdvanced).setOnClickListener {
            advancedBox.visibility = if (advancedBox.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        }

        etKey.doAfterTextChanged { refreshRecorder() }
        findViewById<MaterialButton>(R.id.btnLogin).setOnClickListener { startLogin() }
        findViewById<MaterialButton>(R.id.btnFolder).setOnClickListener {
            startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), REQ_FOLDER)
        }
        findViewById<MaterialButton>(R.id.btnSim).setOnClickListener { chooseSim() }
        findViewById<MaterialButton>(R.id.btnSave).setOnClickListener { saveAndStart() }
        findViewById<MaterialButton>(R.id.btnNow).setOnClickListener { runNow() }
        findViewById<MaterialButton>(R.id.btnBattery).setOnClickListener {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }
        findViewById<MaterialButton>(R.id.btnLogout).setOnClickListener { signOut() }

        nav.setOnItemSelectedListener {
            show(it.itemId)
            true
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val w = currentWeb()
                if (w != null && w.canGoBack()) {
                    w.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })

        handleLink(intent)
        val first = if (Prefs.folder(this).isEmpty() && !Prefs.loggedIn(this)) R.id.tab_recorder else R.id.tab_crm
        nav.selectedItemId = first
        show(first)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleLink(intent)
    }

    override fun onResume() {
        super.onResume()
        refreshRecorder()
        checkSession()
    }

    // ------------------------------------------------------------------ the two website tabs
    private fun currentWeb(): WebView? = when {
        tab == R.id.tab_crm && Prefs.loggedIn(this) -> webCrm
        tab == R.id.tab_site && Prefs.loggedIn(this) -> webSite
        else -> null
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWeb(web: WebView, refresh: SwipeRefreshLayout) {
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = false
        web.settings.allowContentAccess = false
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false)
        refresh.setColorSchemeResources(R.color.gold)
        refresh.setOnRefreshListener {
            val failed = web.tag as? String           // the last page could not load: try that address again
            if (failed != null) {
                web.tag = null
                web.loadUrl(failed)
            } else {
                web.reload()
            }
        }
        refresh.setOnChildScrollUpCallback { _, _ -> web.scrollY > 0 }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.scheme == "https" && u.host == Uri.parse(base()).host) return false
                // only ordinary links leave the app (WhatsApp, the dialer, maps, mail, other sites); anything else, such as intent: links, is refused
                if (u.scheme !in OPEN_OUTSIDE) return true
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, u))
                } catch (e: ActivityNotFoundException) {
                    Toast.makeText(this@MainActivity, "Nothing on this phone can open that link.", Toast.LENGTH_SHORT).show()
                }
                return true
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                refresh.isRefreshing = true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                refresh.isRefreshing = false
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (!request.isForMainFrame) return
                view.tag = request.url.toString()
                refresh.isRefreshing = false
                view.loadData(
                    "<html><body style='font-family:sans-serif;text-align:center;padding:64px 24px;color:#0A1225;background:#FDFBF7'>" +
                        "<h2>Cannot reach the server</h2><p>Check your internet, then pull down to try again.<br>" +
                        "The free server can take up to a minute to wake up.</p></body></html>",
                    "text/html", "utf-8",
                )
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(w: WebView?, callback: ValueCallback<Array<Uri>>?, params: FileChooserParams?): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                val chooser = params?.createIntent()
                if (chooser == null) {
                    fileCallback = null
                    return false
                }
                return try {
                    startActivityForResult(chooser, REQ_FILE)
                    true
                } catch (e: ActivityNotFoundException) {
                    fileCallback = null
                    false
                }
            }
        }
    }

    private fun show(id: Int) {
        tab = id
        val signedIn = Prefs.loggedIn(this)
        refreshCrm.visibility = if (id == R.id.tab_crm && signedIn) View.VISIBLE else View.GONE
        refreshSite.visibility = if (id == R.id.tab_site && signedIn) View.VISIBLE else View.GONE
        loginPanel.visibility = if (id != R.id.tab_recorder && !signedIn) View.VISIBLE else View.GONE
        recorderPanel.visibility = if (id == R.id.tab_recorder) View.VISIBLE else View.GONE
        if (signedIn) {
            if (id == R.id.tab_crm && !loadedCrm) {
                loadedCrm = true
                webCrm.loadUrl(base() + "/admin/leads")
            }
            if (id == R.id.tab_site && !loadedSite) {
                loadedSite = true
                webSite.loadUrl(base() + "/admin/properties")
            }
        }
        if (id == R.id.tab_recorder) refreshRecorder()
    }

    // ------------------------------------------------------------------ signing in
    private fun startLogin() {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(base() + "/app-login")))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "Install a web browser first.", Toast.LENGTH_LONG).show()
        }
    }

    private fun handleLink(i: Intent?) {
        if (i == null) return
        val data = i.data ?: return
        if (data.scheme != "urbanexrecorder" || data.host != "login") return
        val token = data.getQueryParameter("token") ?: return
        i.data = null // a rotation or a new window must not use the same one-time token again
        Toast.makeText(this, "Signing you in...", Toast.LENGTH_SHORT).show()
        Thread {
            val ok = AppLogin.exchange(base(), token)
            runOnUiThread {
                if (ok) {
                    Prefs.setLoggedIn(this, true)
                    loadedCrm = false
                    loadedSite = false
                    nav.selectedItemId = R.id.tab_crm
                    show(R.id.tab_crm)
                } else {
                    Toast.makeText(this, "Sign-in failed or expired. Try again.", Toast.LENGTH_LONG).show()
                }
            }
        }.start()
    }

    private fun signOut() {
        Thread {
            AppLogin.logout(base())
            runOnUiThread {
                Prefs.setLoggedIn(this, false)
                loadedCrm = false
                loadedSite = false
                webCrm.loadUrl("about:blank")
                webSite.loadUrl("about:blank")
                show(R.id.tab_recorder)
                Toast.makeText(this, "Signed out.", Toast.LENGTH_SHORT).show()
            }
        }.start()
    }

    // ------------------------------------------------------------------ the recorder tab
    private fun refreshRecorder() {
        tvSent.text = Prefs.sentCount(this).toString()
        tvStatus.text = Prefs.status(this)
        val keyOk = !etKey.text.isNullOrBlank()
        val folderOk = folder.isNotEmpty()
        mark(tvKeyState, keyOk, "To do")
        mark(tvFolderState, folderOk, "To do")
        mark(tvSimState, Prefs.simSub(this) != -1, "Optional")
        val running = Prefs.folder(this).isNotEmpty() && Prefs.key(this).isNotEmpty()
        tvState.text = if (running) "ACTIVE" else if (keyOk && folderOk) "READY: TAP START" else "SET UP NEEDED"
    }

    private fun mark(v: TextView, done: Boolean, todo: String) {
        v.text = if (done) "✓ Done" else todo
        v.setTextColor(getColor(if (done) R.color.done else R.color.gold))
    }

    /** The last part of the folder address, e.g. "Call" instead of a long content:// path. */
    private fun folderName(): String {
        if (folder.isEmpty()) return "No folder chosen"
        val d = Uri.decode(folder).trimEnd('/')
        return d.substringAfterLast(':').substringAfterLast('/').ifEmpty { d }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            REQ_FOLDER -> if (resultCode == RESULT_OK) {
                val uri = data?.data ?: return
                contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                folder = uri.toString()
                tvFolder.text = folderName()
                refreshRecorder()
            }
            REQ_FILE -> {
                fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
                fileCallback = null
            }
        }
    }

    /** Lists the SIMs in the phone; only calls on the chosen one are sent, so personal calls stay on the phone. */
    private fun chooseSim() {
        val need = arrayOf(Manifest.permission.READ_PHONE_STATE, Manifest.permission.READ_CALL_LOG)
        if (need.any { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }) {
            requestPermissions(need, REQ_SIM)
            return
        }
        val subs = try {
            getSystemService(SubscriptionManager::class.java)?.activeSubscriptionInfoList ?: emptyList()
        } catch (e: SecurityException) {
            emptyList()
        }
        val labels = ArrayList<String>()
        labels.add("All calls on this phone")
        for (i in subs) labels.add("SIM ${i.simSlotIndex + 1}: ${i.carrierName ?: ""} ${i.number ?: ""}".trim())
        AlertDialog.Builder(this).setTitle("Business SIM").setItems(labels.toTypedArray()) { _, which ->
            if (which == 0) {
                Prefs.setSim(this, -1, "", labels[0])
            } else {
                val s = subs[which - 1]
                Prefs.setSim(this, s.subscriptionId, s.iccId ?: "", labels[which])
            }
            tvSim.text = labels[which]
            refreshRecorder()
        }.show()
    }

    @Deprecated("Deprecated in Java")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_SIM && grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) chooseSim()
    }

    private fun saveAndStart() {
        if (etUrl.text.isNullOrBlank() || etKey.text.isNullOrBlank() || folder.isEmpty()) {
            Toast.makeText(this, "Please add your access key (step 1) and choose the folder (step 2).", Toast.LENGTH_LONG).show()
            return
        }
        // only recordings made from now on are sent, unless this folder was already set up before
        val since = if (Prefs.folder(this) == folder && Prefs.since(this) > 0) Prefs.since(this) else System.currentTimeMillis()
        Prefs.save(this, etUrl.text.toString(), etKey.text.toString(), folder, since)
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
        Prefs.setStatus(this, "On. New calls are sent about every 15 minutes.")
        refreshRecorder()
        runNow()
    }

    private fun runNow() {
        val net = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        WorkManager.getInstance(this).enqueueUniqueWork(
            "callsync-now",
            ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(net).build(),
        )
        Toast.makeText(this, "Looking for new calls...", Toast.LENGTH_SHORT).show()
        tvStatus.postDelayed({ refreshRecorder() }, 4000)
        tvStatus.postDelayed({ refreshRecorder() }, 15000)
    }

    /** Signed in for 30 days; if the server says the session is over (or the account lost admin rights), go back to the sign-in screen. */
    private fun checkSession() {
        if (!Prefs.loggedIn(this) || System.currentTimeMillis() - lastCheck < 10 * 60_000L) return
        lastCheck = System.currentTimeMillis()
        Thread {
            val state = AppLogin.sessionState(base())          // true = fine, false = signed out, null = could not tell (offline)
            if (state == false) {
                runOnUiThread {
                    Prefs.setLoggedIn(this, false)
                    loadedCrm = false
                    loadedSite = false
                    webCrm.loadUrl("about:blank")
                    webSite.loadUrl("about:blank")
                    show(tab)
                    Toast.makeText(this, "Your sign-in ended. Please sign in again.", Toast.LENGTH_LONG).show()
                }
            }
        }.start()
    }

    companion object {
        private val OPEN_OUTSIDE = setOf("http", "https", "tel", "mailto", "sms", "smsto", "geo", "whatsapp")
        private const val REQ_FOLDER = 41
        private const val REQ_CONTACTS = 42
        private const val REQ_SIM = 43
        private const val REQ_FILE = 44
    }
}
