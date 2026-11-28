import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';
import 'package:uuid/uuid.dart';

import '../core/academic_engines.dart';
import '../core/cas_store.dart';
import '../core/command_history.dart';
import '../core/demo_seed.dart';
import '../core/diff_engine.dart';
import '../core/haptics_service.dart';
import '../core/office_parser.dart';
import '../core/ooxml_engine.dart';
import '../core/tutorial_flow.dart';
import '../core/vault_crypto.dart';
import '../core/workspace_storage.dart';
import '../models/archive_models.dart';
import '../theme/arc_theme.dart';

class AppController extends ChangeNotifier {
  AppController() {
    _spaces = DemoSeed.defaultSpaces;
    _init();
  }

  static const _shareChannel = MethodChannel('com.arcvault.mobile/share_intake');

  late final List<Space> _spaces;
  CasObjectStore _cas = CasObjectStore();
  final CommandHistory _history = CommandHistory();
  final List<ArchiveDocument> _documents = [];
  final List<Branch> _branches = [];
  final List<Snapshot> _snapshots = [];
  final List<DeletedDarling> _darlings = [];
  final List<MotivationAttachment> _motivations = [];
  final List<LinkedAsset> _linkedAssets = [];
  final List<WritingActivityDay> _writingActivity = [];
  final List<SyncConflictItem> _syncConflicts = [];
  final List<SyncOpLogEntry> _syncOplog = [];

  AppSettingsModel _settings = const AppSettingsModel();
  String _activeSpaceId = 'sp_paper';
  String? _activeDocId;
  bool _splitPreview = false;
  bool _vaultUnlocked = true;
  String? _vaultPasscode;
  String? _vaultPassHash;

  String _resolvedVaultDir = '';
  String _resolvedBackupDir = '';
  String? _lastBackupAt;
  bool _ready = false;
  String? _toastMessage;
  Timer? _toastTimer;
  Timer? _autosaveTimer;

  TutorialMode? _tutorialMode;
  final TutorialTargetRegistry tourTargets = TutorialTargetRegistry();
  String? _selectedAnnotationId;
  int? _locateOffset;
  int _locateNonce = 0;
  final Map<String, EditorFormat> _dirtyFormatSource = {};
  Timer? _formatSyncTimer;
  String? _pendingShareTitle;
  String? _pendingShareText;

  // Getters
  bool get isReady => _ready;
  List<Space> get spaces => _spaces;
  AppSettingsModel get settings => _settings;
  ArcThemeTokens get themeTokens => ArcThemeTokens.fromSettings(_settings);
  String get activeSpaceId => _activeSpaceId;
  Space get activeSpace =>
      _spaces.firstWhere((s) => s.id == _activeSpaceId, orElse: () => _spaces.first);
  List<ArchiveDocument> get allDocuments => List.unmodifiable(_documents);
  List<ArchiveDocument> get activeSpaceDocuments => _documents
      .where((d) => !d.isTrashed && d.spaceId == _activeSpaceId)
      .toList();
  List<ArchiveDocument> get trashedDocuments =>
      _documents.where((d) => d.isTrashed).toList();
  ArchiveDocument? get activeDoc {
    if (_activeDocId == null) return null;
    for (final d in _documents) {
      if (d.id == _activeDocId && !d.isTrashed) return d;
    }
    return null;
  }

  List<Branch> branchesForDoc(String docId) =>
      _branches.where((b) => b.documentId == docId).toList();
  List<Snapshot> snapshotsForDoc(String docId) =>
      _snapshots.where((s) => s.documentId == docId).toList();
  List<DeletedDarling> darlingsForDoc(String docId) =>
      _darlings.where((d) => d.documentId == docId).toList();
  List<MotivationAttachment> motivationsForDoc(String docId) =>
      _motivations.where((m) => m.documentId == docId).toList();
  List<LinkedAsset> assetsForDoc(String docId) =>
      _linkedAssets.where((a) => a.documentId == docId).toList();
  List<WritingActivityDay> get writingActivity => List.unmodifiable(_writingActivity);
  List<SyncConflictItem> get syncConflicts => List.unmodifiable(_syncConflicts);
  List<SyncOpLogEntry> get syncOplog => List.unmodifiable(_syncOplog);

  CasObjectStore get cas => _cas;
  bool get splitPreview => _splitPreview;
  bool get vaultUnlocked => _vaultUnlocked;
  bool get hasVaultPasscode => _vaultPassHash != null;
  String get resolvedVaultDir => _resolvedVaultDir;
  String get resolvedBackupDir => _resolvedBackupDir;
  String? get lastBackupAt => _lastBackupAt;
  String? get toastMessage => _toastMessage;
  TutorialMode? get tutorialMode => _tutorialMode;
  String? get selectedAnnotationId => _selectedAnnotationId;
  int? get locateOffset => _locateOffset;
  int get locateNonce => _locateNonce;
  String? get pendingShareTitle => _pendingShareTitle;
  String? get pendingShareText => _pendingShareText;

  bool get canUndo => _history.canUndo;
  bool get canRedo => _history.canRedo;
  String? get undoLabel => _history.undoLabel;
  String? get redoLabel => _history.redoLabel;

  AiPrivacyPolicy get effectiveAiPolicy {
    final doc = activeDoc;
    return AiGateway.resolveEffectivePolicy(
      activeSpace.aiPolicy,
      docOverride: doc?.aiPolicyOverride,
      isVaultSpace: activeSpace.kind == SpaceKind.vault,
    );
  }

