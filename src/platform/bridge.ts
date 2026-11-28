import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const WEB_CUSTOM_CACHE_DIR_KEY = 'arcvault_custom_cache_dir_v1';

export async function nativeGetRuntimeInfo(): Promise<{
  isTauri: boolean;
  platform: string;
  vaultDir: string;
  backupDir: string;
}> {
  if (!isTauriRuntime()) {
    let customLabel: string | null = null;
    try {
      customLabel = localStorage.getItem(WEB_CUSTOM_CACHE_DIR_KEY);
    } catch {
      customLabel = null;
    }
    const base = customLabel?.trim() || 'Browser IndexedDB / LocalStorage';
    return {
      isTauri: false,
      platform: 'Web Preview (Vite)',
      vaultDir: base,
      backupDir: customLabel?.trim()
        ? `${customLabel.trim()}/backups (IndexedDB)`
        : 'Browser IndexedDB (自动草稿与定时快照)',
    };
  }
  return invoke('get_runtime_info');
}

export async function nativeOpenVaultFolder(): Promise<{
  ok: boolean;
  path: string;
  message?: string;
}> {
  if (!isTauriRuntime()) {
    return {
      ok: false,
      path: 'Browser IndexedDB',
      message: 'Web/浏览器预览模式数据保存在浏览器 IndexedDB 中，无法直接打开系统文件夹。',
    };
  }
  try {
    const path = await invoke<string>('open_vault_folder');
    return { ok: true, path };
  } catch (err) {
    return {
      ok: false,
      path: '',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function nativePickVaultDirectory(): Promise<string | null> {
  if (isTauriRuntime()) {
    try {
      return await invoke<string | null>('pick_vault_directory');
    } catch {
      return null;
    }
  }
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<{ name: string }> })
    .showDirectoryPicker;
  if (typeof picker === 'function') {
    try {
      const handle = await picker();
      return handle?.name ? `浏览器授权目录：${handle.name}` : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function nativePickLocalModelFile(): Promise<string | null> {
  if (isTauriRuntime()) {
    try {
      return await invoke<string | null>('pick_local_model_file');
    } catch {
      return null;
    }
  }
  return null;
}

export async function nativePickLocalModelDirectory(): Promise<string | null> {
  if (isTauriRuntime()) {
    try {
      return await invoke<string | null>('pick_local_model_directory');
    } catch {
      return null;
    }
  }
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<{ name: string }> })
    .showDirectoryPicker;
  if (typeof picker === 'function') {
    try {
      const handle = await picker();
      return handle?.name ? handle.name : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function nativeSetCustomVaultDir(path: string): Promise<{
  isTauri: boolean;
  platform: string;
  vaultDir: string;
  backupDir: string;
}> {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error('缓存目录路径不能为空');
  }
  if (!isTauriRuntime()) {
    try {
      localStorage.setItem(WEB_CUSTOM_CACHE_DIR_KEY, trimmed);
    } catch {
      // ignore storage quota
    }
    return {
      isTauri: false,
      platform: 'Web Preview (Vite)',
      vaultDir: trimmed,
      backupDir: `${trimmed}/backups (IndexedDB)`,
    };
  }
  return invoke('set_custom_vault_dir', { path: trimmed });
}

export async function nativeSaveWorkspaceBackup(
  content: string,
  scheduled: boolean,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await invoke<string>('save_workspace_backup', { content, scheduled });
  } catch {
    return null;
  }
}

export async function nativeLoadWorkspaceBackup(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await invoke<string | null>('load_workspace_backup');
  } catch {
    return null;
  }
}

export async function nativeOpenBackupFolder(): Promise<{
  ok: boolean;
  path: string;
  message?: string;
}> {
  if (!isTauriRuntime()) {
    return {
      ok: false,
      path: 'Browser IndexedDB',
      message: 'Web 预览模式数据保存在浏览器 IndexedDB 中，无法直接打开本地文件夹；可使用“立即导出备份”下载到本地。',
    };
  }
  try {
    const path = await invoke<string>('open_backup_folder');
    return { ok: true, path };
  } catch (err) {
    return {
      ok: false,
      path: '',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function nativeStartWatchFolder(folderPath: string): Promise<string> {
  if (!isTauriRuntime()) {
    return `Web 预览模式：已模拟监听目录 ${folderPath}`;
  }
  return invoke('start_watch_folder', { path: folderPath });
}

export async function nativeStopWatchFolder(): Promise<string> {
  if (!isTauriRuntime()) {
    return '已停止监听';
  }
  return invoke('stop_watch_folder');
}

export async function nativePutCasObject(
  content: string,
): Promise<{ hash: string; deduplicated: boolean }> {
  if (!isTauriRuntime()) {
    throw new Error('Not running in Tauri runtime');
  }
  return invoke('cas_put_object', { content });
}

export async function nativeTriggerHaptic(
  pattern: string,
  intensity: string,
): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    return await invoke<boolean>('trigger_haptic', { pattern, intensity });
  } catch {
    return false;
  }
}

export async function nativeBiometricCheck(): Promise<{
  available: boolean;
  label: string;
}> {
  if (!isTauriRuntime()) {
    return { available: false, label: 'Web 运行时' };
  }
  try {
    return await invoke<{ available: boolean; label: string }>(
      'biometric_check_available',
    );
  } catch {
    return { available: false, label: '不可用' };
  }
}

export async function nativeBiometricAuthenticate(
  reason: string,
): Promise<{ ok: boolean; message: string }> {
  if (!isTauriRuntime()) {
    return { ok: false, message: '当前非原生宿主环境' };
  }
  try {
    return await invoke<{ ok: boolean; message: string }>(
      'biometric_authenticate',
      { reason },
    );
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface NativeSyncHttpResponse {
  status: number;
  ok: boolean;
  body: string;
  headers: Record<string, string>;
}

export async function nativeSyncHttpRequest(req: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}): Promise<NativeSyncHttpResponse> {
  if (!isTauriRuntime()) {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
    const text = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    return {
      status: res.status,
      ok: res.ok,
      body: text,
      headers,
    };
  }
  return invoke<NativeSyncHttpResponse>('sync_http_request', { req });
}

export async function nativeLanSyncStart(
  port: number,
  pin: string,
): Promise<{ running: boolean; port: number; localIps: string[]; message: string }> {
  if (!isTauriRuntime()) {
    return {
      running: true,
      port,
      localIps: ['127.0.0.1'],
      message: `Web 预览模式已就绪（局域网真实监听需桌面/移动端 Tauri 编译启动，端口 ${port}）`,
    };
  }
  return invoke('lan_sync_start_server', { port, pin });
}

export async function nativeLanSyncStop(): Promise<string> {
  if (!isTauriRuntime()) {
    return '已停止局域网同步监听';
  }
  return invoke('lan_sync_stop_server');
}

export async function nativeLanSyncStatus(): Promise<{
  running: boolean;
  port: number;
  localIps: string[];
  receivedCount: number;
  latestEnvelope: string | null;
}> {
  if (!isTauriRuntime()) {
    return {
      running: false,
      port: 47820,
      localIps: ['127.0.0.1'],
      receivedCount: 0,
      latestEnvelope: null,
    };
  }
  return invoke('lan_sync_status');
}

export function triggerBrowserDownload(
  filename: string,
  data: Uint8Array | string,
  mime: string,
): void {
  const blobPart: BlobPart =
    typeof data === 'string'
      ? data
      : new Uint8Array(
          data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
        );
  const blob = new Blob([blobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function nativeWindowMinimize(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    await getCurrentWindow().minimize();
  } catch {
    // ignore outside desktop window
  }
}

export async function nativeWindowToggleMaximize(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    const win = getCurrentWindow();
    await win.toggleMaximize();
    return await win.isMaximized();
  } catch {
    return false;
  }
}

export async function nativeWindowClose(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    await getCurrentWindow().close();
  } catch {
    // ignore
  }
}

export async function nativeWindowIsMaximized(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  try {
    return await getCurrentWindow().isMaximized();
  } catch {
    return false;
  }
}

export async function subscribeNativeWindowResized(
  onResized: (maximized: boolean) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) return () => {};
  try {
    const win = getCurrentWindow();
    const unlisten = await win.onResized(async () => {
      try {
        onResized(await win.isMaximized());
      } catch {
        // ignore
      }
    });
    return unlisten;
  } catch {
    return () => {};
  }
}
