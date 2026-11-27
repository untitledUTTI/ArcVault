import 'dart:convert';

enum SpaceKind {
  paper('paper'),
  office('office'),
  writing('writing'),
  vault('vault');

  const SpaceKind(this.wire);
  final String wire;

  static SpaceKind fromWire(String? raw) =>
      SpaceKind.values.firstWhere((e) => e.wire == raw, orElse: () => SpaceKind.paper);
}

enum BackupFormat {
  markdown('markdown'),
  latex('latex'),
  both('both');

  const BackupFormat(this.wire);
  final String wire;

  static BackupFormat fromWire(String? raw) =>
      BackupFormat.values.firstWhere((e) => e.wire == raw, orElse: () => BackupFormat.both);
}

enum EditorFormat {
  markdown('markdown'),
  latex('latex');

  const EditorFormat(this.wire);
  final String wire;

  static EditorFormat fromWire(String? raw) =>
      EditorFormat.values.firstWhere((e) => e.wire == raw, orElse: () => EditorFormat.markdown);
}

enum LocaleId {
  zhCN('zh-CN'),
  enUS('en-US');

  const LocaleId(this.wire);
  final String wire;

  bool get isZh => this == LocaleId.zhCN;

  static LocaleId fromWire(String? raw) =>
      raw == 'en-US' ? LocaleId.enUS : LocaleId.zhCN;
}

/// Mobile theme set (4 themes):
/// celestial-optics, weather-live, and liquid-glass are removed on mobile.
enum MobileThemeId {
  light('light'),
  dark('dark'),
  paper('paper'),
  m3Expressive('m3-expressive');

  const MobileThemeId(this.wire);
  final String wire;

  static MobileThemeId fromWire(String? raw) {
    if (raw == 'celestial-optics' || raw == 'weather-live' || raw == 'liquid-glass') {
      return MobileThemeId.light;
    }
    return MobileThemeId.values.firstWhere(
      (e) => e.wire == raw,
      orElse: () => MobileThemeId.light,
    );
  }
}

enum MonetStyle {
  tonalSpot('tonal-spot'),
  neutral('neutral'),
  monochrome('monochrome'),
  vibrant('vibrant'),
  rainbow('rainbow'),
  expressive('expressive'),
  fantasy('fantasy'),
  content('content'),
  fruitSalad('fruit-salad'),
  fidelity('fidelity');

  const MonetStyle(this.wire);
  final String wire;

  static MonetStyle fromWire(String? raw) =>
      MonetStyle.values.firstWhere((e) => e.wire == raw, orElse: () => MonetStyle.expressive);
}

class MonetSettingsModel {
  const MonetSettingsModel({
    this.seedColor = '#6750a4',
    this.style = MonetStyle.expressive,
    this.isDark = false,
    this.contrastLevel = 0.0,
    this.extractedSeeds = const [],
    this.wallpaperThumbDataUrl,
  });

  final String seedColor;
  final MonetStyle style;
  final bool isDark;
  final double contrastLevel;
  final List<String> extractedSeeds;
  final String? wallpaperThumbDataUrl;

  MonetSettingsModel copyWith({
    String? seedColor,
    MonetStyle? style,
    bool? isDark,
    double? contrastLevel,
    List<String>? extractedSeeds,
    String? wallpaperThumbDataUrl,
  }) {
    return MonetSettingsModel(
      seedColor: seedColor ?? this.seedColor,
      style: style ?? this.style,
      isDark: isDark ?? this.isDark,
      contrastLevel: contrastLevel ?? this.contrastLevel,
      extractedSeeds: extractedSeeds ?? this.extractedSeeds,
      wallpaperThumbDataUrl: wallpaperThumbDataUrl ?? this.wallpaperThumbDataUrl,
    );
  }

  Map<String, dynamic> toJson() => {
        'seedColor': seedColor,
        'style': style.wire,
        'isDark': isDark,
        'contrastLevel': contrastLevel,
        'extractedSeeds': extractedSeeds,
        if (wallpaperThumbDataUrl != null) 'wallpaperThumbDataUrl': wallpaperThumbDataUrl,
      };

  factory MonetSettingsModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const MonetSettingsModel();
    return MonetSettingsModel(
      seedColor: (json['seedColor'] as String?) ?? '#6750a4',
      style: MonetStyle.fromWire(json['style'] as String?),
      isDark: json['isDark'] == true,
      contrastLevel: (json['contrastLevel'] as num?)?.toDouble().clamp(-1.0, 1.0) ?? 0.0,
      extractedSeeds: (json['extractedSeeds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      wallpaperThumbDataUrl: json['wallpaperThumbDataUrl'] as String?,
    );
  }
}

enum AiPrivacyPolicy {
  cloudOrLocal('cloud-or-local'),
  localOnly('local-only'),
  disabled('disabled');

  const AiPrivacyPolicy(this.wire);
  final String wire;

  static AiPrivacyPolicy fromWire(String? raw) => AiPrivacyPolicy.values
      .firstWhere((e) => e.wire == raw, orElse: () => AiPrivacyPolicy.cloudOrLocal);
}

enum AnnotationType {
  comment('comment'),
  revision('revision');

  const AnnotationType(this.wire);
  final String wire;

  static AnnotationType fromWire(String? raw) =>
      raw == 'revision' ? AnnotationType.revision : AnnotationType.comment;
}

enum RevisionKind {
  delete('delete'),
  insert('insert'),
  replace('replace');

  const RevisionKind(this.wire);
  final String wire;

  static RevisionKind fromWire(String? raw) =>
      RevisionKind.values.firstWhere((e) => e.wire == raw, orElse: () => RevisionKind.replace);
}

enum AnnotationStatus {
  open('open'),
  accepted('accepted'),
  rejected('rejected'),
  resolved('resolved');

  const AnnotationStatus(this.wire);
  final String wire;

  static AnnotationStatus fromWire(String? raw) =>
      AnnotationStatus.values.firstWhere((e) => e.wire == raw, orElse: () => AnnotationStatus.open);
}

class AnnotationReply {
  const AnnotationReply({
    required this.id,
    required this.author,
    required this.date,
    required this.text,
  });

  final String id;
  final String author;
  final String date;
  final String text;

  Map<String, dynamic> toJson() => {
        'id': id,
        'author': author,
        'date': date,
        'text': text,
      };

  factory AnnotationReply.fromJson(Map<String, dynamic> json) => AnnotationReply(
        id: json['id']?.toString() ?? '',
        author: json['author']?.toString() ?? '',
        date: json['date']?.toString() ?? '',
        text: json['text']?.toString() ?? '',
      );
}

class AnnotationItem {
  const AnnotationItem({
    required this.id,
    required this.type,
    this.revisionKind,
    required this.author,
    required this.date,
    this.commentText,
    required this.originalText,
    this.suggestedText,
    required this.anchorStart,
    required this.anchorEnd,
    required this.status,
    this.replies = const [],
  });

  final String id;
  final AnnotationType type;
  final RevisionKind? revisionKind;
  final String author;
  final String date;
  final String? commentText;
  final String originalText;
  final String? suggestedText;
  final int anchorStart;
  final int anchorEnd;
  final AnnotationStatus status;
  final List<AnnotationReply> replies;

