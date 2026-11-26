import { describe, expect, it } from 'vitest';
import {
  buildSamplePptxBytes,
  buildSampleXlsxBytes,
  parsePptxBytes,
  parseXlsxBytes,
} from '../officeParser';

describe('officeParser (.pptx & .xlsx)', () => {
  it('parses PPTX slides, bullets, titles, and speaker notes from sample deck', async () => {
    const bytes = await buildSamplePptxBytes();
    const { preview, markdownSummary } = await parsePptxBytes(bytes);

    expect(preview.kind).toBe('pptx');
    expect(preview.slides.length).toBe(2);
    expect(preview.slides[0].title).toContain('面向长文档演进的局部语义检索');
    expect(preview.slides[0].bullets.length).toBeGreaterThanOrEqual(2);
    expect(preview.slides[0].notes).toContain('开场强调');
    expect(preview.slides[1].title).toContain('核心创新点');
    expect(markdownSummary).toContain('## Slide 1:');
    expect(markdownSummary).toContain('## Slide 2:');
  });

  it('parses XLSX worksheets with sharedStrings, inlineStr, and numbers into table markdown', async () => {
    const bytes = await buildSampleXlsxBytes();
    const { preview, markdownSummary } = await parseXlsxBytes(bytes);

    expect(preview.kind).toBe('xlsx');
    expect(preview.sheets.length).toBe(2);
    expect(preview.sheets[0].name).toBe('消融实验汇总');
    expect(preview.sheets[0].rows[0]).toEqual(['分块策略', '准确率', '存储压缩率']);
    expect(preview.sheets[0].rows[1]).toEqual(['整文件基线', '86.5%', '0%']);
    expect(preview.sheets[1].name).toBe('显存耗时记录');
    expect(preview.sheets[1].rows[1]).toEqual(['Run-1', '42', '412']);
    expect(markdownSummary).toContain('消融实验汇总');
    expect(markdownSummary).toContain('| 分块策略 | 准确率 | 存储压缩率 |');
  });
});
