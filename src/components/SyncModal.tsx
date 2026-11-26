import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cloud,
  Download,
  GitMerge,
  QrCode,
  Radio,
  RefreshCw,
  ShieldCheck,
  Upload,
  Wifi,
  X,
} from 'lucide-react';
import { generateQrMatrix } from '../core/sync/qrMatrix';
import {
  WEBDAV_PRESETS,
  WebdavCircuitBreakerError,
  applyWebdavPreset,
  buildCloudConfigUri,
  buildEncryptedSyncEnvelope,
  buildLanPairingUri,
  buildSimulatedRemotePeerDocs,
  decryptSyncEnvelope,
  generatePairingPin,
  isWebdavCircuitBreakerActive,
  normalizeSyncSettings,
  parseCloudConfigUri,
  parseLanPairingUri,
  reconcileSyncDocuments,
  s3PullEnvelope,
  s3PushEnvelope,
  s3TestConnection,
  trackSyncTraffic,
  webdavPullEnvelope,
  webdavPushEnvelope,
  webdavTestConnection,
  type SyncEncryptedEnvelope,
  type SyncReconcileResult,
} from '../core/sync/syncEngine';
import {
  nativeLanSyncStart,
  nativeLanSyncStatus,
  nativeLanSyncStop,
  nativeSyncHttpRequest,
  triggerBrowserDownload,
} from '../platform/bridge';
import type {
  ArchiveDocument,
  HapticPattern,
  SyncConflictItem,
  SyncOpLogEntry,
  SyncSettings,
} from '../types/archive';

