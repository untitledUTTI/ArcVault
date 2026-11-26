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
