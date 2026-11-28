import '../models/archive_models.dart';

class DocEditableState {
  const DocEditableState({
    required this.markdownText,
    required this.latexText,
    required this.annotations,
    required this.activeFormat,
  });

  final String markdownText;
  final String latexText;
  final List<AnnotationItem> annotations;
  final EditorFormat activeFormat;

  DocEditableState clone() => DocEditableState(
        markdownText: markdownText,
        latexText: latexText,
        annotations: annotations.map((a) => a.copyWith()).toList(),
        activeFormat: activeFormat,
      );
}

class HistoryCommandEntry {
  HistoryCommandEntry({
    required this.label,
    required this.before,
    required this.after,
    required this.timestampMs,
    this.mergeKey,
    this.immutable = false,
  });

  String label;
  final DocEditableState before;
  DocEditableState after;
  int timestampMs;
  String? mergeKey;
  bool immutable;
}

class CommandHistory {
  CommandHistory({this.maxEntries = 100});

  final int maxEntries;
  final List<HistoryCommandEntry> _undoStack = [];
  final List<HistoryCommandEntry> _redoStack = [];

  bool get canUndo => _undoStack.isNotEmpty;
  bool get canRedo => _redoStack.isNotEmpty;
  int get undoCount => _undoStack.length;
  int get redoCount => _redoStack.length;
  String? get undoLabel => _undoStack.isNotEmpty ? _undoStack.last.label : null;
  String? get redoLabel => _redoStack.isNotEmpty ? _redoStack.last.label : null;

  void push(
    String label,
    DocEditableState before,
    DocEditableState after, {
    String? mergeKey,
    int mergeWindowMs = 500,
    bool skipClone = false,
    int? nowMs,
  }) {
    final now = nowMs ?? DateTime.now().millisecondsSinceEpoch;
    if (mergeKey != null && _undoStack.isNotEmpty) {
      final top = _undoStack.last;
      if (top.mergeKey == mergeKey && (now - top.timestampMs) <= mergeWindowMs) {
        top.after = skipClone ? after : after.clone();
        top.timestampMs = now;
        top.label = label;
        if (skipClone) {
          top.immutable = true;
        }
        _redoStack.clear();
        return;
      }
    }

    _undoStack.add(HistoryCommandEntry(
      label: label,
      before: skipClone ? before : before.clone(),
      after: skipClone ? after : after.clone(),
      timestampMs: now,
      mergeKey: mergeKey,
      immutable: skipClone,
    ));
    if (_undoStack.length > maxEntries) {
      _undoStack.removeAt(0);
    }
    _redoStack.clear();
  }

  void breakMergeChain() {
    if (_undoStack.isNotEmpty) {
      _undoStack.last.mergeKey = null;
    }
  }

  DocEditableState? undo() {
    if (_undoStack.isEmpty) return null;
    final entry = _undoStack.removeLast();
    _redoStack.add(entry);
    return entry.immutable ? entry.before : entry.before.clone();
  }

  DocEditableState? redo() {
    if (_redoStack.isEmpty) return null;
    final entry = _redoStack.removeLast();
    _undoStack.add(entry);
    return entry.immutable ? entry.after : entry.after.clone();
  }

  void clear() {
    _undoStack.clear();
    _redoStack.clear();
  }
}