  AnnotationItem copyWith({
    String? id,
    AnnotationType? type,
    RevisionKind? revisionKind,
    String? author,
    String? date,
    String? commentText,
    String? originalText,
    String? suggestedText,
    int? anchorStart,
    int? anchorEnd,
    AnnotationStatus? status,
    List<AnnotationReply>? replies,
  }) {
    return AnnotationItem(
      id: id ?? this.id,
      type: type ?? this.type,
      revisionKind: revisionKind ?? this.revisionKind,
      author: author ?? this.author,
      date: date ?? this.date,
      commentText: commentText ?? this.commentText,
      originalText: originalText ?? this.originalText,
      suggestedText: suggestedText ?? this.suggestedText,
      anchorStart: anchorStart ?? this.anchorStart,
      anchorEnd: anchorEnd ?? this.anchorEnd,
      status: status ?? this.status,
      replies: replies ?? this.replies,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.wire,
        if (revisionKind != null) 'revisionKind': revisionKind!.wire,
        'author': author,
        'date': date,
        if (commentText != null) 'commentText': commentText,
        'originalText': originalText,
        if (suggestedText != null) 'suggestedText': suggestedText,
        'anchorStart': anchorStart,
        'anchorEnd': anchorEnd,
        'status': status.wire,
        'replies': replies.map((r) => r.toJson()).toList(),
      };

  factory AnnotationItem.fromJson(Map<String, dynamic> json) => AnnotationItem(
        id: json['id']?.toString() ?? '',
        type: AnnotationType.fromWire(json['type'] as String?),
        revisionKind: json['revisionKind'] != null
            ? RevisionKind.fromWire(json['revisionKind'] as String?)
            : null,
        author: json['author']?.toString() ?? '',
        date: json['date']?.toString() ?? '',
        commentText: json['commentText'] as String?,
        originalText: json['originalText']?.toString() ?? '',
        suggestedText: json['suggestedText'] as String?,
        anchorStart: (json['anchorStart'] as num?)?.toInt() ?? 0,
        anchorEnd: (json['anchorEnd'] as num?)?.toInt() ?? 0,
        status: AnnotationStatus.fromWire(json['status'] as String?),
        replies: (json['replies'] as List<dynamic>?)
                ?.map((e) => AnnotationReply.fromJson(Map<String, dynamic>.from(e as Map)))
                .toList() ??
            const [],
      );
}

class CoverRule {
  const CoverRule({
    required this.documentId,
    required this.coverEndBlockIndex,
    required this.remember,
    required this.coverBlockCount,
  });

  final String documentId;
  final int coverEndBlockIndex;
  final bool remember;
  final int coverBlockCount;

  CoverRule copyWith({
    String? documentId,
    int? coverEndBlockIndex,
    bool? remember,
    int? coverBlockCount,
  }) =>
      CoverRule(
        documentId: documentId ?? this.documentId,
        coverEndBlockIndex: coverEndBlockIndex ?? this.coverEndBlockIndex,
        remember: remember ?? this.remember,
        coverBlockCount: coverBlockCount ?? this.coverBlockCount,
      );

  Map<String, dynamic> toJson() => {
        'documentId': documentId,
        'coverEndBlockIndex': coverEndBlockIndex,
        'remember': remember,
        'coverBlockCount': coverBlockCount,
      };

