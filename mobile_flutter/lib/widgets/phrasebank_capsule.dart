import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/phrasebank_data.dart';
import '../core/tutorial_flow.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';

class PhrasebankFloatingCapsule extends StatefulWidget {
  const PhrasebankFloatingCapsule({
    super.key,
    required this.controller,
    required this.onOpenModal,
  });

  final AppController controller;
  final VoidCallback onOpenModal;

  @override
  State<PhrasebankFloatingCapsule> createState() => _PhrasebankFloatingCapsuleState();
}

class _PhrasebankFloatingCapsuleState extends State<PhrasebankFloatingCapsule> {
  double _normX = 0.92;
  double _normY = 0.62;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final pb = widget.controller.settings.phrasebank;
    if (!pb.enabled || pb.dismissed) return const SizedBox.shrink();

    final size = MediaQuery.sizeOf(context);
    final left = (_normX * (size.width - 58)).clamp(10.0, size.width - 58);
    final top = (_normY * (size.height - 140)).clamp(80.0, size.height - 140);

    return Positioned(
      left: left,
      top: top,
      child: GestureDetector(
        onPanUpdate: (d) {
          setState(() {
            _normX = ((left + d.delta.dx) / (size.width - 58)).clamp(0.0, 1.0);
            _normY = ((top + d.delta.dy) / (size.height - 140)).clamp(0.0, 1.0);
          });
        },
        onPanEnd: (_) {
          setState(() {
            _normX = _normX < 0.5 ? 0.02 : 0.96;
          });
          widget.controller.triggerHaptic(HapticPattern.selection);
        },
        onTap: () {
          widget.controller.triggerHaptic(HapticPattern.light);
          widget.onOpenModal();
        },
        child: ArcSurface(
          borderRadius: 24,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.graduationCap, size: 17, color: t.accent),
              const SizedBox(width: 5),
              Text(
                widget.controller.settings.locale.isZh ? '句库' : 'Phrases',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: t.textPrimary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class PhrasebankModalSheet extends StatefulWidget {
  const PhrasebankModalSheet({super.key, required this.controller, this.onClose});
  final AppController controller;
  final VoidCallback? onClose;

  @override
  State<PhrasebankModalSheet> createState() => _PhrasebankModalSheetState();
}

class _PhrasebankModalSheetState extends State<PhrasebankModalSheet> {
  static const _prefsKey = 'arcvault_phrasebank_user_state_v1';

  int _tabIndex = 0;
  String _search = '';
  String _selectedSectionId = PhrasebankData.sections[1].id; // introducing-work
  String _toneFilter = 'all';
  bool _coreOnly = false;
  int _refSubTab = 0; // 0: lexicon, 1: connectors, 2: confused/spelling, 3: evidence
  int _favSubTab = 0; // 0: favorites, 1: custom, 2: recent

  final Set<String> _favorites = {};
  final Set<String> _pinnedFavorites = {};
  final List<CustomPhraseItem> _customPhrases = [];
  final List<({String text, String source})> _recentCopies = [];
  final List<SkeletonSlotItem> _skeletonItems = [];
  String _activeSkeletonSlot = 'intro';
  PlaceholderValues _placeholders = const PlaceholderValues();

  // Evidence builder state
  int _evTypeIdx = 0;
  int _evPredIdx = 0;
  int _evVerbIdx = 0;

  // Custom phrase form controllers
  final _customEnCtrl = TextEditingController();
  final _customZhCtrl = TextEditingController();
  final _customSecCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadUserState();
  }

  @override
  void dispose() {
    _customEnCtrl.dispose();
    _customZhCtrl.dispose();
    _customSecCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadUserState() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_prefsKey);
      if (raw == null || raw.isEmpty) return;
      final map = jsonDecode(raw);
      if (map is! Map<String, dynamic> || !mounted) return;
      setState(() {
        _favorites
          ..clear()
          ..addAll((map['favorites'] as List<dynamic>? ?? const []).map((e) => e.toString()));
        _pinnedFavorites
          ..clear()
          ..addAll((map['pinned'] as List<dynamic>? ?? const []).map((e) => e.toString()));
        _customPhrases
          ..clear()
          ..addAll((map['custom'] as List<dynamic>? ?? const [])
              .map((e) => CustomPhraseItem.fromJson(Map<String, dynamic>.from(e as Map))));
        _skeletonItems
          ..clear()
          ..addAll((map['skeleton'] as List<dynamic>? ?? const [])
              .map((e) => SkeletonSlotItem.fromJson(Map<String, dynamic>.from(e as Map))));
        if (map['placeholders'] is Map) {
          final p = Map<String, dynamic>.from(map['placeholders'] as Map);
          _placeholders = PlaceholderValues(
            enabled: p['enabled'] != false,
            x: p['x']?.toString() ?? '',
            y: p['y']?.toString() ?? '',
            z: p['z']?.toString() ?? '',
            author: p['author']?.toString() ?? '',
            year: p['year']?.toString() ?? '',
            author2: p['author2']?.toString() ?? '',
            year2: p['year2']?.toString() ?? '',
          );
        }
      });
    } catch (_) {}
  }

  Future<void> _saveUserState() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _prefsKey,
        jsonEncode({
          'favorites': _favorites.toList(),
          'pinned': _pinnedFavorites.toList(),
          'custom': _customPhrases.map((e) => e.toJson()).toList(),
          'skeleton': _skeletonItems.map((e) => e.toJson()).toList(),
          'placeholders': {
            'enabled': _placeholders.enabled,
            'x': _placeholders.x,
            'y': _placeholders.y,
            'z': _placeholders.z,
            'author': _placeholders.author,
            'year': _placeholders.year,
            'author2': _placeholders.author2,
            'year2': _placeholders.year2,
          },
        }),
      );
    } catch (_) {}
  }

  void _recordRecent(String text, String source) {
    setState(() {
      _recentCopies.removeWhere((e) => e.text == text);
      _recentCopies.insert(0, (text: text, source: source));
      if (_recentCopies.length > 25) {
        _recentCopies.removeRange(25, _recentCopies.length);
      }
    });
  }

  void _insertText(String text, String source, {bool closeAfter = true}) {
    widget.controller.triggerHaptic(HapticPattern.light);
    widget.controller.insertSnippet(text);
    _recordRecent(text, source);
    if (closeAfter) {
      (widget.onClose ?? () => Navigator.of(context).pop())();
    }
  }

  Future<void> _copyText(String text, String source, bool isZh) async {
    await Clipboard.setData(ClipboardData(text: text));
    widget.controller.triggerHaptic(HapticPattern.selection);
    _recordRecent(text, source);
    widget.controller.showToast(isZh ? '已复制：$source' : 'Copied: $source');
  }

  void _addToSkeleton(String text, String slotId, String source, bool isZh) {
    widget.controller.triggerHaptic(HapticPattern.selection);
    setState(() {
      _skeletonItems.add(SkeletonSlotItem(
        id: 'sk_${DateTime.now().microsecondsSinceEpoch}',
        slotId: slotId,
        text: text,
        sourceLabel: source,
      ));
    });
    _saveUserState();
    widget.controller.showToast(isZh ? '已加入论文骨架' : 'Added to Skeleton');
  }

  void _toggleFavorite(String id) {
    widget.controller.triggerHaptic(HapticPattern.selection);
    setState(() {
      if (_favorites.contains(id)) {
        _favorites.remove(id);
        _pinnedFavorites.remove(id);
      } else {
        _favorites.add(id);
      }
    });
    _saveUserState();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final isZh = c.settings.locale.isZh;
    final docText = c.activeDoc?.activeText ?? '';

    final tabs = isZh
        ? const ['智能推荐', '章节导航', '上下文分析', '快捷检索', '参考工具', '占位替换', '论文骨架', '收藏夹']
        : const ['Smart', 'Sections', 'Context', 'Search', 'Reference', 'Placeholders', 'Skeleton', 'Favorites'];

    return ArcSurface(
      key: c.tourTargets.keyFor(TutorialTargetId.phrasebankModal),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.80,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 10, 6),
              child: Row(
                children: [
                  Icon(LucideIcons.graduationCap, size: 18, color: t.accent),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      isZh ? '学术写作句库胶囊 (Phrasebank)' : 'Academic Phrasebank Capsule',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: t.textPrimary),
                    ),
                  ),
                  if (_skeletonItems.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(right: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: t.accentSoft,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${isZh ? '骨架' : 'Skel'} ${_skeletonItems.length}',
                        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: t.accent),
                      ),
                    ),
                  IconButton(
                    onPressed: () => (widget.onClose ?? () => Navigator.of(context).pop())(),
                    icon: Icon(LucideIcons.x, size: 18, color: t.textSecondary),
                  ),
                ],
              ),
            ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: List.generate(tabs.length, (i) {
                  final active = i == _tabIndex;
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(tabs[i], style: const TextStyle(fontSize: 12)),
                      selected: active,
                      onSelected: (_) => setState(() => _tabIndex = i),
                      selectedColor: t.accentSoft,
                    ),
                  );
                }),
              ),
            ),
            const SizedBox(height: 6),
            Expanded(
              child: switch (_tabIndex) {
                0 => _buildSmartTab(docText, isZh, t),
                1 => _buildSectionsTab(docText, isZh, t),
                2 => _buildContextTab(docText, isZh, t),
                3 => _buildSearchTab(isZh, t),
                4 => _buildReferenceTab(isZh, t),
                5 => _buildPlaceholdersTab(isZh, t),
                6 => _buildSkeletonTab(isZh, t),
                _ => _buildFavoritesTab(isZh, t),
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSmartTab(String docText, bool isZh, ArcThemeTokens t) {
    final issues = PhrasebankAnalyzer.analyzeAcademicIssues(docText);
    final detected = PhrasebankAnalyzer.detectPaperSections(docText);
    final recs = PhrasebankData.recommendForText(docText);

    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        ArcCardSurface(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.sparkles, size: 15, color: t.accent),
                  const SizedBox(width: 6),
                  Text(
                    isZh ? '实时学术规范体检 (${issues.length})' : 'Live Academic Check (${issues.length})',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: t.textPrimary),
                  ),
                  const Spacer(),
                  if (detected.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: t.accentSoft,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${isZh ? '已识别' : 'Sections'}: ${detected.length}',
                        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: t.accent),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              if (issues.isEmpty)
                Text(
                  isZh
                      ? '未发现明显口语化表达或缩略词问题，学术语体表现良好。'
                      : 'No obvious colloquialisms or contractions detected.',
                  style: TextStyle(fontSize: 12, color: t.textSecondary),
                )
              else
                ...issues.take(4).map((iss) => Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Container(
                        padding: const EdgeInsets.all(9),
                        decoration: BoxDecoration(
                          color: t.bgSubtle.withValues(alpha: 0.55),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: t.borderSubtle),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${isZh ? iss.titleCn : iss.titleEn}: "${iss.matchedText}"',
                              style: TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.w700, color: t.textPrimary),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              isZh ? iss.explanationCn : iss.explanationEn,
                              style: TextStyle(fontSize: 11.5, color: t.textSecondary),
                            ),
                            if (iss.replacements.isNotEmpty) ...[
                              const SizedBox(height: 5),
                              Wrap(
                                spacing: 6,
                                children: iss.replacements
                                    .map((rep) => ActionChip(
                                          label: Text(rep, style: const TextStyle(fontSize: 11)),
                                          onPressed: () => _copyText(rep, isZh ? '学术替换' : 'Academic Fix', isZh),
                                          visualDensity: VisualDensity.compact,
                                        ))
                                    .toList(),
                              ),
                            ],
                          ],
                        ),
                      ),
                    )),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text(
          isZh ? '根据当前文稿语境推荐句型' : 'Context-Recommended Phrases',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: t.textPrimary),
        ),
        const SizedBox(height: 8),
        ...recs.map((item) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _buildPhraseCard(item, isZh, t),
            )),
      ],
    );
  }

  Widget _buildSectionsTab(String docText, bool isZh, ArcThemeTokens t) {
    final detected = PhrasebankAnalyzer.detectPaperSections(docText);
    final activeSection = PhrasebankData.sections.firstWhere(
      (s) => s.id == _selectedSectionId,
      orElse: () => PhrasebankData.sections.first,
    );
    final filteredPhrases = activeSection.phrases.where((p) {
      if (_toneFilter != 'all' && p.tone != _toneFilter) return false;
      if (_coreOnly && !p.isCore) return false;
      return true;
    }).toList();

    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        if (detected.isNotEmpty) ...[
          Text(
            isZh ? '已识别论文章节大纲 (${detected.length})' : 'Detected Outline (${detected.length})',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: t.textSecondary),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: detected
                .map((d) => ActionChip(
                      label: Text('${d.title} → ${d.mappedLabel}', style: const TextStyle(fontSize: 11)),
                      onPressed: () => setState(() => _selectedSectionId = d.mappedSectionId),
                      visualDensity: VisualDensity.compact,
                    ))
                .toList(),
          ),
          const SizedBox(height: 10),
        ],
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: PhrasebankData.sections.map((sec) {
              final active = sec.id == activeSection.id;
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(
                    sec.isFunction
                        ? '+ ${isZh ? sec.shortCn : sec.titleEn}'
                        : (isZh ? sec.shortCn : sec.titleEn),
                    style: const TextStyle(fontSize: 11.5),
                  ),
                  selected: active,
                  onSelected: (_) => setState(() => _selectedSectionId = sec.id),
                  selectedColor: t.accentSoft,
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 8),
        ArcCardSurface(
          padding: const EdgeInsets.all(11),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isZh ? activeSection.titleCn : activeSection.titleEn,
                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: t.textPrimary),
              ),
              const SizedBox(height: 3),
              Text(
                activeSection.summaryCn,
                style: TextStyle(fontSize: 11.5, color: t.textSecondary),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        _buildFilterRow(isZh, t),
        const SizedBox(height: 8),
        for (final b in activeSection.builders) ...[
          _PhraseBuilderCard(
            builderDef: b,
            placeholders: _placeholders,
            isZh: isZh,
            onInsert: (txt) => _insertText(txt, '${activeSection.shortCn} · 拼句器'),
            onCopy: (txt) => _copyText(txt, '${activeSection.shortCn} · 拼句器', isZh),
            onAddToSkeleton: (txt) => _addToSkeleton(txt, b.skeletonSlot, activeSection.shortCn, isZh),
          ),
          const SizedBox(height: 10),
        ],
        if (filteredPhrases.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Center(
              child: Text(isZh ? '当前筛选条件下暂无句型' : 'No matching phrases',
                  style: TextStyle(color: t.textMuted, fontSize: 12.5)),
            ),
          )
        else
          ...filteredPhrases.map((p) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _buildPhraseCard(p, isZh, t, skeletonSlot: activeSection.skeletonSlot),
              )),
      ],
    );
  }

  Widget _buildContextTab(String docText, bool isZh, ArcThemeTokens t) {
    final analysis = PhrasebankAnalyzer.analyzeContextAndSuggest(docText, isZh: isZh);
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        ArcCardSurface(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.wand2, size: 15, color: t.accent),
                  const SizedBox(width: 6),
                  Text(
                    isZh ? '上下文学术诊断结论' : 'Context Analysis Summary',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: t.textPrimary),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(analysis.summary, style: TextStyle(fontSize: 12, color: t.textSecondary)),
            ],
          ),
        ),
        const SizedBox(height: 10),
        ...analysis.advice.map((adv) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: ArcCardSurface(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(adv.title,
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: t.textPrimary)),
                    const SizedBox(height: 4),
                    Text(adv.rationale, style: TextStyle(fontSize: 12, color: t.textSecondary)),
                    if (adv.suggestedRewrite != null) ...[
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        children: [
                          FilledButton.tonal(
                            onPressed: () => _copyText(adv.suggestedRewrite!, adv.title, isZh),
                            child: Text('${isZh ? '复制建议：' : 'Copy: '}${adv.suggestedRewrite}',
                                style: const TextStyle(fontSize: 11.5)),
                          ),
                        ],
                      ),
                    ],
                    if (adv.recommendedPhrases.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      ...adv.recommendedPhrases.map((p) {
                        final applied = _placeholders.apply(p);
                        return Container(
                          margin: const EdgeInsets.only(top: 6),
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: t.bgSubtle.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(applied, style: TextStyle(fontSize: 12, color: t.textPrimary)),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  TextButton(
                                    onPressed: () => _copyText(applied, adv.title, isZh),
                                    child: Text(isZh ? '复制' : 'Copy', style: const TextStyle(fontSize: 11.5)),
                                  ),
                                  TextButton(
                                    onPressed: () => _insertText(applied, adv.title),
                                    child: Text(isZh ? '插入' : 'Insert', style: const TextStyle(fontSize: 11.5)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                  ],
                ),
              ),
            )),
      ],
    );
  }

  Widget _buildSearchTab(bool isZh, ArcThemeTokens t) {
    final items = PhrasebankData.search(_search, tone: _toneFilter, coreOnly: _coreOnly);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 6),
          child: TextField(
            onChanged: (v) => setState(() => _search = v),
            style: TextStyle(fontSize: 13, color: t.textPrimary),
            decoration: InputDecoration(
              isDense: true,
              prefixIcon: const Icon(LucideIcons.search, size: 15),
              hintText: isZh ? '搜索英文或中文学术表达...' : 'Search academic expressions...',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: _buildFilterRow(isZh, t),
        ),
        Expanded(
          child: items.isEmpty
              ? Center(
                  child: Text(isZh ? '暂无匹配句型' : 'No phrases found',
                      style: TextStyle(color: t.textMuted, fontSize: 13)),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(14),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, idx) => _buildPhraseCard(items[idx], isZh, t),
                ),
        ),
      ],
    );
  }

  Widget _buildReferenceTab(bool isZh, ArcThemeTokens t) {
    final subLabels = isZh
        ? const ['口语→学术', '连接词矩阵', '易混词/拼写', 'Evidence搭配']
        : const ['Formal Lexicon', 'Connectors', 'Confusables', 'Evidence'];
    final evSentence =
        'The ${PhrasebankData.evidenceTypes[_evTypeIdx]} evidence ${PhrasebankData.evidenceVerbs[_evVerbIdx]} X is ${PhrasebankData.evidencePredicates[_evPredIdx]}.';

    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: List.generate(subLabels.length, (i) {
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(subLabels[i], style: const TextStyle(fontSize: 11.5)),
                  selected: _refSubTab == i,
                  onSelected: (_) => setState(() => _refSubTab = i),
                  selectedColor: t.accentSoft,
                ),
              );
            }),
          ),
        ),
        const SizedBox(height: 10),
        if (_refSubTab == 0)
          ...PhrasebankData.everydayToAcademic.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: ArcCardSurface(
                  padding: const EdgeInsets.all(11),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${item.everyday}  →  ${item.academic}',
                                style: TextStyle(
                                    fontSize: 12.5, fontWeight: FontWeight.w700, color: t.textPrimary)),
                            const SizedBox(height: 2),
                            Text(item.categoryCn, style: TextStyle(fontSize: 11, color: t.textMuted)),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: () =>
                            _copyText(item.academic.split(' / ').first, item.everyday, isZh),
                        child: Text(isZh ? '复制' : 'Copy', style: const TextStyle(fontSize: 11.5)),
                      ),
                    ],
                  ),
                ),
              )),
        if (_refSubTab == 1)
          ...PhrasebankData.connectorsMatrix.map((c) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: ArcCardSurface(
                  padding: const EdgeInsets.all(11),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${c.categoryCn} (${c.categoryEn})',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: t.accent)),
                      const SizedBox(height: 4),
                      Text(c.words,
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5, color: t.textPrimary)),
                      const SizedBox(height: 4),
                      Text(c.grammarTipCn, style: TextStyle(fontSize: 11.5, color: t.textSecondary)),
                    ],
                  ),
                ),
              )),
        if (_refSubTab == 2) ...[
          ...PhrasebankData.confusedWords.map((w) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: ArcCardSurface(
                  padding: const EdgeInsets.all(11),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(w.pair,
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: t.textPrimary)),
                      const SizedBox(height: 3),
                      Text(w.summaryCn, style: TextStyle(fontSize: 11.5, color: t.textSecondary)),
                      const SizedBox(height: 3),
                      Text(w.detailEn,
                          style: TextStyle(
                              fontSize: 11.5, fontStyle: FontStyle.italic, color: t.accent)),
                    ],
                  ),
                ),
              )),
          const SizedBox(height: 6),
          ArcCardSurface(
            padding: const EdgeInsets.all(11),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isZh ? '英式 (BrE) vs. 美式 (US) 拼写对照' : 'BrE vs. US Spelling',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: t.textPrimary)),
                const SizedBox(height: 6),
                ...PhrasebankData.usBreSpelling.map((sp) => Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: Text('${sp.bre}  ↔  ${sp.use}',
                          style: TextStyle(fontSize: 12, color: t.textSecondary)),
                    )),
              ],
            ),
          ),
        ],
        if (_refSubTab == 3)
          ArcCardSurface(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isZh ? 'Evidence 学术搭配拼装器' : 'Evidence Collocation Builder',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: t.textPrimary)),
                const SizedBox(height: 8),
                Text(isZh ? '1. 证据类型' : '1. Type',
                    style: TextStyle(fontSize: 11.5, color: t.textMuted)),
                Wrap(
                  spacing: 6,
                  children: List.generate(
                    PhrasebankData.evidenceTypes.length,
                    (i) => ChoiceChip(
                      label: Text(PhrasebankData.evidenceTypes[i], style: const TextStyle(fontSize: 11)),
                      selected: _evTypeIdx == i,
                      onSelected: (_) => setState(() => _evTypeIdx = i),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(isZh ? '2. 搭配动词' : '2. Verb',
                    style: TextStyle(fontSize: 11.5, color: t.textMuted)),
                Wrap(
                  spacing: 6,
                  children: List.generate(
                    PhrasebankData.evidenceVerbs.length,
                    (i) => ChoiceChip(
                      label: Text(PhrasebankData.evidenceVerbs[i], style: const TextStyle(fontSize: 11)),
                      selected: _evVerbIdx == i,
                      onSelected: (_) => setState(() => _evVerbIdx = i),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(isZh ? '3. 强度表语' : '3. Predicate',
                    style: TextStyle(fontSize: 11.5, color: t.textMuted)),
                Wrap(
                  spacing: 6,
                  children: List.generate(
                    PhrasebankData.evidencePredicates.length,
                    (i) => ChoiceChip(
                      label:
                          Text(PhrasebankData.evidencePredicates[i], style: const TextStyle(fontSize: 11)),
                      selected: _evPredIdx == i,
                      onSelected: (_) => setState(() => _evPredIdx = i),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: t.accentSoft,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(_placeholders.apply(evSentence),
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: t.textPrimary)),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => _copyText(_placeholders.apply(evSentence), 'Evidence', isZh),
                      child: Text(isZh ? '复制' : 'Copy'),
                    ),
                    TextButton(
                      onPressed: () => _insertText(_placeholders.apply(evSentence), 'Evidence'),
                      child: Text(isZh ? '插入' : 'Insert'),
                    ),
                  ],
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildPlaceholdersTab(bool isZh, ArcThemeTokens t) {
    const sample =
        'In recent years, X has become an essential component of Y; however, Smith (2020) argued that Z remains underexplored compared to Jones (2019).';
    final preview = _placeholders.apply(sample);

    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        ArcCardSurface(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      isZh ? '学术变量与引文占位符自动替换' : 'Placeholder Auto-Fill',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: t.textPrimary),
                    ),
                  ),
                  Switch(
                    value: _placeholders.enabled,
                    onChanged: (v) {
                      setState(() => _placeholders = _placeholders.copyWith(enabled: v));
                      _saveUserState();
                    },
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: _PlaceholderField(
                      label: 'X (研究对象/方法)',
                      value: _placeholders.x,
                      onChanged: (v) {
                        setState(() => _placeholders = _placeholders.copyWith(x: v));
                        _saveUserState();
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _PlaceholderField(
                      label: 'Y (目标任务/指标)',
                      value: _placeholders.y,
                      onChanged: (v) {
                        setState(() => _placeholders = _placeholders.copyWith(y: v));
                        _saveUserState();
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _PlaceholderField(
                      label: 'Z (提升幅度/变量)',
                      value: _placeholders.z,
                      onChanged: (v) {
                        setState(() => _placeholders = _placeholders.copyWith(z: v));
                        _saveUserState();
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _PlaceholderField(
                      label: 'Smith → 第一作者',
                      value: _placeholders.author,
                      onChanged: (v) {
                        setState(() => _placeholders = _placeholders.copyWith(author: v));
                        _saveUserState();
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _PlaceholderField(
                      label: '2020 → 年份',
                      value: _placeholders.year,
                      onChanged: (v) {
                        setState(() => _placeholders = _placeholders.copyWith(year: v));
                        _saveUserState();
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _PlaceholderField(
                      label: 'Jones → 对照作者',
                      value: _placeholders.author2,
                      onChanged: (v) {
                        setState(() => _placeholders = _placeholders.copyWith(author2: v));
                        _saveUserState();
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _PlaceholderField(
                      label: '2019 → 年份2',
                      value: _placeholders.year2,
                      onChanged: (v) {
                        setState(() => _placeholders = _placeholders.copyWith(year2: v));
                        _saveUserState();
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () {
                    setState(() => _placeholders = PlaceholderValues(enabled: _placeholders.enabled));
                    _saveUserState();
                  },
                  icon: const Icon(LucideIcons.rotateCcw, size: 13),
                  label: Text(isZh ? '清空变量' : 'Reset'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        ArcCardSurface(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(isZh ? '实时替换预览：' : 'Live Preview:',
                  style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: t.textMuted)),
              const SizedBox(height: 4),
              Text(preview, style: TextStyle(fontSize: 12.5, color: t.textPrimary)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSkeletonTab(bool isZh, ArcThemeTokens t) {
    final slotItems = _skeletonItems.where((s) => s.slotId == _activeSkeletonSlot).toList();
    final combinedAll = PhrasebankData.skeletonSlots
        .map((slot) {
          final items = _skeletonItems.where((i) => i.slotId == slot.id).toList();
          if (items.isEmpty) return null;
          return '## ${isZh ? slot.labelCn : slot.labelEn}\n${items.map((e) => e.text).join(' ')}';
        })
        .whereType<String>()
        .join('\n\n');

    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: Row(
            children: PhrasebankData.skeletonSlots.map((slot) {
              final count = _skeletonItems.where((i) => i.slotId == slot.id).length;
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(
                    '${isZh ? slot.labelCn.split(' ').first : slot.labelEn}${count > 0 ? ' ($count)' : ''}',
                    style: const TextStyle(fontSize: 11.5),
                  ),
                  selected: _activeSkeletonSlot == slot.id,
                  onSelected: (_) => setState(() => _activeSkeletonSlot = slot.id),
                  selectedColor: t.accentSoft,
                ),
              );
            }).toList(),
          ),
        ),
        Expanded(
          child: slotItems.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Text(
                      isZh
                          ? '当前章节槽位暂无句型，可在「章节导航」或「智能推荐」中点击「+ 骨架」添加。'
                          : 'No items in this slot yet. Tap "+ Skeleton" on any phrase card.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: t.textMuted, fontSize: 12.5),
                    ),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(14),
                  itemCount: slotItems.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, idx) {
                    final item = slotItems[idx];
                    return ArcCardSurface(
                      padding: const EdgeInsets.all(10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.sourceLabel,
                              style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: t.accent)),
                          const SizedBox(height: 4),
                          Text(item.text, style: TextStyle(fontSize: 12.5, color: t.textPrimary)),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              IconButton(
                                onPressed: () {
                                  setState(() => _skeletonItems.removeWhere((e) => e.id == item.id));
                                  _saveUserState();
                                },
                                icon: Icon(LucideIcons.trash2, size: 15, color: t.revisionColor),
                                visualDensity: VisualDensity.compact,
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
        if (_skeletonItems.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 12),
            child: Row(
              children: [
                OutlinedButton(
                  onPressed: () {
                    setState(() => _skeletonItems.clear());
                    _saveUserState();
                  },
                  child: Text(isZh ? '清空' : 'Clear', style: const TextStyle(fontSize: 12)),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () => _copyText(combinedAll, isZh ? '论文骨架' : 'Skeleton', isZh),
                  child: Text(isZh ? '复制全文骨架' : 'Copy All', style: const TextStyle(fontSize: 12)),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: () => _insertText(combinedAll, isZh ? '论文骨架' : 'Skeleton'),
                    style: FilledButton.styleFrom(backgroundColor: t.accent, foregroundColor: t.accentText),
                    child: Text(isZh ? '全部插入文档' : 'Insert All', style: const TextStyle(fontSize: 12)),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildFavoritesTab(bool isZh, ArcThemeTokens t) {
    final favItems = PhrasebankData.allPhrases
        .where((p) => _favorites.contains(p.id))
        .toList()
      ..sort((a, b) {
        final ap = _pinnedFavorites.contains(a.id) ? 1 : 0;
        final bp = _pinnedFavorites.contains(b.id) ? 1 : 0;
        return bp - ap;
      });

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: Row(
            children: [
              ChoiceChip(
                label: Text('${isZh ? '收藏' : 'Fav'} (${favItems.length})',
                    style: const TextStyle(fontSize: 11.5)),
                selected: _favSubTab == 0,
                onSelected: (_) => setState(() => _favSubTab = 0),
                selectedColor: t.accentSoft,
              ),
              const SizedBox(width: 6),
              ChoiceChip(
                label: Text('${isZh ? '自建句型' : 'Custom'} (${_customPhrases.length})',
                    style: const TextStyle(fontSize: 11.5)),
                selected: _favSubTab == 1,
                onSelected: (_) => setState(() => _favSubTab = 1),
                selectedColor: t.accentSoft,
              ),
              const SizedBox(width: 6),
              ChoiceChip(
                label: Text('${isZh ? '最近使用' : 'Recent'} (${_recentCopies.length})',
                    style: const TextStyle(fontSize: 11.5)),
                selected: _favSubTab == 2,
                onSelected: (_) => setState(() => _favSubTab = 2),
                selectedColor: t.accentSoft,
              ),
            ],
          ),
        ),
        Expanded(
          child: _favSubTab == 0
              ? (favItems.isEmpty
                  ? Center(
                      child: Text(
                        isZh ? '暂无收藏句型，点击卡片星标即可加入。' : 'No favorites yet.',
                        style: TextStyle(color: t.textMuted, fontSize: 12.5),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(14),
                      itemCount: favItems.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => _buildPhraseCard(favItems[i], isZh, t, showPin: true),
                    ))
              : _favSubTab == 1
                  ? ListView(
                      padding: const EdgeInsets.all(14),
                      children: [
                        ArcCardSurface(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(isZh ? '添加自建学术句型' : 'Add Custom Phrase',
                                  style: TextStyle(
                                      fontWeight: FontWeight.w700, fontSize: 13, color: t.textPrimary)),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _customEnCtrl,
                                style: TextStyle(fontSize: 12.5, color: t.textPrimary),
                                decoration: InputDecoration(
                                  isDense: true,
                                  labelText: isZh ? '英文句型 (支持 X/Y/Z 占位符)' : 'English Phrase',
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                              ),
                              const SizedBox(height: 6),
                              TextField(
                                controller: _customZhCtrl,
                                style: TextStyle(fontSize: 12.5, color: t.textPrimary),
                                decoration: InputDecoration(
                                  isDense: true,
                                  labelText: isZh ? '中文释义 / 用法' : 'Chinese / Intent',
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Align(
                                alignment: Alignment.centerRight,
                                child: FilledButton.icon(
                                  onPressed: () {
                                    final en = _customEnCtrl.text.trim();
                                    final zh = _customZhCtrl.text.trim();
                                    if (en.isEmpty) return;
                                    setState(() {
                                      _customPhrases.insert(
                                        0,
                                        CustomPhraseItem(
                                          id: 'cust_${DateTime.now().millisecondsSinceEpoch}',
                                          en: en,
                                          zh: zh.isEmpty ? en : zh,
                                          sectionLabel: _customSecCtrl.text.trim().isEmpty
                                              ? (isZh ? '自建句型' : 'Custom')
                                              : _customSecCtrl.text.trim(),
                                          tone: 'neutral',
                                        ),
                                      );
                                      _customEnCtrl.clear();
                                      _customZhCtrl.clear();
                                    });
                                    _saveUserState();
                                  },
                                  icon: const Icon(LucideIcons.plus, size: 14),
                                  label: Text(isZh ? '保存自建句型' : 'Save', style: const TextStyle(fontSize: 12)),
                                  style: FilledButton.styleFrom(
                                      backgroundColor: t.accent, foregroundColor: t.accentText),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 10),
                        ..._customPhrases.map((cp) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: ArcCardSurface(
                                padding: const EdgeInsets.all(11),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(_placeholders.apply(cp.en),
                                        style: TextStyle(
                                            fontSize: 13, fontWeight: FontWeight.w600, color: t.textPrimary)),
                                    const SizedBox(height: 3),
                                    Text(_placeholders.apply(cp.zh),
                                        style: TextStyle(fontSize: 12, color: t.textSecondary)),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        IconButton(
                                          onPressed: () {
                                            setState(() => _customPhrases.removeWhere((e) => e.id == cp.id));
                                            _saveUserState();
                                          },
                                          icon: Icon(LucideIcons.trash2, size: 15, color: t.revisionColor),
                                          visualDensity: VisualDensity.compact,
                                        ),
                                        TextButton(
                                          onPressed: () =>
                                              _insertText(_placeholders.apply(cp.en), cp.sectionLabel),
                                          child: Text(isZh ? '插入英文' : 'Insert'),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            )),
                      ],
                    )
                  : (_recentCopies.isEmpty
                      ? Center(
                          child: Text(
                            isZh ? '暂无最近使用记录' : 'No recent phrases yet',
                            style: TextStyle(color: t.textMuted, fontSize: 12.5),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(14),
                          itemCount: _recentCopies.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, i) {
                            final r = _recentCopies[i];
                            return ArcCardSurface(
                              padding: const EdgeInsets.all(10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(r.source,
                                      style: TextStyle(
                                          fontSize: 10.5, fontWeight: FontWeight.w600, color: t.accent)),
                                  const SizedBox(height: 3),
                                  Text(r.text, style: TextStyle(fontSize: 12.5, color: t.textPrimary)),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      TextButton(
                                        onPressed: () => _insertText(r.text, r.source),
                                        child: Text(isZh ? '再次插入' : 'Insert'),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        )),
        ),
      ],
    );
  }

  Widget _buildFilterRow(bool isZh, ArcThemeTokens t) {
    final tones = isZh
        ? const [('all', '全部语气'), ('cautious', '谨慎'), ('neutral', '中性'), ('assertive', '明确')]
        : const [('all', 'All'), ('cautious', 'Cautious'), ('neutral', 'Neutral'), ('assertive', 'Assertive')];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          ...tones.map((pair) => Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(pair.$2, style: const TextStyle(fontSize: 11)),
                  selected: _toneFilter == pair.$1,
                  onSelected: (_) => setState(() => _toneFilter = pair.$1),
                  selectedColor: t.accentSoft,
                  visualDensity: VisualDensity.compact,
                ),
              )),
          FilterChip(
            label: Text(isZh ? '仅核心' : 'Core', style: const TextStyle(fontSize: 11)),
            selected: _coreOnly,
            onSelected: (v) => setState(() => _coreOnly = v),
            selectedColor: t.accentSoft,
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }

  Widget _buildPhraseCard(
    PhraseItem item,
    bool isZh,
    ArcThemeTokens t, {
    String skeletonSlot = 'intro',
    bool showPin = false,
  }) {
    final renderedEn = _placeholders.apply(item.en);
    final renderedZh = _placeholders.apply(item.zh);
    final fav = _favorites.contains(item.id);
    final pinned = _pinnedFavorites.contains(item.id);

    return ArcCardSurface(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: t.accentSoft,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '${item.sectionTitle}${item.moveTitle.isNotEmpty ? ' · ${item.moveTitle}' : ''}',
                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: t.accent),
                ),
              ),
              const Spacer(),
              if (showPin)
                IconButton(
                  onPressed: () {
                    setState(() {
                      if (pinned) {
                        _pinnedFavorites.remove(item.id);
                      } else {
                        _pinnedFavorites.add(item.id);
                      }
                    });
                    _saveUserState();
                  },
                  icon: Icon(
                    LucideIcons.pin,
                    size: 14,
                    color: pinned ? t.accent : t.textMuted,
                  ),
                  visualDensity: VisualDensity.compact,
                ),
              IconButton(
                onPressed: () => _toggleFavorite(item.id),
                icon: Icon(
                  fav ? Icons.star : Icons.star_border,
                  size: 16,
                  color: fav ? Colors.amber : t.textMuted,
                ),
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(renderedEn,
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: t.textPrimary)),
          const SizedBox(height: 3),
          Text(renderedZh, style: TextStyle(fontSize: 12, color: t.textSecondary)),
          const SizedBox(height: 6),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 4,
            children: [
              TextButton(
                onPressed: () => _addToSkeleton(renderedEn, skeletonSlot, item.sectionTitle, isZh),
                child: Text(isZh ? '+ 骨架' : '+ Skel', style: const TextStyle(fontSize: 11.5)),
              ),
              TextButton(
                onPressed: () => _copyText(renderedEn, item.sectionTitle, isZh),
                child: Text(isZh ? '复制' : 'Copy', style: const TextStyle(fontSize: 11.5)),
              ),
              TextButton(
                onPressed: () => _insertText(renderedEn, item.sectionTitle),
                child: Text(isZh ? '插入英文' : 'Insert EN', style: const TextStyle(fontSize: 11.5)),
              ),
              TextButton(
                onPressed: () => _insertText(renderedZh, item.sectionTitle),
                child: Text(isZh ? '插入中文' : 'Insert ZH', style: const TextStyle(fontSize: 11.5)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PhraseBuilderCard extends StatefulWidget {
  const _PhraseBuilderCard({
    required this.builderDef,
    required this.placeholders,
    required this.isZh,
    required this.onInsert,
    required this.onCopy,
    required this.onAddToSkeleton,
  });

  final PhraseBuilderDef builderDef;
  final PlaceholderValues placeholders;
  final bool isZh;
  final ValueChanged<String> onInsert;
  final ValueChanged<String> onCopy;
  final ValueChanged<String> onAddToSkeleton;

  @override
  State<_PhraseBuilderCard> createState() => _PhraseBuilderCardState();
}

class _PhraseBuilderCardState extends State<_PhraseBuilderCard> {
  late List<int> _selected = List.filled(widget.builderDef.columns.length, 0);

  @override
  void didUpdateWidget(covariant _PhraseBuilderCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.builderDef.id != widget.builderDef.id) {
      _selected = List.filled(widget.builderDef.columns.length, 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final b = widget.builderDef;
    final assembled = widget.placeholders.apply(b.assemble(_selected));

    return ArcCardSurface(
      isActive: true,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.wand2, size: 14, color: t.accent),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  widget.isZh ? b.titleCn : b.titleEn,
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: t.textPrimary),
                ),
              ),
              OutlinedButton.icon(
                onPressed: () {
                  final rng = math.Random();
                  setState(() {
                    _selected = b.columns.map((c) => rng.nextInt(c.options.length)).toList();
                  });
                },
                icon: const Icon(LucideIcons.dices, size: 13),
                label: Text(widget.isZh ? '随机' : 'Rand', style: const TextStyle(fontSize: 11)),
                style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ...List.generate(b.columns.length, (colIdx) {
            final col = b.columns[colIdx];
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.isZh ? col.labelCn : col.labelEn,
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: t.textMuted)),
                  const SizedBox(height: 3),
                  Wrap(
                    spacing: 5,
                    runSpacing: 4,
                    children: List.generate(col.options.length, (optIdx) {
                      final opt = col.options[optIdx];
                      final sel = _selected[colIdx] == optIdx;
                      return ChoiceChip(
                        label: Text(
                          opt == '(omit)' ? (widget.isZh ? '（省略）' : '(omit)') : opt,
                          style: const TextStyle(fontSize: 11),
                        ),
                        selected: sel,
                        onSelected: (_) => setState(() => _selected[colIdx] = optIdx),
                        selectedColor: t.accentSoft,
                        visualDensity: VisualDensity.compact,
                      );
                    }),
                  ),
                ],
              ),
            );
          }),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: t.bgSurface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: t.borderSubtle),
            ),
            child: Text(assembled,
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: t.textPrimary)),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () => widget.onAddToSkeleton(assembled),
                child: Text(widget.isZh ? '+ 骨架' : '+ Skel', style: const TextStyle(fontSize: 11.5)),
              ),
              TextButton(
                onPressed: () => widget.onCopy(assembled),
                child: Text(widget.isZh ? '复制' : 'Copy', style: const TextStyle(fontSize: 11.5)),
              ),
              TextButton(
                onPressed: () => widget.onInsert(assembled),
                child: Text(widget.isZh ? '插入拼接句' : 'Insert', style: const TextStyle(fontSize: 11.5)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PlaceholderField extends StatelessWidget {
  const _PlaceholderField({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final String value;
  final void Function(String) onChanged;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      initialValue: value,
      onChanged: onChanged,
      style: TextStyle(fontSize: 12, color: context.arcTheme.textPrimary),
      decoration: InputDecoration(
        isDense: true,
        labelText: label,
        labelStyle: TextStyle(fontSize: 11, color: context.arcTheme.textMuted),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}