  Future<void> _init() async {
    _settings = await WorkspaceStorage.loadSettings();
    final mergedSkills = SkillRegistry.resolveMerged(_settings.skills);
    _settings = _settings.copyWith(skills: mergedSkills);

    await _refreshStoragePaths();

    final restored = await WorkspaceStorage.loadWorkspaceBackup(_settings);
    if (restored != null && restored.documents.isNotEmpty) {
      _cas = CasObjectStore(restored.casObjects);
      _documents
        ..clear()
        ..addAll(restored.documents);
      _branches
        ..clear()
        ..addAll(restored.branches);
      _snapshots
        ..clear()
        ..addAll(restored.snapshots);
      _darlings
        ..clear()
        ..addAll(restored.darlings);
      _motivations
        ..clear()
        ..addAll(restored.motivations);
      _linkedAssets
        ..clear()
        ..addAll(restored.linkedAssets);
      _writingActivity
        ..clear()
        ..addAll(restored.writingActivity);
      _activeSpaceId = restored.activeSpaceId;
      _activeDocId = restored.activeDocId;
      _lastBackupAt = restored.savedAt;
    } else {
      final seeded = DemoSeed.createInitialWorkspace();
      _cas = seeded.cas;
      _documents.addAll(seeded.documents);
      _branches.addAll(seeded.branches);
      _snapshots.addAll(seeded.snapshots);
      _darlings.addAll(seeded.darlings);
      _motivations.addAll(seeded.motivations);
      _linkedAssets.addAll(seeded.linkedAssets);
      _writingActivity.addAll(seeded.writingActivity);
      _activeDocId = seeded.documents.first.id;
    }

    final done = await WorkspaceStorage.hasCompletedOnboarding();
    _tutorialMode = done ? null : TutorialMode.firstRun;

    _setupShareListener();
    _ready = true;
    notifyListeners();
  }

  Future<void> _refreshStoragePaths() async {
    try {
      final paths = await WorkspaceStorage.resolveEffectivePaths(_settings);
      await WorkspaceStorage.ensureDirectories(paths);
      _resolvedVaultDir = paths.vaultDir;
      _resolvedBackupDir = paths.backupDir;
    } catch (_) {
      _resolvedVaultDir = 'App Sandbox / ArcVault_Vault';
      _resolvedBackupDir = 'App Sandbox / ArcVault_Backups';
    }
  }

  void _setupShareListener() {
    _shareChannel.setMethodCallHandler((call) async {
      if (call.method == 'onShareReceived' && call.arguments is Map) {
        final args = Map<String, dynamic>.from(call.arguments as Map);
        _pendingShareTitle = args['title']?.toString();
        _pendingShareText = args['text']?.toString();
        notifyListeners();
      }
    });
    _shareChannel.invokeMapMethod<String, dynamic>('consumeInitialShare').then((payload) {
      if (payload != null) {
        _pendingShareTitle = payload['title']?.toString();
        _pendingShareText = payload['text']?.toString();
        notifyListeners();
      }
    }).catchError((_) {});
  }

  void clearPendingShare() {
    _pendingShareTitle = null;
    _pendingShareText = null;
    notifyListeners();
  }

  void triggerHaptic(HapticPattern pattern) {
    HapticsService.trigger(pattern, _settings.haptics);
  }

  void showToast(String msg) {
    _toastMessage = msg;
    _toastTimer?.cancel();
    _toastTimer = Timer(const Duration(seconds: 3), () {
      _toastMessage = null;
      notifyListeners();
    });
    notifyListeners();
  }

  Future<void> updateSettings(AppSettingsModel next) async {
    _settings = next;
    await WorkspaceStorage.saveSettings(next);
    await _refreshStoragePaths();
    notifyListeners();
  }

  Future<void> setCustomDirectories({String? vaultDir, String? backupDir}) async {
    final next = _settings.copyWith(
      customVaultDir: vaultDir ?? _settings.customVaultDir,
      customBackupDir: backupDir ?? _settings.customBackupDir,
    );
    await updateSettings(next);
    await runManualBackup();
    showToast(_settings.locale.isZh ? '已更新缓存与备份目录' : 'Updated vault & backup directories');
  }

  Future<void> pickCustomDirectory({required bool forBackup}) async {
    final picked = await FilePicker.platform.getDirectoryPath();
    if (picked == null || picked.isEmpty) return;
    if (forBackup) {
      await setCustomDirectories(backupDir: picked);
    } else {
      await setCustomDirectories(vaultDir: picked);
    }
  }

  Future<String?> pickLocalModelFile() async {
    final res = await FilePicker.platform.pickFiles(type: FileType.any);
    if (res == null || res.files.isEmpty) return null;
    final file = res.files.first;
    final path = (file.path ?? '').trim().isNotEmpty ? file.path!.trim() : file.name.trim();
    if (path.isEmpty) return null;
    final fileName = file.name.trim();
    final shouldFillModel = _settings.aiModel.trim().isEmpty || _settings.aiModel == 'local-model';
    await updateSettings(_settings.copyWith(
      aiLocalModelPath: path,
      aiModel: shouldFillModel && fileName.isNotEmpty ? fileName : _settings.aiModel,
    ));
    showToast(_settings.locale.isZh ? '已设置本地模型路径' : 'Local model path updated');
    return path;
  }

  Future<String?> pickLocalModelDirectory() async {
    final picked = await FilePicker.platform.getDirectoryPath();
    if (picked == null || picked.trim().isEmpty) return null;
    final path = picked.trim();
    await updateSettings(_settings.copyWith(aiLocalModelPath: path));
    showToast(_settings.locale.isZh ? '已设置本地模型目录' : 'Local model directory updated');
    return path;
  }

  void selectSpace(String spaceId) {
    _activeSpaceId = spaceId;
    final docs = activeSpaceDocuments;
    if (docs.isNotEmpty && !docs.any((d) => d.id == _activeDocId)) {
      _activeDocId = docs.first.id;
    } else if (docs.isEmpty) {
      _activeDocId = null;
    }
    _history.clear();
    _selectedAnnotationId = null;
    triggerHaptic(HapticPattern.selection);
    notifyListeners();
  }

  void selectDocument(String docId) {
    _activeDocId = docId;
    _history.clear();
    _selectedAnnotationId = null;
    triggerHaptic(HapticPattern.selection);
    notifyListeners();
  }

  void selectAnnotation(String? id) {
    _selectedAnnotationId = id;
    notifyListeners();
  }

  void locateAnnotation(AnnotationItem ann) {
    _selectedAnnotationId = ann.id;
    _locateOffset = ann.anchorStart;
    _locateNonce++;
    notifyListeners();
  }

  ArchiveDocument _syncDocFormatsIfDirty(ArchiveDocument doc) {
    final sourceFmt = _dirtyFormatSource.remove(doc.id);
    if (sourceFmt == null) return doc;
    if (sourceFmt == EditorFormat.markdown) {
      final nextTex = OoxmlEngine.markdownToLatex(doc.markdownText);
      return nextTex == doc.latexText ? doc : doc.copyWith(latexText: nextTex);
    }
    final nextMd = OoxmlEngine.latexToMarkdown(doc.latexText);
    return nextMd == doc.markdownText ? doc : doc.copyWith(markdownText: nextMd);
  }

