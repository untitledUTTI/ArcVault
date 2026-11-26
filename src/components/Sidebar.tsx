import React, { useRef } from 'react';
import {
  GraduationCap,
  Briefcase,
  PenTool,
  ShieldCheck,
  Upload,
  Sparkles,
  FilePlus2,
  Lock,
  Unlock,
  Radio,
  Camera,
  Share2,
  Wifi,
  Trash2,
  X,
} from 'lucide-react';
import { canMoveDocumentToTrash } from '../core/trash';
import type { ArchiveDocument, HapticPattern, Locale, Space, SpaceKind } from '../types/archive';
import type { I18nDict } from '../i18n/dictionaries';
import { useAnimatedPresence } from '../platform/useAnimatedPresence';

interface SidebarProps {
  dict: I18nDict;
  locale: Locale;
  spaces: Space[];
  activeSpaceId: string;
  documents: ArchiveDocument[];
  activeDocId: string | null;
  snapshotCountByDoc: Record<string, number>;
  watchActive: boolean;
  watchDirectory: string;
  isDrawerMode?: boolean;
  drawerOpen?: boolean;
  isMobileOS?: boolean;
  onCloseDrawer?: () => void;
  onSelectSpace: (spaceId: string) => void;
  onSelectDoc: (docId: string) => void;
  onImportFiles: (files: FileList) => void;
  onImportSampleDocx: () => void;
  onCreateBlankDoc: () => void;
  onToggleWatch: () => void;
  onOpenSync?: () => void;
  onOpenCameraScan?: () => void;
  onOpenShareIntake?: () => void;
  onHaptic?: (pattern: HapticPattern) => void;
  vaultUnlocked?: boolean;
  onOpenVaultLock?: () => void;
  trashedCount?: number;
  onTrashDoc?: (docId: string) => void;
  onOpenTrash?: () => void;
}

const SPACE_ICON: Record<SpaceKind, React.ReactNode> = {
  paper: <GraduationCap size={14} />,
  office: <Briefcase size={14} />,
  writing: <PenTool size={14} />,
  vault: <ShieldCheck size={14} />,
};

