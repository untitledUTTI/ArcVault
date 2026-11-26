import { describe, expect, it } from 'vitest';
import { enhanceDocumentPixels } from '../mobileScan';
import {
  buildDocumentFromSharePayload,
  parseShareFromLocationSearch,
} from '../shareIntake';

describe('Mobile Scan Filter & System Share Intake', () => {
  it('enhances scanned pixels cleanly for bw-scan and document-crisp modes', () => {
    // Pixel 0: bright paper background (200, 198, 190); Pixel 1: dark ink (40, 42, 45)
    const bw = new Uint8ClampedArray([200, 198, 190, 255, 40, 42, 45, 255]);
    enhanceDocumentPixels(bw, 'bw-scan', 1.4, 15);
    expect(bw[0]).toBeGreaterThan(240);
    expect(bw[4]).toBeLessThan(30);

    const crisp = new Uint8ClampedArray([200, 198, 190, 255, 40, 42, 45, 255]);
    enhanceDocumentPixels(crisp, 'document-crisp', 1.35, 14);
    expect(crisp[0]).toBeGreaterThan(210);
    expect(crisp[4]).toBeLessThan(40);
  });

  it('parses URL share intents and builds normalized ArchiveDocuments', () => {
    const payload = parseShareFromLocationSearch(
      '?share=1&title=Nature%20Paper&url=https%3A%2F%2Fexample.com&text=Key%20finding',
    );
    expect(payload).not.toBeNull();
    expect(payload?.title).toBe('Nature Paper');
    expect(payload?.url).toBe('https://example.com');

    const doc = buildDocumentFromSharePayload(payload!, 'sp_paper');
    expect(doc.spaceId).toBe('sp_paper');
    expect(doc.title).toBe('Nature Paper');
    expect(doc.markdownText).toContain('https://example.com');
    expect(doc.markdownText).toContain('Key finding');
    expect(doc.tags).toContain('分享入库');
  });
});