  void _flushDirtyFormatSyncs({bool notify = true}) {
    _formatSyncTimer?.cancel();
    _formatSyncTimer = null;
    if (_dirtyFormatSource.isEmpty) return;
    var changed = false;
    for (var i = 0; i < _documents.length; i++) {
      final d = _documents[i];
      if (_dirtyFormatSource.containsKey(d.id)) {
        final synced = _syncDocFormatsIfDirty(d);
        if (!identical(synced, d)) {
          _documents[i] = synced;
          changed = true;
        }
      }
    }
    if (changed && notify) {
      notifyListeners();
    }
  }

  void _scheduleDeferredFormatSync(String docId, EditorFormat sourceFmt) {
    _dirtyFormatSource[docId] = sourceFmt;
    _formatSyncTimer?.cancel();
    final delayMs = (_splitPreview && sourceFmt == EditorFormat.latex) ? 350 : 1200;
    _formatSyncTimer = Timer(Duration(milliseconds: delayMs), () {
      _flushDirtyFormatSyncs();
    });
  }

  void toggleSplitPreview() {
    _splitPreview = !_splitPreview;
    if (_splitPreview && activeDoc != null && _dirtyFormatSource.containsKey(activeDoc!.id)) {
      _flushDirtyFormatSyncs(notify: false);
    }
    triggerHaptic(HapticPattern.selection);
    notifyListeners();
  }

  void toggleActiveFormat() {
    final doc = activeDoc;
    if (doc == null) return;
    _history.breakMergeChain();
    final synced = _syncDocFormatsIfDirty(doc);
    final nextFmt =
        synced.activeFormat == EditorFormat.markdown ? EditorFormat.latex : EditorFormat.markdown;
    final syncedText = OoxmlEngine.syncFormatText(synced.activeText, synced.activeFormat, nextFmt);
    final updated = synced.copyWith(
      activeFormat: nextFmt,
      markdownText: nextFmt == EditorFormat.markdown ? syncedText : synced.markdownText,
      latexText: nextFmt == EditorFormat.latex ? syncedText : synced.latexText,
      updatedAt: DateTime.now().toIso8601String(),
    );
    _replaceDocument(updated);
    triggerHaptic(HapticPattern.selection);
  }

  void updateActiveDocumentText(String nextText, {String historyLabel = '正文编辑'}) {
    final doc = activeDoc;
    if (doc == null || doc.isSealed) return;
    final prevText = doc.activeText;
    if (prevText == nextText) return;

    final before = DocEditableState(
      markdownText: doc.markdownText,
      latexText: doc.latexText,
      annotations: doc.annotations,
      activeFormat: doc.activeFormat,
    );

    final nextAnnotations = adjustAnchorsForTextEdit(
      annotations: doc.annotations,
      oldText: prevText,
      newText: nextText,
    );

    final nextMd = doc.activeFormat == EditorFormat.markdown ? nextText : doc.markdownText;
    final nextTex = doc.activeFormat == EditorFormat.latex ? nextText : doc.latexText;

    final after = DocEditableState(
      markdownText: nextMd,
      latexText: nextTex,
      annotations: nextAnnotations,
      activeFormat: doc.activeFormat,
    );
    _history.push(
      historyLabel,
      before,
      after,
      mergeKey: historyLabel == '正文编辑' ? 'text-edit' : null,
      mergeWindowMs: 500,
      skipClone: true,
    );

    _replaceDocument(doc.copyWith(
      markdownText: nextMd,
      latexText: nextTex,
      annotations: nextAnnotations,
      updatedAt: DateTime.now().toIso8601String(),
    ));
    _scheduleDeferredFormatSync(doc.id, doc.activeFormat);
    _scheduleAutosave();
  }

  void insertSnippet(String snippet) {
    final doc = activeDoc;
    if (doc == null || doc.isSealed) return;
    final cur = doc.activeText;
    final next = cur.endsWith('\n') || cur.isEmpty ? '$cur$snippet' : '$cur\n$snippet';
    updateActiveDocumentText(next, historyLabel: '插入学术片段');
  }

  void undo() {
    final doc = activeDoc;
    if (doc == null || doc.isSealed) return;
    _history.breakMergeChain();
    final state = _history.undo();
    if (state == null) return;
    _replaceDocument(doc.copyWith(
      markdownText: state.markdownText,
      latexText: state.latexText,
      annotations: state.annotations,
      activeFormat: state.activeFormat,
      updatedAt: DateTime.now().toIso8601String(),
    ));
    _scheduleDeferredFormatSync(doc.id, state.activeFormat);
    triggerHaptic(HapticPattern.light);
  }

  void redo() {
    final doc = activeDoc;
    if (doc == null || doc.isSealed) return;
    _history.breakMergeChain();
    final state = _history.redo();
    if (state == null) return;
    _replaceDocument(doc.copyWith(
      markdownText: state.markdownText,
      latexText: state.latexText,
      annotations: state.annotations,
      activeFormat: state.activeFormat,
      updatedAt: DateTime.now().toIso8601String(),
    ));
    _scheduleDeferredFormatSync(doc.id, state.activeFormat);
    triggerHaptic(HapticPattern.light);
  }

  void acceptRevision(String annId) => _applyRevisionAction(annId, accept: true);
  void rejectRevision(String annId) => _applyRevisionAction(annId, accept: false);

  void _applyRevisionAction(String annId, {required bool accept}) {
    final doc = activeDoc;
    if (doc == null || doc.isSealed) return;
    final ann = doc.annotations.where((a) => a.id == annId).firstOrNull;
    if (ann == null) return;

    final before = DocEditableState(
      markdownText: doc.markdownText,
      latexText: doc.latexText,
      annotations: doc.annotations,
      activeFormat: doc.activeFormat,
    );

    final replacement = accept
        ? (ann.revisionKind == RevisionKind.delete ? '' : (ann.suggestedText ?? ann.originalText))
        : (ann.revisionKind == RevisionKind.insert ? '' : ann.originalText);

    final res = applyAnnotationTextReplacement(
      text: doc.activeText,
      annotations: doc.annotations,
      targetAnnotationId: annId,
      replacement: replacement,
      nextStatus: accept ? AnnotationStatus.accepted : AnnotationStatus.rejected,
    );

    final nextMd = doc.activeFormat == EditorFormat.markdown ? res.text : doc.markdownText;
    final nextTex = doc.activeFormat == EditorFormat.latex ? res.text : doc.latexText;

    _history.push(
      accept ? '接受修订' : '拒绝修订',
      before,
      DocEditableState(
        markdownText: nextMd,
        latexText: nextTex,
        annotations: res.annotations,
        activeFormat: doc.activeFormat,
      ),
      skipClone: true,
    );

    _replaceDocument(doc.copyWith(
      markdownText: nextMd,
      latexText: nextTex,
      annotations: res.annotations,
      updatedAt: DateTime.now().toIso8601String(),
    ));
    _scheduleDeferredFormatSync(doc.id, doc.activeFormat);
    triggerHaptic(HapticPattern.success);
  }

