import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/academic_engines.dart';
import '../../core/tutorial_flow.dart';
import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';
import '../../theme/liquid_glass_surface.dart';

class PaperStudioModal extends StatefulWidget {
  const PaperStudioModal({super.key, required this.controller, this.onClose});
  final AppController controller;
  final VoidCallback? onClose;

  @override
  State<PaperStudioModal> createState() => _PaperStudioModalState();
}

class _PaperStudioModalState extends State<PaperStudioModal> {
  int _tab = 0; // 0 = consistency, 1 = rebuttal
  final TextEditingController _commentsCtrl = TextEditingController(
    text: '1. 请说明 93.6% 与 94.2% 的统计口径差异。\n2. 请补充图 3 架构图及实验复杂度分析。',
  );
  String? _rebuttalDraft;

  @override
  void dispose() {
    _commentsCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final isZh = c.settings.locale.isZh;
    final doc = c.activeDoc;
    final issues = doc == null
        ? const []
        : ConsistencyChecker.runCheck(doc.activeText, citationsSidecar: doc.citationsSidecar);

    return ArcLiquidGlassSurface(
      key: c.tourTargets.keyFor(TutorialTargetId.paperStudioModal),
      liquidGlassSettings: c.settings.liquidGlass,
      borderRadius: 24,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.8,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 10, 6),
              child: Row(
                children: [
                  Icon(LucideIcons.stethoscope, size: 18, color: t.accent),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(isZh ? '学术一致性体检 & Rebuttal 返修' : 'Consistency & Rebuttal Studio',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: t.textPrimary)),
                  ),
                  IconButton(
                      onPressed: () => (widget.onClose ?? () => Navigator.of(context).pop())(),
                      icon: const Icon(LucideIcons.x, size: 18)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  ChoiceChip(
                    label: Text('${isZh ? '一致性体检' : 'Consistency'} (${issues.length})'),
                    selected: _tab == 0,
                    onSelected: (_) => setState(() => _tab = 0),
                  ),
                  const SizedBox(width: 8),
                  ChoiceChip(
                    label: Text(isZh ? 'Rebuttal 返修生成器' : 'Rebuttal Draft'),
                    selected: _tab == 1,
                    onSelected: (_) => setState(() => _tab = 1),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _tab == 0
                  ? ListView.separated(
                      padding: const EdgeInsets.all(14),
                      itemCount: issues.isEmpty ? 1 : issues.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, idx) {
                        if (issues.isEmpty) {
                          return ArcFrostedCardSurface(
                            padding: const EdgeInsets.all(14),
                            child: Text(isZh ? '未检测到跨章节数值或引文一致性问题！' : 'No consistency issues found!',
                                style: TextStyle(color: t.accent, fontWeight: FontWeight.w600)),
                          );
                        }
                        final issue = issues[idx];
                        return ArcFrostedCardSurface(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(issue.title,
                                  style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                      color: issue.severity == 'error' ? t.revisionColor : t.accent)),
                              const SizedBox(height: 4),
                              Text(issue.detail, style: TextStyle(fontSize: 12, color: t.textSecondary)),
                              if (issue.suggestedFix != null) ...[
                                const SizedBox(height: 6),
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton(
                                    onPressed: () {
                                      final fixed = doc!.activeText.replaceFirst(issue.snippet, issue.suggestedFix!);
                                      c.updateActiveDocumentText(fixed, historyLabel: '一致性修复');
                                    },
                                    child: Text(isZh ? '一键修正为 ${issue.suggestedFix}' : 'Fix'),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    )
                  : ListView(
                      padding: const EdgeInsets.all(14),
                      children: [
                        TextField(
                          controller: _commentsCtrl,
                          maxLines: 4,
                          decoration: InputDecoration(
                            labelText: isZh ? '粘贴审稿人 / 导师意见' : 'Reviewer Comments',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                        const SizedBox(height: 10),
                        FilledButton.icon(
                          onPressed: () {
                            final snaps = doc != null ? c.snapshotsForDoc(doc.id) : const [];
                            final baseText = snaps.isNotEmpty
                                ? (c.cas.get(snaps.first.contentHash) ?? '')
                                : '';
                            setState(() {
                              _rebuttalDraft = RebuttalGenerator.buildDraft(
                                baselineText: baseText,
                                revisedText: doc?.activeText ?? '',
                                reviewerComments: _commentsCtrl.text,
                                isEn: !isZh,
                              );
                            });
                          },
                          icon: const Icon(LucideIcons.sparkles, size: 15),
                          label: Text(isZh ? '生成结构化 Rebuttal 草稿' : 'Generate Rebuttal'),
                          style: FilledButton.styleFrom(backgroundColor: t.accent, foregroundColor: t.accentText),
                        ),
                        if (_rebuttalDraft != null) ...[
                          const SizedBox(height: 12),
                          ArcFrostedCardSurface(
                            padding: const EdgeInsets.all(12),
                            child: SelectableText(_rebuttalDraft!, style: TextStyle(fontSize: 12.5, color: t.textPrimary)),
                          ),
                        ],
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
