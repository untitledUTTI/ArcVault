import { sha256Hex } from './hash';

interface VaultEnvelope {
  v: 1;
  alg: 'AES-256-GCM';
  iter: number;
  salt: string;
  iv: string;
  ct: string;
}

const PBKDF2_ITERATIONS = 120_000;

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function getSubtle(): SubtleCrypto {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('WebCrypto subtle API is unavailable');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function deriveAesKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtle();
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passcode),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptVaultText(plaintext: string, passcode: string): Promise<string> {
  if (!passcode) throw new Error('保险箱密码不能为空');
  const subtle = getSubtle();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passcode, salt);

  const cipherBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    new TextEncoder().encode(plaintext),
  );

  const envelope: VaultEnvelope = {
    v: 1,
    alg: 'AES-256-GCM',
    iter: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(cipherBuf)),
  };
  return JSON.stringify(envelope);
}

export async function decryptVaultText(envelopeJson: string, passcode: string): Promise<string> {
  if (!passcode) throw new Error('请输入保险箱密码');
  const subtle = getSubtle();
  let parsed: VaultEnvelope;
  try {
    parsed = JSON.parse(envelopeJson) as VaultEnvelope;
  } catch {
    throw new Error('密文信封格式损坏');
  }

  if (parsed.v !== 1 || parsed.alg !== 'AES-256-GCM') {
    throw new Error('不支持的加密算法版本');
  }

  const salt = fromBase64(parsed.salt);
  const iv = fromBase64(parsed.iv);
  const ct = fromBase64(parsed.ct);
  const key = await deriveAesKey(passcode, salt);

  try {
    const plainBuf = await subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ct),
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    throw new Error('密码错误或密文已被篡改（AES-GCM 校验失败）');
  }
}

export async function verifySealedIntegrity(
  content: string,
  expectedSha256: string,
): Promise<{ ok: boolean; actualHash: string }> {
  const actualHash = await sha256Hex(content);
  return {
    ok: actualHash === expectedSha256,
    actualHash,
  };
}