  int batchAcceptRevisions({Set<String>? targetIds}) =>
      _applyBatchAction(BatchAnnotationAction.acceptRevisions, targetIds: targetIds);

  int batchRejectRevisions({Set<String>? targetIds}) =>
      _applyBatchAction(BatchAnnotationAction.rejectRevisions, targetIds: targetIds);

  int batchResolveComments({Set<String>? targetIds}) =>
      _applyBatchAction(BatchAnnotationAction.resolveComments, targetIds: targetIds);

  int _applyBatchAction(
    BatchAnnotationAction action, {
    Set<String>? targetIds,
  }) {
    final doc = activeDoc;
    if (doc == null || doc.isSealed) return 0;

    final res = applyBatchAnnotationAction(
      text: doc.activeText,
      annotations: doc.annotations,
      action: action,
      targetIds: targetIds,
    );
    if (res.affectedCount == 0) return 0;

    final before = DocEditableState(
      markdownText: doc.markdownText,
      latexText: doc.latexText,
      annotations: doc.annotations,
      activeFormat: doc.activeFormat,
    );

    final nextMd = doc.activeFormat == EditorFormat.markdown ? res.text : doc.markdownText;
    final nextTex = doc.activeFormat == EditorFormat.latex ? res.text : doc.latexText;

    final label = switch (action) {
      BatchAnnotationAction.acceptRevisions => '批量接受修订',
      BatchAnnotationAction.rejectRevisions => '批量拒绝修订',
      BatchAnnotationAction.resolveComments => '批量解决批注',
      BatchAnnotationAction.reopenComments => '批量重开批注',
    };

    _history.push(
      label,
      before,
      DocEditableState(
        markdownText: nextMd,
        latexText: nextTex,
        annotations: res.annotations,
        activeFormat: doc.activeFormat,
      ),
      skipClone: true,
    );

    _replaceDocument(doc.copyWith(
      markdownText: nextMd,
      latexText: nextTex,
      annotations: res.annotations,
      updatedAt: DateTime.now().toIso8601String(),
    ));
    if (action == BatchAnnotationAction.acceptRevisions ||
        action == BatchAnnotationAction.rejectRevisions) {
      _scheduleDeferredFormatSync(doc.id, doc.activeFormat);
    }
    _scheduleAutosave();
    triggerHaptic(HapticPattern.success);

    final isZh = _settings.locale.isZh;
    final msg = switch (action) {
      BatchAnnotationAction.acceptRevisions =>
        isZh ? '已批量接受 ${res.affectedCount} 条修订' : 'Accepted ${res.affectedCount} revisions',
      BatchAnnotationAction.rejectRevisions =>
        isZh ? '已批量拒绝 ${res.affectedCount} 条修订' : 'Rejected ${res.affectedCount} revisions',
      BatchAnnotationAction.resolveComments =>
        isZh ? '已批量解决 ${res.affectedCount} 条批注' : 'Resolved ${res.affectedCount} comments',
      BatchAnnotationAction.reopenComments =>
        isZh ? '已批量重开 ${res.affectedCount} 条批注' : 'Reopened ${res.affectedCount} comments',
    };
    showToast(msg);
    return res.affectedCount;
  }

  void applyAiRewriteToAnnotation(String annId, String rewrite) {
    final doc = activeDoc;
    if (doc == null || doc.isSealed) return;
    final before = DocEditableState(
      markdownText: doc.markdownText,
      latexText: doc.latexText,
      annotations: doc.annotations,
      activeFormat: doc.activeFormat,
    );
    final res = applyAnnotationTextReplacement(
      text: doc.activeText,
      annotations: doc.annotations,
      targetAnnotationId: annId,
      replacement: rewrite,
      nextStatus: AnnotationStatus.resolved,
    );
    final nextMd = doc.activeFormat == EditorFormat.markdown ? res.text : doc.markdownText;
    final nextTex = doc.activeFormat == EditorFormat.latex ? res.text : doc.latexText;
    _history.push(
      '应用 AI 改写',
      before,
      DocEditableState(
        markdownText: nextMd,
        latexText: nextTex,
        annotations: res.annotations,
        activeFormat: doc.activeFormat,
      ),
      skipClone: true,
    );
    _replaceDocument(doc.copyWith(
      markdownText: nextMd,
      latexText: nextTex,
      annotations: res.annotations,
      updatedAt: DateTime.now().toIso8601String(),
    ));
    _scheduleDeferredFormatSync(doc.id, doc.activeFormat);
    triggerHaptic(HapticPattern.success);
  }

  void toggleResolveComment(String annId) {
    final doc = activeDoc;
    if (doc == null) return;
    final nextAnns = doc.annotations
        .map((a) => a.id == annId
            ? a.copyWith(
                status: a.status == AnnotationStatus.resolved
                    ? AnnotationStatus.open
                    : AnnotationStatus.resolved,
              )
            : a)
        .toList();
    _replaceDocument(doc.copyWith(annotations: nextAnns));
    triggerHaptic(HapticPattern.selection);
  }

  void replyToComment(String annId, String text) {
    final doc = activeDoc;
    if (doc == null || text.trim().isEmpty) return;
    final nextAnns = doc.annotations.map((a) {
      if (a.id != annId) return a;
      final replies = [
        ...a.replies,
        AnnotationReply(
          id: 'rep_${const Uuid().v4().substring(0, 6)}',
          author: _settings.locale.isZh ? '我（移动端）' : 'Me (Mobile)',
          date: DateTime.now().toIso8601String(),
          text: text.trim(),
        ),
      ];
      return a.copyWith(replies: replies);
    }).toList();
    _replaceDocument(doc.copyWith(annotations: nextAnns));
    triggerHaptic(HapticPattern.light);
  }

