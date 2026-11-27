import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/tutorial_flow.dart';
import '../i18n/dictionaries.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';

class AnnotationSidebar extends StatelessWidget {
  const AnnotationSidebar({super.key, required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final d = ArcStrings.of(controller.settings.locale);
    final doc = controller.activeDoc;
    final anns = doc?.annotations ?? const <AnnotationItem>[];

    return Container(
      key: controller.tourTargets.keyFor(TutorialTargetId.annotationSidebar),
      decoration: BoxDecoration(
        color: t.bgSurface,
        border: Border(left: BorderSide(color: t.borderSubtle)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
            child: Row(
              children: [
                Icon(LucideIcons.messageSquare, size: 15, color: t.accent),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    '${d.annotationsSheet} (${anns.length})',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: t.textPrimary),
                  ),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: t.borderSubtle),
          Expanded(
            child: anns.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(d.annotationsEmpty, style: TextStyle(fontSize: 12, color: t.textMuted)),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(10),
                    itemCount: anns.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final ann = anns[index];
                      final selected = ann.id == controller.selectedAnnotationId;
                      final badgeColor =
                          ann.type == AnnotationType.comment ? t.commentColor : t.revisionColor;
                      return InkWell(
                        onTap: () {
                          controller.selectAnnotation(ann.id);
                          controller.notifyTutorialAction(TutorialActionId.selectAnnotation);
                        },
                        borderRadius: BorderRadius.circular(t.radiusSm),
                        child: ArcCardSurface(
                          isActive: selected,
                          padding: const EdgeInsets.all(10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: badgeColor.withValues(alpha: 0.14),
                                      borderRadius: BorderRadius.circular(5),
                                    ),
                                    child: Text(
                                      ann.type == AnnotationType.comment ? '批注' : '修订',
                                      style: TextStyle(
                                          fontSize: 10.5, fontWeight: FontWeight.w700, color: badgeColor),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      ann.author,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                          fontSize: 12, fontWeight: FontWeight.w600, color: t.textPrimary),
                                    ),
                                  ),
                                  Text(ann.status.wire, style: TextStyle(fontSize: 10.5, color: t.textMuted)),
                                ],
                              ),
                              if (ann.originalText.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(
                                  ann.originalText,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 11.5, color: t.textSecondary),
                                ),
                              ],
                              if (ann.commentText?.isNotEmpty == true) ...[
                                const SizedBox(height: 4),
                                Text(
                                  ann.commentText!,
                                  style: TextStyle(fontSize: 12, color: t.textPrimary),
                                ),
                              ],
                              if (ann.suggestedText?.isNotEmpty == true) ...[
                                const SizedBox(height: 4),
                                Text(
                                  '→ ${ann.suggestedText}',
                                  style: TextStyle(fontSize: 11.5, color: t.accent, fontWeight: FontWeight.w600),
                                ),
                              ],
                              if (ann.status == AnnotationStatus.open && !(doc?.isSealed ?? false)) ...[
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    if (ann.type == AnnotationType.revision) ...[
                                      TextButton(
                                        onPressed: () => controller.acceptRevision(ann.id),
                                        style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                                        child: Text(d.acceptRevision, style: const TextStyle(fontSize: 11.5)),
                                      ),
                                      TextButton(
                                        onPressed: () => controller.rejectRevision(ann.id),
                                        style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                                        child: Text(d.rejectRevision, style: const TextStyle(fontSize: 11.5)),
                                      ),
                                    ] else
                                      TextButton(
                                        onPressed: () => controller.toggleResolveComment(ann.id),
                                        style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                                        child: Text(d.resolveComment, style: const TextStyle(fontSize: 11.5)),
                                      ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
