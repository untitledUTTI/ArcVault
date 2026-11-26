import type {
  ArchiveDocument,
  HlcTimestamp,
  SyncConflictItem,
  SyncSettings,
  WebdavPresetId,
} from '../../types/archive';
import { sha256Hex } from '../hash';
import { decryptVaultText, encryptVaultText } from '../vaultCrypto';
import { syncFormatText } from '../ooxml/formatConverter';
import { nativeSyncHttpRequest } from '../../platform/bridge';
import { compareHlc, createHlc } from './hlc';

export interface SyncEnvelopeDocument {
  id: string;
  spaceId: string;
  title: string;
  sourceExt: ArchiveDocument['sourceExt'];
  sourceFileName: string;
  backupFormat: ArchiveDocument['backupFormat'];
  activeFormat: ArchiveDocument['activeFormat'];
  markdownText: string;
  latexText: string;
  isSealed: boolean;
  sealedHash?: string;
  sealedAt?: string;
  updatedAt: string;
  createdAt: string;
  currentBranchId: string;
  tags: string[];
  contentHash: string;
}

export interface SyncEncryptedEnvelope {
  v: 1;
  deviceId: string;
  deviceName: string;
  hlc: HlcTimestamp;
  createdAt: string;
  docCount: number;
  encryptedPayload: string;
}

export interface SyncReconcileResult {
  added: ArchiveDocument[];
  updated: ArchiveDocument[];
  conflicts: SyncConflictItem[];
  unchangedCount: number;
}

export function generatePairingPin(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
}

export function createDefaultDeviceId(): string {
  return `dev_${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  enabled: false,
  mode: 'lan',
  deviceId: 'dev_local_primary',
  deviceName: '我的穹档工作站',
  e2eePassphrase: '',
  lanPort: 47820,
  lanPeerUrl: '',
  lanPin: '264780',
  webdavUrl: '',
  webdavUsername: '',
  webdavPassword: '',
  webdavBasePath: '/ArcVault',
  webdavPreset: 'jianguoyun',
  s3Endpoint: 'https://s3.amazonaws.com',
  s3Region: 'auto',
  s3Bucket: '',
  s3AccessKey: '',
  s3SecretKey: '',
  s3Prefix: 'arcvault/',
  syncMediaAssets: true,
  compressImagesToWebp: true,
  monthlyTrafficUsedBytes: 0,
  monthlyTrafficLimitMb: 1024,
};

export function normalizeSyncSettings(
  raw?: Partial<SyncSettings> | null,
): SyncSettings {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const sameMonth = raw?.monthlyTrafficMonth === currentMonth;
  return {
    ...DEFAULT_SYNC_SETTINGS,
    ...(raw ?? {}),
    mode:
      raw?.mode === 'lan' || raw?.mode === 'webdav' || raw?.mode === 's3'
        ? raw.mode
        : DEFAULT_SYNC_SETTINGS.mode,
    webdavPreset: raw?.webdavPreset ?? DEFAULT_SYNC_SETTINGS.webdavPreset,
    syncMediaAssets: raw?.syncMediaAssets ?? true,
    compressImagesToWebp: raw?.compressImagesToWebp ?? true,
    monthlyTrafficMonth: currentMonth,
    monthlyTrafficUsedBytes: sameMonth
      ? Math.max(0, raw?.monthlyTrafficUsedBytes ?? 0)
      : 0,
    monthlyTrafficLimitMb:
      typeof raw?.monthlyTrafficLimitMb === 'number' &&
      Number.isFinite(raw.monthlyTrafficLimitMb) &&
      raw.monthlyTrafficLimitMb >= 0
        ? raw.monthlyTrafficLimitMb
        : DEFAULT_SYNC_SETTINGS.monthlyTrafficLimitMb,
    lanPort:
      typeof raw?.lanPort === 'number' &&
      Number.isFinite(raw.lanPort) &&
      raw.lanPort >= 1024 &&
      raw.lanPort <= 65535
        ? Math.round(raw.lanPort)
        : DEFAULT_SYNC_SETTINGS.lanPort,
  };
}

export function buildLanPairingUri(params: {
  ip: string;
  port: number;
  pin: string;
  deviceId: string;
  deviceName: string;
}): string {
  const q = new URLSearchParams({
    host: params.ip,
    port: String(params.port),
    pin: params.pin,
    id: params.deviceId,
    name: params.deviceName,
  });
  return `arcvault://pair?${q.toString()}`;
}

