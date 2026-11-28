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

enum DiffHeadingStatus { unchanged, modified, added, removed }

class DiffLineToken {
  const DiffLineToken({required this.type, required this.value});
  final DiffHunkType type;
  final String value;
}

class DiffLine {
  const DiffLine({
    required this.index,
    required this.tokens,
    required this.hasAdded,
    required this.hasRemoved,
    this.chapterId,
    this.chapterLevel,
  });

  final int index;
  final List<DiffLineToken> tokens;
  final bool hasAdded;
  final bool hasRemoved;
  final String? chapterId;
  final int? chapterLevel;
}

class DiffChapter {
  const DiffChapter({
    required this.id,
    required this.title,
    required this.level,
    required this.lineIndex,
    required this.endLineIndex,
    required this.addedChars,
    required this.removedChars,
    required this.changedCount,
    required this.hasChanges,
    required this.headingStatus,
    this.isPreamble = false,
  });

  final String id;
  final String title;
  final int level;
  final int lineIndex;
  final int endLineIndex;
  final int addedChars;
  final int removedChars;
  final int changedCount;
  final bool hasChanges;
  final DiffHeadingStatus headingStatus;
  final bool isPreamble;
}

class DiffSectionBlock {
  const DiffSectionBlock({required this.chapter, required this.lines});
  final DiffChapter chapter;
  final List<DiffLine> lines;
}

class StructuredDocumentDiff {
  const StructuredDocumentDiff({
    required this.result,
    required this.lines,
    required this.chapters,
    required this.sections,
  });

  final DocumentDiffResult result;
  final List<DiffLine> lines;
  final List<DiffChapter> chapters;
  final List<DiffSectionBlock> sections;
}

class ParsedDiffHeading {
  const ParsedDiffHeading({required this.title, required this.level});
  final String title;
  final int level;
}

