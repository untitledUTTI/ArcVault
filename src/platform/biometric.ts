import {
  isTauriRuntime,
  nativeBiometricAuthenticate,
  nativeBiometricCheck,
} from './bridge';

const BIOMETRIC_CRED_KEY = 'arcvault_biometric_cred_v1';
const BIOMETRIC_SECRET_KEY = 'arcvault_biometric_secret_v1';

export interface BiometricCapability {
  available: boolean;
  kind: 'tauri-native' | 'webauthn' | 'none';
  label: string;
}

export async function checkBiometricAvailability(): Promise<BiometricCapability> {
  if (isTauriRuntime()) {
    const nativeRes = await nativeBiometricCheck();
    if (nativeRes.available) {
      return {
        available: true,
        kind: 'tauri-native',
        label: nativeRes.label || '系统生物识别（FaceID / TouchID / 指纹 / Windows Hello）',
      };
    }
  }

  if (
    typeof window !== 'undefined' &&
    typeof PublicKeyCredential !== 'undefined' &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
      'function'
  ) {
    try {
      const ok =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (ok) {
        return {
          available: true,
          kind: 'webauthn',
          label: '平台生物识别密钥（Passkey / TouchID / Windows Hello）',
        };
      }
    } catch {
      // Ignore probe errors
    }
  }

  return {
    available: false,
    kind: 'none',
    label: '当前环境不支持硬件生物识别（可在原生端或 HTTPS 环境下使用）',
  };
}

export function hasEnrolledBiometricUnlock(): boolean {
  try {
    return Boolean(localStorage.getItem(BIOMETRIC_SECRET_KEY));
  } catch {
    return false;
  }
}

export function clearEnrolledBiometricUnlock(): void {
  try {
    localStorage.removeItem(BIOMETRIC_CRED_KEY);
    localStorage.removeItem(BIOMETRIC_SECRET_KEY);
  } catch {
    // Ignore
  }
}

function xorSeal(passcode: string, deviceSalt: string): string {
  const bytes = new TextEncoder().encode(passcode);
  const key = new TextEncoder().encode(deviceSalt);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ key[i % key.length];
  }
  let bin = '';
  for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
  return btoa(bin);
}

function xorUnseal(sealed: string, deviceSalt: string): string {
  const bin = atob(sealed);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const key = new TextEncoder().encode(deviceSalt);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ key[i % key.length];
  }
  return new TextDecoder().decode(out);
}

export async function enrollBiometricUnlock(
  passcode: string,
): Promise<{ ok: boolean; message: string }> {
  if (!passcode) {
    return { ok: false, message: '请先设置或输入保险箱主密码' };
  }

  const cap = await checkBiometricAvailability();
  const deviceSalt = `arcvault-bio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  if (cap.kind === 'tauri-native') {
    const auth = await nativeBiometricAuthenticate('绑定 ArcVault 保险箱生物识别解锁');
    if (!auth.ok) {
      return { ok: false, message: auth.message };
    }
    localStorage.setItem(BIOMETRIC_CRED_KEY, deviceSalt);
    localStorage.setItem(BIOMETRIC_SECRET_KEY, xorSeal(passcode, deviceSalt));
    return { ok: true, message: '已绑定原生系统生物识别解锁' };
  }

  if (cap.kind === 'webauthn' && navigator.credentials?.create) {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'ArcVault 穹档' },
          user: {
            id: userId,
            name: 'arcvault-vault-owner',
            displayName: 'ArcVault 保险箱',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 45_000,
        },
      })) as PublicKeyCredential | null;
      if (!cred) {
        return { ok: false, message: '生物识别绑定已取消' };
      }
      localStorage.setItem(BIOMETRIC_CRED_KEY, cred.id || deviceSalt);
      localStorage.setItem(
        BIOMETRIC_SECRET_KEY,
        xorSeal(passcode, cred.id || deviceSalt),
      );
      return { ok: true, message: '已绑定系统生物识别 Passkey 解锁' };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? `生物识别绑定未完成：${err.message}`
            : '生物识别绑定失败',
      };
    }
  }

  return {
    ok: false,
    message: '当前设备或浏览器暂不支持硬件生物识别（需 Tauri 原生端或平台 Passkey）',
  };
}

export async function authenticateBiometricUnlock(): Promise<{
  ok: boolean;
  passcode?: string;
  message: string;
}> {
  const credKey = localStorage.getItem(BIOMETRIC_CRED_KEY);
  const sealed = localStorage.getItem(BIOMETRIC_SECRET_KEY);
  if (!credKey || !sealed) {
    return {
      ok: false,
      message: '尚未在当前设备绑定生物识别，请先输入主密码解锁后点击「绑定生物识别」',
    };
  }

  const cap = await checkBiometricAvailability();
  if (cap.kind === 'tauri-native') {
    const auth = await nativeBiometricAuthenticate('验证生物识别以解锁 ArcVault 私密保险箱');
    if (!auth.ok) return { ok: false, message: auth.message };
    return {
      ok: true,
      passcode: xorUnseal(sealed, credKey),
      message: '原生生物识别验证通过',
    };
  }

  if (cap.kind === 'webauthn' && navigator.credentials?.get) {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          userVerification: 'required',
          timeout: 45_000,
        },
      });
      if (!assertion) {
        return { ok: false, message: '生物识别验证已取消' };
      }
      return {
        ok: true,
        passcode: xorUnseal(sealed, credKey),
        message: '生物识别验证通过',
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : '生物识别验证失败',
      };
    }
  }

  return {
    ok: false,
    message: '当前环境不可用硬件生物识别，请使用主密码解锁',
  };
}
