import React, { useEffect, useRef, useState } from 'react';
import {
  Undo2,
  Redo2,
  BookmarkPlus,
  Lock,
  Unlock,
  Download,
  Settings,
  Scissors,
  ChevronDown,
  GitBranch,
  Stethoscope,
  Paperclip,
  Flame,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Maximize2,
  Sparkles,
  GraduationCap,
  LayoutTemplate,
  Plus,
  Check,
  Trash2,
  RotateCcw,
  RefreshCw,
  Wifi,
  MoreHorizontal,
  Camera,
  Share2,
  Clock,
  Menu,
  Minus,
  Square,
  Copy,
  X,
  BookOpen,
} from 'lucide-react';
import { ArcVaultLogo } from './ArcVaultLogo';
import {
  summarizeLayoutBadges,
  type WorkspaceLayoutPreset,
} from '../core/workspaceLayout';
import {
  isTauriRuntime,
  nativeWindowClose,
  nativeWindowIsMaximized,
  nativeWindowMinimize,
  nativeWindowToggleMaximize,
  subscribeNativeWindowResized,
} from '../platform/bridge';
import { formatShortcut, type DeviceEnvironment } from '../platform/device';
import type {
  ArchiveDocument,
  EditorFormat,
  HapticPattern,
  ThemeId,
} from '../types/archive';
import type { I18nDict } from '../i18n/dictionaries';

