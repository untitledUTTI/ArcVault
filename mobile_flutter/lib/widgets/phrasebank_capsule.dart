import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/phrasebank_data.dart';
import '../core/tutorial_flow.dart';
import '../models/archive_models.dart';
import '../state/app_controller.dart';
import '../theme/arc_theme.dart';
import '../theme/liquid_glass_surface.dart';

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
          // Edge snap left or right
          setState(() {
            _normX = _normX < 0.5 ? 0.02 : 0.96;
          });
          widget.controller.triggerHaptic(HapticPattern.selection);
        },
        onTap: () {
          widget.controller.triggerHaptic(HapticPattern.light);
          widget.onOpenModal();
        },
        child: ArcLiquidGlassSurface(
          liquidGlassSettings: widget.controller.settings.liquidGlass,
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
  int _tabIndex = 0;
  String _search = '';
  final Set<String> _favorites = {};
  PlaceholderValues _placeholders = const PlaceholderValues();

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final c = widget.controller;
    final isZh = c.settings.locale.isZh;
    final docText = c.activeDoc?.activeText ?? '';

    final tabs = isZh
        ? const ['智能推荐', '章节导航', '快捷检索', '占位替换', '收藏夹']
        : const ['Smart', 'Sections', 'Search', 'Placeholders', 'Favorites'];

    return ArcLiquidGlassSurface(
      key: c.tourTargets.keyFor(TutorialTargetId.phrasebankModal),
      liquidGlassSettings: c.settings.liquidGlass,
      borderRadius: 24,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.76,
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
            const SizedBox(height: 8),
            if (_tabIndex == 2)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
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
            if (_tabIndex == 3)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _PlaceholderField(
                            label: 'X (研究对象/方法)',
                            value: _placeholders.x,
                            onChanged: (v) => setState(() => _placeholders = _placeholders.copyWith(x: v)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _PlaceholderField(
                            label: 'Y (目标/指标)',
                            value: _placeholders.y,
                            onChanged: (v) => setState(() => _placeholders = _placeholders.copyWith(y: v)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: _PlaceholderField(
                            label: 'Z (提升幅度)',
                            value: _placeholders.z,
                            onChanged: (v) => setState(() => _placeholders = _placeholders.copyWith(z: v)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _PlaceholderField(
                            label: 'Author (Smith)',
                            value: _placeholders.author,
                            onChanged: (v) =>
                                setState(() => _placeholders = _placeholders.copyWith(author: v)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            Expanded(
              child: _buildPhraseList(docText, isZh, t),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhraseList(String docText, bool isZh, ArcThemeTokens t) {
    final List<PhraseItem> items;
    if (_tabIndex == 0) {
      items = PhrasebankData.recommendForText(docText);
    } else if (_tabIndex == 2) {
      items = PhrasebankData.search(_search);
    } else if (_tabIndex == 4) {
      items = PhrasebankData.sections
          .expand((s) => s.phrases)
          .where((p) => _favorites.contains(p.id))
          .toList();
    } else {
      items = PhrasebankData.sections.expand((s) => s.phrases).toList();
    }

    if (items.isEmpty) {
      return Center(
        child: Text(
          isZh ? '暂无匹配句型' : 'No phrases found',
          style: TextStyle(color: t.textMuted, fontSize: 13),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(14),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, idx) {
        final item = items[idx];
        final renderedEn = _placeholders.apply(item.en);
        final renderedZh = _placeholders.apply(item.zh);
        final fav = _favorites.contains(item.id);
        return ArcFrostedCardSurface(
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
                      '${item.sectionTitle} · ${item.moveTitle}',
                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: t.accent),
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: () {
                      setState(() {
                        if (fav) {
                          _favorites.remove(item.id);
                        } else {
                          _favorites.add(item.id);
                        }
                      });
                    },
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
              Text(renderedEn, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: t.textPrimary)),
              const SizedBox(height: 3),
              Text(renderedZh, style: TextStyle(fontSize: 12, color: t.textSecondary)),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () {
                      widget.controller.insertSnippet(renderedEn);
                      (widget.onClose ?? () => Navigator.of(context).pop())();
                    },
                    child: Text(isZh ? '插入英文' : 'Insert EN', style: const TextStyle(fontSize: 12)),
                  ),
                  TextButton(
                    onPressed: () {
                      widget.controller.insertSnippet(renderedZh);
                      (widget.onClose ?? () => Navigator.of(context).pop())();
                    },
                    child: Text(isZh ? '插入中文' : 'Insert ZH', style: const TextStyle(fontSize: 12)),
                  ),
                ],
              ),
            ],
          ),
        );
      },
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
