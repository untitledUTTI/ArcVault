import 'dart:convert';
import 'package:uuid/uuid.dart';
import '../models/archive_models.dart';
import 'vault_crypto.dart';

class CasPutResult {
  const CasPutResult({required this.hash, required this.deduplicated});
  final String hash;
  final bool deduplicated;
}

class SnapshotCreateResult {
  const SnapshotCreateResult({
    this.snapshot,
    required this.deduplicated,
    required this.savedBytes,
  });
  final Snapshot? snapshot;
  final bool deduplicated;
  final int savedBytes;
}

class FragmentSearchHit {
  const FragmentSearchHit({
    required this.snapshot,
    required this.snippet,
  });
  final Snapshot snapshot;
  final String snippet;
}

class CasObjectStore {
  CasObjectStore([Map<String, String>? initialObjects]) {
    if (initialObjects != null) {
      _objects.addAll(initialObjects);
    }
  }

  final Map<String, String> _objects = {};

  CasPutResult put(String content) {
    final hash = VaultCrypto.sha256Hex(content);
    final existed = _objects.containsKey(hash);
    if (!existed) {
      _objects[hash] = content;
    }
    return CasPutResult(hash: hash, deduplicated: existed);
  }

  String? get(String hash) => _objects[hash];

  bool has(String hash) => _objects.containsKey(hash);

  int get size => _objects.length;

  Map<String, String> exportAll() => Map<String, String>.from(_objects);

  void importAll(Map<String, String> entries) {
    _objects.addAll(entries);
  }
}

int countWordsSmart(String text) {
  final cjk = RegExp(r'[\u4e00-\u9fff]').allMatches(text).length;
  final latin = RegExp(r'[A-Za-z0-9_]+').allMatches(text).length;
  return cjk + latin;
}

SnapshotCreateResult createDocumentSnapshot({
  required CasObjectStore cas,
  required ArchiveDocument doc,
  Snapshot? latestSnapshot,
  required String label,
  required bool isMilestone,
  required String aiSummary,
  String? motivationNote,
  List<String> tags = const [],
}) {
  final mdPut = cas.put(doc.markdownText);
  final texPut = cas.put(doc.latexText);
  final activePut = doc.activeFormat == EditorFormat.markdown ? mdPut : texPut;

  if (latestSnapshot != null &&
      latestSnapshot.markdownHash == mdPut.hash &&
      latestSnapshot.latexHash == texPut.hash &&
      !isMilestone) {
    return SnapshotCreateResult(
      snapshot: null,
      deduplicated: true,
      savedBytes: utf8.encode(doc.markdownText).length,
    );
  }

  final prevText = latestSnapshot != null ? (cas.get(latestSnapshot.contentHash) ?? '') : '';
  final deltaChars = doc.activeText.length - prevText.length;

  final snap = Snapshot(
    id: 'snap_${const Uuid().v4().substring(0, 8)}',
    documentId: doc.id,
    branchId: doc.currentBranchId,
    parentId: latestSnapshot?.id,
    createdAt: DateTime.now().toIso8601String(),
    label: label,
    isMilestone: isMilestone,
    tags: tags,
    contentHash: activePut.hash,
    markdownHash: mdPut.hash,
    latexHash: texPut.hash,
    wordCount: countWordsSmart(doc.activeText),
    deltaChars: deltaChars,
    aiSummary: aiSummary,
    motivationNote: motivationNote,
    annotationsCount: doc.annotations.where((a) => a.status == AnnotationStatus.open).length,
  );

  return SnapshotCreateResult(
    snapshot: snap,
    deduplicated: activePut.deduplicated,
    savedBytes: activePut.deduplicated ? utf8.encode(doc.activeText).length : 0,
  );
}

List<FragmentSearchHit> searchAcrossSnapshots({
  required CasObjectStore cas,
  required List<Snapshot> snapshots,
  required String query,
}) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return const [];
  final hits = <FragmentSearchHit>[];
  for (final snap in snapshots) {
    final text = cas.get(snap.contentHash) ?? '';
    final idx = text.toLowerCase().indexOf(q);
    if (idx < 0) continue;
    final start = (idx - 28).clamp(0, text.length);
    final end = (idx + q.length + 42).clamp(0, text.length);
    final snippet = text.substring(start, end).replaceAll('\n', ' ').trim();
    hits.add(FragmentSearchHit(snapshot: snap, snippet: snippet));
  }
  return hits;
}