  Future<void> saveMilestoneSnapshot({String? label, String? motivationNote}) async {
    _flushDirtyFormatSyncs(notify: false);
    final doc = activeDoc;
    if (doc == null) return;
    final docSnaps = snapshotsForDoc(doc.id).where((s) => s.branchId == doc.currentBranchId).toList();
    final latest = docSnaps.isNotEmpty ? docSnaps.last : null;
    final oldText = latest != null ? (_cas.get(latest.contentHash) ?? '') : '';

    final aiSummary = await AiGateway.generateSnapshotSummary(
      oldText: oldText,
      newText: doc.activeText,
      settings: _settings,
      policy: effectiveAiPolicy,
    );

    final res = createDocumentSnapshot(
      cas: _cas,
      doc: doc,
      latestSnapshot: latest,
      label: label?.trim().isNotEmpty == true ? label!.trim() : '里程碑 v${docSnaps.length + 1}',
      isMilestone: true,
      aiSummary: aiSummary.text,
      motivationNote: motivationNote,
    );

    if (res.snapshot != null) {
      _snapshots.add(res.snapshot!);
      final newDarlings = extractDeletedDarlings(
        documentId: doc.id,
        snapshotId: res.snapshot!.id,
        oldText: oldText,
        newText: doc.activeText,
      );
      _darlings.addAll(newDarlings);

      final bIdx = _branches.indexWhere((b) => b.id == doc.currentBranchId);
      if (bIdx >= 0) {
        _branches[bIdx] = _branches[bIdx].copyWith(headSnapshotId: res.snapshot!.id);
      }
      await runManualBackup();
      triggerHaptic(HapticPattern.success);
      showToast(_settings.locale.isZh
          ? '已保存里程碑快照「${res.snapshot!.label}」'
          : 'Saved milestone "${res.snapshot!.label}"');
    }
    notifyListeners();
  }

  void rollbackToSnapshot(Snapshot snap) {
    final doc = activeDoc;
    if (doc == null || doc.isSealed) return;
    final restoredText = _cas.get(snap.contentHash);
    if (restoredText == null) return;
    updateActiveDocumentText(restoredText, historyLabel: '回滚至 ${snap.label}');
    showToast(_settings.locale.isZh ? '已回滚至「${snap.label}」' : 'Restored "${snap.label}"');
  }

  void createBranch(String name) {
    final doc = activeDoc;
    if (doc == null || name.trim().isEmpty) return;
    final docSnaps = snapshotsForDoc(doc.id);
    final headId = docSnaps.isNotEmpty ? docSnaps.last.id : null;
    final branch = Branch(
      id: 'br_${const Uuid().v4().substring(0, 8)}',
      documentId: doc.id,
      name: name.trim(),
      isMain: false,
      createdAt: DateTime.now().toIso8601String(),
      headSnapshotId: headId,
    );
    _branches.add(branch);
    _replaceDocument(doc.copyWith(currentBranchId: branch.id));
    triggerHaptic(HapticPattern.success);
    showToast(_settings.locale.isZh ? '已切换至新分支：${branch.name}' : 'Created branch ${branch.name}');
  }

  void switchBranch(String branchId) {
    final doc = activeDoc;
    if (doc == null) return;
    final branch = _branches.where((b) => b.id == branchId).firstOrNull;
    if (branch == null) return;
    String nextMd = doc.markdownText;
    if (branch.headSnapshotId != null) {
      final head = _snapshots.where((s) => s.id == branch.headSnapshotId).firstOrNull;
      if (head != null) {
        nextMd = _cas.get(head.markdownHash) ?? nextMd;
      }
    }
    _replaceDocument(doc.copyWith(
      currentBranchId: branchId,
      markdownText: nextMd,
      latexText: OoxmlEngine.markdownToLatex(nextMd),
    ));
    triggerHaptic(HapticPattern.selection);
  }

  void toggleSealActiveDoc() {
    _flushDirtyFormatSyncs(notify: false);
    final doc = activeDoc;
    if (doc == null) return;
    if (doc.isSealed) {
      _replaceDocument(doc.copyWith(isSealed: false, clearSealedHash: true, clearSealedAt: true));
      showToast(_settings.locale.isZh ? '已解除只读封存锁定' : 'Document unsealed');
    } else {
      final hash = VaultCrypto.sha256Hex(doc.markdownText);
      _replaceDocument(doc.copyWith(
        isSealed: true,
        sealedHash: hash,
        sealedAt: DateTime.now().toIso8601String(),
      ));
      showToast(_settings.locale.isZh ? '已开启只读封存锁定（SHA-256 指纹已生成）' : 'Document sealed');
    }
    triggerHaptic(HapticPattern.medium);
  }

  void cycleActiveDocAiPolicy() {
    final doc = activeDoc;
    if (doc == null) return;
    const order = [
      AiPrivacyPolicy.cloudOrLocal,
      AiPrivacyPolicy.localOnly,
      AiPrivacyPolicy.disabled,
    ];
    final cur = effectiveAiPolicy;
    var next = order[(order.indexOf(cur) + 1) % order.length];
    if (activeSpace.kind == SpaceKind.vault && next == AiPrivacyPolicy.cloudOrLocal) {
      next = AiPrivacyPolicy.localOnly;
    }
    _replaceDocument(doc.copyWith(aiPolicyOverride: next));
    triggerHaptic(HapticPattern.selection);
  }

  void createBlankDocument() {
    final id = 'doc_${const Uuid().v4().substring(0, 8)}';
    final brId = 'br_main_$id';
    final now = DateTime.now().toIso8601String();
    final title = _settings.locale.isZh ? '未命名文档' : 'Untitled Document';
    final md = '# $title\n\n';
    final doc = ArchiveDocument(
      id: id,
      spaceId: _activeSpaceId,
      title: title,
      sourceExt: '.md',
      sourceFileName: '$title.md',
      backupFormat: _settings.defaultBackupFormat,
      activeFormat: EditorFormat.markdown,
      markdownText: md,
      latexText: OoxmlEngine.markdownToLatex(md),
      coverRule: CoverRule(documentId: id, coverEndBlockIndex: 0, remember: false, coverBlockCount: 0),
      updatedAt: now,
      createdAt: now,
      currentBranchId: brId,
    );
    _documents.insert(0, doc);
    _branches.add(Branch(id: brId, documentId: id, name: '主线', isMain: true, createdAt: now));
    _activeDocId = id;
    _scheduleAutosave();
    notifyListeners();
  }