export function parseLanPairingUri(raw: string): {
  peerUrl: string;
  pin: string;
  deviceName?: string;
} | null {
  try {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('arcvault://pair')) return null;
    const url = new URL(trimmed.replace('arcvault://', 'https://arcvault.local/'));
    const host = url.searchParams.get('host');
    const port = url.searchParams.get('port') || '47820';
    const pin = url.searchParams.get('pin') || '';
    const deviceName = url.searchParams.get('name') || undefined;
    if (!host) return null;
    return {
      peerUrl: `http://${host}:${port}`,
      pin,
      deviceName,
    };
  } catch {
    return null;
  }
}

export async function buildEncryptedSyncEnvelope(
  docs: ArchiveDocument[],
  settings: SyncSettings,
  hlc?: HlcTimestamp,
): Promise<SyncEncryptedEnvelope> {
  if (!settings.e2eePassphrase.trim()) {
    throw new Error('请先设置跨端 E2EE 同步口令（用于加密离端内容块）');
  }
  const syncDocs: SyncEnvelopeDocument[] = await Promise.all(
    docs.map(async (d) => ({
      id: d.id,
      spaceId: d.spaceId,
      title: d.title,
      sourceExt: d.sourceExt,
      sourceFileName: d.sourceFileName,
      backupFormat: d.backupFormat,
      activeFormat: d.activeFormat,
      markdownText: d.markdownText,
      latexText: d.latexText,
      isSealed: d.isSealed,
      sealedHash: d.sealedHash,
      sealedAt: d.sealedAt,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
      currentBranchId: d.currentBranchId,
      tags: d.tags,
      contentHash: await sha256Hex(d.markdownText),
    })),
  );

  const encryptedPayload = await encryptVaultText(
    JSON.stringify(syncDocs),
    settings.e2eePassphrase,
  );

  return {
    v: 1,
    deviceId: settings.deviceId,
    deviceName: settings.deviceName,
    hlc: hlc ?? createHlc(settings.deviceId),
    createdAt: new Date().toISOString(),
    docCount: syncDocs.length,
    encryptedPayload,
  };
}

export async function decryptSyncEnvelope(
  envelope: SyncEncryptedEnvelope,
  passphrase: string,
): Promise<SyncEnvelopeDocument[]> {
  if (!passphrase.trim()) {
    throw new Error('请输入跨端 E2EE 同步口令进行解密');
  }
  const plainJson = await decryptVaultText(envelope.encryptedPayload, passphrase);
  const parsed = JSON.parse(plainJson) as SyncEnvelopeDocument[];
  if (!Array.isArray(parsed)) {
    throw new Error('同步密文载荷格式无效');
  }
  return parsed;
}

export function envelopeDocToArchiveDoc(
  remote: SyncEnvelopeDocument,
): ArchiveDocument {
  return {
    id: remote.id,
    spaceId: remote.spaceId,
    title: remote.title,
    sourceExt: remote.sourceExt,
    sourceFileName: remote.sourceFileName,
    backupFormat: remote.backupFormat,
    activeFormat: remote.activeFormat,
    markdownText: remote.markdownText,
    latexText:
      remote.latexText ||
      syncFormatText(remote.markdownText, 'markdown', 'latex'),
    annotations: [],
    coverXmlNodes: [],
    coverRule: {
      documentId: remote.id,
      coverEndBlockIndex: 0,
      remember: false,
      coverBlockCount: 0,
    },
    citationsSidecar: [],
    mediaAssets: {},
    isSealed: remote.isSealed,
    sealedHash: remote.sealedHash,
    sealedAt: remote.sealedAt,
    updatedAt: remote.updatedAt,
    createdAt: remote.createdAt,
    currentBranchId: remote.currentBranchId,
    tags: remote.tags ?? [],
  };
}

