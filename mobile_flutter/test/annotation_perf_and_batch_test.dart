import 'package:arcvault_mobile/core/annotation_filter.dart';
import 'package:arcvault_mobile/core/command_history.dart';
import 'package:arcvault_mobile/models/archive_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CommandHistory coalescing & batch annotation operations', () {
    test('coalesces keystrokes within 500ms and splits after window or breakMergeChain', () {
      final history = CommandHistory();
      const s0 = DocEditableState(
        markdownText: 'A',
        latexText: 'A',
        annotations: [],
        activeFormat: EditorFormat.markdown,
      );
      const s1 = DocEditableState(
        markdownText: 'AB',
        latexText: 'A',
        annotations: [],
        activeFormat: EditorFormat.markdown,
      );
      const s2 = DocEditableState(
        markdownText: 'ABC',
        latexText: 'A',
        annotations: [],
        activeFormat: EditorFormat.markdown,
      );
      const s3 = DocEditableState(
        markdownText: 'ABCD',
        latexText: 'A',
        annotations: [],
        activeFormat: EditorFormat.markdown,
      );

      history.push(
        '正文编辑',
        s0,
        s1,
        mergeKey: 'text-edit',
        mergeWindowMs: 500,
        skipClone: true,
        nowMs: 1000,
      );
      history.push(
        '正文编辑',
        s1,
        s2,
        mergeKey: 'text-edit',
        mergeWindowMs: 500,
        skipClone: true,
        nowMs: 1300,
      );
      expect(history.undoCount, 1);

      history.push(
        '正文编辑',
        s2,
        s3,
        mergeKey: 'text-edit',
        mergeWindowMs: 500,
        skipClone: true,
        nowMs: 2000,
      );
      expect(history.undoCount, 2);

      history.breakMergeChain();
      history.push(
        '正文编辑',
        s3,
        s0,
        mergeKey: 'text-edit',
        mergeWindowMs: 500,
        skipClone: true,
        nowMs: 2100,
      );
      expect(history.undoCount, 3);
    });

    test('applies batch accept/reject/resolve across 500 annotations cleanly', () {
      final buffer = StringBuffer();
      final anns = <AnnotationItem>[];
      var pos = 0;
      for (var i = 0; i < 250; i++) {
        final revTok = 'old_$i';
        final comTok = 'com_$i';
        final chunk = 'P$i $revTok mid $comTok. ';
        final revStart = pos + 'P$i '.length;
        final comStart = pos + 'P$i $revTok mid '.length;
        anns.add(AnnotationItem(
          id: 'r_$i',
          type: AnnotationType.revision,
          revisionKind: RevisionKind.replace,
          author: 'Reviewer',
          date: '2026-11-28',
          originalText: revTok,
          suggestedText: 'REPLACED_$i',
          anchorStart: revStart,
          anchorEnd: revStart + revTok.length,
          status: AnnotationStatus.open,
        ));
        anns.add(AnnotationItem(
          id: 'c_$i',
          type: AnnotationType.comment,
          author: 'Advisor',
          date: '2026-11-28',
          commentText: 'Note $i',
          originalText: comTok,
          anchorStart: comStart,
          anchorEnd: comStart + comTok.length,
          status: AnnotationStatus.open,
        ));
        buffer.write(chunk);
        pos += chunk.length;
      }

      final text = buffer.toString();
      final accepted = applyBatchAnnotationAction(
        text: text,
        annotations: anns,
        action: BatchAnnotationAction.acceptRevisions,
      );
      expect(accepted.affectedCount, 250);

      for (var i = 0; i < 250; i++) {
        final c = accepted.annotations.firstWhere((a) => a.id == 'c_$i');
        expect(accepted.text.substring(c.anchorStart, c.anchorEnd), 'com_$i');
        final r = accepted.annotations.firstWhere((a) => a.id == 'r_$i');
        expect(accepted.text.substring(r.anchorStart, r.anchorEnd), 'REPLACED_$i');
        expect(r.status, AnnotationStatus.accepted);
      }

      final resolved = applyBatchAnnotationAction(
        text: accepted.text,
        annotations: accepted.annotations,
        action: BatchAnnotationAction.resolveComments,
        targetIds: {'c_0', 'c_1', 'c_2'},
      );
      expect(resolved.affectedCount, 3);
      expect(
        resolved.annotations.where((a) => a.status == AnnotationStatus.resolved).length,
        3,
      );
    });
  });

  group('AnnotationFilter', () {
    test('filters by status, type, and search query including replies', () {
      const items = [
        AnnotationItem(
          id: 'a1',
          type: AnnotationType.comment,
          author: 'Prof. Wang',
          date: '2026-11-28',
          commentText: 'Explain metric',
          originalText: 'F1 score',
          anchorStart: 0,
          anchorEnd: 8,
          status: AnnotationStatus.open,
          replies: [
            AnnotationReply(
              id: 'rp1',
              author: 'Me',
              date: '2026-11-28',
              text: 'Added precision-recall curve',
            ),
          ],
        ),
        AnnotationItem(
          id: 'a2',
          type: AnnotationType.revision,
          revisionKind: RevisionKind.insert,
          author: 'Reviewer',
          date: '2026-11-28',
          originalText: 'section',
          suggestedText: 'Section 3',
          anchorStart: 12,
          anchorEnd: 19,
          status: AnnotationStatus.accepted,
        ),
      ];

      expect(countAnnotationStats(items).open, 1);
      expect(
        filterAnnotations(
          items,
          const AnnotationFilterState(
            status: AnnotationStatusFilter.handled,
            type: AnnotationTypeFilter.revision,
          ),
        ).map((e) => e.id).toList(),
        ['a2'],
      );
      expect(
        filterAnnotations(
          items,
          const AnnotationFilterState(query: 'precision-recall'),
        ).map((e) => e.id).toList(),
        ['a1'],
      );
    });
  });
}