  void importSamplePaperDocx() {
    final bytes = OoxmlEngine.buildSamplePaperDocx();
    final bundle = OoxmlEngine.parseDocxBytes(bytes);
    final extracted = OoxmlEngine.extractBodyWithCoverIndex(
      bundle,
      bundle.detectedCoverEndIndex,
      EditorFormat.markdown,
    );
    final id = 'doc_sample_${const Uuid().v4().substring(0, 6)}';
    final now = DateTime.now().toIso8601String();
    final doc = ArchiveDocument(
      id: id,
      spaceId: 'sp_paper',
      title: '硕士论文示例（含封面与导师批注）',
      sourceExt: '.docx',
      sourceFileName: '硕士论文_示例.docx',
      backupFormat: BackupFormat.both,
      activeFormat: EditorFormat.markdown,
      markdownText: extracted.text,
      latexText: OoxmlEngine.markdownToLatex(extracted.text),
      annotations: extracted.annotations,
      baseDocxBase64: base64Encode(bytes),
      coverXmlNodes: extracted.coverXmlNodes,
      coverRule: CoverRule(
        documentId: id,
        coverEndBlockIndex: bundle.detectedCoverEndIndex,
        remember: true,
        coverBlockCount: extracted.coverBlockCount,
      ),
      citationsSidecar: extracted.citationsSidecar,
      mediaAssets: extracted.mediaAssets,
      updatedAt: now,
      createdAt: now,
      currentBranchId: 'br_main_$id',
      tags: const ['示例论文'],
    );
    _documents.insert(0, doc);
    _activeSpaceId = 'sp_paper';
    _activeDocId = id;
    _scheduleAutosave();
    showToast(_settings.locale.isZh ? '已生成并导入示例论文 .docx' : 'Imported sample thesis .docx');
    notifyListeners();
  }

  Future<ParsedDocxBundle?> importFileFromPicker() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['docx', 'md', 'tex', 'txt', 'pptx', 'xlsx', 'pdf'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return null;
    final file = result.files.first;
    final bytes = file.bytes ?? (file.path != null ? await File(file.path!).readAsBytes() : null);
    if (bytes == null) return null;
    final name = file.name;
    final lower = name.toLowerCase();
    final stem = name.replaceAll(RegExp(r'\.[^.]+$'), '');
    final id = 'doc_imp_${const Uuid().v4().substring(0, 8)}';
    final now = DateTime.now().toIso8601String();

    if (lower.endsWith('.docx')) {
      final bundle = OoxmlEngine.parseDocxBytes(bytes);
      final extracted = OoxmlEngine.extractBodyWithCoverIndex(
        bundle,
        bundle.detectedCoverEndIndex,
        EditorFormat.markdown,
      );
      final doc = ArchiveDocument(
        id: id,
        spaceId: _activeSpaceId,
        title: stem,
        sourceExt: '.docx',
        sourceFileName: name,
        backupFormat: BackupFormat.both,
        activeFormat: EditorFormat.markdown,
        markdownText: extracted.text,
        latexText: OoxmlEngine.markdownToLatex(extracted.text),
        annotations: extracted.annotations,
        baseDocxBase64: base64Encode(bytes),
        coverXmlNodes: extracted.coverXmlNodes,
        coverRule: CoverRule(
          documentId: id,
          coverEndBlockIndex: bundle.detectedCoverEndIndex,
          remember: true,
          coverBlockCount: extracted.coverBlockCount,
        ),
        citationsSidecar: extracted.citationsSidecar,
        mediaAssets: extracted.mediaAssets,
        updatedAt: now,
        createdAt: now,
        currentBranchId: 'br_main_$id',
      );
      _documents.insert(0, doc);
      _activeDocId = id;
      _scheduleAutosave();
      notifyListeners();
      return bundle;
    }

    if (lower.endsWith('.pptx') || lower.endsWith('.xlsx')) {
      final preview = lower.endsWith('.pptx')
          ? OfficeParser.parsePptxBytes(bytes)
          : OfficeParser.parseXlsxBytes(bytes);
      final summaryText = preview.kind == 'pptx'
          ? preview.slides.map((s) => '# ${s.title}\n${s.bullets.join('\n')}').join('\n\n')
          : preview.sheets.map((s) => '# ${s.name}\n${s.rows.map((r) => r.join(' | ')).join('\n')}').join('\n\n');
      final doc = ArchiveDocument(
        id: id,
        spaceId: _activeSpaceId,
        title: stem,
        sourceExt: lower.endsWith('.pptx') ? '.pptx' : '.xlsx',
        sourceFileName: name,
        backupFormat: BackupFormat.markdown,
        activeFormat: EditorFormat.markdown,
        markdownText: summaryText,
        latexText: OoxmlEngine.markdownToLatex(summaryText),
        coverRule: CoverRule(documentId: id, coverEndBlockIndex: 0, remember: false, coverBlockCount: 0),
        officePreview: preview,
        updatedAt: now,
        createdAt: now,
        currentBranchId: 'br_main_$id',
      );
      _documents.insert(0, doc);
      _activeDocId = id;
      _scheduleAutosave();
      notifyListeners();
      return null;
    }

    final text = utf8.decode(bytes, allowMalformed: true);
    final isTex = lower.endsWith('.tex');
    final doc = ArchiveDocument(
      id: id,
      spaceId: _activeSpaceId,
      title: stem,
      sourceExt: isTex ? '.tex' : '.md',
      sourceFileName: name,
      backupFormat: BackupFormat.both,
      activeFormat: isTex ? EditorFormat.latex : EditorFormat.markdown,
      markdownText: isTex ? OoxmlEngine.latexToMarkdown(text) : text,
      latexText: isTex ? text : OoxmlEngine.markdownToLatex(text),
      coverRule: CoverRule(documentId: id, coverEndBlockIndex: 0, remember: false, coverBlockCount: 0),
      updatedAt: now,
      createdAt: now,
      currentBranchId: 'br_main_$id',
    );
    _documents.insert(0, doc);
    _activeDocId = id;
    _scheduleAutosave();
    notifyListeners();
    return null;
  }

