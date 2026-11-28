import type { AnnotationItem } from '../types/archive';

export type AnnotationStatusFilter = 'all' | 'open' | 'handled';
export type AnnotationTypeFilter = 'all' | 'comment' | 'revision';

export interface AnnotationFilterState {
  status: AnnotationStatusFilter;
  type: AnnotationTypeFilter;
  query: string;
}

export const DEFAULT_ANNOTATION_FILTER: AnnotationFilterState = {
  status: 'all',
  type: 'all',
  query: '',
};

export interface AnnotationFilterCounts {
  total: number;
  open: number;
  handled: number;
  comments: number;
  revisions: number;
  openComments: number;
  openRevisions: number;
}

export function isAnnotationFilterActive(filter: AnnotationFilterState): boolean {
  return (
    filter.status !== 'all' ||
    filter.type !== 'all' ||
    filter.query.trim().length > 0
  );
}

export function matchesAnnotationFilter(
  ann: AnnotationItem,
  filter: AnnotationFilterState,
): boolean {
  if (filter.status === 'open' && ann.status !== 'open') return false;
  if (filter.status === 'handled' && ann.status === 'open') return false;
  if (filter.type !== 'all' && ann.type !== filter.type) return false;

  const q = filter.query.trim().toLowerCase();
  if (!q) return true;

  if (ann.author.toLowerCase().includes(q)) return true;
  if (ann.originalText.toLowerCase().includes(q)) return true;
  if (ann.commentText && ann.commentText.toLowerCase().includes(q)) return true;
  if (ann.suggestedText && ann.suggestedText.toLowerCase().includes(q)) return true;
  if (
    ann.replies.some(
      (r) => r.text.toLowerCase().includes(q) || r.author.toLowerCase().includes(q),
    )
  ) {
    return true;
  }
  return false;
}

export function filterAnnotations(
  annotations: AnnotationItem[],
  filter: AnnotationFilterState,
): AnnotationItem[] {
  if (!isAnnotationFilterActive(filter)) return annotations;
  return annotations.filter((ann) => matchesAnnotationFilter(ann, filter));
}

export function countAnnotationStats(annotations: AnnotationItem[]): AnnotationFilterCounts {
  let open = 0;
  let handled = 0;
  let comments = 0;
  let revisions = 0;
  let openComments = 0;
  let openRevisions = 0;

  for (const ann of annotations) {
    const isOpen = ann.status === 'open';
    if (isOpen) open += 1;
    else handled += 1;

    if (ann.type === 'comment') {
      comments += 1;
      if (isOpen) openComments += 1;
    } else {
      revisions += 1;
      if (isOpen) openRevisions += 1;
    }
  }

  return {
    total: annotations.length,
    open,
    handled,
    comments,
    revisions,
    openComments,
    openRevisions,
  };
}
