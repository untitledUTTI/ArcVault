use rusqlite::{Connection, Result as SqlResult};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize)]
pub struct CasPutResult {
    pub hash: String,
    pub deduplicated: bool,
}

pub struct VaultStorage {
    pub root_dir: PathBuf,
    pub objects_dir: PathBuf,
    pub backups_dir: PathBuf,
    #[allow(dead_code)]
    pub db_path: PathBuf,
}

impl VaultStorage {
    pub fn initialize(root_dir: PathBuf) -> Result<Self, String> {
        let objects_dir = root_dir.join("objects");
        let covers_dir = root_dir.join("covers");
        let backups_dir = root_dir.join("backups");
        fs::create_dir_all(&objects_dir).map_err(|e| e.to_string())?;
        fs::create_dir_all(&covers_dir).map_err(|e| e.to_string())?;
        fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;

        let db_path = root_dir.join("vault.db");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        init_schema(&conn).map_err(|e| e.to_string())?;

        Ok(Self {
            root_dir,
            objects_dir,
            backups_dir,
            db_path,
        })
    }

    /// Stores UTF-8 content into BLAKE3 content-addressed bucket `objects/<xx>/<hash>.blob`
    pub fn put_text(&self, content: &str) -> Result<CasPutResult, String> {
        let hash = blake3::hash(content.as_bytes()).to_hex().to_string();
        let shard = &hash[..2];
        let shard_dir = self.objects_dir.join(shard);
        fs::create_dir_all(&shard_dir).map_err(|e| e.to_string())?;

        let blob_path = shard_dir.join(format!("{hash}.blob"));
        let existed = Path::new(&blob_path).exists();
        if !existed {
            fs::write(&blob_path, content.as_bytes()).map_err(|e| e.to_string())?;
        }

        Ok(CasPutResult {
            hash,
            deduplicated: existed,
        })
    }

    pub fn get_text(&self, hash: &str) -> Result<String, String> {
        if hash.len() < 4 {
            return Err("Invalid CAS hash".into());
        }
        let shard = &hash[..2];
        let blob_path = self.objects_dir.join(shard).join(format!("{hash}.blob"));
        fs::read_to_string(blob_path).map_err(|e| e.to_string())
    }

    pub fn save_workspace_state(&self, content: &str) -> Result<String, String> {
        let target = self.root_dir.join("workspace-latest.json");
        let tmp = self.root_dir.join("workspace-latest.json.tmp");
        fs::write(&tmp, content.as_bytes()).map_err(|e| e.to_string())?;
        if let Err(err) = fs::rename(&tmp, &target) {
            let _ = fs::remove_file(&tmp);
            fs::write(&target, content.as_bytes()).map_err(|e| format!("{err}; fallback: {e}"))?;
        }
        Ok(target.to_string_lossy().to_string())
    }

    pub fn load_workspace_state(&self) -> Result<Option<String>, String> {
        let target = self.root_dir.join("workspace-latest.json");
        if !target.exists() {
            return Ok(None);
        }
        fs::read_to_string(target).map(Some).map_err(|e| e.to_string())
    }

    pub fn write_scheduled_backup(&self, content: &str, max_keep: usize) -> Result<String, String> {
        fs::create_dir_all(&self.backups_dir).map_err(|e| e.to_string())?;
        let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
        let filename = format!("backup-{stamp}.json");
        let target = self.backups_dir.join(&filename);
        fs::write(&target, content.as_bytes()).map_err(|e| e.to_string())?;

        if max_keep > 0 {
            if let Ok(entries) = fs::read_dir(&self.backups_dir) {
                let mut files: Vec<PathBuf> = entries
                    .filter_map(|e| e.ok().map(|entry| entry.path()))
                    .filter(|p| {
                        p.file_name()
                            .and_then(|n| n.to_str())
                            .map(|n| n.starts_with("backup-") && n.ends_with(".json"))
                            .unwrap_or(false)
                    })
                    .collect();
                files.sort();
                if files.len() > max_keep {
                    let remove_count = files.len() - max_keep;
                    for old in files.into_iter().take(remove_count) {
                        let _ = fs::remove_file(old);
                    }
                }
            }
        }

        Ok(target.to_string_lossy().to_string())
    }

    pub fn migrate_to(&self, new_root: PathBuf) -> Result<Self, String> {
        if new_root == self.root_dir {
            return Self::initialize(new_root);
        }
        let target_storage = Self::initialize(new_root.clone())?;

        let latest_src = self.root_dir.join("workspace-latest.json");
        let latest_dst = new_root.join("workspace-latest.json");
        if latest_src.exists() && !latest_dst.exists() {
            let _ = fs::copy(&latest_src, &latest_dst);
        }

        for sub in ["objects", "covers", "backups"] {
            let src_dir = self.root_dir.join(sub);
            let dst_dir = new_root.join(sub);
            if src_dir.exists() {
                let _ = copy_dir_missing(&src_dir, &dst_dir);
            }
        }

        Ok(target_storage)
    }
}

fn copy_dir_missing(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    let entries = fs::read_dir(src).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_missing(&src_path, &dst_path)?;
        } else if !dst_path.exists() {
            let _ = fs::copy(&src_path, &dst_path);
        }
    }
    Ok(())
}

fn init_schema(conn: &Connection) -> SqlResult<()> {
    let _ = conn.execute_batch("PRAGMA journal_mode = WAL;");
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS spaces (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            name TEXT NOT NULL,
            ai_policy TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            space_id TEXT NOT NULL,
            title TEXT NOT NULL,
            source_ext TEXT NOT NULL,
            cover_end_block INTEGER NOT NULL DEFAULT 0,
            is_sealed INTEGER NOT NULL DEFAULT 0,
            sealed_hash TEXT,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS snapshots (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            branch_id TEXT NOT NULL,
            parent_id TEXT,
            content_hash TEXT NOT NULL,
            markdown_hash TEXT NOT NULL,
            latex_hash TEXT NOT NULL,
            label TEXT NOT NULL,
            is_milestone INTEGER NOT NULL DEFAULT 0,
            word_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS snapshots_fts USING fts5(
            snapshot_id UNINDEXED,
            document_id UNINDEXED,
            body_text
        );
        ",
    )
}
