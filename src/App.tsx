import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Menu,
  Minimize2,
  Monitor,
  PanelLeftOpen,
  PanelRightOpen,
  ShieldAlert,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';
import { TopBar } from './components/TopBar';
import { buildThemedFaviconDataUrl } from './components/ArcVaultLogo';
import { GlobalTooltipHost } from './components/GlobalTooltipHost';
import { ResizeSash } from './components/ResizeSash';
import { TouchScrollScrubber } from './components/TouchScrollScrubber';
import {
  installGlobalBackDispatcher,
  type BackActionResult,
} from './platform/backProtection';
import { startResizeDrag } from './platform/resizeDrag';
import {
  getSimulatedFrameDimensions,
  useDeviceEnvironment,
} from './platform/device';
import {
  DEFAULT_HAPTICS,
  normalizeHapticsSettings,
  triggerHaptic,
} from './platform/haptics';
import {
  DEFAULT_GYROSCOPE,
  normalizeGyroscopeSettings,
} from './platform/backgroundMotion';
import { Sidebar } from './components/Sidebar';
import { EditorWorkspace } from './components/EditorWorkspace';
import { TimelinePanel } from './components/TimelinePanel';
import { CoverSplitModal } from './components/CoverSplitModal';
import { DiffViewerModal } from './components/DiffViewerModal';
import { SettingsModal } from './components/SettingsModal';
import { BranchModal } from './components/BranchModal';
import { ContextAssetsModal } from './components/ContextAssetsModal';
import { PaperStudioModal } from './components/PaperStudioModal';
import { EvolutionStudioModal } from './components/EvolutionStudioModal';
import { VaultLockModal } from './components/VaultLockModal';
import { CameraScanModal } from './components/CameraScanModal';
import { ShareIntakeModal } from './components/ShareIntakeModal';
import { SyncModal } from './components/SyncModal';
import { TrashModal } from './components/TrashModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import {
  canMoveDocumentToTrash,
  getActiveDocuments,
  getTrashedDocuments,
  moveDocumentToTrash,
  restoreDocumentFromTrash,
} from './core/trash';
import {
  hasCompletedOnboarding,
  markOnboardingCompleted,
  type TutorialMode,
  type TutorialSceneId,
} from './core/tutorial';
import { CelestialCanvas } from './components/celestial/CelestialCanvas';
import { DEFAULT_CELESTIAL } from './components/celestial/celestialShaders';
import { WeatherCanvas } from './components/weather/WeatherCanvas';
import {
  DEFAULT_WEATHER,
  fetchLiveWeather,
  pickRandomWeatherCombo,
} from './core/weatherService';
import {
  applyWeatherThemeVariables,
  resolveWeatherThemePalette,
} from './core/weatherTheme';
import { zhCN, enUS } from './i18n/dictionaries';
import { CasObjectStore, createDocumentSnapshot } from './core/casStore';
import {
  CommandHistory,
  adjustAnchorsForTextEdit,
  applyAnnotationTextReplacement,
  applyBatchAnnotationAction,
  type HistoryPushOptions,
} from './core/commandHistory';
import { extractDeletedDarlings } from './core/diffEngine';
import { generateSnapshotSummary, resolveEffectiveAiPolicy } from './core/aiGateway';
import { createParallelBranch } from './core/branchManager';
import {
  DEFAULT_TYPOGRAPHY,
  resolveEditorFontStack,
  resolveUiFontStack,
} from './core/typography';
import {
  DEFAULT_MONET,
  applyMonetCssVariables,
  generateMonetTokens,
} from './core/monetEngine';
import { BUILTIN_SKILLS, resolveMergedSkills } from './core/skillRegistry';
import {
  DEFAULT_PHRASEBANK_SETTINGS,
  normalizePhrasebankSettings,
} from './core/phrasebank/phrasebankStorage';
import {
  BUILTIN_LAYOUT_PRESETS,
  capsuleLayoutFromSettings,
  createCustomLayoutPreset,
  deleteCustomLayoutPreset,
  getAllLayoutPresets,
  isLayoutMatchingPreset,
  loadCustomLayoutPresets,
  loadPersistedLayout,
  saveCustomLayoutPresets,
  savePersistedLayout,
  summarizeLayoutBadges,
  updateCustomLayoutPreset,
  type DocumentScrollState,
  type WorkspaceLayoutConfig,
  type WorkspaceLayoutPreset,
} from './core/workspaceLayout';
import { sha256Hex } from './core/hash';
import { decryptVaultText, encryptVaultText } from './core/vaultCrypto';
import { parsePptxBytes, parseXlsxBytes } from './core/officeParser';
import {
  parseDocxBytes,
  extractBodyWithCoverIndex,
  type ParsedDocxBundle,
} from './core/ooxml/docxParser';
import { isZipHeader, parseDocBytes } from './core/ooxml/docParser';
import { syncFormatText } from './core/ooxml/formatConverter';
import { exportToDocx } from './core/ooxml/docxExporter';
import { buildSamplePaperDocx } from './core/ooxml/sampleDocxBuilder';
import { DEFAULT_SPACES, seedInitialWorkspace } from './core/demoSeed';
import {
  nativeGetRuntimeInfo,
  nativeLoadWorkspaceBackup,
  nativeOpenBackupFolder,
  nativeOpenVaultFolder,
  nativePickVaultDirectory,
  nativeSaveWorkspaceBackup,
  nativeSetCustomVaultDir,
  nativeStartWatchFolder,
  nativeStopWatchFolder,
  triggerBrowserDownload,
} from './platform/bridge';
import {
  loadWorkspaceFromIndexedDb,
  parseWorkspaceState,
  saveWorkspaceToIndexedDb,
  serializeWorkspaceState,
} from './core/workspaceBackup';
import { createHlc, tickHlc } from './core/sync/hlc';
import {
  DEFAULT_SYNC_SETTINGS,
  normalizeSyncSettings,
  type SyncReconcileResult,
} from './core/sync/syncEngine';
import {
  buildDocumentFromSharePayload,
  parseShareFromLocationSearch,
  type SharePayload,
} from './core/shareIntake';
import type {
  AiPrivacyPolicy,
  AppSettings,
  ArchiveDocument,
  Branch,
  DeletedDarling,
  DocEditableState,
  EditorFormat,
  HapticPattern,
  LinkedAsset,
  MotivationAttachment,
  RenderBackendStatus,
  Snapshot,
  SyncConflictItem,
  SyncOpLogEntry,
  WritingActivityDay,
} from './types/archive';

const SETTINGS_STORAGE_KEY = 'arcvault_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  locale: 'zh-CN',
  commentColor: '#2563eb',
  revisionColor: '#dc2626',
  defaultBackupFormat: 'both',
  autoBackup: {
    enabled: true,
    debounceMinutes: 3,
    dailyTime: '23:00',
    minCharChangeThreshold: 80,
  },
  aiProvider: 'offline-smart',
  aiEndpoint: 'http://localhost:11434/v1',
  aiModel: 'qwen2.5:14b',
  aiApiKey: '',
  aiLocalModelPath: '',
  aiDeepThinking: true,
  aiThinkingEffort: 'medium',
  skills: BUILTIN_SKILLS,
  phrasebank: { ...DEFAULT_PHRASEBANK_SETTINGS },
  watchDirectory: 'D:\\Thesis_Drafts',
  watchActive: false,
  typography: { ...DEFAULT_TYPOGRAPHY },
  monet: { ...DEFAULT_MONET },
  celestial: { ...DEFAULT_CELESTIAL },
  weather: { ...DEFAULT_WEATHER },
  haptics: { ...DEFAULT_HAPTICS },
  gyroscope: { ...DEFAULT_GYROSCOPE },
  devicePreview: 'auto',
  sync: { ...DEFAULT_SYNC_SETTINGS },
  biometricEnabled: false,
};

function loadSavedSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      aiLocalModelPath: parsed.aiLocalModelPath ?? '',
      aiDeepThinking: parsed.aiDeepThinking ?? true,
      aiThinkingEffort:
        parsed.aiThinkingEffort === 'low' ||
        parsed.aiThinkingEffort === 'medium' ||
        parsed.aiThinkingEffort === 'high'
          ? parsed.aiThinkingEffort
          : 'medium',
      autoBackup: { ...DEFAULT_SETTINGS.autoBackup, ...(parsed.autoBackup ?? {}) },
      typography: { ...DEFAULT_TYPOGRAPHY, ...(parsed.typography ?? {}) },
      monet: { ...DEFAULT_MONET, ...(parsed.monet ?? {}) },
      celestial: { ...DEFAULT_CELESTIAL, ...(parsed.celestial ?? {}) },
      weather: { ...DEFAULT_WEATHER, ...(parsed.weather ?? {}) },
      haptics: normalizeHapticsSettings(parsed.haptics),
      gyroscope: normalizeGyroscopeSettings(parsed.gyroscope),
      devicePreview: parsed.devicePreview ?? 'auto',
      sync: normalizeSyncSettings(parsed.sync),
      skills: resolveMergedSkills(parsed.skills),
      phrasebank: normalizePhrasebankSettings(parsed.phrasebank),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function App() {
  const initialLayout = useMemo(() => loadPersistedLayout(), []);
  const [settings, setSettings] = useState<AppSettings>(loadSavedSettings);

  const [spaces] = useState(DEFAULT_SPACES);
  const [activeSpaceId, setActiveSpaceId] = useState(() =>
    DEFAULT_SPACES.some((s) => s.id === initialLayout.activeSpaceId)
      ? initialLayout.activeSpaceId
      : 'sp_paper',
  );
  const [documents, setDocuments] = useState<ArchiveDocument[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(initialLayout.activeDocId);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [darlings, setDarlings] = useState<DeletedDarling[]>([]);
  const [motivations, setMotivations] = useState<MotivationAttachment[]>([]);
  const [linkedAssets, setLinkedAssets] = useState<LinkedAsset[]>([]);
  const [writingActivity, setWritingActivity] = useState<WritingActivityDay[]>([]);
  const [splitPreview, setSplitPreview] = useState(initialLayout.splitPreview);
  const [timelineCollapsed, setTimelineCollapsed] = useState(initialLayout.timelineCollapsed);
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(
    initialLayout.leftSidebarCollapsed,
  );
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(
    initialLayout.rightSidebarCollapsed,
  );
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(initialLayout.leftSidebarWidth);
  const [previewWidth, setPreviewWidth] = useState(initialLayout.previewWidth);
  const [annotationWidth, setAnnotationWidth] = useState(initialLayout.annotationWidth);
  const [timelineHeight, setTimelineHeight] = useState(initialLayout.timelineHeight);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customPresets, setCustomPresets] = useState<WorkspaceLayoutPreset[]>(loadCustomLayoutPresets);
  const scrollPositionsRef = useRef<Record<string, DocumentScrollState>>(
    initialLayout.scrollPositions,
  );
  const [haloPulse, setHaloPulse] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [coverModalData, setCoverModalData] = useState<{
    docId: string;
    bundle: ParsedDocxBundle;
  } | null>(null);

  const [diffModalData, setDiffModalData] = useState<{
    tab: 'diff' | 'darlings';
    leftSnap: Snapshot | null;
    rightSnap: Snapshot | null;
    leftText: string;
    rightText: string;
  } | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'appearance' | 'typography' | 'archive' | 'device' | 'ai' | 'about'>('appearance');
  const [paperStudioInitialTab, setPaperStudioInitialTab] = useState<'consistency' | 'rebuttal'>('consistency');
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [contextAssetsOpen, setContextAssetsOpen] = useState(false);
  const [paperStudioOpen, setPaperStudioOpen] = useState(false);
  const [evolutionStudioOpen, setEvolutionStudioOpen] = useState(false);
  const [vaultLockOpen, setVaultLockOpen] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(true);
  const [vaultPassHash, setVaultPassHash] = useState<string | null>(null);
  const vaultPassRef = useRef<string | null>(null);

  // Phase 4: Cross-platform device environment, haptics, mobile drawers/sheets, sync & native intake
  const deviceEnv = useDeviceEnvironment(settings.devicePreview ?? 'auto');
  const hapticsConfig = useMemo(
    () => normalizeHapticsSettings(settings.haptics),
    [settings.haptics],
  );
  const triggerAppHaptic = useCallback(
    (pattern: HapticPattern) => {
      void triggerHaptic(pattern, {
        settings: hapticsConfig,
        isTouchDevice: deviceEnv.isTouch,
      });
    },
    [hapticsConfig, deviceEnv.isTouch],
  );
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileTimelineOpen, setMobileTimelineOpen] = useState(false);
  const [revisionMode, setRevisionMode] = useState(false);
  const [revisionOrbMenuOpen, setRevisionOrbMenuOpen] = useState(false);
  const revisionExitGuardRef = useRef<(() => boolean) | null>(null);
  const [backGuardVisible, setBackGuardVisible] = useState(false);
  const [backGuardCycle, setBackGuardCycle] = useState(0);
  const backGuardDeadlineRef = useRef(0);
  const backGuardTimerRef = useRef<number | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const [tutorialMode, setTutorialMode] = useState<TutorialMode | null>(() =>
    hasCompletedOnboarding() ? null : 'first-run',
  );
  const [cameraScanOpen, setCameraScanOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareIntakePayload, setShareIntakePayload] = useState<SharePayload | null>(null);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflictItem[]>([]);
  const [syncOplog, setSyncOplog] = useState<SyncOpLogEntry[]>([]);
  const hlcRef = useRef(
    createHlc(normalizeSyncSettings(settings.sync).deviceId),
  );
  const [randomWeatherState, setRandomWeatherState] = useState(() => pickRandomWeatherCombo());
  const [weatherClockTick, setWeatherClockTick] = useState(() => Date.now());
  const [renderStatus, setRenderStatus] = useState<RenderBackendStatus | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState({
    isTauri: false,
    platform: 'Web Preview (Vite)',
    vaultDir: 'Local Storage',
    backupDir: 'Browser IndexedDB (自动草稿与定时快照)',
  });
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const workspaceHydratedRef = useRef(false);

  const weatherCfg = settings.weather ?? DEFAULT_WEATHER;
  const activeWeatherVisual = useMemo(() => {
    if (weatherCfg.mode === 'live') {
      return {
        effects: weatherCfg.liveSnapshot?.mappedEffects ?? weatherCfg.customEffects,
        timeOfDay: weatherCfg.timeOfDay,
        isLiveDay: weatherCfg.liveSnapshot?.isDay,
      };
    }
    if (weatherCfg.mode === 'random') {
      return {
        effects: randomWeatherState.effects,
        timeOfDay:
          weatherCfg.timeOfDay === 'auto' ? randomWeatherState.timeOfDay : weatherCfg.timeOfDay,
        isLiveDay: undefined,
      };
    }
    return {
      effects: weatherCfg.customEffects.length > 0 ? weatherCfg.customEffects : DEFAULT_WEATHER.customEffects,
      timeOfDay: weatherCfg.timeOfDay,
      isLiveDay: undefined,
    };
  }, [weatherCfg, randomWeatherState]);

  const casRef = useRef<CasObjectStore>(new CasObjectStore());
  const parsedBundlesRef = useRef<Record<string, ParsedDocxBundle>>({});
  const historiesRef = useRef<Record<string, CommandHistory<DocEditableState>>>({});
  const dirtyFormatSourceRef = useRef<Map<string, EditorFormat>>(new Map());
  const formatSyncTimerRef = useRef<number | null>(null);
  const documentsRef = useRef<ArchiveDocument[]>([]);
  documentsRef.current = documents;
  const snapshotsRef = useRef<Snapshot[]>([]);
  snapshotsRef.current = snapshots;
  const [, setHistoryTick] = useState(0);

  const preTutorialStateRef = useRef<{
    spaceId: string;
    docId: string | null;
    leftSidebarCollapsed: boolean;
    rightSidebarCollapsed: boolean;
    splitPreview: boolean;
    timelineCollapsed: boolean;
    phrasebankEnabled: boolean;
    phrasebankDismissed: boolean;
    phrasebankCollapsed: boolean;
  } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3200);
  }, []);

  const triggerHalo = useCallback(() => {
    setHaloPulse(true);
    setTimeout(() => setHaloPulse(false), 950);
  }, []);

  const pbConfig = useMemo(
    () => normalizePhrasebankSettings(settings.phrasebank),
    [settings.phrasebank],
  );
  const capsuleDismissed = Boolean(pbConfig.dismissed);

  const setCapsuleDismissed = useCallback((dismissed: boolean) => {
    setSettings((s) => ({
      ...s,
      phrasebank: { ...normalizePhrasebankSettings(s.phrasebank), dismissed },
    }));
  }, []);

  const persistCurrentLayoutSnapshot = useCallback(
    (overrideScroll?: Record<string, DocumentScrollState>) => {
      savePersistedLayout({
        leftSidebarCollapsed,
        rightSidebarCollapsed,
        splitPreview,
        timelineCollapsed,
        leftSidebarWidth,
        previewWidth,
        annotationWidth,
        timelineHeight,
        activeSpaceId,
        activeDocId,
        scrollPositions: overrideScroll ?? scrollPositionsRef.current,
      });
    },
    [
      leftSidebarCollapsed,
      rightSidebarCollapsed,
      splitPreview,
      timelineCollapsed,
      leftSidebarWidth,
      previewWidth,
      annotationWidth,
      timelineHeight,
      activeSpaceId,
      activeDocId,
    ],
  );

  useEffect(() => {
    persistCurrentLayoutSnapshot();
  }, [persistCurrentLayoutSnapshot]);

  useEffect(() => {
    saveCustomLayoutPresets(customPresets);
  }, [customPresets]);

  const handleScrollPositionChange = useCallback(
    (docId: string, scroll: DocumentScrollState) => {
      scrollPositionsRef.current = {
        ...scrollPositionsRef.current,
        [docId]: scroll,
      };
      persistCurrentLayoutSnapshot(scrollPositionsRef.current);
    },
    [persistCurrentLayoutSnapshot],
  );

  const currentLayoutConfig = useMemo<WorkspaceLayoutConfig>(
    () => ({
      leftSidebarCollapsed,
      rightSidebarCollapsed,
      splitPreview,
      timelineCollapsed,
      leftSidebarWidth,
      previewWidth,
      annotationWidth,
      timelineHeight,
      capsule: capsuleLayoutFromSettings(pbConfig),
    }),
    [
      leftSidebarCollapsed,
      rightSidebarCollapsed,
      splitPreview,
      timelineCollapsed,
      leftSidebarWidth,
      previewWidth,
      annotationWidth,
      timelineHeight,
      pbConfig,
    ],
  );

  const allLayoutPresets = useMemo(
    () => getAllLayoutPresets(customPresets),
    [customPresets],
  );

  const activePresetId = useMemo(
    () => allLayoutPresets.find((p) => isLayoutMatchingPreset(currentLayoutConfig, p))?.id ?? null,
    [allLayoutPresets, currentLayoutConfig],
  );

  const currentLayoutSummary = useMemo(
    () => summarizeLayoutBadges(currentLayoutConfig),
    [currentLayoutConfig],
  );

  const handleApplyLayoutPreset = useCallback(
    (preset: WorkspaceLayoutPreset) => {
      const l = preset.layout;
      setLeftSidebarCollapsed(l.leftSidebarCollapsed);
      setRightSidebarCollapsed(l.rightSidebarCollapsed);
      setSplitPreview(l.splitPreview);
      setTimelineCollapsed(l.timelineCollapsed);
      setLeftSidebarWidth(l.leftSidebarWidth);
      setPreviewWidth(l.previewWidth);
      setAnnotationWidth(l.annotationWidth);
      setTimelineHeight(l.timelineHeight);
      setSettings((s) => ({
        ...s,
        phrasebank: {
          enabled: l.capsule.enabled,
          dismissed: l.capsule.dismissed,
          collapsed: l.capsule.collapsed,
          scope: l.capsule.scope,
          visibleIcons: [...l.capsule.visibleIcons],
          position: l.capsule.position ? { ...l.capsule.position } : null,
        },
      }));
      showToast(`已切换布局预设：${preset.name}`);
    },
    [showToast],
  );

  const handleSaveLayoutPreset = useCallback(
    (name: string) => {
      const { preset, list } = createCustomLayoutPreset(name, currentLayoutConfig, customPresets);
      setCustomPresets(list);
      showToast(`已将当前布局存为预设：${preset.name}`);
    },
    [currentLayoutConfig, customPresets, showToast],
  );

  const handleOverwriteLayoutPreset = useCallback(
    (presetId: string) => {
      const target = customPresets.find((p) => p.id === presetId);
      setCustomPresets((prev) => updateCustomLayoutPreset(presetId, currentLayoutConfig, prev));
      showToast(target ? `已更新预设：${target.name}` : '已更新布局预设');
    },
    [customPresets, currentLayoutConfig, showToast],
  );

  const handleDeleteLayoutPreset = useCallback(
    (presetId: string) => {
      const target = customPresets.find((p) => p.id === presetId);
      setCustomPresets((prev) => deleteCustomLayoutPreset(presetId, prev));
      showToast(target ? `已删除预设：${target.name}` : '已删除布局预设');
    },
    [customPresets, showToast],
  );

  const handleResetDefaultLayout = useCallback(() => {
    handleApplyLayoutPreset(BUILTIN_LAYOUT_PRESETS[0]);
  }, [handleApplyLayoutPreset]);

  const handleClearScrollMemory = useCallback(() => {
    scrollPositionsRef.current = {};
    persistCurrentLayoutSnapshot({});
    showToast('已清空所有文档的页面滚动记忆');
  }, [persistCurrentLayoutSnapshot, showToast]);

  // Refresh weather theme clock tick once per minute when auto solar color adaptation is active
  useEffect(() => {
    if (
      settings.theme !== 'weather-live' ||
      !(weatherCfg.adaptColorByTime ?? true) ||
      activeWeatherVisual.timeOfDay !== 'auto'
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setWeatherClockTick(Date.now());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [settings.theme, weatherCfg.adaptColorByTime, activeWeatherVisual.timeOfDay]);

  // Initialize workspace (restore from crash-safe local backup first, fallback to demo seed), runtime info & URL share intent
  useEffect(() => {
    let cancelled = false;
    const sharePayload = parseShareFromLocationSearch(window.location.search);
    if (sharePayload) {
      setShareIntakePayload(sharePayload);
      setShareModalOpen(true);
    }
    nativeGetRuntimeInfo().then(setRuntimeInfo).catch(() => {});

    (async () => {
      const nativeRaw = await nativeLoadWorkspaceBackup();
      const raw = nativeRaw ?? (await loadWorkspaceFromIndexedDb());
      const restored = parseWorkspaceState(raw);
      if (!cancelled && restored && restored.documents.length > 0) {
        casRef.current = new CasObjectStore(restored.casObjects);
        setDocuments(restored.documents);
        setBranches(restored.branches);
        setSnapshots(restored.snapshots);
        setDarlings(restored.darlings);
        setMotivations(restored.motivations);
        setLinkedAssets(restored.linkedAssets);
        setWritingActivity(restored.writingActivity);
        setLastBackupAt(restored.savedAt);
        const preferredDoc = initialLayout.activeDocId
          ? restored.documents.find((d) => d.id === initialLayout.activeDocId)
          : undefined;
        const targetDoc =
          preferredDoc ??
          restored.documents.find((d) => d.id === restored.activeDocId) ??
          restored.documents[0];
        if (targetDoc) {
          setActiveDocId(targetDoc.id);
          setActiveSpaceId(targetDoc.spaceId);
        } else {
          setActiveSpaceId(restored.activeSpaceId);
        }
        workspaceHydratedRef.current = true;
        return;
      }

      const seed = await seedInitialWorkspace();
      if (cancelled) return;
      casRef.current = seed.cas;
      parsedBundlesRef.current = seed.parsedBundles;
      setDocuments(seed.documents);
      setBranches(seed.branches);
      setSnapshots(seed.snapshots);
      setDarlings(seed.darlings);
      setMotivations(seed.motivations);
      setLinkedAssets(seed.linkedAssets);
      setWritingActivity(seed.writingActivity);
      const preferredDoc = initialLayout.activeDocId
        ? seed.documents.find((d) => d.id === initialLayout.activeDocId)
        : undefined;
      if (preferredDoc) {
        setActiveDocId(preferredDoc.id);
        setActiveSpaceId(preferredDoc.spaceId);
      } else {
        setActiveDocId(seed.documents[0]?.id ?? null);
      }
      workspaceHydratedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [initialLayout.activeDocId]);

  const syncDocFormatsIfDirty = useCallback((doc: ArchiveDocument): ArchiveDocument => {
    const sourceFmt = dirtyFormatSourceRef.current.get(doc.id);
    if (!sourceFmt) return doc;
    dirtyFormatSourceRef.current.delete(doc.id);
    if (sourceFmt === 'markdown') {
      const nextTex = syncFormatText(doc.markdownText, 'markdown', 'latex');
      return nextTex === doc.latexText ? doc : { ...doc, latexText: nextTex };
    }
    const nextMd = syncFormatText(doc.latexText, 'latex', 'markdown');
    return nextMd === doc.markdownText ? doc : { ...doc, markdownText: nextMd };
  }, []);

  const flushAllDirtyFormatSyncs = useCallback(() => {
    if (formatSyncTimerRef.current !== null) {
      window.clearTimeout(formatSyncTimerRef.current);
      formatSyncTimerRef.current = null;
    }
    if (dirtyFormatSourceRef.current.size === 0) return;
    setDocuments((prev) => {
      let changed = false;
      const next = prev.map((d) => {
        const synced = syncDocFormatsIfDirty(d);
        if (synced !== d) changed = true;
        return synced;
      });
      return changed ? next : prev;
    });
  }, [syncDocFormatsIfDirty]);

  const scheduleDeferredFormatSync = useCallback(
    (docId: string, sourceFmt: EditorFormat) => {
      dirtyFormatSourceRef.current.set(docId, sourceFmt);
      if (formatSyncTimerRef.current !== null) {
        window.clearTimeout(formatSyncTimerRef.current);
      }
      formatSyncTimerRef.current = window.setTimeout(() => {
        formatSyncTimerRef.current = null;
        const win = window as Window & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        };
        if (typeof win.requestIdleCallback === 'function') {
          win.requestIdleCallback(() => flushAllDirtyFormatSyncs(), { timeout: 600 });
        } else {
          flushAllDirtyFormatSyncs();
        }
      }, 1200);
    },
    [flushAllDirtyFormatSyncs],
  );

  useEffect(() => {
    return () => {
      if (formatSyncTimerRef.current !== null) {
        window.clearTimeout(formatSyncTimerRef.current);
        formatSyncTimerRef.current = null;
      }
    };
  }, []);

  const buildBackupPayload = useCallback(
    () => {
      const syncedDocs =
        dirtyFormatSourceRef.current.size === 0
          ? documents
          : documents.map((d) => syncDocFormatsIfDirty(d));
      return serializeWorkspaceState({
        activeSpaceId,
        activeDocId,
        documents: syncedDocs,
        branches,
        snapshots,
        darlings,
        motivations,
        linkedAssets,
        writingActivity,
        casObjects: casRef.current.exportAll(),
      });
    },
    [
      activeSpaceId,
      activeDocId,
      documents,
      branches,
      snapshots,
      darlings,
      motivations,
      linkedAssets,
      writingActivity,
      syncDocFormatsIfDirty,
    ],
  );

  const persistWorkspaceBackup = useCallback(
    async (scheduled: boolean): Promise<string | null> => {
      if (!workspaceHydratedRef.current || documents.length === 0) return null;
      const payload = buildBackupPayload();
      await saveWorkspaceToIndexedDb(payload);
      const nativePath = await nativeSaveWorkspaceBackup(payload, scheduled);
      if (scheduled) {
        setLastBackupAt(new Date().toISOString());
      }
      return nativePath;
    },
    [buildBackupPayload, documents.length],
  );

  // Crash-safe debounced auto-save on workspace changes + flush on page unload
  useEffect(() => {
    if (!workspaceHydratedRef.current || documents.length === 0) return;
    const timer = window.setTimeout(() => {
      void persistWorkspaceBackup(false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    documents,
    branches,
    snapshots,
    darlings,
    motivations,
    linkedAssets,
    writingActivity,
    activeSpaceId,
    activeDocId,
    persistWorkspaceBackup,
  ]);

  useEffect(() => {
    const flushNow = () => {
      if (!workspaceHydratedRef.current || documents.length === 0) return;
      void persistWorkspaceBackup(false);
    };
    window.addEventListener('beforeunload', flushNow);
    window.addEventListener('pagehide', flushNow);
    return () => {
      window.removeEventListener('beforeunload', flushNow);
      window.removeEventListener('pagehide', flushNow);
    };
  }, [documents.length, persistWorkspaceBackup]);

  // Scheduled automatic backup into <vaultDir>/backups/
  useEffect(() => {
    const intervalMinutes = Math.max(1, settings.autoBackup?.debounceMinutes ?? 3);
    const intervalMs = intervalMinutes * 60_000;
    const timer = window.setInterval(() => {
      void persistWorkspaceBackup(true);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [settings.autoBackup?.debounceMinutes, persistWorkspaceBackup]);

  const handleOpenBackupFolder = useCallback(async () => {
    const res = await nativeOpenBackupFolder();
    if (res.ok) {
      showToast(`已打开备份文件夹：${res.path}`);
    } else if (!runtimeInfo.isTauri) {
      const payload = buildBackupPayload();
      triggerBrowserDownload(
        `arcvault-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`,
        payload,
        'application/json',
      );
      showToast('Web 端无本地文件夹权限，已为你导出当前完整备份文件');
    } else {
      showToast(`打开备份文件夹失败：${res.message ?? '未知错误'}`);
    }
  }, [buildBackupPayload, runtimeInfo.isTauri, showToast]);

  const handleRunManualBackup = useCallback(async () => {
    const nativePath = await persistWorkspaceBackup(true);
    if (nativePath) {
      showToast(`已完成备份：${nativePath}`);
    } else {
      showToast('已更新本地 IndexedDB 自动备份');
    }
  }, [persistWorkspaceBackup, showToast]);

  const handleOpenVaultFolder = useCallback(async () => {
    const res = await nativeOpenVaultFolder();
    if (res.ok) {
      showToast(`已打开缓存目录：${res.path}`);
    } else if (!runtimeInfo.isTauri) {
      showToast(`当前缓存位置：${runtimeInfo.vaultDir}（Web 预览模式无法打开系统文件夹）`);
    } else {
      showToast(`当前缓存目录：${runtimeInfo.vaultDir}`);
    }
  }, [runtimeInfo.isTauri, runtimeInfo.vaultDir, showToast]);

  const handlePickVaultDirectory = useCallback(async () => {
    return nativePickVaultDirectory();
  }, []);

  const handleSetCustomVaultDir = useCallback(
    async (path: string) => {
      const nextInfo = await nativeSetCustomVaultDir(path);
      setRuntimeInfo(nextInfo);
      await persistWorkspaceBackup(true);
      showToast(`已切换缓存与备份目录至：${nextInfo.vaultDir}`);
    },
    [persistWorkspaceBackup, showToast],
  );

  // Apply theme, custom colors, typography CSS variables & persist settings
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.style.setProperty('--arc-comment-color', settings.commentColor);
    root.style.setProperty('--arc-revision-color', settings.revisionColor);

    const typo = settings.typography ?? DEFAULT_TYPOGRAPHY;
    root.style.setProperty('--arc-ui-font', resolveUiFontStack(typo));
    root.style.setProperty('--arc-editor-font', resolveEditorFontStack(typo));
    root.style.setProperty('--arc-editor-font-size', `${typo.editorFontSize}px`);
    root.style.setProperty('--arc-editor-line-height', String(typo.editorLineHeight));

    const wCfg = settings.weather ?? DEFAULT_WEATHER;
    const adaptWeatherColor = wCfg.adaptColorByTime ?? true;

    // Clear inactive dynamic theme overrides before applying the active theme
    if (settings.theme !== 'm3-expressive') {
      applyMonetCssVariables(root, null);
    }
    if (settings.theme !== 'weather-live' || !adaptWeatherColor) {
      applyWeatherThemeVariables(root, null);
    }

    let monetTokens: ReturnType<typeof generateMonetTokens> | null = null;
    if (settings.theme === 'm3-expressive') {
      monetTokens = generateMonetTokens(settings.monet ?? DEFAULT_MONET);
      applyMonetCssVariables(root, monetTokens);
    }

    if (settings.theme !== 'celestial-optics' && settings.theme !== 'weather-live') {
      setRenderStatus(null);
    }

    let iconLink = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      document.head.appendChild(iconLink);
    }
    iconLink.type = 'image/svg+xml';
    iconLink.href = buildThemedFaviconDataUrl(
      settings.theme,
      monetTokens
        ? {
            primary: monetTokens.primary,
            primaryContainer: monetTokens.primaryContainer,
            secondary: monetTokens.secondary,
            tertiary: monetTokens.tertiary,
          }
        : undefined,
    );

    const cel = settings.celestial ?? DEFAULT_CELESTIAL;
    if (settings.theme === 'celestial-optics') {
      const g = Math.max(0, Math.min(1, cel.glassOpacity));
      root.style.setProperty('--celestial-glass-alpha', (g * 0.78).toFixed(3));
      root.style.setProperty('--celestial-glass-alpha-strong', (g * 0.86).toFixed(3));
      root.style.setProperty('--celestial-glass-card-alpha', (g * 0.72).toFixed(3));
      root.style.setProperty(
        '--celestial-glass-filter',
        g <= 0.001
          ? 'none'
          : `blur(${(g * 24).toFixed(1)}px) saturate(${Math.round(100 + g * 40)}%)`,
      );
    } else {
      root.style.removeProperty('--celestial-glass-alpha');
      root.style.removeProperty('--celestial-glass-alpha-strong');
      root.style.removeProperty('--celestial-glass-card-alpha');
      root.style.removeProperty('--celestial-glass-filter');
    }

    if (settings.theme === 'weather-live') {
      const wg = Math.max(0, Math.min(1, wCfg.glassOpacity));
      root.style.setProperty('--weather-glass-alpha', (wg * 0.78).toFixed(3));
      root.style.setProperty('--weather-glass-alpha-strong', (wg * 0.86).toFixed(3));
      root.style.setProperty('--weather-glass-card-alpha', (wg * 0.72).toFixed(3));
      root.style.setProperty(
        '--weather-glass-filter',
        wg <= 0.001
          ? 'none'
          : `blur(${(wg * 24).toFixed(1)}px) saturate(${Math.round(100 + wg * 40)}%)`,
      );
      if (adaptWeatherColor) {
        const palette = resolveWeatherThemePalette(
          activeWeatherVisual.timeOfDay,
          activeWeatherVisual.isLiveDay,
          new Date(weatherClockTick),
        );
        applyWeatherThemeVariables(root, palette);
      }
    } else {
      root.style.removeProperty('--weather-glass-alpha');
      root.style.removeProperty('--weather-glass-alpha-strong');
      root.style.removeProperty('--weather-glass-card-alpha');
      root.style.removeProperty('--weather-glass-filter');
    }

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage quota errors
    }
  }, [settings, activeWeatherVisual, weatherClockTick]);

  const activeDocuments = useMemo(
    () => getActiveDocuments(documents),
    [documents],
  );
  const trashedDocuments = useMemo(
    () => getTrashedDocuments(documents),
    [documents],
  );

  const activeDoc = useMemo(
    () => activeDocuments.find((d) => d.id === activeDocId) ?? null,
    [activeDocuments, activeDocId],
  );

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === (activeDoc?.spaceId ?? activeSpaceId)) ?? spaces[0],
    [spaces, activeDoc, activeSpaceId],
  );

  const effectiveAiPolicy = useMemo(
    () =>
      resolveEffectiveAiPolicy(
        activeSpace.aiPolicy,
        activeDoc?.aiPolicyOverride,
        activeSpace.kind === 'vault',
      ),
    [activeSpace, activeDoc],
  );

  const docBranches = useMemo(
    () => branches.filter((b) => b.documentId === activeDocId),
    [branches, activeDocId],
  );

  const activeBranchName = useMemo(
    () =>
      docBranches.find((b) => b.id === activeDoc?.currentBranchId)?.name ?? '主线',
    [docBranches, activeDoc],
  );

  const motivationCountBySnap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of motivations) {
      if (m.snapshotId) map[m.snapshotId] = (map[m.snapshotId] ?? 0) + 1;
    }
    return map;
  }, [motivations]);

  const assetCountBySnap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of linkedAssets) {
      for (const sid of a.snapshotIds) {
        map[sid] = (map[sid] ?? 0) + 1;
      }
    }
    return map;
  }, [linkedAssets]);

  const getHistory = (docId: string): CommandHistory<DocEditableState> => {
    if (!historiesRef.current[docId]) {
      historiesRef.current[docId] = new CommandHistory<DocEditableState>(200);
    }
    return historiesRef.current[docId];
  };

  const docSnapshots = useMemo(
    () => snapshots.filter((s) => s.documentId === activeDocId),
    [snapshots, activeDocId],
  );

  const snapshotCountByDoc = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of snapshots) {
      counts[s.documentId] = (counts[s.documentId] ?? 0) + 1;
    }
    return counts;
  }, [snapshots]);

  const commitDocMutation = useCallback(
    (
      label: string,
      mutator: (cur: DocEditableState) => DocEditableState,
      historyOptions?: HistoryPushOptions,
    ) => {
      if (!activeDoc || activeDoc.isSealed || (activeDoc.spaceId === 'sp_vault' && !vaultUnlocked)) return;
      const before: DocEditableState = {
        markdownText: activeDoc.markdownText,
        latexText: activeDoc.latexText,
        annotations: activeDoc.annotations,
        activeFormat: activeDoc.activeFormat,
      };
      const after = mutator(before);
      if (
        after.markdownText === before.markdownText &&
        after.latexText === before.latexText &&
        after.annotations === before.annotations &&
        after.activeFormat === before.activeFormat
      ) {
        return;
      }
      const history = getHistory(activeDoc.id);
      history.push(label, before, after, historyOptions);
      setHistoryTick((t) => t + 1);

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === activeDoc.id
            ? {
                ...d,
                markdownText: after.markdownText,
                latexText: after.latexText,
                annotations: after.annotations,
                activeFormat: after.activeFormat,
                updatedAt: new Date().toISOString(),
              }
            : d,
        ),
      );
    },
    [activeDoc, vaultUnlocked],
  );

  const handleUndo = useCallback(() => {
    if (!activeDoc) return;
    const hist = getHistory(activeDoc.id);
    hist.breakMergeChain();
    const res = hist.undo();
    if (!res) return;
    setHistoryTick((t) => t + 1);
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDoc.id
          ? {
              ...d,
              markdownText: res.state.markdownText,
              latexText: res.state.latexText,
              annotations: res.state.annotations,
              activeFormat: res.state.activeFormat,
            }
          : d,
      ),
    );
    scheduleDeferredFormatSync(activeDoc.id, res.state.activeFormat);
    showToast(`已撤销：${res.label}`);
  }, [activeDoc, scheduleDeferredFormatSync, showToast]);

  const handleRedo = useCallback(() => {
    if (!activeDoc) return;
    const hist = getHistory(activeDoc.id);
    hist.breakMergeChain();
    const res = hist.redo();
    if (!res) return;
    setHistoryTick((t) => t + 1);
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDoc.id
          ? {
              ...d,
              markdownText: res.state.markdownText,
              latexText: res.state.latexText,
              annotations: res.state.annotations,
              activeFormat: res.state.activeFormat,
            }
          : d,
      ),
    );
    scheduleDeferredFormatSync(activeDoc.id, res.state.activeFormat);
    showToast(`已重做：${res.label}`);
  }, [activeDoc, scheduleDeferredFormatSync, showToast]);

  // Global Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z and Esc shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSaveMilestone();
      } else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsInitialTab('appearance');
        setSettingsOpen(true);
      } else if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (!pbConfig.enabled) {
          setSettings((s) => ({
            ...s,
            phrasebank: {
              ...normalizePhrasebankSettings(s.phrasebank),
              enabled: true,
              dismissed: false,
              collapsed: false,
            },
          }));
          showToast('已启用并打开学术写作句库胶囊');
        } else {
          setCapsuleDismissed(!capsuleDismissed);
        }
      } else if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        if (settingsOpen) setSettingsOpen(false);
        else if (trashModalOpen) setTrashModalOpen(false);
        else if (vaultLockOpen) setVaultLockOpen(false);
        else if (branchModalOpen) setBranchModalOpen(false);
        else if (contextAssetsOpen) setContextAssetsOpen(false);
        else if (paperStudioOpen) setPaperStudioOpen(false);
        else if (evolutionStudioOpen) setEvolutionStudioOpen(false);
        else if (diffModalData) setDiffModalData(null);
        else if (coverModalData) setCoverModalData(null);
        else if (isFullscreen) setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleUndo,
    handleRedo,
    isFullscreen,
    settingsOpen,
    trashModalOpen,
    vaultLockOpen,
    branchModalOpen,
    contextAssetsOpen,
    paperStudioOpen,
    evolutionStudioOpen,
    diffModalData,
    coverModalData,
    pbConfig.enabled,
    capsuleDismissed,
    setCapsuleDismissed,
    showToast,
  ]);

  const handleFormatChange = useCallback(
    (fmt: EditorFormat) => {
      if (!activeDoc || activeDoc.activeFormat === fmt) return;
      getHistory(activeDoc.id).breakMergeChain();
      const synced = syncDocFormatsIfDirty(activeDoc);
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === activeDoc.id
            ? {
                ...synced,
                activeFormat: fmt,
              }
            : d,
        ),
      );
    },
    [activeDoc, syncDocFormatsIfDirty],
  );

  const handleTextChange = (nextText: string) => {
    if (!activeDoc) return;
    const fmt = activeDoc.activeFormat;
    const prevText = fmt === 'markdown' ? activeDoc.markdownText : activeDoc.latexText;
    if (nextText === prevText) return;

    commitDocMutation(
      '编辑正文',
      (cur) => {
        const nextAnnotations = adjustAnchorsForTextEdit(prevText, nextText, cur.annotations);
        return {
          ...cur,
          markdownText: fmt === 'markdown' ? nextText : cur.markdownText,
          latexText: fmt === 'latex' ? nextText : cur.latexText,
          annotations: nextAnnotations,
        };
      },
      { mergeKey: 'text-edit', mergeWindowMs: 500, skipClone: true },
    );
    scheduleDeferredFormatSync(activeDoc.id, fmt);
  };

  const handleAcceptRevision = (annId: string) => {
    if (!activeDoc) return;
    const ann = activeDoc.annotations.find((a) => a.id === annId);
    if (!ann) return;
    const replacement = ann.revisionKind === 'delete' ? '' : (ann.suggestedText ?? '');

    commitDocMutation(
      '接受修订',
      (cur) => {
        const activeText = cur.activeFormat === 'markdown' ? cur.markdownText : cur.latexText;
        const mutated = applyAnnotationTextReplacement({
          text: activeText,
          annotations: cur.annotations,
          targetId: annId,
          replacementText: replacement,
          newStatus: 'accepted',
        });
        return {
          ...cur,
          markdownText: cur.activeFormat === 'markdown' ? mutated.text : cur.markdownText,
          latexText: cur.activeFormat === 'latex' ? mutated.text : cur.latexText,
          annotations: mutated.annotations,
        };
      },
      { skipClone: true },
    );
    scheduleDeferredFormatSync(activeDoc.id, activeDoc.activeFormat);
    showToast('已接受修订并同步更新正文（可 Ctrl+Z 撤销）');
  };

  const handleRejectRevision = (annId: string) => {
    if (!activeDoc) return;
    const ann = activeDoc.annotations.find((a) => a.id === annId);
    if (!ann) return;

    commitDocMutation(
      '拒绝修订',
      (cur) => {
        if (ann.revisionKind === 'insert') {
          const activeText = cur.activeFormat === 'markdown' ? cur.markdownText : cur.latexText;
          const mutated = applyAnnotationTextReplacement({
            text: activeText,
            annotations: cur.annotations,
            targetId: annId,
            replacementText: '',
            newStatus: 'rejected',
          });
          return {
            ...cur,
            markdownText: cur.activeFormat === 'markdown' ? mutated.text : cur.markdownText,
            latexText: cur.activeFormat === 'latex' ? mutated.text : cur.latexText,
            annotations: mutated.annotations,
          };
        }
        return {
          ...cur,
          annotations: cur.annotations.map((a) =>
            a.id === annId ? { ...a, status: 'rejected' } : a,
          ),
        };
      },
      { skipClone: true },
    );
    if (ann.revisionKind === 'insert') {
      scheduleDeferredFormatSync(activeDoc.id, activeDoc.activeFormat);
    }
    showToast('已拒绝修订并保留原文');
  };

  const handleToggleResolveComment = (annId: string) => {
    commitDocMutation(
      '切换批注状态',
      (cur) => ({
        ...cur,
        annotations: cur.annotations.map((a) =>
          a.id === annId
            ? { ...a, status: a.status === 'resolved' ? 'open' : 'resolved' }
            : a,
        ),
      }),
      { skipClone: true },
    );
  };

  const handleReplyComment = (annId: string, text: string) => {
    commitDocMutation(
      '回复批注',
      (cur) => ({
        ...cur,
        annotations: cur.annotations.map((a) =>
          a.id === annId
            ? {
                ...a,
                replies: [
                  ...a.replies,
                  {
                    id: `rep_${Date.now()}`,
                    author: '我',
                    date: new Date().toISOString(),
                    text,
                  },
                ],
              }
            : a,
        ),
      }),
      { skipClone: true },
    );
  };

  const handleApplyAiSuggestion = (annId: string, rewrite: string) => {
    if (!activeDoc) return;
    commitDocMutation(
      '应用 AI 修改建议',
      (cur) => {
        const activeText = cur.activeFormat === 'markdown' ? cur.markdownText : cur.latexText;
        const mutated = applyAnnotationTextReplacement({
          text: activeText,
          annotations: cur.annotations,
          targetId: annId,
          replacementText: rewrite,
          newStatus: 'resolved',
        });
        return {
          ...cur,
          markdownText: cur.activeFormat === 'markdown' ? mutated.text : cur.markdownText,
          latexText: cur.activeFormat === 'latex' ? mutated.text : cur.latexText,
          annotations: mutated.annotations,
        };
      },
      { skipClone: true },
    );
    scheduleDeferredFormatSync(activeDoc.id, activeDoc.activeFormat);
    showToast('已应用 AI 改写建议（可 Ctrl+Z 撤销）');
  };

  const handleBatchAcceptRevisions = useCallback(
    (targetIds?: string[]) => {
      if (!activeDoc) return;
      let count = 0;
      commitDocMutation(
        '批量接受修订',
        (cur) => {
          const activeText = cur.activeFormat === 'markdown' ? cur.markdownText : cur.latexText;
          const res = applyBatchAnnotationAction({
            text: activeText,
            annotations: cur.annotations,
            action: 'accept-revisions',
            targetIds,
          });
          count = res.affectedCount;
          if (count === 0) return cur;
          return {
            ...cur,
            markdownText: cur.activeFormat === 'markdown' ? res.text : cur.markdownText,
            latexText: cur.activeFormat === 'latex' ? res.text : cur.latexText,
            annotations: res.annotations,
          };
        },
        { skipClone: true },
      );
      if (count > 0) {
        scheduleDeferredFormatSync(activeDoc.id, activeDoc.activeFormat);
        showToast(
          settings.locale === 'zh-CN'
            ? `已批量接受 ${count} 条修订（可 Ctrl+Z 撤销）`
            : `Accepted ${count} revisions (Ctrl+Z to undo)`,
        );
      }
    },
    [activeDoc, commitDocMutation, scheduleDeferredFormatSync, settings.locale, showToast],
  );

  const handleBatchRejectRevisions = useCallback(
    (targetIds?: string[]) => {
      if (!activeDoc) return;
      let count = 0;
      commitDocMutation(
        '批量拒绝修订',
        (cur) => {
          const activeText = cur.activeFormat === 'markdown' ? cur.markdownText : cur.latexText;
          const res = applyBatchAnnotationAction({
            text: activeText,
            annotations: cur.annotations,
            action: 'reject-revisions',
            targetIds,
          });
          count = res.affectedCount;
          if (count === 0) return cur;
          return {
            ...cur,
            markdownText: cur.activeFormat === 'markdown' ? res.text : cur.markdownText,
            latexText: cur.activeFormat === 'latex' ? res.text : cur.latexText,
            annotations: res.annotations,
          };
        },
        { skipClone: true },
      );
      if (count > 0) {
        scheduleDeferredFormatSync(activeDoc.id, activeDoc.activeFormat);
        showToast(
          settings.locale === 'zh-CN'
            ? `已批量拒绝 ${count} 条修订（可 Ctrl+Z 撤销）`
            : `Rejected ${count} revisions (Ctrl+Z to undo)`,
        );
      }
    },
    [activeDoc, commitDocMutation, scheduleDeferredFormatSync, settings.locale, showToast],
  );

  const handleBatchResolveComments = useCallback(
    (targetIds?: string[]) => {
      if (!activeDoc) return;
      let count = 0;
      commitDocMutation(
        '批量解决批注',
        (cur) => {
          const activeText = cur.activeFormat === 'markdown' ? cur.markdownText : cur.latexText;
          const res = applyBatchAnnotationAction({
            text: activeText,
            annotations: cur.annotations,
            action: 'resolve-comments',
            targetIds,
          });
          count = res.affectedCount;
          if (count === 0) return cur;
          return {
            ...cur,
            annotations: res.annotations,
          };
        },
        { skipClone: true },
      );
      if (count > 0) {
        showToast(
          settings.locale === 'zh-CN'
            ? `已批量解决 ${count} 条批注（可 Ctrl+Z 撤销）`
            : `Resolved ${count} comments (Ctrl+Z to undo)`,
        );
      }
    },
    [activeDoc, commitDocMutation, settings.locale, showToast],
  );

  const handleImportWordBytes = async (fileName: string, bytes: Uint8Array) => {
    const isLegacyDoc = /\.doc$/i.test(fileName);
    const bundle = isLegacyDoc ? await parseDocBytes(bytes) : await parseDocxBytes(bytes);
    const extracted = extractBodyWithCoverIndex(bundle, bundle.detectedCoverEndIndex, 'markdown');
    const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

    let baseDocxBase64: string | undefined;
    if (isZipHeader(bytes)) {
      let b64 = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        b64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      baseDocxBase64 = btoa(b64);
    }

    const newDoc: ArchiveDocument = {
      id: docId,
      spaceId: activeSpaceId,
      title: fileName.replace(/\.docx?$/i, ''),
      sourceExt: isLegacyDoc ? '.doc' : '.docx',
      sourceFileName: fileName,
      backupFormat: settings.defaultBackupFormat,
      activeFormat: settings.defaultBackupFormat === 'latex' ? 'latex' : 'markdown',
      markdownText: extracted.text,
      latexText: syncFormatText(extracted.text, 'markdown', 'latex'),
      annotations: extracted.annotations,
      baseDocxBase64,
      coverXmlNodes: extracted.coverXmlNodes,
      coverRule: {
        documentId: docId,
        coverEndBlockIndex: bundle.detectedCoverEndIndex,
        remember: true,
        coverBlockCount: extracted.coverBlockCount,
      },
      citationsSidecar: extracted.citationsSidecar,
      styleSidecar: extracted.styleSidecar,
      mediaAssets: extracted.mediaAssets,
      isSealed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentBranchId: `branch_${docId}`,
      tags: [isLegacyDoc ? 'Word (.doc) 导入' : 'Word 导入'],
    };

    const snapRes = await createDocumentSnapshot({
      cas: casRef.current,
      doc: newDoc,
      latestSnapshot: null,
      label: '首次导入归档',
      isMilestone: true,
      aiSummary: `从 ${fileName} 导入，已剥离 ${extracted.coverBlockCount} 个封面块，提取 ${extracted.annotations.length} 条批注/修订。`,
    });

    parsedBundlesRef.current[docId] = bundle;
    setDocuments((prev) => [newDoc, ...prev]);
    setBranches((prev) => [
      ...prev,
      {
        id: newDoc.currentBranchId,
        documentId: docId,
        name: '主线 · 默认稿',
        isMain: true,
        createdAt: newDoc.createdAt,
        headSnapshotId: snapRes.snapshot?.id ?? null,
      },
    ]);
    if (snapRes.snapshot) setSnapshots((prev) => [...prev, snapRes.snapshot!]);
    setActiveDocId(docId);
    setCoverModalData({ docId, bundle });
  };

  const handleImportFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
        try {
          const buf = await file.arrayBuffer();
          await handleImportWordBytes(file.name, new Uint8Array(buf));
        } catch (err) {
          showToast(err instanceof Error ? err.message : `导入 ${file.name} 失败`);
        }
      } else {
        const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const extMatch = file.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? '.other';
        const validExt = (['.doc', '.docx', '.md', '.tex', '.pdf', '.pptx', '.xlsx', '.txt'].includes(extMatch)
          ? extMatch
          : '.other') as ArchiveDocument['sourceExt'];

        let text = '';
        let officePreview: ArchiveDocument['officePreview'] = undefined;

        if (lowerName.endsWith('.pptx')) {
          const buf = await file.arrayBuffer();
          const parsed = await parsePptxBytes(buf);
          officePreview = parsed.preview;
          text = parsed.markdownSummary;
        } else if (lowerName.endsWith('.xlsx')) {
          const buf = await file.arrayBuffer();
          const parsed = await parseXlsxBytes(buf);
          officePreview = parsed.preview;
          text = parsed.markdownSummary;
        } else if (lowerName.endsWith('.pdf')) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ''));
            reader.onerror = () => reject(reader.error ?? new Error('PDF 读取失败'));
            reader.readAsDataURL(file);
          });
          officePreview = { kind: 'pdf', dataUrl, sizeBytes: file.size };
          text = `# ${file.name}\n\nPDF 原件大小：${(file.size / 1024).toFixed(1)} KB\n可在右侧实时预览区直接审阅 PDF 内嵌视图，并在左侧记录审阅批注或摘录。`;
        } else if (/\.(md|tex|txt)$/i.test(file.name)) {
          text = await file.text();
        } else {
          text = `# ${file.name}\n\n已归档文件大小：${(file.size / 1024).toFixed(1)} KB\n文件类型：${file.type || '二进制档案'}`;
        }

        const newDoc: ArchiveDocument = {
          id: docId,
          spaceId: activeSpaceId,
          title: file.name.replace(/\.[^.]+$/, ''),
          sourceExt: validExt,
          sourceFileName: file.name,
          backupFormat: settings.defaultBackupFormat,
          activeFormat: validExt === '.tex' ? 'latex' : 'markdown',
          markdownText: validExt === '.tex' ? syncFormatText(text, 'latex', 'markdown') : text,
          latexText: validExt === '.tex' ? text : syncFormatText(text, 'markdown', 'latex'),
          annotations: [],
          coverXmlNodes: [],
          coverRule: { documentId: docId, coverEndBlockIndex: 0, remember: true, coverBlockCount: 0 },
          citationsSidecar: [],
          mediaAssets: {},
          officePreview,
          isSealed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentBranchId: `branch_${docId}`,
          tags: [validExt],
        };

        const snapRes = await createDocumentSnapshot({
          cas: casRef.current,
          doc: newDoc,
          latestSnapshot: null,
          label: '初始入库',
          isMilestone: true,
        });
        setDocuments((prev) => [newDoc, ...prev]);
        setBranches((prev) => [
          ...prev,
          {
            id: newDoc.currentBranchId,
            documentId: docId,
            name: '主线',
            isMain: true,
            createdAt: newDoc.createdAt,
            headSnapshotId: snapRes.snapshot?.id ?? null,
          },
        ]);
        if (snapRes.snapshot) setSnapshots((prev) => [...prev, snapRes.snapshot!]);
        setActiveDocId(docId);
        showToast(`已归档 ${file.name}`);
      }
    }
  };

  const handleImportSampleDocx = async () => {
    const bytes = await buildSamplePaperDocx();
    await handleImportWordBytes(`示例导师批注论文_${new Date().toLocaleTimeString()}.docx`, bytes);
  };

  const handleCreateBlankDoc = async () => {
    const docId = `doc_${Date.now()}`;
    const newDoc: ArchiveDocument = {
      id: docId,
      spaceId: activeSpaceId,
      title: '新建文档草稿',
      sourceExt: '.md',
      sourceFileName: '新建文档草稿.md',
      backupFormat: 'both',
      activeFormat: 'markdown',
      markdownText: '# 标题\n\n在此开始编写内容，支持 $E=mc^2$ 数学公式与自动版本快照。',
      latexText: '\\section{标题}\n\n在此开始编写内容，支持 $E=mc^2$ 数学公式与自动版本快照。',
      annotations: [],
      coverXmlNodes: [],
      coverRule: { documentId: docId, coverEndBlockIndex: 0, remember: true, coverBlockCount: 0 },
      citationsSidecar: [],
      mediaAssets: {},
      isSealed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentBranchId: `branch_${docId}`,
      tags: ['新建'],
    };
    const snapRes = await createDocumentSnapshot({
      cas: casRef.current,
      doc: newDoc,
      latestSnapshot: null,
      label: '新建草稿',
      isMilestone: true,
    });
    setDocuments((prev) => [newDoc, ...prev]);
    setBranches((prev) => [
      ...prev,
      {
        id: newDoc.currentBranchId,
        documentId: docId,
        name: '主线',
        isMain: true,
        createdAt: newDoc.createdAt,
        headSnapshotId: snapRes.snapshot?.id ?? null,
      },
    ]);
    if (snapRes.snapshot) setSnapshots((prev) => [...prev, snapRes.snapshot!]);
    setActiveDocId(docId);
  };

  const handleSaveMilestone = async () => {
    if (!activeDoc) return;
    const syncedDoc = syncDocFormatsIfDirty(activeDoc);
    if (syncedDoc !== activeDoc) {
      setDocuments((prev) => prev.map((d) => (d.id === syncedDoc.id ? syncedDoc : d)));
    }
    const branchSnaps = docSnapshots.filter((s) => s.branchId === syncedDoc.currentBranchId);
    const latest = branchSnaps[branchSnaps.length - 1] ?? docSnapshots[docSnapshots.length - 1] ?? null;
    const prevText = latest ? (casRef.current.getText(latest.markdownHash) ?? '') : '';

    let summaryText: string | undefined;
    if (latest) {
      try {
        const aiRes = await generateSnapshotSummary({
          oldText: prevText,
          newText: syncedDoc.markdownText,
          settings,
          policy: effectiveAiPolicy,
        });
        summaryText = aiRes.text;
      } catch {
        summaryText = undefined;
      }
    }

    const res = await createDocumentSnapshot({
      cas: casRef.current,
      doc: syncedDoc,
      latestSnapshot: latest,
      label: `里程碑 v${docSnapshots.length + 1}`,
      isMilestone: true,
      aiSummary: summaryText,
      forceMilestone: false,
    });

    if (!res.created || !res.snapshot) {
      showToast('内容哈希未变化，CAS 自动去重跳过冗余归档');
      return;
    }

    if (latest) {
      const newDarlings = extractDeletedDarlings({
        oldText: prevText,
        newText: syncedDoc.markdownText,
        documentId: syncedDoc.id,
        snapshotId: res.snapshot.id,
      });
      if (newDarlings.length > 0) {
        setDarlings((prev) => [...newDarlings, ...prev]);
      }
    }

    // Bind current linked assets to new snapshot & update today's writing activity
    const snapId = res.snapshot.id;
    setLinkedAssets((prev) =>
      prev.map((a) =>
        a.documentId === syncedDoc.id ? { ...a, snapshotIds: [...a.snapshotIds, snapId] } : a,
      ),
    );
    const today = new Date().toISOString().slice(0, 10);
    const added = Math.abs(res.snapshot.deltaChars);
    setWritingActivity((prev) => {
      const hasToday = prev.some((d) => d.date === today);
      if (hasToday) {
        return prev.map((d) =>
          d.date === today
            ? { ...d, charsDelta: d.charsDelta + added, editSessions: d.editSessions + 1 }
            : d,
        );
      }
      return [...prev, { date: today, charsDelta: added, editSessions: 1, peakHour: new Date().getHours() }];
    });

    setSnapshots((prev) => [...prev, res.snapshot!]);
    triggerHalo();
    showToast(`已创建里程碑快照：${res.snapshot.label}`);
  };

  const handleToggleSeal = async () => {
    if (!activeDoc) return;
    const syncedDoc = syncDocFormatsIfDirty(activeDoc);
    const nextSealed = !syncedDoc.isSealed;
    const hash = nextSealed ? await sha256Hex(syncedDoc.markdownText) : undefined;
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === syncedDoc.id
          ? {
              ...syncedDoc,
              isSealed: nextSealed,
              sealedHash: hash,
              sealedAt: nextSealed ? new Date().toISOString() : undefined,
            }
          : d,
      ),
    );
    triggerHalo();
    showToast(nextSealed ? '已封存锁定档案并记录 SHA-256 校验值' : '已解除只读封存');
  };

  const handleExportWord = async (mode: 'clean' | 'redline') => {
    if (!activeDoc) return;
    const syncedDoc = syncDocFormatsIfDirty(activeDoc);
    if (syncedDoc !== activeDoc) {
      setDocuments((prev) => prev.map((d) => (d.id === syncedDoc.id ? syncedDoc : d)));
    }
    const baselineSnap = docSnapshots[0];
    const baselineText = baselineSnap ? casRef.current.getText(baselineSnap.markdownHash) : undefined;

    const bytes = await exportToDocx({
      baseDocxBase64: syncedDoc.baseDocxBase64,
      coverXmlNodes: syncedDoc.coverXmlNodes,
      bodyText: syncedDoc.activeFormat === 'markdown' ? syncedDoc.markdownText : syncedDoc.latexText,
      format: syncedDoc.activeFormat,
      citationsSidecar: syncedDoc.citationsSidecar,
      styleSidecar: syncedDoc.styleSidecar,
      mode,
      baselineText,
      title: syncedDoc.title,
    });

    const suffix = mode === 'redline' ? '_带修订红线版' : '_带原封面交付版';
    triggerBrowserDownload(
      `${syncedDoc.title}${suffix}.docx`,
      bytes,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    showToast(`已生成并导出：${syncedDoc.title}${suffix}.docx`);
  };

  const handleExportText = (fmt: EditorFormat) => {
    if (!activeDoc) return;
    const syncedDoc = syncDocFormatsIfDirty(activeDoc);
    if (syncedDoc !== activeDoc) {
      setDocuments((prev) => prev.map((d) => (d.id === syncedDoc.id ? syncedDoc : d)));
    }
    const content = fmt === 'markdown' ? syncedDoc.markdownText : syncedDoc.latexText;
    const ext = fmt === 'markdown' ? 'md' : 'tex';
    triggerBrowserDownload(`${syncedDoc.title}.${ext}`, content, 'text/plain;charset=utf-8');
  };

  const handleToggleWatch = async () => {
    if (!settings.watchActive) {
      const res = await nativeStartWatchFolder(settings.watchDirectory);
      setSettings((s) => ({ ...s, watchActive: true }));
      showToast(res);
    } else {
      await nativeStopWatchFolder();
      setSettings((s) => ({ ...s, watchActive: false }));
      showToast('已暂停桌面目录监听');
    }
  };

  const dict = settings.locale === 'zh-CN' ? zhCN : enUS;
  const activeHistory = activeDoc ? getHistory(activeDoc.id) : null;

  const handleTriggerRandomWeather = useCallback(() => {
    setRandomWeatherState((prev) => pickRandomWeatherCombo(prev.signature));
  }, []);

  // Random weather interval timer
  useEffect(() => {
    if (settings.theme !== 'weather-live' || weatherCfg.mode !== 'random') return;
    const ms = Math.max(5, weatherCfg.randomIntervalSeconds) * 1000;
    const timer = window.setInterval(() => {
      setRandomWeatherState((prev) => pickRandomWeatherCombo(prev.signature));
    }, ms);
    return () => window.clearInterval(timer);
  }, [settings.theme, weatherCfg.mode, weatherCfg.randomIntervalSeconds]);

  // Live weather initial & periodic online sync
  useEffect(() => {
    if (settings.theme !== 'weather-live' || weatherCfg.mode !== 'live') return;
    let cancelled = false;
    const syncNow = async () => {
      try {
        const snap = await fetchLiveWeather(
          weatherCfg.latitude,
          weatherCfg.longitude,
          weatherCfg.locationQuery || '北京',
          weatherCfg.regionLabel || weatherCfg.locationQuery || '北京',
          {
            province: weatherCfg.province,
            city: weatherCfg.city,
            county: weatherCfg.county,
          },
        );
        if (cancelled) return;
        setSettings((s) => {
          const curW = s.weather ?? DEFAULT_WEATHER;
          return { ...s, weather: { ...curW, liveSnapshot: snap } };
        });
      } catch {
        // Offline/sandbox failure keeps existing snapshot silently until user triggers manual retry
      }
    };

    const staleMs = 10 * 60 * 1000;
    const snapTime = weatherCfg.liveSnapshot?.fetchedAt
      ? Date.parse(weatherCfg.liveSnapshot.fetchedAt)
      : 0;
    const coordMismatch =
      !weatherCfg.liveSnapshot ||
      Math.abs(weatherCfg.liveSnapshot.latitude - weatherCfg.latitude) > 0.05 ||
      Math.abs(weatherCfg.liveSnapshot.longitude - weatherCfg.longitude) > 0.05;

    if (coordMismatch || !snapTime || Date.now() - snapTime > staleMs) {
      void syncNow();
    }

    const timer = window.setInterval(() => {
      void syncNow();
    }, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    settings.theme,
    weatherCfg.mode,
    weatherCfg.latitude,
    weatherCfg.longitude,
    weatherCfg.locationQuery,
    weatherCfg.regionLabel,
    weatherCfg.province,
    weatherCfg.city,
    weatherCfg.county,
  ]);
  const openAnnotationCount = activeDoc
    ? activeDoc.annotations.filter((a) => a.status === 'open').length
    : 0;

  const shellStyle = {
    '--left-sidebar-w': `${leftSidebarWidth}px`,
    '--timeline-h': `${timelineHeight}px`,
  } as CSSProperties;

  const isDrawerMode = deviceEnv.isPhone || deviceEnv.isTabletPortrait;
  const isTimelineSheetMode = deviceEnv.isPhone || deviceEnv.isTabletPortrait;

  // Snapshot workspace state when entering tutorial mode so replay can cleanly restore it
  useEffect(() => {
    if (tutorialMode && !preTutorialStateRef.current) {
      const pb = normalizePhrasebankSettings(settings.phrasebank);
      preTutorialStateRef.current = {
        spaceId: activeSpaceId,
        docId: activeDocId,
        leftSidebarCollapsed,
        rightSidebarCollapsed,
        splitPreview,
        timelineCollapsed,
        phrasebankEnabled: pb.enabled,
        phrasebankDismissed: Boolean(pb.dismissed),
        phrasebankCollapsed: pb.collapsed,
      };
    } else if (!tutorialMode) {
      preTutorialStateRef.current = null;
    }
  }, [
    tutorialMode,
    activeSpaceId,
    activeDocId,
    leftSidebarCollapsed,
    rightSidebarCollapsed,
    splitPreview,
    timelineCollapsed,
    settings.phrasebank,
  ]);

  const activeTutorialSceneRef = useRef<TutorialSceneId | null>(null);

  const applyTutorialScene = useCallback(
    (scene: TutorialSceneId) => {
      activeTutorialSceneRef.current = scene;
      const docs = getActiveDocuments(documentsRef.current);
      const allDocs = documentsRef.current;
      const thesisDoc =
        docs.find((d) => d.id === 'doc_thesis_demo') ??
        docs.find((d) => d.spaceId === 'sp_paper') ??
        docs[0] ??
        allDocs[0] ??
        null;
      const officeDoc =
        docs.find((d) => d.id === 'doc_office_pptx') ??
        docs.find((d) => d.spaceId === 'sp_office') ??
        thesisDoc;
      const vaultDoc =
        docs.find((d) => d.id === 'doc_vault_contract') ??
        docs.find((d) => d.spaceId === 'sp_vault') ??
        thesisDoc;

      // Reset transient modals/sheets before applying the requested scene
      setCoverModalData(null);
      setDiffModalData(null);
      setSettingsOpen(false);
      setTrashModalOpen(false);
      setBranchModalOpen(false);
      setContextAssetsOpen(false);
      setPaperStudioOpen(false);
      setEvolutionStudioOpen(false);
      setVaultLockOpen(false);
      setSyncModalOpen(false);
      setCameraScanOpen(false);
      setShareModalOpen(false);
      setIsFullscreen(false);
      setMobileDrawerOpen(false);
      setMobileTimelineOpen(false);
      setRevisionMode(false);

      const activateThesis = () => {
        if (!thesisDoc) return;
        setActiveSpaceId(thesisDoc.spaceId);
        setActiveDocId(thesisDoc.id);
      };

      switch (scene) {
        case 'workspace-sidebar':
          activateThesis();
          setSplitPreview(false);
          if (isDrawerMode) setMobileDrawerOpen(true);
          else setLeftSidebarCollapsed(false);
          break;

        case 'trash-modal':
          activateThesis();
          setSplitPreview(false);
          setTrashModalOpen(true);
          break;

        case 'workspace-format':
          activateThesis();
          setSplitPreview(false);
          if (thesisDoc) {
            setDocuments((prev) =>
              prev.map((d) => (d.id === thesisDoc.id ? { ...d, activeFormat: 'markdown' } : d)),
            );
          }
          break;

        case 'cover-split': {
          activateThesis();
          setSplitPreview(false);
          const targetId = thesisDoc?.id ?? 'doc_thesis_demo';
          const bundle =
            parsedBundlesRef.current[targetId] ??
            Object.values(parsedBundlesRef.current)[0];
          if (bundle) {
            setCoverModalData({ docId: targetId, bundle });
          } else {
            buildSamplePaperDocx()
              .then((bytes) => parseDocxBytes(bytes))
              .then((built) => {
                parsedBundlesRef.current[targetId] = built;
                if (
                  activeTutorialSceneRef.current === 'cover-split' &&
                  backDispatcherStateRef.current.tutorialMode
                ) {
                  setCoverModalData({ docId: targetId, bundle: built });
                }
              })
              .catch(() => {});
          }
          break;
        }

        case 'annotations':
          activateThesis();
          setSplitPreview(false);
          if (isDrawerMode) {
            setRevisionMode(true);
          } else {
            setRightSidebarCollapsed(false);
          }
          break;

        case 'snapshot-topbar':
          activateThesis();
          break;

        case 'timeline-dome':
          activateThesis();
          if (isTimelineSheetMode) setMobileTimelineOpen(true);
          else setTimelineCollapsed(false);
          break;

        case 'diff-darlings': {
          activateThesis();
          const snaps = snapshotsRef.current.filter((s) => s.documentId === thesisDoc?.id);
          const leftSnap = snaps[0] ?? null;
          const rightSnap = snaps[snaps.length - 1] ?? null;
          setDiffModalData({
            tab: 'darlings',
            leftSnap,
            rightSnap,
            leftText: leftSnap ? (casRef.current.getText(leftSnap.markdownHash) ?? '') : '',
            rightText: thesisDoc?.markdownText ?? '',
          });
          break;
        }

        case 'branch-modal':
          activateThesis();
          setBranchModalOpen(true);
          break;

        case 'editor-ai-bar':
          activateThesis();
          setSplitPreview(false);
          break;

        case 'phrasebank-capsule':
          activateThesis();
          setSplitPreview(false);
          setSettings((s) => ({
            ...s,
            phrasebank: {
              ...normalizePhrasebankSettings(s.phrasebank),
              enabled: true,
              dismissed: false,
              collapsed: false,
            },
          }));
          break;

        case 'paper-studio':
          activateThesis();
          setPaperStudioInitialTab('consistency');
          setPaperStudioOpen(true);
          break;

        case 'context-assets':
          activateThesis();
          setContextAssetsOpen(true);
          break;

        case 'evolution-studio':
          activateThesis();
          setEvolutionStudioOpen(true);
          break;

        case 'vault-lock':
          if (vaultDoc) {
            setActiveSpaceId(vaultDoc.spaceId);
            setActiveDocId(vaultDoc.id);
          } else {
            setActiveSpaceId('sp_vault');
          }
          setVaultLockOpen(true);
          break;

        case 'sync-modal':
          activateThesis();
          setSyncModalOpen(true);
          break;

        case 'settings-themes':
          activateThesis();
          setSettingsInitialTab('appearance');
          setSettingsOpen(true);
          break;

        case 'settings-ai':
          activateThesis();
          setSettingsInitialTab('ai');
          setSettingsOpen(true);
          break;

        case 'export-topbar':
          activateThesis();
          break;

        case 'format-office':
          if (officeDoc) {
            setActiveSpaceId(officeDoc.spaceId);
            setActiveDocId(officeDoc.id);
          } else {
            setActiveSpaceId('sp_office');
          }
          setSplitPreview(true);
          break;

        case 'limitations-overview':
          activateThesis();
          setSplitPreview(false);
          break;
      }
    },
    [isDrawerMode, isTimelineSheetMode],
  );

  const finishTutorialCleanup = useCallback(
    (restorePreState: boolean) => {
      setCoverModalData(null);
      setDiffModalData(null);
      setSettingsOpen(false);
      setTrashModalOpen(false);
      setBranchModalOpen(false);
      setContextAssetsOpen(false);
      setPaperStudioOpen(false);
      setEvolutionStudioOpen(false);
      setVaultLockOpen(false);
      setSyncModalOpen(false);
      setCameraScanOpen(false);
      setShareModalOpen(false);
      setIsFullscreen(false);
      setMobileDrawerOpen(false);
      setMobileTimelineOpen(false);
      setRevisionMode(false);

      const saved = restorePreState ? preTutorialStateRef.current : null;
      if (saved) {
        setActiveSpaceId(saved.spaceId);
        if (saved.docId) setActiveDocId(saved.docId);
        setLeftSidebarCollapsed(saved.leftSidebarCollapsed);
        setRightSidebarCollapsed(saved.rightSidebarCollapsed);
        setSplitPreview(saved.splitPreview);
        setTimelineCollapsed(saved.timelineCollapsed);
        setSettings((s) => ({
          ...s,
          phrasebank: {
            ...normalizePhrasebankSettings(s.phrasebank),
            enabled: saved.phrasebankEnabled,
            dismissed: saved.phrasebankDismissed,
            collapsed: saved.phrasebankCollapsed,
          },
        }));
      } else {
        const docs = documentsRef.current;
        const thesisDoc =
          docs.find((d) => d.id === 'doc_thesis_demo') ?? docs[0] ?? null;
        if (thesisDoc) {
          setActiveSpaceId(thesisDoc.spaceId);
          setActiveDocId(thesisDoc.id);
        }
        setSplitPreview(true);
        setLeftSidebarCollapsed(false);
        setRightSidebarCollapsed(false);
        setTimelineCollapsed(false);
      }
      preTutorialStateRef.current = null;
    },
    [],
  );

  const backDispatcherStateRef = useRef({
    tutorialMode,
    coverModalData,
    diffModalData,
    settingsOpen,
    branchModalOpen,
    contextAssetsOpen,
    paperStudioOpen,
    evolutionStudioOpen,
    vaultLockOpen,
    cameraScanOpen,
    shareModalOpen,
    syncModalOpen,
    trashModalOpen,
    mobileDrawerOpen,
    mobileTimelineOpen,
    revisionMode,
    revisionOrbMenuOpen,
    isFullscreen,
    finishTutorialCleanup,
    triggerAppHaptic,
  });
  backDispatcherStateRef.current = {
    tutorialMode,
    coverModalData,
    diffModalData,
    settingsOpen,
    branchModalOpen,
    contextAssetsOpen,
    paperStudioOpen,
    evolutionStudioOpen,
    vaultLockOpen,
    cameraScanOpen,
    shareModalOpen,
    syncModalOpen,
    trashModalOpen,
    mobileDrawerOpen,
    mobileTimelineOpen,
    revisionMode,
    revisionOrbMenuOpen,
    isFullscreen,
    finishTutorialCleanup,
    triggerAppHaptic,
  };

  useEffect(() => {
    const onRootBack = (): BackActionResult => {
      const st = backDispatcherStateRef.current;

      if (st.tutorialMode === 'first-run') {
        return 'handled';
      }
      if (st.tutorialMode === 'replay') {
        st.finishTutorialCleanup(true);
        setTutorialMode(null);
        return 'handled';
      }

      if (st.coverModalData) {
        setCoverModalData(null);
        return 'handled';
      }
      if (st.diffModalData) {
        setDiffModalData(null);
        return 'handled';
      }
      if (st.settingsOpen) {
        setSettingsOpen(false);
        return 'handled';
      }
      if (st.branchModalOpen) {
        setBranchModalOpen(false);
        return 'handled';
      }
      if (st.contextAssetsOpen) {
        setContextAssetsOpen(false);
        return 'handled';
      }
      if (st.paperStudioOpen) {
        setPaperStudioOpen(false);
        return 'handled';
      }
      if (st.evolutionStudioOpen) {
        setEvolutionStudioOpen(false);
        return 'handled';
      }
      if (st.vaultLockOpen) {
        setVaultLockOpen(false);
        return 'handled';
      }
      if (st.cameraScanOpen) {
        setCameraScanOpen(false);
        return 'handled';
      }
      if (st.shareModalOpen) {
        setShareModalOpen(false);
        return 'handled';
      }
      if (st.syncModalOpen) {
        setSyncModalOpen(false);
        return 'handled';
      }
      if (st.trashModalOpen) {
        setTrashModalOpen(false);
        return 'handled';
      }

      if (st.mobileDrawerOpen) {
        setMobileDrawerOpen(false);
        return 'handled';
      }
      if (st.mobileTimelineOpen) {
        setMobileTimelineOpen(false);
        return 'handled';
      }
      if (st.revisionOrbMenuOpen) {
        setRevisionOrbMenuOpen(false);
        return 'handled';
      }
      if (st.revisionMode) {
        setRevisionMode(false);
        return 'handled';
      }
      if (st.isFullscreen) {
        setIsFullscreen(false);
        return 'handled';
      }

      const now = Date.now();
      if (now < backGuardDeadlineRef.current) {
        if (backGuardTimerRef.current !== null) {
          window.clearTimeout(backGuardTimerRef.current);
          backGuardTimerRef.current = null;
        }
        backGuardDeadlineRef.current = 0;
        setBackGuardVisible(false);
        return 'exit';
      }

      st.triggerAppHaptic('selection');
      backGuardDeadlineRef.current = now + 2200;
      setBackGuardVisible(true);
      setBackGuardCycle((c) => c + 1);
      if (backGuardTimerRef.current !== null) {
        window.clearTimeout(backGuardTimerRef.current);
      }
      backGuardTimerRef.current = window.setTimeout(() => {
        backGuardDeadlineRef.current = 0;
        backGuardTimerRef.current = null;
        setBackGuardVisible(false);
      }, 2200);
      return 'handled';
    };

    const dispose = installGlobalBackDispatcher(onRootBack, {
      enableBrowserPopState: deviceEnv.isTouch,
    });
    return () => {
      dispose();
      if (backGuardTimerRef.current !== null) {
        window.clearTimeout(backGuardTimerRef.current);
        backGuardTimerRef.current = null;
      }
    };
  }, [deviceEnv.isTouch]);

  const handleTrashDoc = useCallback(
    (docId: string) => {
      const target = documentsRef.current.find((d) => d.id === docId);
      if (!target) return;
      const guard = canMoveDocumentToTrash(target, vaultUnlocked);
      if (!guard.allowed) {
        showToast(
          guard.reason === 'vault-locked'
            ? '保险箱已上锁，请先解锁后再操作'
            : '已封存锁定文档无法移入回收站，请先解除封存',
        );
        return;
      }
      const res = moveDocumentToTrash(documentsRef.current, docId);
      if (!res.trashedDoc) return;
      setDocuments(res.documents);
      if (activeDocId === docId) {
        setActiveDocId(res.nextActiveDocId);
      }
      triggerAppHaptic('medium');
      showToast(`已将「${target.title}」移入回收站（永久保留，可在左侧栏底部随时还原）`);
    },
    [activeDocId, showToast, triggerAppHaptic, vaultUnlocked],
  );

  const handleRestoreFromTrash = useCallback(
    (docId: string) => {
      const res = restoreDocumentFromTrash(documentsRef.current, docId);
      if (!res.restoredDoc) return;
      setDocuments(res.documents);
      setActiveSpaceId(res.restoredDoc.spaceId);
      setActiveDocId(res.restoredDoc.id);
      if (!tutorialMode) {
        setTrashModalOpen(false);
      }
      triggerAppHaptic('success');
      showToast(`已从回收站还原「${res.restoredDoc.title}」`);
    },
    [showToast, triggerAppHaptic, tutorialMode],
  );

  const syncBaseTextByDocId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of documents) {
      const snaps = snapshots.filter((s) => s.documentId === d.id);
      const latest = snaps[snaps.length - 1];
      if (latest) {
        map[d.id] = casRef.current.getText(latest.markdownHash) ?? '';
      }
    }
    return map;
  }, [documents, snapshots]);

  const recordSyncOp = useCallback(
    (doc: ArchiveDocument, op: SyncOpLogEntry['op']) => {
      const syncCfg = normalizeSyncSettings(settings.sync);
      const nextHlc = tickHlc(hlcRef.current);
      hlcRef.current = nextHlc;
      setSyncOplog((prev) => [
        {
          id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          docId: doc.id,
          docTitle: doc.title,
          op,
          hlc: nextHlc,
          contentHash: `${doc.markdownText.length}:${doc.updatedAt}`,
          deviceId: syncCfg.deviceId,
          deviceName: syncCfg.deviceName,
          createdAt: new Date().toISOString(),
        },
        ...prev.slice(0, 99),
      ]);
    },
    [settings.sync],
  );

  const handleCreateScannedDoc = async (params: {
    title: string;
    spaceId: string;
    dataUrl: string;
  }) => {
    const docId = `doc_scan_${Date.now()}`;
    const assetId = `scan_img_${Date.now()}`;
    const md = `# ${params.title}\n\n![扫描文档](${assetId})\n\n> 通过穹档移动端拍照扫描与文档清晰滤镜入库（${new Date().toLocaleString()}）。`;
    const newDoc: ArchiveDocument = {
      id: docId,
      spaceId: params.spaceId,
      title: params.title,
      sourceExt: '.md',
      sourceFileName: `${params.title}.md`,
      backupFormat: 'both',
      activeFormat: 'markdown',
      markdownText: md,
      latexText: syncFormatText(md, 'markdown', 'latex'),
      annotations: [],
      coverXmlNodes: [],
      coverRule: { documentId: docId, coverEndBlockIndex: 0, remember: false, coverBlockCount: 0 },
      citationsSidecar: [],
      mediaAssets: {
        [assetId]: {
          id: assetId,
          filename: `${params.title}.jpg`,
          mimeType: 'image/jpeg',
          dataUrl: params.dataUrl,
        },
      },
      isSealed: false,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      currentBranchId: `br_main_${docId}`,
      tags: ['扫描归档'],
    };
    const snapRes = await createDocumentSnapshot({
      cas: casRef.current,
      doc: newDoc,
      latestSnapshot: null,
      label: '拍照扫描入库',
      isMilestone: true,
    });
    setDocuments((prev) => [newDoc, ...prev]);
    setBranches((prev) => [
      ...prev,
      {
        id: newDoc.currentBranchId,
        documentId: docId,
        name: '主线',
        isMain: true,
        createdAt: newDoc.createdAt,
        headSnapshotId: snapRes.snapshot?.id ?? null,
      },
    ]);
    if (snapRes.snapshot) setSnapshots((prev) => [...prev, snapRes.snapshot!]);
    setActiveSpaceId(params.spaceId);
    setActiveDocId(docId);
    recordSyncOp(newDoc, 'upsert');
    showToast(`已将扫描文档「${params.title}」归档入库`);
  };

  const handleAttachScanToActiveDoc = (params: { title: string; dataUrl: string }) => {
    if (!activeDoc) return;
    const assetId = `scan_fig_${Date.now()}`;
    setLinkedAssets((prev) => [
      {
        id: assetId,
        documentId: activeDoc.id,
        name: `${params.title}.jpg`,
        category: 'figure',
        relativePath: `scans/${params.title}.jpg`,
        sizeBytes: params.dataUrl.length,
        contentHash: assetId,
        updatedAt: new Date().toISOString(),
        snapshotIds: [],
      },
      ...prev,
    ]);
    commitDocMutation('插入扫描配图', (cur) => {
      const nextMd = `${cur.markdownText}\n\n![${params.title}](${assetId})`;
      return {
        ...cur,
        markdownText: nextMd,
        latexText: syncFormatText(nextMd, 'markdown', 'latex'),
      };
    });
    showToast(`已将「${params.title}」作为实验配图插入当前文档`);
  };

  const handleCommitShareIntake = async (payload: SharePayload, targetSpaceId: string) => {
    const newDoc = buildDocumentFromSharePayload(payload, targetSpaceId);
    const snapRes = await createDocumentSnapshot({
      cas: casRef.current,
      doc: newDoc,
      latestSnapshot: null,
      label: '系统分享入库',
      isMilestone: true,
    });
    setDocuments((prev) => [newDoc, ...prev]);
    setBranches((prev) => [
      ...prev,
      {
        id: newDoc.currentBranchId,
        documentId: newDoc.id,
        name: '主线',
        isMain: true,
        createdAt: newDoc.createdAt,
        headSnapshotId: snapRes.snapshot?.id ?? null,
      },
    ]);
    if (snapRes.snapshot) setSnapshots((prev) => [...prev, snapRes.snapshot!]);
    setActiveSpaceId(targetSpaceId);
    setActiveDocId(newDoc.id);
    recordSyncOp(newDoc, 'upsert');
    showToast(`已通过系统分享入库：「${newDoc.title}」`);
  };

  const handleApplySyncResult = (res: SyncReconcileResult, sourceLabel: string) => {
    if (res.added.length > 0) {
      setDocuments((prev) => [...res.added, ...prev]);
      setBranches((prev) => [
        ...prev,
        ...res.added.map((d) => ({
          id: d.currentBranchId,
          documentId: d.id,
          name: '主线',
          isMain: true,
          createdAt: d.createdAt,
          headSnapshotId: null,
        })),
      ]);
      res.added.forEach((d) => recordSyncOp(d, 'upsert'));
    }
    if (res.updated.length > 0) {
      const updMap = new Map(res.updated.map((d) => [d.id, d]));
      setDocuments((prev) => prev.map((d) => updMap.get(d.id) ?? d));
      res.updated.forEach((d) => recordSyncOp(d, 'upsert'));
    }
    if (res.conflicts.length > 0) {
      setSyncConflicts(res.conflicts);
    }
    setSettings((s) => ({
      ...s,
      sync: {
        ...normalizeSyncSettings(s.sync),
        lastSyncedAt: new Date().toISOString(),
      },
    }));
    showToast(
      `${sourceLabel}同步完成：新增 ${res.added.length} · 更新 ${res.updated.length} · 冲突 ${res.conflicts.length}`,
    );
  };

  const handleResolveConflict = (
    conflictId: string,
    resolution: 'local' | 'remote' | 'custom',
    customText?: string,
  ) => {
    const item = syncConflicts.find((c) => c.id === conflictId);
    if (!item) return;
    if (resolution !== 'local') {
      const nextMd = resolution === 'remote' ? item.remoteText : (customText ?? item.localText);
      const nextTex = syncFormatText(nextMd, 'markdown', 'latex');
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === item.docId
            ? {
                ...d,
                markdownText: nextMd,
                latexText: nextTex,
                updatedAt: new Date().toISOString(),
              }
            : d,
        ),
      );
      recordSyncOp(item.remoteDoc, 'merge');
    }
    setSyncConflicts((prev) => prev.filter((c) => c.id !== conflictId));
    showToast(`已解决「${item.title}」同步冲突`);
  };

  const shellClass = [
    'arc-app-shell',
    !isDrawerMode && leftSidebarCollapsed ? 'left-collapsed' : '',
    !isTimelineSheetMode && timelineCollapsed ? 'timeline-collapsed' : '',
    isFullscreen ? 'fullscreen-mode' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const simDims = deviceEnv.isSimulatedPreview
    ? getSimulatedFrameDimensions(deviceEnv.formFactor)
    : null;

  const appShellContent = (
    <>
      {settings.theme === 'celestial-optics' && (
        <CelestialCanvas
          settings={settings.celestial ?? DEFAULT_CELESTIAL}
          isMobileOrTablet={deviceEnv.isPhone || deviceEnv.isTablet}
          prefersReducedMotion={deviceEnv.prefersReducedMotion}
          gyroscope={settings.gyroscope}
          onBackendStatusChange={setRenderStatus}
        />
      )}
      {settings.theme === 'weather-live' && (
        <WeatherCanvas
          effects={activeWeatherVisual.effects}
          timeOfDay={activeWeatherVisual.timeOfDay}
          isLiveDay={activeWeatherVisual.isLiveDay}
          intensity={weatherCfg.effectIntensity}
          rainStreakOpacity={weatherCfg.rainStreakOpacity ?? DEFAULT_WEATHER.rainStreakOpacity}
          darkMaskOpacity={weatherCfg.darkMaskOpacity}
          renderMode={weatherCfg.renderMode ?? DEFAULT_WEATHER.renderMode}
          quality={weatherCfg.quality ?? DEFAULT_WEATHER.quality}
          isMobileOrTablet={deviceEnv.isPhone || deviceEnv.isTablet}
          prefersReducedMotion={deviceEnv.prefersReducedMotion}
          gyroscope={settings.gyroscope}
          onBackendStatusChange={setRenderStatus}
        />
      )}
      <div className={shellClass} style={shellStyle}>
      {isFullscreen && (
        <button
          className="arc-btn arc-btn-primary arc-btn-pill arc-fullscreen-exit"
          onClick={() => setIsFullscreen(false)}
          title={dict.topbar.exitFullscreen}
        >
          <Minimize2 size={14} />
          <span>{dict.topbar.exitFullscreenShort}</span>
        </button>
      )}

      {revisionMode ? (
        <div className="arc-revision-topbar-orb-wrap">
          <button
            type="button"
            className="arc-revision-topbar-orb"
            onClick={() => {
              triggerAppHaptic('light');
              setRevisionOrbMenuOpen((v) => !v);
            }}
            aria-label={settings.locale === 'zh-CN' ? '审阅模式菜单' : 'Review Mode Menu'}
            title={settings.locale === 'zh-CN' ? '审阅模式菜单' : 'Review Mode Menu'}
          >
            {deviceEnv.isPhone || deviceEnv.isTabletPortrait ? (
              <Menu size={16} />
            ) : (
              <>
                <span className="arc-orb-dot" />
                <span>{settings.locale === 'zh-CN' ? '审阅' : 'Review'}</span>
                {openAnnotationCount > 0 && (
                  <span className="arc-orb-badge">{openAnnotationCount}</span>
                )}
              </>
            )}
          </button>
          {revisionOrbMenuOpen && (
            <div className="arc-revision-orb-menu">
              <button
                type="button"
                className="arc-btn arc-btn-primary"
                style={{ height: 30, fontSize: 12, width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  triggerAppHaptic('medium');
                  setRevisionOrbMenuOpen(false);
                  if (revisionExitGuardRef.current?.()) return;
                  setRevisionMode(false);
                }}
              >
                {settings.locale === 'zh-CN' ? '退出审阅模式' : 'Exit Review Mode'}
              </button>
              <button
                type="button"
                className="arc-btn"
                style={{ height: 30, fontSize: 12, width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  setRevisionOrbMenuOpen(false);
                  handleSaveMilestone();
                }}
              >
                {settings.locale === 'zh-CN' ? '保存里程碑' : 'Save Milestone'}
              </button>
              <button
                type="button"
                className="arc-btn"
                style={{ height: 30, fontSize: 12, width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  setRevisionOrbMenuOpen(false);
                  setSettingsOpen(true);
                }}
              >
                {settings.locale === 'zh-CN' ? '打开设置' : 'Settings'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <TopBar
          dict={dict}
          doc={activeDoc}
        activeBranchName={activeBranchName}
        activeFormat={activeDoc?.activeFormat ?? 'markdown'}
        splitPreview={splitPreview}
        theme={settings.theme}
        leftCollapsed={isDrawerMode ? !mobileDrawerOpen : leftSidebarCollapsed}
        rightCollapsed={rightSidebarCollapsed}
        openAnnotationCount={openAnnotationCount}
        canUndo={activeHistory?.canUndo() ?? false}
        canRedo={activeHistory?.canRedo() ?? false}
        undoLabel={activeHistory?.peekUndoLabel() ?? null}
        redoLabel={activeHistory?.peekRedoLabel() ?? null}
        undoCount={activeHistory?.undoCount() ?? 0}
        redoCount={activeHistory?.redoCount() ?? 0}
        haloPulse={haloPulse}
        deviceEnv={deviceEnv}
        syncConflictCount={syncConflicts.length}
        onToggleLeftSidebar={() => {
          if (isDrawerMode) setMobileDrawerOpen((v) => !v);
          else setLeftSidebarCollapsed((c) => !c);
        }}
        onToggleRightSidebar={() => {
          if (deviceEnv.isPhone || deviceEnv.isTabletPortrait) {
            setRevisionMode((v) => !v);
          } else {
            setRightSidebarCollapsed((c) => !c);
          }
        }}
        onEnterFullscreen={() => setIsFullscreen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onFormatChange={handleFormatChange}
        onToggleSplitPreview={() => setSplitPreview((v) => !v)}
        onSaveMilestone={handleSaveMilestone}
        onToggleSeal={handleToggleSeal}
        onOpenCoverSplit={() => {
          if (!activeDoc) return;
          const b = parsedBundlesRef.current[activeDoc.id];
          if (b) setCoverModalData({ docId: activeDoc.id, bundle: b });
          else showToast('当前文档为本地新建或无原始 Word 封面包');
        }}
        onOpenBranches={() => setBranchModalOpen(true)}
        onOpenPaperStudio={() => setPaperStudioOpen(true)}
        onOpenContextAssets={() => setContextAssetsOpen(true)}
        onOpenEvolutionStudio={() => setEvolutionStudioOpen(true)}
        phrasebankEnabled={pbConfig.enabled}
        phrasebankVisible={
          pbConfig.enabled &&
          !capsuleDismissed &&
          (pbConfig.scope === 'all-spaces' || activeSpace.kind === 'paper')
        }
        onTogglePhrasebankCapsule={() => {
          if (!pbConfig.enabled) {
            setSettings((s) => ({
              ...s,
              phrasebank: { ...pbConfig, enabled: true, dismissed: false, collapsed: false },
            }));
            showToast('已启用学术写作句库胶囊');
          } else {
            setCapsuleDismissed(!capsuleDismissed);
          }
        }}
        layoutPresets={allLayoutPresets}
        activePresetId={activePresetId}
        onApplyLayoutPreset={handleApplyLayoutPreset}
        onSaveLayoutPreset={handleSaveLayoutPreset}
        onOverwriteLayoutPreset={handleOverwriteLayoutPreset}
        onDeleteLayoutPreset={handleDeleteLayoutPreset}
        onResetDefaultLayout={handleResetDefaultLayout}
        onExportCleanWord={() => handleExportWord('clean')}
        onExportRedlineWord={() => handleExportWord('redline')}
        onExportText={handleExportText}
        onOpenSettings={() => {
          setSettingsInitialTab('appearance');
          setSettingsOpen(true);
        }}
        onOpenSync={() => setSyncModalOpen(true)}
        onOpenTimelineSheet={() => setMobileTimelineOpen(true)}
        onOpenCameraScan={() => setCameraScanOpen(true)}
        onOpenShareIntake={() => {
          setShareIntakePayload({ source: 'manual' });
          setShareModalOpen(true);
        }}
        onOpenTutorial={() => setTutorialMode('replay')}
        onHaptic={triggerAppHaptic}
      />
      )}

      <Sidebar
        dict={dict}
        locale={settings.locale}
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        documents={activeDocuments}
        activeDocId={activeDocId}
        snapshotCountByDoc={snapshotCountByDoc}
        watchActive={settings.watchActive}
        watchDirectory={settings.watchDirectory}
        isDrawerMode={isDrawerMode}
        drawerOpen={mobileDrawerOpen}
        isMobileOS={deviceEnv.isMobileOS}
        onCloseDrawer={() => setMobileDrawerOpen(false)}
        onSelectSpace={(spId) => {
          setActiveSpaceId(spId);
          const firstDoc = activeDocuments.find((d) => d.spaceId === spId);
          setActiveDocId(firstDoc ? firstDoc.id : null);
        }}
        onSelectDoc={setActiveDocId}
        onImportFiles={handleImportFiles}
        onImportSampleDocx={handleImportSampleDocx}
        onCreateBlankDoc={handleCreateBlankDoc}
        onToggleWatch={handleToggleWatch}
        onOpenSync={() => setSyncModalOpen(true)}
        onOpenCameraScan={() => setCameraScanOpen(true)}
        onOpenShareIntake={() => {
          setShareIntakePayload({ source: 'manual' });
          setShareModalOpen(true);
        }}
        onHaptic={triggerAppHaptic}
        vaultUnlocked={vaultUnlocked}
        onOpenVaultLock={() => setVaultLockOpen(true)}
        trashedCount={trashedDocuments.length}
        onTrashDoc={handleTrashDoc}
        onOpenTrash={() => setTrashModalOpen(true)}
      />

      {!isFullscreen && !isDrawerMode && !leftSidebarCollapsed && (
        <ResizeSash
          orientation="vertical"
          className="arc-shell-resizer"
          title="拖动调整左侧栏宽度"
          style={{
            position: 'absolute',
            top: 54,
            bottom: 0,
            left: leftSidebarWidth - 3,
          }}
          onPointerDown={(e) =>
            startResizeDrag({
              event: e,
              axis: 'x',
              initialSize: leftSidebarWidth,
              min: 180,
              max: 440,
              onResize: setLeftSidebarWidth,
            })
          }
        />
      )}

      {!isFullscreen && !isTimelineSheetMode && !timelineCollapsed && (
        <ResizeSash
          orientation="horizontal"
          className="arc-shell-resizer"
          title="拖动调整底部时间轴高度"
          style={{
            position: 'absolute',
            left: !isDrawerMode && !leftSidebarCollapsed ? leftSidebarWidth : 0,
            right: 0,
            bottom: timelineHeight - 3,
          }}
          onPointerDown={(e) =>
            startResizeDrag({
              event: e,
              axis: 'y',
              initialSize: timelineHeight,
              min: 145,
              max: 420,
              invert: true,
              onResize: setTimelineHeight,
            })
          }
        />
      )}

      {!isFullscreen && !isDrawerMode && leftSidebarCollapsed && (
        <button
          className="arc-edge-expand left"
          onClick={() => setLeftSidebarCollapsed(false)}
          title={dict.topbar.expandLeft}
        >
          <PanelLeftOpen size={14} />
        </button>
      )}

      {!isFullscreen &&
        !deviceEnv.isPhone &&
        !deviceEnv.isTabletPortrait &&
        rightSidebarCollapsed &&
        activeDoc && (
          <button
            className="arc-edge-expand right"
            onClick={() => setRightSidebarCollapsed(false)}
            title={dict.topbar.expandRight}
          >
            <PanelRightOpen size={14} />
            {openAnnotationCount > 0 && (
              <span style={{ color: 'var(--arc-revision-color)', fontWeight: 700 }}>
                {openAnnotationCount}
              </span>
            )}
          </button>
        )}

      {activeDoc ? (
        <EditorWorkspace
          dict={dict}
          doc={activeDoc}
          activeFormat={activeDoc.activeFormat}
          isPaperSpace={activeSpace.kind === 'paper'}
          splitPreview={splitPreview}
          isFullscreen={isFullscreen}
          rightSidebarCollapsed={rightSidebarCollapsed}
          previewWidth={previewWidth}
          annotationWidth={annotationWidth}
          settings={settings}
          effectiveAiPolicy={effectiveAiPolicy}
          deviceEnv={deviceEnv}
          canUndo={activeHistory?.canUndo() ?? false}
          canRedo={activeHistory?.canRedo() ?? false}
          revisionMode={revisionMode}
          onSetRevisionMode={setRevisionMode}
          onExitRevisionGuardRef={revisionExitGuardRef}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onFormatChange={handleFormatChange}
          onToggleSplitPreview={() => setSplitPreview((v) => !v)}
          onSaveMilestone={handleSaveMilestone}
          onOpenCameraScan={() => setCameraScanOpen(true)}
          onHaptic={triggerAppHaptic}
          initialScroll={scrollPositionsRef.current[activeDoc.id]}
          onScrollPositionChange={handleScrollPositionChange}
          capsuleDismissed={capsuleDismissed}
          onSetCapsuleDismissed={setCapsuleDismissed}
          onUpdatePhrasebankSettings={(patch) =>
            setSettings((s) => ({
              ...s,
              phrasebank: { ...normalizePhrasebankSettings(s.phrasebank), ...patch },
            }))
          }
          onNotify={showToast}
          onResizePreview={setPreviewWidth}
          onResizeAnnotation={setAnnotationWidth}
          onCycleAiPolicy={() => {
            if (activeSpace.kind === 'vault') {
              const nextPolicy: AiPrivacyPolicy =
                effectiveAiPolicy === 'local-only' ? 'disabled' : 'local-only';
              setDocuments((prev) =>
                prev.map((d) =>
                  d.id === activeDoc.id ? { ...d, aiPolicyOverride: nextPolicy } : d,
                ),
              );
              showToast(`保险箱安全限制：AI 策略已切换为 ${nextPolicy}`);
              return;
            }
            const order: AiPrivacyPolicy[] = ['cloud-or-local', 'local-only', 'disabled'];
            const nextPolicy = order[(order.indexOf(effectiveAiPolicy) + 1) % order.length];
            setDocuments((prev) =>
              prev.map((d) =>
                d.id === activeDoc.id ? { ...d, aiPolicyOverride: nextPolicy } : d,
              ),
            );
            showToast(`文档 AI 隐私锁已切换为：${nextPolicy}`);
          }}
          onTextChange={handleTextChange}
          onAcceptRevision={handleAcceptRevision}
          onRejectRevision={handleRejectRevision}
          onToggleResolveComment={handleToggleResolveComment}
          onReplyComment={handleReplyComment}
          onApplyAiSuggestion={handleApplyAiSuggestion}
          onBatchAcceptRevisions={handleBatchAcceptRevisions}
          onBatchRejectRevisions={handleBatchRejectRevisions}
          onBatchResolveComments={handleBatchResolveComments}
          onOpenSkillsManager={() => {
            setSettingsInitialTab('ai');
            setSettingsOpen(true);
          }}
        />
      ) : (
        <main className="arc-workspace" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--text-muted)' }}>请选择或导入一篇文档开始使用穹档</div>
        </main>
      )}

      <TimelinePanel
        dict={dict}
        doc={activeDoc}
        branches={docBranches}
        snapshots={docSnapshots}
        darlings={darlings.filter((d) => d.documentId === activeDocId)}
        motivationCountBySnap={motivationCountBySnap}
        assetCountBySnap={assetCountBySnap}
        cas={casRef.current}
        collapsed={timelineCollapsed}
        isSheetMode={isTimelineSheetMode}
        sheetOpen={mobileTimelineOpen}
        onCloseSheet={() => setMobileTimelineOpen(false)}
        onHaptic={triggerAppHaptic}
        onToggleCollapse={() => setTimelineCollapsed((c) => !c)}
        onOpenBranches={() => setBranchModalOpen(true)}
        onCompareSnapshots={(leftId, rightId) => {
          const left = docSnapshots.find((s) => s.id === leftId) ?? null;
          const right = docSnapshots.find((s) => s.id === rightId) ?? null;
          const leftText = left ? (casRef.current.getText(left.markdownHash) ?? '') : '';
          const rightText = right ? (casRef.current.getText(right.markdownHash) ?? '') : '';
          setDiffModalData({
            tab: 'diff',
            leftSnap: left,
            rightSnap: right,
            leftText,
            rightText,
          });
        }}
        onRestoreSnapshot={(snap) => {
          if (!activeDoc || activeDoc.isSealed) return;
          const md = casRef.current.getText(snap.markdownHash) ?? '';
          const tex = casRef.current.getText(snap.latexHash) ?? syncFormatText(md, 'markdown', 'latex');
          commitDocMutation(`恢复快照 ${snap.label}`, (cur) => ({
            ...cur,
            markdownText: md,
            latexText: tex,
          }));
          showToast(`已恢复到快照：${snap.label}（可 Ctrl+Z 撤销）`);
        }}
        onOpenDarlings={() => {
          setDiffModalData({
            tab: 'darlings',
            leftSnap: docSnapshots[0] ?? null,
            rightSnap: docSnapshots[docSnapshots.length - 1] ?? null,
            leftText: docSnapshots[0] ? (casRef.current.getText(docSnapshots[0].markdownHash) ?? '') : '',
            rightText: activeDoc?.markdownText ?? '',
          });
        }}
      />

      {coverModalData && (
        <CoverSplitModal
          isZh={settings.locale === 'zh-CN'}
          bundle={coverModalData.bundle}
          initialCutoff={
            documents.find((d) => d.id === coverModalData.docId)?.coverRule.coverEndBlockIndex ??
            coverModalData.bundle.detectedCoverEndIndex
          }
          onConfirm={(cutoff, remember) => {
            const extracted = extractBodyWithCoverIndex(coverModalData.bundle, cutoff, 'markdown');
            setDocuments((prev) =>
              prev.map((d) =>
                d.id === coverModalData.docId
                  ? {
                      ...d,
                      markdownText: extracted.text,
                      latexText: syncFormatText(extracted.text, 'markdown', 'latex'),
                      annotations: extracted.annotations,
                      coverXmlNodes: extracted.coverXmlNodes,
                      styleSidecar: extracted.styleSidecar,
                      coverRule: {
                        documentId: d.id,
                        coverEndBlockIndex: cutoff,
                        remember,
                        coverBlockCount: extracted.coverBlockCount,
                      },
                    }
                  : d,
              ),
            );
            setCoverModalData(null);
            showToast(`已应用封面切分（保留前 ${cutoff} 个封面块）`);
          }}
          onClose={() => setCoverModalData(null)}
        />
      )}

      {diffModalData && (
        <DiffViewerModal
          isZh={settings.locale === 'zh-CN'}
          initialTab={diffModalData.tab}
          leftSnap={diffModalData.leftSnap}
          rightSnap={diffModalData.rightSnap}
          leftText={diffModalData.leftText}
          rightText={diffModalData.rightText}
          darlings={darlings.filter((d) => d.documentId === activeDocId)}
          onCopyDarling={(txt) => {
            navigator.clipboard?.writeText(txt).catch(() => {});
            showToast('已复制废稿片段到剪贴板');
          }}
          onClose={() => {
            if (!tutorialMode) setDiffModalData(null);
          }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          runtimeInfo={runtimeInfo}
          lastBackupAt={lastBackupAt}
          onOpenBackupFolder={handleOpenBackupFolder}
          onOpenVaultFolder={handleOpenVaultFolder}
          onPickVaultDirectory={handlePickVaultDirectory}
          onSetCustomVaultDir={handleSetCustomVaultDir}
          onRunManualBackup={handleRunManualBackup}
          initialTab={settingsInitialTab}
          deviceEnv={deviceEnv}
          onOpenSync={() => setSyncModalOpen(true)}
          onOpenTutorial={() => setTutorialMode('replay')}
          onHaptic={triggerAppHaptic}
          renderStatus={renderStatus}
          randomWeatherLabel={randomWeatherState.labelZh}
          onTriggerRandomWeather={handleTriggerRandomWeather}
          layoutPresets={allLayoutPresets}
          activePresetId={activePresetId}
          currentLayoutSummary={currentLayoutSummary}
          onApplyLayoutPreset={handleApplyLayoutPreset}
          onSaveLayoutPreset={handleSaveLayoutPreset}
          onOverwriteLayoutPreset={handleOverwriteLayoutPreset}
          onDeleteLayoutPreset={handleDeleteLayoutPreset}
          onResetDefaultLayout={handleResetDefaultLayout}
          onClearScrollMemory={handleClearScrollMemory}
          onUpdate={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          onClose={() => {
            if (!tutorialMode) setSettingsOpen(false);
          }}
        />
      )}

      {branchModalOpen && activeDoc && (
        <BranchModal
          isZh={settings.locale === 'zh-CN'}
          isTouch={deviceEnv.isTouch}
          docTitle={activeDoc.title}
          currentBranchId={activeDoc.currentBranchId}
          branches={docBranches}
          snapshots={docSnapshots}
          cas={casRef.current}
          currentText={activeDoc.markdownText}
          readOnly={activeDoc.isSealed}
          onCreateBranch={(name) => {
            const latest =
              docSnapshots.filter((s) => s.branchId === activeDoc.currentBranchId).pop() ?? null;
            const created = createParallelBranch({
              doc: activeDoc,
              sourceSnapshot: latest,
              name,
            });
            setBranches((prev) => [...prev, created.branch]);
            if (created.clonedSnapshot) {
              setSnapshots((prev) => [...prev, created.clonedSnapshot!]);
            }
            setDocuments((prev) =>
              prev.map((d) =>
                d.id === activeDoc.id ? { ...d, currentBranchId: created.branch.id } : d,
              ),
            );
            showToast(`已分出平行分支：${created.branch.name}`);
          }}
          onSwitchBranch={(branchId) => {
            const targetSnap = docSnapshots.filter((s) => s.branchId === branchId).pop();
            const nextMd = targetSnap
              ? (casRef.current.getText(targetSnap.markdownHash) ?? activeDoc.markdownText)
              : activeDoc.markdownText;
            const nextTex = targetSnap
              ? (casRef.current.getText(targetSnap.latexHash) ?? syncFormatText(nextMd, 'markdown', 'latex'))
              : activeDoc.latexText;

            setDocuments((prev) =>
              prev.map((d) =>
                d.id === activeDoc.id
                  ? {
                      ...d,
                      currentBranchId: branchId,
                      markdownText: nextMd,
                      latexText: nextTex,
                    }
                  : d,
              ),
            );
            showToast(`已切换到分支：${docBranches.find((b) => b.id === branchId)?.name ?? ''}`);
          }}
          onMergeIntoMain={(mergedText, sourceBranchName) => {
            const mainBr = docBranches.find((b) => b.isMain) ?? docBranches[0];
            if (!mainBr) return;
            commitDocMutation(`合并分支 ${sourceBranchName}`, (cur) => ({
              ...cur,
              markdownText: mergedText,
              latexText: syncFormatText(mergedText, 'markdown', 'latex'),
            }));
            setDocuments((prev) =>
              prev.map((d) =>
                d.id === activeDoc.id ? { ...d, currentBranchId: mainBr.id } : d,
              ),
            );
            setBranchModalOpen(false);
            showToast(`已将「${sourceBranchName}」合并回主线（支持 Ctrl+Z 撤销）`);
          }}
          onClose={() => {
            if (!tutorialMode) setBranchModalOpen(false);
          }}
        />
      )}

      {contextAssetsOpen && activeDoc && (
        <ContextAssetsModal
          isZh={settings.locale === 'zh-CN'}
          docId={activeDoc.id}
          docTitle={activeDoc.title}
          snapshots={docSnapshots}
          motivations={motivations.filter((m) => m.documentId === activeDoc.id)}
          linkedAssets={linkedAssets.filter((a) => a.documentId === activeDoc.id)}
          onAddMotivation={(item) => {
            setMotivations((prev) => [item, ...prev]);
            showToast('已将修改动机留痕绑定至版本');
          }}
          onAddLinkedAsset={(asset) => {
            setLinkedAssets((prev) => [asset, ...prev]);
            showToast(`已关联科研资产：${asset.name}`);
          }}
          onClose={() => {
            if (!tutorialMode) setContextAssetsOpen(false);
          }}
        />
      )}

      {paperStudioOpen && activeDoc && (
        <PaperStudioModal
          initialTab={paperStudioInitialTab}
          isTouch={deviceEnv.isTouch}
          doc={activeDoc}
          snapshots={docSnapshots}
          cas={casRef.current}
          settings={settings}
          effectiveAiPolicy={effectiveAiPolicy}
          onApplyQuickFix={(snippet, replacement) => {
            if (!activeDoc.markdownText.includes(snippet)) {
              showToast('未在当前正文找到精确匹配片段，请手动定位修改');
              return;
            }
            const nextMd = activeDoc.markdownText.replace(snippet, replacement);
            commitDocMutation('一致性快速修正', (cur) => ({
              ...cur,
              markdownText: nextMd,
              latexText: syncFormatText(nextMd, 'markdown', 'latex'),
              annotations: adjustAnchorsForTextEdit(cur.markdownText, nextMd, cur.annotations),
            }));
            showToast('已一键修正数值口径不一致（可 Ctrl+Z 撤销）');
          }}
          onClose={() => {
            if (!tutorialMode) setPaperStudioOpen(false);
          }}
        />
      )}

      {evolutionStudioOpen && activeDoc && (
        <EvolutionStudioModal
          isZh={settings.locale === 'zh-CN'}
          doc={activeDoc}
          snapshots={docSnapshots}
          cas={casRef.current}
          activity={writingActivity}
          onClose={() => {
            if (!tutorialMode) setEvolutionStudioOpen(false);
          }}
        />
      )}

      {vaultLockOpen && (
        <VaultLockModal
          isZh={settings.locale === 'zh-CN'}
          vaultUnlocked={vaultUnlocked}
          hasPasscodeSet={vaultPassHash !== null}
          vaultDocuments={activeDocuments.filter((d) => d.spaceId === 'sp_vault')}
          sealedDocuments={activeDocuments.filter((d) => d.isSealed && d.sealedHash)}
          onHaptic={triggerAppHaptic}
          onSetAndUnlock={async (passcode) => {
            const hash = await sha256Hex(`arcvault_vault_check:${passcode}`);
            vaultPassRef.current = passcode;
            setVaultPassHash(hash);
            setVaultUnlocked(true);
            showToast('已启用 AES-256-GCM 保险箱主密码');
          }}
          onUnlock={async (passcode) => {
            const hash = await sha256Hex(`arcvault_vault_check:${passcode}`);
            if (vaultPassHash && hash !== vaultPassHash) return false;
            const decryptedDocs = await Promise.all(
              documents.map(async (d) => {
                if (d.spaceId !== 'sp_vault' || !d.encryptedPayload) return d;
                const plain = await decryptVaultText(d.encryptedPayload, passcode);
                return {
                  ...d,
                  markdownText: plain,
                  latexText: syncFormatText(plain, 'markdown', 'latex'),
                  encryptedPayload: undefined,
                };
              }),
            );
            setDocuments(decryptedDocs);
            vaultPassRef.current = passcode;
            setVaultUnlocked(true);
            showToast('保险箱已解密恢复原文');
            return true;
          }}
          onLockVault={async () => {
            const passcode = vaultPassRef.current;
            if (!passcode) return;
            const lockedDocs = await Promise.all(
              documents.map(async (d) => {
                if (d.spaceId !== 'sp_vault') return d;
                const synced = syncDocFormatsIfDirty(d);
                const envelope = await encryptVaultText(synced.markdownText, passcode);
                const masked =
                  '🔒 [AES-256-GCM 已加密上锁]\n\n该档案正文已加密为认证密文信封。点击左侧栏「解锁保险箱」输入主密码即可解密恢复。';
                return {
                  ...synced,
                  markdownText: masked,
                  latexText: masked,
                  encryptedPayload: envelope,
                };
              }),
            );
            setDocuments(lockedDocs);
            vaultPassRef.current = null;
            setVaultUnlocked(false);
            setVaultLockOpen(false);
            showToast('私密档案已执行 AES-256-GCM 加密上锁');
          }}
          onClose={() => {
            if (!tutorialMode) setVaultLockOpen(false);
          }}
        />
      )}

      {cameraScanOpen && (
        <CameraScanModal
          isZh={settings.locale === 'zh-CN'}
          spaces={spaces}
          defaultSpaceId={activeSpaceId}
          hasActiveDoc={Boolean(activeDoc && !activeDoc.isSealed && !activeDoc.officePreview)}
          onCreateScannedDoc={handleCreateScannedDoc}
          onAttachToActiveDoc={handleAttachScanToActiveDoc}
          onHaptic={triggerAppHaptic}
          onClose={() => setCameraScanOpen(false)}
        />
      )}

      {shareModalOpen && (
        <ShareIntakeModal
          isZh={settings.locale === 'zh-CN'}
          initialPayload={shareIntakePayload}
          spaces={spaces}
          defaultSpaceId={activeSpaceId}
          onCommitShare={handleCommitShareIntake}
          onHaptic={triggerAppHaptic}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {syncModalOpen && (
        <SyncModal
          syncSettings={settings.sync}
          documents={documents}
          oplog={syncOplog}
          conflicts={syncConflicts}
          baseTextByDocId={syncBaseTextByDocId}
          onUpdateSyncSettings={(patch) =>
            setSettings((s) => ({
              ...s,
              sync: { ...normalizeSyncSettings(s.sync), ...patch },
            }))
          }
          onApplySyncResult={handleApplySyncResult}
          onResolveConflict={handleResolveConflict}
          onHaptic={triggerAppHaptic}
          onClose={() => {
            if (!tutorialMode) setSyncModalOpen(false);
          }}
        />
      )}

      {trashModalOpen && (
        <TrashModal
          dict={dict}
          locale={settings.locale}
          spaces={spaces}
          trashedDocs={trashedDocuments}
          snapshotCountByDoc={snapshotCountByDoc}
          onRestore={handleRestoreFromTrash}
          onHaptic={triggerAppHaptic}
          onClose={() => {
            if (!tutorialMode) setTrashModalOpen(false);
          }}
        />
      )}

      {backGuardVisible && (
        <div
          className="arc-back-guard-banner"
          role="status"
          aria-live="polite"
          onClick={() => {
            if (backGuardTimerRef.current !== null) {
              window.clearTimeout(backGuardTimerRef.current);
              backGuardTimerRef.current = null;
            }
            backGuardDeadlineRef.current = 0;
            setBackGuardVisible(false);
          }}
        >
          <span className="arc-back-guard-icon" aria-hidden="true">
            <ShieldAlert size={15} />
          </span>
          <div className="arc-back-guard-copy">
            <span className="arc-back-guard-title">
              {settings.locale === 'zh-CN'
                ? '再按一次返回键退出穹档'
                : 'Press Back again to exit ArcVault'}
            </span>
          </div>
          <button
            type="button"
            className="arc-back-guard-close"
            aria-label={settings.locale === 'zh-CN' ? '取消退出' : 'Dismiss'}
            onClick={(e) => {
              e.stopPropagation();
              if (backGuardTimerRef.current !== null) {
                window.clearTimeout(backGuardTimerRef.current);
                backGuardTimerRef.current = null;
              }
              backGuardDeadlineRef.current = 0;
              setBackGuardVisible(false);
            }}
          >
            <X size={13} />
          </button>
          <span key={backGuardCycle} className="arc-back-guard-progress" aria-hidden="true" />
        </div>
      )}

      {toast && (
        <div
          className="arc-toast"
          style={{
            position: 'fixed',
            bottom: 58,
            right: 22,
            padding: '9px 15px',
            borderRadius: 999,
            background: 'var(--text-primary)',
            color: 'var(--bg-elevated)',
            fontSize: 12.5,
            fontWeight: 500,
            boxShadow: 'var(--shadow-md)',
            zIndex: 200,
          }}
        >
          {toast}
        </div>
      )}

      {tutorialMode && (tutorialMode === 'first-run' || documents.length > 0) && (
        <TutorialOverlay
          key={tutorialMode}
          mode={tutorialMode}
          deviceEnv={deviceEnv}
          dict={dict}
          theme={settings.theme}
          locale={settings.locale}
          readyToStart={documents.length > 0}
          runtimeInfo={runtimeInfo}
          onPickVaultDirectory={handlePickVaultDirectory}
          onSetCustomVaultDir={handleSetCustomVaultDir}
          onSelectTheme={(nextTheme) => setSettings((s) => ({ ...s, theme: nextTheme }))}
          onHaptic={triggerAppHaptic}
          onApplyScene={applyTutorialScene}
          onCompleteFirstRun={() => {
            markOnboardingCompleted();
            finishTutorialCleanup(false);
            setTutorialMode(null);
            showToast('欢迎使用 ArcVault · 穹档！可随时在「工具箱 / 设置」中重播使用教程');
          }}
          onCloseReplay={() => {
            finishTutorialCleanup(true);
            setTutorialMode(null);
          }}
        />
      )}

      <GlobalTooltipHost />
      <TouchScrollScrubber
        enabled={deviceEnv.isPhone || deviceEnv.isTablet}
        theme={settings.theme}
        scrubberSettings={settings.scrollScrubber}
        activeDocText={
          activeDoc
            ? activeDoc.activeFormat === 'markdown'
              ? activeDoc.markdownText
              : activeDoc.latexText
            : ''
        }
        activeDocTitle={activeDoc?.title ?? ''}
        onHaptic={triggerAppHaptic}
      />
    </div>
    </>
  );

  if (simDims) {
    return (
      <div className="arc-device-preview-stage">
        <div className="arc-device-preview-bar">
          <span style={{ fontWeight: 600, fontSize: 12 }}>模拟设备预览：{simDims.label}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`arc-btn ${deviceEnv.formFactor === 'phone' ? 'arc-btn-primary' : ''}`}
              style={{ height: 26, fontSize: 11.5 }}
              onClick={() => setSettings((s) => ({ ...s, devicePreview: 'phone' }))}
            >
              <Smartphone size={12} />
              <span>手机</span>
            </button>
            <button
              type="button"
              className={`arc-btn ${deviceEnv.formFactor === 'tablet-portrait' ? 'arc-btn-primary' : ''}`}
              style={{ height: 26, fontSize: 11.5 }}
              onClick={() => setSettings((s) => ({ ...s, devicePreview: 'tablet-portrait' }))}
            >
              <Tablet size={12} />
              <span>平板竖屏</span>
            </button>
            <button
              type="button"
              className={`arc-btn ${deviceEnv.formFactor === 'tablet-landscape' ? 'arc-btn-primary' : ''}`}
              style={{ height: 26, fontSize: 11.5 }}
              onClick={() => setSettings((s) => ({ ...s, devicePreview: 'tablet-landscape' }))}
            >
              <Tablet size={12} />
              <span>平板横屏</span>
            </button>
            <button
              type="button"
              className="arc-btn"
              style={{ height: 26, fontSize: 11.5 }}
              onClick={() => setSettings((s) => ({ ...s, devicePreview: 'auto' }))}
            >
              <Monitor size={12} />
              <span>退出模拟</span>
            </button>
          </div>
        </div>
        <div
          className="arc-device-preview-frame"
          style={{
            width: `min(${simDims.width}px, 96vw)`,
            height: `min(${simDims.height}px, calc(100vh - 70px))`,
          }}
        >
          {appShellContent}
        </div>
      </div>
    );
  }

  return appShellContent;
}
export default App;