/// Adjusts annotation character offsets when user edits the document text.
List<AnnotationItem> adjustAnchorsForTextEdit({
  required List<AnnotationItem> annotations,
  required String oldText,
  required String newText,
}) {
  if (oldText == newText || annotations.isEmpty) return annotations;

  var prefixLen = 0;
  final minLen = oldText.length < newText.length ? oldText.length : newText.length;
  while (prefixLen < minLen && oldText.codeUnitAt(prefixLen) == newText.codeUnitAt(prefixLen)) {
    prefixLen++;
  }

  var oldSuffix = oldText.length;
  var newSuffix = newText.length;
  while (oldSuffix > prefixLen &&
      newSuffix > prefixLen &&
      oldText.codeUnitAt(oldSuffix - 1) == newText.codeUnitAt(newSuffix - 1)) {
    oldSuffix--;
    newSuffix--;
  }

  final editStart = prefixLen;
  final oldEditEnd = oldSuffix;
  final delta = newText.length - oldText.length;

  var changed = false;
  final nextAnnotations = annotations.map((ann) {
    if (ann.anchorEnd <= editStart) {
      return ann;
    }
    late final int ns;
    late final int ne;
    if (ann.anchorStart >= oldEditEnd) {
      ns = (ann.anchorStart + delta).clamp(0, newText.length);
      ne = (ann.anchorEnd + delta).clamp(ns, newText.length);
    } else {
      ns = ann.anchorStart.clamp(0, newText.length);
      ne = (ann.anchorEnd + delta).clamp(ns, newText.length);
    }
    if (ns == ann.anchorStart && ne == ann.anchorEnd) {
      return ann;
    }
    changed = true;
    return ann.copyWith(anchorStart: ns, anchorEnd: ne);
  }).toList();

  return changed ? nextAnnotations : annotations;
}

/// Applies text replacement for accepting/rejecting a revision or applying an AI rewrite,
/// shifting subsequent annotation offsets cleanly.
({String text, List<AnnotationItem> annotations}) applyAnnotationTextReplacement({
  required String text,
  required List<AnnotationItem> annotations,
  required String targetAnnotationId,
  required String replacement,
  required AnnotationStatus nextStatus,
}) {
  final idx = annotations.indexWhere((a) => a.id == targetAnnotationId);
  if (idx < 0) return (text: text, annotations: annotations);
  final target = annotations[idx];
  final start = target.anchorStart.clamp(0, text.length);
  final end = target.anchorEnd.clamp(start, text.length);

  final nextText = text.replaceRange(start, end, replacement);
  final delta = replacement.length - (end - start);

  final nextAnnotations = <AnnotationItem>[];
  for (var i = 0; i < annotations.length; i++) {
    final ann = annotations[i];
    if (ann.id == targetAnnotationId) {
      nextAnnotations.add(ann.copyWith(
        anchorStart: start,
        anchorEnd: start + replacement.length,
        status: nextStatus,
      ));
    } else if (ann.anchorStart >= end) {
      nextAnnotations.add(ann.copyWith(
        anchorStart: (ann.anchorStart + delta).clamp(0, nextText.length),
        anchorEnd: (ann.anchorEnd + delta).clamp(0, nextText.length),
      ));
    } else if (ann.anchorEnd > start && ann.anchorStart <= start) {
      nextAnnotations.add(ann.copyWith(
        anchorEnd: (ann.anchorEnd + delta).clamp(ann.anchorStart, nextText.length),
      ));
    } else {
      nextAnnotations.add(ann);
    }
  }
  return (text: nextText, annotations: nextAnnotations);
}

enum BatchAnnotationAction {
  acceptRevisions,
  rejectRevisions,
  resolveComments,
  reopenComments,
}

class _AppliedBatchEdit {
  const _AppliedBatchEdit({
    required this.id,
    required this.oldStart,
    required this.oldEnd,
    required this.newStart,
    required this.newEnd,
    required this.cumDelta,
  });

  final String id;
  final int oldStart;
  final int oldEnd;
  final int newStart;
  final int newEnd;
  final int cumDelta;
}

