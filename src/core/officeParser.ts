import JSZip from 'jszip';
import { DOMParser, type Element as XmlElement } from '@xmldom/xmldom';
import type { OfficePreviewData } from '../types/archive';

function localName(n: Node | XmlElement | null | undefined): string {
  if (!n) return '';
  const el = n as XmlElement;
  return el.localName || (el.nodeName ? el.nodeName.replace(/^.*:/, '') : '');
}

function collectTextsByLocal(root: XmlElement, targetLocal: string): string[] {
  const out: string[] = [];
  const all = root.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (localName(el) === targetLocal) {
      const txt = (el.textContent ?? '').trim();
      if (txt) out.push(txt);
    }
  }
  return out;
}

/**
 * Parses a real .pptx binary into structured slides (title, bullets, notes) + Markdown summary.
 */
export async function parsePptxBytes(input: Uint8Array | ArrayBuffer): Promise<{
  preview: Extract<OfficePreviewData, { kind: 'pptx' }>;
  markdownSummary: string;
}> {
  const zip = await JSZip.loadAsync(input);
  const parser = new DOMParser();

  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/i.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
      return na - nb;
    });

  const slides: Array<{ index: number; title: string; bullets: string[]; notes?: string }> = [];

  for (const path of slideFiles) {
    const idx = Number(path.match(/slide(\d+)\.xml/i)?.[1] ?? slides.length + 1);
    const xmlStr = await zip.file(path)?.async('string');
    if (!xmlStr) continue;
    const dom = parser.parseFromString(xmlStr, 'application/xml');

    const paragraphs: string[] = [];
    const all = dom.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (localName(el) === 'p') {
        const line = collectTextsByLocal(el, 't').join('').trim();
        if (line) paragraphs.push(line);
      }
    }

    const title = paragraphs[0] ?? `第 ${idx} 页幻灯片`;
    const bullets = paragraphs.slice(1);

    // Try matching speaker notesSlide
    let notes: string | undefined;
    const notesPath = `ppt/notesSlides/notesSlide${idx}.xml`;
    const notesXml = await zip.file(notesPath)?.async('string');
    if (notesXml) {
      const nDom = parser.parseFromString(notesXml, 'application/xml');
      if (nDom.documentElement) {
        const noteTexts = collectTextsByLocal(nDom.documentElement, 't').filter(
          (t) => !/^\d+$/.test(t),
        );
        if (noteTexts.length > 0) notes = noteTexts.join(' ');
      }
    }

    slides.push({ index: idx, title, bullets, notes });
  }

  const mdLines = slides.map((s) => {
    const b = s.bullets.map((x) => `- ${x}`).join('\n');
    const n = s.notes ? `\n> 演讲备注：${s.notes}` : '';
    return `## Slide ${s.index}: ${s.title}\n${b}${n}`;
  });

  return {
    preview: { kind: 'pptx', slides },
    markdownSummary: mdLines.join('\n\n') || '# 空演示文稿',
  };
}

/**
 * Parses a real .xlsx binary into multi-sheet tables + Markdown tables.
 */
export async function parseXlsxBytes(input: Uint8Array | ArrayBuffer): Promise<{
  preview: Extract<OfficePreviewData, { kind: 'xlsx' }>;
  markdownSummary: string;
}> {
  const zip = await JSZip.loadAsync(input);
  const parser = new DOMParser();

  // 1. Parse sharedStrings.xml
  const sharedStrings: string[] = [];
  const ssXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  if (ssXml) {
    const ssDom = parser.parseFromString(ssXml, 'application/xml');
    const all = ssDom.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      if (localName(all[i]) === 'si') {
        sharedStrings.push(collectTextsByLocal(all[i], 't').join(''));
      }
    }
  }

  // 2. Parse workbook sheet names
  const sheetNames: string[] = [];
  const wbXml = await zip.file('xl/workbook.xml')?.async('string');
  if (wbXml) {
    const wbDom = parser.parseFromString(wbXml, 'application/xml');
    const all = wbDom.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      if (localName(all[i]) === 'sheet') {
        const name = all[i].getAttribute('name');
        if (name) sheetNames.push(name);
      }
    }
  }

  const sheetFiles = Object.keys(zip.files)
    .filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/sheet(\d+)\.xml/i)?.[1] ?? 0);
      const nb = Number(b.match(/sheet(\d+)\.xml/i)?.[1] ?? 0);
      return na - nb;
    });

  const sheets: Array<{ name: string; rows: string[][] }> = [];

  for (let sIdx = 0; sIdx < sheetFiles.length; sIdx++) {
    const xmlStr = await zip.file(sheetFiles[sIdx])?.async('string');
    if (!xmlStr) continue;
    const dom = parser.parseFromString(xmlStr, 'application/xml');
    const rows: string[][] = [];

    const all = dom.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (localName(el) !== 'row') continue;
      const rowCells: string[] = [];
      for (let j = 0; j < el.childNodes.length; j++) {
        const c = el.childNodes[j] as XmlElement;
        if (c.nodeType !== 1 || localName(c) !== 'c') continue;
        const cellType = c.getAttribute('t') ?? '';
        let val = '';
        if (cellType === 'inlineStr') {
          val = collectTextsByLocal(c, 't').join('');
        } else {
          const vText = collectTextsByLocal(c, 'v')[0] ?? '';
          if (cellType === 's') {
            val = sharedStrings[Number(vText)] ?? vText;
          } else {
            val = vText;
          }
        }
        rowCells.push(val);
      }
      if (rowCells.length > 0) rows.push(rowCells);
    }

    sheets.push({
      name: sheetNames[sIdx] ?? `Sheet${sIdx + 1}`,
      rows,
    });
  }

  const mdSections = sheets.map((sh) => {
    if (sh.rows.length === 0) return `## ${sh.name}\n（空工作表）`;
    const [head, ...body] = sh.rows;
    const headerRow = `| ${head.join(' | ')} |`;
    const sepRow = `| ${head.map(() => '---').join(' | ')} |`;
    const bodyRows = body.map((r) => `| ${r.join(' | ')} |`).join('\n');
    return `## ${sh.name}\n\n${headerRow}\n${sepRow}\n${bodyRows}`;
  });

  return {
    preview: { kind: 'xlsx', sheets },
    markdownSummary: mdSections.join('\n\n') || '# 空工作簿',
  };
}

