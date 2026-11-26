mod cas;
mod commands;
mod mobile;
mod sync;
mod watcher;

use cas::VaultStorage;
use commands::AppState;
use std::path::PathBuf;
use std::sync::Mutex;
use sync::LanSyncServerState;
use tauri::{Manager, WebviewWindowBuilder};
use watcher::FolderWatcherState;

fn write_startup_log(msg: &str) {
    let log_path = std::env::temp_dir().join("arcvault_startup.log");
    let _ = std::fs::write(log_path, msg.as_bytes());
}

fn initialize_storage_with_fallback(app: &tauri::App) -> Result<VaultStorage, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(dir) = app.path().app_data_dir() {
        candidates.push(dir.join("arcvault_data"));
    }
    if let Ok(dir) = app.path().app_local_data_dir() {
        candidates.push(dir.join("arcvault_data"));
    }
    candidates.push(std::env::temp_dir().join("arcvault_data"));

    let mut errors: Vec<String> = Vec::new();
    for dir in candidates {
        match VaultStorage::initialize(dir.clone()) {
            Ok(storage) => return Ok(storage),
            Err(err) => errors.push(format!("{}: {err}", dir.display())),
        }
    }

    let joined = errors.join(" | ");
    write_startup_log(&format!("ArcVault CAS storage init failed: {joined}"));
    Err(format!("failed to initialize ArcVault CAS storage: {joined}"))
}

fn create_main_window_with_fallback(app: &tauri::App) -> tauri::Result<()> {
    let Some(win_cfg) = app.config().app.windows.first().cloned() else {
        return Ok(());
    };

    #[cfg(target_os = "windows")]
    {
        let local_base = app
            .path()
            .app_local_data_dir()
            .unwrap_or_else(|_| std::env::temp_dir().join("com.arcvault.app"));
        let pid = std::process::id();

        #[cfg(debug_assertions)]
        let primary_dir = local_base.join("webview_debug");
        #[cfg(not(debug_assertions))]
        let primary_dir = local_base.join("webview_release");

        let candidates = [
            primary_dir,
            local_base.join(format!("webview_session_{pid}")),
            std::env::temp_dir().join(format!("arcvault_webview_{pid}")),
        ];

        let mut last_err: Option<tauri::Error> = None;
        for dir in candidates {
            let _ = std::fs::create_dir_all(&dir);
            let builder = WebviewWindowBuilder::from_config(app.handle(), &win_cfg)?
                .decorations(false)
                .data_directory(dir);
            match builder.build() {
                Ok(_) => return Ok(()),
                Err(err) => last_err = Some(err),
            }
        }

        let err = last_err.unwrap_or_else(|| tauri::Error::WindowNotFound);
        write_startup_log(&format!("ArcVault main window creation failed: {err}"));
        return Err(err);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let builder = WebviewWindowBuilder::from_config(app.handle(), &win_cfg)?;
        #[cfg(target_os = "linux")]
        let builder = builder.decorations(false);
        builder.build()?;
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(any(target_os = "android", target_os = "ios"))]
    let builder = builder.plugin(tauri_plugin_haptics::init());

    builder
        .setup(|app| {
            let storage = initialize_storage_with_fallback(app).map_err(|e| {
                std::io::Error::new(std::io::ErrorKind::Other, e)
            })?;

            app.manage(AppState {
                storage: Mutex::new(storage),
                watcher: FolderWatcherState::new(),
            });
            app.manage(LanSyncServerState::new());

            create_main_window_with_fallback(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_runtime_info,
            commands::cas_put_object,
            commands::cas_get_object,
            commands::start_watch_folder,
            commands::stop_watch_folder,
            commands::write_exported_file,
            mobile::trigger_haptic,
            mobile::biometric_check_available,
            mobile::biometric_authenticate,
            sync::sync_http_request,
            sync::lan_sync_start_server,
            sync::lan_sync_stop_server,
            sync::lan_sync_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ArcVault Tauri application");
}
