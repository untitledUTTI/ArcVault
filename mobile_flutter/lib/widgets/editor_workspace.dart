import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/academic_engines.dart';
import '../core/tutorial_flow.dart';
import '../i18n/dictionaries.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';
import 'touch_scroll_scrubber.dart';

class AnnotationHighlightTextController extends TextEditingController {
  AnnotationHighlightTextController({
    super.text,
    required List<AnnotationItem> annotations,
    required this.selectedAnnotationId,
    required this.commentColor,
    required this.revisionColor,
    required this.accentColor,
  }) : _annotations = annotations;

  List<AnnotationItem> _annotations;
  List<AnnotationItem>? _cachedOpenSorted;
  String? selectedAnnotationId;
  Color commentColor;
  Color revisionColor;
  Color accentColor;

  List<AnnotationItem> get annotations => _annotations;
  set annotations(List<AnnotationItem> next) {
    if (identical(_annotations, next)) return;
    _annotations = next;
    _cachedOpenSorted = null;
  }

  List<AnnotationItem> _getSortedOpenAnnotations() {
    final cached = _cachedOpenSorted;
    if (cached != null) return cached;
    final list = _annotations
        .where((a) => a.status == AnnotationStatus.open && a.anchorEnd > a.anchorStart)
        .toList()
      ..sort((a, b) => a.anchorStart.compareTo(b.anchorStart));
    _cachedOpenSorted = list;
    return list;
  }

  @override
  TextSpan buildTextSpan({
    required BuildContext context,
    TextStyle? style,
    required bool withComposing,
  }) {
    final full = text;
    if (full.isEmpty || _annotations.isEmpty) {
      return super.buildTextSpan(context: context, style: style, withComposing: withComposing);
    }

    final openAnns = _getSortedOpenAnnotations();

    if (openAnns.isEmpty) {
      return TextSpan(style: style, text: full);
    }

    final spans = <InlineSpan>[];
    var cursor = 0;
    for (final ann in openAnns) {
      final start = ann.anchorStart.clamp(0, full.length);
      final end = ann.anchorEnd.clamp(start, full.length);
      if (start < cursor) continue;
      if (start > cursor) {
        spans.add(TextSpan(text: full.substring(cursor, start)));
      }
      final isSelected = ann.id == selectedAnnotationId;
      final baseColor = ann.type == AnnotationType.comment ? commentColor : revisionColor;
      spans.add(TextSpan(
        text: full.substring(start, end),
        style: TextStyle(
          backgroundColor: baseColor.withValues(alpha: isSelected ? 0.34 : 0.17),
          decoration: TextDecoration.underline,
          decorationColor: baseColor,
          decorationThickness: isSelected ? 2.2 : 1.3,
        ),
      ));
      cursor = end;
    }
    if (cursor < full.length) {
      spans.add(TextSpan(text: full.substring(cursor)));
    }
    return TextSpan(style: style, children: spans);
  }
}

class EditorWorkspace extends StatefulWidget {
  const EditorWorkspace({
    super.key,
    required this.controller,
    required this.isCompact,
    required this.onOpenCoverSplit,
    required this.onOpenSkillsSettings,
    required this.onTogglePhrasebank,
    required this.onTapHighlightedAnnotation,
  });

  final AppController controller;
  final bool isCompact;
  final VoidCallback onOpenCoverSplit;
  final VoidCallback onOpenSkillsSettings;
  final VoidCallback onTogglePhrasebank;
  final void Function(String annId) onTapHighlightedAnnotation;

  @override
  State<EditorWorkspace> createState() => _EditorWorkspaceState();
}

class _EditorWorkspaceState extends State<EditorWorkspace> {
  late AnnotationHighlightTextController _textController;
  final ScrollController _editorScroll = ScrollController();
  final ScrollController _previewScroll = ScrollController();
  String? _lastDocId;
  EditorFormat? _lastFmt;
  int _lastLocateNonce = 0;

