import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/tutorial_flow.dart';
import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';

class ContextAssetsModal extends StatefulWidget {
  const ContextAssetsModal({super.key, required this.controller, this.onClose});
  final AppController controller;
  final VoidCallback? onClose;

  @override
  State<ContextAssetsModal> createState() => _ContextAssetsModalState();
}

class _ContextAssetsModalState extends State<ContextAssetsModal> {
  final TextEditingController _titleCtrl = TextEditingController();
  final TextEditingController _bodyCtrl = TextEditingController();

  @override
  void dispose() {
    _titleCtrl.dispose();
    _bodyCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final doc = c.activeDoc;
    final isZh = c.settings.locale.isZh;
    final motives = doc != null ? c.motivationsForDoc(doc.id) : const [];
    final assets = doc != null ? c.assetsForDoc(doc.id) : const [];

    return ArcSurface(
      key: c.tourTargets.keyFor(TutorialTargetId.contextAssetsModal),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.78,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 10, 6),
              child: Row(
                children: [
                  Icon(LucideIcons.paperclip, size: 18, color: t.accent),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(isZh ? '修改动机留痕 & 科研关联资产' : 'Motivations & Research Assets',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: t.textPrimary)),
                  ),
                  IconButton(
                      onPressed: () => (widget.onClose ?? () => Navigator.of(context).pop())(),
                      icon: const Icon(LucideIcons.x, size: 18)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(14),
                children: [
                  Text(isZh ? '新增修改动机记录' : 'Add Motivation Note',
                      style: TextStyle(fontWeight: FontWeight.w700, color: t.textPrimary)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _titleCtrl,
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: isZh ? '标题（如：导师面谈修改要求）' : 'Title',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _bodyCtrl,
                    maxLines: 2,
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: isZh ? '记录修改背景或邮件摘录...' : 'Details...',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      FilledButton(
                        onPressed: () {
                          if (_titleCtrl.text.trim().isEmpty) return;
                          c.addMotivation(_titleCtrl.text.trim(), _bodyCtrl.text.trim(), 'note');
                          _titleCtrl.clear();
                          _bodyCtrl.clear();
                        },
                        style: FilledButton.styleFrom(backgroundColor: t.accent, foregroundColor: t.accentText),
                        child: Text(isZh ? '记录动机' : 'Save Note'),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton.icon(
                        onPressed: c.pickLinkedAsset,
                        icon: const Icon(LucideIcons.plus, size: 14),
                        label: Text(isZh ? '关联科研附件' : 'Attach Asset'),
                      ),
                    ],
                  ),
                  const Divider(height: 22),
                  Text('${isZh ? '修改动机留痕' : 'Motivations'} (${motives.length})',
                      style: TextStyle(fontWeight: FontWeight.w700, color: t.textPrimary)),
                  const SizedBox(height: 6),
                  ...motives.map((m) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: ArcCardSurface(
                          padding: const EdgeInsets.all(10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(m.title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: t.textPrimary)),
                              if (m.content.isNotEmpty)
                                Text(m.content, style: TextStyle(fontSize: 12, color: t.textSecondary)),
                            ],
                          ),
                        ),
                      )),
                  const SizedBox(height: 12),
                  Text('${isZh ? '关联科研资产' : 'Linked Assets'} (${assets.length})',
                      style: TextStyle(fontWeight: FontWeight.w700, color: t.textPrimary)),
                  const SizedBox(height: 6),
                  ...assets.map((a) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: ArcCardSurface(
                          padding: const EdgeInsets.all(10),
                          child: Row(
                            children: [
                              Icon(LucideIcons.file, size: 15, color: t.accent),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text('${a.name} (${a.category})',
                                    style: TextStyle(fontSize: 12.5, color: t.textPrimary)),
                              ),
                              Text('${(a.sizeBytes / 1024).toStringAsFixed(1)} KB',
                                  style: TextStyle(fontSize: 11, color: t.textMuted)),
                            ],
                          ),
                        ),
                      )),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