export function reconcileSyncDocuments(
  localDocs: ArchiveDocument[],
  remoteDocs: SyncEnvelopeDocument[],
  baseTextByDocId: Record<string, string>,
  remoteDeviceName: string,
): SyncReconcileResult {
  const localMap = new Map(localDocs.map((d) => [d.id, d]));
  const added: ArchiveDocument[] = [];
  const updated: ArchiveDocument[] = [];
  const conflicts: SyncConflictItem[] = [];
  let unchangedCount = 0;

  for (const r of remoteDocs) {
    const local = localMap.get(r.id);
    if (!local) {
      added.push(envelopeDocToArchiveDoc(r));
      continue;
    }

    if (local.markdownText === r.markdownText && local.title === r.title) {
      unchangedCount += 1;
      continue;
    }

    const baseText = baseTextByDocId[r.id] ?? '';
    // If local has not diverged from base or remote is cleanly newer with empty base match
    if (baseText && local.markdownText === baseText) {
      updated.push({
        ...local,
        title: r.title,
        markdownText: r.markdownText,
        latexText: r.latexText || syncFormatText(r.markdownText, 'markdown', 'latex'),
        updatedAt: r.updatedAt,
      });
      continue;
    }

    if (baseText && r.markdownText === baseText) {
      unchangedCount += 1;
      continue;
    }

    conflicts.push({
      id: `conflict_${r.id}_${Date.now()}`,
      docId: r.id,
      title: r.title || local.title,
      localText: local.markdownText,
      remoteText: r.markdownText,
      baseText: baseText || local.markdownText,
      localUpdatedAt: local.updatedAt,
      remoteUpdatedAt: r.updatedAt,
      remoteDeviceName,
      remoteDoc: envelopeDocToArchiveDoc(r),
    });
  }

  return { added, updated, conflicts, unchangedCount };
}

export interface WebdavPresetMeta {
  id: WebdavPresetId;
  label: string;
  defaultUrl: string;
  defaultBasePath: string;
  defaultMonthlyLimitMb: number;
  passwordHint: string;
}

export const WEBDAV_PRESETS: Record<WebdavPresetId, WebdavPresetMeta> = {
  jianguoyun: {
    id: 'jianguoyun',
    label: '坚果云 (Jianguoyun)',
    defaultUrl: 'https://dav.jianguoyun.com/dav',
    defaultBasePath: '/ArcVault',
    defaultMonthlyLimitMb: 1024,
    passwordHint:
      '请使用坚果云网页端「安全选项 -> 第三方应用管理」生成的应用专用密码，勿填登录密码；免费账户默认每月 1GB 流量且限频严格，建议开启图片压缩与单队列限速。',
  },
  nextcloud: {
    id: 'nextcloud',
    label: 'Nextcloud / ownCloud',
    defaultUrl: 'https://cloud.example.com/remote.php/dav/files/username',
    defaultBasePath: '/ArcVault',
    defaultMonthlyLimitMb: 0,
    passwordHint: '建议在个人设置 -> 安全性中生成专用 App Password。',
  },
  alist: {
    id: 'alist',
    label: 'Alist / OpenList',
    defaultUrl: 'http://127.0.0.1:5244/dav',
    defaultBasePath: '/ArcVault',
    defaultMonthlyLimitMb: 0,
    passwordHint: '填写 Alist 后台开启 WebDAV 权限的账号与密码。',
  },
  synology: {
    id: 'synology',
    label: '群晖 Synology NAS',
    defaultUrl: 'https://nas.example.com:5006',
    defaultBasePath: '/ArcVault',
    defaultMonthlyLimitMb: 0,
    passwordHint: '需先在套件中心启用 WebDAV Server 并放行 5005/5006 端口。',
  },
  custom: {
    id: 'custom',
    label: '自定义 WebDAV',
    defaultUrl: '',
    defaultBasePath: '/ArcVault',
    defaultMonthlyLimitMb: 0,
    passwordHint: '填写标准 WebDAV 根地址、用户名及密码。',
  },
};

