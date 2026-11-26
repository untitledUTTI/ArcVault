use serde::Serialize;
use tauri::AppHandle;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BiometricCheckResult {
    pub available: bool,
    pub label: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BiometricAuthResult {
    pub ok: bool,
    pub message: String,
}

#[tauri::command]
pub fn trigger_haptic(
    app: AppHandle,
    pattern: String,
    intensity: String,
) -> bool {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        use tauri_plugin_haptics::HapticsExt;
        if intensity == "off" {
            return false;
        }
        let haptics = app.haptics();
        let res = match pattern.as_str() {
            "selection" => haptics.selection_feedback(),
            "success" => haptics.notification_feedback(
                tauri_plugin_haptics::NotificationFeedbackType::Success,
            ),
            "warning" => haptics.notification_feedback(
                tauri_plugin_haptics::NotificationFeedbackType::Warning,
            ),
            "error" => haptics.notification_feedback(
                tauri_plugin_haptics::NotificationFeedbackType::Error,
            ),
            "heavy" => haptics.impact_feedback(
                tauri_plugin_haptics::ImpactFeedbackStyle::Heavy,
            ),
            "medium" => haptics.impact_feedback(if intensity == "gentle" {
                tauri_plugin_haptics::ImpactFeedbackStyle::Light
            } else {
                tauri_plugin_haptics::ImpactFeedbackStyle::Medium
            }),
            _ => haptics.impact_feedback(tauri_plugin_haptics::ImpactFeedbackStyle::Light),
        };
        return res.is_ok();
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let _ = (app, pattern, intensity);
        false
    }
}

#[tauri::command]
pub fn biometric_check_available() -> BiometricCheckResult {
    #[cfg(target_os = "macos")]
    {
        return BiometricCheckResult {
            available: false,
            label: "macOS LocalAuthentication / Passkey（前端 WebAuthn Passkey 已就绪）".into(),
        };
    }
    #[cfg(target_os = "windows")]
    {
        return BiometricCheckResult {
            available: false,
            label: "Windows Hello / Passkey（前端 WebAuthn Passkey 已就绪）".into(),
        };
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        return BiometricCheckResult {
            available: false,
            label: "系统生物识别（FaceID / TouchID / Android Biometric，前端 Passkey 已就绪）".into(),
        };
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "android", target_os = "ios")))]
    {
        BiometricCheckResult {
            available: false,
            label: "平台生物识别不可用".into(),
        }
    }
}

#[tauri::command]
pub fn biometric_authenticate(_reason: String) -> BiometricAuthResult {
    BiometricAuthResult {
        ok: false,
        message: "请使用平台 Passkey 或输入保险箱主密码解锁".into(),
    }
}
