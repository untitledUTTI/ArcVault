import 'dart:convert';
import 'dart:typed_data';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';
import '../models/archive_models.dart';

class OfficeParser {
  OfficeParser._();

  static OfficePreviewData parsePptxBytes(Uint8List bytes) {
    final archive = ZipDecoder().decodeBytes(bytes);
    final slideFiles = archive.files
        .where((f) => f.isFile && RegExp(r'^ppt/slides/slide\d+\.xml$').hasMatch(f.name))
        .toList()
      ..sort((a, b) => _extractIndex(a.name).compareTo(_extractIndex(b.name)));

    final slides = <PptxSlideData>[];
    for (var i = 0; i < slideFiles.length; i++) {
      final xmlStr = utf8.decode(slideFiles[i].content as List<int>, allowMalformed: true);
      final doc = XmlDocument.parse(xmlStr);
      final paragraphs = doc.findAllElements('a:p').toList();
      final lines = <String>[];
      for (final p in paragraphs) {
        final texts = p.findAllElements('a:t').map((t) => t.innerText).join();
        if (texts.trim().isNotEmpty) lines.add(texts.trim());
      }
      final title = lines.isNotEmpty ? lines.first : 'Slide ${i + 1}';
      final bullets = lines.length > 1 ? lines.sublist(1) : <String>[];
      slides.add(PptxSlideData(index: i + 1, title: title, bullets: bullets));
    }

    return OfficePreviewData(kind: 'pptx', slides: slides);
  }

  static OfficePreviewData parseXlsxBytes(Uint8List bytes) {
    final archive = ZipDecoder().decodeBytes(bytes);
    final sharedStrings = <String>[];
    final sstFile = archive.findFile('xl/sharedStrings.xml');
    if (sstFile != null) {
      final sstDoc = XmlDocument.parse(
        utf8.decode(sstFile.content as List<int>, allowMalformed: true),
      );
      for (final si in sstDoc.findAllElements('si')) {
        sharedStrings.add(si.findAllElements('t').map((t) => t.innerText).join());
      }
    }

    final sheetFiles = archive.files
        .where((f) => f.isFile && RegExp(r'^xl/worksheets/sheet\d+\.xml$').hasMatch(f.name))
        .toList()
      ..sort((a, b) => _extractIndex(a.name).compareTo(_extractIndex(b.name)));

    final sheets = <XlsxSheetData>[];
    for (var i = 0; i < sheetFiles.length; i++) {
      final xmlStr = utf8.decode(sheetFiles[i].content as List<int>, allowMalformed: true);
      final doc = XmlDocument.parse(xmlStr);
      final rows = <List<String>>[];
      for (final rowEl in doc.findAllElements('row')) {
        final rowCells = <String>[];
        for (final c in rowEl.findAllElements('c')) {
          final type = c.getAttribute('t');
          final vEl = c.getElement('v');
          final rawVal = vEl?.innerText ?? '';
          if (type == 's') {
            final idx = int.tryParse(rawVal);
            rowCells.add(
              (idx != null && idx >= 0 && idx < sharedStrings.length)
                  ? sharedStrings[idx]
                  : rawVal,
            );
          } else if (type == 'inlineStr') {
            rowCells.add(c.findAllElements('t').map((t) => t.innerText).join());
          } else {
            rowCells.add(rawVal);
          }
        }
        if (rowCells.isNotEmpty) rows.add(rowCells);
      }
      sheets.add(XlsxSheetData(name: 'Sheet${i + 1}', rows: rows));
    }

    return OfficePreviewData(kind: 'xlsx', sheets: sheets);
  }

  static int _extractIndex(String name) {
    final m = RegExp(r'(\d+)').firstMatch(name);
    return int.tryParse(m?.group(1) ?? '0') ?? 0;
  }
}