  void applyCoverSplit(int coverEndBlockIndex, bool remember) {
    final doc = activeDoc;
    if (doc == null || doc.baseDocxBase64 == null) return;
    final bundle = OoxmlEngine.parseDocxBytes(base64Decode(doc.baseDocxBase64!));
    final extracted = OoxmlEngine.extractBodyWithCoverIndex(
      bundle,
      coverEndBlockIndex,
      doc.activeFormat,
    );
    _replaceDocument(doc.copyWith(
      markdownText: doc.activeFormat == EditorFormat.markdown
          ? extracted.text
          : OoxmlEngine.latexToMarkdown(extracted.text),
      latexText: doc.activeFormat == EditorFormat.latex
          ? extracted.text
          : OoxmlEngine.markdownToLatex(extracted.text),
      annotations: extracted.annotations,
      coverXmlNodes: extracted.coverXmlNodes,
      coverRule: CoverRule(
        documentId: doc.id,
        coverEndBlockIndex: coverEndBlockIndex,
        remember: remember,
        coverBlockCount: extracted.coverBlockCount,
      ),
      citationsSidecar: extracted.citationsSidecar,
      updatedAt: DateTime.now().toIso8601String(),
    ));
    showToast(_settings.locale.isZh ? '已更新封面切分边界' : 'Updated cover split boundary');
  }

  Future<void> exportActiveDocument(String mode) async {
    _flushDirtyFormatSyncs(notify: false);
    final doc = activeDoc;
    if (doc == null) return;
    final dir = _resolvedBackupDir.isNotEmpty ? _resolvedBackupDir : Directory.systemTemp.path;
    final safeName = doc.title.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
    late final File outFile;

    if (mode == 'md') {
      outFile = File('$dir${Platform.pathSeparator}$safeName.md');
      await outFile.writeAsString(doc.markdownText);
    } else if (mode == 'tex') {
      outFile = File('$dir${Platform.pathSeparator}$safeName.tex');
      await outFile.writeAsString(doc.latexText);
    } else {
      final baselineSnap = snapshotsForDoc(doc.id).firstOrNull;
      final baseline = baselineSnap != null ? _cas.get(baselineSnap.markdownHash) : null;
      final bytes = OoxmlEngine.exportToDocx(
        baseDocxBase64: doc.baseDocxBase64,
        coverXmlNodes: doc.coverXmlNodes,
        bodyText: doc.activeText,
        format: doc.activeFormat,
        citationsSidecar: doc.citationsSidecar,
        mode: mode == 'redline' ? 'redline' : 'clean',
        baselineText: baseline,
      );
      final suffix = mode == 'redline' ? '_redline' : '_with_cover';
      outFile = File('$dir${Platform.pathSeparator}$safeName$suffix.docx');
      await outFile.writeAsBytes(bytes);
    }

    await Share.shareXFiles([XFile(outFile.path)], text: doc.title);
    showToast(_settings.locale.isZh ? '已导出：${outFile.path}' : 'Exported ${outFile.path}');
  }

  // Trash (permanent retention, never auto-purged)
  bool canMoveToTrash(ArchiveDocument doc) {
    if (doc.isSealed) return false;
    if (doc.spaceId == 'sp_vault' && !_vaultUnlocked) return false;
    return true;
  }

  void moveToTrash(String docId) {
    final idx = _documents.indexWhere((d) => d.id == docId);
    if (idx < 0) return;
    final doc = _documents[idx];
    if (!canMoveToTrash(doc)) {
      showToast(doc.isSealed ? '已封存锁定，请先解除封存' : '请先解锁保险箱');
      return;
    }
    _documents[idx] = doc.copyWith(
      trashedAt: DateTime.now().toIso8601String(),
      trashedFromSpaceId: doc.spaceId,
    );
    if (_activeDocId == docId) {
      final next = activeSpaceDocuments;
      _activeDocId = next.isNotEmpty ? next.first.id : null;
    }
    _scheduleAutosave();
    triggerHaptic(HapticPattern.warning);
    showToast(_settings.locale.isZh ? '已移入内置永久回收站' : 'Moved to Permanent Trash');
    notifyListeners();
  }

  void restoreFromTrash(String docId) {
    final idx = _documents.indexWhere((d) => d.id == docId);
    if (idx < 0) return;
    final doc = _documents[idx];
    final targetSpace = doc.trashedFromSpaceId ?? 'sp_paper';
    _documents[idx] = doc.copyWith(
      spaceId: targetSpace,
      clearTrashedAt: true,
      clearTrashedFromSpaceId: true,
    );
    _activeSpaceId = targetSpace;
    _activeDocId = docId;
    _scheduleAutosave();
    triggerHaptic(HapticPattern.success);
    showToast(_settings.locale.isZh ? '已一键还原文档至原空间' : 'Document restored');
    notifyListeners();
  }

  // Vault Encryption & Biometric
  Future<void> lockVaultWithPasscode(String passcode) async {
    if (passcode.trim().isEmpty) return;
    _flushDirtyFormatSyncs(notify: false);
    _vaultPasscode = passcode;
    _vaultPassHash = VaultCrypto.sha256Hex(passcode);
    for (var i = 0; i < _documents.length; i++) {
      final d = _documents[i];
      if (d.spaceId == 'sp_vault' && !d.isTrashed && d.encryptedPayload == null) {
        final enc = await VaultCrypto.encryptVaultText(d.markdownText, passcode);
        _documents[i] = d.copyWith(encryptedPayload: enc, markdownText: '[已加密封锁]');
      }
    }
    _vaultUnlocked = false;
    _scheduleAutosave();
    notifyListeners();
  }

  Future<bool> unlockVaultWithPasscode(String passcode) async {
    if (_vaultPassHash != null && VaultCrypto.sha256Hex(passcode) != _vaultPassHash) {
      triggerHaptic(HapticPattern.error);
      return false;
    }
    for (var i = 0; i < _documents.length; i++) {
      final d = _documents[i];
      if (d.spaceId == 'sp_vault' && d.encryptedPayload != null) {
        try {
          final plain = await VaultCrypto.decryptVaultText(d.encryptedPayload!, passcode);
          _documents[i] = d.copyWith(
            markdownText: plain,
            latexText: OoxmlEngine.markdownToLatex(plain),
            clearEncryptedPayload: true,
          );
        } catch (_) {
          triggerHaptic(HapticPattern.error);
          return false;
        }
      }
    }
    _vaultPasscode = passcode;
    _vaultUnlocked = true;
    triggerHaptic(HapticPattern.success);
    notifyListeners();
    return true;
  }

