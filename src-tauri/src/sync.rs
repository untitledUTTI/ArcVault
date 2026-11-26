use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{IpAddr, UdpSocket};
use std::sync::{Arc, Mutex};
use tauri::State;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::oneshot;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncHttpRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncHttpResponse {
    pub status: u16,
    pub ok: bool,
    pub body: String,
    pub headers: HashMap<String, String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanSyncStartInfo {
    pub running: bool,
    pub port: u16,
    pub local_ips: Vec<String>,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanSyncStatusInfo {
    pub running: bool,
    pub port: u16,
    pub local_ips: Vec<String>,
    pub received_count: usize,
    pub latest_envelope: Option<String>,
}

pub struct LanSyncServerState {
    shutdown_tx: Mutex<Option<oneshot::Sender<()>>>,
    port: Mutex<u16>,
    pin: Arc<Mutex<String>>,
    latest_envelope: Arc<Mutex<Option<String>>>,
    received_count: Arc<Mutex<usize>>,
}

impl LanSyncServerState {
    pub fn new() -> Self {
        Self {
            shutdown_tx: Mutex::new(None),
            port: Mutex::new(47820),
            pin: Arc::new(Mutex::new("264780".to_string())),
            latest_envelope: Arc::new(Mutex::new(None)),
            received_count: Arc::new(Mutex::new(0)),
        }
    }
}

fn detect_local_lan_ips() -> Vec<String> {
    let mut ips = Vec::new();
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                if let IpAddr::V4(ip) = addr.ip() {
                    ips.push(ip.to_string());
                }
            }
        }
    }
    if ips.is_empty() {
        ips.push("127.0.0.1".to_string());
    }
    ips
}

#[tauri::command]
pub async fn sync_http_request(req: SyncHttpRequest) -> Result<SyncHttpResponse, String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;
    let method = reqwest::Method::from_bytes(req.method.as_bytes()).map_err(|e| e.to_string())?;
    let mut builder = client.request(method, &req.url);
    for (k, v) in req.headers {
        builder = builder.header(k, v);
    }
    if let Some(body) = req.body {
        builder = builder.body(body);
    }
    let resp = builder.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let ok = resp.status().is_success();
    let mut headers = HashMap::new();
    for (k, v) in resp.headers() {
        if let Ok(val) = v.to_str() {
            headers.insert(k.as_str().to_lowercase(), val.to_string());
        }
    }
    let body = resp.text().await.unwrap_or_default();
    Ok(SyncHttpResponse {
        status,
        ok,
        body,
        headers,
    })
}

#[tauri::command]
pub async fn lan_sync_start_server(
    state: State<'_, LanSyncServerState>,
    port: u16,
    pin: String,
) -> Result<LanSyncStartInfo, String> {
    if let Some(tx) = state.shutdown_tx.lock().unwrap().take() {
        let _ = tx.send(());
    }

    *state.port.lock().unwrap() = port;
    *state.pin.lock().unwrap() = pin;

    let addr = format!("0.0.0.0:{port}");
    let listener = TcpListener::bind(&addr).await.map_err(|e| e.to_string())?;
    let (tx, mut rx) = oneshot::channel::<()>();
    *state.shutdown_tx.lock().unwrap() = Some(tx);

    let pin_ref = Arc::clone(&state.pin);
    let latest_ref = Arc::clone(&state.latest_envelope);
    let count_ref = Arc::clone(&state.received_count);

    tauri::async_runtime::spawn(async move {
        loop {
            tokio::select! {
                _ = &mut rx => break,
                accepted = listener.accept() => {
                    let Ok((mut stream, _)) = accepted else { continue };
                    let pin_inner = Arc::clone(&pin_ref);
                    let latest_inner = Arc::clone(&latest_ref);
                    let count_inner = Arc::clone(&count_ref);
                    tauri::async_runtime::spawn(async move {
                        let mut buf = vec![0u8; 256 * 1024];
                        let n = match stream.read(&mut buf).await {
                            Ok(n) if n > 0 => n,
                            _ => return,
                        };
                        let raw = String::from_utf8_lossy(&buf[..n]);
                        let mut parts = raw.splitn(2, "\r\n\r\n");
                        let head = parts.next().unwrap_or("");
                        let body = parts.next().unwrap_or("");
                        let first_line = head.lines().next().unwrap_or("");

                        let expected_pin = pin_inner.lock().unwrap().clone();
                        let pin_ok = head.lines().any(|line| {
                            let lower = line.to_ascii_lowercase();
                            lower.starts_with("x-arcvault-pin:")
                                && line.splitn(2, ':').nth(1).map(|v| v.trim() == expected_pin).unwrap_or(false)
                        });

                        let (status_line, resp_body) = if first_line.starts_with("GET /arcvault/sync/ping") {
                            ("HTTP/1.1 200 OK", "{\"ok\":true,\"app\":\"ArcVault\"}")
                        } else if first_line.starts_with("POST /arcvault/sync/envelope") {
                            if !pin_ok {
                                ("HTTP/1.1 401 Unauthorized", "{\"error\":\"PIN mismatch\"}")
                            } else {
                                *latest_inner.lock().unwrap() = Some(body.to_string());
                                *count_inner.lock().unwrap() += 1;
                                ("HTTP/1.1 200 OK", "{\"ok\":true}")
                            }
                        } else {
                            ("HTTP/1.1 404 Not Found", "{\"error\":\"Not Found\"}")
                        };

                        let reply = format!(
                            "{status_line}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{resp_body}",
                            resp_body.len()
                        );
                        let _ = stream.write_all(reply.as_bytes()).await;
                    });
                }
            }
        }
    });

    let local_ips = detect_local_lan_ips();
    Ok(LanSyncStartInfo {
        running: true,
        port,
        local_ips: local_ips.clone(),
        message: format!(
            "已开启局域网 E2EE 直连监听：{}:{}",
            local_ips.first().cloned().unwrap_or_else(|| "127.0.0.1".into()),
            port
        ),
    })
}

#[tauri::command]
pub fn lan_sync_stop_server(state: State<'_, LanSyncServerState>) -> String {
    if let Some(tx) = state.shutdown_tx.lock().unwrap().take() {
        let _ = tx.send(());
    }
    "已停止局域网直连监听".into()
}

#[tauri::command]
pub fn lan_sync_status(state: State<'_, LanSyncServerState>) -> LanSyncStatusInfo {
    let running = state.shutdown_tx.lock().unwrap().is_some();
    let port = *state.port.lock().unwrap();
    let received_count = *state.received_count.lock().unwrap();
    let latest_envelope = state.latest_envelope.lock().unwrap().clone();
    LanSyncStatusInfo {
        running,
        port,
        local_ips: detect_local_lan_ips(),
        received_count,
        latest_envelope,
    }
}
