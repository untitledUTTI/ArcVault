use crate::cas::{CasPutResult, VaultStorage};
use crate::watcher::FolderWatcherState;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, State};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfo {
    pub is_tauri: bool,
    pub platform: String,
    pub vault_dir: String,
    pub backup_dir: String,
}

pub struct AppState {
    pub storage: Mutex<VaultStorage>,
    pub watcher: FolderWatcherState,
}

#[tauri::command]
pub fn get_runtime_info(state: State<'_, AppState>) -> RuntimeInfo {
    let storage = state.storage.lock().unwrap();
    RuntimeInfo {
        is_tauri: true,
        platform: format!("Tauri 2.0 ({} / {})", std::env::consts::OS, std::env::consts::ARCH),
        vault_dir: storage.root_dir.to_string_lossy().to_string(),
        backup_dir: storage.backups_dir.to_string_lossy().to_string(),
    }
}

#[tauri::command]
pub fn cas_put_object(state: State<'_, AppState>, content: String) -> Result<CasPutResult, String> {
    let storage = state.storage.lock().unwrap();
    storage.put_text(&content)
}

#[tauri::command]
pub fn cas_get_object(state: State<'_, AppState>, hash: String) -> Result<String, String> {
    let storage = state.storage.lock().unwrap();
    storage.get_text(&hash)
}

#[tauri::command]
pub fn start_watch_folder(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    state.watcher.start(app, PathBuf::from(path))
}

#[tauri::command]
pub fn stop_watch_folder(state: State<'_, AppState>) -> String {
    state.watcher.stop();
    "已停止后台目录监听".into()
}

#[tauri::command]
pub fn write_exported_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    fs::write(path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_workspace_backup(
    state: State<'_, AppState>,
    content: String,
    scheduled: bool,
) -> Result<String, String> {
    let storage = state.storage.lock().unwrap();
    let latest_path = storage.save_workspace_state(&content)?;
    if scheduled {
        storage.write_scheduled_backup(&content, 20)
    } else {
        Ok(latest_path)
    }
}

#[tauri::command]
pub fn load_workspace_backup(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let storage = state.storage.lock().unwrap();
    storage.load_workspace_state()
}

#[tauri::command]
pub fn open_backup_folder(state: State<'_, AppState>) -> Result<String, String> {
    let dir = {
        let storage = state.storage.lock().unwrap();
        fs::create_dir_all(&storage.backups_dir).map_err(|e| e.to_string())?;
        storage.backups_dir.clone()
    };

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("explorer")
                .arg(&dir)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg(&dir)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(all(unix, not(target_os = "macos")))]
        {
            std::process::Command::new("xdg-open")
                .arg(&dir)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_vault_folder(state: State<'_, AppState>) -> Result<String, String> {
    let dir = {
        let storage = state.storage.lock().unwrap();
        fs::create_dir_all(&storage.root_dir).map_err(|e| e.to_string())?;
        storage.root_dir.clone()
    };

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("explorer")
                .arg(&dir)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg(&dir)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(all(unix, not(target_os = "macos")))]
        {
            std::process::Command::new("xdg-open")
                .arg(&dir)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_custom_vault_dir(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<RuntimeInfo, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("缓存目录路径不能为空".into());
    }
    let next_root = PathBuf::from(trimmed);
    let new_storage = {
        let current = state.storage.lock().unwrap();
        current.migrate_to(next_root)?
    };
    crate::save_custom_vault_dir_config(&app, Some(trimmed))?;

    let info = RuntimeInfo {
        is_tauri: true,
        platform: format!("Tauri 2.0 ({} / {})", std::env::consts::OS, std::env::consts::ARCH),
        vault_dir: new_storage.root_dir.to_string_lossy().to_string(),
        backup_dir: new_storage.backups_dir.to_string_lossy().to_string(),
    };
    *state.storage.lock().unwrap() = new_storage;
    Ok(info)
}

#[tauri::command]
pub async fn pick_vault_directory(app: AppHandle) -> Result<Option<String>, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        use tauri_plugin_dialog::DialogExt;
        let picked = tauri::async_runtime::spawn_blocking(move || {
            app.dialog()
                .file()
                .set_title("选择 ArcVault 缓存与备份目录")
                .blocking_pick_folder()
        })
        .await
        .map_err(|e| e.to_string())?;
        Ok(picked.map(|p| p.to_string()))
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        let _ = app;
        Ok(None)
    }
}

#[tauri::command]
pub async fn pick_local_model_file(app: AppHandle) -> Result<Option<String>, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        use tauri_plugin_dialog::DialogExt;
        let picked = tauri::async_runtime::spawn_blocking(move || {
            app.dialog()
                .file()
                .set_title("选择本地模型文件")
                .add_filter(
                    "Model Files",
                    &["gguf", "onnx", "safetensors", "bin", "pt", "pth", "mlmodel", "tflite"],
                )
                .blocking_pick_file()
        })
        .await
        .map_err(|e| e.to_string())?;
        Ok(picked.map(|p| p.to_string()))
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        let _ = app;
        Ok(None)
    }
}

#[tauri::command]
pub async fn pick_local_model_directory(app: AppHandle) -> Result<Option<String>, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        use tauri_plugin_dialog::DialogExt;
        let picked = tauri::async_runtime::spawn_blocking(move || {
            app.dialog()
                .file()
                .set_title("选择本地模型目录")
                .blocking_pick_folder()
        })
        .await
        .map_err(|e| e.to_string())?;
        Ok(picked.map(|p| p.to_string()))
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        let _ = app;
        Ok(None)
    }
}