int _remapOffsetWithBatchEdits(
  int pos,
  List<_AppliedBatchEdit> edits,
  bool isEnd,
  int newTextLen,
) {
  if (edits.isEmpty) return pos.clamp(0, newTextLen);

  var lo = 0;
  var hi = edits.length - 1;
  var idx = -1;
  while (lo <= hi) {
    final mid = (lo + hi) >> 1;
    if (edits[mid].oldStart <= pos) {
      idx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  var mapped = pos;
  if (idx >= 0) {
    final e = edits[idx];
    if (pos < e.oldEnd) {
      mapped = isEnd ? e.newEnd : e.newStart;
    } else if (pos == e.oldEnd && e.oldStart == e.oldEnd) {
      mapped = isEnd ? e.newEnd : e.newStart;
    } else {
      mapped = pos + e.cumDelta;
    }
  }
  return mapped.clamp(0, newTextLen);
}

/// Applies batch accept/reject/resolve actions in O(N log N + |text|) time
/// with single-pass text assembly and binary-search offset remapping.
({String text, List<AnnotationItem> annotations, int affectedCount})
    applyBatchAnnotationAction({
  required String text,
  required List<AnnotationItem> annotations,
  required BatchAnnotationAction action,
  Set<String>? targetIds,
}) {
  bool isSelected(String id) => targetIds == null || targetIds.contains(id);

  if (action == BatchAnnotationAction.resolveComments ||
      action == BatchAnnotationAction.reopenComments) {
    final fromStatus = action == BatchAnnotationAction.resolveComments
        ? AnnotationStatus.open
        : AnnotationStatus.resolved;
    final toStatus = action == BatchAnnotationAction.resolveComments
        ? AnnotationStatus.resolved
        : AnnotationStatus.open;
    var affectedCount = 0;
    final nextAnnotations = annotations.map((ann) {
      if (ann.type == AnnotationType.comment &&
          ann.status == fromStatus &&
          isSelected(ann.id)) {
        affectedCount++;
        return ann.copyWith(status: toStatus);
      }
      return ann;
    }).toList();
    return (
      text: text,
      annotations: affectedCount > 0 ? nextAnnotations : annotations,
      affectedCount: affectedCount,
    );
  }

  final nextStatus = action == BatchAnnotationAction.acceptRevisions
      ? AnnotationStatus.accepted
      : AnnotationStatus.rejected;

  final textEdits = <({AnnotationItem ann, String replacement})>[];
  final statusOnlyIds = <String>{};

  for (final ann in annotations) {
    if (ann.type != AnnotationType.revision ||
        ann.status != AnnotationStatus.open ||
        !isSelected(ann.id)) {
      continue;
    }
    if (action == BatchAnnotationAction.acceptRevisions) {
      final replacement = ann.revisionKind == RevisionKind.delete
          ? ''
          : (ann.suggestedText ?? '');
      textEdits.add((ann: ann, replacement: replacement));
    } else {
      if (ann.revisionKind == RevisionKind.insert) {
        textEdits.add((ann: ann, replacement: ''));
      } else {
        statusOnlyIds.add(ann.id);
      }
    }
  }

  final totalAffected = textEdits.length + statusOnlyIds.length;
  if (totalAffected == 0) {
    return (text: text, annotations: annotations, affectedCount: 0);
  }

  if (textEdits.isEmpty) {
    final nextAnnotations = annotations
        .map((ann) => statusOnlyIds.contains(ann.id)
            ? ann.copyWith(status: nextStatus)
            : ann)
        .toList();
    return (
      text: text,
      annotations: nextAnnotations,
      affectedCount: totalAffected,
    );
  }

  textEdits.sort((a, b) {
    final cmp = a.ann.anchorStart.compareTo(b.ann.anchorStart);
    return cmp != 0 ? cmp : a.ann.anchorEnd.compareTo(b.ann.anchorEnd);
  });

  final buffer = StringBuffer();
  final appliedEdits = <_AppliedBatchEdit>[];
  final appliedById = <String, _AppliedBatchEdit>{};

  var cursor = 0;
  var newCursor = 0;
  var cumDelta = 0;

  for (final item in textEdits) {
    final start = item.ann.anchorStart.clamp(cursor, text.length);
    final end = item.ann.anchorEnd.clamp(start, text.length);
    buffer.write(text.substring(cursor, start));
    newCursor += start - cursor;

    final newStart = newCursor;
    buffer.write(item.replacement);
    newCursor += item.replacement.length;
    final newEnd = newCursor;

    cumDelta += item.replacement.length - (end - start);
    final edit = _AppliedBatchEdit(
      id: item.ann.id,
      oldStart: start,
      oldEnd: end,
      newStart: newStart,
      newEnd: newEnd,
      cumDelta: cumDelta,
    );
    appliedEdits.add(edit);
    appliedById[item.ann.id] = edit;
    cursor = end;
  }

  buffer.write(text.substring(cursor));
  final nextText = buffer.toString();

  final nextAnnotations = annotations.map((ann) {
    final applied = appliedById[ann.id];
    if (applied != null) {
      return ann.copyWith(
        anchorStart: applied.newStart,
        anchorEnd: applied.newEnd,
        status: nextStatus,
      );
    }

    final mappedStart = _remapOffsetWithBatchEdits(
      ann.anchorStart,
      appliedEdits,
      false,
      nextText.length,
    );
    final mappedEnd = _remapOffsetWithBatchEdits(
      ann.anchorEnd,
      appliedEdits,
      true,
      nextText.length,
    ).clamp(mappedStart, nextText.length);
    final updatedStatus =
        statusOnlyIds.contains(ann.id) ? nextStatus : ann.status;

    if (mappedStart == ann.anchorStart &&
        mappedEnd == ann.anchorEnd &&
        updatedStatus == ann.status) {
      return ann;
    }

    return ann.copyWith(
      anchorStart: mappedStart,
      anchorEnd: mappedEnd,
      status: updatedStatus,
    );
  }).toList();

  return (
    text: nextText,
    annotations: nextAnnotations,
    affectedCount: totalAffected,
  );
}

class ParagraphSlice {
  const ParagraphSlice({
    required this.start,
    required this.end,
    required this.text,
  });

  final int start;
  final int end;
  final String text;
}

class AnnotatedParagraphBlock {
  const AnnotatedParagraphBlock({
    required this.start,
    required this.end,
    required this.text,
    required this.annotations,
  });

  final int start;
  final int end;
  final String text;
  final List<AnnotationItem> annotations;
}

List<ParagraphSlice> _splitNonEmptyParagraphs(String text) {
  final paragraphs = <ParagraphSlice>[];
  final lines = text.split('\n');
  var cur = 0;
  var blockStart = -1;
  final blockLines = <String>[];

  for (final line in lines) {
    final lineStart = cur;
    final lineEnd = cur + line.length;
    if (line.trim().isNotEmpty) {
      if (blockStart == -1) blockStart = lineStart;
      blockLines.add(line);
    } else if (blockStart != -1) {
      paragraphs.add(ParagraphSlice(
        start: blockStart,
        end: lineStart - 1,
        text: blockLines.join('\n'),
      ));
      blockStart = -1;
      blockLines.clear();
    }
    cur = lineEnd + 1;
  }

  if (blockStart != -1) {
    paragraphs.add(ParagraphSlice(
      start: blockStart,
      end: text.length,
      text: blockLines.join('\n'),
    ));
  }
  return paragraphs;
}

/// Extracts the non-empty paragraph block containing [offset] (separated by blank lines).
ParagraphSlice extractParagraphAtOffset(String text, int offset) {
  final clamped = offset.clamp(0, text.length);
  final paragraphs = _splitNonEmptyParagraphs(text);
  if (paragraphs.isEmpty) {
    return ParagraphSlice(start: 0, end: text.length, text: text);
  }
  for (final p in paragraphs) {
    if (clamped >= p.start && clamped <= p.end) return p;
  }
  for (final p in paragraphs) {
    if (p.end >= clamped) return p;
  }
  return paragraphs.last;
}

/// Extracts only paragraphs that overlap with annotations/revisions for Review Mode.
List<AnnotatedParagraphBlock> extractAnnotatedParagraphs(
  String text,
  List<AnnotationItem> annotations,
) {
  final validAnns = annotations
      .where((a) =>
          a.status == AnnotationStatus.open ||
          a.status == AnnotationStatus.resolved ||
          a.status == AnnotationStatus.accepted ||
          a.status == AnnotationStatus.rejected)
      .toList()
    ..sort((a, b) => a.anchorStart.compareTo(b.anchorStart));
  if (validAnns.isEmpty) return const [];

  final paragraphs = _splitNonEmptyParagraphs(text);
  final out = <AnnotatedParagraphBlock>[];
  for (final p in paragraphs) {
    final matching = validAnns
        .where((a) => a.anchorEnd >= p.start && a.anchorStart <= p.end)
        .toList();
    if (matching.isNotEmpty) {
      out.add(AnnotatedParagraphBlock(
        start: p.start,
        end: p.end,
        text: p.text,
        annotations: matching,
      ));
    }
  }
  return out;
}