  factory CoverRule.fromJson(Map<String, dynamic>? json, String fallbackDocId) {
    if (json == null) {
      return CoverRule(
        documentId: fallbackDocId,
        coverEndBlockIndex: 0,
        remember: false,
        coverBlockCount: 0,
      );
    }
    return CoverRule(
      documentId: json['documentId']?.toString() ?? fallbackDocId,
      coverEndBlockIndex: (json['coverEndBlockIndex'] as num?)?.toInt() ?? 0,
      remember: json['remember'] == true,
      coverBlockCount: (json['coverBlockCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class CitationSidecarEntry {
  const CitationSidecarEntry({
    required this.placeholder,
    required this.provider,
    required this.rawXml,
    required this.displayText,
  });

  final String placeholder;
  final String provider; // 'zotero' | 'endnote' | 'word-field'
  final String rawXml;
  final String displayText;

  Map<String, dynamic> toJson() => {
        'placeholder': placeholder,
        'provider': provider,
        'rawXml': rawXml,
        'displayText': displayText,
      };

  factory CitationSidecarEntry.fromJson(Map<String, dynamic> json) => CitationSidecarEntry(
        placeholder: json['placeholder']?.toString() ?? '',
        provider: json['provider']?.toString() ?? 'word-field',
        rawXml: json['rawXml']?.toString() ?? '',
        displayText: json['displayText']?.toString() ?? '',
      );
}

class MediaAsset {
  const MediaAsset({
    required this.id,
    required this.filename,
    required this.mimeType,
    required this.dataUrl,
  });

  final String id;
  final String filename;
  final String mimeType;
  final String dataUrl;

  Map<String, dynamic> toJson() => {
        'id': id,
        'filename': filename,
        'mimeType': mimeType,
        'dataUrl': dataUrl,
      };

  factory MediaAsset.fromJson(Map<String, dynamic> json) => MediaAsset(
        id: json['id']?.toString() ?? '',
        filename: json['filename']?.toString() ?? '',
        mimeType: json['mimeType']?.toString() ?? 'application/octet-stream',
        dataUrl: json['dataUrl']?.toString() ?? '',
      );
}

class PptxSlideData {
  const PptxSlideData({
    required this.index,
    required this.title,
    required this.bullets,
    this.notes,
  });

  final int index;
  final String title;
  final List<String> bullets;
  final String? notes;

  Map<String, dynamic> toJson() => {
        'index': index,
        'title': title,
        'bullets': bullets,
        if (notes != null) 'notes': notes,
      };

  factory PptxSlideData.fromJson(Map<String, dynamic> json) => PptxSlideData(
        index: (json['index'] as num?)?.toInt() ?? 1,
        title: json['title']?.toString() ?? '',
        bullets: (json['bullets'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
        notes: json['notes'] as String?,
      );
}

class XlsxSheetData {
  const XlsxSheetData({
    required this.name,
    required this.rows,
  });

  final String name;
  final List<List<String>> rows;

  Map<String, dynamic> toJson() => {
        'name': name,
        'rows': rows,
      };

  factory XlsxSheetData.fromJson(Map<String, dynamic> json) => XlsxSheetData(
        name: json['name']?.toString() ?? 'Sheet1',
        rows: (json['rows'] as List<dynamic>?)
                ?.map((r) => (r as List<dynamic>).map((c) => c.toString()).toList())
                .toList() ??
            const [],
      );
}

class OfficePreviewData {
  const OfficePreviewData({
    required this.kind, // 'pptx' | 'xlsx' | 'pdf'
    this.slides = const [],
    this.sheets = const [],
    this.dataUrl,
    this.sizeBytes,
  });

  final String kind;
  final List<PptxSlideData> slides;
  final List<XlsxSheetData> sheets;
  final String? dataUrl;
  final int? sizeBytes;

  Map<String, dynamic> toJson() {
    switch (kind) {
      case 'pptx':
        return {
          'kind': 'pptx',
          'slides': slides.map((s) => s.toJson()).toList(),
        };
      case 'xlsx':
        return {
          'kind': 'xlsx',
          'sheets': sheets.map((s) => s.toJson()).toList(),
        };
      default:
        return {
          'kind': 'pdf',
          if (dataUrl != null) 'dataUrl': dataUrl,
          if (sizeBytes != null) 'sizeBytes': sizeBytes,
        };
    }
  }

  factory OfficePreviewData.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const OfficePreviewData(kind: 'pdf');
    final kind = json['kind']?.toString() ?? 'pdf';
    if (kind == 'pptx') {
      return OfficePreviewData(
        kind: 'pptx',
        slides: (json['slides'] as List<dynamic>?)
                ?.map((e) => PptxSlideData.fromJson(Map<String, dynamic>.from(e as Map)))
                .toList() ??
            const [],
      );
    }
    if (kind == 'xlsx') {
      return OfficePreviewData(
        kind: 'xlsx',
        sheets: (json['sheets'] as List<dynamic>?)
                ?.map((e) => XlsxSheetData.fromJson(Map<String, dynamic>.from(e as Map)))
                .toList() ??
            const [],
      );
    }
    return OfficePreviewData(
      kind: 'pdf',
      dataUrl: json['dataUrl'] as String?,
      sizeBytes: (json['sizeBytes'] as num?)?.toInt(),
    );
  }
}

class ArchiveDocument {
  const ArchiveDocument({
    required this.id,
    required this.spaceId,
    required this.title,
    required this.sourceExt,
    required this.sourceFileName,
    required this.backupFormat,
    required this.activeFormat,
    required this.markdownText,
    required this.latexText,
    this.annotations = const [],
    this.baseDocxBase64,
    this.coverXmlNodes = const [],
    required this.coverRule,
    this.citationsSidecar = const [],
    this.mediaAssets = const {},
    this.isSealed = false,
    this.sealedHash,
    this.sealedAt,
    this.aiPolicyOverride,
    this.officePreview,
    this.encryptedPayload,
    this.watchPath,
    this.trashedAt,
    this.trashedFromSpaceId,
    required this.updatedAt,
    required this.createdAt,
    required this.currentBranchId,
    this.tags = const [],
  });

  final String id;
  final String spaceId;
  final String title;
  final String sourceExt;
  final String sourceFileName;
  final BackupFormat backupFormat;
  final EditorFormat activeFormat;
  final String markdownText;
  final String latexText;
  final List<AnnotationItem> annotations;
  final String? baseDocxBase64;
  final List<String> coverXmlNodes;
  final CoverRule coverRule;
  final List<CitationSidecarEntry> citationsSidecar;
  final Map<String, MediaAsset> mediaAssets;
  final bool isSealed;
  final String? sealedHash;
  final String? sealedAt;
  final AiPrivacyPolicy? aiPolicyOverride;
  final OfficePreviewData? officePreview;
  final String? encryptedPayload;
  final String? watchPath;
  final String? trashedAt;
  final String? trashedFromSpaceId;
  final String updatedAt;
  final String createdAt;
  final String currentBranchId;
  final List<String> tags;

  String get activeText => activeFormat == EditorFormat.markdown ? markdownText : latexText;

  bool get isTrashed => trashedAt != null && trashedAt!.isNotEmpty;

  ArchiveDocument copyWith({
    String? id,
    String? spaceId,
    String? title,
    String? sourceExt,
    String? sourceFileName,
    BackupFormat? backupFormat,
    EditorFormat? activeFormat,
    String? markdownText,
    String? latexText,
    List<AnnotationItem>? annotations,
    String? baseDocxBase64,
    List<String>? coverXmlNodes,
    CoverRule? coverRule,
    List<CitationSidecarEntry>? citationsSidecar,
    Map<String, MediaAsset>? mediaAssets,
    bool? isSealed,
    String? sealedHash,
    bool clearSealedHash = false,
    String? sealedAt,
    bool clearSealedAt = false,
    AiPrivacyPolicy? aiPolicyOverride,
    bool clearAiPolicy = false,
    OfficePreviewData? officePreview,
    String? encryptedPayload,
    bool clearEncryptedPayload = false,
    String? watchPath,
    String? trashedAt,
    bool clearTrashedAt = false,
    String? trashedFromSpaceId,
    bool clearTrashedFromSpaceId = false,
    String? updatedAt,
    String? createdAt,
    String? currentBranchId,
    List<String>? tags,
  }) {
    return ArchiveDocument(
      id: id ?? this.id,
      spaceId: spaceId ?? this.spaceId,
      title: title ?? this.title,
      sourceExt: sourceExt ?? this.sourceExt,
      sourceFileName: sourceFileName ?? this.sourceFileName,
      backupFormat: backupFormat ?? this.backupFormat,
      activeFormat: activeFormat ?? this.activeFormat,
      markdownText: markdownText ?? this.markdownText,
      latexText: latexText ?? this.latexText,
      annotations: annotations ?? this.annotations,
      baseDocxBase64: baseDocxBase64 ?? this.baseDocxBase64,
      coverXmlNodes: coverXmlNodes ?? this.coverXmlNodes,
      coverRule: coverRule ?? this.coverRule,
      citationsSidecar: citationsSidecar ?? this.citationsSidecar,
      mediaAssets: mediaAssets ?? this.mediaAssets,
      isSealed: isSealed ?? this.isSealed,
      sealedHash: clearSealedHash ? null : (sealedHash ?? this.sealedHash),
      sealedAt: clearSealedAt ? null : (sealedAt ?? this.sealedAt),
      aiPolicyOverride: clearAiPolicy ? null : (aiPolicyOverride ?? this.aiPolicyOverride),
      officePreview: officePreview ?? this.officePreview,
      encryptedPayload: clearEncryptedPayload ? null : (encryptedPayload ?? this.encryptedPayload),
      watchPath: watchPath ?? this.watchPath,
      trashedAt: clearTrashedAt ? null : (trashedAt ?? this.trashedAt),
      trashedFromSpaceId:
          clearTrashedFromSpaceId ? null : (trashedFromSpaceId ?? this.trashedFromSpaceId),
      updatedAt: updatedAt ?? this.updatedAt,
      createdAt: createdAt ?? this.createdAt,
      currentBranchId: currentBranchId ?? this.currentBranchId,
      tags: tags ?? this.tags,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'spaceId': spaceId,
        'title': title,
        'sourceExt': sourceExt,
        'sourceFileName': sourceFileName,
        'backupFormat': backupFormat.wire,
        'activeFormat': activeFormat.wire,
        'markdownText': markdownText,
        'latexText': latexText,
        'annotations': annotations.map((a) => a.toJson()).toList(),
        if (baseDocxBase64 != null) 'baseDocxBase64': baseDocxBase64,
        'coverXmlNodes': coverXmlNodes,
        'coverRule': coverRule.toJson(),
        'citationsSidecar': citationsSidecar.map((c) => c.toJson()).toList(),
        'mediaAssets': mediaAssets.map((k, v) => MapEntry(k, v.toJson())),
        'isSealed': isSealed,
        if (sealedHash != null) 'sealedHash': sealedHash,
        if (sealedAt != null) 'sealedAt': sealedAt,
        if (aiPolicyOverride != null) 'aiPolicyOverride': aiPolicyOverride!.wire,
        if (officePreview != null) 'officePreview': officePreview!.toJson(),
        if (encryptedPayload != null) 'encryptedPayload': encryptedPayload,
        if (watchPath != null) 'watchPath': watchPath,
        if (trashedAt != null) 'trashedAt': trashedAt,
        if (trashedFromSpaceId != null) 'trashedFromSpaceId': trashedFromSpaceId,
        'updatedAt': updatedAt,
        'createdAt': createdAt,
        'currentBranchId': currentBranchId,
        'tags': tags,
      };

  factory ArchiveDocument.fromJson(Map<String, dynamic> json) {
    final docId = json['id']?.toString() ?? '';
    final rawMedia = json['mediaAssets'];
    final media = <String, MediaAsset>{};
    if (rawMedia is Map) {
      rawMedia.forEach((key, value) {
        if (value is Map) {
          media[key.toString()] = MediaAsset.fromJson(Map<String, dynamic>.from(value));
        }
      });
    }
    return ArchiveDocument(
      id: docId,
      spaceId: json['spaceId']?.toString() ?? 'sp_paper',
      title: json['title']?.toString() ?? 'Untitled',
      sourceExt: json['sourceExt']?.toString() ?? '.md',
      sourceFileName: json['sourceFileName']?.toString() ?? 'untitled.md',
      backupFormat: BackupFormat.fromWire(json['backupFormat'] as String?),
      activeFormat: EditorFormat.fromWire(json['activeFormat'] as String?),
      markdownText: json['markdownText']?.toString() ?? '',
      latexText: json['latexText']?.toString() ?? '',
      annotations: (json['annotations'] as List<dynamic>?)
              ?.map((e) => AnnotationItem.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList() ??
          const [],
      baseDocxBase64: json['baseDocxBase64'] as String?,
      coverXmlNodes:
          (json['coverXmlNodes'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      coverRule: CoverRule.fromJson(
        json['coverRule'] is Map ? Map<String, dynamic>.from(json['coverRule'] as Map) : null,
        docId,
      ),
      citationsSidecar: (json['citationsSidecar'] as List<dynamic>?)
              ?.map((e) => CitationSidecarEntry.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList() ??
          const [],
      mediaAssets: media,
      isSealed: json['isSealed'] == true,
      sealedHash: json['sealedHash'] as String?,
      sealedAt: json['sealedAt'] as String?,
      aiPolicyOverride: json['aiPolicyOverride'] != null
          ? AiPrivacyPolicy.fromWire(json['aiPolicyOverride'] as String?)
          : null,
      officePreview: json['officePreview'] is Map
          ? OfficePreviewData.fromJson(Map<String, dynamic>.from(json['officePreview'] as Map))
          : null,
      encryptedPayload: json['encryptedPayload'] as String?,
      watchPath: json['watchPath'] as String?,
      trashedAt: json['trashedAt'] as String?,
      trashedFromSpaceId: json['trashedFromSpaceId'] as String?,
      updatedAt: json['updatedAt']?.toString() ?? DateTime.now().toIso8601String(),
      createdAt: json['createdAt']?.toString() ?? DateTime.now().toIso8601String(),
      currentBranchId: json['currentBranchId']?.toString() ?? 'branch_main',
      tags: (json['tags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
    );
  }
}

class Space {
  const Space({
    required this.id,
    required this.kind,
    required this.nameZh,
    required this.nameEn,
    required this.aiPolicy,
    this.locked = false,
  });

  final String id;
  final SpaceKind kind;
  final String nameZh;
  final String nameEn;
  final AiPrivacyPolicy aiPolicy;
  final bool locked;

  String label(LocaleId locale) => locale.isZh ? nameZh : nameEn;
}

class Snapshot {
  const Snapshot({
    required this.id,
    required this.documentId,
    required this.branchId,
    this.parentId,
    required this.createdAt,
    required this.label,
    required this.isMilestone,
    this.tags = const [],
    required this.contentHash,
    required this.markdownHash,
    required this.latexHash,
    required this.wordCount,
    required this.deltaChars,
    required this.aiSummary,
    this.motivationNote,
    this.annotationsCount = 0,
  });

  final String id;
  final String documentId;
  final String branchId;
  final String? parentId;
  final String createdAt;
  final String label;
  final bool isMilestone;
  final List<String> tags;
  final String contentHash;
  final String markdownHash;
  final String latexHash;
  final int wordCount;
  final int deltaChars;
  final String aiSummary;
  final String? motivationNote;
  final int annotationsCount;

  Snapshot copyWith({String? createdAt, String? motivationNote}) => Snapshot(
        id: id,
        documentId: documentId,
        branchId: branchId,
        parentId: parentId,
        createdAt: createdAt ?? this.createdAt,
        label: label,
        isMilestone: isMilestone,
        tags: tags,
        contentHash: contentHash,
        markdownHash: markdownHash,
        latexHash: latexHash,
        wordCount: wordCount,
        deltaChars: deltaChars,
        aiSummary: aiSummary,
        motivationNote: motivationNote ?? this.motivationNote,
        annotationsCount: annotationsCount,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'documentId': documentId,
        'branchId': branchId,
        'parentId': parentId,
        'createdAt': createdAt,
        'label': label,
        'isMilestone': isMilestone,
        'tags': tags,
        'contentHash': contentHash,
        'markdownHash': markdownHash,
        'latexHash': latexHash,
        'wordCount': wordCount,
        'deltaChars': deltaChars,
        'aiSummary': aiSummary,
        if (motivationNote != null) 'motivationNote': motivationNote,
        'annotationsCount': annotationsCount,
      };

  factory Snapshot.fromJson(Map<String, dynamic> json) => Snapshot(
        id: json['id']?.toString() ?? '',
        documentId: json['documentId']?.toString() ?? '',
        branchId: json['branchId']?.toString() ?? '',
        parentId: json['parentId'] as String?,
        createdAt: json['createdAt']?.toString() ?? DateTime.now().toIso8601String(),
        label: json['label']?.toString() ?? '',
        isMilestone: json['isMilestone'] == true,
        tags: (json['tags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
        contentHash: json['contentHash']?.toString() ?? '',
        markdownHash: json['markdownHash']?.toString() ?? '',
        latexHash: json['latexHash']?.toString() ?? '',
        wordCount: (json['wordCount'] as num?)?.toInt() ?? 0,
        deltaChars: (json['deltaChars'] as num?)?.toInt() ?? 0,
        aiSummary: json['aiSummary']?.toString() ?? '',
        motivationNote: json['motivationNote'] as String?,
        annotationsCount: (json['annotationsCount'] as num?)?.toInt() ?? 0,
      );
}

class Branch {
  const Branch({
    required this.id,
    required this.documentId,
    required this.name,
    required this.isMain,
    required this.createdAt,
    this.headSnapshotId,
  });

  final String id;
  final String documentId;
  final String name;
  final bool isMain;
  final String createdAt;
  final String? headSnapshotId;

  Branch copyWith({String? headSnapshotId}) => Branch(
        id: id,
        documentId: documentId,
        name: name,
        isMain: isMain,
        createdAt: createdAt,
        headSnapshotId: headSnapshotId ?? this.headSnapshotId,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'documentId': documentId,
        'name': name,
        'isMain': isMain,
        'createdAt': createdAt,
        'headSnapshotId': headSnapshotId,
      };

  factory Branch.fromJson(Map<String, dynamic> json) => Branch(
        id: json['id']?.toString() ?? '',
        documentId: json['documentId']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        isMain: json['isMain'] == true,
        createdAt: json['createdAt']?.toString() ?? DateTime.now().toIso8601String(),
        headSnapshotId: json['headSnapshotId'] as String?,
      );
}

class DeletedDarling {
  const DeletedDarling({
    required this.id,
    required this.documentId,
    required this.snapshotId,
    required this.deletedAt,
    required this.text,
    required this.charCount,
    this.tags = const [],
  });

  final String id;
  final String documentId;
  final String snapshotId;
  final String deletedAt;
  final String text;
  final int charCount;
  final List<String> tags;

  Map<String, dynamic> toJson() => {
        'id': id,
        'documentId': documentId,
        'snapshotId': snapshotId,
        'deletedAt': deletedAt,
        'text': text,
        'charCount': charCount,
        'tags': tags,
      };

  factory DeletedDarling.fromJson(Map<String, dynamic> json) => DeletedDarling(
        id: json['id']?.toString() ?? '',
        documentId: json['documentId']?.toString() ?? '',
        snapshotId: json['snapshotId']?.toString() ?? '',
        deletedAt: json['deletedAt']?.toString() ?? '',
        text: json['text']?.toString() ?? '',
        charCount: (json['charCount'] as num?)?.toInt() ?? 0,
        tags: (json['tags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      );
}

class MotivationAttachment {
  const MotivationAttachment({
    required this.id,
    required this.documentId,
    this.snapshotId,
    required this.kind,
    required this.title,
    required this.content,
    this.imageDataUrl,
    required this.createdAt,
  });

  final String id;
  final String documentId;
  final String? snapshotId;
  final String kind; // 'screenshot' | 'email' | 'reviewer-comment' | 'note'
  final String title;
  final String content;
  final String? imageDataUrl;
  final String createdAt;

  Map<String, dynamic> toJson() => {
        'id': id,
        'documentId': documentId,
        if (snapshotId != null) 'snapshotId': snapshotId,
        'kind': kind,
        'title': title,
        'content': content,
        if (imageDataUrl != null) 'imageDataUrl': imageDataUrl,
        'createdAt': createdAt,
      };

  factory MotivationAttachment.fromJson(Map<String, dynamic> json) => MotivationAttachment(
        id: json['id']?.toString() ?? '',
        documentId: json['documentId']?.toString() ?? '',
        snapshotId: json['snapshotId'] as String?,
        kind: json['kind']?.toString() ?? 'note',
        title: json['title']?.toString() ?? '',
        content: json['content']?.toString() ?? '',
        imageDataUrl: json['imageDataUrl'] as String?,
        createdAt: json['createdAt']?.toString() ?? '',
      );
}

class LinkedAsset {
  const LinkedAsset({
    required this.id,
    required this.documentId,
    required this.name,
    required this.category,
    required this.relativePath,
    required this.sizeBytes,
    required this.contentHash,
    required this.updatedAt,
    this.snapshotIds = const [],
  });

  final String id;
  final String documentId;
  final String name;
  final String category; // 'figure' | 'data' | 'code' | 'bibliography'
  final String relativePath;
  final int sizeBytes;
  final String contentHash;
  final String updatedAt;
  final List<String> snapshotIds;

  Map<String, dynamic> toJson() => {
        'id': id,
        'documentId': documentId,
        'name': name,
        'category': category,
        'relativePath': relativePath,
        'sizeBytes': sizeBytes,
        'contentHash': contentHash,
        'updatedAt': updatedAt,
        'snapshotIds': snapshotIds,
      };

  factory LinkedAsset.fromJson(Map<String, dynamic> json) => LinkedAsset(
        id: json['id']?.toString() ?? '',
        documentId: json['documentId']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        category: json['category']?.toString() ?? 'figure',
        relativePath: json['relativePath']?.toString() ?? '',
        sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
        contentHash: json['contentHash']?.toString() ?? '',
        updatedAt: json['updatedAt']?.toString() ?? '',
        snapshotIds:
            (json['snapshotIds'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      );
}

class ConsistencyIssue {
  const ConsistencyIssue({
    required this.id,
    required this.severity,
    required this.category,
    required this.title,
    required this.detail,
    required this.snippet,
    this.suggestedFix,
  });

  final String id;
  final String severity; // 'error' | 'warning' | 'info'
  final String category;
  final String title;
  final String detail;
  final String snippet;
  final String? suggestedFix;
}

class WritingActivityDay {
  const WritingActivityDay({
    required this.date,
    required this.charsDelta,
    required this.editSessions,
    required this.peakHour,
  });

  final String date;
  final int charsDelta;
  final int editSessions;
  final int peakHour;

  Map<String, dynamic> toJson() => {
        'date': date,
        'charsDelta': charsDelta,
        'editSessions': editSessions,
        'peakHour': peakHour,
      };

  factory WritingActivityDay.fromJson(Map<String, dynamic> json) => WritingActivityDay(
        date: json['date']?.toString() ?? '',
        charsDelta: (json['charsDelta'] as num?)?.toInt() ?? 0,
        editSessions: (json['editSessions'] as num?)?.toInt() ?? 0,
        peakHour: (json['peakHour'] as num?)?.toInt() ?? 10,
      );
}

enum UiFontPreset {
  systemSans('system-sans'),
  pingfang('pingfang'),
  serif('serif'),
  rounded('rounded'),
  custom('custom');

  const UiFontPreset(this.wire);
  final String wire;
  static UiFontPreset fromWire(String? raw) =>
      UiFontPreset.values.firstWhere((e) => e.wire == raw, orElse: () => UiFontPreset.systemSans);
}

enum EditorFontPreset {
  sans('sans'),
  academicSerif('academic-serif'),
  wenkai('wenkai'),
  mono('mono'),
  custom('custom');

  const EditorFontPreset(this.wire);
  final String wire;
  static EditorFontPreset fromWire(String? raw) =>
      EditorFontPreset.values.firstWhere((e) => e.wire == raw, orElse: () => EditorFontPreset.sans);
}

class TypographySettingsModel {
  const TypographySettingsModel({
    this.uiFontPreset = UiFontPreset.systemSans,
    this.uiFontCustom = '',
    this.editorFontPreset = EditorFontPreset.sans,
    this.editorFontCustom = '',
    this.editorFontSize = 15.0,
    this.editorLineHeight = 1.75,
  });

  final UiFontPreset uiFontPreset;
  final String uiFontCustom;
  final EditorFontPreset editorFontPreset;
  final String editorFontCustom;
  final double editorFontSize;
  final double editorLineHeight;

  TypographySettingsModel copyWith({
    UiFontPreset? uiFontPreset,
    String? uiFontCustom,
    EditorFontPreset? editorFontPreset,
    String? editorFontCustom,
    double? editorFontSize,
    double? editorLineHeight,
  }) =>
      TypographySettingsModel(
        uiFontPreset: uiFontPreset ?? this.uiFontPreset,
        uiFontCustom: uiFontCustom ?? this.uiFontCustom,
        editorFontPreset: editorFontPreset ?? this.editorFontPreset,
        editorFontCustom: editorFontCustom ?? this.editorFontCustom,
        editorFontSize: editorFontSize ?? this.editorFontSize,
        editorLineHeight: editorLineHeight ?? this.editorLineHeight,
      );

  Map<String, dynamic> toJson() => {
        'uiFontPreset': uiFontPreset.wire,
        'uiFontCustom': uiFontCustom,
        'editorFontPreset': editorFontPreset.wire,
        'editorFontCustom': editorFontCustom,
        'editorFontSize': editorFontSize,
        'editorLineHeight': editorLineHeight,
      };

  factory TypographySettingsModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const TypographySettingsModel();
    return TypographySettingsModel(
      uiFontPreset: UiFontPreset.fromWire(json['uiFontPreset'] as String?),
      uiFontCustom: json['uiFontCustom']?.toString() ?? '',
      editorFontPreset: EditorFontPreset.fromWire(json['editorFontPreset'] as String?),
      editorFontCustom: json['editorFontCustom']?.toString() ?? '',
      editorFontSize: (json['editorFontSize'] as num?)?.toDouble().clamp(12.0, 22.0) ?? 15.0,
      editorLineHeight: (json['editorLineHeight'] as num?)?.toDouble().clamp(1.2, 2.4) ?? 1.75,
    );
  }
}

enum HapticIntensity {
  off('off'),
  gentle('gentle'),
  standard('standard');

  const HapticIntensity(this.wire);
  final String wire;
  static HapticIntensity fromWire(String? raw) =>
      HapticIntensity.values.firstWhere((e) => e.wire == raw, orElse: () => HapticIntensity.gentle);
}

enum HapticPattern { selection, light, medium, heavy, success, warning, error }

class HapticsSettingsModel {
  const HapticsSettingsModel({
    this.enabled = true,
    this.intensity = HapticIntensity.gentle,
  });

  final bool enabled;
  final HapticIntensity intensity;

  HapticsSettingsModel copyWith({bool? enabled, HapticIntensity? intensity}) =>
      HapticsSettingsModel(
        enabled: enabled ?? this.enabled,
        intensity: intensity ?? this.intensity,
      );

  Map<String, dynamic> toJson() => {
        'enabled': enabled,
        'intensity': intensity.wire,
      };

  factory HapticsSettingsModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const HapticsSettingsModel();
    return HapticsSettingsModel(
      enabled: json['enabled'] != false,
      intensity: HapticIntensity.fromWire(json['intensity'] as String?),
    );
  }
}

enum ScrollScrubberShape {
  auto('auto'),
  orb('orb'),
  squircle('squircle'),
  m3Clover('m3-clover'),
  m3Burst('m3-burst');

  const ScrollScrubberShape(this.wire);
  final String wire;
  static ScrollScrubberShape fromWire(String? raw) =>
      ScrollScrubberShape.values.firstWhere((e) => e.wire == raw, orElse: () => ScrollScrubberShape.auto);
}

class ScrollScrubberSettingsModel {
  const ScrollScrubberSettingsModel({
    this.size = 40,
    this.shape = ScrollScrubberShape.auto,
  });

  final int size; // 28..60
  final ScrollScrubberShape shape;

  ScrollScrubberSettingsModel copyWith({int? size, ScrollScrubberShape? shape}) =>
      ScrollScrubberSettingsModel(
        size: (size ?? this.size).clamp(28, 60),
        shape: shape ?? this.shape,
      );

  Map<String, dynamic> toJson() => {'size': size, 'shape': shape.wire};

  factory ScrollScrubberSettingsModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const ScrollScrubberSettingsModel();
    return ScrollScrubberSettingsModel(
      size: ((json['size'] as num?)?.toInt() ?? 40).clamp(28, 60),
      shape: ScrollScrubberShape.fromWire(json['shape'] as String?),
    );
  }
}

class AutoBackupPolicyModel {
  const AutoBackupPolicyModel({
    this.enabled = true,
    this.debounceMinutes = 3,
    this.dailyTime = '23:00',
    this.minCharChangeThreshold = 80,
  });

  final bool enabled;
  final int debounceMinutes;
  final String dailyTime;
  final int minCharChangeThreshold;

  AutoBackupPolicyModel copyWith({
    bool? enabled,
    int? debounceMinutes,
    String? dailyTime,
    int? minCharChangeThreshold,
  }) =>
      AutoBackupPolicyModel(
        enabled: enabled ?? this.enabled,
        debounceMinutes: debounceMinutes ?? this.debounceMinutes,
        dailyTime: dailyTime ?? this.dailyTime,
        minCharChangeThreshold: minCharChangeThreshold ?? this.minCharChangeThreshold,
      );

  Map<String, dynamic> toJson() => {
        'enabled': enabled,
        'debounceMinutes': debounceMinutes,
        'dailyTime': dailyTime,
        'minCharChangeThreshold': minCharChangeThreshold,
      };

  factory AutoBackupPolicyModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const AutoBackupPolicyModel();
    return AutoBackupPolicyModel(
      enabled: json['enabled'] != false,
      debounceMinutes: (json['debounceMinutes'] as num?)?.toInt() ?? 3,
      dailyTime: json['dailyTime']?.toString() ?? '23:00',
      minCharChangeThreshold: (json['minCharChangeThreshold'] as num?)?.toInt() ?? 80,
    );
  }
}

enum SyncMode {
  lan('lan'),
  webdav('webdav'),
  s3('s3');

  const SyncMode(this.wire);
  final String wire;
  static SyncMode fromWire(String? raw) =>
      SyncMode.values.firstWhere((e) => e.wire == raw, orElse: () => SyncMode.lan);
}

enum WebdavPresetId {
  jianguoyun('jianguoyun'),
  nextcloud('nextcloud'),
  alist('alist'),
  synology('synology'),
  custom('custom');

  const WebdavPresetId(this.wire);
  final String wire;
  static WebdavPresetId fromWire(String? raw) =>
      WebdavPresetId.values.firstWhere((e) => e.wire == raw, orElse: () => WebdavPresetId.jianguoyun);
}

class HlcTimestamp {
  const HlcTimestamp({
    required this.wallMs,
    required this.logical,
    required this.nodeId,
  });

  final int wallMs;
  final int logical;
  final String nodeId;

  Map<String, dynamic> toJson() => {
        'wallMs': wallMs,
        'logical': logical,
        'nodeId': nodeId,
      };

  factory HlcTimestamp.fromJson(Map<String, dynamic> json) => HlcTimestamp(
        wallMs: (json['wallMs'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch,
        logical: (json['logical'] as num?)?.toInt() ?? 0,
        nodeId: json['nodeId']?.toString() ?? 'mobile',
      );
}

class SyncOpLogEntry {
  const SyncOpLogEntry({
    required this.id,
    required this.docId,
    required this.docTitle,
    required this.op,
    required this.hlc,
    required this.contentHash,
    required this.deviceId,
    required this.deviceName,
    required this.createdAt,
  });

  final String id;
  final String docId;
  final String docTitle;
  final String op;
  final HlcTimestamp hlc;
  final String contentHash;
  final String deviceId;
  final String deviceName;
  final String createdAt;
}

class SyncConflictItem {
  const SyncConflictItem({
    required this.id,
    required this.docId,
    required this.title,
    required this.localText,
    required this.remoteText,
    required this.baseText,
    required this.localUpdatedAt,
    required this.remoteUpdatedAt,
    required this.remoteDeviceName,
    required this.remoteDoc,
  });

  final String id;
  final String docId;
  final String title;
  final String localText;
  final String remoteText;
  final String baseText;
  final String localUpdatedAt;
  final String remoteUpdatedAt;
  final String remoteDeviceName;
  final ArchiveDocument remoteDoc;
}

class SyncSettingsModel {
  const SyncSettingsModel({
    this.enabled = false,
    this.mode = SyncMode.lan,
    this.deviceId = 'dev_mobile_primary',
    this.deviceName = '我的穹档移动端',
    this.e2eePassphrase = '',
    this.lanPort = 47820,
    this.lanPeerUrl = '',
    this.lanPin = '264780',
    this.webdavUrl = '',
    this.webdavUsername = '',
    this.webdavPassword = '',
    this.webdavBasePath = '/ArcVault',
    this.webdavPreset = WebdavPresetId.jianguoyun,
    this.s3Endpoint = 'https://s3.amazonaws.com',
    this.s3Region = 'auto',
    this.s3Bucket = '',
    this.s3AccessKey = '',
    this.s3SecretKey = '',
    this.s3Prefix = 'arcvault/',
    this.syncMediaAssets = true,
    this.compressImagesToWebp = true,
    this.monthlyTrafficUsedBytes = 0,
    this.monthlyTrafficMonth = '',
    this.monthlyTrafficLimitMb = 1024,
    this.lastSyncedAt,
  });

  final bool enabled;
  final SyncMode mode;
  final String deviceId;
  final String deviceName;
  final String e2eePassphrase;
  final int lanPort;
  final String lanPeerUrl;
  final String lanPin;
  final String webdavUrl;
  final String webdavUsername;
  final String webdavPassword;
  final String webdavBasePath;
  final WebdavPresetId webdavPreset;
  final String s3Endpoint;
  final String s3Region;
  final String s3Bucket;
  final String s3AccessKey;
  final String s3SecretKey;
  final String s3Prefix;
  final bool syncMediaAssets;
  final bool compressImagesToWebp;
  final int monthlyTrafficUsedBytes;
  final String monthlyTrafficMonth;
  final int monthlyTrafficLimitMb;
  final String? lastSyncedAt;

  SyncSettingsModel copyWith({
    bool? enabled,
    SyncMode? mode,
    String? deviceId,
    String? deviceName,
    String? e2eePassphrase,
    int? lanPort,
    String? lanPeerUrl,
    String? lanPin,
    String? webdavUrl,
    String? webdavUsername,
    String? webdavPassword,
    String? webdavBasePath,
    WebdavPresetId? webdavPreset,
    String? s3Endpoint,
    String? s3Region,
    String? s3Bucket,
    String? s3AccessKey,
    String? s3SecretKey,
    String? s3Prefix,
    bool? syncMediaAssets,
    bool? compressImagesToWebp,
    int? monthlyTrafficUsedBytes,
    String? monthlyTrafficMonth,
    int? monthlyTrafficLimitMb,
    String? lastSyncedAt,
  }) {
    return SyncSettingsModel(
      enabled: enabled ?? this.enabled,
      mode: mode ?? this.mode,
      deviceId: deviceId ?? this.deviceId,
      deviceName: deviceName ?? this.deviceName,
      e2eePassphrase: e2eePassphrase ?? this.e2eePassphrase,
      lanPort: lanPort ?? this.lanPort,
      lanPeerUrl: lanPeerUrl ?? this.lanPeerUrl,
      lanPin: lanPin ?? this.lanPin,
      webdavUrl: webdavUrl ?? this.webdavUrl,
      webdavUsername: webdavUsername ?? this.webdavUsername,
      webdavPassword: webdavPassword ?? this.webdavPassword,
      webdavBasePath: webdavBasePath ?? this.webdavBasePath,
      webdavPreset: webdavPreset ?? this.webdavPreset,
      s3Endpoint: s3Endpoint ?? this.s3Endpoint,
      s3Region: s3Region ?? this.s3Region,
      s3Bucket: s3Bucket ?? this.s3Bucket,
      s3AccessKey: s3AccessKey ?? this.s3AccessKey,
      s3SecretKey: s3SecretKey ?? this.s3SecretKey,
      s3Prefix: s3Prefix ?? this.s3Prefix,
      syncMediaAssets: syncMediaAssets ?? this.syncMediaAssets,
      compressImagesToWebp: compressImagesToWebp ?? this.compressImagesToWebp,
      monthlyTrafficUsedBytes: monthlyTrafficUsedBytes ?? this.monthlyTrafficUsedBytes,
      monthlyTrafficMonth: monthlyTrafficMonth ?? this.monthlyTrafficMonth,
      monthlyTrafficLimitMb: monthlyTrafficLimitMb ?? this.monthlyTrafficLimitMb,
      lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
    );
  }

  Map<String, dynamic> toJson() => {
        'enabled': enabled,
        'mode': mode.wire,
        'deviceId': deviceId,
        'deviceName': deviceName,
        'e2eePassphrase': e2eePassphrase,
        'lanPort': lanPort,
        'lanPeerUrl': lanPeerUrl,
        'lanPin': lanPin,
        'webdavUrl': webdavUrl,
        'webdavUsername': webdavUsername,
        'webdavPassword': webdavPassword,
        'webdavBasePath': webdavBasePath,
        'webdavPreset': webdavPreset.wire,
        's3Endpoint': s3Endpoint,
        's3Region': s3Region,
        's3Bucket': s3Bucket,
        's3AccessKey': s3AccessKey,
        's3SecretKey': s3SecretKey,
        's3Prefix': s3Prefix,
        'syncMediaAssets': syncMediaAssets,
        'compressImagesToWebp': compressImagesToWebp,
        'monthlyTrafficUsedBytes': monthlyTrafficUsedBytes,
        'monthlyTrafficMonth': monthlyTrafficMonth,
        'monthlyTrafficLimitMb': monthlyTrafficLimitMb,
        if (lastSyncedAt != null) 'lastSyncedAt': lastSyncedAt,
      };

  factory SyncSettingsModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const SyncSettingsModel();
    return SyncSettingsModel(
      enabled: json['enabled'] == true,
      mode: SyncMode.fromWire(json['mode'] as String?),
      deviceId: json['deviceId']?.toString() ?? 'dev_mobile_primary',
      deviceName: json['deviceName']?.toString() ?? '我的穹档移动端',
      e2eePassphrase: json['e2eePassphrase']?.toString() ?? '',
      lanPort: ((json['lanPort'] as num?)?.toInt() ?? 47820).clamp(1024, 65535),
      lanPeerUrl: json['lanPeerUrl']?.toString() ?? '',
      lanPin: json['lanPin']?.toString() ?? '264780',
      webdavUrl: json['webdavUrl']?.toString() ?? '',
      webdavUsername: json['webdavUsername']?.toString() ?? '',
      webdavPassword: json['webdavPassword']?.toString() ?? '',
      webdavBasePath: json['webdavBasePath']?.toString() ?? '/ArcVault',
      webdavPreset: WebdavPresetId.fromWire(json['webdavPreset'] as String?),
      s3Endpoint: json['s3Endpoint']?.toString() ?? 'https://s3.amazonaws.com',
      s3Region: json['s3Region']?.toString() ?? 'auto',
      s3Bucket: json['s3Bucket']?.toString() ?? '',
      s3AccessKey: json['s3AccessKey']?.toString() ?? '',
      s3SecretKey: json['s3SecretKey']?.toString() ?? '',
      s3Prefix: json['s3Prefix']?.toString() ?? 'arcvault/',
      syncMediaAssets: json['syncMediaAssets'] != false,
      compressImagesToWebp: json['compressImagesToWebp'] != false,
      monthlyTrafficUsedBytes: (json['monthlyTrafficUsedBytes'] as num?)?.toInt() ?? 0,
      monthlyTrafficMonth: json['monthlyTrafficMonth']?.toString() ?? '',
      monthlyTrafficLimitMb: (json['monthlyTrafficLimitMb'] as num?)?.toInt() ?? 1024,
      lastSyncedAt: json['lastSyncedAt'] as String?,
    );
  }
}

class PhrasebankSettingsModel {
  const PhrasebankSettingsModel({
    this.enabled = true,
    this.dismissed = false,
    this.preferPhrasebankForAi = true,
    this.scope = 'all-spaces',
    this.visibleIcons = const [
      'smart',
      'sections',
      'context',
      'lookup',
      'reference',
      'favorites',
      'placeholders',
      'skeleton',
    ],
    this.collapsed = true,
    this.capsuleNormX,
    this.capsuleNormY,
  });

  final bool enabled;
  final bool dismissed;
  final bool preferPhrasebankForAi;
  final String scope; // 'paper-only' | 'all-spaces'
  final List<String> visibleIcons;
  final bool collapsed;
  final double? capsuleNormX;
  final double? capsuleNormY;

  PhrasebankSettingsModel copyWith({
    bool? enabled,
    bool? dismissed,
    bool? preferPhrasebankForAi,
    String? scope,
    List<String>? visibleIcons,
    bool? collapsed,
    double? capsuleNormX,
    double? capsuleNormY,
  }) =>
      PhrasebankSettingsModel(
        enabled: enabled ?? this.enabled,
        dismissed: dismissed ?? this.dismissed,
        preferPhrasebankForAi: preferPhrasebankForAi ?? this.preferPhrasebankForAi,
        scope: scope ?? this.scope,
        visibleIcons: visibleIcons ?? this.visibleIcons,
        collapsed: collapsed ?? this.collapsed,
        capsuleNormX: capsuleNormX ?? this.capsuleNormX,
        capsuleNormY: capsuleNormY ?? this.capsuleNormY,
      );

  Map<String, dynamic> toJson() => {
        'enabled': enabled,
        'dismissed': dismissed,
        'preferPhrasebankForAi': preferPhrasebankForAi,
        'scope': scope,
        'visibleIcons': visibleIcons,
        'collapsed': collapsed,
        if (capsuleNormX != null && capsuleNormY != null)
          'position': {'x': capsuleNormX, 'y': capsuleNormY},
      };

  factory PhrasebankSettingsModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const PhrasebankSettingsModel();
    final pos = json['position'];
    return PhrasebankSettingsModel(
      enabled: json['enabled'] != false,
      dismissed: json['dismissed'] == true,
      preferPhrasebankForAi: json['preferPhrasebankForAi'] != false,
      scope: json['scope']?.toString() ?? 'all-spaces',
      visibleIcons: (json['visibleIcons'] as List<dynamic>?)?.map((e) => e.toString()).toList() ??
          const [
            'smart',
            'sections',
            'context',
            'lookup',
            'reference',
            'favorites',
            'placeholders',
            'skeleton',
          ],
      collapsed: json['collapsed'] != false,
      capsuleNormX: pos is Map ? (pos['x'] as num?)?.toDouble() : null,
      capsuleNormY: pos is Map ? (pos['y'] as num?)?.toDouble() : null,
    );
  }
}

class AiSkillModel {
  const AiSkillModel({
    required this.id,
    required this.slug,
    required this.name,
    required this.description,
    required this.category,
    required this.language,
    required this.instructions,
    required this.enabled,
    required this.source,
    this.origin,
    this.tags = const [],
  });

  final String id;
  final String slug;
  final String name;
  final String description;
  final String category; // 'de-ai' | 'academic' | 'rebuttal' | 'formatting' | 'custom'
  final String language; // 'zh-en' | 'zh' | 'en'
  final String instructions;
  final bool enabled;
  final String source; // 'builtin' | 'imported' | 'custom'
  final String? origin;
  final List<String> tags;

  AiSkillModel copyWith({bool? enabled, String? instructions}) => AiSkillModel(
        id: id,
        slug: slug,
        name: name,
        description: description,
        category: category,
        language: language,
        instructions: instructions ?? this.instructions,
        enabled: enabled ?? this.enabled,
        source: source,
        origin: origin,
        tags: tags,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'slug': slug,
        'name': name,
        'description': description,
        'category': category,
        'language': language,
        'instructions': instructions,
        'enabled': enabled,
        'source': source,
        if (origin != null) 'origin': origin,
        'tags': tags,
      };

  factory AiSkillModel.fromJson(Map<String, dynamic> json) => AiSkillModel(
        id: json['id']?.toString() ?? '',
        slug: json['slug']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        description: json['description']?.toString() ?? '',
        category: json['category']?.toString() ?? 'custom',
        language: json['language']?.toString() ?? 'zh-en',
        instructions: json['instructions']?.toString() ?? '',
        enabled: json['enabled'] == true,
        source: json['source']?.toString() ?? 'custom',
        origin: json['origin'] as String?,
        tags: (json['tags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      );
}

class AppSettingsModel {
  const AppSettingsModel({
    this.theme = MobileThemeId.light,
    this.locale = LocaleId.zhCN,
    this.commentColor = '#2563eb',
    this.revisionColor = '#dc2626',
    this.defaultBackupFormat = BackupFormat.both,
    this.autoBackup = const AutoBackupPolicyModel(),
    this.aiProvider = 'offline-smart',
    this.aiEndpoint = 'http://localhost:11434/v1',
    this.aiModel = 'qwen2.5:14b',
    this.aiApiKey = '',
    this.skills = const [],
    this.phrasebank = const PhrasebankSettingsModel(),
    this.typography = const TypographySettingsModel(),
    this.monet = const MonetSettingsModel(),
    this.haptics = const HapticsSettingsModel(),
    this.scrollScrubber = const ScrollScrubberSettingsModel(),
    this.quickBarWidthFraction = 1.0,
    this.sync = const SyncSettingsModel(),
    this.biometricEnabled = false,
    this.customVaultDir = '',
    this.customBackupDir = '',
  });

  final MobileThemeId theme;
  final LocaleId locale;
  final String commentColor;
  final String revisionColor;
  final BackupFormat defaultBackupFormat;
  final AutoBackupPolicyModel autoBackup;
  final String aiProvider; // 'offline-smart' | 'openai-compatible' | 'ollama'
  final String aiEndpoint;
  final String aiModel;
  final String aiApiKey;
  final List<AiSkillModel> skills;
  final PhrasebankSettingsModel phrasebank;
  final TypographySettingsModel typography;
  final MonetSettingsModel monet;
  final HapticsSettingsModel haptics;
  final ScrollScrubberSettingsModel scrollScrubber;
  final double quickBarWidthFraction;
  final SyncSettingsModel sync;
  final bool biometricEnabled;
  final String customVaultDir;
  final String customBackupDir;

  AppSettingsModel copyWith({
    MobileThemeId? theme,
    LocaleId? locale,
    String? commentColor,
    String? revisionColor,
    BackupFormat? defaultBackupFormat,
    AutoBackupPolicyModel? autoBackup,
    String? aiProvider,
    String? aiEndpoint,
    String? aiModel,
    String? aiApiKey,
    List<AiSkillModel>? skills,
    PhrasebankSettingsModel? phrasebank,
    TypographySettingsModel? typography,
    MonetSettingsModel? monet,
    HapticsSettingsModel? haptics,
    ScrollScrubberSettingsModel? scrollScrubber,
    double? quickBarWidthFraction,
    SyncSettingsModel? sync,
    bool? biometricEnabled,
    String? customVaultDir,
    String? customBackupDir,
  }) {
    return AppSettingsModel(
      theme: theme ?? this.theme,
      locale: locale ?? this.locale,
      commentColor: commentColor ?? this.commentColor,
      revisionColor: revisionColor ?? this.revisionColor,
      defaultBackupFormat: defaultBackupFormat ?? this.defaultBackupFormat,
      autoBackup: autoBackup ?? this.autoBackup,
      aiProvider: aiProvider ?? this.aiProvider,
      aiEndpoint: aiEndpoint ?? this.aiEndpoint,
      aiModel: aiModel ?? this.aiModel,
      aiApiKey: aiApiKey ?? this.aiApiKey,
      skills: skills ?? this.skills,
      phrasebank: phrasebank ?? this.phrasebank,
      typography: typography ?? this.typography,
      monet: monet ?? this.monet,
      haptics: haptics ?? this.haptics,
      scrollScrubber: scrollScrubber ?? this.scrollScrubber,
      quickBarWidthFraction: (quickBarWidthFraction ?? this.quickBarWidthFraction).clamp(0.55, 1.0),
      sync: sync ?? this.sync,
      biometricEnabled: biometricEnabled ?? this.biometricEnabled,
      customVaultDir: customVaultDir ?? this.customVaultDir,
      customBackupDir: customBackupDir ?? this.customBackupDir,
    );
  }

  Map<String, dynamic> toJson() => {
        'theme': theme.wire,
        'locale': locale.wire,
        'commentColor': commentColor,
        'revisionColor': revisionColor,
        'defaultBackupFormat': defaultBackupFormat.wire,
        'autoBackup': autoBackup.toJson(),
        'aiProvider': aiProvider,
        'aiEndpoint': aiEndpoint,
        'aiModel': aiModel,
        'aiApiKey': aiApiKey,
        'skills': skills.map((s) => s.toJson()).toList(),
        'phrasebank': phrasebank.toJson(),
        'typography': typography.toJson(),
        'monet': monet.toJson(),
        'haptics': haptics.toJson(),
        'scrollScrubber': scrollScrubber.toJson(),
        'quickBarWidthFraction': quickBarWidthFraction,
        'sync': sync.toJson(),
        'biometricEnabled': biometricEnabled,
        'customVaultDir': customVaultDir,
        'customBackupDir': customBackupDir,
      };

  factory AppSettingsModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const AppSettingsModel();
    return AppSettingsModel(
      theme: MobileThemeId.fromWire(json['theme'] as String?),
      locale: LocaleId.fromWire(json['locale'] as String?),
      commentColor: json['commentColor']?.toString() ?? '#2563eb',
      revisionColor: json['revisionColor']?.toString() ?? '#dc2626',
      defaultBackupFormat: BackupFormat.fromWire(json['defaultBackupFormat'] as String?),
      autoBackup: AutoBackupPolicyModel.fromJson(
        json['autoBackup'] is Map ? Map<String, dynamic>.from(json['autoBackup'] as Map) : null,
      ),
      aiProvider: json['aiProvider']?.toString() ?? 'offline-smart',
      aiEndpoint: json['aiEndpoint']?.toString() ?? 'http://localhost:11434/v1',
      aiModel: json['aiModel']?.toString() ?? 'qwen2.5:14b',
      aiApiKey: json['aiApiKey']?.toString() ?? '',
      skills: (json['skills'] as List<dynamic>?)
              ?.map((e) => AiSkillModel.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList() ??
          const [],
      phrasebank: PhrasebankSettingsModel.fromJson(
        json['phrasebank'] is Map ? Map<String, dynamic>.from(json['phrasebank'] as Map) : null,
      ),
      typography: TypographySettingsModel.fromJson(
        json['typography'] is Map ? Map<String, dynamic>.from(json['typography'] as Map) : null,
      ),
      monet: MonetSettingsModel.fromJson(
        json['monet'] is Map ? Map<String, dynamic>.from(json['monet'] as Map) : null,
      ),
      haptics: HapticsSettingsModel.fromJson(
        json['haptics'] is Map ? Map<String, dynamic>.from(json['haptics'] as Map) : null,
      ),
      scrollScrubber: ScrollScrubberSettingsModel.fromJson(
        json['scrollScrubber'] is Map
            ? Map<String, dynamic>.from(json['scrollScrubber'] as Map)
            : null,
      ),
      quickBarWidthFraction:
          (json['quickBarWidthFraction'] as num?)?.toDouble().clamp(0.55, 1.0) ?? 1.0,
      sync: SyncSettingsModel.fromJson(
        json['sync'] is Map ? Map<String, dynamic>.from(json['sync'] as Map) : null,
      ),
      biometricEnabled: json['biometricEnabled'] == true,
      customVaultDir: json['customVaultDir']?.toString() ?? '',
      customBackupDir: json['customBackupDir']?.toString() ?? '',
    );
  }
}

class PersistedWorkspaceState {
  const PersistedWorkspaceState({
    this.version = 1,
    required this.savedAt,
    required this.activeSpaceId,
    this.activeDocId,
    required this.documents,
    required this.branches,
    required this.snapshots,
    required this.darlings,
    required this.motivations,
    required this.linkedAssets,
    required this.writingActivity,
    required this.casObjects,
  });

  final int version;
  final String savedAt;
  final String activeSpaceId;
  final String? activeDocId;
  final List<ArchiveDocument> documents;
  final List<Branch> branches;
  final List<Snapshot> snapshots;
  final List<DeletedDarling> darlings;
  final List<MotivationAttachment> motivations;
  final List<LinkedAsset> linkedAssets;
  final List<WritingActivityDay> writingActivity;
  final Map<String, String> casObjects;

  String toRawJson() => jsonEncode({
        'version': version,
        'savedAt': savedAt,
        'activeSpaceId': activeSpaceId,
        'activeDocId': activeDocId,
        'documents': documents.map((d) => d.toJson()).toList(),
        'branches': branches.map((b) => b.toJson()).toList(),
        'snapshots': snapshots.map((s) => s.toJson()).toList(),
        'darlings': darlings.map((d) => d.toJson()).toList(),
        'motivations': motivations.map((m) => m.toJson()).toList(),
        'linkedAssets': linkedAssets.map((a) => a.toJson()).toList(),
        'writingActivity': writingActivity.map((w) => w.toJson()).toList(),
        'casObjects': casObjects,
      });

  static PersistedWorkspaceState? tryParse(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    try {
      final map = jsonDecode(raw);
      if (map is! Map<String, dynamic>) return null;
      if (map['documents'] is! List) return null;
      final casRaw = map['casObjects'];
      final cas = <String, String>{};
      if (casRaw is Map) {
        casRaw.forEach((k, v) => cas[k.toString()] = v.toString());
      }
      return PersistedWorkspaceState(
        version: (map['version'] as num?)?.toInt() ?? 1,
        savedAt: map['savedAt']?.toString() ?? DateTime.now().toIso8601String(),
        activeSpaceId: map['activeSpaceId']?.toString() ?? 'sp_paper',
        activeDocId: map['activeDocId'] as String?,
        documents: (map['documents'] as List<dynamic>)
            .map((e) => ArchiveDocument.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
        branches: (map['branches'] as List<dynamic>?)
                ?.map((e) => Branch.fromJson(Map<String, dynamic>.from(e as Map)))
                .toList() ??
            const [],
        snapshots: (map['snapshots'] as List<dynamic>?)
                ?.map((e) => Snapshot.fromJson(Map<String, dynamic>.from(e as Map)))
                .toList() ??
            const [],
        darlings: (map['darlings'] as List<dynamic>?)
                ?.map((e) => DeletedDarling.fromJson(Map<String, dynamic>.from(e as Map)))
                .toList() ??
            const [],
        motivations: (map['motivations'] as List<dynamic>?)
                ?.map((e) => MotivationAttachment.fromJson(Map<String, dynamic>.from(e as Map)))
                .toList() ??
            const [],
        linkedAssets: (map['linkedAssets'] as List<dynamic>?)
                ?.map((e) => LinkedAsset.fromJson(Map<String, dynamic>.from(e as Map)))
                .toList() ??
            const [],
        writingActivity: (map['writingActivity'] as List<dynamic>?)
                ?.map((e) => WritingActivityDay.fromJson(Map<String, dynamic>.from(e as Map)))
                .toList() ??
            const [],
        casObjects: cas,
      );
    } catch (_) {
      return null;
    }
  }
}