export function applyWebdavPreset(
  settings: SyncSettings,
  presetId: WebdavPresetId,
): Partial<SyncSettings> {
  const preset = WEBDAV_PRESETS[presetId];
  return {
    webdavPreset: presetId,
    webdavUrl: preset.defaultUrl || settings.webdavUrl,
    webdavBasePath: settings.webdavBasePath || preset.defaultBasePath,
    monthlyTrafficLimitMb: preset.defaultMonthlyLimitMb,
  };
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((encoded.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function buildCloudConfigUri(settings: SyncSettings): string {
  const payload = {
    v: 1,
    mode: settings.mode === 's3' ? 's3' : 'webdav',
    e2eePassphrase: settings.e2eePassphrase,
    webdavPreset: settings.webdavPreset ?? 'jianguoyun',
    webdavUrl: settings.webdavUrl,
    webdavBasePath: settings.webdavBasePath,
    webdavUsername: settings.webdavUsername,
    webdavPassword: settings.webdavPassword,
    s3Endpoint: settings.s3Endpoint,
    s3Region: settings.s3Region,
    s3Bucket: settings.s3Bucket,
    s3AccessKey: settings.s3AccessKey,
    s3SecretKey: settings.s3SecretKey,
    s3Prefix: settings.s3Prefix,
    syncMediaAssets: settings.syncMediaAssets ?? true,
    compressImagesToWebp: settings.compressImagesToWebp ?? true,
    monthlyTrafficLimitMb: settings.monthlyTrafficLimitMb ?? 1024,
  };
  return `arcvault://cloud?cfg=${toBase64Url(JSON.stringify(payload))}`;
}

export function parseCloudConfigUri(raw: string): Partial<SyncSettings> | null {
  try {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('arcvault://cloud')) return null;
    const url = new URL(trimmed.replace('arcvault://', 'https://arcvault.local/'));
    const cfgParam = url.searchParams.get('cfg');
    if (!cfgParam) return null;
    const parsed = JSON.parse(fromBase64Url(cfgParam)) as Partial<SyncSettings> & { v?: number };
    if (!parsed || parsed.v !== 1) return null;
    return {
      mode: parsed.mode === 's3' ? 's3' : 'webdav',
      e2eePassphrase: parsed.e2eePassphrase ?? '',
      webdavPreset: parsed.webdavPreset ?? 'custom',
      webdavUrl: parsed.webdavUrl ?? '',
      webdavBasePath: parsed.webdavBasePath ?? '/ArcVault',
      webdavUsername: parsed.webdavUsername ?? '',
      webdavPassword: parsed.webdavPassword ?? '',
      s3Endpoint: parsed.s3Endpoint ?? '',
      s3Region: parsed.s3Region ?? 'auto',
      s3Bucket: parsed.s3Bucket ?? '',
      s3AccessKey: parsed.s3AccessKey ?? '',
      s3SecretKey: parsed.s3SecretKey ?? '',
      s3Prefix: parsed.s3Prefix ?? 'arcvault/',
      syncMediaAssets: parsed.syncMediaAssets ?? true,
      compressImagesToWebp: parsed.compressImagesToWebp ?? true,
      monthlyTrafficLimitMb: parsed.monthlyTrafficLimitMb ?? 1024,
    };
  } catch {
    return null;
  }
}

export class WebdavCircuitBreakerError extends Error {
  readonly status: number;
  readonly cooldownUntil: string;
  constructor(message: string, status: number, cooldownUntil: string) {
    super(message);
    this.name = 'WebdavCircuitBreakerError';
    this.status = status;
    this.cooldownUntil = cooldownUntil;
  }
}

export function isWebdavCircuitBreakerActive(
  settings: SyncSettings,
  nowMs = Date.now(),
): { active: boolean; remainingSec: number; reason?: string } {
  if (!settings.circuitBreakerUntil) return { active: false, remainingSec: 0 };
  const untilMs = Date.parse(settings.circuitBreakerUntil);
  if (!Number.isFinite(untilMs) || untilMs <= nowMs) {
    return { active: false, remainingSec: 0 };
  }
  return {
    active: true,
    remainingSec: Math.ceil((untilMs - nowMs) / 1000),
    reason: settings.circuitBreakerReason,
  };
}

let webdavSerialChain: Promise<unknown> = Promise.resolve();
let lastWebdavReqAtMs = 0;

async function runWebdavSerial<T>(
  fn: () => Promise<T>,
  minIntervalMs = 350,
): Promise<T> {
  const next = webdavSerialChain.then(async () => {
    const elapsed = Date.now() - lastWebdavReqAtMs;
    if (elapsed < minIntervalMs) {
      await new Promise((r) => setTimeout(r, minIntervalMs - elapsed));
    }
    try {
      return await fn();
    } finally {
      lastWebdavReqAtMs = Date.now();
    }
  });
  webdavSerialChain = next.catch(() => undefined);
  return next;
}

export async function executeWebdavWithGuard(
  settings: SyncSettings,
  req: { method: string; url: string; headers?: Record<string, string>; body?: string },
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    minIntervalMs?: number;
    requester?: typeof nativeSyncHttpRequest;
  },
): Promise<{ ok: boolean; status: number; body: string }> {
  const cb = isWebdavCircuitBreakerActive(settings);
  if (cb.active) {
    throw new WebdavCircuitBreakerError(
      `WebDAV 同步已触发熔断保护（剩余 ${cb.remainingSec} 秒）：${cb.reason ?? '请稍后重试或检查配额'}`,
      429,
      settings.circuitBreakerUntil!,
    );
  }

  const maxRetries = options?.maxRetries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 1200;
  const requester = options?.requester ?? nativeSyncHttpRequest;
  const normalizedReq = { ...req, headers: req.headers ?? {} };

  let attempt = 0;
  while (true) {
    const res = await runWebdavSerial(
      () => requester(normalizedReq),
      options?.minIntervalMs ?? 350,
    );

    if (res.status === 401 || res.status === 403) {
      const cooldownUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const msg =
        res.status === 403
          ? 'WebDAV 返回 403（账号受限/风控或流量配额已耗尽），已立即熔断自动同步以防账号被锁。'
          : 'WebDAV 鉴权失败（HTTP 401），请确认填写的是「应用专用密码」而非登录密码。';
      throw new WebdavCircuitBreakerError(msg, res.status, cooldownUntil);
    }

    if (res.status === 507) {
      const cooldownUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      throw new WebdavCircuitBreakerError(
        'WebDAV 云盘空间或月度流量配额已满（HTTP 507），已暂停同步，请清理空间或关闭图片附件同步。',
        507,
        cooldownUntil,
      );
    }

    if (res.status === 429 || res.status === 503) {
      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        attempt += 1;
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      const cooldownUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      throw new WebdavCircuitBreakerError(
        `WebDAV 触发频率限制（HTTP ${res.status}），已退避重试 ${maxRetries} 次仍受限，自动进入 5 分钟冷却保护。`,
        res.status,
        cooldownUntil,
      );
    }

    return res;
  }
}

function buildWebdavTargetUrl(settings: SyncSettings, fileName = 'arcvault-sync-v1.json'): string {
  const base = settings.webdavUrl.replace(/\/+$/, '');
  const path = settings.webdavBasePath.startsWith('/')
    ? settings.webdavBasePath
    : `/${settings.webdavBasePath}`;
  return `${base}${path.replace(/\/+$/, '')}/${fileName}`;
}

function buildWebdavDirUrl(settings: SyncSettings): string {
  const base = settings.webdavUrl.replace(/\/+$/, '');
  const path = settings.webdavBasePath.startsWith('/')
    ? settings.webdavBasePath
    : `/${settings.webdavBasePath}`;
  return `${base}${path.replace(/\/+$/, '')}/`;
}

function buildBasicAuthHeader(user: string, pass: string): string {
  const raw = new TextEncoder().encode(`${user}:${pass}`);
  let bin = '';
  for (let i = 0; i < raw.length; i++) bin += String.fromCharCode(raw[i]);
  return `Basic ${btoa(bin)}`;
}

export async function webdavTestConnection(
  settings: SyncSettings,
): Promise<{ ok: boolean; message: string; status?: number }> {
  if (!settings.webdavUrl.trim()) {
    return { ok: false, message: '请填写 WebDAV 服务地址（如坚果云 / Alist / NAS）' };
  }
  const url = settings.webdavUrl.replace(/\/+$/, '') + '/';
  const headers: Record<string, string> = {};
  if (settings.webdavUsername) {
    headers['Authorization'] = buildBasicAuthHeader(
      settings.webdavUsername,
      settings.webdavPassword,
    );
  }
  try {
    const res = await executeWebdavWithGuard(settings, {
      method: 'OPTIONS',
      url,
      headers,
    });
    if (!(res.ok || res.status === 200 || res.status === 204 || res.status === 207)) {
      return { ok: false, message: `WebDAV 响应异常：HTTP ${res.status}`, status: res.status };
    }
    const dirUrl = buildWebdavDirUrl(settings);
    const mkcol = await executeWebdavWithGuard(settings, {
      method: 'MKCOL',
      url: dirUrl,
      headers,
    });
    if (mkcol.status === 404) {
      return {
        ok: false,
        message: `根目录连通，但远端路径 ${settings.webdavBasePath} 的父目录不存在（HTTP 404）`,
        status: 404,
      };
    }
    return {
      ok: true,
      message: `WebDAV 连通且目录就绪（OPTIONS ${res.status} / 目录探测 ${mkcol.status}）`,
      status: res.status,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      status: err instanceof WebdavCircuitBreakerError ? err.status : undefined,
    };
  }
}

export async function webdavPushEnvelope(
  settings: SyncSettings,
  envelope: SyncEncryptedEnvelope,
): Promise<{ transferredBytes: number }> {
  const url = buildWebdavTargetUrl(settings);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (settings.webdavUsername) {
    headers['Authorization'] = buildBasicAuthHeader(
      settings.webdavUsername,
      settings.webdavPassword,
    );
  }
  const body = JSON.stringify(envelope);
  const res = await executeWebdavWithGuard(settings, {
    method: 'PUT',
    url,
    headers,
    body,
  });
  if (!res.ok) {
    throw new Error(`WebDAV 上传失败：HTTP ${res.status}`);
  }
  return { transferredBytes: new TextEncoder().encode(body).byteLength };
}

export async function webdavPullEnvelope(
  settings: SyncSettings,
): Promise<{ envelope: SyncEncryptedEnvelope; transferredBytes: number }> {
  const url = buildWebdavTargetUrl(settings);
  const headers: Record<string, string> = {};
  if (settings.webdavUsername) {
    headers['Authorization'] = buildBasicAuthHeader(
      settings.webdavUsername,
      settings.webdavPassword,
    );
  }
  const res = await executeWebdavWithGuard(settings, {
    method: 'GET',
    url,
    headers,
  });
  if (!res.ok) {
    throw new Error(`WebDAV 拉取失败：HTTP ${res.status}`);
  }
  return {
    envelope: JSON.parse(res.body) as SyncEncryptedEnvelope,
    transferredBytes: new TextEncoder().encode(res.body).byteLength,
  };
}

export function trackSyncTraffic(
  settings: SyncSettings,
  bytesDelta: number,
  now = new Date(),
): {
  nextUsedBytes: number;
  month: string;
  limitBytes: number;
  usageRatio: number;
  nearLimit: boolean;
  overLimit: boolean;
} {
  const month = now.toISOString().slice(0, 7);
  const baseBytes =
    settings.monthlyTrafficMonth === month ? (settings.monthlyTrafficUsedBytes ?? 0) : 0;
  const nextUsedBytes = Math.max(0, baseBytes + Math.max(0, bytesDelta));
  const limitMb = settings.monthlyTrafficLimitMb ?? 0;
  const limitBytes = limitMb > 0 ? limitMb * 1024 * 1024 : 0;
  const usageRatio = limitBytes > 0 ? nextUsedBytes / limitBytes : 0;
  return {
    nextUsedBytes,
    month,
    limitBytes,
    usageRatio,
    nearLimit: limitBytes > 0 && usageRatio >= 0.8,
    overLimit: limitBytes > 0 && usageRatio >= 1,
  };
}

export interface DeduplicatedMediaAsset {
  hash: string;
  name: string;
  dataUrl: string;
  byteLength: number;
}

export async function collectUniqueMediaAssets(docs: ArchiveDocument[]): Promise<{
  uniqueAssets: DeduplicatedMediaAsset[];
  logicalCount: number;
  totalBytes: number;
  dedupSavedBytes: number;
}> {
  const byHash = new Map<string, DeduplicatedMediaAsset>();
  const encoder = new TextEncoder();
  let logicalCount = 0;
  let logicalBytes = 0;

  for (const doc of docs) {
    for (const [key, asset] of Object.entries(doc.mediaAssets ?? {})) {
      if (!asset?.dataUrl) continue;
      logicalCount += 1;
      const byteLength = encoder.encode(asset.dataUrl).byteLength;
      logicalBytes += byteLength;
      const hash = await sha256Hex(asset.dataUrl);
      if (!byHash.has(hash)) {
        byHash.set(hash, {
          hash,
          name: asset.filename || key,
          dataUrl: asset.dataUrl,
          byteLength,
        });
      }
    }
  }

  const uniqueAssets = Array.from(byHash.values());
  const totalBytes = uniqueAssets.reduce((sum, a) => sum + a.byteLength, 0);
  return {
    uniqueAssets,
    logicalCount,
    totalBytes,
    dedupSavedBytes: Math.max(0, logicalBytes - totalBytes),
  };
}

export interface SyncAssetManifest {
  v: 1;
  updatedAt: string;
  entries: Array<{ hash: string; name: string; byteLength: number }>;
}

export function buildAssetManifest(uniqueAssets: DeduplicatedMediaAsset[]): SyncAssetManifest {
  return {
    v: 1,
    updatedAt: new Date().toISOString(),
    entries: uniqueAssets.map((a) => ({
      hash: a.hash,
      name: a.name,
      byteLength: a.byteLength,
    })),
  };
}

export function diffMissingAssetHashes(
  localManifest: SyncAssetManifest,
  remoteManifest: SyncAssetManifest | null,
): { toUpload: string[]; toDownload: string[] } {
  const localSet = new Set(localManifest.entries.map((e) => e.hash));
  const remoteSet = new Set((remoteManifest?.entries ?? []).map((e) => e.hash));
  return {
    toUpload: Array.from(localSet).filter((h) => !remoteSet.has(h)),
    toDownload: Array.from(remoteSet).filter((h) => !localSet.has(h)),
  };
}

export interface EncryptedAssetPack {
  v: 1;
  packId: string;
  assetCount: number;
  hashes: string[];
  encryptedPayload: string;
}

export async function buildEncryptedAssetPacks(
  assets: DeduplicatedMediaAsset[],
  passphrase: string,
  maxPackBytes = 5 * 1024 * 1024,
): Promise<EncryptedAssetPack[]> {
  if (!passphrase.trim()) {
    throw new Error('请先设置跨端 E2EE 同步口令');
  }
  const batches: DeduplicatedMediaAsset[][] = [];
  let current: DeduplicatedMediaAsset[] = [];
  let currentSize = 0;

  for (const asset of assets) {
    if (current.length > 0 && currentSize + asset.byteLength > maxPackBytes) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(asset);
    currentSize += asset.byteLength;
  }
  if (current.length > 0) batches.push(current);

  const packs: EncryptedAssetPack[] = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const encryptedPayload = await encryptVaultText(JSON.stringify(batch), passphrase);
    packs.push({
      v: 1,
      packId: `pack_${Date.now().toString(36)}_${i}`,
      assetCount: batch.length,
      hashes: batch.map((a) => a.hash),
      encryptedPayload,
    });
  }
  return packs;
}

