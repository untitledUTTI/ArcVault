import 'package:flutter_test/flutter_test.dart';
import 'package:arcvault_mobile/core/sync_engine.dart';
import 'package:arcvault_mobile/models/archive_models.dart';
import 'package:arcvault_mobile/theme/monet_engine.dart';

void main() {
  group('Sync & Monet Engines', () {
    test('LAN pairing URI builds and parses accurately', () {
      final uri = SyncEngine.buildLanPairingUri(
        ip: '192.168.1.42',
        port: 47820,
        pin: '264780',
        deviceId: 'dev_pc',
        deviceName: 'Windows PC',
      );
      final parsed = SyncEngine.parseLanPairingUri(uri);
      expect(parsed, isNotNull);
      expect(parsed!.peerUrl, 'http://192.168.1.42:47820');
      expect(parsed.pin, '264780');
    });

    test('HLC ticks monotonically across remote updates', () {
      final local = SyncEngine.createHlc('mobile');
      final remote = HlcTimestamp(wallMs: local.wallMs + 1000, logical: 3, nodeId: 'pc');
      final next = SyncEngine.tickHlc(local, remote: remote);
      expect(SyncEngine.compareHlc(next, remote), greaterThan(0));
    });

    test('Monet generates tokens for all 10 styles', () {
      for (final style in MonetStyle.values) {
        final tokens = MonetEngine.generateTokens(
          MonetSettingsModel(seedColor: '#6750a4', style: style, isDark: false),
        );
        expect(tokens.primary, isNotNull);
        expect(tokens.surfaceContainer, isNotNull);
      }
    });
  });
}
