import 'package:flutter_test/flutter_test.dart';
import 'package:arcvault_mobile/core/academic_engines.dart';
import 'package:arcvault_mobile/models/archive_models.dart';

void main() {
  group('AppSettingsModel AI defaults & JSON roundtrip', () {
    test('defaults aiDeepThinking to true, effort to medium, and empty local path', () {
      const defaults = AppSettingsModel();
      expect(defaults.aiDeepThinking, isTrue);
      expect(defaults.aiThinkingEffort, 'medium');
      expect(defaults.aiLocalModelPath, '');

      final legacyJson = <String, dynamic>{
        'aiProvider': 'openai-compatible',
        'aiEndpoint': 'https://api.siliconflow.cn/v1',
        'aiModel': 'Qwen/Qwen2.5-7B-Instruct',
      };
      final restored = AppSettingsModel.fromJson(legacyJson);
      expect(restored.aiDeepThinking, isTrue);
      expect(restored.aiThinkingEffort, 'medium');
      expect(restored.aiLocalModelPath, '');

      final custom = restored.copyWith(
        aiLocalModelPath: '/storage/emulated/0/Models/qwen3.gguf',
        aiDeepThinking: false,
        aiThinkingEffort: 'high',
      );
      final roundtrip = AppSettingsModel.fromJson(custom.toJson());
      expect(roundtrip.aiLocalModelPath, '/storage/emulated/0/Models/qwen3.gguf');
      expect(roundtrip.aiDeepThinking, isFalse);
      expect(roundtrip.aiThinkingEffort, 'high');
    });
  });

  group('AiGateway URL normalization & deep thinking helpers', () {
    test('normalizes /v1, /v2, /v4, bare host, and /api/chat URLs', () {
      expect(
        AiGateway.normalizeChatUrl('https://api.siliconflow.cn/v1'),
        'https://api.siliconflow.cn/v1/chat/completions',
      );
      expect(
        AiGateway.normalizeChatUrl('https://qianfan.baidubce.com/v2/'),
        'https://qianfan.baidubce.com/v2/chat/completions',
      );
      expect(
        AiGateway.normalizeChatUrl('https://open.bigmodel.cn/api/paas/v4'),
        'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      );
      expect(
        AiGateway.normalizeChatUrl('http://localhost:11434'),
        'http://localhost:11434/v1/chat/completions',
      );
      expect(
        AiGateway.normalizeChatUrl('http://localhost:11434/api/chat'),
        'http://localhost:11434/api/chat',
      );
    });

    test('builds provider-aware thinking fields and strips <think> tags', () {
      expect(
        AiGateway.buildThinkingRequestFields(
          'https://api.siliconflow.cn/v1/chat/completions',
          true,
          'high',
        ),
        {'enable_thinking': true, 'reasoning_effort': 'high'},
      );
      expect(
        AiGateway.buildThinkingRequestFields(
          'https://open.bigmodel.cn/api/paas/v4/chat/completions',
          false,
          'medium',
        ),
        {
          'thinking': {'type': 'disabled'},
        },
      );
      expect(
        AiGateway.buildThinkingRequestFields(
          'http://localhost:11434/api/chat',
          true,
          'medium',
        ),
        {'think': 'medium'},
      );
      expect(
        AiGateway.extractLocalModelName(r'D:\Models\Qwen3-8B.gguf'),
        'Qwen3-8B.gguf',
      );
      expect(
        AiGateway.stripThinkingTags('<think>hidden reasoning</think>\nClean Answer'),
        'Clean Answer',
      );
    });
  });
}