export async function decryptAssetPack(
  pack: EncryptedAssetPack,
  passphrase: string,
): Promise<DeduplicatedMediaAsset[]> {
  const raw = await decryptVaultText(pack.encryptedPayload, passphrase);
  const parsed = JSON.parse(raw) as DeduplicatedMediaAsset[];
  if (!Array.isArray(parsed)) {
    throw new Error('加密图片分包格式无效');
  }
  return parsed;
}

// -----------------------------------------------------------------------------
// S3 Compatible AWS Signature V4 (Pure WebCrypto)
// -----------------------------------------------------------------------------

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(
  keyBytes: Uint8Array | string,
  message: string,
): Promise<Uint8Array> {
  const subtle = globalThis.crypto.subtle;
  const rawKey =
    typeof keyBytes === 'string' ? new TextEncoder().encode(keyBytes) : keyBytes;
  const keyCopy = new Uint8Array(rawKey.byteLength);
  keyCopy.set(rawKey);
  const key = await subtle.importKey(
    'raw',
    keyCopy.buffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  );
  return new Uint8Array(sig);
}

export async function signS3Request(params: {
  method: 'GET' | 'PUT' | 'HEAD';
  endpoint: string;
  bucket: string;
  objectKey: string;
  region: string;
  accessKey: string;
  secretKey: string;
  payload?: string;
  now?: Date;
}): Promise<{ url: string; headers: Record<string, string> }> {
  const now = params.now ?? new Date();
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = iso.slice(0, 8);
  const amzDate = iso;

  const cleanEndpoint = params.endpoint.replace(/\/+$/, '');
  const cleanKey = params.objectKey.replace(/^\/+/, '');
  const urlObj = new URL(`${cleanEndpoint}/${params.bucket}/${cleanKey}`);
  const payloadHash = await sha256Hex(params.payload ?? '');

  const canonicalHeaders =
    `host:${urlObj.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    params.method,
    urlObj.pathname,
    urlObj.search ? urlObj.search.slice(1) : '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const region = params.region.trim() || 'auto';
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = await hmacSha256(`AWS4${params.secretKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, 's3');
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${params.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Authorization: authorization,
  };
  if (params.method === 'PUT') {
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }

  return { url: urlObj.toString(), headers };
}

