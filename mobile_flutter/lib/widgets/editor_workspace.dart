import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/academic_engines.dart';
import '../core/command_history.dart';
import '../core/review_stickers.dart';
import '../core/tutorial_flow.dart';
import '../i18n/dictionaries.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';
import 'mobile_quick_format_bar.dart';
import 'review_split_workspace.dart';
import 'sticker_picker_tabs.dart';
import 'sticker_text_style_controls.dart';
import 'sticker_visual.dart';
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
        .where((a) =>
            a.status == AnnotationStatus.open && a.anchorEnd > a.anchorStart)
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
      return super.buildTextSpan(
          context: context, style: style, withComposing: withComposing);
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
      final baseColor =
          ann.type == AnnotationType.comment ? commentColor : revisionColor;
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

class _ParaEditSession {
  _ParaEditSession({
    required this.paraStart,
    required this.annId,
    required this.originalFullText,
    required this.originalParaText,
    required this.latestParaText,
    this.dirty = false,
  });

  final int paraStart;
  final String annId;
  final String originalFullText;
  final String originalParaText;
  String latestParaText;
  bool dirty;
}

enum _ParaConfirmStep { confirm, pickSticker }

class _PendingParaConfirm {
  const _PendingParaConfirm({
    required this.paraStart,
    required this.annId,
    required this.originalFullText,
    required this.originalParaText,
    required this.latestParaText,
    this.step = _ParaConfirmStep.confirm,
    this.revertConfirm = false,
    required this.pickedStickerId,
    required this.pickerTab,
    required this.textOverlay,
    this.showTextCustomizer = true,
    this.userTouchedColor = false,
    this.nextAnnId,
    this.exitReviewAfter = false,
  });

  final int paraStart;
  final String annId;
  final String originalFullText;
  final String originalParaText;
  final String latestParaText;
  final _ParaConfirmStep step;
  final bool revertConfirm;
  final String pickedStickerId;
  final StickerCategory pickerTab;
  final StickerTextStyle textOverlay;
  final bool showTextCustomizer;
  final bool userTouchedColor;
  final String? nextAnnId;
  final bool exitReviewAfter;

  _PendingParaConfirm copyWith({
    _ParaConfirmStep? step,
    bool? revertConfirm,
    String? pickedStickerId,
    StickerCategory? pickerTab,
    StickerTextStyle? textOverlay,
    bool? showTextCustomizer,
    bool? userTouchedColor,
  }) {
    return _PendingParaConfirm(
      paraStart: paraStart,
      annId: annId,
      originalFullText: originalFullText,
      originalParaText: originalParaText,
      latestParaText: latestParaText,
      step: step ?? this.step,
      revertConfirm: revertConfirm ?? this.revertConfirm,
      pickedStickerId: pickedStickerId ?? this.pickedStickerId,
      pickerTab: pickerTab ?? this.pickerTab,
      textOverlay: textOverlay ?? this.textOverlay,
      showTextCustomizer: showTextCustomizer ?? this.showTextCustomizer,
      userTouchedColor: userTouchedColor ?? this.userTouchedColor,
      nextAnnId: nextAnnId,
      exitReviewAfter: exitReviewAfter,
    );
  }
}

class EditorWorkspace extends StatefulWidget {
  const EditorWorkspace({
    super.key,
    required this.controller,
    required this.isCompact,
    this.reviewMode = false,
    this.onSetReviewMode,
    this.onRegisterReviewBackHandler,
    this.onRegisterExitReviewGuard,
    this.onSaveMilestone,
    this.onOpenCameraScan,
    this.quickFormatScrollController,
    required this.onOpenCoverSplit,
    required this.onOpenSkillsSettings,
    required this.onTogglePhrasebank,
    required this.onTapHighlightedAnnotation,
  });

  final AppController controller;
  final bool isCompact;
  final bool reviewMode;
  final ValueChanged<bool>? onSetReviewMode;
  final ValueChanged<bool Function()?>? onRegisterReviewBackHandler;
  final ValueChanged<bool Function()?>? onRegisterExitReviewGuard;
  final VoidCallback? onSaveMilestone;
  final VoidCallback? onOpenCameraScan;
  final ScrollController? quickFormatScrollController;
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
  final ScrollController _reviewParaScroll = ScrollController();
  final TextEditingController _paraEditCtrl = TextEditingController();
  final FocusNode _paraFocusNode = FocusNode();

  String? _lastDocId;
  EditorFormat? _lastFmt;
  int _lastLocateNonce = 0;

  // Shared sticker library & per-doc archive stickers
  List<ReviewStickerDef> _customStickers = [];
  List<ReviewArchiveStickerItem> _archiveStickers = [];
  List<ReviewStickerDef> get _allStickers => [
        ...kJournalStripStickers,
        ...kDefaultBasicStickers,
        ..._customStickers,
      ];

  // Review mode split & interaction state
  double _splitRatio = 0.5;
  String _keyboardFocusZone = 'original';
  bool _prevKeyboardOpen = false;
  bool Function()? _boardBackHandler;
  ({Offset globalPos, String? annotationId})? _longPressMenu;
  final Map<int, GlobalKey> _paraKeys = {};
  final List<TapGestureRecognizer> _spanRecognizers = [];

  int? _editingParaStart;
  _ParaEditSession? _paraSession;
  _PendingParaConfirm? _pendingParaConfirm;
  bool _suppressBlurConfirm = false;