  @override
  void initState() {
    super.initState();
    final t = ArcThemeTokens.fromSettings(widget.controller.settings);
    _textController = AnnotationHighlightTextController(
      text: widget.controller.activeDoc?.activeText ?? '',
      annotations: widget.controller.activeDoc?.annotations ?? const [],
      selectedAnnotationId: widget.controller.selectedAnnotationId,
      commentColor: t.commentColor,
      revisionColor: t.revisionColor,
      accentColor: t.accent,
    );
    _lastDocId = widget.controller.activeDoc?.id;
    _lastFmt = widget.controller.activeDoc?.activeFormat;
    _lastLocateNonce = widget.controller.locateNonce;
  }

  @override
  void didUpdateWidget(covariant EditorWorkspace oldWidget) {
    super.didUpdateWidget(oldWidget);
    final doc = widget.controller.activeDoc;
    final t = ArcThemeTokens.fromSettings(widget.controller.settings);
    _textController.commentColor = t.commentColor;
    _textController.revisionColor = t.revisionColor;
    _textController.accentColor = t.accent;
    _textController.annotations = doc?.annotations ?? const [];
    _textController.selectedAnnotationId = widget.controller.selectedAnnotationId;

    if (doc != null &&
        (doc.id != _lastDocId ||
            doc.activeFormat != _lastFmt ||
            _textController.text != doc.activeText)) {
      _lastDocId = doc.id;
      _lastFmt = doc.activeFormat;
      final prevSel = _textController.selection;
      _textController.value = TextEditingValue(
        text: doc.activeText,
        selection: prevSel.isValid && prevSel.end <= doc.activeText.length
            ? prevSel
            : TextSelection.collapsed(offset: doc.activeText.length),
      );
    }

    if (doc != null &&
        widget.controller.locateNonce != _lastLocateNonce &&
        widget.controller.locateOffset != null) {
      _lastLocateNonce = widget.controller.locateNonce;
      _jumpToOffset(doc.activeText, widget.controller.locateOffset!);
    }
  }

  void _jumpToOffset(String text, int rawOffset) {
    final safeOffset = rawOffset.clamp(0, text.length);
    _textController.selection = TextSelection.collapsed(offset: safeOffset);

    var linesBefore = 0;
    for (var i = 0; i < safeOffset; i++) {
      if (text.codeUnitAt(i) == 10) linesBefore++;
    }
    var totalLines = linesBefore;
    for (var i = safeOffset; i < text.length; i++) {
      if (text.codeUnitAt(i) == 10) totalLines++;
    }
    final ratio = totalLines > 0
        ? (linesBefore / totalLines).clamp(0.0, 1.0)
        : (text.isNotEmpty ? (safeOffset / text.length).clamp(0.0, 1.0) : 0.0);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_editorScroll.hasClients) return;
      final pos = _editorScroll.position;
      if (pos.maxScrollExtent <= 0) return;
      final target =
          (ratio * pos.maxScrollExtent - pos.viewportDimension * 0.25)
              .clamp(0.0, pos.maxScrollExtent);
      _editorScroll.animateTo(
        target,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _textController.dispose();
    _editorScroll.dispose();
    _previewScroll.dispose();
    super.dispose();
  }

