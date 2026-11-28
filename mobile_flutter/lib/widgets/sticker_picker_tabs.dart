import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/review_stickers.dart';
import '../theme/arc_theme.dart';
import 'sticker_visual.dart';

enum StickerSurface { dark, theme }

class StickerPickerTabs extends StatelessWidget {
  const StickerPickerTabs({
    super.key,
    required this.allStickers,
    required this.selectedStickerId,
    required this.activeTab,
    required this.onTabChange,
    required this.onSelect,
    required this.isZh,
    this.surface = StickerSurface.dark,
    this.onDeleteCustomSticker,
  });

  final List<ReviewStickerDef> allStickers;
  final String selectedStickerId;
  final StickerCategory activeTab;
  final ValueChanged<StickerCategory> onTabChange;
  final ValueChanged<ReviewStickerDef> onSelect;
  final bool isZh;
  final StickerSurface surface;
  final ValueChanged<String>? onDeleteCustomSticker;

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final isDarkSurface = surface == StickerSurface.dark;
    final textColor = isDarkSurface ? const Color(0xFFF8FAFC) : t.textPrimary;
    final mutedColor =
        isDarkSurface ? const Color(0xB3F8FAFC) : t.textSecondary;
    final cardBg =
        isDarkSurface ? const Color(0x14FFFFFF) : t.bgSubtle;
    final borderColor =
        isDarkSurface ? const Color(0x26FFFFFF) : t.borderSubtle;
    final activeAccent = isDarkSurface ? const Color(0xFFF59E0B) : t.accent;

    final journal = <ReviewStickerDef>[];
    final basic = <ReviewStickerDef>[];
    final custom = <ReviewStickerDef>[];
    for (final s in allStickers) {
      switch (getStickerCategory(s)) {
        case StickerCategory.journal:
          journal.add(s);
        case StickerCategory.basic:
          basic.add(s);
        case StickerCategory.custom:
          custom.add(s);
      }
    }

    final tabs = [
      (
        id: StickerCategory.journal,
        zh: '手帐贴纸',
        en: 'Journal',
        count: journal.length,
      ),
      (
        id: StickerCategory.basic,
        zh: '基础贴纸',
        en: 'Basic',
        count: basic.length,
      ),
      (
        id: StickerCategory.custom,
        zh: '自定义',
        en: 'Custom',
        count: custom.length,
      ),
    ];

    Widget buildStripGrid(List<ReviewStickerDef> items, {required bool allowDelete}) {
      return GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: 2.05,
        ),
        itemCount: items.length,
        itemBuilder: (context, index) {
          final stk = items[index];
          final isSel = selectedStickerId == stk.id;
          final label = isZh ? stk.label : (stk.labelEn ?? stk.label);
          return Stack(
            children: [
              InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => onSelect(stk),
                child: Container(
                  width: double.infinity,
                  height: double.infinity,
                  padding: const EdgeInsets.fromLTRB(6, 5, 6, 4),
                  decoration: BoxDecoration(
                    color: isSel
                        ? activeAccent.withValues(alpha: 0.16)
                        : cardBg,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isSel ? activeAccent : borderColor,
                      width: isSel ? 1.5 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Center(
                          child: StickerVisual(
                            sticker: stk,
                            textStyle: stk.defaultTextStyle,
                            mode: StickerVisualMode.tile,
                            isZh: isZh,
                          ),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                          color: isSel ? activeAccent : mutedColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (allowDelete && onDeleteCustomSticker != null)
                Positioned(
                  top: 3,
                  right: 3,
                  child: InkWell(
                    onTap: () => onDeleteCustomSticker!(stk.id),
                    borderRadius: BorderRadius.circular(999),
                    child: Container(
                      width: 18,
                      height: 18,
                      decoration: const BoxDecoration(
                        color: Color(0xCC0F172A),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        LucideIcons.x,
                        size: 11,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      );
    }

    Widget buildBasicWrap(List<ReviewStickerDef> items, {required bool allowDelete}) {
      return Wrap(
        spacing: 6,
        runSpacing: 6,
        children: items.map((stk) {
          final isSel = selectedStickerId == stk.id;
          final borderCol = parseStickerHexColor(stk.color, activeAccent);
          final label = isZh ? stk.label : (stk.labelEn ?? stk.label);
          return Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              InkWell(
                borderRadius: BorderRadius.circular(999),
                onTap: () => onSelect(stk),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSel
                        ? borderCol.withValues(alpha: 0.22)
                        : cardBg,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: isSel ? borderCol : borderCol.withValues(alpha: 0.55),
                      width: isSel ? 1.6 : 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(stk.emoji ?? '🏷️', style: const TextStyle(fontSize: 13)),
                      const SizedBox(width: 5),
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                          color: textColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (allowDelete && onDeleteCustomSticker != null)
                Padding(
                  padding: const EdgeInsets.only(left: 2),
                  child: InkWell(
                    onTap: () => onDeleteCustomSticker!(stk.id),
                    borderRadius: BorderRadius.circular(999),
                    child: Container(
                      width: 18,
                      height: 18,
                      decoration: BoxDecoration(
                        color: cardBg,
                        shape: BoxShape.circle,
                        border: Border.all(color: borderColor),
                      ),
                      child: Icon(LucideIcons.x, size: 10, color: mutedColor),
                    ),
                  ),
                ),
            ],
          );
        }).toList(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: borderColor),
          ),
          child: Row(
            children: tabs.map((tab) {
              final isActive = activeTab == tab.id;
              return Expanded(
                child: InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () => onTabChange(tab.id),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                    decoration: BoxDecoration(
                      color: isActive ? activeAccent : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Flexible(
                          child: Text(
                            isZh ? tab.zh : tab.en,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: isActive
                                  ? (isDarkSurface ? Colors.white : t.accentText)
                                  : mutedColor,
                            ),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: isActive
                                ? Colors.black.withValues(alpha: 0.2)
                                : borderColor,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${tab.count}',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: isActive ? Colors.white : mutedColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 8),
        if (activeTab == StickerCategory.journal)
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 208),
            child: SingleChildScrollView(
              child: buildStripGrid(journal, allowDelete: false),
            ),
          )
        else if (activeTab == StickerCategory.basic)
          buildBasicWrap(basic, allowDelete: false)
        else if (custom.isEmpty)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: borderColor),
            ),
            child: Text(
              isZh
                  ? '暂无自定义贴纸，可下方创建、导入 PNG，或在任意贴纸叠加文字后「保存为自定义贴纸」。'
                  : 'No custom stickers yet. Create one below, import PNG, or save a customized text sticker.',
              style: TextStyle(fontSize: 11.5, color: mutedColor, height: 1.45),
            ),
          )
        else
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 208),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (custom.any((s) => isStripImageSticker(s)))
                    buildStripGrid(
                      custom.where((s) => isStripImageSticker(s)).toList(),
                      allowDelete: true,
                    ),
                  if (custom.any((s) => isStripImageSticker(s)) &&
                      custom.any((s) => !isStripImageSticker(s)))
                    const SizedBox(height: 8),
                  if (custom.any((s) => !isStripImageSticker(s)))
                    buildBasicWrap(
                      custom.where((s) => !isStripImageSticker(s)).toList(),
                      allowDelete: true,
                    ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