DocumentDiffResult computeDocumentDiff(String leftText, String rightText) {
  final dmp = DiffMatchPatch();
  final diffs = dmp.diff(leftText, rightText);
  dmp.diffCleanupSemantic(diffs);

  final hunks = <DiffHunk>[];
  var addedChars = 0;
  var removedChars = 0;
  var changedBlocks = 0;
  var inChangeCluster = false;

  for (final d in diffs) {
    if (d.text.isEmpty) continue;
    final cleanLen = d.text.replaceAll(RegExp(r'\s+'), '').length;
    if (d.operation == DIFF_INSERT) {
      addedChars += cleanLen;
      if (!inChangeCluster) {
        changedBlocks++;
        inChangeCluster = true;
      }
      hunks.add(DiffHunk(type: DiffHunkType.added, value: d.text));
    } else if (d.operation == DIFF_DELETE) {
      removedChars += cleanLen;
      if (!inChangeCluster) {
        changedBlocks++;
        inChangeCluster = true;
      }
      hunks.add(DiffHunk(type: DiffHunkType.removed, value: d.text));
    } else {
      inChangeCluster = false;
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

String _cleanHeadingTitle(String raw) {
  return raw
      .replaceAll(RegExp(r'\[@(?:zotero|endnote):\d{3}\]'), '')
      .replaceAllMapped(RegExp(r'\*\*(.+?)\*\*'), (m) => m.group(1) ?? '')
      .replaceAllMapped(RegExp(r'\*(.+?)\*'), (m) => m.group(1) ?? '')
      .replaceAllMapped(RegExp(r'`([^`]+)`'), (m) => m.group(1) ?? '')
      .replaceAll(RegExp(r'\{|\}'), '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

final _mdHeadingRe = RegExp(r'^(#{1,6})\s+(.+?)\s*#*$');
final _texHeadingRe =
    RegExp(r'^\\(part|chapter|section|subsection|subsubsection)\*?\{([^}]+)\}');
final _texAbstractRe = RegExp(r'^\\begin\{abstract\}', caseSensitive: false);
final _zhHeadingRe =
    RegExp(r'^第[一二三四五六七八九十百零\d]+([章节篇部])(?:\s+|[:：、.]|$)');
final _standaloneAcademicHeadingRe = RegExp(
  r'^(?:(?:\d+(?:\.\d+)*|[IVX]+)\s*[.、]\s*)?(?:摘要|Abstract|引言|Introduction|文献综述|Literature Review|Related Work|研究方法|Methodology|Methods|实验结果|Results|讨论|Discussion|结论|Conclusion|Conclusions|致谢|Acknowledgements?)$',
  caseSensitive: false,
);

ParsedDiffHeading? parseDiffHeadingLine(String rawLine) {
  final trimmed = rawLine.trim();
  if (trimmed.isEmpty) return null;

  final mdMatch = _mdHeadingRe.firstMatch(trimmed);
  if (mdMatch != null) {
    final title = _cleanHeadingTitle(mdMatch.group(2) ?? '');
    if (title.isNotEmpty) {
      return ParsedDiffHeading(title: title, level: mdMatch.group(1)!.length);
    }
    return null;
  }

  final texMatch = _texHeadingRe.firstMatch(trimmed);
  if (texMatch != null) {
    final cmd = texMatch.group(1)!;
    final level = (cmd == 'part' || cmd == 'chapter')
        ? 1
        : (cmd == 'section')
            ? 2
            : (cmd == 'subsection')
                ? 3
                : 4;
    final title = _cleanHeadingTitle(texMatch.group(2) ?? '');
    if (title.isNotEmpty) {
      return ParsedDiffHeading(title: title, level: level);
    }
    return null;
  }

  if (_texAbstractRe.hasMatch(trimmed)) {
    return const ParsedDiffHeading(title: 'Abstract', level: 1);
  }

  final zhMatch = _zhHeadingRe.firstMatch(trimmed);
  if (trimmed.length <= 48 && zhMatch != null) {
    final title = _cleanHeadingTitle(trimmed);
    if (title.isNotEmpty) {
      final level = zhMatch.group(1) == '节' ? 2 : 1;
      return ParsedDiffHeading(title: title, level: level);
    }
    return null;
  }

  if (_standaloneAcademicHeadingRe.hasMatch(trimmed)) {
    final title = _cleanHeadingTitle(trimmed);
    if (title.isNotEmpty) {
      return ParsedDiffHeading(title: title, level: 1);
    }
  }

  return null;
}

class _MutableDiffLine {
  final int index;
  final List<DiffLineToken> tokens = [];
  bool hasAdded = false;
  bool hasRemoved = false;
  bool carriedPrefixOnly = false;
  String? chapterId;
  int? chapterLevel;

  _MutableDiffLine(this.index);

  void pushToken(DiffHunkType type, String value) {
    if (value.isEmpty) return;
    if (tokens.isNotEmpty && tokens.last.type == type) {
      final prev = tokens.removeLast();
      tokens.add(DiffLineToken(type: type, value: prev.value + value));
    } else {
      tokens.add(DiffLineToken(type: type, value: value));
    }
    if (type == DiffHunkType.added) hasAdded = true;
    if (type == DiffHunkType.removed) hasRemoved = true;
  }

  DiffLine freeze() => DiffLine(
        index: index,
        tokens: List<DiffLineToken>.unmodifiable(tokens),
        hasAdded: hasAdded,
        hasRemoved: hasRemoved,
        chapterId: chapterId,
        chapterLevel: chapterLevel,
      );
}

class _RawChapterMeta {
  const _RawChapterMeta({
    required this.id,
    required this.title,
    required this.level,
    required this.lineIndex,
    required this.headingStatus,
  });

  final String id;
  final String title;
  final int level;
  final int lineIndex;
  final DiffHeadingStatus headingStatus;
}

({
  List<DiffLine> lines,
  List<DiffChapter> chapters,
  List<DiffSectionBlock> sections,
}) buildDiffLinesAndChapters(
  List<DiffHunk> hunks, {
  String preambleTitle = '文首导言',
}) {
  final mutableLines = <_MutableDiffLine>[];
  var current = _MutableDiffLine(0);

  void commitLine() {
    mutableLines.add(current);
    current = _MutableDiffLine(mutableLines.length);
  }

  void appendText(DiffHunkType type, String rawValue) {
    final normalized = rawValue.replaceAll('\r\n', '\n');
    final parts = normalized.split('\n');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].isNotEmpty) {
        current.pushToken(type, parts[i]);
      }
      if (i < parts.length - 1) {
        commitLine();
      }
    }
  }

  for (var hIdx = 0; hIdx < hunks.length; hIdx++) {
    final hunk = hunks[hIdx];
    if (hunk.value.isEmpty) continue;

    if (hunk.type == DiffHunkType.removed) {
      var delEnd = hIdx + 1;
      while (delEnd < hunks.length && hunks[delEnd].type == DiffHunkType.removed) {
        delEnd++;
      }
      var addEnd = delEnd;
      while (addEnd < hunks.length && hunks[addEnd].type == DiffHunkType.added) {
        addEnd++;
      }

      final removedValue =
          hunks.sublist(hIdx, delEnd).map((h) => h.value).join();
      final hasMultiLineRemoved =
          removedValue.contains('\n') || removedValue.contains('\r');

      if (addEnd > delEnd && hasMultiLineRemoved) {
        final prefixTokens = List<DiffLineToken>.from(current.tokens);
        appendText(DiffHunkType.removed, removedValue);
        if (current.tokens.isNotEmpty) {
          commitLine();
        }
        if (prefixTokens.isNotEmpty) {
          for (final pt in prefixTokens) {
            current.pushToken(pt.type, pt.value);
          }
          current.carriedPrefixOnly = true;
        }
        final addedValue =
            hunks.sublist(delEnd, addEnd).map((h) => h.value).join();
        appendText(DiffHunkType.added, addedValue);
        hIdx = addEnd - 1;
        continue;
      }
    }

    appendText(hunk.type, hunk.value);
  }
  if (current.tokens.isNotEmpty || mutableLines.isEmpty) {
    commitLine();
  }

  final rawChapters = <_RawChapterMeta>[];
  var inCodeFence = false;

  for (final line in mutableLines) {
    final oldBuf = StringBuffer();
    final newBuf = StringBuffer();
    for (final tok in line.tokens) {
      if (tok.type != DiffHunkType.added) oldBuf.write(tok.value);
      if (tok.type != DiffHunkType.removed) newBuf.write(tok.value);
    }
    final oldLineText = oldBuf.toString();
    final newLineText = newBuf.toString();
    final fenceCheck = newLineText.trim().isNotEmpty ? newLineText.trim() : oldLineText.trim();
    if (fenceCheck.startsWith('```')) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    final newHeading = parseDiffHeadingLine(newLineText);
    if (newHeading != null) {
      final status = ((oldLineText.trim().isEmpty || line.carriedPrefixOnly) &&
              line.hasAdded)
          ? DiffHeadingStatus.added
          : (line.hasAdded || line.hasRemoved)
              ? DiffHeadingStatus.modified
              : DiffHeadingStatus.unchanged;
      final id = 'diff_ch_${rawChapters.length}_${line.index}';
      rawChapters.add(_RawChapterMeta(
        id: id,
        title: newHeading.title,
        level: newHeading.level,
        lineIndex: line.index,
        headingStatus: status,
      ));
      line.chapterId = id;
      line.chapterLevel = newHeading.level;
      continue;
    }

    final oldHeading = parseDiffHeadingLine(oldLineText);
    if (oldHeading != null) {
      final status = (newLineText.trim().isEmpty ||
              (line.hasRemoved &&
                  !line.hasAdded &&
                  parseDiffHeadingLine(newLineText) == null))
          ? DiffHeadingStatus.removed
          : DiffHeadingStatus.modified;
      final id = 'diff_ch_${rawChapters.length}_${line.index}';
      rawChapters.add(_RawChapterMeta(
        id: id,
        title: oldHeading.title,
        level: oldHeading.level,
        lineIndex: line.index,
        headingStatus: status,
      ));
      line.chapterId = id;
      line.chapterLevel = oldHeading.level;
    }
  }

  final frozenLines = mutableLines.map((l) => l.freeze()).toList(growable: false);
  if (rawChapters.isEmpty) {
    return (
      lines: frozenLines,
      chapters: const <DiffChapter>[],
      sections: const <DiffSectionBlock>[],
    );
  }

  final chapters = <DiffChapter>[];
  final sections = <DiffSectionBlock>[];

  void addSection({
    required String id,
    required String title,
    required int level,
    required int start,
    required int end,
    required DiffHeadingStatus headingStatus,
    bool isPreamble = false,
  }) {
    final slice = frozenLines.sublist(start, end);
    var added = 0;
    var removed = 0;
    var changedCount = 0;

    for (final ln in slice) {
      var lineChanged = false;
      for (final tok in ln.tokens) {
        final cleanLen = tok.value.replaceAll(RegExp(r'\s+'), '').length;
        if (tok.type == DiffHunkType.added) {
          added += cleanLen;
          lineChanged = true;
        } else if (tok.type == DiffHunkType.removed) {
          removed += cleanLen;
          lineChanged = true;
        }
      }
      if (lineChanged) changedCount++;
    }

    final chapter = DiffChapter(
      id: id,
      title: title,
      level: level,
      lineIndex: start,
      endLineIndex: end,
      addedChars: added,
      removedChars: removed,
      changedCount: changedCount,
      hasChanges: added > 0 || removed > 0 || headingStatus != DiffHeadingStatus.unchanged,
      headingStatus: headingStatus,
      isPreamble: isPreamble,
    );
    chapters.add(chapter);
    sections.add(DiffSectionBlock(chapter: chapter, lines: slice));
  }

  final firstHeadingLine = rawChapters.first.lineIndex;
  if (firstHeadingLine > 0) {
    final hasPreambleContent = frozenLines
        .sublist(0, firstHeadingLine)
        .any((ln) => ln.tokens.any((tok) => tok.value.trim().isNotEmpty));
    if (hasPreambleContent) {
      addSection(
        id: 'diff_ch_preamble',
        title: preambleTitle,
        level: 1,
        start: 0,
        end: firstHeadingLine,
        headingStatus: DiffHeadingStatus.unchanged,
        isPreamble: true,
      );
    }
  }

  for (var i = 0; i < rawChapters.length; i++) {
    final cur = rawChapters[i];
    final end = i + 1 < rawChapters.length ? rawChapters[i + 1].lineIndex : frozenLines.length;
    addSection(
      id: cur.id,
      title: cur.title,
      level: cur.level,
      start: cur.lineIndex,
      end: end,
      headingStatus: cur.headingStatus,
    );
  }

  return (lines: frozenLines, chapters: chapters, sections: sections);
}

StructuredDocumentDiff computeStructuredDocumentDiff(
  String leftText,
  String rightText, {
  String preambleTitle = '文首导言',
}) {
  final result = computeDocumentDiff(leftText, rightText);
  final built = buildDiffLinesAndChapters(result.hunks, preambleTitle: preambleTitle);
  return StructuredDocumentDiff(
    result: result,
    lines: built.lines,
    chapters: built.chapters,
    sections: built.sections,
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