  void _checkSelectionForAnnotation() {
    final doc = widget.controller.activeDoc;
    if (doc == null) return;
    final sel = _textController.selection;
    if (!sel.isValid) return;
    final offset = sel.baseOffset;
    for (final ann in doc.annotations) {
      if (ann.status == AnnotationStatus.open &&
          offset >= ann.anchorStart &&
          offset <= ann.anchorEnd) {
        widget.controller.selectAnnotation(ann.id);
        widget.onTapHighlightedAnnotation(ann.id);
        break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final s = c.settings;
    final d = ArcStrings.of(s.locale);
    final doc = c.activeDoc;

    if (doc == null) {
      return Center(
        child: Text(
          d.sidebarEmpty,
          style: TextStyle(color: t.textMuted, fontSize: 13),
        ),
      );
    }

    final policy = c.effectiveAiPolicy;
    final enabledSkills = SkillRegistry.enabledSkills(s.skills);

    return Container(
      key: c.tourTargets.keyFor(TutorialTargetId.workspaceMain),
      color: t.bgApp,
      child: Column(
        children: [
          // Metadata / Privacy / Cover / Citations Bar
          Container(
            key: c.tourTargets.keyFor(TutorialTargetId.editorAiBar),
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: t.bgSubtle,
              border: Border(bottom: BorderSide(color: t.borderSubtle)),
            ),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  if (doc.coverRule.coverBlockCount > 0) ...[
                    InkWell(
                      onTap: onOpenCoverSplitOrNoop,
                      borderRadius: BorderRadius.circular(10),
                      child: _BannerChip(
                        icon: LucideIcons.scissors,
                        label: s.locale.isZh
                            ? '已保护 ${doc.coverRule.coverBlockCount} 段原封面'
                            : 'Protected ${doc.coverRule.coverBlockCount} cover blocks',
                        color: t.accent,
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  InkWell(
                    key: c.tourTargets.keyFor(TutorialTargetId.editorAiPolicyBtn),
                    onTap: () {
                      c.cycleActiveDocAiPolicy();
                      c.notifyTutorialAction(TutorialActionId.cycleAiPolicy);
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: _BannerChip(
                      icon: LucideIcons.shieldCheck,
                      label:
                          '${d.aiPolicyLabel}${policy == AiPrivacyPolicy.cloudOrLocal ? d.aiCloudLocal : policy == AiPrivacyPolicy.localOnly ? d.aiLocalOnly : d.aiDisabled}',
                      color: policy == AiPrivacyPolicy.disabled ? t.revisionColor : t.accent,
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: widget.onOpenSkillsSettings,
                    borderRadius: BorderRadius.circular(10),
                    child: _BannerChip(
                      icon: LucideIcons.sparkles,
                      label: enabledSkills.isEmpty
                          ? (s.locale.isZh ? 'Skills 未开启' : 'Skills Off')
                          : 'Skills: ${enabledSkills.length}',
                      color: t.textSecondary,
                    ),
                  ),
                  if (doc.citationsSidecar.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    _BannerChip(
                      icon: LucideIcons.quote,
                      label: s.locale.isZh
                          ? '已保护 ${doc.citationsSidecar.length} 处引文域'
                          : '${doc.citationsSidecar.length} Citations Locked',
                      color: t.commentColor,
                    ),
                  ],
                  if (doc.isSealed) ...[
                    const SizedBox(width: 8),
                    _BannerChip(
                      icon: LucideIcons.lock,
                      label: s.locale.isZh ? '只读封存锁定中' : 'Sealed Read-Only',
                      color: t.revisionColor,
                    ),
                  ],
                ],
              ),
            ),
          ),

          // Main Content Area (Editor / Split Preview / Office Preview)
          Expanded(
            child: doc.officePreview != null && !c.splitPreview
                ? _OfficePreviewBody(
                    preview: doc.officePreview!,
                    onSwitchToText: c.toggleSplitPreview,
                    isZh: s.locale.isZh,
                  )
                : widget.isCompact
                    ? (c.splitPreview
                        ? _buildPreviewPane(doc, s, t)
                        : _buildEditorPane(doc, s, t))
                    : Row(
                        children: [
                          Expanded(child: _buildEditorPane(doc, s, t)),
                          if (c.splitPreview) ...[
                            VerticalDivider(width: 1, color: t.borderSubtle),
                            Expanded(child: _buildPreviewPane(doc, s, t)),
                          ],
                        ],
                      ),
          ),
        ],
      ),
    );
  }

  void onOpenCoverSplitOrNoop() {
    if (widget.controller.activeDoc?.baseDocxBase64 != null) {
      widget.onOpenCoverSplit();
    }
  }

  Widget _buildEditorPane(ArchiveDocument doc, AppSettingsModel s, ArcThemeTokens t) {
    final fontSize = s.typography.editorFontSize;
    final lineHeight = s.typography.editorLineHeight;
    final fontFamily = s.typography.editorFontPreset == EditorFontPreset.mono
        ? 'monospace'
        : s.typography.editorFontPreset == EditorFontPreset.academicSerif
            ? 'serif'
            : null;

    return Stack(
      children: [
        Padding(
          padding: const EdgeInsets.only(right: 20),
          child: SingleChildScrollView(
            controller: _editorScroll,
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 80),
            child: TextField(
              controller: _textController,
              readOnly: doc.isSealed,
              maxLines: null,
              keyboardType: TextInputType.multiline,
              onTap: _checkSelectionForAnnotation,
              onChanged: (val) => widget.controller.updateActiveDocumentText(val),
              style: TextStyle(
                fontSize: fontSize,
                height: lineHeight,
                fontFamily: fontFamily,
                color: t.textPrimary,
              ),
              decoration: InputDecoration(
                border: InputBorder.none,
                hintText: s.locale.isZh
                    ? '在此开始学术写作或导入 .docx...'
                    : 'Start writing or import a .docx file...',
                hintStyle: TextStyle(color: t.textMuted),
              ),
            ),
          ),
        ),
        Positioned(
          right: 2,
          top: 8,
          bottom: 8,
          child: TouchScrollScrubber(
            scrollController: _editorScroll,
            documentText: doc.activeText,
            scrubberSettings: s.scrollScrubber,
            onHaptic: widget.controller.triggerHaptic,
          ),
        ),
      ],
    );
  }

  Widget _buildPreviewPane(ArchiveDocument doc, AppSettingsModel s, ArcThemeTokens t) {
    final raw = doc.activeFormat == EditorFormat.latex
        ? doc.markdownText
        : doc.markdownText;
    final mathSegments = _extractDisplayMathBlocks(raw);

    return Stack(
      children: [
        Padding(
          padding: const EdgeInsets.only(right: 20),
          child: ListView.builder(
            controller: _previewScroll,
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 80),
            itemCount: mathSegments.length,
            itemBuilder: (context, index) {
              final seg = mathSegments[index];
              if (seg.isMath) {
                return Container(
                  margin: const EdgeInsets.symmetric(vertical: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: t.bgSubtle.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Math.tex(
                      seg.content,
                      textStyle: TextStyle(fontSize: 16, color: t.textPrimary),
                      onErrorFallback: (err) => Text(
                        '\$\$${seg.content}\$\$',
                        style: TextStyle(fontFamily: 'monospace', color: t.revisionColor),
                      ),
                    ),
                  ),
                );
              }
              return MarkdownBody(
                data: seg.content,
                selectable: true,
                styleSheet: MarkdownStyleSheet(
                  p: TextStyle(
                    fontSize: s.typography.editorFontSize,
                    height: s.typography.editorLineHeight,
                    color: t.textPrimary,
                  ),
                  h1: TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w800,
                    color: t.textPrimary,
                  ),
                  h2: TextStyle(
                    fontSize: 17.5,
                    fontWeight: FontWeight.w700,
                    color: t.textPrimary,
                  ),
                  tableHead: TextStyle(fontWeight: FontWeight.w700, color: t.textPrimary),
                  tableBody: TextStyle(color: t.textPrimary),
                  tableBorder: TableBorder.all(color: t.borderSubtle),
                  blockquoteDecoration: BoxDecoration(
                    color: t.accentSoft,
                    border: Border(left: BorderSide(color: t.accent, width: 3)),
                  ),
                ),
              );
            },
          ),
        ),
        Positioned(
          right: 2,
          top: 8,
          bottom: 8,
          child: TouchScrollScrubber(
            scrollController: _previewScroll,
            documentText: doc.activeText,
            scrubberSettings: s.scrollScrubber,
            onHaptic: widget.controller.triggerHaptic,
          ),
        ),
      ],
    );
  }