  @override
  void initState() {
    super.initState();
    final t = ArcThemeTokens.fromSettings(widget.controller.settings);
    final doc = widget.controller.activeDoc;
    _textController = AnnotationHighlightTextController(
      text: doc?.activeText ?? '',
      annotations: doc?.annotations ?? const [],
      selectedAnnotationId: widget.controller.selectedAnnotationId,
      commentColor: t.commentColor,
      revisionColor: t.revisionColor,
      accentColor: t.accent,
    );
    _lastDocId = doc?.id;
    _lastFmt = doc?.activeFormat;
    _lastLocateNonce = widget.controller.locateNonce;
    _paraFocusNode.addListener(_onParaFocusChanged);

    _loadCustomStickers();
    if (doc != null) {
      _loadArchiveStickers(doc.id);
    }
    widget.onRegisterReviewBackHandler?.call(_handleReviewBack);
    widget.onRegisterExitReviewGuard?.call(() => _triggerDirtyParaConfirm(true));
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

    if (doc != null && doc.id != _lastDocId) {
      _editingParaStart = null;
      _paraSession = null;
      _pendingParaConfirm = null;
      _longPressMenu = null;
      _paraKeys.clear();
      _loadArchiveStickers(doc.id);
    }

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

    if (oldWidget.onRegisterReviewBackHandler != widget.onRegisterReviewBackHandler) {
      widget.onRegisterReviewBackHandler?.call(_handleReviewBack);
    }
    if (oldWidget.onRegisterExitReviewGuard != widget.onRegisterExitReviewGuard) {
      widget.onRegisterExitReviewGuard?.call(() => _triggerDirtyParaConfirm(true));
    }
  }

  @override
  void dispose() {
    widget.onRegisterReviewBackHandler?.call(null);
    widget.onRegisterExitReviewGuard?.call(null);
    _paraFocusNode.removeListener(_onParaFocusChanged);
    _paraFocusNode.dispose();
    _paraEditCtrl.dispose();
    _textController.dispose();
    _editorScroll.dispose();
    _previewScroll.dispose();
    _reviewParaScroll.dispose();
    _disposeSpanRecognizers();
    super.dispose();
  }

  void _disposeSpanRecognizers() {
    for (final r in _spanRecognizers) {
      r.dispose();
    }
    _spanRecognizers.clear();
  }

  Future<void> _loadCustomStickers() async {
    final loaded = await ReviewStickerStore.loadCustomStickers();
    if (!mounted) return;
    setState(() => _customStickers = loaded);
  }

  Future<void> _loadArchiveStickers(String docId) async {
    final loaded = await ReviewStickerStore.loadDocArchiveStickers(docId);
    if (!mounted || widget.controller.activeDoc?.id != docId) return;
    setState(() => _archiveStickers = loaded);
  }

  void _onParaFocusChanged() {
    if (_paraFocusNode.hasFocus) return;
    final currentStart = _editingParaStart;
    if (currentStart == null) return;
    setState(() => _editingParaStart = null);
    if (_suppressBlurConfirm) return;
    final sess = _paraSession;
    if (sess != null && sess.paraStart == currentStart && sess.dirty) {
      setState(() {
        _pendingParaConfirm ??= _buildParaConfirmState(sess);
      });
    } else {
      _paraSession = null;
    }
  }

  _PendingParaConfirm _buildParaConfirmState(
    _ParaEditSession sess, {
    String? nextAnnId,
    bool exitReviewAfter = false,
  }) {
    final defaultStk = _allStickers.isNotEmpty
        ? _allStickers.first
        : kDefaultBasicStickers.first;
    final trimmed = sess.latestParaText.trim();
    final clipped = trimmed.length > 18 ? trimmed.substring(0, 18) : trimmed;
    return _PendingParaConfirm(
      paraStart: sess.paraStart,
      annId: sess.annId,
      originalFullText: sess.originalFullText,
      originalParaText: sess.originalParaText,
      latestParaText: sess.latestParaText,
      pickedStickerId: defaultStk.id,
      pickerTab: getStickerCategory(defaultStk),
      textOverlay: createDefaultStickerTextStyle(defaultStk, clipped),
      nextAnnId: nextAnnId,
      exitReviewAfter: exitReviewAfter,
    );
  }

