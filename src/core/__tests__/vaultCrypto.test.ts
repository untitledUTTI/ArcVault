import { describe, expect, it } from 'vitest';
import {
  decryptVaultText,
  encryptVaultText,
  verifySealedIntegrity,
} from '../vaultCrypto';
import { sha256Hex } from '../hash';

describe('vaultCrypto AES-256-GCM & sealed integrity', () => {
  it('encrypts and decrypts UTF-8 archive text cleanly with PBKDF2 + AES-GCM', async () => {
    const secret = 'ArcVault-Master-2026!';
    const plaintext = '# 机密协议\n\n核心参数：$\alpha = 0.72$，AES-256-GCM 端到端保护。';

    const envelopeJson = await encryptVaultText(plaintext, secret);
    const parsed = JSON.parse(envelopeJson) as { alg: string; iter: number; ct: string };
    expect(parsed.alg).toBe('AES-256-GCM');
    expect(parsed.iter).toBe(120_000);
    expect(parsed.ct).not.toContain('机密协议');

    const restored = await decryptVaultText(envelopeJson, secret);
    expect(restored).toBe(plaintext);
  });

  it('rejects wrong passcodes and tampered ciphertext envelopes', async () => {
    const envelopeJson = await encryptVaultText('机密内容不可泄露', 'correct-pass');
    await expect(decryptVaultText(envelopeJson, 'wrong-pass')).rejects.toThrow();

    const parsed = JSON.parse(envelopeJson) as {
      v: number;
      alg: string;
      iter: number;
      salt: string;
      iv: string;
      ct: string;
    };
    const tampered = JSON.stringify({
      ...parsed,
      ct: parsed.ct.slice(0, -4) + 'AAAA',
    });
    await expect(decryptVaultText(tampered, 'correct-pass')).rejects.toThrow();
  });

  it('verifies sealed document integrity against SHA-256 hash', async () => {
    const body = 'Sealed research contract v1.0';
    const expected = await sha256Hex(body);

    const okResult = await verifySealedIntegrity(body, expected);
    expect(okResult.ok).toBe(true);
    expect(okResult.actualHash).toBe(expected);

    const tamperedResult = await verifySealedIntegrity(`${body} [edited]`, expected);
    expect(tamperedResult.ok).toBe(false);
    expect(tamperedResult.actualHash).not.toBe(expected);
  });
});
