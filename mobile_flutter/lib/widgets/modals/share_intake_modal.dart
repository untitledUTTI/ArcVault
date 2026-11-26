import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';
import '../../theme/liquid_glass_surface.dart';

class ShareIntakeModal extends StatefulWidget {
  const ShareIntakeModal({
    super.key,
    required this.controller,
    this.initialTitle,
    this.initialText,
  });

  final AppController controller;
  final String? initialTitle;
  final String? initialText;

  @override
  State<ShareIntakeModal> createState() => _ShareIntakeModalState();
}

class _ShareIntakeModalState extends State<ShareIntakeModal> {
  late final TextEditingController _titleCtrl =
      TextEditingController(text: widget.initialTitle ?? '系统分享 / 剪贴板摘录');
  late final TextEditingController _bodyCtrl =
      TextEditingController(text: widget.initialText ?? '');

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
    final isZh = c.settings.locale.isZh;

    return ArcLiquidGlassSurface(
      liquidGlassSettings: c.settings.liquidGlass,
      borderRadius: 24,
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(LucideIcons.share2, size: 18, color: t.accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text(isZh ? '系统分享 / 剪贴板快速入库' : 'System Share / Clipboard Intake',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: t.textPrimary)),
              ),
              IconButton(onPressed: () => Navigator.of(context).pop(), icon: const Icon(LucideIcons.x, size: 18)),
            ],
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _titleCtrl,
            decoration: InputDecoration(
              isDense: true,
              labelText: isZh ? '标题' : 'Title',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _bodyCtrl,
            maxLines: 5,
            decoration: InputDecoration(
              isDense: true,
              labelText: isZh ? '正文内容' : 'Content',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: () async {
                  final clip = await Clipboard.getData(Clipboard.kTextPlain);
                  if (clip?.text != null) {
                    setState(() => _bodyCtrl.text = clip!.text!);
                  }
                },
                icon: const Icon(LucideIcons.clipboardPaste, size: 14),
                label: Text(isZh ? '读取剪贴板' : 'Paste Clipboard'),
              ),
              const Spacer(),
              FilledButton(
                onPressed: () {
                  c.ingestTextDocument(
                    title: _titleCtrl.text,
                    body: '# ${_titleCtrl.text}\n\n${_bodyCtrl.text}',
                  );
                  c.clearPendingShare();
                  Navigator.of(context).pop();
                },
                style: FilledButton.styleFrom(backgroundColor: t.accent, foregroundColor: t.accentText),
                child: Text(isZh ? '入库保存' : 'Save to Space'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
