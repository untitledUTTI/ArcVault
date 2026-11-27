package com.arcvault.app

import android.os.Build
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.isHapticFeedbackEnabled = true
    webView.addJavascriptInterface(ArcNativeHaptics(webView), "__ARC_ANDROID_HAPTICS__")
  }
}

private class ArcNativeHaptics(private val webView: WebView) {
  @JavascriptInterface
  fun trigger(pattern: String, intensity: String): Boolean {
    if (intensity == "off") return false
    val gentle = intensity == "gentle"
    val feedbackConstant = when (pattern) {
      "selection" -> HapticFeedbackConstants.CLOCK_TICK
      "light" -> HapticFeedbackConstants.KEYBOARD_TAP
      "medium" -> if (gentle) {
        HapticFeedbackConstants.KEYBOARD_TAP
      } else {
        HapticFeedbackConstants.CONTEXT_CLICK
      }
      "heavy" -> if (gentle) {
        HapticFeedbackConstants.CONTEXT_CLICK
      } else {
        HapticFeedbackConstants.LONG_PRESS
      }
      "success" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        HapticFeedbackConstants.CONFIRM
      } else {
        HapticFeedbackConstants.CONTEXT_CLICK
      }
      "warning" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        HapticFeedbackConstants.REJECT
      } else {
        HapticFeedbackConstants.VIRTUAL_KEY
      }
      "error" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        HapticFeedbackConstants.REJECT
      } else {
        HapticFeedbackConstants.LONG_PRESS
      }
      else -> HapticFeedbackConstants.KEYBOARD_TAP
    }

    webView.post {
      @Suppress("DEPRECATION")
      webView.performHapticFeedback(
        feedbackConstant,
        HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING,
      )
    }
    return true
  }
}
