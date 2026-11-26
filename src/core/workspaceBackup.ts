import type {
  ArchiveDocument,
  Branch,
  DeletedDarling,
  LinkedAsset,
  MotivationAttachment,
  Snapshot,
  WritingActivityDay,
} from '../types/archive';

export const WORKSPACE_BACKUP_VERSION = 1;
const IDB_NAME = 'arcvault_workspace_db';
const IDB_VERSION = 1;
const IDB_STORE = 'workspace_state';
const IDB_LATEST_KEY = 'latest';

export interface PersistedWorkspaceState {
  version: number;
  savedAt: string;
  activeSpaceId: string;
  activeDocId: string | null;
  documents: ArchiveDocument[];
  branches: Branch[];
  snapshots: Snapshot[];
  darlings: DeletedDarling[];
  motivations: MotivationAttachment[];
  linkedAssets: LinkedAsset[];
  writingActivity: WritingActivityDay[];
  casObjects: Record<string, string>;
}

export function serializeWorkspaceState(
  state: Omit<PersistedWorkspaceState, 'version' | 'savedAt'> & { savedAt?: string },
): string {
  const payload: PersistedWorkspaceState = {
    version: WORKSPACE_BACKUP_VERSION,
    savedAt: state.savedAt ?? new Date().toISOString(),
    activeSpaceId: state.activeSpaceId,
    activeDocId: state.activeDocId,
    documents: state.documents,
    branches: state.branches,
    snapshots: state.snapshots,
    darlings: state.darlings,
    motivations: state.motivations,
    linkedAssets: state.linkedAssets,
    writingActivity: state.writingActivity,
    casObjects: state.casObjects,
  };
  return JSON.stringify(payload);
}

export function parseWorkspaceState(raw: string | null | undefined): PersistedWorkspaceState | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspaceState> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.documents)) return null;
    return {
      version: typeof parsed.version === 'number' ? parsed.version : WORKSPACE_BACKUP_VERSION,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      activeSpaceId: typeof parsed.activeSpaceId === 'string' ? parsed.activeSpaceId : 'space-paper',
      activeDocId: typeof parsed.activeDocId === 'string' ? parsed.activeDocId : null,
      documents: parsed.documents,
      branches: Array.isArray(parsed.branches) ? parsed.branches : [],
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
      darlings: Array.isArray(parsed.darlings) ? parsed.darlings : [],
      motivations: Array.isArray(parsed.motivations) ? parsed.motivations : [],
      linkedAssets: Array.isArray(parsed.linkedAssets) ? parsed.linkedAssets : [],
      writingActivity: Array.isArray(parsed.writingActivity) ? parsed.writingActivity : [],
      casObjects:
        parsed.casObjects && typeof parsed.casObjects === 'object' ? parsed.casObjects : {},
    };
  } catch {
    return null;
  }
}

function openWorkspaceDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveWorkspaceToIndexedDb(rawJson: string): Promise<boolean> {
  const db = await openWorkspaceDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(rawJson, IDB_LATEST_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function loadWorkspaceFromIndexedDb(): Promise<string | null> {
  const db = await openWorkspaceDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_LATEST_KEY);
      req.onsuccess = () => {
        const val = typeof req.result === 'string' ? req.result : null;
        db.close();
        resolve(val);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}
