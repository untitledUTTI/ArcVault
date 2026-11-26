import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:arcvault_mobile/core/vault_crypto.dart';

void main() {
  group('VaultCrypto desktop compatibility', () {
    test('encrypts and decrypts using PBKDF2-HMAC-SHA256 + AES-256-GCM envelope', () async {
      const plaintext = 'ArcVault · 穹档 机密论文数据 94.2%';
      const passcode = 'arcvault-secret-2026';

      final envelopeJson = await VaultCrypto.encryptVaultText(plaintext, passcode);
      final parsed = jsonDecode(envelopeJson) as Map<String, dynamic>;

      expect(parsed['v'], 1);
      expect(parsed['alg'], 'AES-256-GCM');
      expect(parsed['iter'], 120000);
      expect(base64Decode(parsed['salt'] as String).length, 16);
      expect(base64Decode(parsed['iv'] as String).length, 12);

      final decrypted = await VaultCrypto.decryptVaultText(envelopeJson, passcode);
      expect(decrypted, plaintext);
    });

    test('rejects wrong passcode on AES-GCM authentication', () async {
      final envelope = await VaultCrypto.encryptVaultText('secret', 'correct-pass');
      expect(
        () => VaultCrypto.decryptVaultText(envelope, 'wrong-pass'),
        throwsStateError,
      );
    });
  });
}
