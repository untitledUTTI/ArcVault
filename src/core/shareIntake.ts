import type { ArchiveDocument } from '../types/archive';
import { syncFormatText } from './ooxml/formatConverter';

export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
  source?: 'url-query' | 'tauri-intent' | 'clipboard' | 'manual';
}

export function parseShareFromLocationSearch(search: string): SharePayload | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const hasFlag =
    params.get('share') === '1' ||
    params.has('share_title') ||
    params.has('share_text') ||
    params.has('share_url');
  if (!hasFlag) return null;

  const title = params.get('share_title') || params.get('title') || undefined;
  const text = params.get('share_text') || params.get('text') || undefined;
  const url = params.get('share_url') || params.get('url') || undefined;
  if (!title && !text && !url) return null;

  return { title, text, url, source: 'url-query' };
}

export function buildDocumentFromSharePayload(
  payload: SharePayload,
  spaceId: string,
): ArchiveDocument {
  const now = new Date().toISOString();
  const cleanTitle =
    payload.title?.trim() ||
    (payload.url ? `网页摘录 · ${payload.url.replace(/^https?:\/\//, '').slice(0, 32)}` : '系统分享摘录');

  const lines: string[] = [`# ${cleanTitle}`, ''];
  if (payload.url?.trim()) {
    lines.push(`> 来源链接：${payload.url.trim()}`, '');
  }
  if (payload.text?.trim()) {
    lines.push(payload.text.trim());
  } else {
    lines.push('（已通过系统分享菜单入库，可在此补充批注与正文内容。）');
  }

  const md = lines.join('\n');
  const tex = syncFormatText(md, 'markdown', 'latex');
  const id = `doc_share_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    spaceId,
    title: cleanTitle,
    sourceExt: '.md',
    sourceFileName: `${cleanTitle.replace(/[\\/:*?"<>|]/g, '_')}.md`,
    backupFormat: 'both',
    activeFormat: 'markdown',
    markdownText: md,
    latexText: tex,
    annotations: [],
    coverXmlNodes: [],
    coverRule: {
      documentId: id,
      coverEndBlockIndex: 0,
      remember: false,
      coverBlockCount: 0,
    },
    citationsSidecar: [],
    mediaAssets: {},
    isSealed: false,
    updatedAt: now,
    createdAt: now,
    currentBranchId: `br_main_${id}`,
    tags: ['分享入库'],
  };
}