export async function buildSamplePptxBytes(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/contenttypes">
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`,
  );
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>面向长文档演进的局部语义检索（中期答辩）</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:txBody>
      <a:p><a:r><a:t>汇报人：陈同学 | 指导教师：李教授</a:t></a:r></a:p>
      <a:p><a:r><a:t>核心成果：检索准确率提升至 94.2%，存储节省 78.4%</a:t></a:r></a:p>
    </p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`,
  );
  zip.file(
    'ppt/notesSlides/notesSlide1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>开场强调论文修改版本混乱的痛点，引出 CAS 局部索引架构。</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:notes>`,
  );
  zip.file(
    'ppt/slides/slide2.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>核心创新点与实验验证</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:txBody>
      <a:p><a:r><a:t>1. Word 封面无损剥离与 Zotero 引文域隔离保护</a:t></a:r></a:p>
      <a:p><a:r><a:t>2. 滑窗分块编码 + CAS 内容寻址去重快照</a:t></a:r></a:p>
      <a:p><a:r><a:t>3. RTX 4090 三轮消融实验显存峰值低于 420MB</a:t></a:r></a:p>
    </p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`,
  );
  return zip.generateAsync({ type: 'uint8array' });
}

export async function buildSampleXlsxBytes(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheets>
    <sheet name="消融实验汇总" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
    <sheet name="显存耗时记录" sheetId="2" r:id="rId2" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
  </sheets>
</workbook>`,
  );
  zip.file(
    'xl/sharedStrings.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="6" uniqueCount="6">
  <si><t>分块策略</t></si>
  <si><t>准确率</t></si>
  <si><t>存储压缩率</t></si>
  <si><t>整文件基线</t></si>
  <si><t>固定段落切分</t></si>
  <si><t>CAS 滑窗分层（本文）</t></si>
</sst>`,
  );
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
    <row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="inlineStr"><is><t>86.5%</t></is></c><c r="C2" t="inlineStr"><is><t>0%</t></is></c></row>
    <row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3" t="inlineStr"><is><t>91.6%</t></is></c><c r="C3" t="inlineStr"><is><t>64.2%</t></is></c></row>
    <row r="4"><c r="A4" t="s"><v>5</v></c><c r="B4" t="inlineStr"><is><t>94.2%</t></is></c><c r="C4" t="inlineStr"><is><t>78.4%</t></is></c></row>
  </sheetData>
</worksheet>`,
  );
  zip.file(
    'xl/worksheets/sheet2.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>轮次</t></is></c><c r="B1" t="inlineStr"><is><t>编码耗时(ms)</t></is></c><c r="C1" t="inlineStr"><is><t>显存峰值(MB)</t></is></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>Run-1</t></is></c><c r="B2"><v>42</v></c><c r="C2"><v>412</v></c></row>
    <row r="3"><c r="A3" t="inlineStr"><is><t>Run-2</t></is></c><c r="B3"><v>39</v></c><c r="C3"><v>416</v></c></row>
  </sheetData>
</worksheet>`,
  );
  return zip.generateAsync({ type: 'uint8array' });
}
