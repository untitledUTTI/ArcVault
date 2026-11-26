class OpenSourceProjectItem {
  const OpenSourceProjectItem({
    required this.id,
    required this.name,
    required this.author,
    required this.license,
    required this.category,
    required this.descriptionZh,
    required this.descriptionEn,
    required this.url,
  });

  final String id;
  final String name;
  final String author;
  final String license;
  final String category; // 'flutter' | 'engine' | 'skills'
  final String descriptionZh;
  final String descriptionEn;
  final String url;
}

const List<OpenSourceProjectItem> kOpenSourceProjects = [
  OpenSourceProjectItem(
    id: 'flutter',
    name: 'Flutter & Dart SDK',
    author: 'Google & Flutter Contributors',
    license: 'BSD-3-Clause',
    category: 'flutter',
    descriptionZh: '跨平台原生渲染 UI 框架（Impeller 渲染管线），驱动手机与平板端沉浸式工作台。',
    descriptionEn: 'Cross-platform native UI framework powered by Impeller for mobile and tablet.',
    url: 'https://flutter.dev/',
  ),
  OpenSourceProjectItem(
    id: 'liquid_glass_renderer',
    name: 'liquid_glass_renderer (whynotmake-it/flutter_liquid_glass)',
    author: 'whynotmake.it Contributors',
    license: 'Apache-2.0',
    category: 'flutter',
    descriptionZh: '基于 Impeller Fragment Shader 的实时液态玻璃折射、高光描边与模糊渲染引擎。',
    descriptionEn: 'Impeller Fragment Shader renderer powering real-time liquid glass refraction and blur.',
    url: 'https://github.com/whynotmake-it/flutter_liquid_glass',
  ),
  OpenSourceProjectItem(
    id: 'material_color_utilities',
    name: 'Material Color Utilities',
    author: 'Google / Material Foundation',
    license: 'Apache-2.0',
    category: 'flutter',
    descriptionZh: 'Material 3 HCT 色彩空间算法库，驱动 M3 Expressive 莫奈动态取色引擎。',
    descriptionEn: 'HCT color space & tonal palette algorithms powering M3 Expressive Monet theming.',
    url: 'https://github.com/material-foundation/material-color-utilities',
  ),
  OpenSourceProjectItem(
    id: 'flutter_math_fork',
    name: 'flutter_math_fork & flutter_markdown',
    author: 'Flutter Community & Contributors',
    license: 'Apache-2.0 / BSD-3-Clause',
    category: 'flutter',
    descriptionZh: '原生 Dart KaTeX LaTeX 数学公式排版与 Markdown 学术实时预览渲染器。',
    descriptionEn: 'Pure-Dart LaTeX math typesetting and Markdown academic live preview renderer.',
    url: 'https://pub.dev/packages/flutter_math_fork',
  ),
  OpenSourceProjectItem(
    id: 'archive_xml',
    name: 'archive & xml',
    author: 'Brendan Duncan & Lukas Renggli',
    license: 'MIT',
    category: 'engine',
    descriptionZh: '纯 Dart ZIP 与 XML 解析库，用于无损解析和回写 .docx / .pptx / .xlsx 文档包。',
    descriptionEn: 'Pure-Dart ZIP & XML libraries for lossless .docx / .pptx / .xlsx parsing and export.',
    url: 'https://pub.dev/packages/archive',
  ),
  OpenSourceProjectItem(
    id: 'cryptography',
    name: 'cryptography & crypto',
    author: 'Gohilla & Dart Team',
    license: 'Apache-2.0 / BSD-3-Clause',
    category: 'engine',
    descriptionZh: '实现与桌面端完全兼容的 PBKDF2-HMAC-SHA256 与 AES-256-GCM 端到端加密。',
    descriptionEn: 'Implements desktop-compatible PBKDF2-HMAC-SHA256 & AES-256-GCM encryption.',
    url: 'https://pub.dev/packages/cryptography',
  ),
  OpenSourceProjectItem(
    id: 'lucide_icons_flutter',
    name: 'Lucide Icons Flutter',
    author: 'Lucide Contributors',
    license: 'ISC',
    category: 'flutter',
    descriptionZh: '与桌面端风格完全一致的开源矢量图标库。',
    descriptionEn: 'Clean, consistent open-source vector icon toolkit matching desktop UI.',
    url: 'https://lucide.dev/',
  ),
  OpenSourceProjectItem(
    id: 'blader_humanizer',
    name: 'blader/humanizer & Humanizer-zh',
    author: 'Siqi Chen (blader), op7418, AIScientists-Dev, Adkid-Zephyr',
    license: 'MIT',
    category: 'skills',
    descriptionZh: '内置学术降 AI 味、去防御性写作与学者语感精修 Skill 规范集合。',
    descriptionEn: 'Built-in academic humanizer & anti-defensive writing skill rulesets.',
    url: 'https://github.com/blader/humanizer',
  ),
];
