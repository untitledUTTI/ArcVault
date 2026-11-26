import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart' as std_crypto;
import 'package:cryptography/cryptography.dart';

class VaultIntegrityResult {
  const VaultIntegrityResult({required this.ok, required this.actualHash});
  final bool ok;
  final String actualHash;
}

class VaultCrypto {
  VaultCrypto._();

  static const int pbkdf2Iterations = 120000;
  static final _random = Random.secure();
  static final _pbkdf2 = Pbkdf2(
    macAlgorithm: Hmac.sha256(),
    iterations: pbkdf2Iterations,
    bits: 256,
  );
  static final _aesGcm = AesGcm.with256bits();

  static String sha256Hex(String input) {
    final bytes = utf8.encode(input);
    return std_crypto.sha256.convert(bytes).toString();
  }

  static String sha256BytesHex(List<int> bytes) {
    return std_crypto.sha256.convert(bytes).toString();
  }

  static Uint8List _randomBytes(int length) {
    final out = Uint8List(length);
    for (var i = 0; i < length; i++) {
      out[i] = _random.nextInt(256);
    }
    return out;
  }

  static Future<SecretKey> deriveAesKey(String passcode, List<int> salt) async {
    return _pbkdf2.deriveKeyFromPassword(
      password: passcode,
      nonce: salt,
    );
  }

  /// Encrypts plaintext into the exact same JSON envelope used by ArcVault Desktop:
  /// `{ v: 1, alg: "AES-256-GCM", iter: 120000, salt, iv, ct }`
  /// where `ct` is Base64(cipherText || 16-byte GCM tag), matching WebCrypto SubtleCrypto.
  static Future<String> encryptVaultText(String plaintext, String passcode) async {
    if (passcode.isEmpty) {
      throw ArgumentError('保险箱密码不能为空');
    }
    final salt = _randomBytes(16);
    final iv = _randomBytes(12);
    final key = await deriveAesKey(passcode, salt);

    final secretBox = await _aesGcm.encrypt(
      utf8.encode(plaintext),
      secretKey: key,
      nonce: iv,
    );

    final combined = Uint8List(secretBox.cipherText.length + secretBox.mac.bytes.length);
    combined.setAll(0, secretBox.cipherText);
    combined.setAll(secretBox.cipherText.length, secretBox.mac.bytes);

    return jsonEncode({
      'v': 1,
      'alg': 'AES-256-GCM',
      'iter': pbkdf2Iterations,
      'salt': base64Encode(salt),
      'iv': base64Encode(iv),
      'ct': base64Encode(combined),
    });
  }

  static Future<String> decryptVaultText(String envelopeJson, String passcode) async {
    if (passcode.isEmpty) {
      throw ArgumentError('请输入保险箱密码');
    }
    dynamic parsed;
    try {
      parsed = jsonDecode(envelopeJson);
    } catch (_) {
      throw const FormatException('密文信封格式损坏');
    }
    if (parsed is! Map<String, dynamic> ||
        parsed['v'] != 1 ||
        parsed['alg'] != 'AES-256-GCM') {
      throw const FormatException('不支持的加密算法版本');
    }

    final salt = base64Decode(parsed['salt'] as String);
    final iv = base64Decode(parsed['iv'] as String);
    final ctCombined = base64Decode(parsed['ct'] as String);
    if (ctCombined.length < 16) {
      throw const FormatException('密文长度无效');
    }

    final cipherText = ctCombined.sublist(0, ctCombined.length - 16);
    final macBytes = ctCombined.sublist(ctCombined.length - 16);
    final iter = (parsed['iter'] as num?)?.toInt() ?? pbkdf2Iterations;
    final pbkdf = iter == pbkdf2Iterations
        ? _pbkdf2
        : Pbkdf2(macAlgorithm: Hmac.sha256(), iterations: iter, bits: 256);
    final key = await pbkdf.deriveKeyFromPassword(password: passcode, nonce: salt);

    try {
      final clear = await _aesGcm.decrypt(
        SecretBox(cipherText, nonce: iv, mac: Mac(macBytes)),
        secretKey: key,
      );
      return utf8.decode(clear);
    } catch (_) {
      throw StateError('密码错误或密文已被篡改（AES-GCM 校验失败）');
    }
  }

  static VaultIntegrityResult verifySealedIntegrity(
    String content,
    String expectedSha256,
  ) {
    final actualHash = sha256Hex(content);
    return VaultIntegrityResult(
      ok: actualHash == expectedSha256,
      actualHash: actualHash,
    );
  }
}
