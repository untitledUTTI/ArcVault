import { describe, expect, it } from 'vitest';
import {
  compareHlc,
  createHlc,
  formatHlc,
  parseHlc,
  receiveHlc,
  tickHlc,
} from '../sync/hlc';
import { generateQrMatrix } from '../sync/qrMatrix';
import {
  DEFAULT_SYNC_SETTINGS,
  WebdavCircuitBreakerError,
  applyWebdavPreset,
  buildAssetManifest,
  buildCloudConfigUri,
  buildEncryptedAssetPacks,
  buildEncryptedSyncEnvelope,
  buildLanPairingUri,
  collectUniqueMediaAssets,
  decryptAssetPack,
  decryptSyncEnvelope,
  diffMissingAssetHashes,
  executeWebdavWithGuard,
  parseCloudConfigUri,
  parseLanPairingUri,
  reconcileSyncDocuments,
  signS3Request,
  trackSyncTraffic,
} from '../sync/syncEngine';
import type { ArchiveDocument } from '../../types/archive';

function makeDoc(id: string, title: string, markdownText: string): ArchiveDocument {
  return {
    id,
    spaceId: 'sp_paper',
    title,
    sourceExt: '.md',
    sourceFileName: `${title}.md`,
    backupFormat: 'both',
    activeFormat: 'markdown',
    markdownText,
    latexText: markdownText,
    annotations: [],
    coverXmlNodes: [],
    coverRule: { documentId: id, coverEndBlockIndex: 0, remember: false, coverBlockCount: 0 },
    citationsSidecar: [],
    mediaAssets: {},
    isSealed: false,
    updatedAt: '2026-11-26T10:00:00.000Z',
    createdAt: '2026-11-26T09:00:00.000Z',
    currentBranchId: 'br_main',
    tags: [],
  };
}

