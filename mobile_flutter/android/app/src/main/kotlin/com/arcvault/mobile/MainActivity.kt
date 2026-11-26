package com.arcvault.mobile

import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {
    private val shareChannelName = "com.arcvault.mobile/share_intake"
    private var pendingSharePayload: Map<String, String?>? = null
    private var shareChannel: MethodChannel? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        // Edge-to-Edge: keep status bar and gesture nav bar visible while extending
        // app theme & liquid glass backdrop seamlessly behind them.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }

        handleShareIntent(intent, notifyFlutter = false)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleShareIntent(intent, notifyFlutter = true)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, shareChannelName)
        shareChannel = channel
        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "consumeInitialShare" -> {
                    result.success(pendingSharePayload)
                    pendingSharePayload = null
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun handleShareIntent(intent: Intent?, notifyFlutter: Boolean) {
        if (intent == null) return
        if (intent.action == Intent.ACTION_SEND) {
            val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
            val text = intent.getStringExtra(Intent.EXTRA_TEXT)
            if (!subject.isNullOrBlank() || !text.isNullOrBlank()) {
                val payload = mapOf(
                    "title" to subject,
                    "text" to text,
                )
                if (notifyFlutter && shareChannel != null) {
                    shareChannel?.invokeMethod("onShareReceived", payload)
                } else {
                    pendingSharePayload = payload
                }
            }
        }
    }
}
