import 'package:diff_match_patch/diff_match_patch.dart';
import 'package:uuid/uuid.dart';
import '../models/archive_models.dart';

enum DiffHunkType { unchanged, added, removed }

class DiffHunk {
  const DiffHunk({required this.type, required this.value});
  final DiffHunkType type;
  final String value;
}

class DocumentDiffResult {
  const DocumentDiffResult({
    required this.hunks,
    required this.addedChars,
    required this.removedChars,
    required this.changedBlocks,
    required this.summary,
  });

  final List<DiffHunk> hunks;
  final int addedChars;
  final int removedChars;
  final int changedBlocks;
  final String summary;
}

DocumentDiffResult computeDocumentDiff(String leftText, String rightText) {
  final dmp = DiffMatchPatch();
  // Line-level diff for clean academic paragraph alignment
  final diffs = dmp.diff(leftText, rightText);
  dmp.diffCleanupSemantic(diffs);

  final hunks = <DiffHunk>[];
  var addedChars = 0;
  var removedChars = 0;
  var changedBlocks = 0;

  for (final d in diffs) {
    if (d.text.isEmpty) continue;
    if (d.operation == DIFF_INSERT) {
      addedChars += d.text.length;
      changedBlocks++;
      hunks.add(DiffHunk(type: DiffHunkType.added, value: d.text));
    } else if (d.operation == DIFF_DELETE) {
      removedChars += d.text.length;
      changedBlocks++;
      hunks.add(DiffHunk(type: DiffHunkType.removed, value: d.text));
    } else {
      hunks.add(DiffHunk(type: DiffHunkType.unchanged, value: d.text));
    }
  }

  final summary = '+$addedChars 字 / -$removedChars 字（$changedBlocks 处差异）';
  return DocumentDiffResult(
    hunks: hunks,
    addedChars: addedChars,
    removedChars: removedChars,
    changedBlocks: changedBlocks,
    summary: summary,
  );
}

List<DeletedDarling> extractDeletedDarlings({
  required String documentId,
  required String snapshotId,
  required String oldText,
  required String newText,
  int minChars = 24,
}) {
  final diff = computeDocumentDiff(oldText, newText);
  final now = DateTime.now().toIso8601String();
  final darlings = <DeletedDarling>[];
  for (final h in diff.hunks) {
    if (h.type != DiffHunkType.removed) continue;
    final clean = h.value.trim();
    if (clean.length < minChars) continue;
    darlings.add(DeletedDarling(
      id: 'darling_${const Uuid().v4().substring(0, 8)}',
      documentId: documentId,
      snapshotId: snapshotId,
      deletedAt: now,
      text: clean,
      charCount: clean.length,
      tags: const ['自动捕获废稿'],
    ));
  }
  return darlings;
}
