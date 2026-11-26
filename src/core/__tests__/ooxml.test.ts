import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildSamplePaperDocx } from '../ooxml/sampleDocxBuilder';
import { parseDocxBytes, extractBodyWithCoverIndex, INSERTION_ANCHOR_TOKEN } from '../ooxml/docxParser';
import { exportToDocx } from '../ooxml/docxExporter';
import { markdownToLatex, latexToMarkdown } from '../ooxml/formatConverter';

describe('OOXML Bidirectional Engine (Cover Strip, Comments/Revisions, Equations, Zotero, Export)', () => {
  it('strips cover page, extracts OMML equations, Zotero fields, and preserves original text for comments & revisions', async () => {
    const sampleBytes = await buildSamplePaperDocx();
    const bundle = await parseDocxBytes(sampleBytes);

    // Smart cover detection should isolate the 3 cover paragraphs + page break (4 blocks)
    expect(bundle.detectedCoverEndIndex).toBe(4);
    expect(bundle.blocks[0].previewText).toContain('硕士学位论文（封面）');

    const extracted = extractBodyWithCoverIndex(bundle, bundle.detectedCoverEndIndex, 'markdown');

    // Cover must NOT appear in extracted Markdown body
    expect(extracted.text).not.toContain('硕士学位论文（封面）');
    expect(extracted.coverXmlNodes.length).toBe(4);

    // Headings, table, footnote, OMML -> LaTeX, and Zotero shield must be extracted
    expect(extracted.text).toContain('# 摘要');
    expect(extracted.text).toContain('$L=\\frac{1}{N}\\sum_{i=1}^{N} d^{2}$');
    expect(extracted.text).toContain('| 方法 | 准确率 | 存储节省 |');
    expect(extracted.text).toContain('[@zotero:001]');
    expect(extracted.text).toContain('[^fn1]:');
    expect(extracted.citationsSidecar).toHaveLength(1);
    expect(extracted.citationsSidecar[0].rawXml).toContain('ADDIN ZOTERO_ITEM');

    // Original text MUST be preserved in body instead of replacement text
    expect(extracted.text).toContain('导致研究者往往需要在桌面堆积大量人工命名的副本');
    expect(extracted.text).not.toContain('迫使研究者长期依赖低效的人工副本命名');
    expect(extracted.text).toContain('这部分冗余描述建议整体删去以控制篇幅，');

    // Annotations should align accurately to substrings in extracted.text
    const comments = extracted.annotations.filter((a) => a.type === 'comment');
    const revisions = extracted.annotations.filter((a) => a.type === 'revision');
    expect(comments).toHaveLength(3);
    expect(revisions).toHaveLength(3);

    for (const ann of extracted.annotations) {
      const slice = extracted.text.slice(ann.anchorStart, ann.anchorEnd);
      if (ann.type === 'revision' && ann.revisionKind === 'insert') {
        expect(slice).toBe(INSERTION_ANCHOR_TOKEN);
      } else {
        expect(slice).toBe(ann.originalText);
      }
    }
  });

  it('supports adjusting cover split index & round-trip exporting clean and redline .docx with original cover + Zotero XML restored', async () => {
    const sampleBytes = await buildSamplePaperDocx();
    const bundle = await parseDocxBytes(sampleBytes);

    // User adjusts cover split to only strip first 2 blocks
    const customExtracted = extractBodyWithCoverIndex(bundle, 2, 'markdown');
    expect(customExtracted.coverBlockCount).toBe(2);
    expect(customExtracted.text).toContain('作者：陈同学');

    // Now test full clean export with standard cover
    const standard = extractBodyWithCoverIndex(bundle, bundle.detectedCoverEndIndex, 'markdown');
    const editedBody = standard.text.replace('94.2%', '95.8%');

    const cleanDocxBytes = await exportToDocx({
      coverXmlNodes: standard.coverXmlNodes,
      bodyText: editedBody,
      format: 'markdown',
      citationsSidecar: standard.citationsSidecar,
      mode: 'clean',
    });

    const reparsedClean = await parseDocxBytes(cleanDocxBytes);
    const reparsedExtracted = extractBodyWithCoverIndex(
      reparsedClean,
      reparsedClean.detectedCoverEndIndex,
      'markdown',
    );
    // Original cover intact
    expect(reparsedClean.blocks[0].previewText).toContain('硕士学位论文（封面）');
    // Edits & Zotero citation XML preserved
    expect(reparsedExtracted.text).toContain('95.8%');
    expect(reparsedExtracted.citationsSidecar).toHaveLength(1);
    expect(reparsedExtracted.citationsSidecar[0].rawXml).toContain('ADDIN ZOTERO_ITEM');

    // Redline export should generate native Word <w:ins> / <w:del> track changes
    const redlineDocxBytes = await exportToDocx({
      coverXmlNodes: standard.coverXmlNodes,
      bodyText: editedBody,
      format: 'markdown',
      citationsSidecar: standard.citationsSidecar,
      mode: 'redline',
      baselineText: standard.text,
      author: '陈同学',
    });
    const reparsedRedline = await parseDocxBytes(redlineDocxBytes);
    expect(Object.keys(reparsedRedline.revisionsMap).length).toBeGreaterThan(0);
  });

  it('converts between Markdown and LaTeX cleanly', () => {
    const md = '# 引言\n\n这是 **加粗** 和 *斜体*。';
    const tex = markdownToLatex(md);
    expect(tex).toContain('\\section{引言}');
    expect(tex).toContain('\\textbf{加粗}');
    expect(tex).toContain('\\textit{斜体}');

    const backToMd = latexToMarkdown(tex);
    expect(backToMd).toContain('# 引言');
    expect(backToMd).toContain('**加粗**');
  });

  it('losslessly preserves custom paragraph styles, run fonts/bold/colors, tables, and templates across edits', async () => {
    const zip = new JSZip();
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/contenttypes">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-officedocument.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
    );
    zip.file(
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    );
    zip.file(
      'word/_rels/document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    );
    zip.file(
      'word/styles.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="MyThesisH1">
    <w:name w:val="用户自定义一级章标题"/>
    <w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:rFonts w:eastAsia="黑体" w:ascii="Times New Roman"/><w:b/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="MyCustomBody">
    <w:name w:val="学位论文正文样式"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:firstLine="420"/><w:spacing w:line="360" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:eastAsia="宋体" w:ascii="Times New Roman"/><w:sz w:val="24"/></w:rPr>
  </w:style>
</w:styles>`,
    );
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="MyThesisH1"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="黑体" w:ascii="Times New Roman"/><w:b/></w:rPr><w:t>第一章 研究背景</w:t></w:r></w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="MyCustomBody"/><w:ind w:firstLine="420"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:eastAsia="仿宋" w:ascii="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:t>本文在核心实验中使用了</w:t></w:r>
      <w:r><w:rPr><w:rFonts w:eastAsia="黑体" w:ascii="Times New Roman"/><w:b/><w:color w:val="C00000"/><w:sz w:val="24"/></w:rPr><w:t>自适应内容寻址架构</w:t></w:r>
      <w:r><w:rPr><w:rFonts w:eastAsia="仿宋" w:ascii="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:t>进行测试。</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="MyCustomBody"/><w:jc w:val="both"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:eastAsia="楷体"/><w:i/></w:rPr><w:t>未修改的原始保留段落。</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tblPr><w:tblBorders><w:top w:val="single" w:sz="12"/></w:tblBorders></w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:fill="E8EEF5"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>指标</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:fill="E8EEF5"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>数值</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>准确率</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>94.2%</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:sectPr/>
  </w:body>
</w:document>`,
    );

    const origBytes = await zip.generateAsync({ type: 'uint8array' });
    let b64 = '';
    for (let i = 0; i < origBytes.length; i++) b64 += String.fromCharCode(origBytes[i]);
    const baseDocxBase64 = btoa(b64);

    const bundle = await parseDocxBytes(origBytes);
    const extracted = extractBodyWithCoverIndex(bundle, bundle.detectedCoverEndIndex, 'markdown');

    // Custom outlineLvl=0 style should be detected as H1 heading
    expect(extracted.text).toContain('# 第一章 研究背景');
    expect(extracted.styleSidecar?.headingTemplates[1]?.styleId).toBe('MyThesisH1');
    expect(extracted.styleSidecar?.bodyTemplate?.styleId).toBe('MyCustomBody');

    // Edit: modify part of paragraph 1, add **bold** span, edit table value, append brand-new paragraph
    const editedBody = `${extracted.text
      .replace('进行测试。', '开展**多端**验证。')
      .replace('94.2%', '96.5%')}\n\n# 第二章 总结\n\n这是新增的总结段落。`;

    const exportedBytes = await exportToDocx({
      baseDocxBase64,
      coverXmlNodes: extracted.coverXmlNodes,
      bodyText: editedBody,
      format: 'markdown',
      citationsSidecar: extracted.citationsSidecar,
      styleSidecar: extracted.styleSidecar,
      mode: 'clean',
    });

    const outZip = await JSZip.loadAsync(exportedBytes);
    const outDocXml = await outZip.file('word/document.xml')!.async('string');
    const outStylesXml = await outZip.file('word/styles.xml')!.async('string');

    // Original styles.xml & root w14 namespace preserved
    expect(outStylesXml).toContain('MyThesisH1');
    expect(outStylesXml).toContain('MyCustomBody');
    expect(outDocXml).toContain('xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"');

    // Unmodified custom paragraph & heading preserved verbatim
    expect(outDocXml).toContain('<w:rFonts w:eastAsia="楷体"/>');
    expect(outDocXml).toContain('未修改的原始保留段落。');

    // Partially edited paragraph preserves MyCustomBody + Times New Roman/黑体/color C00000 + adds <w:b/> on **多端**
    expect(outDocXml).toContain('<w:pStyle w:val="MyCustomBody"/>');
    expect(outDocXml).toContain('<w:color w:val="C00000"/>');
    expect(outDocXml).toContain('自适应内容寻址架构');
    expect(outDocXml).toContain('多端');

    // Edited table retains original cell shading & borders while updating value
    expect(outDocXml).toContain('w:fill="E8EEF5"');
    expect(outDocXml).toContain('96.5%');

    // Brand-new heading & paragraph inherit MyThesisH1 & MyCustomBody
    const reparsed = await parseDocxBytes(exportedBytes);
    const h2Block = reparsed.blocks.find((b) => b.previewText.includes('第二章 总结'));
    const newBodyBlock = reparsed.blocks.find((b) => b.previewText.includes('这是新增的总结段落'));
    expect(h2Block?.pStyleId).toBe('MyThesisH1');
    expect(newBodyBlock?.pStyleId).toBe('MyCustomBody');
  });
});