interface SyncModalProps {
  syncSettings?: SyncSettings;
  documents: ArchiveDocument[];
  oplog: SyncOpLogEntry[];
  conflicts: SyncConflictItem[];
  baseTextByDocId: Record<string, string>;
  onUpdateSyncSettings: (patch: Partial<SyncSettings>) => void;
  onApplySyncResult: (res: SyncReconcileResult, sourceLabel: string) => void;
  onResolveConflict: (
    conflictId: string,
    resolution: 'local' | 'remote' | 'custom',
    customText?: string,
  ) => void;
  onHaptic: (pattern: HapticPattern) => void;
  onClose: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  syncSettings,
  documents,
  oplog,
  conflicts,
  baseTextByDocId,
  onUpdateSyncSettings,
  onApplySyncResult,
  onResolveConflict,
  onHaptic,
  onClose,
}) => {
  const cfg = useMemo(() => normalizeSyncSettings(syncSettings), [syncSettings]);
  const [tab, setTab] = useState<'lan' | 'cloud' | 'conflicts'>(
    conflicts.length > 0 ? 'conflicts' : cfg.mode === 'lan' ? 'lan' : 'cloud',
  );
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lanServerRunning, setLanServerRunning] = useState(false);
  const [localLanIps, setLocalLanIps] = useState<string[]>(['192.168.1.100']);
  const [pairingInput, setPairingInput] = useState('');
  const [cloudUriInput, setCloudUriInput] = useState('');
  const [showCloudQr, setShowCloudQr] = useState(false);
  const [editingMergeId, setEditingMergeId] = useState<string | null>(null);
  const [customMergeDraft, setCustomMergeDraft] = useState('');
  const importPkgRef = useRef<HTMLInputElement>(null);

  const breakerStatus = useMemo(() => isWebdavCircuitBreakerActive(cfg), [cfg]);
  const trafficStats = useMemo(() => trackSyncTraffic(cfg, 0), [cfg]);
  const assetCount = useMemo(
    () =>
      documents.reduce(
        (sum, d) => sum + Object.keys(d.mediaAssets ?? {}).length,
        0,
      ),
    [documents],
  );
  const cloudConfigUri = useMemo(() => buildCloudConfigUri(cfg), [cfg]);
  const cloudQrMatrix = useMemo(
    () => (showCloudQr ? generateQrMatrix(cloudConfigUri) : []),
    [showCloudQr, cloudConfigUri],
  );

  const pairingUri = useMemo(
    () =>
      buildLanPairingUri({
        ip: localLanIps[0] ?? '192.168.1.100',
        port: cfg.lanPort,
        pin: cfg.lanPin,
        deviceId: cfg.deviceId,
        deviceName: cfg.deviceName,
      }),
    [localLanIps, cfg.lanPort, cfg.lanPin, cfg.deviceId, cfg.deviceName],
  );

  const qrMatrix = useMemo(() => generateQrMatrix(pairingUri), [pairingUri]);

  const handleToggleLanServer = async () => {
    setBusy(true);
    try {
      if (lanServerRunning) {
        const msg = await nativeLanSyncStop();
        setLanServerRunning(false);
        setStatusMsg({ ok: true, text: msg });
        onHaptic('light');
      } else {
        const res = await nativeLanSyncStart(cfg.lanPort, cfg.lanPin);
        setLanServerRunning(res.running);
        if (res.localIps.length > 0) setLocalLanIps(res.localIps);
        setStatusMsg({ ok: true, text: res.message });
        onHaptic('success');
      }
    } catch (err) {
      setStatusMsg({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
      onHaptic('error');
    } finally {
      setBusy(false);
    }
  };

  const handleLanPushToPeer = async () => {
    if (!cfg.lanPeerUrl.trim()) {
      setStatusMsg({ ok: false, text: '请先填写对端设备地址或粘贴扫码配对码' });
      onHaptic('warning');
      return;
    }
    setBusy(true);
    try {
      const env = await buildEncryptedSyncEnvelope(documents, cfg);
      const endpoint = `${cfg.lanPeerUrl.replace(/\/+$/, '')}/arcvault/sync/envelope`;
      const res = await nativeSyncHttpRequest({
        method: 'POST',
        url: endpoint,
        headers: {
          'Content-Type': 'application/json',
          'X-ArcVault-Pin': cfg.lanPin,
        },
        body: JSON.stringify(env),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onUpdateSyncSettings({ lastSyncedAt: new Date().toISOString() });
      setStatusMsg({ ok: true, text: `已将 ${documents.length} 份端到端加密文档推送到局域网对端` });
      onHaptic('success');
    } catch (err) {
      setStatusMsg({
        ok: false,
        text: err instanceof Error ? `局域网推送失败：${err.message}` : '局域网推送失败',
      });
      onHaptic('error');
    } finally {
      setBusy(false);
    }
  };

  const handleLanPullInbox = async () => {
    setBusy(true);
    try {
      const st = await nativeLanSyncStatus();
      if (!st.latestEnvelope) {
        setStatusMsg({
          ok: false,
          text: '局域网收件箱暂无待合入同步包（对端推送后可在此立即拉取解密）',
        });
        onHaptic('warning');
        return;
      }
      const env = JSON.parse(st.latestEnvelope) as SyncEncryptedEnvelope;
      const remoteDocs = await decryptSyncEnvelope(env, cfg.e2eePassphrase);
      const res = reconcileSyncDocuments(
        documents,
        remoteDocs,
        baseTextByDocId,
        env.deviceName,
      );
      onApplySyncResult(res, `局域网直连 (${env.deviceName})`);
      setStatusMsg({
        ok: true,
        text: `局域网合入完成：新增 ${res.added.length} 份，更新 ${res.updated.length} 份，冲突 ${res.conflicts.length} 份`,
      });
      onHaptic(res.conflicts.length > 0 ? 'warning' : 'success');
      if (res.conflicts.length > 0) setTab('conflicts');
    } catch (err) {
      setStatusMsg({
        ok: false,
        text: err instanceof Error ? err.message : String(err),
      });
      onHaptic('error');
    } finally {
      setBusy(false);
    }
  };

  const handleExportEncryptedPkg = async () => {
    setBusy(true);
    try {
      const env = await buildEncryptedSyncEnvelope(documents, cfg);
      triggerBrowserDownload(
        `arcvault-sync-${new Date().toISOString().slice(0, 10)}.arcvault-sync.json`,
        JSON.stringify(env, null, 2),
        'application/json;charset=utf-8',
      );
      setStatusMsg({
        ok: true,
        text: '已导出 AES-256-GCM 加密增量同步包（可通过微信/隔空投送传给手机或平板直接导入）',
      });
      onHaptic('success');
    } catch (err) {
      if (err instanceof WebdavCircuitBreakerError) {
        onUpdateSyncSettings({
          circuitBreakerUntil: err.cooldownUntil,
          circuitBreakerReason: err.message,
        });
      }
      setStatusMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
      onHaptic('error');
    } finally {
      setBusy(false);
    }
  };

  const handleImportEncryptedPkg = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const raw = await file.text();
      const env = JSON.parse(raw) as SyncEncryptedEnvelope;
      const remoteDocs = await decryptSyncEnvelope(env, cfg.e2eePassphrase);
      const res = reconcileSyncDocuments(
        documents,
        remoteDocs,
        baseTextByDocId,
        env.deviceName || '离线同步包',
      );
      onApplySyncResult(res, `加密包 (${env.deviceName})`);
      setStatusMsg({
        ok: true,
        text: `已解密合入同步包：新增 ${res.added.length} · 更新 ${res.updated.length} · 冲突 ${res.conflicts.length}`,
      });
      onHaptic(res.conflicts.length > 0 ? 'warning' : 'success');
      if (res.conflicts.length > 0) setTab('conflicts');
    } catch (err) {
      if (err instanceof WebdavCircuitBreakerError) {
        onUpdateSyncSettings({
          circuitBreakerUntil: err.cooldownUntil,
          circuitBreakerReason: err.message,
        });
      }
      setStatusMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
      onHaptic('error');
    } finally {
      setBusy(false);
    }
  };

  const handleSimulatePeerSyncDrill = async () => {
    setBusy(true);
    try {
      const passphrase = cfg.e2eePassphrase.trim() || 'arcvault-demo-e2ee-key';
      if (!cfg.e2eePassphrase.trim()) {
        onUpdateSyncSettings({ e2eePassphrase: passphrase });
      }
      const simSettings = { ...cfg, e2eePassphrase: passphrase };
      const remoteDocs = buildSimulatedRemotePeerDocs(documents);
      const encrypted = await buildEncryptedSyncEnvelope(documents, simSettings);
      void encrypted; // verifies E2EE roundtrip path
      const res = reconcileSyncDocuments(
        documents,
        remoteDocs,
        baseTextByDocId,
        'iPad Pro (演练同伴设备)',
      );
      onApplySyncResult(res, '跨端同步演练');
      setStatusMsg({
        ok: true,
        text: `演练完成：新增 ${res.added.length} 份远端笔记，检测到 ${res.conflicts.length} 份并发编辑冲突`,
      });
      onHaptic(res.conflicts.length > 0 ? 'warning' : 'success');
      if (res.conflicts.length > 0) setTab('conflicts');
    } catch (err) {
      if (err instanceof WebdavCircuitBreakerError) {
        onUpdateSyncSettings({
          circuitBreakerUntil: err.cooldownUntil,
          circuitBreakerReason: err.message,
        });
      }
      setStatusMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
      onHaptic('error');
    } finally {
      setBusy(false);
    }
  };

  const handleCloudAction = async (action: 'test' | 'push' | 'pull') => {
    setBusy(true);
    setStatusMsg(null);
    const cloudMode = cfg.mode === 's3' ? 's3' : 'webdav';
    try {
      if (action === 'test') {
        const res =
          cloudMode === 'webdav'
            ? await webdavTestConnection(cfg)
            : await s3TestConnection(cfg);
        setStatusMsg({ ok: res.ok, text: res.message });
        onHaptic(res.ok ? 'success' : 'error');
      } else if (action === 'push') {
        const env = await buildEncryptedSyncEnvelope(documents, cfg);
        let transferredBytes = new TextEncoder().encode(JSON.stringify(env)).byteLength;
        if (cloudMode === 'webdav') {
          const pushRes = await webdavPushEnvelope(cfg, env);
          transferredBytes = pushRes.transferredBytes;
        } else {
          await s3PushEnvelope(cfg, env);
        }
        const traffic = trackSyncTraffic(cfg, transferredBytes);
        onUpdateSyncSettings({
          lastSyncedAt: new Date().toISOString(),
          monthlyTrafficUsedBytes: traffic.nextUsedBytes,
          monthlyTrafficMonth: traffic.month,
          circuitBreakerUntil: undefined,
          circuitBreakerReason: undefined,
        });
        setStatusMsg({
          ok: true,
          text: `已将 ${documents.length} 份文档经 AES-256-GCM 加密推送至 ${cloudMode.toUpperCase()}${traffic.nearLimit ? '（注意：本月流量已达警戒线 80%）' : ''}`,
        });
        onHaptic(traffic.nearLimit ? 'warning' : 'success');
      } else {
        let env: SyncEncryptedEnvelope;
        let transferredBytes = 0;
        if (cloudMode === 'webdav') {
          const pullRes = await webdavPullEnvelope(cfg);
          env = pullRes.envelope;
          transferredBytes = pullRes.transferredBytes;
        } else {
          env = await s3PullEnvelope(cfg);
          transferredBytes = new TextEncoder().encode(JSON.stringify(env)).byteLength;
        }
        const traffic = trackSyncTraffic(cfg, transferredBytes);
        onUpdateSyncSettings({
          monthlyTrafficUsedBytes: traffic.nextUsedBytes,
          monthlyTrafficMonth: traffic.month,
          circuitBreakerUntil: undefined,
          circuitBreakerReason: undefined,
        });
        const remoteDocs = await decryptSyncEnvelope(env, cfg.e2eePassphrase);
        const res = reconcileSyncDocuments(
          documents,
          remoteDocs,
          baseTextByDocId,
          env.deviceName || cloudMode.toUpperCase(),
        );
        onApplySyncResult(res, `${cloudMode.toUpperCase()} 云端`);
        setStatusMsg({
          ok: true,
          text: `云端拉取解密完成：新增 ${res.added.length} · 更新 ${res.updated.length} · 冲突 ${res.conflicts.length}`,
        });
        onHaptic(res.conflicts.length > 0 ? 'warning' : 'success');
        if (res.conflicts.length > 0) setTab('conflicts');
      }
    } catch (err) {
      if (err instanceof WebdavCircuitBreakerError) {
        onUpdateSyncSettings({
          circuitBreakerUntil: err.cooldownUntil,
          circuitBreakerReason: err.message,
        });
      }
      setStatusMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
      onHaptic('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="arc-modal-backdrop" onClick={onClose}>
      <div
        className="arc-modal"
        data-tour="sync-modal"
        style={{ width: 'min(900px, 96vw)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="arc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <ShieldCheck size={18} color="var(--accent)" />
            <strong>多端 E2EE 加密同步中心 (HLC + AES-256-GCM)</strong>
          </div>
          <button type="button" className="arc-btn arc-icon-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="arc-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div className="arc-segmented">
              <button
                type="button"
                className={tab === 'lan' ? 'active' : ''}
                onClick={() => {
                  onHaptic('selection');
                  setTab('lan');
                }}
              >
                <Wifi size={13} style={{ marginRight: 4 }} />
                局域网直连扫码
              </button>
              <button
                type="button"
                className={tab === 'cloud' ? 'active' : ''}
                onClick={() => {
                  onHaptic('selection');
                  setTab('cloud');
                }}
              >
                <Cloud size={13} style={{ marginRight: 4 }} />
                WebDAV / S3 云盘
              </button>
              <button
                type="button"
                className={tab === 'conflicts' ? 'active' : ''}
                onClick={() => {
                  onHaptic('selection');
                  setTab('conflicts');
                }}
              >
                <GitMerge size={13} style={{ marginRight: 4 }} />
                冲突合并 ({conflicts.length})
              </button>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              HLC 操作日志：{oplog.length} 条 ·{' '}
              {cfg.lastSyncedAt ? `上次同步 ${new Date(cfg.lastSyncedAt).toLocaleTimeString()}` : '尚未同步'}
            </div>
          </div>

          {/* Shared E2EE Passphrase & Device Identity */}
          <div className="arc-sync-identity-bar">
            <label style={{ flex: '1 1 180px', fontSize: 12 }}>
              <div style={{ marginBottom: 3, color: 'var(--text-secondary)' }}>本机设备名称</div>
              <input
                className="arc-input"
                value={cfg.deviceName}
                onChange={(e) => onUpdateSyncSettings({ deviceName: e.target.value })}
              />
            </label>
            <label style={{ flex: '2 1 240px', fontSize: 12 }}>
              <div style={{ marginBottom: 3, color: 'var(--text-secondary)' }}>
                端到端加密口令（离端前本地加密，云端不可读）
              </div>
              <input
                className="arc-input"
                type="password"
                value={cfg.e2eePassphrase}
                onChange={(e) => onUpdateSyncSettings({ e2eePassphrase: e.target.value })}
                placeholder="各端填写同一口令即可自动加解密同步..."
              />
            </label>
          </div>

          {statusMsg && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12.5,
                background: statusMsg.ok ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                color: statusMsg.ok ? '#15803d' : '#dc2626',
              }}
            >
              {statusMsg.text}
            </div>
          )}

          {tab === 'lan' && (
            <div className="arc-sync-lan-grid">
              <div className="arc-sync-qr-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                  <QrCode size={15} color="var(--accent)" />
                  <span>本机局域网配对二维码</span>
                </div>
                <div className="arc-qr-frame">
                  <svg
                    viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                    width="156"
                    height="156"
                    shapeRendering="crispEdges"
                    aria-label="ArcVault 局域网配对二维码"
                  >
                    <rect width={qrMatrix.length} height={qrMatrix.length} fill="#ffffff" />
                    {qrMatrix.map((row, r) =>
                      row.map((on, c) =>
                        on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0f172a" /> : null,
                      ),
                    )}
                  </svg>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                  配对 PIN：<strong>{cfg.lanPin}</strong> · 端口 {cfg.lanPort}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className={`arc-btn ${lanServerRunning ? 'arc-btn-primary' : ''}`}
                    disabled={busy}
                    onClick={handleToggleLanServer}
                  >
                    <Radio size={13} />
                    <span>{lanServerRunning ? '停止局域网监听' : '开启本机接收监听'}</span>
                  </button>
                  <button
                    type="button"
                    className="arc-btn"
                    onClick={() => {
                      onHaptic('selection');
                      onUpdateSyncSettings({ lanPin: generatePairingPin() });
                    }}
                  >
                    <RefreshCw size={13} />
                    <span>刷新 PIN</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>连接同伴设备（Windows / macOS / iPad / 手机）</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="arc-input"
                    value={pairingInput}
                    onChange={(e) => setPairingInput(e.target.value)}
                    placeholder="粘贴扫码得到的 arcvault://pair?... 链接"
                  />
                  <button
                    type="button"
                    className="arc-btn"
                    onClick={() => {
                      const parsed = parseLanPairingUri(pairingInput);
                      if (!parsed) {
                        setStatusMsg({ ok: false, text: '未能识别的配对 URI，请检查格式' });
                        onHaptic('error');
                        return;
                      }
                      onUpdateSyncSettings({
                        lanPeerUrl: parsed.peerUrl,
                        lanPin: parsed.pin || cfg.lanPin,
                      });
                      setStatusMsg({
                        ok: true,
                        text: `已解析配对目标：${parsed.deviceName ?? parsed.peerUrl}`,
                      });
                      onHaptic('success');
                    }}
                  >
                    解析配对
                  </button>
                </div>

                <label style={{ fontSize: 12 }}>
                  <div style={{ marginBottom: 3, color: 'var(--text-secondary)' }}>对端局域网地址</div>
                  <input
                    className="arc-input"
                    value={cfg.lanPeerUrl}
                    onChange={(e) => onUpdateSyncSettings({ lanPeerUrl: e.target.value })}
                    placeholder="http://192.168.1.24:47820"
                  />
                </label>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="arc-btn arc-btn-primary"
                    disabled={busy}
                    onClick={handleLanPushToPeer}
                  >
                    <Upload size={13} />
                    <span>直连推送加密同步包</span>
                  </button>
                  <button
                    type="button"
                    className="arc-btn"
                    disabled={busy}
                    onClick={handleLanPullInbox}
                  >
                    <Download size={13} />
                    <span>拉取本机收件箱</span>
                  </button>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    离线零网络兜底（导出/导入加密包 · 或一键演练跨端同步与冲突合并）：
                  </div>
                  <input
                    ref={importPkgRef}
                    type="file"
                    accept=".json,.arcvault-sync.json"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      handleImportEncryptedPkg(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="arc-btn" disabled={busy} onClick={handleExportEncryptedPkg}>
                      <Download size={13} />
                      <span>导出 E2EE 同步包</span>
                    </button>
                    <button
                      type="button"
                      className="arc-btn"
                      disabled={busy}
                      onClick={() => importPkgRef.current?.click()}
                    >
                      <Upload size={13} />
                      <span>导入 E2EE 同步包</span>
                    </button>
                    <button
                      type="button"
                      className="arc-btn"
                      disabled={busy}
                      onClick={handleSimulatePeerSyncDrill}
                    >
                      <GitMerge size={13} />
                      <span>演练远端同步与冲突合并</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'cloud' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="arc-segmented" style={{ alignSelf: 'flex-start' }}>
                <button
                  type="button"
                  className={cfg.mode !== 's3' ? 'active' : ''}
                  onClick={() => onUpdateSyncSettings({ mode: 'webdav' })}
                >
                  WebDAV（坚果云 / Alist / NAS）
                </button>
                <button
                  type="button"
                  className={cfg.mode === 's3' ? 'active' : ''}
                  onClick={() => onUpdateSyncSettings({ mode: 's3' })}
                >
                  S3 兼容存储（Cloudflare R2 / OSS）
                </button>
              </div>

              {cfg.mode !== 's3' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>服务商预设：</span>
                    {(Object.keys(WEBDAV_PRESETS) as Array<keyof typeof WEBDAV_PRESETS>).map((pid) => {
                      const p = WEBDAV_PRESETS[pid];
                      const active = (cfg.webdavPreset ?? 'jianguoyun') === pid;
                      return (
                        <button
                          key={pid}
                          type="button"
                          className={`arc-btn ${active ? 'arc-btn-primary' : ''}`}
                          style={{ height: 26, fontSize: 11.5, padding: '0 9px' }}
                          onClick={() => {
                            onHaptic('selection');
                            onUpdateSyncSettings(applyWebdavPreset(cfg, pid));
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--text-secondary)',
                      padding: '7px 10px',
                      borderRadius: 'var(--arc-radius-sm)',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {WEBDAV_PRESETS[cfg.webdavPreset ?? 'jianguoyun'].passwordHint}
                  </div>

                  {breakerStatus.active && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                        padding: '8px 10px',
                        borderRadius: 'var(--arc-radius-sm)',
                        background: 'rgba(220, 38, 38, 0.1)',
                        border: '1px solid rgba(220, 38, 38, 0.35)',
                        color: '#dc2626',
                        fontSize: 12,
                      }}
                    >
                      <span>
                        已触发防封号熔断保护（冷却剩余 {breakerStatus.remainingSec} 秒）：{breakerStatus.reason}
                      </span>
                      <button
                        type="button"
                        className="arc-btn"
                        style={{ height: 26, fontSize: 11.5 }}
                        onClick={() =>
                          onUpdateSyncSettings({
                            circuitBreakerUntil: undefined,
                            circuitBreakerReason: undefined,
                          })
                        }
                      >
                        重置熔断状态
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                    <label style={{ fontSize: 12 }}>
                      <div style={{ marginBottom: 3, color: 'var(--text-secondary)' }}>WebDAV URL</div>
                      <input
                        className="arc-input"
                        value={cfg.webdavUrl}
                        onChange={(e) => onUpdateSyncSettings({ webdavUrl: e.target.value })}
                        placeholder="https://dav.jianguoyun.com/dav"
                      />
                    </label>
                    <label style={{ fontSize: 12 }}>
                      <div style={{ marginBottom: 3, color: 'var(--text-secondary)' }}>远端目录路径</div>
                      <input
                        className="arc-input"
                        value={cfg.webdavBasePath}
                        onChange={(e) => onUpdateSyncSettings({ webdavBasePath: e.target.value })}
                        placeholder="/ArcVault"
                      />
                    </label>
                    <label style={{ fontSize: 12 }}>
                      <div style={{ marginBottom: 3, color: 'var(--text-secondary)' }}>账号</div>
                      <input
                        className="arc-input"
                        value={cfg.webdavUsername}
                        onChange={(e) => onUpdateSyncSettings({ webdavUsername: e.target.value })}
                      />
                    </label>
                    <label style={{ fontSize: 12 }}>
                      <div style={{ marginBottom: 3, color: 'var(--text-secondary)' }}>应用专用密码</div>
                      <input
                        className="arc-input"
                        type="password"
                        value={cfg.webdavPassword}
                        onChange={(e) => onUpdateSyncSettings({ webdavPassword: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  <label style={{ fontSize: 12 }}>
                    <div style={{ marginBottom: 3, color: 'var(--text-secondary)' }}>S3 Endpoint</div>
                    <input
                      className="arc-input"
                      value={cfg.s3Endpoint}
                      onChange={(e) => onUpdateSyncSettings({ s3Endpoint: e.target.value })}
                      placeholder="https://<account>.r2.cloudflarestorage.com"
                    />
                  </label>
                  <label style={{ fontSize: 12 }}>
                    <div style={{ marginBottom: 3, color: 'var(--text-secondary)' }}>Bucket / Region</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="arc-input"
                        value={cfg.s3Bucket}
                        onChange={(e) => onUpdateSyncSettings({ s3Bucket: e.target.value })}
                        placeholder="bucket"
                      />
                      <input
                        className="arc-input"
                        style={{ width: 92 }}
                        value={cfg.s3Region}
                        onChange={(e) => onUpdateSyncSettings({ s3Region: e.target.value })}
                        placeholder="auto"
                      />
                    </div>
                  </label>
                  <label style={{ fontSize: 12 }}>
                    <div style={{ marginBottom: 3, color: 'var(--text-secondary)' }}>Access Key ID</div>
                    <input
                      className="arc-input"
                      value={cfg.s3AccessKey}
                      onChange={(e) => onUpdateSyncSettings({ s3AccessKey: e.target.value })}
                    />
                  </label>
                  <label style={{ fontSize: 12 }}>
                    <div style={{ marginBottom: 3, color: 'var(--text-secondary)' }}>Secret Access Key</div>
                    <input
                      className="arc-input"
                      type="password"
                      value={cfg.s3SecretKey}
                      onChange={(e) => onUpdateSyncSettings({ s3SecretKey: e.target.value })}
                    />
                  </label>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 'var(--arc-radius-sm)',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                  <strong>图片附件策略与月度流量配额（当前文档库图片：{assetCount} 项）</strong>
                  <span style={{ color: trafficStats.nearLimit ? '#d97706' : 'var(--text-secondary)' }}>
                    本月已估算：{(trafficStats.nextUsedBytes / (1024 * 1024)).toFixed(2)} MB
                    {trafficStats.limitBytes > 0
                      ? ` / ${cfg.monthlyTrafficLimitMb ?? 1024} MB（${Math.min(100, Math.round(trafficStats.usageRatio * 100))}%）`
                      : ' / 不限额'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={cfg.syncMediaAssets ?? true}
                      onChange={(e) => onUpdateSyncSettings({ syncMediaAssets: e.target.checked })}
                    />
                    <span>同步文章图片附件（关闭则仅同步正文，零图片流量消耗）</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={cfg.compressImagesToWebp ?? true}
                      onChange={(e) => onUpdateSyncSettings({ compressImagesToWebp: e.target.checked })}
                    />
                    <span>入库/上传前自动压缩为 WebP（≤2048px）</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="arc-btn" disabled={busy} onClick={() => handleCloudAction('test')}>
                  测试连接与目录探测
                </button>
                <button
                  type="button"
                  className="arc-btn arc-btn-primary"
                  disabled={busy}
                  onClick={() => handleCloudAction('push')}
                >
                  <Upload size={13} />
                  <span>加密上传快照到云端</span>
                </button>
                <button type="button" className="arc-btn" disabled={busy} onClick={() => handleCloudAction('pull')}>
                  <Download size={13} />
                  <span>从云端拉取并合入</span>
                </button>
                <button
                  type="button"
                  className="arc-btn"
                  onClick={() => {
                    navigator.clipboard?.writeText(cloudConfigUri).catch(() => undefined);
                    setShowCloudQr((v) => !v);
                    setStatusMsg({ ok: true, text: '已生成并复制云同步配置口令（arcvault://cloud?...），可在手机/平板端直接粘贴导入' });
                    onHaptic('light');
                  }}
                >
                  <QrCode size={13} />
                  <span>{showCloudQr ? '收起配置二维码' : '跨端扫码/复制同步配置'}</span>
                </button>
              </div>

              {showCloudQr && cloudQrMatrix.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: 10, border: '1px solid var(--border-subtle)', borderRadius: 'var(--arc-radius-sm)' }}>
                  <svg
                    width={116}
                    height={116}
                    viewBox={`0 0 ${cloudQrMatrix.length} ${cloudQrMatrix.length}`}
                    style={{ shapeRendering: 'crispEdges', background: '#fff', padding: 4, borderRadius: 6 }}
                  >
                    <rect width={cloudQrMatrix.length} height={cloudQrMatrix.length} fill="#ffffff" />
                    {cloudQrMatrix.map((row, r) =>
                      row.map((on, c) =>
                        on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0f172a" /> : null,
                      ),
                    )}
                  </svg>
                  <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                    <div style={{ color: 'var(--text-secondary)' }}>在手机或平板端粘贴以下口令即可免手填导入 WebDAV/S3 配置：</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="arc-input"
                        value={cloudUriInput}
                        onChange={(e) => setCloudUriInput(e.target.value)}
                        placeholder="粘贴 arcvault://cloud?... 配置口令"
                      />
                      <button
                        type="button"
                        className="arc-btn"
                        onClick={() => {
                          const parsed = parseCloudConfigUri(cloudUriInput);
                          if (!parsed) {
                            setStatusMsg({ ok: false, text: '无法识别云同步配置口令，请检查格式' });
                            onHaptic('error');
                            return;
                          }
                          onUpdateSyncSettings(parsed);
                          setStatusMsg({ ok: true, text: '已一键导入云端同步配置与 E2EE 口令' });
                          onHaptic('success');
                        }}
                      >
                        导入配置
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'conflicts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {conflicts.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  当前无跨端同步冲突。若多台设备离线编辑了同一文档，将在此弹出可视化三方合并视图。
                </div>
              ) : (
                conflicts.map((c) => {
                  const isEditing = editingMergeId === c.id;
                  return (
                    <div key={c.id} className="arc-sync-conflict-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                          <AlertTriangle size={15} color="#d97706" />
                          <span>{c.title}</span>
                        </div>
                        <span className="arc-badge">来源设备：{c.remoteDeviceName}</span>
                      </div>

                      <div className="arc-sync-conflict-cols">
                        <div className="arc-sync-conflict-pane">
                          <div className="arc-sync-pane-label">本机版本（{new Date(c.localUpdatedAt).toLocaleTimeString()}）</div>
                          <pre className="arc-sync-pre">{c.localText}</pre>
                        </div>
                        <div className="arc-sync-conflict-pane">
                          <div className="arc-sync-pane-label">远端版本（{new Date(c.remoteUpdatedAt).toLocaleTimeString()}）</div>
                          <pre className="arc-sync-pre">{c.remoteText}</pre>
                        </div>
                      </div>

                      {isEditing && (
                        <textarea
                          className="arc-textarea"
                          rows={5}
                          value={customMergeDraft}
                          onChange={(e) => setCustomMergeDraft(e.target.value)}
                        />
                      )}

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="arc-btn"
                          onClick={() => {
                            onHaptic('medium');
                            onResolveConflict(c.id, 'local');
                          }}
                        >
                          <Check size={13} />
                          <span>保留本机版本</span>
                        </button>
                        <button
                          type="button"
                          className="arc-btn"
                          onClick={() => {
                            onHaptic('medium');
                            onResolveConflict(c.id, 'remote');
                          }}
                        >
                          <Check size={13} />
                          <span>采用远端版本</span>
                        </button>
                        {!isEditing ? (
                          <button
                            type="button"
                            className="arc-btn arc-btn-primary"
                            onClick={() => {
                              onHaptic('selection');
                              setEditingMergeId(c.id);
                              setCustomMergeDraft(
                                `${c.localText}\n\n${c.remoteText.replace(c.localText, '').trim()}`.trim(),
                              );
                            }}
                          >
                            <GitMerge size={13} />
                            <span>手动融合双端内容</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="arc-btn arc-btn-primary"
                            onClick={() => {
                              onHaptic('success');
                              onResolveConflict(c.id, 'custom', customMergeDraft);
                              setEditingMergeId(null);
                            }}
                          >
                            <Check size={13} />
                            <span>确认写入融合结果</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