function getS3ObjectKey(settings: SyncSettings): string {
  const prefix = settings.s3Prefix.replace(/^\/+|\/+$/g, '');
  return prefix ? `${prefix}/arcvault-sync-v1.json` : 'arcvault-sync-v1.json';
}

export async function s3TestConnection(
  settings: SyncSettings,
): Promise<{ ok: boolean; message: string }> {
  if (!settings.s3Endpoint || !settings.s3Bucket || !settings.s3AccessKey || !settings.s3SecretKey) {
    return { ok: false, message: '请完整填写 S3 Endpoint、Bucket、AccessKey 与 SecretKey' };
  }
  const signed = await signS3Request({
    method: 'HEAD',
    endpoint: settings.s3Endpoint,
    bucket: settings.s3Bucket,
    objectKey: getS3ObjectKey(settings),
    region: settings.s3Region,
    accessKey: settings.s3AccessKey,
    secretKey: settings.s3SecretKey,
  });
  const res = await nativeSyncHttpRequest({
    method: 'HEAD',
    url: signed.url,
    headers: signed.headers,
  });
  if (res.ok || res.status === 404) {
    return {
      ok: true,
      message:
        res.status === 404
          ? 'S3 SigV4 鉴权成功（云端尚无同步包，首次推送将自动创建）'
          : 'S3 SigV4 连接与对象读取验证成功',
    };
  }
  return { ok: false, message: `S3 连接失败：HTTP ${res.status}` };
}

