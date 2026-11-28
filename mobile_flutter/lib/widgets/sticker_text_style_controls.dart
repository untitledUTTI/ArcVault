import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/review_stickers.dart';
import '../theme/arc_theme.dart';
import 'sticker_picker_tabs.dart';

class StickerTextStyleControls extends StatefulWidget {
  const StickerTextStyleControls({
    super.key,
    required this.value,
    required this.onChange,
    required this.isZh,
    this.surface = StickerSurface.dark,
    this.draftFallbackText,
    this.compact = false,
    this.onColorTouched,
  });

  final StickerTextStyle value;
  final ValueChanged<StickerTextStyle> onChange;
  final bool isZh;
  final StickerSurface surface;
  final String? draftFallbackText;
  final bool compact;
  final VoidCallback? onColorTouched;

  @override
  State<StickerTextStyleControls> createState() =>
      _StickerTextStyleControlsState();
}

class _StickerTextStyleControlsState extends State<StickerTextStyleControls> {
  late final TextEditingController _textCtrl;
  late final TextEditingController _customFontCtrl;

  @override
  void initState() {
    super.initState();
    _textCtrl = TextEditingController(text: widget.value.text);
    _customFontCtrl = TextEditingController(text: widget.value.customFontName);
  }

  @override
  void didUpdateWidget(covariant StickerTextStyleControls oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value.text != _textCtrl.text) {
      _textCtrl.value = TextEditingValue(
        text: widget.value.text,
        selection: TextSelection.collapsed(offset: widget.value.text.length),
      );
    }
    if (widget.value.customFontName != _customFontCtrl.text) {
      _customFontCtrl.value = TextEditingValue(
        text: widget.value.customFontName,
        selection: TextSelection.collapsed(
          offset: widget.value.customFontName.length,
        ),
      );
    }
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    _customFontCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickCustomColor({
    required String currentHex,
    required ValueChanged<String> onSelected,
  }) async {
    final hexCtrl = TextEditingController(text: currentHex);
    const extendedSwatches = [
      '#0f172a',
      '#2c2623',
      '#4a3728',
      '#7f1d1d',
      '#b91c1c',
      '#d97706',
      '#14532d',
      '#0d9488',
      '#1e3a5f',
      '#2563eb',
      '#581c87',
      '#be185d',
      '#f8fafc',
      '#fef3c7',
      '#ffffff',
    ];
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final t = context.arcTheme;
        return AlertDialog(
          backgroundColor: t.bgElevated,
          title: Text(
            widget.isZh ? '自定义颜色' : 'Custom Color',
            style: TextStyle(fontSize: 14, color: t.textPrimary),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: extendedSwatches.map((hex) {
                  return InkWell(
                    onTap: () => Navigator.of(ctx).pop(hex),
                    borderRadius: BorderRadius.circular(999),
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: parseStickerHexColor(hex),
                        shape: BoxShape.circle,
                        border: Border.all(color: t.borderStrong),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: hexCtrl,
                style: TextStyle(fontSize: 13, color: t.textPrimary),
                decoration: InputDecoration(
                  isDense: true,
                  hintText: '#RRGGBB',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(widget.isZh ? '取消' : 'Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final v = hexCtrl.text.trim();
                if (RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(v)) {
                  Navigator.of(ctx).pop(v);
                } else {
                  Navigator.of(ctx).pop(currentHex);
                }
              },
              child: Text(widget.isZh ? '应用' : 'Apply'),
            ),
          ],
        );
      },
    );
    hexCtrl.dispose();
    if (result != null) {
      widget.onColorTouched?.call();
      onSelected(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.arcTheme;
    final isDarkSurface = widget.surface == StickerSurface.dark;
    final textColor = isDarkSurface ? const Color(0xFFF8FAFC) : t.textPrimary;
    final mutedColor =
        isDarkSurface ? const Color(0xB3F8FAFC) : t.textSecondary;
    final panelBg =
        isDarkSurface ? const Color(0x0DFFFFFF) : t.bgSubtle;
    final borderColor =
        isDarkSurface ? const Color(0x22FFFFFF) : t.borderSubtle;
    final chipBg =
        isDarkSurface ? const Color(0x14FFFFFF) : t.bgSurface;
    final activeColor = isDarkSurface ? const Color(0xFFF59E0B) : t.accent;
    final v = widget.value;
    final shadows = [
      (id: StickerTextShadow.none, zh: '无', en: 'None'),
      (id: StickerTextShadow.soft, zh: '柔影', en: 'Soft'),
      (id: StickerTextShadow.retro, zh: '复古', en: 'Retro'),
    ];

    Widget chip({
      required Widget child,
      required bool active,
      required VoidCallback onTap,
    }) {
      return InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
          decoration: BoxDecoration(
            color: active ? activeColor : chipBg,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: active ? activeColor : borderColor),
          ),
          child: DefaultTextStyle(
            style: TextStyle(
              fontSize: 11,
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              color: active
                  ? (isDarkSurface ? Colors.white : t.accentText)
                  : textColor,
            ),
            child: child,
          ),
        ),
      );
    }

    return Container(
      padding: EdgeInsets.all(widget.compact ? 10 : 12),
      decoration: BoxDecoration(
        color: panelBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // 1. Overlay Text
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.isZh ? '叠加文字' : 'Overlay Text',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: mutedColor,
                  ),
                ),
              ),
              if (widget.draftFallbackText != null &&
                  widget.draftFallbackText!.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: chip(
                    active: false,
                    onTap: () {
                      final trimmed = widget.draftFallbackText!.trim();
                      final next =
                          trimmed.length > 36 ? trimmed.substring(0, 36) : trimmed;
                      widget.onChange(v.copyWith(text: next));
                    },
                    child: Text(widget.isZh ? '填入草稿' : 'Use Draft'),
                  ),
                ),
              if (v.text.isNotEmpty)
                chip(
                  active: false,
                  onTap: () => widget.onChange(v.copyWith(text: '')),
                  child: Text(widget.isZh ? '清空' : 'Clear'),
                ),
            ],
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _textCtrl,
            maxLength: 60,
            onChanged: (txt) => widget.onChange(v.copyWith(text: txt)),
            style: TextStyle(fontSize: 12.5, color: textColor),
            decoration: InputDecoration(
              isDense: true,
              counterText: '',
              filled: true,
              fillColor: chipBg,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              hintText: widget.isZh
                  ? '输入贴纸上的手帐文字（支持中英文）...'
                  : 'Type sticker text overlay...',
              hintStyle: TextStyle(fontSize: 12, color: mutedColor),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: borderColor),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: borderColor),
              ),
            ),
          ),
          const SizedBox(height: 10),

          // 2. Font Presets
          Text(
            widget.isZh ? '字体' : 'Font',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: mutedColor,
            ),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 5,
            runSpacing: 5,
            children: kStickerFontPresets.map((preset) {
              return chip(
                active: v.fontFamily == preset.id,
                onTap: () => widget.onChange(v.copyWith(fontFamily: preset.id)),
                child: Text(widget.isZh ? preset.label : preset.labelEn),
              );
            }).toList(),
          ),
          if (v.fontFamily == StickerFontPreset.custom) ...[
            const SizedBox(height: 6),
            TextField(
              controller: _customFontCtrl,
              onChanged: (name) =>
                  widget.onChange(v.copyWith(customFontName: name)),
              style: TextStyle(fontSize: 12, color: textColor),
              decoration: InputDecoration(
                isDense: true,
                filled: true,
                fillColor: chipBg,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                hintText: widget.isZh
                    ? '输入系统字体名，如 霞鹜文楷 / Georgia / PingFang SC'
                    : 'System font name, e.g. Georgia, PingFang SC',
                hintStyle: TextStyle(fontSize: 11.5, color: mutedColor),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: borderColor),
                ),
              ),
            ),
          ],
          const SizedBox(height: 10),

          // 3. Text Styles (B/I/U + Shadow + Size + Spacing)
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.isZh ? '文字样式' : 'Text Style',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: mutedColor,
                  ),
                ),
              ),
              Text(
                '${v.fontSize.toStringAsFixed(1)}px · ${widget.isZh ? '字距' : 'Spacing'} ${v.letterSpacing.toStringAsFixed(1)}px',
                style: TextStyle(fontSize: 10.5, color: mutedColor),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              chip(
                active: v.bold,
                onTap: () => widget.onChange(v.copyWith(bold: !v.bold)),
                child: Icon(
                  LucideIcons.bold,
                  size: 13,
                  color: v.bold
                      ? (isDarkSurface ? Colors.white : t.accentText)
                      : textColor,
                ),
              ),
              chip(
                active: v.italic,
                onTap: () => widget.onChange(v.copyWith(italic: !v.italic)),
                child: Icon(
                  LucideIcons.italic,
                  size: 13,
                  color: v.italic
                      ? (isDarkSurface ? Colors.white : t.accentText)
                      : textColor,
                ),
              ),
              chip(
                active: v.underline,
                onTap: () => widget.onChange(v.copyWith(underline: !v.underline)),
                child: Icon(
                  LucideIcons.underline,
                  size: 13,
                  color: v.underline
                      ? (isDarkSurface ? Colors.white : t.accentText)
                      : textColor,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                widget.isZh ? '阴影' : 'Shadow',
                style: TextStyle(fontSize: 11, color: mutedColor),
              ),
              ...shadows.map((sh) {
                return chip(
                  active: v.shadow == sh.id,
                  onTap: () => widget.onChange(v.copyWith(shadow: sh.id)),
                  child: Text(widget.isZh ? sh.zh : sh.en),
                );
              }),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    Text(
                      widget.isZh ? '字号' : 'Size',
                      style: TextStyle(fontSize: 11, color: mutedColor),
                    ),
                    Expanded(
                      child: SliderTheme(
                        data: SliderTheme.of(context).copyWith(
                          trackHeight: 2.5,
                          thumbShape: const RoundSliderThumbShape(
                            enabledThumbRadius: 6,
                          ),
                        ),
                        child: Slider(
                          min: 9,
                          max: 20,
                          divisions: 22,
                          activeColor: activeColor,
                          value: v.fontSize.clamp(9.0, 20.0),
                          onChanged: (val) =>
                              widget.onChange(v.copyWith(fontSize: val)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Row(
                  children: [
                    Text(
                      widget.isZh ? '字距' : 'Gap',
                      style: TextStyle(fontSize: 11, color: mutedColor),
                    ),
                    Expanded(
                      child: SliderTheme(
                        data: SliderTheme.of(context).copyWith(
                          trackHeight: 2.5,
                          thumbShape: const RoundSliderThumbShape(
                            enabledThumbRadius: 6,
                          ),
                        ),
                        child: Slider(
                          min: 0,
                          max: 4,
                          divisions: 8,
                          activeColor: activeColor,
                          value: v.letterSpacing.clamp(0.0, 4.0),
                          onChanged: (val) =>
                              widget.onChange(v.copyWith(letterSpacing: val)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // 4. Text Color
          Text(
            widget.isZh ? '文字颜色' : 'Text Color',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: mutedColor,
            ),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 7,
            runSpacing: 7,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              ...kStickerTextColorPresets.map((hex) {
                final active = v.color.toLowerCase() == hex.toLowerCase();
                return InkWell(
                  onTap: () {
                    widget.onColorTouched?.call();
                    widget.onChange(v.copyWith(color: hex));
                  },
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      color: parseStickerHexColor(hex),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: active ? activeColor : borderColor,
                        width: active ? 2.4 : 1.2,
                      ),
                    ),
                  ),
                );
              }),
              chip(
                active: false,
                onTap: () => _pickCustomColor(
                  currentHex: v.color,
                  onSelected: (hex) => widget.onChange(v.copyWith(color: hex)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(LucideIcons.pipette, size: 11, color: textColor),
                    const SizedBox(width: 4),
                    Text(widget.isZh ? '自定义' : 'Pick'),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // 5. Text Stroke
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.isZh ? '文字描边' : 'Text Stroke',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: mutedColor,
                  ),
                ),
              ),
              chip(
                active: v.strokeEnabled,
                onTap: () =>
                    widget.onChange(v.copyWith(strokeEnabled: !v.strokeEnabled)),
                child: Text(
                  v.strokeEnabled
                      ? (widget.isZh ? '已开启描边' : 'Stroke On')
                      : (widget.isZh ? '开启描边' : 'Enable Stroke'),
                ),
              ),
            ],
          ),
          if (v.strokeEnabled) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                ...kStickerStrokeColorPresets.map((hex) {
                  final active =
                      v.strokeColor.toLowerCase() == hex.toLowerCase();
                  return InkWell(
                    onTap: () {
                      widget.onColorTouched?.call();
                      widget.onChange(v.copyWith(strokeColor: hex));
                    },
                    borderRadius: BorderRadius.circular(999),
                    child: Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        color: parseStickerHexColor(hex),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: active ? activeColor : borderColor,
                          width: active ? 2.4 : 1.2,
                        ),
                      ),
                    ),
                  );
                }),
                chip(
                  active: false,
                  onTap: () => _pickCustomColor(
                    currentHex: v.strokeColor,
                    onSelected: (hex) =>
                        widget.onChange(v.copyWith(strokeColor: hex)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.pipette, size: 11, color: textColor),
                      const SizedBox(width: 4),
                      Text(widget.isZh ? '自定义' : 'Pick'),
                    ],
                  ),
                ),
              ],
            ),
            Row(
              children: [
                Text(
                  '${widget.isZh ? '描边粗细' : 'Width'} (${v.strokeWidth.toStringAsFixed(1)}px)',
                  style: TextStyle(fontSize: 11, color: mutedColor),
                ),
                Expanded(
                  child: SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      trackHeight: 2.5,
                      thumbShape: const RoundSliderThumbShape(
                        enabledThumbRadius: 6,
                      ),
                    ),
                    child: Slider(
                      min: 0.5,
                      max: 4.0,
                      divisions: 7,
                      activeColor: activeColor,
                      value: v.strokeWidth.clamp(0.5, 4.0),
                      onChanged: (val) =>
                          widget.onChange(v.copyWith(strokeWidth: val)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