  Future<void> unlockVaultByBiometrics() async {
    if (_vaultPasscode != null) {
      await unlockVaultWithPasscode(_vaultPasscode!);
    } else {
      _vaultUnlocked = true;
      notifyListeners();
    }
  }

  // Motivation & Research Assets
  void addMotivation(String title, String content, String kind) {
    final doc = activeDoc;
    if (doc == null) return;
    _motivations.insert(
      0,
      MotivationAttachment(
        id: 'mot_${const Uuid().v4().substring(0, 6)}',
        documentId: doc.id,
        kind: kind,
        title: title,
        content: content,
        createdAt: DateTime.now().toIso8601String(),
      ),
    );
    _scheduleAutosave();
    notifyListeners();
  }

  Future<void> pickLinkedAsset() async {
    final doc = activeDoc;
    if (doc == null) return;
    final res = await FilePicker.platform.pickFiles(withData: true);
    if (res == null || res.files.isEmpty) return;
    final f = res.files.first;
    final bytes = f.bytes ?? const <int>[];
    final ext = f.extension?.toLowerCase() ?? '';
    final cat = (ext == 'png' || ext == 'jpg' || ext == 'svg')
        ? 'figure'
        : (ext == 'csv' || ext == 'xlsx')
            ? 'data'
            : (ext == 'bib')
                ? 'bibliography'
                : 'code';
    _linkedAssets.add(LinkedAsset(
      id: 'asset_${const Uuid().v4().substring(0, 6)}',
      documentId: doc.id,
      name: f.name,
      category: cat,
      relativePath: f.path ?? f.name,
      sizeBytes: f.size,
      contentHash: VaultCrypto.sha256BytesHex(bytes),
      updatedAt: DateTime.now().toIso8601String(),
    ));
    _scheduleAutosave();
    notifyListeners();
  }

  // Share & Camera Scan Intake
  void ingestTextDocument({required String title, required String body, List<String> tags = const ['分享入库']}) {
    final id = 'doc_in_${const Uuid().v4().substring(0, 8)}';
    final now = DateTime.now().toIso8601String();
    final doc = ArchiveDocument(
      id: id,
      spaceId: _activeSpaceId,
      title: title.trim().isEmpty ? '系统分享摘录' : title.trim(),
      sourceExt: '.md',
      sourceFileName: '${title.trim().isEmpty ? 'share' : title.trim()}.md',
      backupFormat: BackupFormat.both,
      activeFormat: EditorFormat.markdown,
      markdownText: body,
      latexText: OoxmlEngine.markdownToLatex(body),
      coverRule: CoverRule(documentId: id, coverEndBlockIndex: 0, remember: false, coverBlockCount: 0),
      updatedAt: now,
      createdAt: now,
      currentBranchId: 'br_main_$id',
      tags: tags,
    );
    _documents.insert(0, doc);
    _activeDocId = id;
    _scheduleAutosave();
    notifyListeners();
  }

  // Tutorial control
  void notifyTutorialAction(TutorialActionId action) {
    if (_tutorialMode != null) {
      tourTargets.notifyAction(action);
    }
  }

  void setSplitPreview(bool value) {
    if (_splitPreview == value) return;
    _splitPreview = value;
    notifyListeners();
  }

  void setActiveFormatForDoc(String docId, EditorFormat format) {
    final idx = _documents.indexWhere((d) => d.id == docId);
    if (idx < 0) return;
    final doc = _syncDocFormatsIfDirty(_documents[idx]);
    if (doc.activeFormat == format) return;
    final syncedText = OoxmlEngine.syncFormatText(doc.activeText, doc.activeFormat, format);
    _documents[idx] = doc.copyWith(
      activeFormat: format,
      markdownText: format == EditorFormat.markdown ? syncedText : doc.markdownText,
      latexText: format == EditorFormat.latex ? syncedText : doc.latexText,
      updatedAt: DateTime.now().toIso8601String(),
    );
    notifyListeners();
  }

  void ensureDemoSceneDocument(String preferredDocId, String fallbackSpaceId) {
    final active = _documents.where((d) => !d.isTrashed).toList();
    ArchiveDocument? target = active.where((d) => d.id == preferredDocId).firstOrNull;
    target ??= active.where((d) => d.spaceId == fallbackSpaceId).firstOrNull;
    target ??= active.firstOrNull;
    if (target == null) {
      _activeSpaceId = fallbackSpaceId;
      _activeDocId = null;
      notifyListeners();
      return;
    }
    _activeSpaceId = target.spaceId;
    _activeDocId = target.id;
    if (target.annotations.isNotEmpty && _selectedAnnotationId == null) {
      _selectedAnnotationId = target.annotations.first.id;
    }
    notifyListeners();
  }

  void openTutorialReplay() {
    _tutorialMode = TutorialMode.replay;
    notifyListeners();
  }

  Future<void> completeTutorial() async {
    await WorkspaceStorage.setOnboardingCompleted(true);
    _tutorialMode = null;
    notifyListeners();
  }

  void closeTutorialReplay() {
    _tutorialMode = null;
    notifyListeners();
  }

  void _replaceDocument(ArchiveDocument updated) {
    final idx = _documents.indexWhere((d) => d.id == updated.id);
    if (idx >= 0) {
      _documents[idx] = updated;
      notifyListeners();
    }
  }

  void _scheduleAutosave() {
    _autosaveTimer?.cancel();
    _autosaveTimer = Timer(const Duration(seconds: 2), () {
      runManualBackup();
    });
  }

  Future<void> runManualBackup() async {
    _flushDirtyFormatSyncs(notify: false);
    final now = DateTime.now().toIso8601String();
    final state = PersistedWorkspaceState(
      savedAt: now,
      activeSpaceId: _activeSpaceId,
      activeDocId: _activeDocId,
      documents: _documents,
      branches: _branches,
      snapshots: _snapshots,
      darlings: _darlings,
      motivations: _motivations,
      linkedAssets: _linkedAssets,
      writingActivity: _writingActivity,
      casObjects: _cas.exportAll(),
    );
    try {
      await WorkspaceStorage.saveWorkspaceBackup(state, _settings);
      _lastBackupAt = now;
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Backup save skipped: $e');
      }
    }
  }

  @override
  void dispose() {
    _toastTimer?.cancel();
    _autosaveTimer?.cancel();
    _formatSyncTimer?.cancel();
    tourTargets.dispose();
    super.dispose();
  }
}