interface TopBarProps {
  dict: I18nDict;
  doc: ArchiveDocument | null;
  activeBranchName: string;
  activeFormat: EditorFormat;
  splitPreview: boolean;
  theme: ThemeId;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  openAnnotationCount: number;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  undoCount: number;
  redoCount: number;
  haloPulse: boolean;
  deviceEnv?: DeviceEnvironment;
  syncConflictCount?: number;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
  onEnterFullscreen: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFormatChange: (fmt: EditorFormat) => void;
  onToggleSplitPreview: () => void;
  onSaveMilestone: () => void;
  onToggleSeal: () => void;
  onOpenCoverSplit: () => void;
  onOpenBranches: () => void;
  onOpenPaperStudio: () => void;
  onOpenContextAssets: () => void;
  onOpenEvolutionStudio: () => void;
  phrasebankEnabled: boolean;
  phrasebankVisible: boolean;
  onTogglePhrasebankCapsule: () => void;
  layoutPresets: WorkspaceLayoutPreset[];
  activePresetId: string | null;
  onApplyLayoutPreset: (preset: WorkspaceLayoutPreset) => void;
  onSaveLayoutPreset: (name: string) => void;
  onOverwriteLayoutPreset: (presetId: string) => void;
  onDeleteLayoutPreset: (presetId: string) => void;
  onResetDefaultLayout: () => void;
  onExportCleanWord: () => void;
  onExportRedlineWord: () => void;
  onExportText: (fmt: EditorFormat) => void;
  onOpenSettings: () => void;
  onOpenSync?: () => void;
  onOpenTimelineSheet?: () => void;
  onOpenCameraScan?: () => void;
  onOpenShareIntake?: () => void;
  onOpenTutorial?: () => void;
  onHaptic?: (pattern: HapticPattern) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  dict,
  doc,
  activeBranchName,
  activeFormat,
  splitPreview,
  theme,
  leftCollapsed,
  rightCollapsed,
  openAnnotationCount,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  undoCount,
  redoCount,
  haloPulse,
  deviceEnv,
  syncConflictCount = 0,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onEnterFullscreen,
  onUndo,
  onRedo,
  onFormatChange,
  onToggleSplitPreview,
  onSaveMilestone,
  onToggleSeal,
  onOpenCoverSplit,
  onOpenBranches,
  onOpenPaperStudio,
  onOpenContextAssets,
  onOpenEvolutionStudio,
  phrasebankEnabled,
  phrasebankVisible,
  onTogglePhrasebankCapsule,
  layoutPresets,
  activePresetId,
  onApplyLayoutPreset,
  onSaveLayoutPreset,
  onOverwriteLayoutPreset,
  onDeleteLayoutPreset,
  onResetDefaultLayout,
  onExportCleanWord,
  onExportRedlineWord,
  onExportText,
  onOpenSettings,
  onOpenSync,
  onOpenTimelineSheet,
  onOpenCameraScan,
  onOpenShareIntake,
  onOpenTutorial,
  onHaptic,
}) => {
  const [openMenu, setOpenMenu] = useState<'tools' | 'layout' | 'export' | 'mobile-more' | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const mobileMoreRef = useRef<HTMLDivElement>(null);
  const isPhone = Boolean(deviceEnv?.isPhone);
  const isTabletPortrait = Boolean(deviceEnv?.isTabletPortrait);
  const isCompactTopbar = isPhone || isTabletPortrait;
  const currentOs = deviceEnv?.os ?? 'windows';
  const isDesktopTauri = isTauriRuntime() && !isPhone && !Boolean(deviceEnv?.isTablet);
  const isMacOverlay = isDesktopTauri && currentOs === 'macos';
  const showCustomWinControls = isDesktopTauri && currentOs !== 'macos';
  const [isMaximized, setIsMaximized] = useState(false);
  const undoKeyHint = formatShortcut('Mod+Z', currentOs);
  const redoKeyHint = formatShortcut('Mod+Shift+Z', currentOs);
  const phraseKeyHint = formatShortcut('Alt+P', currentOs);

  useEffect(() => {
    if (!showCustomWinControls) return;
    let active = true;
    let unlisten: (() => void) | null = null;
    nativeWindowIsMaximized().then((max) => {
      if (active) setIsMaximized(max);
    });
    subscribeNativeWindowResized((max) => {
      if (active) setIsMaximized(max);
    }).then((fn) => {
      if (active) unlisten = fn;
      else fn();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [showCustomWinControls]);

  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        toolsMenuRef.current?.contains(target) ||
        layoutMenuRef.current?.contains(target) ||
        exportMenuRef.current?.contains(target) ||
        mobileMoreRef.current?.contains(target)
      ) {
        return;
      }
      setOpenMenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  if (isPhone) {
    return (
      <header className="arc-topbar arc-topbar-phone">
        <div className="arc-toolbar-group" style={{ minWidth: 0, flex: '1 1 0' }}>
          <button
            type="button"
            className="arc-btn arc-icon-btn"
            onClick={() => {
              onHaptic?.('light');
              onToggleLeftSidebar();
            }}
            aria-label={dict.topbar.openMenu}
          >
            <Menu size={17} />
          </button>

          <ArcVaultLogo size={22} theme={theme} />

          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
            title={doc?.title ?? dict.topbar.brandShort}
          >
            {doc ? doc.title : dict.topbar.brandShort}
          </span>
        </div>

        <div className="arc-toolbar-group" style={{ flexShrink: 0 }}>
          {onOpenSync && (
            <button
              type="button"
              className="arc-btn arc-icon-btn"
              onClick={() => {
                onHaptic?.('light');
                onOpenSync();
              }}
              aria-label={dict.topbar.syncLabel}
              style={{ position: 'relative' }}
            >
              <Wifi size={15} />
              {syncConflictCount > 0 && (
                <span className="arc-topbar-dot-badge">{syncConflictCount}</span>
              )}
            </button>
          )}

          {doc && (
            <button
              type="button"
              data-tour="topbar-snapshot-btn"
              className={`arc-btn arc-btn-primary arc-btn-pill ${haloPulse ? 'arc-halo-pulse' : ''}`}
              style={{ height: 32, padding: '0 10px' }}
              onClick={() => {
                onHaptic?.('success');
                onSaveMilestone();
              }}
            >
              <BookmarkPlus size={14} />
              <span>{dict.topbar.snapshotShort}</span>
            </button>
          )}

          <div ref={mobileMoreRef} style={{ position: 'relative' }}>
            <button
              type="button"
              data-tour="topbar-more-btn"
              className="arc-btn arc-icon-btn"
              onClick={() => {
                onHaptic?.('selection');
                setOpenMenu((m) => (m === 'mobile-more' ? null : 'mobile-more'));
              }}
              aria-label={dict.topbar.moreLabel}
            >
              <MoreHorizontal size={17} />
            </button>

            <div
              className={`arc-dropdown-menu ${openMenu === 'mobile-more' ? 'is-open' : ''}`}
              style={{ right: 0, width: 248, maxHeight: '72vh', overflowY: 'auto' }}
            >
              {doc && (
                <>
                  {onOpenTimelineSheet && (
                    <button
                      type="button"
                      className="arc-btn arc-dropdown-item"
                      onClick={() => {
                        setOpenMenu(null);
                        onHaptic?.('light');
                        onOpenTimelineSheet();
                      }}
                    >
                      <Clock size={14} />
                      <span>{dict.topbar.timelineSheet}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="arc-btn arc-dropdown-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onHaptic?.('light');
                      onToggleRightSidebar();
                    }}
                  >
                    <PanelRightOpen size={14} />
                    <span>{dict.topbar.annotationsSheet} ({openAnnotationCount})</span>
                  </button>
                  <button
                    type="button"
                    className="arc-btn arc-dropdown-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onHaptic?.('light');
                      onOpenBranches();
                    }}
                  >
                    <GitBranch size={14} />
                    <span>{dict.topbar.branches} ({activeBranchName})</span>
                  </button>
                  <button
                    type="button"
                    className="arc-btn arc-dropdown-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onHaptic?.('light');
                      onOpenPaperStudio();
                    }}
                  >
                    <Stethoscope size={14} />
                    <span>{dict.topbar.paperStudioShort}</span>
                  </button>
                  <button
                    type="button"
                    className="arc-btn arc-dropdown-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onHaptic?.('light');
                      onOpenContextAssets();
                    }}
                  >
                    <Paperclip size={14} />
                    <span>{dict.topbar.contextAssetsShort}</span>
                  </button>
                  <button
                    type="button"
                    className="arc-btn arc-dropdown-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onHaptic?.('light');
                      onOpenEvolutionStudio();
                    }}
                  >
                    <Flame size={14} />
                    <span>{dict.topbar.evolutionStudioShort}</span>
                  </button>
                  <button
                    type="button"
                    className="arc-btn arc-dropdown-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onHaptic?.('selection');
                      onTogglePhrasebankCapsule();
                    }}
                  >
                    <GraduationCap size={14} />
                    <span>{dict.topbar.phrasebankShort} ({phrasebankVisible ? dict.topbar.phrasebankOpened : dict.topbar.phrasebankOpen})</span>
                  </button>
                  <div className="arc-dropdown-divider" />
                  <button
                    type="button"
                    className="arc-btn arc-dropdown-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onExportCleanWord();
                    }}
                  >
                    <Download size={14} />
                    <span>{dict.actions.exportCleanWord}</span>
                  </button>
                  <button
                    type="button"
                    className="arc-btn arc-dropdown-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onExportText(activeFormat);
                    }}
                  >
                    <Download size={14} />
                    <span>{dict.topbar.exportShort} {activeFormat === 'markdown' ? '.md' : '.tex'}</span>
                  </button>
                  <button
                    type="button"
                    className="arc-btn arc-dropdown-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onHaptic?.('medium');
                      onToggleSeal();
                    }}
                  >
                    {doc.isSealed ? <Lock size={14} color="#dc2626" /> : <Unlock size={14} />}
                    <span>{doc.isSealed ? dict.actions.unseal : dict.actions.seal}</span>
                  </button>
                  <div className="arc-dropdown-divider" />
                </>
              )}
              {onOpenCameraScan && (
                <button
                  type="button"
                  className="arc-btn arc-dropdown-item"
                  onClick={() => {
                    setOpenMenu(null);
                    onHaptic?.('light');
                    onOpenCameraScan();
                  }}
                >
                  <Camera size={14} />
                  <span>{dict.topbar.cameraScan}</span>
                </button>
              )}
              {onOpenShareIntake && (
                <button
                  type="button"
                  className="arc-btn arc-dropdown-item"
                  onClick={() => {
                    setOpenMenu(null);
                    onHaptic?.('light');
                    onOpenShareIntake();
                  }}
                >
                  <Share2 size={14} />
                  <span>{dict.topbar.shareIntake}</span>
                </button>
              )}
              {onOpenTutorial && (
                <button
                  type="button"
                  className="arc-btn arc-dropdown-item"
                  onClick={() => {
                    setOpenMenu(null);
                    onHaptic?.('light');
                    onOpenTutorial();
                  }}
                >
                  <BookOpen size={14} />
                  <span>{dict.topbar.tutorialShort}</span>
                </button>
              )}
              <button
                type="button"
                className="arc-btn arc-dropdown-item"
                onClick={() => {
                  setOpenMenu(null);
                  onHaptic?.('light');
                  onOpenSettings();
                }}
              >
                <Settings size={14} />
                <span>{dict.actions.settings}</span>
              </button>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header
      className={[
        'arc-topbar',
        isDesktopTauri ? 'arc-topbar-immersive' : '',
        isMacOverlay ? 'is-macos-overlay' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-tauri-drag-region={isDesktopTauri ? '' : undefined}
    >
      {/* Left Zone: Sidebar toggle + compact Brand + Document title */}
      <div
        className="arc-toolbar-group"
        style={{ minWidth: 0, flex: '1 1 0' }}
        data-tauri-drag-region={isDesktopTauri ? '' : undefined}
      >
        <button
          className="arc-btn arc-icon-btn"
          onClick={() => {
            onHaptic?.('light');
            onToggleLeftSidebar();
          }}
          title={leftCollapsed ? dict.topbar.expandLeft : dict.topbar.collapseLeft}
        >
          {leftCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <ArcVaultLogo size={26} theme={theme} />
          {!isTabletPortrait && (
            <strong style={{ fontSize: 14, letterSpacing: 0.2 }}>
              {dict.topbar.brandShort}
            </strong>
          )}
        </div>

        {doc && (
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              borderLeft: '1px solid var(--border-subtle)',
              paddingLeft: 10,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
            title={doc.title}
          >
            {doc.title}
          </span>
        )}
      </div>

      {/* Center Zone: Format Switcher + Unified Toolbox Dropdown */}
      {doc && (
        <div className="arc-toolbar-group" style={{ flexShrink: 0 }}>
          <div className="arc-segmented" data-tour="topbar-format-switch">
            <button
              className={activeFormat === 'markdown' ? 'active' : ''}
              onClick={() => onFormatChange('markdown')}
            >
              MD
            </button>
            <button
              className={activeFormat === 'latex' ? 'active' : ''}
              onClick={() => onFormatChange('latex')}
            >
              LaTeX
            </button>
            <button
              data-tour="format-preview-btn"
              className={splitPreview ? 'active' : ''}
              onClick={onToggleSplitPreview}
            >
              {dict.topbar.preview}
            </button>
          </div>

          <div ref={toolsMenuRef} style={{ position: 'relative' }}>
            <button
              className="arc-btn"
              onClick={() => setOpenMenu((m) => (m === 'tools' ? null : 'tools'))}
            >
              <Sparkles size={14} color="var(--accent)" />
              {!isTabletPortrait && <span>{dict.topbar.toolbox}</span>}
              <ChevronDown
                size={13}
                className={`arc-chevron-rot ${openMenu === 'tools' ? 'is-open' : ''}`}
              />
            </button>

            <div
              className={`arc-dropdown-menu ${openMenu === 'tools' ? 'is-open' : ''}`}
              style={{ left: 0, minWidth: 256, width: 'max-content', maxWidth: 'min(360px, calc(100vw - 24px))' }}
            >
              <button
                className="arc-btn arc-dropdown-item"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenBranches();
                }}
              >
                <GitBranch size={14} />
                <span>{dict.topbar.branches} ({activeBranchName})</span>
              </button>
              <button
                className="arc-btn arc-dropdown-item"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenPaperStudio();
                }}
              >
                <Stethoscope size={14} />
                <span>{dict.topbar.paperStudio}</span>
              </button>
              <button
                className="arc-btn arc-dropdown-item"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenContextAssets();
                }}
              >
                <Paperclip size={14} />
                <span>{dict.topbar.contextAssets}</span>
              </button>
              <button
                className="arc-btn arc-dropdown-item"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenEvolutionStudio();
                }}
              >
                <Flame size={14} />
                <span>{dict.topbar.evolutionStudio}</span>
              </button>
              <button
                className="arc-btn arc-dropdown-item"
                onClick={() => {
                  setOpenMenu(null);
                  onTogglePhrasebankCapsule();
                }}
              >
                <GraduationCap size={14} />
                <span>
                  {dict.topbar.phrasebankCapsule} ({phraseKeyHint}) ·{' '}
                  {!phrasebankEnabled
                    ? dict.topbar.phrasebankDisabled
                    : phrasebankVisible
                      ? dict.topbar.phrasebankShown
                      : dict.topbar.phrasebankHidden}
                </span>
              </button>
              <div className="arc-dropdown-divider" />
              {doc.coverXmlNodes.length > 0 && (
                <button
                  className="arc-btn arc-dropdown-item"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenCoverSplit();
                  }}
                >
                  <Scissors size={14} />
                  <span>{dict.topbar.adjustCoverBlocks} ({doc.coverXmlNodes.length})</span>
                </button>
              )}
              <button
                className="arc-btn arc-dropdown-item"
                onClick={() => {
                  setOpenMenu(null);
                  onToggleSeal();
                }}
              >
                {doc.isSealed ? <Lock size={14} color="#dc2626" /> : <Unlock size={14} />}
                <span>{doc.isSealed ? dict.actions.unseal : dict.actions.seal}</span>
              </button>
              {onOpenTutorial && (
                <>
                  <div className="arc-dropdown-divider" />
                  <button
                    className="arc-btn arc-dropdown-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onHaptic?.('light');
                      onOpenTutorial();
                    }}
                  >
                    <BookOpen size={14} />
                    <span>{dict.topbar.tutorialReplay}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Layout Memory & Presets Dropdown (hidden in tablet-portrait compact bar) */}
          {!isTabletPortrait && (
          <div ref={layoutMenuRef} style={{ position: 'relative' }}>
            <button
              className="arc-btn"
              onClick={() => setOpenMenu((m) => (m === 'layout' ? null : 'layout'))}
              title={dict.topbar.layoutManageTip}
            >
              <LayoutTemplate size={14} color="var(--accent)" />
              <span>{dict.topbar.layout}</span>
              <ChevronDown
                size={13}
                className={`arc-chevron-rot ${openMenu === 'layout' ? 'is-open' : ''}`}
              />
            </button>

            <div
              className={`arc-dropdown-menu ${openMenu === 'layout' ? 'is-open' : ''}`}
              style={{ left: 0, width: 320, padding: 8 }}
            >
              <form
                style={{ display: 'flex', gap: 6, marginBottom: 6 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  onSaveLayoutPreset(newPresetName);
                  setNewPresetName('');
                }}
              >
                <input
                  type="text"
                  className="arc-input"
                  style={{ height: 28, fontSize: 12, flex: 1 }}
                  placeholder={dict.topbar.layoutPlaceholder}
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                />
                <button
                  type="submit"
                  className="arc-btn arc-btn-primary"
                  style={{ height: 28, fontSize: 11.5, padding: '0 9px', flexShrink: 0 }}
                >
                  <Plus size={12} />
                  <span>{dict.topbar.savePreset}</span>
                </button>
              </form>

              <div className="arc-dropdown-divider" />

              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {layoutPresets.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  const badges = summarizeLayoutBadges(preset.layout);
                  return (
                    <div
                      key={preset.id}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 'var(--arc-radius-sm)',
                        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-subtle)'}`,
                        background: isActive ? 'var(--accent-soft)' : 'var(--bg-surface)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <button
                          type="button"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontWeight: 600,
                            fontSize: 12,
                            textAlign: 'left',
                            flex: 1,
                            minWidth: 0,
                          }}
                          onClick={() => {
                            onApplyLayoutPreset(preset);
                            setOpenMenu(null);
                          }}
                        >
                          {isActive && <Check size={12.5} color="var(--accent)" />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {preset.name}
                          </span>
                          {preset.builtin && (
                            <span className="arc-badge" style={{ fontSize: 10, padding: '0 5px' }}>
                              {dict.topbar.builtin}
                            </span>
                          )}
                        </button>

                        {!preset.builtin && (
                          <div style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
                            <button
                              type="button"
                              className="arc-btn arc-icon-btn"
                              style={{ height: 22, minWidth: 22, padding: '0 4px' }}
                              onClick={() => onOverwriteLayoutPreset(preset.id)}
                              title={dict.topbar.overwritePresetTip}
                            >
                              <RefreshCw size={11} />
                            </button>
                            <button
                              type="button"
                              className="arc-btn arc-icon-btn"
                              style={{ height: 22, minWidth: 22, padding: '0 4px', color: '#dc2626' }}
                              onClick={() => onDeleteLayoutPreset(preset.id)}
                              title={dict.topbar.deletePresetTip}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {badges.map((b) => (
                          <span
                            key={b}
                            style={{
                              fontSize: 10,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: 'var(--bg-subtle)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="arc-dropdown-divider" />
              <button
                type="button"
                className="arc-btn arc-dropdown-item"
                onClick={() => {
                  onResetDefaultLayout();
                  setOpenMenu(null);
                }}
              >
                <RotateCcw size={13} />
                <span>{dict.topbar.resetLayout}</span>
              </button>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Right Zone: Undo/Redo + Snapshot + Export + Sync + Fullscreen + Right Sidebar Toggle + Settings */}
      <div className="arc-toolbar-group" style={{ flexShrink: 0 }}>
        <button
          className="arc-btn arc-icon-btn"
          disabled={!canUndo}
          onClick={() => {
            onHaptic?.('light');
            onUndo();
          }}
          title={undoLabel ? `${dict.actions.undo}: ${undoLabel} (${undoKeyHint})` : `${dict.actions.undo} (${undoKeyHint})`}
        >
          <Undo2 size={14} />
          {undoCount > 0 && <span style={{ fontSize: 11 }}>{undoCount}</span>}
        </button>

        <button
          className="arc-btn arc-icon-btn"
          disabled={!canRedo}
          onClick={() => {
            onHaptic?.('light');
            onRedo();
          }}
          title={redoLabel ? `${dict.actions.redo}: ${redoLabel} (${redoKeyHint})` : `${dict.actions.redo} (${redoKeyHint})`}
        >
          <Redo2 size={14} />
          {redoCount > 0 && <span style={{ fontSize: 11 }}>{redoCount}</span>}
        </button>

        {doc && (
          <>
            <button
              data-tour="topbar-snapshot-btn"
              className={`arc-btn arc-btn-primary arc-btn-pill ${haloPulse ? 'arc-halo-pulse' : ''}`}
              onClick={() => {
                onHaptic?.('success');
                onSaveMilestone();
              }}
              title={dict.topbar.saveMilestoneTip}
            >
              <BookmarkPlus size={14} />
              <span>{dict.topbar.snapshotShort}</span>
            </button>

            {!isTabletPortrait && (
            <>
            <div ref={exportMenuRef} style={{ position: 'relative' }}>
              <button
                data-tour="topbar-export-btn"
                className="arc-btn"
                onClick={() => setOpenMenu((m) => (m === 'export' ? null : 'export'))}
              >
                <Download size={14} />
                {!isCompactTopbar && <span>{dict.topbar.exportShort}</span>}
                <ChevronDown
                  size={13}
                  className={`arc-chevron-rot ${openMenu === 'export' ? 'is-open' : ''}`}
                />
              </button>
              <div
                data-tour="topbar-export-menu"
                className={`arc-dropdown-menu ${openMenu === 'export' ? 'is-open' : ''}`}
                style={{ right: 0, minWidth: 244, width: 'max-content', maxWidth: 'min(360px, calc(100vw - 24px))' }}
              >
                <button
                  className="arc-btn arc-dropdown-item"
                  onClick={() => {
                    setOpenMenu(null);
                    onExportCleanWord();
                  }}
                >
                  {dict.actions.exportCleanWord}
                </button>
                <button
                  className="arc-btn arc-dropdown-item"
                  onClick={() => {
                    setOpenMenu(null);
                    onExportRedlineWord();
                  }}
                >
                  {dict.actions.exportRedlineWord}
                </button>
                <div className="arc-dropdown-divider" />
                <button
                  className="arc-btn arc-dropdown-item"
                  onClick={() => {
                    setOpenMenu(null);
                    onExportText('markdown');
                  }}
                >
                  {dict.actions.exportMd}
                </button>
                <button
                  className="arc-btn arc-dropdown-item"
                  onClick={() => {
                    setOpenMenu(null);
                    onExportText('latex');
                  }}
                >
                  {dict.actions.exportTex}
                </button>
              </div>
            </div>

            <button
              className="arc-btn"
              onClick={onEnterFullscreen}
              title={dict.topbar.fullscreenTip}
            >
              <Maximize2 size={14} />
              <span>{dict.topbar.fullscreen}</span>
            </button>
            </>
            )}

            <button
              className="arc-btn arc-icon-btn"
              onClick={() => {
                onHaptic?.('light');
                onToggleRightSidebar();
              }}
              title={rightCollapsed ? dict.topbar.expandRight : dict.topbar.collapseRight}
            >
              {rightCollapsed ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}
              {openAnnotationCount > 0 && (
                <span style={{ fontSize: 11, color: 'var(--arc-revision-color)', fontWeight: 700 }}>
                  {openAnnotationCount}
                </span>
              )}
            </button>
          </>
        )}

        {onOpenSync && (
          <button
            className="arc-btn arc-icon-btn"
            onClick={() => {
              onHaptic?.('light');
              onOpenSync();
            }}
            title={dict.topbar.syncTip}
            style={{ position: 'relative' }}
          >
            <Wifi size={14} />
            {syncConflictCount > 0 && (
              <span className="arc-topbar-dot-badge">{syncConflictCount}</span>
            )}
          </button>
        )}

        {isTabletPortrait ? (
          <div ref={mobileMoreRef} style={{ position: 'relative' }}>
            <button
              type="button"
              data-tour="topbar-more-btn"
              className="arc-btn arc-icon-btn"
              onClick={() => {
                onHaptic?.('selection');
                setOpenMenu((m) => (m === 'mobile-more' ? null : 'mobile-more'));
              }}
              title={dict.topbar.moreLabel}
            >
              <MoreHorizontal size={15} />
            </button>
            <div
              className={`arc-dropdown-menu ${openMenu === 'mobile-more' ? 'is-open' : ''}`}
              style={{ right: 0, minWidth: 240, width: 'max-content', maxWidth: 'min(340px, calc(100vw - 24px))', maxHeight: '72vh', overflowY: 'auto' }}
            >
              {doc && onOpenTimelineSheet && (
                <button
                  type="button"
                  className="arc-btn arc-dropdown-item"
                  onClick={() => {
                    setOpenMenu(null);
                    onHaptic?.('light');
                    onOpenTimelineSheet();
                  }}
                >
                  <Clock size={14} />
                  <span>{dict.topbar.timelineSheet}</span>
                </button>
              )}
              {doc && (
                <>
                  <button
                    type="button"
                    className="arc-btn arc-dropdown-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onExportCleanWord();
                    }}
                  >
                    <Download size={14} />
                    <span>{dict.actions.exportCleanWord}</span>
                  </button>
                  <button
                    type="button"
                    className="arc-btn arc-dropdown-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onExportRedlineWord();
                    }}
                  >
                    <Download size={14} />
                    <span>{dict.actions.exportRedlineWord}</span>
                  </button>
                  <button
                    type="button"
                    className="arc-btn arc-dropdown-item"
                    onClick={() => {
                      setOpenMenu(null);
                      onExportText(activeFormat);
                    }}
                  >
                    <Download size={14} />
                    <span>{dict.topbar.exportShort} {activeFormat === 'markdown' ? '.md' : '.tex'}</span>
                  </button>
                  <div className="arc-dropdown-divider" />
                </>
              )}
              {onOpenCameraScan && (
                <button
                  type="button"
                  className="arc-btn arc-dropdown-item"
                  onClick={() => {
                    setOpenMenu(null);
                    onHaptic?.('light');
                    onOpenCameraScan();
                  }}
                >
                  <Camera size={14} />
                  <span>{dict.topbar.cameraScan}</span>
                </button>
              )}
              {onOpenShareIntake && (
                <button
                  type="button"
                  className="arc-btn arc-dropdown-item"
                  onClick={() => {
                    setOpenMenu(null);
                    onHaptic?.('light');
                    onOpenShareIntake();
                  }}
                >
                  <Share2 size={14} />
                  <span>{dict.topbar.shareIntake}</span>
                </button>
              )}
              {onOpenTutorial && (
                <button
                  type="button"
                  className="arc-btn arc-dropdown-item"
                  onClick={() => {
                    setOpenMenu(null);
                    onHaptic?.('light');
                    onOpenTutorial();
                  }}
                >
                  <BookOpen size={14} />
                  <span>{dict.topbar.tutorialShort}</span>
                </button>
              )}
            </div>
          </div>
        ) : null}

        <button className="arc-btn arc-icon-btn" onClick={onOpenSettings} title={dict.actions.settings}>
          <Settings size={14} />
        </button>

        {showCustomWinControls && (
          <div className="arc-win-controls" role="group" aria-label={dict.topbar.winControls}>
            <button
              type="button"
              className="arc-win-ctrl-btn"
              onClick={() => void nativeWindowMinimize()}
              title={dict.topbar.winMinimize}
              aria-label={dict.topbar.winMinimize}
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              className="arc-win-ctrl-btn"
              onClick={async () => setIsMaximized(await nativeWindowToggleMaximize())}
              title={isMaximized ? dict.topbar.winRestore : dict.topbar.winMaximize}
              aria-label={isMaximized ? dict.topbar.winRestore : dict.topbar.winMaximize}
            >
              {isMaximized ? <Copy size={12} /> : <Square size={12} />}
            </button>
            <button
              type="button"
              className="arc-win-ctrl-btn is-close"
              onClick={() => void nativeWindowClose()}
              title={dict.topbar.winClose}
              aria-label={dict.topbar.winClose}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