export async function s3PushEnvelope(
  settings: SyncSettings,
  envelope: SyncEncryptedEnvelope,
): Promise<void> {
  const body = JSON.stringify(envelope);
  const signed = await signS3Request({
    method: 'PUT',
    endpoint: settings.s3Endpoint,
    bucket: settings.s3Bucket,
    objectKey: getS3ObjectKey(settings),
    region: settings.s3Region,
    accessKey: settings.s3AccessKey,
    secretKey: settings.s3SecretKey,
    payload: body,
  });
  const res = await nativeSyncHttpRequest({
    method: 'PUT',
    url: signed.url,
    headers: signed.headers,
    body,
  });
  if (!res.ok) {
    throw new Error(`S3 上传失败：HTTP ${res.status}`);
  }
}

export async function s3PullEnvelope(
  settings: SyncSettings,
): Promise<SyncEncryptedEnvelope> {
  const signed = await signS3Request({
    method: 'GET',
    endpoint: settings.s3Endpoint,
    bucket: settings.s3Bucket,
    objectKey: getS3ObjectKey(settings),
    region: settings.s3Region,
    accessKey: settings.s3AccessKey,
    secretKey: settings.s3SecretKey,
  });
  const res = await nativeSyncHttpRequest({
    method: 'GET',
    url: signed.url,
    headers: signed.headers,
  });
  if (!res.ok) {
    throw new Error(`S3 拉取失败：HTTP ${res.status}`);
  }
  return JSON.parse(res.body) as SyncEncryptedEnvelope;
}

