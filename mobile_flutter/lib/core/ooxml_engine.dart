import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:diff_match_patch/diff_match_patch.dart';
import 'package:xml/xml.dart';

import '../models/archive_models.dart';

class ParsedSegment {
  const ParsedSegment({
    required this.text,
    this.commentIds = const [],
    this.revisionId,
  });

  final String text;
  final List<String> commentIds;
  final String? revisionId;
}

class ParsedBlock {
  const ParsedBlock({
    required this.index,
    required this.kind, // 'heading' | 'paragraph' | 'table' | 'page-break' | 'sdt-cover'
    this.headingLevel,
    required this.previewText,
    required this.rawXml,
    required this.hasExplicitBreakAfter,
    required this.isCoverSdt,
    this.segments = const [],
    this.tableRows,
  });

  final int index;
  final String kind;
  final int? headingLevel;
  final String previewText;
  final String rawXml;
  final bool hasExplicitBreakAfter;
  final bool isCoverSdt;
  final List<ParsedSegment> segments;
  final List<List<String>>? tableRows;
}

class CommentMeta {
  const CommentMeta({
    required this.id,
    required this.author,
    required this.date,
    required this.text,
  });

  final String id;
  final String author;
  final String date;
  final String text;
}

class RevisionMeta {
  const RevisionMeta({
    required this.id,
    required this.kind, // 'delete' | 'insert' | 'replace'
    required this.author,
    required this.date,
    required this.originalText,
    required this.suggestedText,
  });

  final String id;
  final String kind;
  final String author;
  final String date;
  final String originalText;
  final String suggestedText;
}

class ParsedDocxBundle {
  const ParsedDocxBundle({
    required this.rawBytes,
    required this.blocks,
    required this.detectedCoverEndIndex,
    required this.commentsMap,
    required this.revisionsMap,
    required this.footnotesMap,
    required this.citationsSidecar,
    required this.mediaAssets,
  });

  final Uint8List rawBytes;
  final List<ParsedBlock> blocks;
  final int detectedCoverEndIndex;
  final Map<String, CommentMeta> commentsMap;
  final Map<String, RevisionMeta> revisionsMap;
  final Map<String, String> footnotesMap;
  final List<CitationSidecarEntry> citationsSidecar;
  final Map<String, MediaAsset> mediaAssets;
}

class ExtractedDocContent {
  const ExtractedDocContent({
    required this.format,
    required this.text,
    required this.annotations,
    required this.coverXmlNodes,
    required this.coverBlockCount,
    required this.citationsSidecar,
    required this.mediaAssets,
  });

  final EditorFormat format;
  final String text;
  final List<AnnotationItem> annotations;
  final List<String> coverXmlNodes;
  final int coverBlockCount;
  final List<CitationSidecarEntry> citationsSidecar;
  final Map<String, MediaAsset> mediaAssets;
}

class OoxmlEngine {
  OoxmlEngine._();

  static const String insertionAnchorToken = '⟨待插入⟩';

  static String markdownToLatex(String md) {
    final lines = md.split('\n');
    final out = <String>[];
    var inTable = false;
    var tableRows = <List<String>>[];

    void flushTable() {
      if (!inTable || tableRows.isEmpty) return;
      final cols = tableRows.first.length;
      out.add(r'\begin{table}[htbp]');
      out.add(r'\centering');
      out.add('\\begin{tabular}{${'l' * cols}}');
      out.add(r'\hline');
      for (var i = 0; i < tableRows.length; i++) {
        out.add('${tableRows[i].join(' & ')} \\\\');
        if (i == 0) out.add(r'\hline');
      }
      out.add(r'\hline');
      out.add(r'\end{tabular}');
      out.add(r'\end{table}');
      inTable = false;
      tableRows = [];
    }

    for (final line in lines) {
      final trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        final cells = trimmed.substring(1, trimmed.length - 1).split('|').map((c) => c.trim()).toList();
        if (cells.every((c) => RegExp(r'^:?-+:?$').hasMatch(c))) {
          inTable = true;
          continue;
        }
        inTable = true;
        tableRows.add(cells);
        continue;
      } else if (inTable) {
        flushTable();
      }

      final h1 = RegExp(r'^#\s+(.+)$').firstMatch(line);
      if (h1 != null) {
        out.add('\\section{${h1.group(1)}}');
        continue;
      }
      final h2 = RegExp(r'^##\s+(.+)$').firstMatch(line);
      if (h2 != null) {
        out.add('\\subsection{${h2.group(1)}}');
        continue;
      }
      final h3 = RegExp(r'^###\s+(.+)$').firstMatch(line);
      if (h3 != null) {
        out.add('\\subsubsection{${h3.group(1)}}');
        continue;
      }
      final fn = RegExp(r'^\[\^fn(\d+)\]:\s*(.+)$').firstMatch(line);
      if (fn != null) {
        out.add('% [Footnote ${fn.group(1)}]: ${fn.group(2)}');
        continue;
      }

      var converted = line.replaceAllMapped(
        RegExp(r'\*\*(.+?)\*\*'),
        (m) => '\\textbf{${m.group(1)}}',
      );
      converted = converted.replaceAllMapped(
        RegExp(r'\*(.+?)\*'),
        (m) => '\\textit{${m.group(1)}}',
      );
      out.add(converted);
    }

