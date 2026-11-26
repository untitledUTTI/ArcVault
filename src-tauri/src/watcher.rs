#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod desktop_watcher {
    use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
    use serde::Serialize;
    use std::collections::HashMap;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex};
    use tauri::{AppHandle, Emitter};

    #[derive(Clone, Serialize)]
    pub struct WatchedFileEvent {
        pub path: String,
        pub blake3_hash: String,
        pub bytes: u64,
    }

    pub struct FolderWatcherState {
        watcher: Mutex<Option<RecommendedWatcher>>,
        seen_hashes: Arc<Mutex<HashMap<String, String>>>,
    }

    impl FolderWatcherState {
        pub fn new() -> Self {
            Self {
                watcher: Mutex::new(None),
                seen_hashes: Arc::new(Mutex::new(HashMap::new())),
            }
        }

        pub fn start(&self, app: AppHandle, folder: PathBuf) -> Result<String, String> {
            self.stop();

            let hashes = Arc::clone(&self.seen_hashes);
            let mut watcher = RecommendedWatcher::new(
                move |res: Result<Event, notify::Error>| {
                    if let Ok(event) = res {
                        for p in event.paths {
                            if !p.is_file() {
                                continue;
                            }
                            if let Ok(bytes) = fs::read(&p) {
                                let hash = blake3::hash(&bytes).to_hex().to_string();
                                let key = p.to_string_lossy().to_string();
                                let mut guard = hashes.lock().unwrap();
                                if guard.get(&key) == Some(&hash) {
                                    continue;
                                }
                                guard.insert(key.clone(), hash.clone());
                                let _ = app.emit(
                                    "arcvault://watched-file-changed",
                                    WatchedFileEvent {
                                        path: key,
                                        blake3_hash: hash,
                                        bytes: bytes.len() as u64,
                                    },
                                );
                            }
                        }
                    }
                },
                Config::default(),
            )
            .map_err(|e| e.to_string())?;

            watcher
                .watch(&folder, RecursiveMode::Recursive)
                .map_err(|e| e.to_string())?;

            *self.watcher.lock().unwrap() = Some(watcher);
            Ok(format!("已开启后台目录监听：{}", folder.display()))
        }

        pub fn stop(&self) {
            *self.watcher.lock().unwrap() = None;
        }
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
mod mobile_watcher {
    use std::path::PathBuf;
    use tauri::AppHandle;

    pub struct FolderWatcherState;

    impl FolderWatcherState {
        pub fn new() -> Self {
            Self
        }

        pub fn start(&self, _app: AppHandle, _folder: PathBuf) -> Result<String, String> {
            Ok("移动端沙盒不支持后台目录监听，请使用分享入库或跨端 E2EE 同步。".into())
        }

        pub fn stop(&self) {}
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub use desktop_watcher::FolderWatcherState;

#[cfg(any(target_os = "android", target_os = "ios"))]
pub use mobile_watcher::FolderWatcherState;