describe('HLC, QR Matrix & E2EE Cross-Device Sync', () => {
  it('advances and merges HLC timestamps deterministically', () => {
    const a0 = createHlc('dev_a', 1000);
    const a1 = tickHlc(a0, 1000);
    expect(a1.wallMs).toBe(1000);
    expect(a1.logical).toBe(1);

    const b0 = createHlc('dev_b', 1500);
    const merged = receiveHlc(a1, b0, 1200);
    expect(merged.wallMs).toBe(1500);
    expect(merged.logical).toBe(1);
    expect(compareHlc(merged, a1)).toBe(1);

    const parsed = parseHlc(formatHlc(merged));
    expect(parsed).toEqual(merged);
  });

  it('generates valid QR code matrix with finder patterns and parses LAN pairing URIs', () => {
    const uri = buildLanPairingUri({
      ip: '192.168.1.50',
      port: 47820,
      pin: '654321',
      deviceId: 'dev_win',
      deviceName: 'WindowsWorkstation',
    });
    const matrix = generateQrMatrix(uri);
    expect(matrix.length).toBeGreaterThanOrEqual(25);
    expect(matrix.length).toBe(matrix[0].length);
    // Top-left finder pattern corner must be dark
    expect(matrix[0][0]).toBe(true);
    expect(matrix[0][6]).toBe(true);
    expect(matrix[6][0]).toBe(true);

    const parsed = parseLanPairingUri(uri);
    expect(parsed).toEqual({
      peerUrl: 'http://192.168.1.50:47820',
      pin: '654321',
      deviceName: 'WindowsWorkstation',
    });
  });

  it('encrypts, decrypts, and reconciles conflicts across local and remote docs', async () => {
    const doc1 = makeDoc('d1', 'Paper Draft', 'Local edited paragraph');
    const doc2 = makeDoc('d2', 'Notes', 'Same text');
    const settings = { ...DEFAULT_SYNC_SETTINGS, e2eePassphrase: 'strong-sync-password' };

    const envelope = await buildEncryptedSyncEnvelope([doc1, doc2], settings);
    expect(envelope.docCount).toBe(2);
    expect(envelope.encryptedPayload).not.toContain('Local edited paragraph');

    const decrypted = await decryptSyncEnvelope(envelope, 'strong-sync-password');
    expect(decrypted.length).toBe(2);

    // Mutate remote doc1 to create divergence & add doc3
    const remoteDocs = [
      { ...decrypted[0], markdownText: 'Remote tablet paragraph' },
      decrypted[1],
      { ...decrypted[1], id: 'd3', title: 'New Remote Note', markdownText: 'From iPad' },
    ];

    const res = reconcileSyncDocuments(
      [doc1, doc2],
      remoteDocs,
      { d1: 'Common ancestor text', d2: 'Same text' },
      'iPad Pro',
    );
    expect(res.added.length).toBe(1);
    expect(res.added[0].id).toBe('d3');
    expect(res.conflicts.length).toBe(1);
    expect(res.conflicts[0].docId).toBe('d1');
    expect(res.unchangedCount).toBe(1);
  });

  it('computes AWS S3 SigV4 authorization headers cleanly', async () => {
    const signed = await signS3Request({
      method: 'PUT',
      endpoint: 'https://s3.example.com',
      bucket: 'arcvault-bucket',
      objectKey: 'sync/arcvault-sync-v1.json',
      region: 'auto',
      accessKey: 'AKIAIOSFODNN7EXAMPLE',
      secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      payload: '{"v":1}',
      now: new Date('2026-11-26T00:00:00.000Z'),
    });
    expect(signed.url).toBe('https://s3.example.com/arcvault-bucket/sync/arcvault-sync-v1.json');
    expect(signed.headers.Authorization).toContain('AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20261126/auto/s3/aws4_request');
    expect(signed.headers['x-amz-date']).toBe('20261126T000000Z');
  });

  it('applies WebDAV presets and roundtrips cloud config URIs', () => {
    const presetPatch = applyWebdavPreset(DEFAULT_SYNC_SETTINGS, 'jianguoyun');
    expect(presetPatch.webdavPreset).toBe('jianguoyun');
    expect(presetPatch.webdavUrl).toBe('https://dav.jianguoyun.com/dav');
    expect(presetPatch.monthlyTrafficLimitMb).toBe(1024);

    const cfg = {
      ...DEFAULT_SYNC_SETTINGS,
      ...presetPatch,
      mode: 'webdav' as const,
      webdavUsername: 'user@example.com',
      webdavPassword: 'app-password-123',
      e2eePassphrase: 'e2ee-secret-key',
    };
    const uri = buildCloudConfigUri(cfg);
    expect(uri.startsWith('arcvault://cloud?cfg=')).toBe(true);

    const parsed = parseCloudConfigUri(uri);
    expect(parsed).not.toBeNull();
    expect(parsed?.webdavUrl).toBe('https://dav.jianguoyun.com/dav');
    expect(parsed?.webdavUsername).toBe('user@example.com');
    expect(parsed?.webdavPassword).toBe('app-password-123');
    expect(parsed?.e2eePassphrase).toBe('e2ee-secret-key');
  });

  it('retries 503 with backoff and trips circuit breaker immediately on 403', async () => {
    let calls = 0;
    const res = await executeWebdavWithGuard(
      DEFAULT_SYNC_SETTINGS,
      { method: 'GET', url: 'https://dav.example.com/test' },
      {
        maxRetries: 2,
        baseDelayMs: 5,
        minIntervalMs: 0,
        requester: async () => {
          calls += 1;
          if (calls === 1) return { ok: false, status: 503, body: 'busy', headers: {} };
          return { ok: true, status: 200, body: 'ok', headers: {} };
        },
      },
    );
    expect(res.ok).toBe(true);
    expect(calls).toBe(2);

    let forbiddenCalls = 0;
    await expect(
      executeWebdavWithGuard(
        DEFAULT_SYNC_SETTINGS,
        { method: 'PUT', url: 'https://dav.example.com/test' },
        {
          maxRetries: 2,
          baseDelayMs: 5,
          minIntervalMs: 0,
          requester: async () => {
            forbiddenCalls += 1;
            return { ok: false, status: 403, body: 'locked', headers: {} };
          },
        },
      ),
    ).rejects.toBeInstanceOf(WebdavCircuitBreakerError);
    expect(forbiddenCalls).toBe(1);
  });

  it('tracks monthly traffic quota and deduplicates/packs media assets', async () => {
    const t1 = trackSyncTraffic(
      { ...DEFAULT_SYNC_SETTINGS, monthlyTrafficMonth: '2026-11', monthlyTrafficUsedBytes: 850 * 1024 * 1024 },
      10 * 1024 * 1024,
      new Date('2026-11-26T00:00:00.000Z'),
    );
    expect(t1.nearLimit).toBe(true);
    expect(t1.overLimit).toBe(false);

    const tNextMonth = trackSyncTraffic(
      { ...DEFAULT_SYNC_SETTINGS, monthlyTrafficMonth: '2026-11', monthlyTrafficUsedBytes: 900 * 1024 * 1024 },
      1024,
      new Date('2026-12-01T00:00:00.000Z'),
    );
    expect(tNextMonth.nextUsedBytes).toBe(1024);

    const sharedImg = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
    const d1 = {
      ...makeDoc('d1', 'Doc1', 'a'),
      mediaAssets: {
        'fig1.webp': { id: 'm1', filename: 'fig1.webp', mimeType: 'image/webp', dataUrl: sharedImg },
      },
    };
    const d2 = {
      ...makeDoc('d2', 'Doc2', 'b'),
      mediaAssets: {
        'fig1-copy.webp': { id: 'm2', filename: 'fig1-copy.webp', mimeType: 'image/webp', dataUrl: sharedImg },
      },
    };
    const collected = await collectUniqueMediaAssets([d1, d2]);
    expect(collected.logicalCount).toBe(2);
    expect(collected.uniqueAssets.length).toBe(1);
    expect(collected.dedupSavedBytes).toBeGreaterThan(0);

    const manifest = buildAssetManifest(collected.uniqueAssets);
    const diff = diffMissingAssetHashes(manifest, { v: 1, updatedAt: '', entries: [] });
    expect(diff.toUpload).toEqual([collected.uniqueAssets[0].hash]);

    const packs = await buildEncryptedAssetPacks(collected.uniqueAssets, 'pack-passphrase');
    expect(packs.length).toBe(1);
    const unpacked = await decryptAssetPack(packs[0], 'pack-passphrase');
    expect(unpacked[0].dataUrl).toBe(sharedImg);
  });
});