    if (inTable) flushTable();
    return out.join('\n');
  }

  static String latexToMarkdown(String tex) {
    final lines = tex.split('\n');
    final out = <String>[];
    for (final line in lines) {
      final s1 = RegExp(r'^\\section\{(.+)\}$').firstMatch(line);
      if (s1 != null) {
        out.add('# ${s1.group(1)}');
        continue;
      }
      final s2 = RegExp(r'^\\subsection\{(.+)\}$').firstMatch(line);
      if (s2 != null) {
        out.add('## ${s2.group(1)}');
        continue;
      }
      final s3 = RegExp(r'^\\subsubsection\{(.+)\}$').firstMatch(line);
      if (s3 != null) {
        out.add('### ${s3.group(1)}');
        continue;
      }
      if (RegExp(r'^\\begin\{(table|tabular|figure)\}').hasMatch(line) ||
          RegExp(r'^\\end\{(table|tabular|figure)\}').hasMatch(line) ||
          line.trim() == r'\centering' ||
          line.trim() == r'\hline') {
        continue;
      }
      final fnComment = RegExp(r'^%\s*\[Footnote (\d+)\]:\s*(.+)$').firstMatch(line);
      if (fnComment != null) {
        out.add('[^fn${fnComment.group(1)}]: ${fnComment.group(2)}');
        continue;
      }
      var converted = line.replaceAllMapped(
        RegExp(r'\\textbf\{(.+?)\}'),
        (m) => '**${m.group(1)}**',
      );
      converted = converted.replaceAllMapped(
        RegExp(r'\\textit\{(.+?)\}'),
        (m) => '*${m.group(1)}*',
      );
      converted = converted.replaceAll(RegExp(r'\s*\\\\$'), '');
      out.add(converted);
    }
    return out.join('\n');
  }

  static String syncFormatText(
    String sourceText,
    EditorFormat fromFormat,
    EditorFormat toFormat,
  ) {
    if (fromFormat == toFormat) return sourceText;
    return fromFormat == EditorFormat.markdown
        ? markdownToLatex(sourceText)
        : latexToMarkdown(sourceText);
  }

  static String ommlElementToLatex(XmlElement el) {
    final local = el.localName;
    if (local == 'oMathPara' || local == 'oMath' || local == 'e' || local == 'num' || local == 'den' || local == 'sub' || local == 'sup') {
      return el.childElements.map(ommlElementToLatex).join();
    }
    if (local == 'r') {
      return el.descendants
          .whereType<XmlElement>()
          .where((e) => e.localName == 't')
          .map((e) => e.innerText)
          .join();
    }
    if (local == 'f') {
      final numEl = el.childElements.where((c) => c.localName == 'num').firstOrNull;
      final denEl = el.childElements.where((c) => c.localName == 'den').firstOrNull;
      final numTxt = numEl != null ? ommlElementToLatex(numEl) : '';
      final denTxt = denEl != null ? ommlElementToLatex(denEl) : '';
      return '\\frac{$numTxt}{$denTxt}';
    }
    if (local == 'sSup') {
      final eEl = el.childElements.where((c) => c.localName == 'e').firstOrNull;
      final supEl = el.childElements.where((c) => c.localName == 'sup').firstOrNull;
      return '${eEl != null ? ommlElementToLatex(eEl) : ''}^{${supEl != null ? ommlElementToLatex(supEl) : ''}}';
    }
    if (local == 'sSub') {
      final eEl = el.childElements.where((c) => c.localName == 'e').firstOrNull;
      final subEl = el.childElements.where((c) => c.localName == 'sub').firstOrNull;
      return '${eEl != null ? ommlElementToLatex(eEl) : ''}_{${subEl != null ? ommlElementToLatex(subEl) : ''}}';
    }
    if (local == 'nary') {
      final chrEl = el.descendants
          .whereType<XmlElement>()
          .where((e) => e.localName == 'chr')
          .firstOrNull;
      final sym = chrEl?.getAttribute('m:val') ?? chrEl?.getAttribute('val') ?? '∑';
      final op = sym == '∫' ? r'\int' : r'\sum';
      final subEl = el.childElements.where((c) => c.localName == 'sub').firstOrNull;
      final supEl = el.childElements.where((c) => c.localName == 'sup').firstOrNull;
      final eEl = el.childElements.where((c) => c.localName == 'e').firstOrNull;
      final sub = subEl != null ? '_{${ommlElementToLatex(subEl)}}' : '';
      final sup = supEl != null ? '^{${ommlElementToLatex(supEl)}}' : '';
      return '$op$sub$sup ${eEl != null ? ommlElementToLatex(eEl) : ''}';
    }
    return el.childElements.map(ommlElementToLatex).join();
  }

  static ParsedDocxBundle parseDocxBytes(Uint8List bytes) {
    final archive = ZipDecoder().decodeBytes(bytes);

    // 1. Parse comments.xml
    final commentsMap = <String, CommentMeta>{};
    final commentsFile = archive.findFile('word/comments.xml');
    if (commentsFile != null) {
      final doc = XmlDocument.parse(
        utf8.decode(commentsFile.content as List<int>, allowMalformed: true),
      );
      for (final c in doc.descendants.whereType<XmlElement>().where((e) => e.localName == 'comment')) {
        final id = _attr(c, 'id');
        if (id.isEmpty) continue;
        final text = c.descendants
            .whereType<XmlElement>()
            .where((e) => e.localName == 't')
            .map((e) => e.innerText)
            .join();
        commentsMap[id] = CommentMeta(
          id: id,
          author: _attr(c, 'author').isEmpty ? '导师/审稿人' : _attr(c, 'author'),
          date: _attr(c, 'date').isEmpty ? DateTime.now().toIso8601String() : _attr(c, 'date'),
          text: text,
        );
      }
    }

    // 2. Parse footnotes.xml
    final footnotesMap = <String, String>{};
    final footnotesFile = archive.findFile('word/footnotes.xml');
    if (footnotesFile != null) {
      final doc = XmlDocument.parse(
        utf8.decode(footnotesFile.content as List<int>, allowMalformed: true),
      );
      for (final fn in doc.descendants.whereType<XmlElement>().where((e) => e.localName == 'footnote')) {
        final id = _attr(fn, 'id');
        if (id.isEmpty) continue;
        final text = fn.descendants
            .whereType<XmlElement>()
            .where((e) => e.localName == 't')
            .map((e) => e.innerText)
            .join();
        if (text.trim().isNotEmpty) footnotesMap[id] = text.trim();
      }
    }

    // 3. Parse media assets
    final mediaAssets = <String, MediaAsset>{};
    for (final file in archive.files) {
      if (file.isFile && file.name.startsWith('word/media/')) {
        final name = file.name.split('/').last;
        final b64 = base64Encode(file.content as List<int>);
        final mime = name.toLowerCase().endsWith('.png')
            ? 'image/png'
            : (name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg'))
                ? 'image/jpeg'
                : 'application/octet-stream';
        mediaAssets[name] = MediaAsset(
          id: 'media_$name',
          filename: name,
          mimeType: mime,
          dataUrl: 'data:$mime;base64,$b64',
        );
      }
    }

    // 4. Parse document.xml
    final docFile = archive.findFile('word/document.xml');
    if (docFile == null) {
      throw const FormatException('Invalid .docx: missing word/document.xml');
    }
    final xmlDoc = XmlDocument.parse(
      utf8.decode(docFile.content as List<int>, allowMalformed: true),
    );
    final bodyEl = xmlDoc.descendants.whereType<XmlElement>().where((e) => e.localName == 'body').first;

    final blocks = <ParsedBlock>[];
    final revisionsMap = <String, RevisionMeta>{};
    final citationsSidecar = <CitationSidecarEntry>[];
    var citationCounter = 0;

    final activeComments = <String>{};

    var blockIndex = 0;
    for (final child in bodyEl.childElements) {
      if (child.localName == 'sectPr') continue;

      if (child.localName == 'tbl') {
        final rows = <List<String>>[];
        for (final tr in child.childElements.where((e) => e.localName == 'tr')) {
          final cells = <String>[];
          for (final tc in tr.childElements.where((e) => e.localName == 'tc')) {
            final cellTxt = tc.descendants
                .whereType<XmlElement>()
                .where((e) => e.localName == 't')
                .map((e) => e.innerText)
                .join()
                .trim();
            cells.add(cellTxt);
          }
          if (cells.isNotEmpty) rows.add(cells);
        }
        final preview = rows.map((r) => '| ${r.join(' | ')} |').join('\n');
        blocks.add(ParsedBlock(
          index: blockIndex++,
          kind: 'table',
          previewText: preview,
          rawXml: child.toXmlString(),
          hasExplicitBreakAfter: false,
          isCoverSdt: false,
          tableRows: rows,
        ));
        continue;
      }

      if (child.localName == 'sdt') {
        final text = child.descendants
            .whereType<XmlElement>()
            .where((e) => e.localName == 't')
            .map((e) => e.innerText)
            .join()
            .trim();
        blocks.add(ParsedBlock(
          index: blockIndex++,
          kind: 'sdt-cover',
          previewText: text.isEmpty ? '[Cover Page SDT]' : text,
          rawXml: child.toXmlString(),
          hasExplicitBreakAfter: true,
          isCoverSdt: true,
        ));
        continue;
      }

      if (child.localName == 'p') {
        final headingLevel = _detectHeadingLevel(child);
        final hasPageBreak = child.descendants.whereType<XmlElement>().any(
              (e) => e.localName == 'br' && _attr(e, 'type') == 'page',
            ) ||
            child.descendants.whereType<XmlElement>().any((e) => e.localName == 'sectPr');

        final segments = <ParsedSegment>[];
        var inField = false;
        var fieldInstr = StringBuffer();
        var fieldRawXml = StringBuffer();
        var fieldResult = StringBuffer();
        var fieldInResult = false;

        final pChildren = child.childElements.toList();
        for (var ci = 0; ci < pChildren.length; ci++) {
          final node = pChildren[ci];
          final lname = node.localName;

          if (lname == 'pPr') continue;
          if (lname == 'commentRangeStart') {
            final cid = _attr(node, 'id');
            if (cid.isNotEmpty) activeComments.add(cid);
            continue;
          }
          if (lname == 'commentRangeEnd') {
            final cid = _attr(node, 'id');
            activeComments.remove(cid);
            continue;
          }

          if (lname == 'oMath' || lname == 'oMathPara') {
            final latex = ommlElementToLatex(node).trim();
            if (latex.isNotEmpty) {
              segments.add(ParsedSegment(
                text: '\$$latex\$',
                commentIds: activeComments.toList(),
              ));
            }
            continue;
          }

          if (lname == 'del') {
            final delId = _attr(node, 'id').isEmpty ? 'del_${blockIndex}_$ci' : _attr(node, 'id');
            final delText = node.descendants
                .whereType<XmlElement>()
                .where((e) => e.localName == 'delText' || e.localName == 't')
                .map((e) => e.innerText)
                .join();

            // Check if next element is <w:ins> forming a replace pair
            final nextEl = ci + 1 < pChildren.length ? pChildren[ci + 1] : null;
            if (nextEl != null && nextEl.localName == 'ins') {
              final insText = nextEl.descendants
                  .whereType<XmlElement>()
                  .where((e) => e.localName == 't')
                  .map((e) => e.innerText)
                  .join();
              revisionsMap[delId] = RevisionMeta(
                id: delId,
                kind: 'replace',
                author: _attr(node, 'author').isEmpty ? '审稿人' : _attr(node, 'author'),
                date: _attr(node, 'date'),
                originalText: delText,
                suggestedText: insText,
              );
              segments.add(ParsedSegment(
                text: delText,
                commentIds: activeComments.toList(),
                revisionId: delId,
              ));
              ci++; // skip paired ins
            } else {
              revisionsMap[delId] = RevisionMeta(
                id: delId,
                kind: 'delete',
                author: _attr(node, 'author').isEmpty ? '审稿人' : _attr(node, 'author'),
                date: _attr(node, 'date'),
                originalText: delText,
                suggestedText: '',
              );
              segments.add(ParsedSegment(
                text: delText,
                commentIds: activeComments.toList(),
                revisionId: delId,
              ));
            }
            continue;
          }

          if (lname == 'ins') {
            final insId = _attr(node, 'id').isEmpty ? 'ins_${blockIndex}_$ci' : _attr(node, 'id');
            final insText = node.descendants
                .whereType<XmlElement>()
                .where((e) => e.localName == 't')
                .map((e) => e.innerText)
                .join();
            revisionsMap[insId] = RevisionMeta(
              id: insId,
              kind: 'insert',
              author: _attr(node, 'author').isEmpty ? '审稿人' : _attr(node, 'author'),
              date: _attr(node, 'date'),
              originalText: '',
              suggestedText: insText,
            );
            segments.add(ParsedSegment(
              text: insertionAnchorToken,
              commentIds: activeComments.toList(),
              revisionId: insId,
            ));
            continue;
          }

          if (lname == 'r') {
            final fldChar = node.descendants
                .whereType<XmlElement>()
                .where((e) => e.localName == 'fldChar')
                .firstOrNull;
            if (fldChar != null) {
              final ftype = _attr(fldChar, 'fldCharType');
              if (ftype == 'begin') {
                inField = true;
                fieldInResult = false;
                fieldInstr = StringBuffer();
                fieldRawXml = StringBuffer(node.toXmlString());
                fieldResult = StringBuffer();
                continue;
              } else if (ftype == 'separate') {
                fieldInResult = true;
                fieldRawXml.write(node.toXmlString());
                continue;
              } else if (ftype == 'end') {
                fieldRawXml.write(node.toXmlString());
                final instr = fieldInstr.toString();
                if (instr.contains('ZOTERO') || instr.contains('EN.CITE') || instr.contains('REF')) {
                  citationCounter++;
                  final provider = instr.contains('EN.CITE')
                      ? 'endnote'
                      : instr.contains('ZOTERO')
                          ? 'zotero'
                          : 'word-field';
                  final ph =
                      '[@${provider == 'endnote' ? 'endnote' : 'zotero'}:${citationCounter.toString().padLeft(3, '0')}]';
                  citationsSidecar.add(CitationSidecarEntry(
                    placeholder: ph,
                    provider: provider,
                    rawXml: fieldRawXml.toString(),
                    displayText: fieldResult.toString().trim(),
                  ));
                  segments.add(ParsedSegment(
                    text: ph,
                    commentIds: activeComments.toList(),
                  ));
                } else if (fieldResult.isNotEmpty) {
                  segments.add(ParsedSegment(
                    text: fieldResult.toString(),
                    commentIds: activeComments.toList(),
                  ));
                }
                inField = false;
                continue;
              }
            }

            if (inField) {
              fieldRawXml.write(node.toXmlString());
              final instrEl = node.descendants
                  .whereType<XmlElement>()
                  .where((e) => e.localName == 'instrText')
                  .firstOrNull;
              if (instrEl != null) {
                fieldInstr.write(instrEl.innerText);
              } else if (fieldInResult) {
                final tTxt = node.descendants
                    .whereType<XmlElement>()
                    .where((e) => e.localName == 't')
                    .map((e) => e.innerText)
                    .join();
                fieldResult.write(tTxt);
              }
              continue;
            }

            // Footnote reference
            final fnRef = node.descendants
                .whereType<XmlElement>()
                .where((e) => e.localName == 'footnoteReference')
                .firstOrNull;
            if (fnRef != null) {
              final fid = _attr(fnRef, 'id');
              if (fid.isNotEmpty) {
                segments.add(ParsedSegment(
                  text: '[^fn$fid]',
                  commentIds: activeComments.toList(),
                ));
              }
            }

            final txt = node.descendants
                .whereType<XmlElement>()
                .where((e) => e.localName == 't')
                .map((e) => e.innerText)
                .join();
            if (txt.isNotEmpty) {
              segments.add(ParsedSegment(
                text: txt,
                commentIds: activeComments.toList(),
              ));
            }
          }
        }

        final preview = segments.map((s) => s.text).join().trim();
        final kind = headingLevel != null
            ? 'heading'
            : (hasPageBreak && preview.isEmpty)
                ? 'page-break'
                : 'paragraph';

        blocks.add(ParsedBlock(
          index: blockIndex++,
          kind: kind,
          headingLevel: headingLevel,
          previewText: preview.isEmpty && hasPageBreak ? '--- 分页符 (Page Break) ---' : preview,
          rawXml: child.toXmlString(),
          hasExplicitBreakAfter: hasPageBreak,
          isCoverSdt: false,
          segments: segments,
        ));
      }
    }

    // Detect cover end index: SDT cover -> first page break -> first Heading1/摘要/Abstract
    var detectedCoverEnd = 0;
    for (var i = 0; i < blocks.length; i++) {
      final b = blocks[i];
      if (b.isCoverSdt || b.hasExplicitBreakAfter) {
        detectedCoverEnd = i + 1;
        break;
      }
    }
    if (detectedCoverEnd == 0) {
      for (var i = 0; i < blocks.length; i++) {
        final b = blocks[i];
        if (b.kind == 'heading' &&
            (b.headingLevel == 1 ||
                b.previewText.contains('摘要') ||
                b.previewText.toLowerCase().contains('abstract'))) {
          detectedCoverEnd = i;
          break;
        }
      }
    }

    return ParsedDocxBundle(
      rawBytes: bytes,
      blocks: blocks,
      detectedCoverEndIndex: detectedCoverEnd,
      commentsMap: commentsMap,
      revisionsMap: revisionsMap,
      footnotesMap: footnotesMap,
      citationsSidecar: citationsSidecar,
      mediaAssets: mediaAssets,
    );
  }

  static ExtractedDocContent extractBodyWithCoverIndex(
    ParsedDocxBundle bundle,
    int coverEndIndex,
    EditorFormat format,
  ) {
    final safeEnd = coverEndIndex.clamp(0, bundle.blocks.length);
    final coverXmlNodes = bundle.blocks.sublist(0, safeEnd).map((b) => b.rawXml).toList();
    final bodyBlocks = bundle.blocks.sublist(safeEnd);

    final buf = StringBuffer();
    final annotations = <AnnotationItem>[];
    final commentSpans = <String, ({int start, int end, StringBuffer text})>{};
    final seenRevs = <String>{};

    for (var bi = 0; bi < bodyBlocks.length; bi++) {
      final b = bodyBlocks[bi];
      if (b.kind == 'page-break') continue;
      if (bi > 0) buf.write('\n\n');

      if (b.kind == 'table' && b.tableRows != null && b.tableRows!.isNotEmpty) {
        if (format == EditorFormat.markdown) {
          final rows = b.tableRows!;
          buf.writeln('| ${rows.first.join(' | ')} |');
          buf.writeln('| ${rows.first.map((_) => '---').join(' | ')} |');
          for (var ri = 1; ri < rows.length; ri++) {
            buf.write('| ${rows[ri].join(' | ')} |');
            if (ri < rows.length - 1) buf.writeln();
          }
        } else {
          final cols = b.tableRows!.first.length;
          buf.writeln(r'\begin{table}[htbp]');
          buf.writeln(r'\centering');
          buf.writeln('\\begin{tabular}{${'l' * cols}}');
          buf.writeln(r'\hline');
          for (var ri = 0; ri < b.tableRows!.length; ri++) {
            buf.writeln('${b.tableRows![ri].join(' & ')} \\\\');
            if (ri == 0) buf.writeln(r'\hline');
          }
          buf.writeln(r'\hline');
          buf.writeln(r'\end{tabular}');
          buf.write(r'\end{table}');
        }
        continue;
      }

      if (b.kind == 'heading') {
        final lvl = (b.headingLevel ?? 1).clamp(1, 4);
        if (format == EditorFormat.markdown) {
          buf.write('${'#' * lvl} ');
        } else {
          final cmd = lvl == 1 ? 'section' : lvl == 2 ? 'subsection' : 'subsubsection';
          buf.write('\\$cmd{');
        }
      }

      for (final seg in b.segments) {
        final segStart = buf.length;
        buf.write(seg.text);
        final segEnd = buf.length;

        for (final cid in seg.commentIds) {
          final entry = commentSpans.putIfAbsent(
            cid,
            () => (start: segStart, end: segEnd, text: StringBuffer()),
          );
          commentSpans[cid] = (
            start: entry.start < segStart ? entry.start : segStart,
            end: segEnd > entry.end ? segEnd : entry.end,
            text: entry.text..write(seg.text),
          );
        }

        if (seg.revisionId != null && seenRevs.add(seg.revisionId!)) {
          final rev = bundle.revisionsMap[seg.revisionId!];
          if (rev != null) {
            annotations.add(AnnotationItem(
              id: 'rev_${rev.id}',
              type: AnnotationType.revision,
              revisionKind: RevisionKind.fromWire(rev.kind),
              author: rev.author,
              date: rev.date.isEmpty ? DateTime.now().toIso8601String() : rev.date,
              originalText: rev.originalText.isEmpty ? seg.text : rev.originalText,
              suggestedText: rev.suggestedText,
              anchorStart: segStart,
              anchorEnd: segEnd,
              status: AnnotationStatus.open,
            ));
          }
        }
      }

      if (b.kind == 'heading' && format == EditorFormat.latex) {
        buf.write('}');
      }
    }

    if (bundle.footnotesMap.isNotEmpty) {
      buf.write('\n\n');
      bundle.footnotesMap.forEach((fid, ftext) {
        buf.writeln(format == EditorFormat.markdown
            ? '[^fn$fid]: $ftext'
            : '% [Footnote $fid]: $ftext');
      });
    }

    commentSpans.forEach((cid, span) {
      final meta = bundle.commentsMap[cid];
      annotations.add(AnnotationItem(
        id: 'cmt_$cid',
        type: AnnotationType.comment,
        author: meta?.author ?? '导师/审稿人',
        date: meta?.date ?? DateTime.now().toIso8601String(),
        commentText: meta?.text ?? '',
        originalText: span.text.toString(),
        anchorStart: span.start,
        anchorEnd: span.end,
        status: AnnotationStatus.open,
      ));
    });

    annotations.sort((a, b) => a.anchorStart.compareTo(b.anchorStart));

    return ExtractedDocContent(
      format: format,
      text: buf.toString().trimRight(),
      annotations: annotations,
      coverXmlNodes: coverXmlNodes,
      coverBlockCount: safeEnd,
      citationsSidecar: bundle.citationsSidecar,
      mediaAssets: bundle.mediaAssets,
    );
  }

  static Uint8List exportToDocx({
    String? baseDocxBase64,
    required List<String> coverXmlNodes,
    required String bodyText,
    required EditorFormat format,
    required List<CitationSidecarEntry> citationsSidecar,
    required String mode, // 'clean' | 'redline'
    String? baselineText,
    String author = 'ArcVault',
  }) {
    final normalizedMd =
        format == EditorFormat.latex ? latexToMarkdown(bodyText) : bodyText;
    final citationMap = {for (final c in citationsSidecar) c.placeholder: c};

    final bodyXml = StringBuffer();
    for (final cov in coverXmlNodes) {
      bodyXml.writeln(cov);
    }

    if (mode == 'redline' && baselineText != null) {
      final baseMd = format == EditorFormat.latex ? latexToMarkdown(baselineText) : baselineText;
      final dmp = DiffMatchPatch();
      final diffs = dmp.diff(baseMd, normalizedMd);
      dmp.diffCleanupSemantic(diffs);
      final now = DateTime.now().toIso8601String();
      var revId = 100;
      bodyXml.write('<w:p>');
      for (final d in diffs) {
        final txt = _escapeXml(d.text.replaceAll('\n', ' '));
        if (d.operation == DIFF_DELETE) {
          bodyXml.write(
              '<w:del w:id="${revId++}" w:author="${_escapeXml(author)}" w:date="$now"><w:r><w:delText xml:space="preserve">$txt</w:delText></w:r></w:del>');
        } else if (d.operation == DIFF_INSERT) {
          bodyXml.write(
              '<w:ins w:id="${revId++}" w:author="${_escapeXml(author)}" w:date="$now"><w:r><w:t xml:space="preserve">$txt</w:t></w:r></w:ins>');
        } else {
          bodyXml.write('<w:r><w:t xml:space="preserve">$txt</w:t></w:r>');
        }
      }
      bodyXml.writeln('</w:p>');
    } else {
      final paragraphs = normalizedMd.split(RegExp(r'\n{2,}'));
      for (final p in paragraphs) {
        final trimmed = p.trim();
        if (trimmed.isEmpty) continue;
        final hMatch = RegExp(r'^(#{1,3})\s+(.+)$').firstMatch(trimmed);
        if (hMatch != null) {
          final lvl = hMatch.group(1)!.length;
          bodyXml.writeln(
              '<w:p><w:pPr><w:pStyle w:val="Heading$lvl"/></w:pPr><w:r><w:t xml:space="preserve">${_escapeXml(hMatch.group(2)!)}</w:t></w:r></w:p>');
          continue;
        }
        // Restore protected citation fields if present
        final parts = trimmed.split(RegExp(r'(?=\[@(?:zotero|endnote):\d{3}\])|(?<=\])'));
        final runs = StringBuffer();
        for (final part in parts) {
          final cit = citationMap[part];
          if (cit != null) {
            runs.write(cit.rawXml);
          } else if (part.isNotEmpty) {
            runs.write('<w:r><w:t xml:space="preserve">${_escapeXml(part)}</w:t></w:r>');
          }
        }
        bodyXml.writeln('<w:p>$runs</w:p>');
      }
    }

    final newDocumentXml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    $bodyXml
    <w:sectPr/>
  </w:body>
</w:document>''';

    final outArchive = Archive();
    if (baseDocxBase64 != null && baseDocxBase64.isNotEmpty) {
      final origArchive = ZipDecoder().decodeBytes(base64Decode(baseDocxBase64));
      for (final f in origArchive.files) {
        if (!f.isFile || f.name == 'word/document.xml') continue;
        final data = f.content as List<int>;
        outArchive.addFile(ArchiveFile(f.name, data.length, data));
      }
    } else {
      const ct = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/contenttypes">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>''';
      const rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>''';
      final ctB = utf8.encode(ct);
      final rB = utf8.encode(rels);
      outArchive.addFile(ArchiveFile('[Content_Types].xml', ctB.length, ctB));
      outArchive.addFile(ArchiveFile('_rels/.rels', rB.length, rB));
    }

    final docBytes = utf8.encode(newDocumentXml);
    outArchive.addFile(ArchiveFile('word/document.xml', docBytes.length, docBytes));
    return Uint8List.fromList(ZipEncoder().encode(outArchive));
  }

  static Uint8List buildSamplePaperDocx() {
    final archive = Archive();
    void addText(String name, String content) {
      final bytes = utf8.encode(content);
      archive.addFile(ArchiveFile(name, bytes.length, bytes));
    }

    addText(
      '[Content_Types].xml',
      '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/contenttypes">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>
  <Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
</Types>''',
    );
    addText(
      '_rels/.rels',
      '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>''',
    );
    addText(
      'word/_rels/document.xml.rels',
      '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
</Relationships>''',
    );
    addText(
      'word/styles.xml',
      '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>
</w:styles>''',
    );
    addText(
      'word/comments.xml',
      '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:comment w:id="1" w:author="李教授（导师）" w:date="2026-11-24T19:20:00Z">
    <w:p><w:r><w:t>摘要中的指标提升需要注明对比基线数据集名称，否则审稿人会质疑实验公平性。</w:t></w:r></w:p>
  </w:comment>
  <w:comment w:id="2" w:author="李教授（导师）" w:date="2026-11-24T19:35:00Z">
    <w:p><w:r><w:t>这里建议补充一段关于时间复杂度与显存开销的定量对比说明。</w:t></w:r></w:p>
  </w:comment>
  <w:comment w:id="3" w:author="张师兄" w:date="2026-11-25T10:15:00Z">
    <w:p><w:r><w:t>引用文献格式与 Zotero 域代码请保持锁定，回写 Word 前核对一下第 3 章标号。</w:t></w:r></w:p>
  </w:comment>
</w:comments>''',
    );
    addText(
      'word/footnotes.xml',
      '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:footnote w:id="1"><w:p><w:r><w:t>实验均在单卡 RTX 4090 (24GB) 环境下重复三次取均值。</w:t></w:r></w:p></w:footnote>
</w:footnotes>''',
    );
    addText(
      'word/document.xml',
      '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="40"/></w:rPr><w:t>某高校硕士学位论文（封面）</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>题目：面向长文档演进的局部语义检索与版本对齐方法研究</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>作者：陈同学   导师：李教授   日期：2026年11月</w:t></w:r></w:p>
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>

    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>摘要</w:t></w:r></w:p>
    <w:p>
      <w:r><w:t>针对多轮论文修改过程中版本混乱与语义漂移难题，本文提出了一种分层内容寻址索引框架。</w:t></w:r>
      <w:commentRangeStart w:id="1"/>
      <w:r><w:t>实验表明，该方法将检索准确率显著提升至 94.2%</w:t></w:r>
      <w:commentRangeEnd w:id="1"/>
      <w:r><w:commentReference w:id="1"/></w:r>
      <w:r><w:t>，同时降低磁盘备份冗余。</w:t></w:r>
    </w:p>

    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>1 引言</w:t></w:r></w:p>
    <w:p>
      <w:r><w:t>传统基于整文件哈希的网盘同步难以感知段落级局部改动，</w:t></w:r>
      <w:del w:id="10" w:author="李教授（导师）" w:date="2026-11-24T20:00:00Z"><w:r><w:delText>导致研究者往往需要在桌面堆积大量人工命名的副本</w:delText></w:r></w:del>
      <w:ins w:id="11" w:author="李教授（导师）" w:date="2026-11-24T20:00:00Z"><w:r><w:t>迫使研究者长期依赖低效的人工副本命名与逐行人工比对</w:t></w:r></w:ins>
      <w:r><w:t>。此外，现有文献管理工具 </w:t></w:r>
      <w:commentRangeStart w:id="3"/>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText xml:space="preserve"> ADDIN ZOTERO_ITEM CSL_CITATION {"citationID":"zot01"} </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="separate"/></w:r>
      <w:r><w:t>[1, 2]</w:t></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r>
      <w:commentRangeEnd w:id="3"/>
      <w:r><w:commentReference w:id="3"/></w:r>
      <w:r><w:t> 缺乏对 Word 批注锚点的跨格式持久化支持。</w:t></w:r>
    </w:p>

    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>2 核心方法与目标函数</w:t></w:r></w:p>
    <w:p>
      <w:r><w:t>定义版本间的结构化语义距离损失函数如下，并</w:t></w:r>
      <w:commentRangeStart w:id="2"/>
      <w:r><w:t>采用滑窗分块机制加速编码</w:t></w:r>
      <w:commentRangeEnd w:id="2"/>
      <w:r><w:commentReference w:id="2"/></w:r>
      <w:r><w:t>：</w:t></w:r>
      <m:oMath><m:r><m:t>L=</m:t></m:r><m:f><m:num><m:r><m:t>1</m:t></m:r></m:num><m:den><m:r><m:t>N</m:t></m:r></m:den></m:f><m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub><m:r><m:t>i=1</m:t></m:r></m:sub><m:sup><m:r><m:t>N</m:t></m:r></m:sup><m:e><m:sSup><m:e><m:r><m:t>d</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup></m:e></m:nary></m:oMath>
      <w:r><w:footnoteReference w:id="1"/></w:r>
      <w:r><w:t>。</w:t></w:r>
      <w:ins w:id="12" w:author="李教授（导师）" w:date="2026-11-24T20:10:00Z"><w:r><w:t>此处应补充公式(1)各符号的物理量纲说明。</w:t></w:r></w:ins>
    </w:p>

    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>2.1 消融实验对比</w:t></w:r></w:p>
    <w:p>
      <w:del w:id="13" w:author="李教授（导师）" w:date="2026-11-24T20:15:00Z"><w:r><w:delText>这部分冗余描述建议整体删去以控制篇幅，</w:delText></w:r></w:del>
      <w:r><w:t>下表展示了不同分块策略在测试集上的准确率与存储压缩率。</w:t></w:r>
    </w:p>

    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>方法</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>准确率</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>存储节省</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>基线整文件归档</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>86.5%</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>0%</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>本文 CAS 分层方案</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>94.2%</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>78.4%</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:sectPr/>
  </w:body>
</w:document>''',
    );

    return Uint8List.fromList(ZipEncoder().encode(archive));
  }

  static String _attr(XmlElement? el, String name) {
    if (el == null) return '';
    return el.getAttribute('w:$name') ??
        el.getAttribute('m:$name') ??
        el.getAttribute('r:$name') ??
        el.getAttribute(name) ??
        '';
  }

  static int? _detectHeadingLevel(XmlElement pEl) {
    final pPr = pEl.childElements.where((e) => e.localName == 'pPr').firstOrNull;
    if (pPr == null) return null;
    final pStyle = pPr.childElements.where((e) => e.localName == 'pStyle').firstOrNull;
    final val = _attr(pStyle, 'val');
    final m = RegExp(r'^(?:Heading|标题|H)?\s*([1-6])$', caseSensitive: false).firstMatch(val);
    if (m != null) return int.tryParse(m.group(1)!);
    return null;
  }

  static String _escapeXml(String s) => s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
}
