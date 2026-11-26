import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_BACKUP_VERSION,
  parseWorkspaceState,
  serializeWorkspaceState,
} from '../workspaceBackup';
import type { ArchiveDocument } from '../../types/archive';

function createSampleDoc(): ArchiveDocument {
  return {
    id: 'doc-1',
    spaceId: 'space-paper',
    title: 'Crash Recovery Test',
    sourceExt: '.md',
    sourceFileName: 'crash-recovery.md',
    backupFormat: 'both',
    activeFormat: 'markdown',
    markdownText: '# Title\n\nBody text.',
    latexText: '\\section{Title}\n\nBody text.',
    annotations: [],
    coverXmlNodes: [],
    coverRule: {
      documentId: 'doc-1',
      coverEndBlockIndex: 0,
      remember: false,
      coverBlockCount: 0,
    },
    citationsSidecar: [],
    mediaAssets: {},
    currentBranchId: 'branch-main',
    isSealed: false,
    createdAt: '2026-11-26T12:00:00.000Z',
    updatedAt: '2026-11-26T12:00:00.000Z',
    tags: [],
  };
}

describe('Workspace auto-save & scheduled backup serialization', () => {
  it('round-trips workspace state with documents, snapshots, and CAS objects', () => {
    const raw = serializeWorkspaceState({
      activeSpaceId: 'space-paper',
      activeDocId: 'doc-1',
      documents: [createSampleDoc()],
      branches: [],
      snapshots: [],
      darlings: [],
      motivations: [],
      linkedAssets: [],
      writingActivity: [],
      casObjects: { hash123: '# Title\n\nBody text.' },
      savedAt: '2026-11-26T12:00:00.000Z',
    });

    const parsed = parseWorkspaceState(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(WORKSPACE_BACKUP_VERSION);
    expect(parsed?.documents).toHaveLength(1);
    expect(parsed?.documents[0].title).toBe('Crash Recovery Test');
    expect(parsed?.casObjects.hash123).toBe('# Title\n\nBody text.');
  });

  it('returns null for malformed or empty payloads', () => {
    expect(parseWorkspaceState(null)).toBeNull();
    expect(parseWorkspaceState('')).toBeNull();
    expect(parseWorkspaceState('not-json')).toBeNull();
    expect(parseWorkspaceState(JSON.stringify({ version: 1 }))).toBeNull();
  });
});
