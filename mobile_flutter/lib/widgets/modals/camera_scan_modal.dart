import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../state/app_controller.dart';
import '../../theme/arc_theme.dart';

enum ScanFilterMode { original, documentCrisp, bwScan, warmPaper }

class CameraScanModal extends StatefulWidget {
  const CameraScanModal({super.key, required this.controller});
  final AppController controller;

  @override
  State<CameraScanModal> createState() => _CameraScanModalState();
}

class _CameraScanModalState extends State<CameraScanModal> {
  Uint8List? _rawBytes;
  Uint8List? _processedBytes;
  ScanFilterMode _mode = ScanFilterMode.documentCrisp;
  final TextEditingController _titleCtrl = TextEditingController(text: '纸质文献扫描归档');
  final TextEditingController _noteCtrl = TextEditingController();

  @override
  void dispose() {
    _titleCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource source) async {
    final xf = await ImagePicker().pickImage(source: source, maxWidth: 1600);
    if (xf == null) return;
    final bytes = await File(xf.path).readAsBytes();
    _rawBytes = bytes;
    _applyFilter(_mode);
  }

  void _applyFilter(ScanFilterMode mode) {
    _mode = mode;
    if (_rawBytes == null) {
      setState(() {});
      return;
    }
    final decoded = img.decodeImage(_rawBytes!);
    if (decoded == null) return;
    final copy = img.Image.from(decoded);
    if (mode == ScanFilterMode.bwScan) {
      img.grayscale(copy);
      img.contrast(copy, contrast: 160);
    } else if (mode == ScanFilterMode.documentCrisp) {
      img.contrast(copy, contrast: 135);
      img.adjustColor(copy, brightness: 1.08);
    } else if (mode == ScanFilterMode.warmPaper) {
      img.sepia(copy, amount: 0.35);
    }
    setState(() {
      _processedBytes = Uint8List.fromList(img.encodeJpg(copy, quality: 88));
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final isZh = c.settings.locale.isZh;

    return ArcSurface(
      borderRadius: 24,
      padding: const EdgeInsets.all(16),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(LucideIcons.camera, size: 18, color: t.accent),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(isZh ? '拍照扫描增强入库' : 'Camera Scan Intake',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: t.textPrimary)),
                ),
                IconButton(onPressed: () => Navigator.of(context).pop(), icon: const Icon(LucideIcons.x, size: 18)),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pick(ImageSource.camera),
                    icon: const Icon(LucideIcons.camera, size: 15),
                    label: Text(isZh ? '相机拍摄' : 'Camera'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pick(ImageSource.gallery),
                    icon: const Icon(LucideIcons.image, size: 15),
                    label: Text(isZh ? '相册选图' : 'Gallery'),
                  ),
                ),
              ],
            ),
            if (_processedBytes != null) ...[
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.memory(_processedBytes!, height: 180, width: double.infinity, fit: BoxFit.contain),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                children: [
                  for (final m in ScanFilterMode.values)
                    ChoiceChip(
                      label: Text(_filterLabel(m, isZh), style: const TextStyle(fontSize: 11.5)),
                      selected: _mode == m,
                      onSelected: (_) => _applyFilter(m),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 10),
            TextField(
              controller: _titleCtrl,
              decoration: InputDecoration(
                isDense: true,
                labelText: isZh ? '归档标题' : 'Title',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _noteCtrl,
              maxLines: 2,
              decoration: InputDecoration(
                isDense: true,
                labelText: isZh ? '摘录笔记' : 'Notes',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  final imgMd = _processedBytes != null
                      ? '\n\n![scan](data:image/jpeg;base64,${base64Encode(_processedBytes!)})'
                      : '';
                  c.ingestTextDocument(
                    title: _titleCtrl.text,
                    body: '# ${_titleCtrl.text}\n\n${_noteCtrl.text}$imgMd',
                    tags: const ['拍照扫描'],
                  );
                  Navigator.of(context).pop();
                },
                style: FilledButton.styleFrom(backgroundColor: t.accent, foregroundColor: t.accentText),
                child: Text(isZh ? '增强并入库归档' : 'Save Scan to Archive'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _filterLabel(ScanFilterMode m, bool isZh) {
    switch (m) {
      case ScanFilterMode.documentCrisp:
        return isZh ? '清晰文档' : 'Crisp Doc';
      case ScanFilterMode.bwScan:
        return isZh ? '黑白扫描' : 'B&W Scan';
      case ScanFilterMode.warmPaper:
        return isZh ? '护眼纸感' : 'Warm Paper';
      case ScanFilterMode.original:
        return isZh ? '原图' : 'Original';
    }
  }
}