  List<({bool isMath, String content})> _extractDisplayMathBlocks(String text) {
    final out = <({bool isMath, String content})>[];
    final pattern = RegExp(r'\$\$([\s\S]+?)\$\$');
    var last = 0;
    for (final m in pattern.allMatches(text)) {
      if (m.start > last) {
        out.add((isMath: false, content: text.substring(last, m.start)));
      }
      out.add((isMath: true, content: m.group(1)!.trim()));
      last = m.end;
    }
    if (last < text.length) {
      out.add((isMath: false, content: text.substring(last)));
    }
    if (out.isEmpty) out.add((isMath: false, content: text));
    return out;
  }
}

class _BannerChip extends StatelessWidget {
  const _BannerChip({required this.icon, required this.label, required this.color});
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
          ),
        ],
      ),
    );
  }
}

class _OfficePreviewBody extends StatelessWidget {
  const _OfficePreviewBody({
    required this.preview,
    required this.onSwitchToText,
    required this.isZh,
  });

  final OfficePreviewData preview;
  final VoidCallback onSwitchToText;
  final bool isZh;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                isZh
                    ? 'Office 内置结构化预览 (${preview.kind.toUpperCase()})'
                    : 'Office Built-in Preview (${preview.kind.toUpperCase()})',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: t.textPrimary),
              ),
            ),
            TextButton.icon(
              onPressed: onSwitchToText,
              icon: const Icon(LucideIcons.fileText, size: 14),
              label: Text(isZh ? '切换到源码编辑' : 'Edit Source'),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (preview.kind == 'pptx')
          ...preview.slides.map((sl) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: ArcCardSurface(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Slide ${sl.index} · ${sl.title}',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 14, color: t.accent),
                      ),
                      const SizedBox(height: 6),
                      ...sl.bullets.map((b) => Padding(
                            padding: const EdgeInsets.only(bottom: 3),
                            child: Text('• $b', style: TextStyle(color: t.textPrimary)),
                          )),
                      if (sl.notes != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            'Notes: ${sl.notes}',
                            style: TextStyle(fontSize: 11.5, color: t.textMuted),
                          ),
                        ),
                    ],
                  ),
                ),
              )),
        if (preview.kind == 'xlsx')
          ...preview.sheets.map((sh) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: ArcCardSurface(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(sh.name, style: TextStyle(fontWeight: FontWeight.w700, color: t.accent)),
                      const SizedBox(height: 8),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Table(
                          defaultColumnWidth: const IntrinsicColumnWidth(),
                          border: TableBorder.all(color: t.borderSubtle),
                          children: sh.rows
                              .map((r) => TableRow(
                                    children: r
                                        .map((c) => Padding(
                                              padding: const EdgeInsets.all(6),
                                              child: Text(c, style: TextStyle(color: t.textPrimary, fontSize: 12)),
                                            ))
                                        .toList(),
                                  ))
                              .toList(),
                        ),
                      ),
                    ],
                  ),
                ),
              )),
      ],
    );
  }
}

/// Optical Bezier Arc-Link curve connecting active editor anchor to annotation card on Tablet Landscape.
class ArcLinkOverlayPainter extends CustomPainter {
  const ArcLinkOverlayPainter({
    required this.start,
    required this.end,
    required this.color,
  });

  final Offset start;
  final Offset end;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final midX = (start.dx + end.dx) / 2;
    final path = Path()
      ..moveTo(start.dx, start.dy)
      ..cubicTo(midX, start.dy, midX, end.dy, end.dx, end.dy);

    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5
        ..color = color.withValues(alpha: 0.22)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0
        ..color = color,
    );
    canvas.drawCircle(start, 4, Paint()..color = color);
    canvas.drawCircle(end, 4, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant ArcLinkOverlayPainter oldDelegate) =>
      oldDelegate.start != start || oldDelegate.end != end || oldDelegate.color != color;
}