export function buildSimulatedRemotePeerDocs(
  localDocs: ArchiveDocument[],
): SyncEnvelopeDocument[] {
  const out: SyncEnvelopeDocument[] = localDocs.map((d, idx) => {
    const mutatedText =
      idx === 0
        ? `${d.markdownText}\n\n> [来自移动端同伴设备补充批注] 已在平板端复核实验图表坐标轴与显著性标记。`
        : d.markdownText;
    return {
      id: d.id,
      spaceId: d.spaceId,
      title: d.title,
      sourceExt: d.sourceExt,
      sourceFileName: d.sourceFileName,
      backupFormat: d.backupFormat,
      activeFormat: d.activeFormat,
      markdownText: mutatedText,
      latexText: syncFormatText(mutatedText, 'markdown', 'latex'),
      isSealed: d.isSealed,
      sealedHash: d.sealedHash,
      sealedAt: d.sealedAt,
      updatedAt: new Date(Date.now() + 5000).toISOString(),
      createdAt: d.createdAt,
      currentBranchId: d.currentBranchId,
      tags: d.tags,
      contentHash: `sim_${d.id}`,
    };
  });

  out.push({
    id: `doc_remote_peer_${Date.now().toString(36)}`,
    spaceId: 'sp_writing',
    title: 'iPad 灵感速记 · 跨端同步演练',
    sourceExt: '.md',
    sourceFileName: 'ipad-field-note.md',
    backupFormat: 'markdown',
    activeFormat: 'markdown',
    markdownText:
      '# iPad 灵感速记\n\n这是在另一台移动设备上离线撰写、经 **AES-256-GCM + HLC** 加密同步过来的笔记片段。',
    latexText:
      '\\section{iPad 灵感速记}\n\n这是在另一台移动设备上离线撰写、经 AES-256-GCM + HLC 加密同步过来的笔记片段。',
    isSealed: false,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    currentBranchId: 'br_main',
    tags: ['跨端同步'],
    contentHash: 'sim_remote_note',
  });

  return out;
}

export function isNewerRemoteHlc(
  remote: HlcTimestamp,
  local: HlcTimestamp,
): boolean {
  return compareHlc(remote, local) > 0;
}