export const Sidebar: React.FC<SidebarProps> = ({
  dict,
  locale,
  spaces,
  activeSpaceId,
  documents,
  activeDocId,
  snapshotCountByDoc,
  watchActive,
  watchDirectory,
  isDrawerMode = false,
  drawerOpen = false,
  isMobileOS = false,
  onCloseDrawer,
  onSelectSpace,
  onSelectDoc,
  onImportFiles,
  onImportSampleDocx,
  onCreateBlankDoc,
  onToggleWatch,
  onOpenSync,
  onOpenCameraScan,
  onOpenShareIntake,
  onHaptic,
  vaultUnlocked = true,
  onOpenVaultLock,
  trashedCount = 0,
  onTrashDoc,
  onOpenTrash,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawerPresence = useAnimatedPresence(Boolean(isDrawerMode && drawerOpen), 240);

  const visibleDocs = documents.filter((d) => !d.trashedAt && d.spaceId === activeSpaceId);

  const sidebarNode = (
    <aside
      data-tour="sidebar-panel"
      className={`arc-sidebar ${isDrawerMode ? `is-drawer phase-${drawerPresence.phase}` : ''} ${drawerOpen ? 'is-open' : ''}`}
    >
      {isDrawerMode && (
        <div className="arc-drawer-header">
          <strong style={{ fontSize: 13.5 }}>{dict.sidebar.header}</strong>
          <button
            type="button"
            className="arc-btn arc-icon-btn"
            onClick={() => {
              onHaptic?.('selection');
              onCloseDrawer?.();
            }}
            aria-label={dict.sidebar.closeDrawer}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <div className="arc-space-nav">
        {spaces.map((sp) => (
          <button
            key={sp.id}
            className={`arc-space-btn ${sp.id === activeSpaceId ? 'active' : ''}`}
            onClick={() => {
              onHaptic?.('selection');
              onSelectSpace(sp.id);
            }}
          >
            {SPACE_ICON[sp.kind]}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {locale === 'zh-CN' ? sp.nameZh : sp.nameEn}
            </span>
          </button>
        ))}
      </div>

      <div className="arc-sidebar-actions">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".doc,.docx,.md,.tex,.txt,.pdf,.pptx,.xlsx"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onImportFiles(e.target.files);
              e.target.value = '';
              if (isDrawerMode) onCloseDrawer?.();
            }
          }}
        />
        <button
          className="arc-btn arc-btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => {
            onHaptic?.('light');
            fileInputRef.current?.click();
          }}
        >
          <Upload size={14} />
          <span>{dict.actions.importDocx}</span>
        </button>
        <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
          <button
            className="arc-btn"
            style={{ flex: 1, minWidth: 0, justifyContent: 'center', fontSize: 11.5 }}
            onClick={() => {
              onHaptic?.('light');
              onImportSampleDocx();
              if (isDrawerMode) onCloseDrawer?.();
            }}
            title={dict.actions.importSample}
          >
            <Sparkles size={13} />
            <span>{dict.actions.importSample}</span>
          </button>
          <button
            className="arc-btn"
            style={{ justifyContent: 'center', fontSize: 11.5 }}
            onClick={() => {
              onHaptic?.('light');
              onCreateBlankDoc();
              if (isDrawerMode) onCloseDrawer?.();
            }}
            title={dict.actions.newDoc}
          >
            <FilePlus2 size={13} />
          </button>
        </div>
        {(isDrawerMode || isMobileOS) && (
          <div style={{ display: 'flex', gap: 6 }}>
            {onOpenCameraScan && (
              <button
                type="button"
                className="arc-btn"
                style={{ flex: 1, justifyContent: 'center', fontSize: 11.5 }}
                onClick={() => {
                  onHaptic?.('light');
                  onCloseDrawer?.();
                  onOpenCameraScan();
                }}
              >
                <Camera size={13} />
                <span>{dict.sidebar.cameraScan}</span>
              </button>
            )}
            {onOpenShareIntake && (
              <button
                type="button"
                className="arc-btn"
                style={{ flex: 1, justifyContent: 'center', fontSize: 11.5 }}
                onClick={() => {
                  onHaptic?.('light');
                  onCloseDrawer?.();
                  onOpenShareIntake();
                }}
              >
                <Share2 size={13} />
                <span>{dict.sidebar.shareIntake}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="arc-doc-list">
        {activeSpaceId === 'sp_vault' && onOpenVaultLock && (
          <button
            className={`arc-btn ${vaultUnlocked ? '' : 'arc-btn-primary'}`}
            style={{ width: '100%', justifyContent: 'center', marginBottom: 6, fontSize: 12 }}
            onClick={() => {
              onHaptic?.('light');
              onOpenVaultLock();
            }}
            title={dict.sidebar.vaultTip}
          >
            {vaultUnlocked ? <Unlock size={13} /> : <Lock size={13} />}
            <span>{vaultUnlocked ? dict.sidebar.vaultUnlocked : dict.sidebar.vaultLocked}</span>
          </button>
        )}
        {visibleDocs.length === 0 ? (
          <div style={{ padding: 18, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            {dict.sidebar.empty}
          </div>
        ) : (
          visibleDocs.map((doc) => {
            const openAnns = doc.annotations.filter((a) => a.status === 'open').length;
            const snapCount = snapshotCountByDoc[doc.id] ?? 1;
            const trashGuard = canMoveDocumentToTrash(doc, vaultUnlocked);
            const trashTooltip =
              trashGuard.reason === 'vault-locked'
                ? dict.sidebar.trashVaultLockedTip
                : trashGuard.reason === 'sealed'
                  ? dict.sidebar.trashSealedTip
                  : dict.sidebar.moveToTrash;
            return (
              <div
                key={doc.id}
                className={`arc-doc-item ${doc.id === activeDocId ? 'active' : ''}`}
                onClick={() => {
                  onHaptic?.('selection');
                  onSelectDoc(doc.id);
                  if (isDrawerMode) onCloseDrawer?.();
                }}
              >
                <div className="arc-doc-item-title">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                    {doc.title}
                  </span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {doc.isSealed && <Lock size={13} color="#dc2626" />}
                    {onTrashDoc && (
                      <button
                        type="button"
                        className="arc-doc-trash-btn"
                        disabled={!trashGuard.allowed}
                        title={trashTooltip}
                        aria-label={trashTooltip}
                        onClick={(e) => {
                          e.stopPropagation();
                          onHaptic?.('light');
                          onTrashDoc(doc.id);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="arc-doc-item-meta">
                  <span className="arc-badge">{doc.sourceExt}</span>
                  <span>{snapCount} {dict.sidebar.snapUnit}</span>
                  {openAnns > 0 && (
                    <span style={{ color: 'var(--arc-revision-color)', fontWeight: 600 }}>
                      {openAnns} {dict.sidebar.openAnnotations}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {isMobileOS || isDrawerMode ? (
        <div className="arc-watch-box">
          <button
            type="button"
            className="arc-btn arc-btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => {
              onHaptic?.('light');
              onCloseDrawer?.();
              onOpenSync?.();
            }}
          >
            <Wifi size={14} />
            <span>{dict.sidebar.syncBtn}</span>
          </button>
        </div>
      ) : (
        <div className="arc-watch-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
              <Radio size={13} color={watchActive ? '#16a34a' : 'var(--text-muted)'} />
              {dict.watch.title}
            </span>
            <span style={{ color: watchActive ? '#16a34a' : 'var(--text-muted)', fontSize: 11 }}>
              {watchActive ? dict.watch.active : dict.watch.idle}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: 7,
            }}
            title={watchDirectory}
          >
            {dict.sidebar.dirPrefix}{watchDirectory}
          </div>
          <button className="arc-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={onToggleWatch}>
            {watchActive ? dict.watch.toggleOff : dict.watch.toggleOn}
          </button>
        </div>
      )}

      {onOpenTrash && (
        <div className="arc-sidebar-trash-footer">
          <button
            type="button"
            data-tour="sidebar-trash-btn"
            className="arc-btn arc-sidebar-trash-btn"
            onClick={() => {
              onHaptic?.('light');
              if (isDrawerMode) onCloseDrawer?.();
              onOpenTrash();
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <Trash2 size={14} color="var(--text-secondary)" />
              <span>{dict.sidebar.trashEntry}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <span className="arc-sidebar-trash-perm">{dict.sidebar.trashPermanentBadge}</span>
              <span className="arc-badge">{trashedCount}</span>
            </span>
          </button>
        </div>
      )}
    </aside>
  );

  if (isDrawerMode) {
    if (!drawerPresence.mounted) return null;
    return (
      <div
        className={`arc-drawer-backdrop phase-${drawerPresence.phase}`}
        onClick={() => {
          onHaptic?.('selection');
          onCloseDrawer?.();
        }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ height: '100%' }}>
          {sidebarNode}
        </div>
      </div>
    );
  }

  return sidebarNode;
};