  void _focusParaEditor(int paraStart, String paraText) {
    setState(() {
      _editingParaStart = paraStart;
      _keyboardFocusZone = 'original';
      _paraEditCtrl.value = TextEditingValue(
        text: paraText,
        selection: TextSelection.collapsed(offset: paraText.length),
      );
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _paraFocusNode.requestFocus();
      }
    });
  }

  bool _triggerDirtyParaConfirm(bool exitReviewAfter) {
    if (_pendingParaConfirm != null) return true;
    final sess = _paraSession;
    if (sess == null || !sess.dirty) return false;
    _suppressBlurConfirm = true;
    _paraFocusNode.unfocus();
    widget.controller.triggerHaptic(HapticPattern.warning);
    setState(() {
      _editingParaStart = null;
      _pendingParaConfirm ??= _buildParaConfirmState(
        sess,
        exitReviewAfter: exitReviewAfter,
      );
    });
    Future.delayed(const Duration(milliseconds: 60), () {
      _suppressBlurConfirm = false;
    });
    return true;
  }

  bool _handleReviewBack() {
    if (_pendingParaConfirm != null) {
      final p = _pendingParaConfirm!;
      if (p.step == _ParaConfirmStep.pickSticker) {
        setState(() => _pendingParaConfirm = p.copyWith(step: _ParaConfirmStep.confirm));
        return true;
      }
      if (p.revertConfirm) {
        setState(() => _pendingParaConfirm = p.copyWith(revertConfirm: false));
        return true;
      }
      setState(() => _pendingParaConfirm = null);
      _focusParaEditor(p.paraStart, p.latestParaText);
      return true;
    }
    if (_longPressMenu != null) {
      setState(() => _longPressMenu = null);
      return true;
    }
    if (_boardBackHandler?.call() ?? false) {
      return true;
    }
    if (widget.reviewMode && (_paraSession?.dirty ?? false)) {
      return _triggerDirtyParaConfirm(false);
    }
    if (widget.reviewMode && _editingParaStart != null) {
      _paraFocusNode.unfocus();
      setState(() {
        _editingParaStart = null;
        _paraSession = null;
      });
      return true;
    }
    return false;
  }

  void _handleReviewSelectNote(String nextId) {
    final sess = _paraSession;
    if (sess != null && sess.dirty && _pendingParaConfirm == null) {
      setState(() {
        _pendingParaConfirm = _buildParaConfirmState(sess, nextAnnId: nextId);
      });
      return;
    }
    widget.controller.selectAnnotation(nextId);
    widget.controller.notifyTutorialAction(TutorialActionId.selectAnnotation);
  }

  void _handleReviewApplyAiSuggestion(String annId, String rewrite) {
    final doc = widget.controller.activeDoc;
    if (doc == null || doc.isSealed) return;
    final currentText = doc.activeText;
    final annotatedParas = extractAnnotatedParagraphs(currentText, doc.annotations);
    AnnotatedParagraphBlock? targetPara;
    for (final p in annotatedParas) {
      if (p.annotations.any((a) => a.id == annId)) {
        targetPara = p;
        break;
      }
    }
    final targetAnn = doc.annotations.where((a) => a.id == annId).firstOrNull;
    final existingSess =
        _paraSession != null && targetPara != null && _paraSession!.paraStart == targetPara.start
            ? _paraSession
            : null;

    final originalFullText = existingSess?.originalFullText ?? currentText;
    final originalParaText = existingSess?.originalParaText ??
        (targetPara?.text ??
            (targetAnn != null
                ? extractParagraphAtOffset(currentText, targetAnn.anchorStart).text
                : currentText));

    final mutated = applyAnnotationTextReplacement(
      text: currentText,
      annotations: doc.annotations,
      targetAnnotationId: annId,
      replacement: rewrite,
      nextStatus: AnnotationStatus.resolved,
    );
    final updatedAnn =
        mutated.annotations.where((a) => a.id == annId).firstOrNull;
    final updatedPara = extractParagraphAtOffset(
      mutated.text,
      updatedAnn?.anchorStart ?? targetPara?.start ?? 0,
    );

    widget.controller.applyAiRewriteToAnnotation(annId, rewrite);
    if (mutated.text == originalFullText) return;

    final nextSess = _ParaEditSession(
      paraStart: updatedPara.start,
      annId: annId,
      originalFullText: originalFullText,
      originalParaText: originalParaText,
      latestParaText: updatedPara.text,
      dirty: true,
    );
    _paraSession = nextSess;

    final isFocused =
        _editingParaStart == updatedPara.start && _paraFocusNode.hasFocus;
    if (!isFocused) {
      widget.controller.triggerHaptic(HapticPattern.warning);
      setState(() {
        _editingParaStart = null;
        _pendingParaConfirm ??= _buildParaConfirmState(nextSess);
      });
    } else {
      _paraEditCtrl.value = TextEditingValue(
        text: updatedPara.text,
        selection: TextSelection.collapsed(offset: updatedPara.text.length),
      );
    }
  }

  void _scrollReviewParaToAnn(String annId) {
    final doc = widget.controller.activeDoc;
    if (doc == null) return;
    final paras = extractAnnotatedParagraphs(doc.activeText, doc.annotations);
    for (final p in paras) {
      if (p.annotations.any((a) => a.id == annId)) {
        _ensureParaVisible(p.start);
        return;
      }
    }
  }

  void _scrollReviewParaToPos(int pos) {
    final doc = widget.controller.activeDoc;
    if (doc == null) return;
    final paras = extractAnnotatedParagraphs(doc.activeText, doc.annotations);
    if (paras.isEmpty) return;
    var best = paras.first;
    var bestDist = (best.start - pos).abs();
    for (final p in paras) {
      final d = (p.start - pos).abs();
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    _ensureParaVisible(best.start);
  }

  void _ensureParaVisible(int paraStart) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final key = _paraKeys[paraStart];
      final ctx = key?.currentContext;
      if (ctx != null) {
        Scrollable.ensureVisible(
          ctx,
          duration: const Duration(milliseconds: 240),
          curve: Curves.easeOutCubic,
          alignment: 0.3,
        );
      }
    });
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

  String? _findAnnotationAtOffset(ArchiveDocument doc, int offset) {
    for (final ann in doc.annotations) {
      if (offset >= ann.anchorStart && offset <= ann.anchorEnd) {
        return ann.id;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final s = c.settings;
    final d = ArcStrings.of(s.locale);
    final doc = c.activeDoc;

    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 100;
    if (_prevKeyboardOpen &&
        !keyboardOpen &&
        widget.reviewMode &&
        _editingParaStart != null &&
        (_paraSession?.dirty ?? false) &&
        _pendingParaConfirm == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted &&
            widget.reviewMode &&
            (_paraSession?.dirty ?? false) &&
            _pendingParaConfirm == null) {
          _triggerDirtyParaConfirm(false);
        }
      });
    }
    _prevKeyboardOpen = keyboardOpen;

    if (doc == null) {
      return Center(
        child: Text(
          d.sidebarEmpty,
          style: TextStyle(color: t.textMuted, fontSize: 13),
        ),
      );
    }

    if (widget.reviewMode) {
      return _buildReviewModeBody(context, doc, s, d, t, keyboardOpen);
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
                      color: policy == AiPrivacyPolicy.disabled
                          ? t.revisionColor
                          : t.accent,
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
                        : _buildEditorPane(doc, s, d, t))
                    : Row(
                        children: [
                          Expanded(child: _buildEditorPane(doc, s, d, t)),
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

  Widget _buildReviewModeBody(
    BuildContext context,
    ArchiveDocument doc,
    AppSettingsModel s,
    ArcStrings d,
    ArcThemeTokens t,
    bool keyboardOpen,
  ) {
    final isLandscapeSplit = !widget.isCompact;
    final effectiveRatio = (!isLandscapeSplit && keyboardOpen)
        ? (_keyboardFocusZone == 'original'
            ? math.max(_splitRatio, 0.70)
            : math.min(_splitRatio, 0.30))
        : _splitRatio;

    final originalPane = _buildReviewOriginalPane(doc, s, d, t);
    final reviewWorkspace = Focus(
      onFocusChange: (hasFocus) {
        if (hasFocus && _keyboardFocusZone != 'review') {
          setState(() => _keyboardFocusZone = 'review');
        }
      },
      child: ReviewSplitWorkspace(
        docId: doc.id,
        annotations: doc.annotations,
        selectedId: widget.controller.selectedAnnotationId,
        documentText: doc.activeText,
        settings: s,
        effectiveAiPolicy: widget.controller.effectiveAiPolicy,
        readOnly: doc.isSealed,
        allStickers: _allStickers,
        archiveStickers: _archiveStickers,
        onAddCustomSticker: (stk) {
          final next = [..._customStickers, stk];
          setState(() => _customStickers = next);
          ReviewStickerStore.saveCustomStickers(next);
        },
        onDeleteCustomSticker: (id) {
          final next = _customStickers.where((s) => s.id != id).toList();
          setState(() => _customStickers = next);
          ReviewStickerStore.saveCustomStickers(next);
        },
        onAddArchiveSticker: (item) {
          final next = [..._archiveStickers, item];
          setState(() => _archiveStickers = next);
          ReviewStickerStore.saveDocArchiveStickers(doc.id, next);
        },
        onUpdateArchiveSticker: (archiveId, {stickerId, textOverlay}) {
          final next = _archiveStickers.map((a) {
            if (a.id != archiveId) return a;
            return a.copyWith(
              stickerId: stickerId ?? a.stickerId,
              textOverlay: textOverlay ?? a.textOverlay,
            );
          }).toList();
          setState(() => _archiveStickers = next);
          ReviewStickerStore.saveDocArchiveStickers(doc.id, next);
        },
        onSelect: _handleReviewSelectNote,
        onLocate: _scrollReviewParaToAnn,
        onJumpToPosition: _scrollReviewParaToPos,
        onAcceptRevision: widget.controller.acceptRevision,
        onRejectRevision: widget.controller.rejectRevision,
        onToggleResolveComment: widget.controller.toggleResolveComment,
        onReplyComment: widget.controller.replyToComment,
        onApplyAiSuggestion: _handleReviewApplyAiSuggestion,
        onBatchAcceptRevisions: (ids) =>
            widget.controller.batchAcceptRevisions(targetIds: ids),
        onBatchRejectRevisions: (ids) =>
            widget.controller.batchRejectRevisions(targetIds: ids),
        onBatchResolveComments: (ids) =>
            widget.controller.batchResolveComments(targetIds: ids),
        onHaptic: widget.controller.triggerHaptic,
        tourKey: widget.controller.tourTargets.keyFor(TutorialTargetId.annotationSidebar),
        onRegisterBackHandler: (fn) => _boardBackHandler = fn,
      ),
    );

    return Container(
      key: widget.controller.tourTargets.keyFor(TutorialTargetId.workspaceMain),
      color: t.bgApp,
      child: Stack(
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              if (isLandscapeSplit) {
                final totalW = math.max(1.0, constraints.maxWidth - 10);
                final leftW = (totalW * effectiveRatio).clamp(totalW * 0.24, totalW * 0.76);
                return Row(
                  children: [
                    SizedBox(width: leftW, child: originalPane),
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onHorizontalDragUpdate: (details) {
                        setState(() {
                          _splitRatio = ((_splitRatio * totalW + details.delta.dx) / totalW)
                              .clamp(0.24, 0.76);
                        });
                      },
                      child: Container(
                        width: 10,
                        color: t.bgSubtle,
                        child: Center(
                          child: Container(
                            width: 3,
                            height: 28,
                            decoration: BoxDecoration(
                              color: t.borderStrong,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(child: reviewWorkspace),
                  ],
                );
              } else {
                final totalH = math.max(1.0, constraints.maxHeight - 12);
                final topH = (totalH * effectiveRatio).clamp(totalH * 0.24, totalH * 0.76);
                return Column(
                  children: [
                    SizedBox(height: topH, child: originalPane),
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onVerticalDragUpdate: (details) {
                        setState(() {
                          _splitRatio = ((_splitRatio * totalH + details.delta.dy) / totalH)
                              .clamp(0.24, 0.76);
                        });
                      },
                      child: Container(
                        height: 12,
                        width: double.infinity,
                        color: t.bgSubtle,
                        child: Center(
                          child: Container(
                            width: 34,
                            height: 3.5,
                            decoration: BoxDecoration(
                              color: t.borderStrong,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(child: reviewWorkspace),
                  ],
                );
              }
            },
          ),
          if (_pendingParaConfirm != null)
            _buildPendingParaConfirmOverlay(doc, s.locale.isZh, t),
          if (_longPressMenu != null)
            _buildLongPressCapsuleOverlay(d, t),
        ],
      ),
    );
  }

  Widget _buildReviewOriginalPane(
    ArchiveDocument doc,
    AppSettingsModel s,
    ArcStrings d,
    ArcThemeTokens t,
  ) {
    final c = widget.controller;
    final annotatedParas = extractAnnotatedParagraphs(doc.activeText, doc.annotations);
    final selectedId = c.selectedAnnotationId;
    final openCount =
        doc.annotations.where((a) => a.status == AnnotationStatus.open).length;
    final topPad = MediaQuery.paddingOf(context).top;

    _disposeSpanRecognizers();

    return Focus(
      onFocusChange: (hasFocus) {
        if (hasFocus && _keyboardFocusZone != 'original') {
          setState(() => _keyboardFocusZone = 'original');
        }
      },
      child: Stack(
        children: [
          Container(
            color: t.bgApp,
            child: annotatedParas.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        s.locale.isZh
                            ? '当前文档暂无批注或修订对应的段落'
                            : 'No annotated or revised paragraphs in this document',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: t.textMuted),
                      ),
                    ),
                  )
                : ListView.separated(
                    controller: _reviewParaScroll,
                    padding: EdgeInsets.fromLTRB(
                      14,
                      topPad + (widget.isCompact ? 34 : 16),
                      14,
                      widget.isCompact && doc.officePreview == null ? 72 : 24,
                    ),
                    itemCount: annotatedParas.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final p = annotatedParas[index];
                      final hasSelected =
                          p.annotations.any((a) => a.id == selectedId);
                      final isEditingThis =
                          _editingParaStart == p.start && !doc.isSealed;
                      final paraKey =
                          _paraKeys.putIfAbsent(p.start, () => GlobalKey());

                      return Container(
                        key: paraKey,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: t.bgSurface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: hasSelected
                                ? t.accent.withValues(alpha: 0.65)
                                : t.borderSubtle,
                            width: hasSelected ? 1.4 : 1,
                          ),
                          boxShadow: hasSelected
                              ? [
                                  BoxShadow(
                                    color: t.accent.withValues(alpha: 0.10),
                                    blurRadius: 10,
                                    offset: const Offset(0, 2),
                                  ),
                                ]
                              : null,
                        ),
                        child: isEditingThis
                            ? TextField(
                                controller: _paraEditCtrl,
                                focusNode: _paraFocusNode,
                                maxLines: null,
                                keyboardType: TextInputType.multiline,
                                style: TextStyle(
                                  fontSize: s.typography.editorFontSize,
                                  height: s.typography.editorLineHeight,
                                  color: t.textPrimary,
                                ),
                                decoration: InputDecoration(
                                  isDense: true,
                                  filled: true,
                                  fillColor: t.bgElevated,
                                  contentPadding: const EdgeInsets.all(10),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide:
                                        BorderSide(color: t.accent, width: 1.5),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide:
                                        BorderSide(color: t.accent, width: 1.5),
                                  ),
                                ),
                                onChanged: (nextPara) {
                                  final full = doc.activeText;
                                  final safeStart =
                                      p.start.clamp(0, full.length);
                                  final safeEnd =
                                      p.end.clamp(safeStart, full.length);
                                  final nextFull = full.substring(0, safeStart) +
                                      nextPara +
                                      full.substring(safeEnd);
                                  if (_paraSession != null &&
                                      _paraSession!.paraStart == p.start) {
                                    _paraSession!.dirty =
                                        nextPara != _paraSession!.originalParaText;
                                    _paraSession!.latestParaText = nextPara;
                                  }
                                  c.updateActiveDocumentText(nextFull);
                                },
                              )
                            : GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: () {
                                  if (doc.isSealed) return;
                                  final annId = (selectedId != null &&
                                          p.annotations
                                              .any((a) => a.id == selectedId))
                                      ? selectedId
                                      : p.annotations.first.id;
                                  _paraSession = _ParaEditSession(
                                    paraStart: p.start,
                                    annId: annId,
                                    originalFullText: doc.activeText,
                                    originalParaText: p.text,
                                    latestParaText: p.text,
                                  );
                                  _focusParaEditor(p.start, p.text);
                                },
                                onLongPressStart: (details) {
                                  c.triggerHaptic(HapticPattern.medium);
                                  final annId = (selectedId != null &&
                                          p.annotations
                                              .any((a) => a.id == selectedId))
                                      ? selectedId
                                      : p.annotations.firstOrNull?.id;
                                  setState(() {
                                    _longPressMenu = (
                                      globalPos: details.globalPosition,
                                      annotationId: annId,
                                    );
                                  });
                                },
                                child: _buildRichParagraphText(p, s, t, selectedId),
                              ),
                      );
                    },
                  ),
          ),
          if (widget.isCompact && doc.officePreview == null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: SafeArea(
                top: false,
                child: MobileQuickFormatBar(
                  barKey: c.tourTargets.keyFor(TutorialTargetId.mobileFormatBar),
                  snapshotBtnKey:
                      c.tourTargets.keyFor(TutorialTargetId.mobileSnapshotBtn),
                  scrollController: widget.quickFormatScrollController,
                  isZh: s.locale.isZh,
                  inReviewMode: true,
                  readOnly: doc.isSealed,
                  activeFormat: doc.activeFormat,
                  splitPreview: c.splitPreview,
                  canUndo: c.canUndo,
                  canRedo: c.canRedo,
                  openAnnotationCount: openCount,
                  phrasebankActive:
                      s.phrasebank.enabled && !s.phrasebank.dismissed,
                  onUndo: c.undo,
                  onRedo: c.redo,
                  onInsertSnippet: c.insertSnippet,
                  onToggleFormat: c.toggleActiveFormat,
                  onToggleSplitPreview: c.toggleSplitPreview,
                  onOpenAnnotations: () {
                    if (!_triggerDirtyParaConfirm(true)) {
                      widget.onSetReviewMode?.call(false);
                    }
                  },
                  onTogglePhrasebank: widget.onTogglePhrasebank,
                  onOpenCameraScan: widget.onOpenCameraScan ?? () {},
                  onSaveMilestone: widget.onSaveMilestone ?? c.saveMilestoneSnapshot,
                  onHaptic: c.triggerHaptic,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildRichParagraphText(
    AnnotatedParagraphBlock p,
    AppSettingsModel s,
    ArcThemeTokens t,
    String? selectedId,
  ) {
    final sorted = p.annotations
        .map((a) => (
              ann: a,
              relStart: math.max(0, a.anchorStart - p.start),
              relEnd: math.min(p.text.length, a.anchorEnd - p.start),
            ))
        .where((r) => r.relEnd > r.relStart)
        .toList()
      ..sort((a, b) => a.relStart.compareTo(b.relStart));

    final spans = <InlineSpan>[];
    var cursor = 0;
    for (final item in sorted) {
      if (item.relStart > cursor) {
        spans.add(TextSpan(text: p.text.substring(cursor, item.relStart)));
      }
      final start = math.max(cursor, item.relStart);
      if (item.relEnd > start) {
        final isComment = item.ann.type == AnnotationType.comment;
        final baseColor = isComment ? t.commentColor : t.revisionColor;
        final isSel = selectedId == item.ann.id;
        final rec = TapGestureRecognizer()
          ..onTap = () {
            widget.controller.triggerHaptic(HapticPattern.selection);
            widget.controller.selectAnnotation(item.ann.id);
          };
        _spanRecognizers.add(rec);
        spans.add(TextSpan(
          text: p.text.substring(start, item.relEnd),
          recognizer: rec,
          style: TextStyle(
            backgroundColor: baseColor.withValues(alpha: isSel ? 0.34 : 0.17),
            decoration: TextDecoration.underline,
            decorationColor: baseColor,
            decorationThickness: isSel ? 2.2 : 1.3,
          ),
        ));
        cursor = item.relEnd;
      }
    }
    if (cursor < p.text.length) {
      spans.add(TextSpan(text: p.text.substring(cursor)));
    }

    return Text.rich(
      TextSpan(
        style: TextStyle(
          fontSize: s.typography.editorFontSize,
          height: s.typography.editorLineHeight,
          color: t.textPrimary,
        ),
        children: spans,
      ),
    );
  }

  Widget _buildLongPressCapsuleOverlay(ArcStrings d, ArcThemeTokens t) {
    final menu = _longPressMenu!;
    final size = MediaQuery.sizeOf(context);
    final left = (menu.globalPos.dx - 90)
        .clamp(12.0, math.max(12.0, size.width - 240.0))
        .toDouble();
    final top = (menu.globalPos.dy - 70)
        .clamp(16.0, math.max(16.0, size.height - 90.0))
        .toDouble();

    return Positioned.fill(
      child: GestureDetector(
        onTap: () => setState(() => _longPressMenu = null),
        behavior: HitTestBehavior.translucent,
        child: Stack(
          children: [
            Positioned(
              left: left,
              top: top,
              child: GestureDetector(
                onTap: () {},
                child: ArcSurface(
                  borderRadius: 999,
                  borderColor: t.borderStrong,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      FilledButton(
                        onPressed: () {
                          widget.controller.triggerHaptic(HapticPattern.medium);
                          if (menu.annotationId != null) {
                            widget.controller.selectAnnotation(menu.annotationId);
                          }
                          setState(() => _longPressMenu = null);
                          if (!_triggerDirtyParaConfirm(true)) {
                            widget.onSetReviewMode?.call(false);
                          }
                        },
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(0, 30),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          shape: const StadiumBorder(),
                        ),
                        child: Text(
                          d.exitReviewMode,
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                      if (menu.annotationId != null) ...[
                        const SizedBox(width: 6),
                        OutlinedButton(
                          onPressed: () {
                            widget.controller.triggerHaptic(HapticPattern.selection);
                            widget.controller.selectAnnotation(menu.annotationId);
                            setState(() => _longPressMenu = null);
                          },
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(0, 30),
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            shape: const StadiumBorder(),
                          ),
                          child: Text(
                            d.isZh ? '选中批注' : 'Focus Note',
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPendingParaConfirmOverlay(
    ArchiveDocument doc,
    bool isZh,
    ArcThemeTokens t,
  ) {
    final p = _pendingParaConfirm!;
    final pickedSticker = _allStickers.firstWhere(
      (s) => s.id == p.pickedStickerId,
      orElse: () => _allStickers.isNotEmpty
          ? _allStickers.first
          : kDefaultBasicStickers.first,
    );

    return Positioned.fill(
      child: GestureDetector(
        onTap: () {},
        child: Container(
          color: const Color(0x88000000),
          alignment: Alignment.center,
          padding: const EdgeInsets.all(14),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: p.step == _ParaConfirmStep.pickSticker ? 500 : 420,
              maxHeight: MediaQuery.sizeOf(context).height * 0.84,
            ),
            child: ArcSurface(
              padding: const EdgeInsets.all(16),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (p.step == _ParaConfirmStep.confirm) ...[
                      if (p.revertConfirm) ...[
                        Text(
                          isZh ? '二次确认：回退段落修改？' : 'Confirm Revert?',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: t.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          isZh
                              ? '确定要放弃并撤销刚才对该段落的修改，并重新聚焦该段落吗？'
                              : 'Discard and revert your recent edits to this paragraph and refocus it?',
                          style: TextStyle(
                            fontSize: 12.5,
                            height: 1.5,
                            color: t.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            OutlinedButton(
                              onPressed: () => setState(() {
                                _pendingParaConfirm =
                                    p.copyWith(revertConfirm: false);
                              }),
                              child: Text(isZh ? '返回' : 'Back'),
                            ),
                            const SizedBox(width: 8),
                            FilledButton(
                              onPressed: () {
                                widget.controller
                                    .triggerHaptic(HapticPattern.warning);
                                widget.controller
                                    .updateActiveDocumentText(p.originalFullText);
                                _paraSession = null;
                                setState(() => _pendingParaConfirm = null);
                                if (p.exitReviewAfter) {
                                  widget.onSetReviewMode?.call(false);
                                } else {
                                  _focusParaEditor(p.paraStart, p.originalParaText);
                                }
                              },
                              style: FilledButton.styleFrom(
                                backgroundColor: const Color(0xFFDC2626),
                              ),
                              child: Text(isZh ? '确认回退' : 'Confirm Revert'),
                            ),
                          ],
                        ),
                      ] else ...[
                        Text(
                          isZh ? '确认保存刚才的修改？' : 'Save Paragraph Changes?',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: t.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Container(
                          constraints: const BoxConstraints(maxHeight: 160),
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: t.bgSubtle,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: t.borderSubtle),
                          ),
                          child: SingleChildScrollView(
                            child: Text(
                              p.latestParaText,
                              style: TextStyle(
                                fontSize: 12.5,
                                height: 1.5,
                                color: t.textPrimary,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Wrap(
                          alignment: WrapAlignment.end,
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            OutlinedButton(
                              onPressed: () {
                                widget.controller
                                    .triggerHaptic(HapticPattern.selection);
                                setState(() => _pendingParaConfirm = null);
                                _focusParaEditor(p.paraStart, p.latestParaText);
                              },
                              child: Text(isZh ? '取消' : 'Cancel'),
                            ),
                            OutlinedButton(
                              onPressed: () {
                                widget.controller
                                    .triggerHaptic(HapticPattern.warning);
                                setState(() {
                                  _pendingParaConfirm =
                                      p.copyWith(revertConfirm: true);
                                });
                              },
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFFDC2626),
                              ),
                              child: Text(isZh ? '取消并回退修改' : 'Cancel & Revert'),
                            ),
                            FilledButton(
                              onPressed: () {
                                widget.controller
                                    .triggerHaptic(HapticPattern.light);
                                setState(() {
                                  _pendingParaConfirm =
                                      p.copyWith(step: _ParaConfirmStep.pickSticker);
                                });
                              },
                              child: Text(isZh ? '选择贴纸保存' : 'Save with Sticker'),
                            ),
                          ],
                        ),
                      ],
                    ] else ...[
                      Text(
                        isZh ? '从贴纸库选择贴纸' : 'Choose a Sticker',
                        style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          color: t.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            vertical: 14, horizontal: 10),
                        decoration: BoxDecoration(
                          color: t.bgSubtle,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: t.borderSubtle),
                        ),
                        child: Center(
                          child: StickerVisual(
                            sticker: pickedSticker,
                            textStyle: p.textOverlay,
                            fallbackText: p.latestParaText,
                            mode: StickerVisualMode.preview,
                            isZh: isZh,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      StickerPickerTabs(
                        allStickers: _allStickers,
                        selectedStickerId: p.pickedStickerId,
                        activeTab: p.pickerTab,
                        onTabChange: (tab) => setState(() {
                          _pendingParaConfirm = p.copyWith(pickerTab: tab);
                        }),
                        onSelect: (stk) {
                          widget.controller
                              .triggerHaptic(HapticPattern.selection);
                          final nextOverlay = stk.defaultTextStyle != null
                              ? stk.defaultTextStyle!.copyWith(
                                  text: p.textOverlay.text.isNotEmpty
                                      ? p.textOverlay.text
                                      : stk.defaultTextStyle!.text,
                                )
                              : (p.userTouchedColor
                                  ? p.textOverlay
                                  : p.textOverlay.copyWith(
                                      color: stk.defaultTextColor ??
                                          p.textOverlay.color,
                                      strokeColor: stk.defaultStrokeColor ??
                                          p.textOverlay.strokeColor,
                                    ));
                          setState(() {
                            _pendingParaConfirm = p.copyWith(
                              pickedStickerId: stk.id,
                              textOverlay: nextOverlay,
                            );
                          });
                        },
                        isZh: isZh,
                        surface: StickerSurface.theme,
                      ),
                      const SizedBox(height: 10),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            isZh ? '贴纸叠加文字与样式' : 'Overlay Text & Style',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: t.textSecondary,
                            ),
                          ),
                          TextButton(
                            onPressed: () => setState(() {
                              _pendingParaConfirm = p.copyWith(
                                showTextCustomizer: !p.showTextCustomizer,
                              );
                            }),
                            child: Text(
                              p.showTextCustomizer
                                  ? (isZh ? '收起样式' : 'Hide')
                                  : (isZh ? '展开样式' : 'Customize'),
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                      if (p.showTextCustomizer) ...[
                        StickerTextStyleControls(
                          value: p.textOverlay,
                          onChange: (nextStyle) => setState(() {
                            _pendingParaConfirm =
                                p.copyWith(textOverlay: nextStyle);
                          }),
                          onColorTouched: () => setState(() {
                            _pendingParaConfirm =
                                p.copyWith(userTouchedColor: true);
                          }),
                          draftFallbackText: p.latestParaText,
                          isZh: isZh,
                          surface: StickerSurface.theme,
                          compact: true,
                        ),
                        const SizedBox(height: 10),
                      ],
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          OutlinedButton(
                            onPressed: () => setState(() {
                              _pendingParaConfirm =
                                  p.copyWith(step: _ParaConfirmStep.confirm);
                            }),
                            child: Text(isZh ? '返回' : 'Back'),
                          ),
                          const SizedBox(width: 8),
                          FilledButton(
                            onPressed: () {
                              final ann = doc.annotations
                                  .where((a) => a.id == p.annId)
                                  .firstOrNull;
                              final now = DateTime.now().millisecondsSinceEpoch;
                              final snippet = (ann != null &&
                                      ann.originalText.isNotEmpty)
                                  ? (ann.originalText.length > 24
                                      ? ann.originalText.substring(0, 24)
                                      : ann.originalText)
                                  : (ann?.author ?? '段落修改');
                              final nextItem = ReviewArchiveStickerItem(
                                id: 'arcstk-$now-${math.Random().nextInt(9999)}',
                                annId: p.annId,
                                stickerId: p.pickedStickerId,
                                draftText: p.latestParaText,
                                snippet: snippet,
                                savedAt: now,
                                textOverlay: p.textOverlay,
                              );
                              final nextList = [..._archiveStickers, nextItem];
                              _paraSession = null;
                              setState(() {
                                _archiveStickers = nextList;
                                _pendingParaConfirm = null;
                              });
                              ReviewStickerStore.saveDocArchiveStickers(
                                  doc.id, nextList);
                              if (p.exitReviewAfter) {
                                widget.onSetReviewMode?.call(false);
                              } else if (p.nextAnnId != null) {
                                widget.controller.selectAnnotation(p.nextAnnId);
                              }
                            },
                            child: Text(isZh ? '就要这个' : 'Use This'),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void onOpenCoverSplitOrNoop() {
    if (widget.controller.activeDoc?.baseDocxBase64 != null) {
      widget.onOpenCoverSplit();
    }
  }

  Widget _buildEditorPane(
    ArchiveDocument doc,
    AppSettingsModel s,
    ArcStrings d,
    ArcThemeTokens t,
  ) {
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
              contextMenuBuilder: (context, editableTextState) {
                final items = <ContextMenuButtonItem>[
                  if (widget.onSetReviewMode != null)
                    ContextMenuButtonItem(
                      label: d.enterReviewMode,
                      onPressed: () {
                        final sel = _textController.selection;
                        if (sel.isValid) {
                          final annId = _findAnnotationAtOffset(doc, sel.baseOffset);
                          if (annId != null) {
                            widget.controller.selectAnnotation(annId);
                          }
                        }
                        editableTextState.hideToolbar();
                        widget.controller.triggerHaptic(HapticPattern.medium);
                        widget.onSetReviewMode?.call(true);
                      },
                    ),
                  ...editableTextState.contextMenuButtonItems,
                ];
                return AdaptiveTextSelectionToolbar.buttonItems(
                  anchors: editableTextState.contextMenuAnchors,
                  buttonItems: items,
                );
              },
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

  Widget _buildPreviewPane(
      ArchiveDocument doc, AppSettingsModel s, ArcThemeTokens t) {
    final raw = doc.markdownText;
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
                        style: TextStyle(
                            fontFamily: 'monospace', color: t.revisionColor),
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
                  tableHead: TextStyle(
                      fontWeight: FontWeight.w700, color: t.textPrimary),
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
  const _BannerChip(
      {required this.icon, required this.label, required this.color});
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
            style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.w600, color: color),
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
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: t.textPrimary),
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
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: t.accent),
                      ),
                      const SizedBox(height: 6),
                      ...sl.bullets.map((b) => Padding(
                            padding: const EdgeInsets.only(bottom: 3),
                            child: Text('• $b',
                                style: TextStyle(color: t.textPrimary)),
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
                      Text(sh.name,
                          style: TextStyle(
                              fontWeight: FontWeight.w700, color: t.accent)),
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
                                              child: Text(c,
                                                  style: TextStyle(
                                                      color: t.textPrimary,
                                                      fontSize: 12)),
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
      oldDelegate.start != start ||
      oldDelegate.end != end ||
      oldDelegate.color != color;
}
