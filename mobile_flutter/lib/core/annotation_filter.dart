import '../models/archive_models.dart';

enum AnnotationStatusFilter { all, open, handled }

enum AnnotationTypeFilter { all, comment, revision }

class AnnotationFilterState {
  const AnnotationFilterState({
    this.status = AnnotationStatusFilter.all,
    this.type = AnnotationTypeFilter.all,
    this.query = '',
  });

  final AnnotationStatusFilter status;
  final AnnotationTypeFilter type;
  final String query;

  bool get isActive =>
      status != AnnotationStatusFilter.all ||
      type != AnnotationTypeFilter.all ||
      query.trim().isNotEmpty;

  AnnotationFilterState copyWith({
    AnnotationStatusFilter? status,
    AnnotationTypeFilter? type,
    String? query,
  }) {
    return AnnotationFilterState(
      status: status ?? this.status,
      type: type ?? this.type,
      query: query ?? this.query,
    );
  }
}

class AnnotationFilterCounts {
  const AnnotationFilterCounts({
    required this.total,
    required this.open,
    required this.handled,
    required this.comments,
    required this.revisions,
    required this.openComments,
    required this.openRevisions,
  });

  final int total;
  final int open;
  final int handled;
  final int comments;
  final int revisions;
  final int openComments;
  final int openRevisions;
}

bool matchesAnnotationFilter(AnnotationItem ann, AnnotationFilterState filter) {
  if (filter.status == AnnotationStatusFilter.open &&
      ann.status != AnnotationStatus.open) {
    return false;
  }
  if (filter.status == AnnotationStatusFilter.handled &&
      ann.status == AnnotationStatus.open) {
    return false;
  }
  if (filter.type == AnnotationTypeFilter.comment &&
      ann.type != AnnotationType.comment) {
    return false;
  }
  if (filter.type == AnnotationTypeFilter.revision &&
      ann.type != AnnotationType.revision) {
    return false;
  }

  final q = filter.query.trim().toLowerCase();
  if (q.isEmpty) return true;

  if (ann.author.toLowerCase().contains(q)) return true;
  if (ann.originalText.toLowerCase().contains(q)) return true;
  if (ann.commentText != null && ann.commentText!.toLowerCase().contains(q)) {
    return true;
  }
  if (ann.suggestedText != null &&
      ann.suggestedText!.toLowerCase().contains(q)) {
    return true;
  }
  for (final r in ann.replies) {
    if (r.text.toLowerCase().contains(q) ||
        r.author.toLowerCase().contains(q)) {
      return true;
    }
  }
  return false;
}

List<AnnotationItem> filterAnnotations(
  List<AnnotationItem> annotations,
  AnnotationFilterState filter,
) {
  if (!filter.isActive) return annotations;
  return annotations.where((ann) => matchesAnnotationFilter(ann, filter)).toList();
}

AnnotationFilterCounts countAnnotationStats(List<AnnotationItem> annotations) {
  var open = 0;
  var handled = 0;
  var comments = 0;
  var revisions = 0;
  var openComments = 0;
  var openRevisions = 0;

  for (final ann in annotations) {
    final isOpen = ann.status == AnnotationStatus.open;
    if (isOpen) {
      open++;
    } else {
      handled++;
    }
    if (ann.type == AnnotationType.comment) {
      comments++;
      if (isOpen) openComments++;
    } else {
      revisions++;
      if (isOpen) openRevisions++;
    }
  }

  return AnnotationFilterCounts(
    total: annotations.length,
    open: open,
    handled: handled,
    comments: comments,
    revisions: revisions,
    openComments: openComments,
    openRevisions: openRevisions,
  );
}
