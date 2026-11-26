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
    #[allow(dead_code)]
    pub db_path: PathBuf,
}

impl VaultStorage {
    pub fn initialize(root_dir: PathBuf) -> Result<Self, String> {
        let objects_dir = root_dir.join("objects");
        let covers_dir = root_dir.join("covers");
        fs::create_dir_all(&objects_dir).map_err(|e| e.to_string())?;
        fs::create_dir_all(&covers_dir).map_err(|e| e.to_string())?;

        let db_path = root_dir.join("vault.db");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        init_schema(&conn).map_err(|e| e.to_string())?;

        Ok(Self {
            root_dir,
            objects_dir,
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
