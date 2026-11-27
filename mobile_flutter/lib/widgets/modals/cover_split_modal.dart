import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/ooxml_engine.dart';
import '../../core/tutorial_flow.dart';
import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';

class CoverSplitModal extends StatefulWidget {
  const CoverSplitModal({super.key, required this.controller, this.onClose});
  final AppController controller;
  final VoidCallback? onClose;

  @override
  State<CoverSplitModal> createState() => _CoverSplitModalState();
}

class _CoverSplitModalState extends State<CoverSplitModal> {
  late ParsedDocxBundle _bundle;
  late int _coverEndIndex;
  late bool _remember;

  @override
  void initState() {
    super.initState();
    final doc = widget.controller.activeDoc!;
    _bundle = OoxmlEngine.parseDocxBytes(base64Decode(doc.baseDocxBase64!));
    _coverEndIndex = doc.coverRule.coverEndBlockIndex;
    _remember = doc.coverRule.remember;
  }

  void _close() {
    if (widget.onClose != null) {
      widget.onClose!();
    } else {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final isZh = c.settings.locale.isZh;

    return ArcSurface(
      borderRadius: 24,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.78,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 10, 8),
              child: Row(
                children: [
                  Icon(LucideIcons.scissors, size: 18, color: t.accent),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      isZh ? 'Word 智能封面识别与切分微调' : 'Word Cover Detection & Split',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: t.textPrimary),
                    ),
                  ),
                  IconButton(
                    onPressed: () {
                      _close();
                      c.notifyTutorialAction(TutorialActionId.coverCancel);
                    },
                    icon: Icon(LucideIcons.x, size: 18, color: t.textSecondary),
                  ),
                ],
              ),
            ),
            Expanded(
              key: c.tourTargets.keyFor(TutorialTargetId.coverSplitBody),
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                itemCount: _bundle.blocks.length,
                separatorBuilder: (_, __) => const SizedBox(height: 6),
                itemBuilder: (context, idx) {
                  final blk = _bundle.blocks[idx];
                  final isCover = idx < _coverEndIndex;
                  return InkWell(
                    onTap: () => setState(() => _coverEndIndex = idx),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: isCover
                            ? Colors.amber.withValues(alpha: 0.14)
                            : (idx == _coverEndIndex ? t.accentSoft : t.bgSubtle.withValues(alpha: 0.5)),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: idx == _coverEndIndex
                              ? t.accent
                              : (isCover ? Colors.amber : t.borderSubtle),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                isCover
                                    ? '封面保留区 #${idx + 1}'
                                    : (idx == _coverEndIndex ? '▼ 正文从此开始' : '正文段落 #${idx + 1}'),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: isCover ? Colors.amber.shade800 : t.accent,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            blk.previewText,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 12.5, color: t.textPrimary),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            Padding(
              key: c.tourTargets.keyFor(TutorialTargetId.coverSplitFooter),
              padding: const EdgeInsets.fromLTRB(14, 6, 14, 14),
              child: Column(
                children: [
                  CheckboxListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    value: _remember,
                    onChanged: (v) => setState(() => _remember = v == true),
                    title: Text(isZh ? '记住此文档封面切分规则' : 'Remember rule for this document',
                        style: TextStyle(fontSize: 12, color: t.textSecondary)),
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            c.applyCoverSplit(0, _remember);
                            _close();
                            c.notifyTutorialAction(TutorialActionId.coverImportAll);
                          },
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
                          ),
                          child: Text(
                            isZh ? '不剥离(全部导入)' : 'Import All',
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 11),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      OutlinedButton(
                        onPressed: () {
                          _close();
                          c.notifyTutorialAction(TutorialActionId.coverCancel);
                        },
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                        ),
                        child: Text(isZh ? '取消' : 'Cancel', style: const TextStyle(fontSize: 11)),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: FilledButton(
                          key: c.tourTargets.keyFor(TutorialTargetId.coverConfirmBtn),
                          onPressed: () {
                            c.applyCoverSplit(_coverEndIndex, _remember);
                            _close();
                            c.notifyTutorialAction(TutorialActionId.coverConfirm);
                          },
                          style: FilledButton.styleFrom(
                            backgroundColor: t.accent,
                            foregroundColor: t.accentText,
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
                          ),
                          child: Text(
                            isZh ? '确认切分并提取正文' : 'Confirm Split',
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 11),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
