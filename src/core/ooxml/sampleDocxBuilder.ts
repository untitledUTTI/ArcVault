import JSZip from 'jszip';

/**
 * Builds a complete, valid real .docx binary containing:
 * - A Thesis Cover Page + Page Break
 * - Multi-level Chinese/English thesis sections
 * - Word native OMML equation (<m:oMath>)
 * - Experiment results table (<w:tbl>)
 * - Zotero citation field XML (<w:fldChar> + <w:instrText>)
 * - Footnote (<w:footnoteReference>)
 * - 3 Advisor Comments (word/comments.xml) & 3 Track Changes (<w:del>, <w:ins>, replace)
 */
export async function buildSamplePaperDocx(): Promise<Uint8Array> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/contenttypes">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>
  <Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
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
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
</Relationships>`,
  );

  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>
</w:styles>`,
  );

  zip.file(
    'word/comments.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
</w:comments>`,
  );

  zip.file(
    'word/footnotes.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:footnote w:id="1"><w:p><w:r><w:t>实验均在单卡 RTX 4090 (24GB) 环境下重复三次取均值。</w:t></w:r></w:p></w:footnote>
</w:footnotes>`,
  );

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
</w:document>`,
  );

  return zip.generateAsync({ type: 'uint8array' });
}
