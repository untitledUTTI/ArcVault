import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:arcvault_mobile/core/cas_store.dart';
import 'package:arcvault_mobile/core/diff_engine.dart';
import 'package:arcvault_mobile/core/ooxml_engine.dart';
import 'package:arcvault_mobile/models/archive_models.dart';

void main() {
  group('OOXML & CAS Engine', () {
    test('builds sample docx, strips cover, extracts annotations, and exports back', () {
      final bytes = OoxmlEngine.buildSamplePaperDocx();
      final bundle = OoxmlEngine.parseDocxBytes(bytes);

      expect(bundle.detectedCoverEndIndex, greaterThan(0));
      expect(bundle.commentsMap.length, 3);
      expect(bundle.revisionsMap.length, 3);
      expect(bundle.citationsSidecar.length, 1);

      final extracted = OoxmlEngine.extractBodyWithCoverIndex(
        bundle,
        bundle.detectedCoverEndIndex,
        EditorFormat.markdown,
      );
      expect(extracted.coverXmlNodes.length, bundle.detectedCoverEndIndex);
      expect(extracted.annotations.length, 6);

      final exportedBytes = OoxmlEngine.exportToDocx(
        baseDocxBase64: base64Encode(bytes),
        coverXmlNodes: extracted.coverXmlNodes,
        bodyText: extracted.text,
        format: EditorFormat.markdown,
        citationsSidecar: extracted.citationsSidecar,
        mode: 'clean',
      );
      expect(exportedBytes.isNotEmpty, true);
    });

    test('CAS deduplicates identical snapshots and extracts deleted darlings', () {
      final cas = CasObjectStore();
      const doc = ArchiveDocument(
        id: 'd1',
        spaceId: 'sp_paper',
        title: 'Test',
        sourceExt: '.md',
        sourceFileName: 'test.md',
        backupFormat: BackupFormat.both,
        activeFormat: EditorFormat.markdown,
        markdownText: '旧段落中有一段较长的废稿文字用于测试废稿墓地自动捕获能力。',
        latexText: '',
        coverRule: CoverRule(
          documentId: 'd1',
          coverEndBlockIndex: 0,
          remember: false,
          coverBlockCount: 0,
        ),
        updatedAt: '2026-11-26T00:00:00Z',
        createdAt: '2026-11-26T00:00:00Z',
        currentBranchId: 'b1',
      );
      final s1 = createDocumentSnapshot(
        cas: cas,
        doc: doc,
        label: 'v1',
        isMilestone: true,
        aiSummary: 'init',
      );
      expect(s1.snapshot, isNotNull);

      final dup = createDocumentSnapshot(
        cas: cas,
        doc: doc,
        latestSnapshot: s1.snapshot,
        label: 'v2',
        isMilestone: false,
        aiSummary: 'dup',
      );
      expect(dup.deduplicated, true);
      expect(dup.snapshot, isNull);

      final darlings = extractDeletedDarlings(
        documentId: 'd1',
        snapshotId: s1.snapshot!.id,
        oldText: doc.markdownText,
        newText: '精简后的新正文。',
      );
      expect(darlings.length, 1);
    });
  });
}
