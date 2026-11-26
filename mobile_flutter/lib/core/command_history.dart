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
  const HistoryCommandEntry({
    required this.label,
    required this.before,
    required this.after,
  });

  final String label;
  final DocEditableState before;
  final DocEditableState after;
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

  void push(String label, DocEditableState before, DocEditableState after) {
    _undoStack.add(HistoryCommandEntry(
      label: label,
      before: before.clone(),
      after: after.clone(),
    ));
    if (_undoStack.length > maxEntries) {
      _undoStack.removeAt(0);
    }
    _redoStack.clear();
  }

  DocEditableState? undo() {
    if (_undoStack.isEmpty) return null;
    final entry = _undoStack.removeLast();
    _redoStack.add(entry);
    return entry.before.clone();
  }

  DocEditableState? redo() {
    if (_redoStack.isEmpty) return null;
    final entry = _redoStack.removeLast();
    _undoStack.add(entry);
    return entry.after.clone();
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

  return annotations.map((ann) {
    if (ann.anchorEnd <= editStart) {
      return ann;
    }
    if (ann.anchorStart >= oldEditEnd) {
      final ns = (ann.anchorStart + delta).clamp(0, newText.length);
      final ne = (ann.anchorEnd + delta).clamp(ns, newText.length);
      return ann.copyWith(anchorStart: ns, anchorEnd: ne);
    }
    final ns = ann.anchorStart.clamp(0, newText.length);
    final ne = (ann.anchorEnd + delta).clamp(ns, newText.length);
    return ann.copyWith(anchorStart: ns, anchorEnd: ne);
  }).toList();
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
