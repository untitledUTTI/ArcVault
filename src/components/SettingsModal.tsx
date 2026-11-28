import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  X,
  Sparkles,
  RotateCcw,
  Cpu,
  PlugZap,
  Type,
  Palette,
  FolderCog,
  FolderOpen,
  Info,
  Check,
  ShieldCheck,
  ImagePlus,
  Sun,
  Moon,
  Wand2,
  CloudSun,
  MapPin,
  RefreshCw,
  Shuffle,
  Upload,
  Plus,
  Download,
  Trash2,
  BookOpen,
  ChevronDown,
  GraduationCap,
  LayoutTemplate,
  AlertTriangle,
  Smartphone,
  Tablet,
  Monitor,
  Vibrate,
  Wifi,
  Compass,
  RotateCw,
  MoveVertical,
  ExternalLink,
  Scale,
  Brain,
  FileCode2,
} from 'lucide-react';
import { OPEN_SOURCE_PROJECTS } from '../core/openSourceLicenses';
import {
  DEFAULT_GYROSCOPE,
  normalizeGyroscopeSettings,
  recalibrateGyroscopeBaseline,
  requestGyroscopePermission,
} from '../platform/backgroundMotion';
import {
  DEFAULT_HAPTICS,
  normalizeHapticsSettings,
  testHapticPattern,
} from '../platform/haptics';
import type { DeviceEnvironment } from '../platform/device';
import {
  ALL_CAPSULE_ICONS,
  CAPSULE_ICON_META,
  normalizePhrasebankSettings,
} from '../core/phrasebank/phrasebankStorage';
import {
  summarizeLayoutBadges,
  type WorkspaceLayoutPreset,
} from '../core/workspaceLayout';
import { ArcVaultLogo } from './ArcVaultLogo';
import { ArcSelect } from './ArcSelect';
import { ArcSlider } from './ArcSlider';
import { ArcColorPicker } from './ArcColorPicker';
import {
  ScrubberHandleGlyph,
  normalizeScrollScrubberSettings,
  resolveThemeScrubberShape,
} from './TouchScrollScrubber';
import {
  AI_CLOUD_FREE_PRESETS,
  AI_CLOUD_GENERAL_PRESETS,
  AI_LOCAL_RUNTIME_PRESETS,
  testAiConnection,
} from '../core/aiGateway';
import {
  SKILL_CATEGORY_META,
  exportSkillAsMarkdown,
  loadSkillFullInstructions,
  parseSkillFileContent,
  resolveMergedSkills,
} from '../core/skillRegistry';
import {
  nativePickLocalModelDirectory,
  nativePickLocalModelFile,
  triggerBrowserDownload,
} from '../platform/bridge';
import {
  DEFAULT_TYPOGRAPHY,
  resolveEditorFontStack,
  resolveUiFontStack,
} from '../core/typography';
import {
  DEFAULT_MONET,
  MONET_CURATED_SEEDS,
  MONET_STYLE_META,
  extractSeedsFromImageFile,
  generateMonetTokens,
} from '../core/monetEngine';
import { DEFAULT_CELESTIAL } from './celestial/celestialShaders';
import {
  DEFAULT_WEATHER,
  QUICK_CITIES,
  WEATHER_EFFECT_META,
  WEATHER_PRESET_COMBOS,
  WEATHER_RANDOM_INTERVALS,
  fetchLiveWeather,
  searchWeatherLocations,
  type WeatherLocationCandidate,
} from '../core/weatherService';
import { resolveWeatherThemePalette } from '../core/weatherTheme';
import type {
  AiSkill,
  AiThinkingEffort,
  AppSettings,
  BackupFormat,
  CelestialMood,
  DevicePreviewOverride,
  EditorFontPreset,
  HapticIntensity,
  HapticPattern,
  RenderBackendMode,
  RenderBackendStatus,
  RenderQualityTier,
  SkillCategory,
  ThemeId,
  UiFontPreset,
  WeatherControlMode,
  WeatherEffectId,
  WeatherTimeOfDay,
} from '../types/archive';

type SettingsTab = 'appearance' | 'typography' | 'archive' | 'device' | 'ai' | 'about';

interface SettingsModalProps {
  settings: AppSettings;
  runtimeInfo: { isTauri: boolean; platform: string; vaultDir: string; backupDir?: string };
  lastBackupAt?: string | null;
  onOpenBackupFolder?: () => void;
  onOpenVaultFolder?: () => void;
  onPickVaultDirectory?: () => Promise<string | null>;
  onSetCustomVaultDir?: (path: string) => Promise<void>;
  onRunManualBackup?: () => void;
  initialTab?: SettingsTab;
  deviceEnv?: DeviceEnvironment;
  onOpenSync?: () => void;
  onOpenTutorial?: () => void;
  onHaptic?: (pattern: HapticPattern) => void;
  renderStatus?: RenderBackendStatus | null;
  randomWeatherLabel?: string;
  onTriggerRandomWeather?: () => void;
  layoutPresets?: WorkspaceLayoutPreset[];
  activePresetId?: string | null;
  currentLayoutSummary?: string[];
  onApplyLayoutPreset?: (preset: WorkspaceLayoutPreset) => void;
  onSaveLayoutPreset?: (name: string) => void;
  onOverwriteLayoutPreset?: (presetId: string) => void;
  onDeleteLayoutPreset?: (presetId: string) => void;
  onResetDefaultLayout?: () => void;
  onClearScrollMemory?: () => void;
  onUpdate: (patch: Partial<AppSettings>) => void;
  onClose: () => void;
}

interface ThemeCardItem {
  id: ThemeId;
  title: string;
  desc: string;
  bg: string;
  sidebar: string;
  accent: string;
}

const ThemePreviewSwatch: React.FC<{ theme: ThemeCardItem }> = ({ theme }) => {
  const uid = useId().replace(/:/g, '');

  if (theme.id === 'celestial-optics') {
    const skyGradId = `cel-sky-${uid}`;
    const arcGradId = `cel-arc-${uid}`;
    const glowGradId = `cel-glow-${uid}`;
    return (
      <div className="arc-theme-swatch is-scenic" aria-hidden="true">
        <svg width="44" height="32" viewBox="0 0 44 32" style={{ display: 'block', width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id={skyGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#070c24" />
              <stop offset="52%" stopColor="#1e1b4b" />
              <stop offset="80%" stopColor="#6d3a7c" />
              <stop offset="100%" stopColor="#e58b88" />
            </linearGradient>
            <linearGradient id={arcGradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#c4b5fd" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#f472b6" stopOpacity="0.35" />
            </linearGradient>
            <radialGradient id={glowGradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="45%" stopColor="#bae6fd" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="44" height="32" fill={`url(#${skyGradId})`} />
          <path d="M 14 4 Q 22 9 30 4" fill="none" stroke={`url(#${arcGradId})`} strokeWidth="1.25" strokeLinecap="round" />
          <circle cx="22" cy="14" r="9.5" fill="none" stroke="#bae6fd" strokeOpacity="0.46" strokeWidth="1" />
          <circle cx="12.5" cy="14" r="2.6" fill={`url(#${glowGradId})`} />
          <circle cx="31.5" cy="14" r="2.6" fill={`url(#${glowGradId})`} />
          <circle cx="22" cy="14" r="4.5" fill={`url(#${glowGradId})`} />
          <circle cx="22" cy="14" r="2.2" fill="#fffbeb" />
          <circle cx="6.5" cy="6.5" r="0.65" fill="#e0f2fe" opacity="0.85" />
          <circle cx="37.5" cy="7.5" r="0.7" fill="#fde68a" opacity="0.8" />
          <circle cx="10.5" cy="22" r="0.55" fill="#f5d0fe" opacity="0.75" />
          <circle cx="35.5" cy="21" r="0.6" fill="#bae6fd" opacity="0.75" />
          <rect x="4" y="25.5" width="36" height="3.5" rx="1.5" fill="#060b1c" fillOpacity="0.52" stroke="#bae6fd" strokeOpacity="0.22" strokeWidth="0.5" />
        </svg>
      </div>
    );
  }

  if (theme.id === 'weather-live') {
    const skyGradId = `wth-sky-${uid}`;
    const sunGlowId = `wth-sun-${uid}`;
    const cloudGradId = `wth-cloud-${uid}`;
    return (
      <div className="arc-theme-swatch is-scenic" aria-hidden="true">
        <svg width="44" height="32" viewBox="0 0 44 32" style={{ display: 'block', width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id={skyGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b4a8f" />
              <stop offset="56%" stopColor="#2684d4" />
              <stop offset="100%" stopColor="#87c7f2" />
            </linearGradient>
            <radialGradient id={sunGlowId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff7cc" stopOpacity="1" />
              <stop offset="48%" stopColor="#fbbf24" stopOpacity="0.82" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={cloudGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
              <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.88" />
            </linearGradient>
          </defs>
          <rect width="44" height="32" fill={`url(#${skyGradId})`} />
          <circle cx="10" cy="9" r="7.5" fill={`url(#${sunGlowId})`} />
          <circle cx="10" cy="9" r="3" fill="#fffbeb" />
          <path d="M 15 24 A 15 15 0 0 1 42 15" fill="none" stroke="#fb7185" strokeOpacity="0.65" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M 16.4 24.5 A 14 14 0 0 1 41.8 16.2" fill="none" stroke="#fbbf24" strokeOpacity="0.62" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M 17.8 25 A 13 13 0 0 1 41.5 17.4" fill="none" stroke="#38bdf8" strokeOpacity="0.62" strokeWidth="1.1" strokeLinecap="round" />
          <g fill={`url(#${cloudGradId})`}>
            <circle cx="25" cy="18.5" r="4.2" />
            <circle cx="30" cy="17" r="5" />
            <circle cx="34.5" cy="19" r="3.6" />
            <rect x="23" y="18.5" width="13.5" height="4.2" rx="2.1" />
          </g>
          <g stroke="#e0f2fe" strokeWidth="1.05" strokeLinecap="round" strokeOpacity="0.86">
            <line x1="23.5" y1="24.5" x2="21.8" y2="28.8" />
            <line x1="27.5" y1="24.5" x2="25.8" y2="28.8" />
            <line x1="31.5" y1="24.5" x2="29.8" y2="28.8" />
            <line x1="35.5" y1="24.5" x2="33.8" y2="28.8" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className="arc-theme-swatch" style={{ background: theme.bg }}>
      <div style={{ background: theme.sidebar, borderRight: '1px solid rgba(128,128,128,0.2)' }} />
      <div style={{ padding: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ height: 5, width: '70%', borderRadius: 3, background: theme.accent }} />
        <div style={{ height: 4, width: '90%', borderRadius: 2, background: 'rgba(128,128,128,0.3)' }} />
      </div>
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  runtimeInfo,
  lastBackupAt,
  onOpenBackupFolder,
  onOpenVaultFolder,
  onPickVaultDirectory,
  onSetCustomVaultDir,
  onRunManualBackup,
  initialTab = 'appearance',
  deviceEnv,
  onOpenSync,
  onOpenTutorial,
  onHaptic,
  renderStatus,
  randomWeatherLabel,
  onTriggerRandomWeather,
  layoutPresets = [],
  activePresetId = null,
  currentLayoutSummary = [],
  onApplyLayoutPreset,
  onSaveLayoutPreset,
  onOverwriteLayoutPreset,
  onDeleteLayoutPreset,
  onResetDefaultLayout,
  onClearScrollMemory,
  onUpdate,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [hapticTestMsg, setHapticTestMsg] = useState<string | null>(null);
  const [gyroStatusMsg, setGyroStatusMsg] = useState<string | null>(null);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const skillFileInputRef = useRef<HTMLInputElement>(null);
  const localModelFileInputRef = useRef<HTMLInputElement>(null);

  const [skillCategoryFilter, setSkillCategoryFilter] = useState<'all' | SkillCategory>('all');
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [skillNotice, setSkillNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [creatingSkill, setCreatingSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<SkillCategory>('de-ai');
  const [newSkillLang, setNewSkillLang] = useState<AiSkill['language']>('zh-en');
  const [newSkillInstructions, setNewSkillInstructions] = useState('');

  const allSkills = useMemo(() => resolveMergedSkills(settings.skills), [settings.skills]);
  const [loadedSkillTextById, setLoadedSkillTextById] = useState<Record<string, string>>({});
  const enabledSkillCount = useMemo(() => allSkills.filter((s) => s.enabled).length, [allSkills]);
  const filteredSkills = useMemo(
    () =>
      skillCategoryFilter === 'all'
        ? allSkills
        : allSkills.filter((s) => s.category === skillCategoryFilter),
    [allSkills, skillCategoryFilter],
  );

  const toggleSkillEnabled = (skillId: string) => {
    const next = allSkills.map((s) => (s.id === skillId ? { ...s, enabled: !s.enabled } : s));
    onUpdate({ skills: next });
  };

  const deleteCustomSkill = (skillId: string) => {
    const next = allSkills.filter((s) => s.id !== skillId || s.source === 'builtin');
    onUpdate({ skills: next });
  };

  const handleImportSkillFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let importedCount = 0;
    let nextSkills = [...allSkills];

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const parsed = parseSkillFileContent(text, file.name);
        for (const item of parsed) {
          const existingIdx = nextSkills.findIndex(
            (s) => s.slug === item.slug && s.source !== 'builtin',
          );
          if (existingIdx >= 0) {
            nextSkills[existingIdx] = { ...item, id: nextSkills[existingIdx].id };
          } else {
            nextSkills = [item, ...nextSkills];
          }
          importedCount += 1;
        }
      } catch {
        // Skip unreadable file
      }
    }

    if (importedCount > 0) {
      onUpdate({ skills: nextSkills });
      setSkillNotice({
        ok: true,
        text: isZh
          ? `已成功载入 ${importedCount} 个 Skill 并默认开启（每次调用 AI 均会自动执行）。`
          : `Loaded and enabled ${importedCount} skill(s) (automatically applied on every AI call).`,
      });
    } else {
      setSkillNotice({
        ok: false,
        text: isZh
          ? '未识别到有效的 Skill 内容，请检查是否为 .md / .txt / .json 格式文件。'
          : 'No valid skill content detected. Please check that the file is .md, .txt, or .json.',
      });
    }
  };

  const handleSaveCustomSkill = () => {
    const name = newSkillName.trim();
    const instructions = newSkillInstructions.trim();
    if (!name || !instructions) {
      setSkillNotice({
        ok: false,
        text: isZh
          ? '请填写 Skill 名称与提示词规则指令。'
          : 'Please enter a skill name and prompt instructions.',
      });
      return;
    }
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `custom-${Date.now().toString(36)}`;

    const created: AiSkill = {
      id: `skill_custom_${Date.now().toString(36)}`,
      slug,
      name,
      description: newSkillDesc.trim() || instructions.split(/\r?\n/)[0].slice(0, 90),
      category: newSkillCategory,
      language: newSkillLang,
      instructions,
      enabled: true,
      source: 'custom',
      origin: isZh ? '用户自定义创建' : 'User Custom',
      tags: [isZh ? '自定义' : 'Custom'],
      createdAt: new Date().toISOString(),
    };

    onUpdate({ skills: [created, ...allSkills] });
    setNewSkillName('');
    setNewSkillDesc('');
    setNewSkillInstructions('');
    setCreatingSkill(false);
    setSkillNotice({
      ok: true,
      text: isZh
        ? `已创建并开启「${created.name}」，将在每次 AI 调用时自动挂载执行。`
        : `Created and enabled "${created.name}". It will run automatically on every AI call.`,
    });
  };

  const weather = settings.weather ?? DEFAULT_WEATHER;
  const updateWeather = (patch: Partial<typeof weather>) => {
    onUpdate({ weather: { ...weather, ...patch } });
  };
  const weatherAdaptColorByTime = weather.adaptColorByTime ?? true;
  const weatherPalette = useMemo(
    () =>
      resolveWeatherThemePalette(
        weather.timeOfDay,
        weather.mode === 'live' ? weather.liveSnapshot?.isDay : undefined,
      ),
    [weather.timeOfDay, weather.mode, weather.liveSnapshot?.isDay],
  );

  const [locationInput, setLocationInput] = useState(weather.locationQuery);
  const [locationCandidates, setLocationCandidates] = useState<WeatherLocationCandidate[]>([]);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const handleSelectWeatherCity = async (loc: WeatherLocationCandidate) => {
    setWeatherError(null);
    setWeatherBusy(true);
    setLocationInput(loc.name);
    updateWeather({
      mode: 'live',
      locationQuery: loc.name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      regionLabel: loc.regionLabel,
      province: loc.province,
      city: loc.city,
      county: loc.county,
    });
    try {
      const snap = await fetchLiveWeather(loc.latitude, loc.longitude, loc.name, loc.regionLabel, {
        province: loc.province,
        city: loc.city,
        county: loc.county,
      });
      onUpdate({
        weather: {
          ...weather,
          mode: 'live',
          locationQuery: loc.name,
          latitude: loc.latitude,
          longitude: loc.longitude,
          regionLabel: loc.regionLabel,
          province: loc.province,
          city: loc.city,
          county: loc.county,
          liveSnapshot: snap,
        },
      });
    } catch (err) {
      setWeatherError(
        err instanceof Error
          ? err.message
          : isZh
            ? '获取实时天气失败，请检查网络连接'
            : 'Failed to fetch live weather. Please check your network connection.',
      );
    } finally {
      setWeatherBusy(false);
    }
  };

  const handleSearchWeatherCity = async () => {
    const q = locationInput.trim();
    if (!q) return;
    setWeatherError(null);
    setWeatherBusy(true);
    try {
      const found = await searchWeatherLocations(q);
      if (found.length === 0) {
        setLocationCandidates([]);
        setWeatherError(
          isZh
            ? `未找到「${q}」对应的国内城市，请尝试输入城市中文名`
            : `No matching city found for "${q}". Try another city name or pinyin.`,
        );
        setWeatherBusy(false);
        return;
      }
      setLocationCandidates(found.slice(0, 5));
      await handleSelectWeatherCity(found[0]);
    } catch (err) {
      setWeatherError(
        err instanceof Error
          ? err.message
          : isZh
            ? '联网查询城市失败，请稍后重试'
            : 'City lookup failed. Please try again later.',
      );
      setWeatherBusy(false);
    }
  };

  const handleRefreshLiveWeather = async () => {
    setWeatherError(null);
    setWeatherBusy(true);
    try {
      const snap = await fetchLiveWeather(
        weather.latitude,
        weather.longitude,
        weather.locationQuery || (isZh ? '北京' : 'Beijing'),
        weather.regionLabel || weather.locationQuery || (isZh ? '北京' : 'Beijing'),
        {
          province: weather.province,
          city: weather.city,
          county: weather.county,
        },
      );
      updateWeather({ liveSnapshot: snap });
    } catch (err) {
      setWeatherError(
        err instanceof Error
          ? err.message
          : isZh
            ? '刷新实时天气失败'
            : 'Failed to refresh live weather.',
      );
    } finally {
      setWeatherBusy(false);
    }
  };

  const toggleCustomWeatherEffect = (id: WeatherEffectId) => {
    const cur = weather.customEffects;
    const exists = cur.includes(id);
    if (exists && cur.length <= 1) return;
    const next = exists ? cur.filter((item) => item !== id) : [...cur, id];
    updateWeather({ mode: 'custom', customEffects: next });
  };

  const typo = settings.typography ?? DEFAULT_TYPOGRAPHY;
  const updateTypo = (patch: Partial<typeof typo>) => {
    onUpdate({ typography: { ...typo, ...patch } });
  };

  const monet = settings.monet ?? DEFAULT_MONET;
  const updateMonet = (patch: Partial<typeof monet>) => {
    onUpdate({ monet: { ...monet, ...patch } });
  };

  const celestial = settings.celestial ?? DEFAULT_CELESTIAL;
  const updateCelestial = (patch: Partial<typeof celestial>) => {
    onUpdate({ celestial: { ...celestial, ...patch } });
  };

  const liveMonetTokens = useMemo(() => generateMonetTokens(monet), [monet]);

  const stylePreviews = useMemo(
    () =>
      Object.fromEntries(
        MONET_STYLE_META.map((m) => [
          m.id,
          generateMonetTokens({ ...monet, style: m.id }),
        ]),
      ),
    [monet],
  );

  const [customVaultInput, setCustomVaultInput] = useState(runtimeInfo.vaultDir);
  const [vaultSwitching, setVaultSwitching] = useState(false);

  useEffect(() => {
    setCustomVaultInput(runtimeInfo.vaultDir);
  }, [runtimeInfo.vaultDir]);

  const applyCustomVaultPath = async (rawPath: string) => {
    const trimmed = rawPath.trim();
    if (!trimmed || !onSetCustomVaultDir) return;
    setVaultSwitching(true);
    try {
      await onSetCustomVaultDir(trimmed);
      onHaptic?.('success');
    } finally {
      setVaultSwitching(false);
    }
  };

  const isZh = settings.locale === 'zh-CN';
  const navItems: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = isZh
    ? [
        { id: 'appearance', label: '外观与主题', icon: <Palette size={15} /> },
        { id: 'typography', label: '字体与排版', icon: <Type size={15} /> },
        { id: 'archive', label: '归档与常规', icon: <FolderCog size={15} /> },
        { id: 'device', label: '多端与触控', icon: <Smartphone size={15} /> },
        { id: 'ai', label: 'AI 引擎与 Skills', icon: <Cpu size={15} /> },
        { id: 'about', label: '关于穹档', icon: <Info size={15} /> },
      ]
    : [
        { id: 'appearance', label: 'Appearance & Themes', icon: <Palette size={15} /> },
        { id: 'typography', label: 'Typography & Layout', icon: <Type size={15} /> },
        { id: 'archive', label: 'Archive & General', icon: <FolderCog size={15} /> },
        { id: 'device', label: 'Multi-Device & Touch', icon: <Smartphone size={15} /> },
        { id: 'ai', label: 'AI Engine & Skills', icon: <Cpu size={15} /> },
        { id: 'about', label: 'About ArcVault', icon: <Info size={15} /> },
      ];

  const themeCards: ThemeCardItem[] = [
    {
      id: 'light',
      title: isZh ? '浅色极简' : 'Minimal Light',
      desc: isZh ? '明亮通透，日常办公首选' : 'Crisp and bright for everyday work',
      bg: '#f6f7fb',
      sidebar: '#ffffff',
      accent: '#3b5bdb',
    },
    {
      id: 'dark',
      title: isZh ? '深邃夜色' : 'Deep Night',
      desc: isZh ? '低眩光暗调，深夜爆肝护眼' : 'Low-glare dark mode for late-night focus',
      bg: '#0d1117',
      sidebar: '#141a23',
      accent: '#60a5fa',
    },
    {
      id: 'paper',
      title: isZh ? '护眼纸感' : 'Warm Paper',
      desc: isZh ? '暖米纸墨质感，长文精读舒适' : 'Warm parchment tone for long reading sessions',
      bg: '#f3ede0',
      sidebar: '#faf6ec',
      accent: '#8c5a2b',
    },
    {
      id: 'm3-expressive',
      title: 'Material 3 Expressive',
      desc: isZh ? '柔紫灵动色阶与莫奈动态取色' : 'Expressive tonal palette with Monet dynamic color',
      bg: '#f4effa',
      sidebar: '#fdfbff',
      accent: '#6750a4',
    },
    {
      id: 'celestial-optics',
      title: isZh ? '天象光影 · Celestial Optics' : 'Celestial Optics',
      desc: isZh ? 'WebGL2 维纳斯带/幻日/钻石尘实时渲染' : 'Real-time WebGL2 Belt of Venus, parhelia & diamond dust',
      bg: '#080e24',
      sidebar: '#131d42',
      accent: '#7dd3fc',
    },
    {
      id: 'weather-live',
      title: isZh ? '实时天气 · Atmos Live' : 'Atmos Live Weather',
      desc: isZh ? '联网实况/雷暴玻璃雨滴/双霓虹/极光自由组合' : 'Live weather, glass rain, double rainbow & aurora layers',
      bg: '#0a1930',
      sidebar: '#102846',
      accent: '#38bdf8',
    },
  ];

  const commentPresets = ['#2563eb', '#0284c7', '#0d9488', '#7c3aed'];
  const revisionPresets = ['#dc2626', '#ea580c', '#db2777', '#b91c1c'];

  return (
    <div className="arc-modal-backdrop" onClick={onClose}>
      <div className="arc-settings-modal" data-tour="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="arc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ArcVaultLogo size={24} theme={settings.theme} />
            <strong>{isZh ? 'ArcVault · 穹档设置中心' : 'ArcVault Settings'}</strong>
          </div>
          <button className="arc-btn arc-icon-btn" onClick={onClose} title={isZh ? '关闭 (Esc)' : 'Close (Esc)'}>
            <X size={14} />
          </button>
        </div>

        <div className="arc-settings-layout">
          {/* Left Category Navigation */}
          <nav className="arc-settings-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`arc-settings-nav-btn ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Right Settings Detail Panel */}
          <div className="arc-settings-content">
            <div key={activeTab} className="arc-doc-transition">
              {activeTab === 'appearance' && (
                <>
                  <div className="arc-settings-card">
                    <div className="arc-settings-card-title">
                      <span>{isZh ? '预设界面主题' : 'Interface Themes'}</span>
                      <span className="arc-badge">{isZh ? '6 套主题方案（含动态渲染引擎）' : '6 Themes (incl. Dynamic Shaders)'}</span>
                    </div>
                    <div className="arc-theme-grid" data-tour="settings-themes-grid">
                      {themeCards.map((t) => {
                        const active = settings.theme === t.id;
                        return (
                          <button
                            key={t.id}
                            className={`arc-theme-card ${active ? 'active' : ''}`}
                            onClick={() => onUpdate({ theme: t.id })}
                          >
                            <ThemePreviewSwatch theme={t} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>{t.title}</span>
                                {active && <Check size={14} color="var(--accent)" />}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                {t.desc}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Celestial Optics WebGL2 Shader Console */}
                    {settings.theme === 'celestial-optics' && (
                      <div
                        style={{
                          marginTop: 14,
                          padding: 12,
                          borderRadius: 14,
                          border: '1px solid var(--border-subtle)',
                          background:
                            'linear-gradient(125deg, rgba(59,91,219,0.10), rgba(168,85,247,0.10), rgba(14,165,233,0.10))',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Sparkles size={14} color="var(--accent)" />
                              <span>{isZh ? '「天象光影 · Celestial Optics」光影渲染控制台' : 'Celestial Optics Render Console'}</span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 11.5, marginTop: 2 }}>
                              {isZh
                                ? '维纳斯带 · 曙暮光条 · 钻石尘流场粒子 · 22° 幻日环天顶弧 · 交互星座连线'
                                : 'Belt of Venus · Crepuscular Rays · Diamond Dust · 22° Parhelia · Interactive Constellations'}
                            </div>
                          </div>
                          <span
                            className="arc-badge"
                            title={renderStatus?.reason ?? (isZh ? '自动检测显卡硬件加速状态' : 'Auto-detects GPU hardware acceleration')}
                          >
                            {renderStatus?.active === 'cpu'
                              ? isZh
                                ? 'CPU 渲染中'
                                : 'CPU Rendering'
                              : isZh
                                ? 'GPU 渲染中'
                                : 'GPU Rendering'}
                            {(celestial.renderMode ?? 'auto') === 'auto' ? (isZh ? ' · 自动' : ' · Auto') : ''}
                          </span>
                        </div>

                      <div className="arc-settings-grid-2" style={{ gap: 10 }}>
                        <div>
                          <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
                            {isZh ? '天象时刻预设' : 'Solar Mood Preset'}
                          </div>
                          <ArcSelect
                            ariaLabel={isZh ? '天象时刻预设' : 'Solar Mood Preset'}
                            value={celestial.mood}
                            onChange={(v) => updateCelestial({ mood: v as CelestialMood })}
                            options={
                              isZh
                                ? [
                                    { value: 'venus-dusk', label: '黄昏维纳斯带（粉紫暮光）' },
                                    { value: 'parhelion-night', label: '寒夜幻日星穹（深邃冰晕）' },
                                    { value: 'dawn-rays', label: '破晓曙暮光条（晨曦丁达尔）' },
                                    { value: 'auto-solar', label: '随当地时间自动演变' },
                                  ]
                                : [
                                    { value: 'venus-dusk', label: 'Venus Dusk (Rose-Violet Twilight)' },
                                    { value: 'parhelion-night', label: 'Parhelion Night (Ice Halo Sky)' },
                                    { value: 'dawn-rays', label: 'Dawn Rays (Morning Tyndall)' },
                                    { value: 'auto-solar', label: 'Auto Solar Time' },
                                  ]
                            }
                          />
                        </div>

                        <div>
                          <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
                            {isZh ? '渲染引擎（GPU / CPU）' : 'Render Backend (GPU / CPU)'}
                          </div>
                          <div className="arc-segmented">
                            {(
                              [
                                { id: 'auto', label: isZh ? '自动' : 'Auto' },
                                { id: 'gpu', label: 'GPU' },
                                { id: 'cpu', label: 'CPU' },
                              ] as Array<{ id: RenderBackendMode; label: string }>
                            ).map((m) => (
                              <button
                                key={m.id}
                                className={(celestial.renderMode ?? 'auto') === m.id ? 'active' : ''}
                                onClick={() => updateCelestial({ renderMode: m.id })}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
                            {isZh ? '渲染精度档位' : 'Render Quality'}
                          </div>
                          <div className="arc-segmented">
                            {(
                              [
                                { id: 'ultra', label: isZh ? '极致' : 'Ultra' },
                                { id: 'balanced', label: isZh ? '均衡' : 'Balanced' },
                                { id: 'eco', label: isZh ? '省电' : 'Eco' },
                              ] as Array<{ id: RenderQualityTier; label: string }>
                            ).map((q) => (
                              <button
                                key={q.id}
                                className={celestial.quality === q.id ? 'active' : ''}
                                onClick={() => updateCelestial({ quality: q.id })}
                              >
                                {q.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {isZh ? '钻石尘粒子密度' : 'Diamond Dust Density'}
                            </span>
                            <span className="arc-badge">{Math.round(celestial.particleDensity * 100)}%</span>
                          </div>
                          <ArcSlider
                            ariaLabel={isZh ? '钻石尘粒子密度' : 'Diamond Dust Density'}
                            min={0.2}
                            max={1.5}
                            step={0.1}
                            value={celestial.particleDensity}
                            formatValue={(v) => `${Math.round(v * 100)}%`}
                            onChange={(v) => updateCelestial({ particleDensity: v })}
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {isZh ? '毛玻璃效果' : 'Frosted Glass Opacity'}
                            </span>
                            <span className="arc-badge">{Math.round(celestial.glassOpacity * 100)}%</span>
                          </div>
                          <ArcSlider
                            ariaLabel={isZh ? '毛玻璃效果' : 'Frosted Glass Opacity'}
                            min={0}
                            max={1}
                            step={0.01}
                            value={celestial.glassOpacity}
                            formatValue={(v) => `${Math.round(v * 100)}%`}
                            onChange={(v) => updateCelestial({ glassOpacity: v })}
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {isZh ? '黑色遮罩不透明度' : 'Dark Scrim Opacity'}
                            </span>
                            <span className="arc-badge">{Math.round((celestial.darkMaskOpacity ?? 0) * 100)}%</span>
                          </div>
                          <ArcSlider
                            ariaLabel={isZh ? '黑色遮罩不透明度' : 'Dark Scrim Opacity'}
                            min={0}
                            max={1}
                            step={0.01}
                            value={celestial.darkMaskOpacity ?? 0}
                            formatValue={(v) => `${Math.round(v * 100)}%`}
                            onChange={(v) => updateCelestial({ darkMaskOpacity: v })}
                          />
                        </div>
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={celestial.enableConstellations}
                          onChange={(e) => updateCelestial({ enableConstellations: e.target.checked })}
                        />
                        <span>{isZh ? '开启指针交互式星空星座连线' : 'Enable Pointer-Interactive Star Constellations'}</span>
                      </label>
                    </div>
                    )}

                    {/* Real-Time Weather Atmos Live Console */}
                    {settings.theme === 'weather-live' && (
                      <div
                        style={{
                          marginTop: 14,
                          padding: 13,
                          borderRadius: 14,
                          border: '1px solid var(--border-subtle)',
                          background:
                            'linear-gradient(125deg, rgba(14,165,233,0.12), rgba(99,102,241,0.10), rgba(244,114,182,0.08))',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <CloudSun size={15} color="var(--accent)" />
                              <span>{isZh ? '「实时天气 · Atmos Live」全屏气象引擎' : 'Atmos Live Weather Engine'}</span>
                              <span
                                className="arc-badge"
                                title={renderStatus?.reason ?? (isZh ? '自动检测显卡硬件加速状态' : 'Auto-detects GPU hardware acceleration')}
                              >
                                {renderStatus?.active === 'cpu'
                                  ? isZh
                                    ? 'CPU 渲染中'
                                    : 'CPU Rendering'
                                  : isZh
                                    ? 'GPU 渲染中'
                                    : 'GPU Rendering'}
                                {(weather.renderMode ?? 'auto') === 'auto' ? (isZh ? ' · 自动' : ' · Auto') : ''}
                              </span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 11.5, marginTop: 2 }}>
                              {isZh
                                ? '联网获取当地实况 · 自由叠加多层天气特效 · 定时随机氛围轮换'
                                : 'Live local conditions · Stackable weather layers · Timed ambient rotation'}
                            </div>
                          </div>
                          <div className="arc-segmented">
                            {(
                              [
                                { id: 'live', label: isZh ? '联网实时天气' : 'Live Weather' },
                                { id: 'custom', label: isZh ? '自选 / 组合' : 'Custom Mix' },
                                { id: 'random', label: isZh ? '定时随机' : 'Timed Random' },
                              ] as Array<{ id: WeatherControlMode; label: string }>
                            ).map((m) => (
                              <button
                                key={m.id}
                                className={weather.mode === m.id ? 'active' : ''}
                                onClick={() => updateWeather({ mode: m.id })}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Live City Weather Search Panel */}
                        {weather.mode === 'live' && (
                          <div
                            style={{
                              padding: 11,
                              borderRadius: 12,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 9,
                            }}
                          >
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0 }}>
                                <input
                                  className="arc-input"
                                  value={locationInput}
                                  onChange={(e) => setLocationInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleSearchWeatherCity();
                                  }}
                                  placeholder={isZh ? '输入国内城市名称，如：北京、上海、杭州、成都、西安...' : 'Enter city name or pinyin, e.g. Beijing, Shanghai, Hangzhou...'}
                                  style={{ paddingLeft: 30 }}
                                />
                                <MapPin
                                  size={14}
                                  style={{
                                    position: 'absolute',
                                    left: 10,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    pointerEvents: 'none',
                                  }}
                                />
                              </div>
                              <button
                                className="arc-btn arc-btn-primary"
                                style={{ height: 34 }}
                                disabled={weatherBusy}
                                onClick={() => void handleSearchWeatherCity()}
                              >
                                <RefreshCw size={13} className={weatherBusy ? 'arc-spin' : ''} />
                                <span>{weatherBusy ? (isZh ? '获取中...' : 'Fetching...') : isZh ? '联网搜索天气' : 'Search Weather'}</span>
                              </button>
                            </div>

                            {/* Quick City Chips */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isZh ? '常用城市：' : 'Quick cities:'}</span>
                              {QUICK_CITIES.map((c) => {
                                const active = weather.locationQuery === c.name;
                                return (
                                  <button
                                    key={c.name}
                                    className={`arc-btn ${active ? 'arc-btn-primary' : ''}`}
                                    style={{ height: 24, padding: '0 9px', fontSize: 11 }}
                                    onClick={() => void handleSelectWeatherCity(c)}
                                  >
                                    {c.name}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Search Candidates if multiple results returned */}
                            {locationCandidates.length > 1 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isZh ? '匹配地区：' : 'Matches:'}</span>
                                {locationCandidates.map((cand, i) => (
                                  <button
                                    key={`${cand.latitude}-${cand.longitude}-${i}`}
                                    className="arc-btn"
                                    style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                                    onClick={() => void handleSelectWeatherCity(cand)}
                                  >
                                    {cand.regionLabel}
                                  </button>
                                ))}
                              </div>
                            )}

                            {weatherError && (
                              <div
                                style={{
                                  padding: '7px 10px',
                                  borderRadius: 8,
                                  background: 'rgba(239, 68, 68, 0.14)',
                                  color: '#fca5a5',
                                  fontSize: 11.5,
                                }}
                              >
                                {weatherError}
                              </div>
                            )}

                            {/* Live Snapshot Card */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                padding: '8px 10px',
                                borderRadius: 10,
                                background: 'var(--accent-soft)',
                                border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
                                flexWrap: 'wrap',
                              }}
                            >
                              {weather.liveSnapshot ? (
                                <>
                                  <div style={{ fontSize: 12 }}>
                                    <div style={{ fontWeight: 600 }}>
                                      {weather.liveSnapshot.regionLabel} · {weather.liveSnapshot.descriptionZh} ({weather.liveSnapshot.temperatureC}°C)
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>
                                      {isZh
                                        ? `体感 ${weather.liveSnapshot.apparentTempC}°C · 湿度 ${weather.liveSnapshot.humidity}% · 风速 ${weather.liveSnapshot.windSpeedKmh} km/h · 数据源：${weather.liveSnapshot.sourceName ?? '腾讯天气'} · 更新于 ${new Date(weather.liveSnapshot.fetchedAt).toLocaleTimeString('zh-CN')}`
                                        : `Feels ${weather.liveSnapshot.apparentTempC}°C · Humidity ${weather.liveSnapshot.humidity}% · Wind ${weather.liveSnapshot.windSpeedKmh} km/h · Source: ${weather.liveSnapshot.sourceName ?? 'Tencent Weather'} · Updated ${new Date(weather.liveSnapshot.fetchedAt).toLocaleTimeString('en-US')}`}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    {weather.liveSnapshot.mappedEffects.map((ef) => {
                                      const meta = WEATHER_EFFECT_META.find((m) => m.id === ef);
                                      return (
                                        <span key={ef} className="arc-badge">
                                          {isZh ? (meta?.labelZh ?? ef) : (meta?.labelEn ?? ef)}
                                        </span>
                                      );
                                    })}
                                    <button
                                      className="arc-btn"
                                      style={{ height: 25, fontSize: 11 }}
                                      disabled={weatherBusy}
                                      onClick={() => void handleRefreshLiveWeather()}
                                    >
                                      <RefreshCw size={11} />
                                      <span>{isZh ? '刷新' : 'Refresh'}</span>
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                  {isZh
                                    ? `当前预设坐标：${weather.regionLabel}（点击上方「联网搜索天气」获取最新实况）`
                                    : `Current preset location: ${weather.regionLabel} (click "Search Weather" above for live conditions)`}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Custom Single / Multi-Weather Combo Panel */}
                        {weather.mode === 'custom' && (
                          <div
                            style={{
                              padding: 11,
                              borderRadius: 12,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                                {isZh ? '精选气象奇观组合（一键套用）：' : 'Curated Weather Combos (1-Click Apply):'}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {WEATHER_PRESET_COMBOS.map((combo) => (
                                  <button
                                    key={combo.id}
                                    className="arc-btn"
                                    style={{ height: 26, fontSize: 11.5 }}
                                    onClick={() =>
                                      updateWeather({
                                        mode: 'custom',
                                        customEffects: [...combo.effects],
                                        timeOfDay: combo.timeOfDay,
                                      })
                                    }
                                  >
                                    {isZh ? combo.labelZh : combo.labelEn}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                                {isZh
                                  ? '自由多选叠加气象图层（可任意单选或多选共存，至少保留 1 项）：'
                                  : 'Mix & Stack Weather Layers (select one or more, keep at least 1):'}
                              </div>
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                                  gap: 7,
                                }}
                              >
                                {WEATHER_EFFECT_META.map((ef) => {
                                  const active = weather.customEffects.includes(ef.id);
                                  return (
                                    <button
                                      key={ef.id}
                                      type="button"
                                      onClick={() => toggleCustomWeatherEffect(ef.id)}
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start',
                                        gap: 2,
                                        padding: '7px 9px',
                                        borderRadius: 10,
                                        border: active
                                          ? `1px solid ${ef.accentHex}`
                                          : '1px solid var(--border-subtle)',
                                        background: active
                                          ? 'var(--accent-soft)'
                                          : 'var(--bg-elevated)',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', fontSize: 12, fontWeight: 600 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                          <span
                                            style={{
                                              width: 8,
                                              height: 8,
                                              borderRadius: 999,
                                              background: ef.accentHex,
                                              boxShadow: active ? `0 0 8px ${ef.accentHex}` : 'none',
                                            }}
                                          />
                                          {isZh ? ef.labelZh : ef.labelEn}
                                        </span>
                                        {active && <Check size={12} color={ef.accentHex} />}
                                      </div>
                                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.35 }}>
                                        {isZh ? ef.descZh : ef.descEn}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Timed Random Weather Switching Panel */}
                        {weather.mode === 'random' && (
                          <div
                            style={{
                              padding: 11,
                              borderRadius: 12,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              display: 'grid',
                              gridTemplateColumns: 'minmax(0, 1fr) auto',
                              alignItems: 'end',
                              gap: 10,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                                {isZh ? '随机切换间隔 · 当前气象：' : 'Switch Interval · Current: '}
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {randomWeatherLabel ?? (isZh ? '自动轮换' : 'Auto Rotate')}
                                </strong>
                              </div>
                              <ArcSelect
                                ariaLabel={isZh ? '随机天气切换周期' : 'Random Weather Switch Interval'}
                                value={String(weather.randomIntervalSeconds)}
                                onChange={(v) => updateWeather({ randomIntervalSeconds: Number(v) })}
                                options={WEATHER_RANDOM_INTERVALS.map((iv) => ({
                                  value: String(iv.seconds),
                                  label: isZh ? iv.label : iv.labelEn,
                                }))}
                              />
                            </div>
                            <button
                              className="arc-btn arc-btn-primary"
                              style={{ height: 34 }}
                              onClick={() => onTriggerRandomWeather?.()}
                            >
                              <Shuffle size={13} />
                              <span>{isZh ? '立即随机切换' : 'Shuffle Now'}</span>
                            </button>
                          </div>
                        )}

                        {/* Shared Weather Atmosphere & Render Controls */}
                        <div className="arc-settings-grid-2" style={{ gap: 10 }}>
                          <div>
                            <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
                              {isZh ? '渲染引擎（GPU / CPU）' : 'Render Backend (GPU / CPU)'}
                            </div>
                            <div className="arc-segmented">
                              {(
                                [
                                  { id: 'auto', label: isZh ? '自动' : 'Auto' },
                                  { id: 'gpu', label: 'GPU' },
                                  { id: 'cpu', label: 'CPU' },
                                ] as Array<{ id: RenderBackendMode; label: string }>
                              ).map((m) => (
                                <button
                                  key={m.id}
                                  className={(weather.renderMode ?? 'auto') === m.id ? 'active' : ''}
                                  onClick={() => updateWeather({ renderMode: m.id })}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
                              {isZh ? '渲染精度档位' : 'Render Quality'}
                            </div>
                            <div className="arc-segmented">
                              {(
                                [
                                  { id: 'ultra', label: isZh ? '极致' : 'Ultra' },
                                  { id: 'balanced', label: isZh ? '均衡' : 'Balanced' },
                                  { id: 'eco', label: isZh ? '省电' : 'Eco' },
                                ] as Array<{ id: RenderQualityTier; label: string }>
                              ).map((q) => (
                                <button
                                  key={q.id}
                                  className={(weather.quality ?? 'balanced') === q.id ? 'active' : ''}
                                  onClick={() => updateWeather({ quality: q.id })}
                                >
                                  {q.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
                              {isZh ? '天色时刻氛围' : 'Sky Time of Day'}
                            </div>
                            <ArcSelect
                              ariaLabel={isZh ? '天色时刻氛围' : 'Sky Time of Day'}
                              value={weather.timeOfDay}
                              onChange={(v) => updateWeather({ timeOfDay: v as WeatherTimeOfDay })}
                              options={
                                isZh
                                  ? [
                                      { value: 'auto', label: '自动跟随实况 / 组合' },
                                      { value: 'day', label: '明媚白昼' },
                                      { value: 'dusk', label: '暮色黄昏' },
                                      { value: 'night', label: '深邃星夜' },
                                    ]
                                  : [
                                      { value: 'auto', label: 'Auto (Follow Live / Combo)' },
                                      { value: 'day', label: 'Bright Day' },
                                      { value: 'dusk', label: 'Golden Dusk' },
                                      { value: 'night', label: 'Starry Night' },
                                    ]
                              }
                            />
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {isZh ? '气象粒子与光效强度' : 'Weather Effect Intensity'}
                              </span>
                              <span className="arc-badge">{Math.round(weather.effectIntensity * 100)}%</span>
                            </div>
                            <ArcSlider
                              ariaLabel={isZh ? '气象粒子与光效强度' : 'Weather Effect Intensity'}
                              min={0.4}
                              max={1.5}
                              step={0.1}
                              value={weather.effectIntensity}
                              formatValue={(v) => `${Math.round(v * 100)}%`}
                              onChange={(v) => updateWeather({ effectIntensity: v })}
                            />
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {isZh ? '雨丝透明度' : 'Rain Streak Opacity'}
                              </span>
                              <span className="arc-badge">{Math.round((weather.rainStreakOpacity ?? 0.55) * 100)}%</span>
                            </div>
                            <ArcSlider
                              ariaLabel={isZh ? '雨丝透明度' : 'Rain Streak Opacity'}
                              min={0}
                              max={1}
                              step={0.01}
                              value={weather.rainStreakOpacity ?? 0.55}
                              formatValue={(v) => `${Math.round(v * 100)}%`}
                              onChange={(v) => updateWeather({ rainStreakOpacity: v })}
                            />
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {isZh ? '毛玻璃效果' : 'Frosted Glass Opacity'}
                              </span>
                              <span className="arc-badge">{Math.round(weather.glassOpacity * 100)}%</span>
                            </div>
                            <ArcSlider
                              ariaLabel={isZh ? '天气主题毛玻璃效果' : 'Weather Frosted Glass Opacity'}
                              min={0}
                              max={1}
                              step={0.01}
                              value={weather.glassOpacity}
                              formatValue={(v) => `${Math.round(v * 100)}%`}
                              onChange={(v) => updateWeather({ glassOpacity: v })}
                            />
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {isZh ? '黑色遮罩不透明度' : 'Dark Scrim Opacity'}
                              </span>
                              <span className="arc-badge">{Math.round(weather.darkMaskOpacity * 100)}%</span>
                            </div>
                            <ArcSlider
                              ariaLabel={isZh ? '天气主题黑色遮罩不透明度' : 'Weather Dark Scrim Opacity'}
                              min={0}
                              max={1}
                              step={0.01}
                              value={weather.darkMaskOpacity}
                              formatValue={(v) => `${Math.round(v * 100)}%`}
                              onChange={(v) => updateWeather({ darkMaskOpacity: v })}
                            />
                          </div>
                        </div>

                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            fontSize: 12,
                            cursor: 'pointer',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={weatherAdaptColorByTime}
                              onChange={(e) => updateWeather({ adaptColorByTime: e.target.checked })}
                            />
                            <span>{isZh ? '跟随时间自动调整主题颜色' : 'Adapt UI Colors to Time of Day'}</span>
                          </span>
                          <span
                            className="arc-badge"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                background: weatherAdaptColorByTime ? weatherPalette.accent : '#38bdf8',
                                boxShadow: `0 0 8px ${weatherAdaptColorByTime ? weatherPalette.accent : '#38bdf8'}`,
                              }}
                            />
                            <span>
                              {weatherAdaptColorByTime
                                ? isZh
                                  ? weatherPalette.labelZh
                                  : weatherPalette.labelEn
                                : isZh
                                  ? '固定深空蓝'
                                  : 'Fixed Deep Blue'}
                            </span>
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Android Monet Dynamic Color Studio for M3 Expressive */}
                  {settings.theme === 'm3-expressive' && (
                    <div className="arc-settings-card">
                      <div className="arc-settings-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Wand2 size={15} color="var(--accent)" />
                          <span>{isZh ? 'Android 莫奈动态取色（Monet HCT Engine）' : 'Android Monet Dynamic Color (HCT Engine)'}</span>
                        </span>
                        <button
                          className="arc-btn"
                          style={{ height: 26, fontSize: 11.5 }}
                          onClick={() => onUpdate({ monet: { ...DEFAULT_MONET } })}
                        >
                          <RotateCcw size={12} />
                          <span>{isZh ? '重置莫奈取色' : 'Reset Monet'}</span>
                        </button>
                      </div>

                    {/* Seed Color & Wallpaper Extraction */}
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{isZh ? '主题种子色：' : 'Seed Color:'}</span>
                          {MONET_CURATED_SEEDS.map((s) => (
                            <button
                              key={s.hex}
                              className="arc-color-dot"
                              style={{
                                background: s.hex,
                                outline:
                                  s.hex.toLowerCase() === monet.seedColor.toLowerCase()
                                    ? '2px solid var(--accent)'
                                    : 'none',
                                outlineOffset: 2,
                              }}
                              onClick={() => updateMonet({ seedColor: s.hex })}
                              title={`${isZh ? s.label : s.labelEn} (${s.hex})`}
                            />
                          ))}
                          <ArcColorPicker
                            ariaLabel={isZh ? '莫奈自定义种子色' : 'Monet Custom Seed Color'}
                            value={monet.seedColor}
                            presets={MONET_CURATED_SEEDS.slice(0, 4).map((x) => x.hex)}
                            onChange={(hex) => updateMonet({ seedColor: hex })}
                          />
                        </div>

                        <div>
                          <input
                            ref={wallpaperInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const res = await extractSeedsFromImageFile(file);
                              updateMonet({
                                extractedSeeds: res.seeds,
                                seedColor: res.seeds[0] ?? monet.seedColor,
                                wallpaperThumbDataUrl: res.thumbDataUrl,
                              });
                              e.target.value = '';
                            }}
                          />
                          <button
                            className="arc-btn"
                            style={{ height: 30, fontSize: 12 }}
                            onClick={() => wallpaperInputRef.current?.click()}
                          >
                            <ImagePlus size={14} />
                            <span>{isZh ? '从图片 / 壁纸取色' : 'Extract from Image'}</span>
                          </button>
                        </div>
                      </div>

                      {monet.extractedSeeds && monet.extractedSeeds.length > 0 && (
                        <div
                          style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                          }}
                        >
                          {monet.wallpaperThumbDataUrl && (
                            <img
                              src={monet.wallpaperThumbDataUrl}
                              alt={isZh ? '壁纸取色' : 'Wallpaper palette'}
                              style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover' }}
                            />
                          )}
                          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            {isZh ? 'QuantizerCelebi + Score 提取推荐色：' : 'Extracted Seeds (QuantizerCelebi + Score):'}
                          </span>
                          <div style={{ display: 'flex', gap: 7 }}>
                            {monet.extractedSeeds.map((hex) => (
                              <button
                                key={hex}
                                className="arc-color-dot"
                                style={{
                                  width: 24,
                                  height: 24,
                                  background: hex,
                                  outline:
                                    hex.toLowerCase() === monet.seedColor.toLowerCase()
                                      ? '2px solid var(--accent)'
                                      : 'none',
                                  outlineOffset: 2,
                                }}
                                onClick={() => updateMonet({ seedColor: hex })}
                                title={isZh ? `采用提取色 ${hex}` : `Use extracted color ${hex}`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Polarity (Monet Light / Dark) + Contrast Level */}
                    <div className="arc-settings-grid-2" style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, minWidth: 0, padding: '8px 12px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{isZh ? '莫奈明暗模式' : 'Monet Polarity'}</span>
                        <div className="arc-segmented">
                          <button
                            className={!monet.isDark ? 'active' : ''}
                            onClick={() => updateMonet({ isDark: false })}
                          >
                            <Sun size={12} style={{ marginRight: 4 }} />
                            {isZh ? '浅色' : 'Light'}
                          </button>
                          <button
                            className={monet.isDark ? 'active' : ''}
                            onClick={() => updateMonet({ isDark: true })}
                          >
                            <Moon size={12} style={{ marginRight: 4 }} />
                            {isZh ? '深色' : 'Dark'}
                          </button>
                        </div>
                      </div>

                      <div style={{ padding: '8px 12px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>{isZh ? 'HCT 对比度级别' : 'HCT Contrast Level'}</span>
                          <span className="arc-badge">{monet.contrastLevel.toFixed(1)}</span>
                        </div>
                        <ArcSlider
                          ariaLabel={isZh ? '莫奈对比度' : 'Monet Contrast'}
                          min={-0.5}
                          max={1.0}
                          step={0.5}
                          value={monet.contrastLevel}
                          formatValue={(v) =>
                            isZh
                              ? v === 0
                                ? '标准'
                                : v === 0.5
                                  ? '中等'
                                  : v === 1
                                    ? '高对比'
                                    : '柔和'
                              : v === 0
                                ? 'Standard'
                                : v === 0.5
                                  ? 'Medium'
                                  : v === 1
                                    ? 'High'
                                    : 'Soft'
                          }
                          onChange={(v) => updateMonet({ contrastLevel: v })}
                        />
                      </div>
                    </div>

                    {/* 10 Monet Style Presets */}
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                      {isZh ? '取色风格（共 10 种 Android 原生 + 扩展算法）' : 'Palette Style (10 Android Native & Extended Variants)'}
                    </div>
                    <div className="arc-monet-style-grid">
                      {MONET_STYLE_META.map((st) => {
                        const active = monet.style === st.id;
                        const prevTok = stylePreviews[st.id];
                        return (
                          <button
                            key={st.id}
                            className={`arc-monet-style-card ${active ? 'active' : ''}`}
                            onClick={() => updateMonet({ style: st.id })}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                                {isZh ? st.nameZh : st.nameEn}{' '}
                                {isZh && (
                                  <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.72 }}>
                                    {st.nameEn}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {isZh ? st.desc : st.descEn}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                              <span style={{ width: 12, height: 12, borderRadius: 999, background: prevTok.primary }} />
                              <span style={{ width: 12, height: 12, borderRadius: 999, background: prevTok.secondary }} />
                              <span style={{ width: 12, height: 12, borderRadius: 999, background: prevTok.tertiary }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Live M3 HCT Palette Swatches */}
                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
                      {[
                        { label: 'Primary', bg: liveMonetTokens.primary, fg: liveMonetTokens.onPrimary },
                        { label: 'Pri-Cont', bg: liveMonetTokens.primaryContainer, fg: liveMonetTokens.onPrimaryContainer },
                        { label: 'Sec-Cont', bg: liveMonetTokens.secondaryContainer, fg: liveMonetTokens.onSecondaryContainer },
                        { label: 'Ter-Cont', bg: liveMonetTokens.tertiaryContainer, fg: liveMonetTokens.onTertiaryContainer },
                        { label: 'Surf-High', bg: liveMonetTokens.surfaceContainerHigh, fg: liveMonetTokens.onSurface },
                      ].map((sw) => (
                        <div
                          key={sw.label}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 10,
                            background: sw.bg,
                            color: sw.fg,
                            fontSize: 10.5,
                            fontWeight: 600,
                            textAlign: 'center',
                            border: '1px solid rgba(128,128,128,0.16)',
                          }}
                        >
                          <div>{sw.label}</div>
                          <div style={{ opacity: 0.85, fontFamily: 'var(--arc-font-mono)', fontSize: 10 }}>{sw.bg}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  <div className="arc-settings-card">
                    <div className="arc-settings-card-title">
                      <span>{isZh ? '批注与修订高亮色板' : 'Annotation & Revision Highlight Colors'}</span>
                      <button
                        className="arc-btn"
                        style={{ height: 26, fontSize: 11.5 }}
                        onClick={() => onUpdate({ commentColor: '#2563eb', revisionColor: '#dc2626' })}
                      >
                        <RotateCcw size={12} />
                        <span>{isZh ? '恢复默认蓝 / 红' : 'Reset Blue / Red'}</span>
                      </button>
                    </div>

                    <div className="arc-settings-grid-2" style={{ gap: 14 }}>
                      <div style={{ padding: 10, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{isZh ? '导师批注颜色' : 'Reviewer Comment Color'}</span>
                          <span className="cm-arc-comment" style={{ fontSize: 11.5, padding: '1px 6px' }}>{isZh ? '批注预览' : 'Comment'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {commentPresets.map((c) => (
                            <button
                              key={c}
                              className="arc-color-dot"
                              style={{ background: c }}
                              onClick={() => onUpdate({ commentColor: c })}
                              title={c}
                            />
                          ))}
                          <ArcColorPicker
                            ariaLabel={isZh ? '自定义批注颜色' : 'Custom Comment Color'}
                            value={settings.commentColor}
                            presets={commentPresets}
                            onChange={(c) => onUpdate({ commentColor: c })}
                          />
                        </div>
                      </div>

                      <div style={{ padding: 10, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{isZh ? '文档修订颜色' : 'Track-Change Color'}</span>
                          <span className="cm-arc-revision" style={{ fontSize: 11.5, padding: '1px 6px' }}>{isZh ? '修订预览' : 'Revision'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {revisionPresets.map((c) => (
                            <button
                              key={c}
                              className="arc-color-dot"
                              style={{ background: c }}
                              onClick={() => onUpdate({ revisionColor: c })}
                              title={c}
                            />
                          ))}
                          <ArcColorPicker
                            ariaLabel={isZh ? '自定义修订颜色' : 'Custom Revision Color'}
                            value={settings.revisionColor}
                            presets={revisionPresets}
                            onChange={(c) => onUpdate({ revisionColor: c })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {!deviceEnv?.isPhone && !deviceEnv?.isTabletPortrait && layoutPresets.length > 0 && (
                    <div className="arc-settings-card">
                      <div className="arc-settings-card-title" style={{ flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <LayoutTemplate size={15} color="var(--accent)" />
                          <span>{isZh ? '工作区布局记忆与预设' : 'Workspace Layout Memory & Presets'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {onClearScrollMemory && (
                            <button
                              type="button"
                              className="arc-btn"
                              style={{ height: 26, fontSize: 11.5 }}
                              onClick={onClearScrollMemory}
                            >
                              {isZh ? '清空页面滚动记忆' : 'Clear Scroll Memory'}
                            </button>
                          )}
                          {onResetDefaultLayout && (
                            <button
                              type="button"
                              className="arc-btn"
                              style={{ height: 26, fontSize: 11.5 }}
                              onClick={onResetDefaultLayout}
                            >
                              <RotateCcw size={12} />
                              <span>{isZh ? '恢复默认布局' : 'Reset Default Layout'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {isZh
                          ? '系统会自动记忆各分栏开合与尺寸、每篇文档的页面滚动位置，以及写作胶囊位置和启用状态。当前状态：'
                          : 'Automatically remembers pane sizes/visibility, per-document scroll positions, and capsule state. Current:'}
                      </div>

                      {currentLayoutSummary.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                          {currentLayoutSummary.map((badge) => (
                            <span key={badge} className="arc-badge">
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}

                      {onSaveLayoutPreset && (
                        <form
                          style={{ display: 'flex', gap: 8, marginBottom: 12 }}
                          onSubmit={(e) => {
                            e.preventDefault();
                            onSaveLayoutPreset(presetNameInput);
                            setPresetNameInput('');
                          }}
                        >
                          <input
                            type="text"
                            className="arc-input"
                            style={{ flex: 1 }}
                            placeholder={isZh ? '为当前分栏与胶囊配置命名（如：深夜纯写论文）...' : 'Name current pane & capsule layout (e.g. Late-Night Writing)...'}
                            value={presetNameInput}
                            onChange={(e) => setPresetNameInput(e.target.value)}
                          />
                          <button type="submit" className="arc-btn arc-btn-primary">
                            <Plus size={13} />
                            <span>{isZh ? '存为布局预设' : 'Save Layout Preset'}</span>
                          </button>
                        </form>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {layoutPresets.map((preset) => {
                          const isActive = activePresetId === preset.id;
                          const badges = summarizeLayoutBadges(preset.layout);
                          return (
                            <div
                              key={preset.id}
                              style={{
                                padding: '9px 11px',
                                borderRadius: 10,
                                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-subtle)'}`,
                                background: isActive ? 'var(--accent-soft)' : 'var(--bg-surface)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                flexWrap: 'wrap',
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <strong style={{ fontSize: 12.5 }}>{preset.name}</strong>
                                  {preset.builtin && <span className="arc-badge">{isZh ? '内置' : 'Built-in'}</span>}
                                  {isActive && (
                                    <span className="arc-badge" style={{ color: 'var(--accent)' }}>
                                      {isZh ? '当前使用中' : 'Active'}
                                    </span>
                                  )}
                                </div>
                                {preset.description && (
                                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {preset.description}
                                  </div>
                                )}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                                  {badges.map((b) => (
                                    <span
                                      key={b}
                                      style={{
                                        fontSize: 10.5,
                                        padding: '1px 6px',
                                        borderRadius: 5,
                                        background: 'var(--bg-subtle)',
                                        color: 'var(--text-secondary)',
                                      }}
                                    >
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                {onApplyLayoutPreset && (
                                  <button
                                    type="button"
                                    className={`arc-btn ${isActive ? 'arc-btn-primary' : ''}`}
                                    style={{ height: 27, fontSize: 11.5 }}
                                    onClick={() => onApplyLayoutPreset(preset)}
                                  >
                                    {isActive ? (isZh ? '已应用' : 'Applied') : isZh ? '应用预设' : 'Apply'}
                                  </button>
                                )}
                                {!preset.builtin && onOverwriteLayoutPreset && (
                                  <button
                                    type="button"
                                    className="arc-btn"
                                    style={{ height: 27, fontSize: 11.5 }}
                                    onClick={() => onOverwriteLayoutPreset(preset.id)}
                                  >
                                    {isZh ? '更新为当前' : 'Overwrite'}
                                  </button>
                                )}
                                {!preset.builtin && onDeleteLayoutPreset && (
                                  <button
                                    type="button"
                                    className="arc-btn"
                                    style={{ height: 27, fontSize: 11.5, color: '#dc2626' }}
                                    onClick={() => onDeleteLayoutPreset(preset.id)}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'typography' && (
                <div className="arc-settings-card">
                  <div className="arc-settings-card-title">
                    <span>{isZh ? '字体与学术排版微调' : 'Typography & Academic Layout'}</span>
                    <button
                      className="arc-btn"
                      style={{ height: 26, fontSize: 11.5 }}
                      onClick={() => onUpdate({ typography: { ...DEFAULT_TYPOGRAPHY } })}
                    >
                      <RotateCcw size={12} />
                      <span>{isZh ? '恢复默认字体' : 'Reset Typography'}</span>
                    </button>
                  </div>

                  <div className="arc-settings-grid-2">
                    <div>
                      <div style={{ marginBottom: 5, color: 'var(--text-secondary)' }}>{isZh ? '界面 UI 字体' : 'UI Font'}</div>
                      <ArcSelect
                        ariaLabel={isZh ? '界面 UI 字体' : 'UI Font'}
                        value={typo.uiFontPreset}
                        onChange={(val) => updateTypo({ uiFontPreset: val as UiFontPreset })}
                        options={
                          isZh
                            ? [
                                { value: 'system-sans', label: '系统无衬线（Inter / 思源黑体 / 微软雅黑）' },
                                { value: 'noto-sans-sc', label: '思源黑体（Google Fonts · Noto Sans SC）' },
                                { value: 'pingfang', label: '苹果 / 鸿蒙无衬线（PingFang / HarmonyOS）' },
                                { value: 'serif', label: '思源宋体（Google Fonts · Noto Serif SC）' },
                                { value: 'rounded', label: '圆润几何体（Rounded / 幼圆）' },
                                { value: 'custom', label: '自定义本机字体名称...' },
                              ]
                            : [
                                { value: 'system-sans', label: 'System Sans (Inter / Noto Sans SC / System UI)' },
                                { value: 'noto-sans-sc', label: 'Noto Sans SC (Google Fonts)' },
                                { value: 'pingfang', label: 'PingFang / HarmonyOS Sans' },
                                { value: 'serif', label: 'Noto Serif SC (Google Fonts)' },
                                { value: 'rounded', label: 'Rounded Geometric (SF / Nunito)' },
                                { value: 'custom', label: 'Custom Local Font Name...' },
                              ]
                        }
                      />
                    </div>

                    <div>
                      <div style={{ marginBottom: 5, color: 'var(--text-secondary)' }}>{isZh ? '正文编辑器字体' : 'Editor Font'}</div>
                      <ArcSelect
                        ariaLabel={isZh ? '正文编辑器字体' : 'Editor Font'}
                        value={typo.editorFontPreset}
                        onChange={(val) => updateTypo({ editorFontPreset: val as EditorFontPreset })}
                        options={
                          isZh
                            ? [
                                { value: 'sans', label: '现代无衬线（清晰高对比）' },
                                { value: 'noto-sans-sc', label: '思源黑体（Google Fonts · Noto Sans SC）' },
                                { value: 'academic-serif', label: '思源宋体（Google Fonts · Noto Serif SC）' },
                                { value: 'wenkai', label: '霞鹜文楷（Google Fonts TC / 本地 SC）' },
                                { value: 'xiaowei', label: '站酷小薇体（Google Fonts · ZCOOL XiaoWei）' },
                                { value: 'mono', label: '等宽代码体（JetBrains Mono / Cascadia）' },
                                { value: 'custom', label: '自定义本机字体名称...' },
                              ]
                            : [
                                { value: 'sans', label: 'Modern Sans (Crisp Contrast)' },
                                { value: 'noto-sans-sc', label: 'Noto Sans SC (Google Fonts)' },
                                { value: 'academic-serif', label: 'Noto Serif SC (Google Fonts)' },
                                { value: 'wenkai', label: 'LXGW WenKai (Google Fonts TC / Local SC)' },
                                { value: 'xiaowei', label: 'ZCOOL XiaoWei (Google Fonts)' },
                                { value: 'mono', label: 'Monospace (JetBrains Mono / Cascadia)' },
                                { value: 'custom', label: 'Custom Local Font Name...' },
                              ]
                        }
                      />
                    </div>

                    {typo.uiFontPreset === 'custom' && (
                      <label>
                        <div style={{ marginBottom: 5, color: 'var(--text-secondary)' }}>{isZh ? '输入本机 UI 字体名' : 'Local UI Font Name'}</div>
                        <input
                          className="arc-input"
                          value={typo.uiFontCustom}
                          onChange={(e) => updateTypo({ uiFontCustom: e.target.value })}
                          placeholder={isZh ? '例如：HarmonyOS Sans SC' : 'e.g. Inter, SF Pro Display'}
                        />
                      </label>
                    )}

                    {typo.editorFontPreset === 'custom' && (
                      <label>
                        <div style={{ marginBottom: 5, color: 'var(--text-secondary)' }}>{isZh ? '输入本机正文/论文衬线字体名' : 'Local Editor Font Name'}</div>
                        <input
                          className="arc-input"
                          value={typo.editorFontCustom}
                          onChange={(e) => updateTypo({ editorFontCustom: e.target.value })}
                          placeholder={isZh ? '例如：LXGW WenKai' : 'e.g. Georgia, Merriweather'}
                        />
                      </label>
                    )}

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{isZh ? '正文字号' : 'Editor Font Size'}</span>
                        <span className="arc-badge">{typo.editorFontSize}px</span>
                      </div>
                      <ArcSlider
                        ariaLabel={isZh ? '正文字号' : 'Editor Font Size'}
                        min={12}
                        max={22}
                        step={0.5}
                        value={typo.editorFontSize}
                        formatValue={(v) => `${v}px`}
                        onChange={(v) => updateTypo({ editorFontSize: v })}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{isZh ? '正文行距' : 'Editor Line Height'}</span>
                        <span className="arc-badge">{typo.editorLineHeight.toFixed(2)}</span>
                      </div>
                      <ArcSlider
                        ariaLabel={isZh ? '正文行距' : 'Editor Line Height'}
                        min={1.4}
                        max={2.2}
                        step={0.05}
                        value={typo.editorLineHeight}
                        formatValue={(v) => v.toFixed(2)}
                        onChange={(v) => updateTypo({ editorLineHeight: v })}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      fontFamily: resolveEditorFontStack(typo),
                      fontSize: typo.editorFontSize,
                      lineHeight: typo.editorLineHeight,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: resolveUiFontStack(typo),
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        marginBottom: 4,
                      }}
                    >
                      {isZh ? '实时排版预览（UI 字体 + 编辑器字体/字号/行距）：' : 'Live Typography Preview (UI + Editor font, size & line height):'}
                    </div>
                    {isZh
                      ? '面向长文档演进的局部语义检索框架 ArcVault · 穹档，实现 94.2% 准确率提升。'
                      : 'ArcVault: A local-first semantic evolution framework for long-form manuscripts, achieving 94.2% retrieval accuracy.'}
                  </div>
                </div>
              )}

              {activeTab === 'archive' && (
                <>
                  <div className="arc-settings-card">
                    <div className="arc-settings-card-title">
                      <span>{isZh ? 'Word 提取默认格式' : 'Word Import Format'}</span>
                    </div>
                    <div>
                      <div style={{ marginBottom: 5, color: 'var(--text-secondary)' }}>{isZh ? 'Word 导入默认提取格式' : 'Default Word Extract Format'}</div>
                      <ArcSelect
                        ariaLabel={isZh ? 'Word 导入默认提取格式' : 'Default Word Extract Format'}
                        value={settings.defaultBackupFormat}
                        onChange={(val) => onUpdate({ defaultBackupFormat: val as BackupFormat })}
                        options={
                          isZh
                            ? [
                                { value: 'both', label: '同时生成 Markdown 与 LaTeX 互转（推荐）' },
                                { value: 'markdown', label: '仅 Markdown (.md)' },
                                { value: 'latex', label: '仅 LaTeX (.tex)' },
                              ]
                            : [
                                { value: 'both', label: 'Both Markdown & LaTeX (Recommended)' },
                                { value: 'markdown', label: 'Markdown Only (.md)' },
                                { value: 'latex', label: 'LaTeX Only (.tex)' },
                              ]
                        }
                      />
                    </div>
                  </div>

                  <div className="arc-settings-card">
                    <div className="arc-settings-card-title">
                      <span>{isZh ? '混合无感自动归档策略' : 'Silent Auto-Archive Policy'}</span>
                      <span className="arc-badge">{isZh ? 'CAS 内容去重' : 'CAS Deduplication'}</span>
                    </div>
                    <div className="arc-settings-grid-3">
                      <label>
                        <div style={{ marginBottom: 5, color: 'var(--text-secondary)' }}>{isZh ? '静默防抖（分钟）' : 'Idle Debounce (min)'}</div>
                        <input
                          className="arc-input"
                          type="number"
                          min={1}
                          max={60}
                          value={settings.autoBackup.debounceMinutes}
                          onChange={(e) =>
                            onUpdate({
                              autoBackup: { ...settings.autoBackup, debounceMinutes: Number(e.target.value) || 3 },
                            })
                          }
                        />
                      </label>
                      <label>
                        <div style={{ marginBottom: 5, color: 'var(--text-secondary)' }}>{isZh ? '每日定时备份' : 'Daily Snapshot Time'}</div>
                        <input
                          className="arc-input"
                          type="time"
                          value={settings.autoBackup.dailyTime}
                          onChange={(e) =>
                            onUpdate({
                              autoBackup: { ...settings.autoBackup, dailyTime: e.target.value },
                            })
                          }
                        />
                      </label>
                      <label>
                        <div style={{ marginBottom: 5, color: 'var(--text-secondary)' }}>{isZh ? '字数变动阈值（字）' : 'Min Char Delta'}</div>
                        <input
                          className="arc-input"
                          type="number"
                          min={10}
                          max={2000}
                          value={settings.autoBackup.minCharChangeThreshold}
                          onChange={(e) =>
                            onUpdate({
                              autoBackup: {
                                ...settings.autoBackup,
                                minCharChangeThreshold: Number(e.target.value) || 80,
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                    <div
                      style={{
                        marginTop: 12,
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: 12,
                        lineHeight: 1.7,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <div style={{ wordBreak: 'break-all' }}>
                        {isZh ? '缓存与档案目录：' : 'Cache / Vault Directory: '}
                        <strong style={{ color: 'var(--text-primary)' }}>{runtimeInfo.vaultDir}</strong>
                      </div>
                      <div style={{ wordBreak: 'break-all' }}>
                        {isZh ? '自动定时备份文件夹：' : 'Auto-Backup Folder: '}
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {runtimeInfo.backupDir ?? runtimeInfo.vaultDir}
                        </strong>
                      </div>
                      <div>
                        {isZh ? '最近备份时间：' : 'Last Backup: '}
                        {lastBackupAt
                          ? new Date(lastBackupAt).toLocaleString()
                          : isZh
                            ? '随编辑实时自动保存草稿'
                            : 'Auto-saving drafts on edit'}
                      </div>
                      {onSetCustomVaultDir && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            className="arc-input"
                            style={{ flex: 1, minWidth: 160 }}
                            value={customVaultInput}
                            onChange={(e) => setCustomVaultInput(e.target.value)}
                            placeholder={isZh ? '输入自定义缓存目录路径' : 'Custom cache directory path'}
                          />
                          {onPickVaultDirectory && (
                            <button
                              type="button"
                              className="arc-btn"
                              disabled={vaultSwitching}
                              onClick={async () => {
                                onHaptic?.('light');
                                const picked = await onPickVaultDirectory();
                                if (picked) {
                                  setCustomVaultInput(picked);
                                  await applyCustomVaultPath(picked);
                                }
                              }}
                            >
                              <FolderOpen size={13} />
                              <span>{isZh ? '浏览…' : 'Browse…'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="arc-btn"
                            disabled={vaultSwitching || !customVaultInput.trim()}
                            onClick={() => void applyCustomVaultPath(customVaultInput)}
                          >
                            <span>{vaultSwitching ? (isZh ? '迁移中…' : 'Applying…') : (isZh ? '更改目录' : 'Apply')}</span>
                          </button>
                        </div>
                      )}
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {onOpenVaultFolder && (
                          <button
                            type="button"
                            className="arc-btn"
                            onClick={() => {
                              onHaptic?.('light');
                              onOpenVaultFolder();
                            }}
                          >
                            <FolderOpen size={14} />
                            <span>{isZh ? '一键打开缓存目录' : 'Open Cache Folder'}</span>
                          </button>
                        )}
                        {onOpenBackupFolder && (
                          <button
                            type="button"
                            className="arc-btn arc-btn-primary"
                            onClick={() => {
                              onHaptic?.('light');
                              onOpenBackupFolder();
                            }}
                          >
                            <FolderOpen size={14} />
                            <span>
                              {runtimeInfo.isTauri
                                ? isZh
                                  ? '一键打开备份文件夹'
                                  : 'Open Backup Folder'
                                : isZh
                                  ? '一键导出当前备份'
                                  : 'Export Backup Now'}
                            </span>
                          </button>
                        )}
                        {onRunManualBackup && (
                          <button
                            type="button"
                            className="arc-btn"
                            onClick={() => {
                              onHaptic?.('success');
                              onRunManualBackup();
                            }}
                          >
                            <RefreshCw size={13} />
                            <span>{isZh ? '立即备份一次' : 'Backup Now'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'device' && (() => {
                const haptics = normalizeHapticsSettings(settings.haptics ?? DEFAULT_HAPTICS);
                const gyro = normalizeGyroscopeSettings(settings.gyroscope ?? DEFAULT_GYROSCOPE);
                const scrubber = normalizeScrollScrubberSettings(settings.scrollScrubber);
                const resolvedShape = resolveThemeScrubberShape(settings.theme, scrubber.shape);
                const previewMode: DevicePreviewOverride = settings.devicePreview ?? 'auto';
                const previewOptions: Array<{
                  id: DevicePreviewOverride;
                  label: string;
                  icon: React.ReactNode;
                }> = [
                  { id: 'auto', label: isZh ? '自动识别' : 'Auto Detect', icon: <Monitor size={13} /> },
                  { id: 'phone', label: isZh ? '手机竖屏' : 'Phone Portrait', icon: <Smartphone size={13} /> },
                  { id: 'tablet-portrait', label: isZh ? '平板竖屏' : 'Tablet Portrait', icon: <Tablet size={13} /> },
                  { id: 'tablet-landscape', label: isZh ? '平板横屏' : 'Tablet Landscape', icon: <Tablet size={13} /> },
                  { id: 'desktop', label: isZh ? '桌面完整' : 'Desktop Full', icon: <Monitor size={13} /> },
                ];

                const runHapticTest = async (pattern: HapticPattern) => {
                  const res = await testHapticPattern(pattern, haptics);
                  setHapticTestMsg(res.message);
                };

                return (
                  <>
                    <div className="arc-settings-card">
                      <div className="arc-settings-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Smartphone size={15} color="var(--accent)" />
                          {isZh ? '六端自适应与模拟预览设备' : 'Cross-Platform Adaptive Preview'}
                        </span>
                        {deviceEnv && (
                          <span className="arc-badge">
                            {isZh ? '当前：' : 'Current: '}
                            {deviceEnv.os.toUpperCase()} · {deviceEnv.formFactor}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                        {isZh
                          ? '支持在 Windows / macOS 桌面上一键切换模拟手机与平板（iPad / Android Tablet）布局，体验抽屉导航、键盘快捷条、底部批注审阅卡片与吸边句库浮钮；切回「自动识别」即恢复真实视口。'
                          : 'Simulate Phone or Tablet (iPad / Android) layouts directly on desktop to test drawer navigation, quick format bar, bottom annotation sheets, and edge-snapped capsule FAB. Switch back to "Auto Detect" to restore your real viewport.'}
                      </p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {previewOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={`arc-btn ${previewMode === opt.id ? 'arc-btn-primary' : ''}`}
                            onClick={() => {
                              onHaptic?.('selection');
                              onUpdate({ devicePreview: opt.id });
                            }}
                          >
                            {opt.icon}
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="arc-settings-card">
                      <div className="arc-settings-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Vibrate size={15} color="var(--accent)" />
                          {isZh ? '手机端与平板端震动反馈 (Haptics)' : 'Mobile & Tablet Haptic Feedback'}
                        </span>
                        <button
                          type="button"
                          className={`arc-btn ${haptics.enabled ? 'arc-btn-primary' : ''}`}
                          style={{ height: 28, fontSize: 12 }}
                          onClick={() => {
                            const nextEnabled = !haptics.enabled;
                            onUpdate({ haptics: { ...haptics, enabled: nextEnabled } });
                            if (nextEnabled) void testHapticPattern('light', { ...haptics, enabled: true });
                          }}
                        >
                          {haptics.enabled ? (isZh ? '已开启' : 'Enabled') : isZh ? '已关闭' : 'Disabled'}
                        </button>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                        {isZh
                          ? '触感强度档位（Android / iOS / iPadOS 真机调用系统 Tauri Haptics 线性马达，Web 端回退 Vibration API）：'
                          : 'Haptic intensity (uses native Tauri Haptics on mobile/tablet devices, falling back to Web Vibration API):'}
                      </div>
                      <div className="arc-segmented" style={{ marginBottom: 12 }}>
                        {(
                          [
                            { id: 'off', label: isZh ? '关闭' : 'Off' },
                            { id: 'gentle', label: isZh ? '柔和' : 'Gentle' },
                            { id: 'standard', label: isZh ? '标准（推荐）' : 'Standard (Recommended)' },
                          ] as Array<{ id: HapticIntensity; label: string }>
                        ).map((tier) => (
                          <button
                            key={tier.id}
                            type="button"
                            className={haptics.intensity === tier.id ? 'active' : ''}
                            onClick={() => {
                              const next = {
                                enabled: tier.id !== 'off',
                                intensity: tier.id,
                              };
                              onUpdate({ haptics: next });
                              if (tier.id !== 'off') void testHapticPattern('selection', next);
                            }}
                          >
                            {tier.label}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="arc-btn" onClick={() => runHapticTest('selection')}>
                          {isZh ? '测试：轻触选择' : 'Test: Selection'}
                        </button>
                        <button type="button" className="arc-btn" onClick={() => runHapticTest('success')}>
                          {isZh ? '测试：确认成功' : 'Test: Success'}
                        </button>
                        <button type="button" className="arc-btn" onClick={() => runHapticTest('warning')}>
                          {isZh ? '测试：警示提示' : 'Test: Warning'}
                        </button>
                      </div>

                      {hapticTestMsg && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: 12,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {hapticTestMsg}
                        </div>
                      )}
                    </div>

                    <div className="arc-settings-card">
                      <div className="arc-settings-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Compass size={15} color="var(--accent)" />
                          {isZh ? '动态背景手势与陀螺仪控制' : 'Dynamic Background Gestures & Gyroscope'}
                        </span>
                        <button
                          type="button"
                          className={`arc-btn ${gyro.enabled ? 'arc-btn-primary' : ''}`}
                          style={{ height: 28, fontSize: 12 }}
                          onClick={async () => {
                            if (gyro.enabled) {
                              onHaptic?.('light');
                              onUpdate({ gyroscope: { ...gyro, enabled: false } });
                              setGyroStatusMsg(
                                isZh
                                  ? '已关闭陀螺仪背景控制，仍可通过长按与滑动交互。'
                                  : 'Gyroscope control disabled. Long-press & swipe parallax remain active.',
                              );
                              return;
                            }
                            const perm = await requestGyroscopePermission();
                            setGyroStatusMsg(perm.message);
                            if (perm.granted) {
                              onHaptic?.('success');
                              onUpdate({ gyroscope: { ...gyro, enabled: true } });
                            } else {
                              onHaptic?.('warning');
                            }
                          }}
                        >
                          {gyro.enabled ? (isZh ? '陀螺仪已开启' : 'Gyroscope On') : isZh ? '开启陀螺仪' : 'Enable Gyroscope'}
                        </button>
                      </div>

                      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                        {isZh ? (
                          <>
                            手机端与平板端已屏蔽普通点按对动态背景的干扰，仅在<strong>长按（≥0.32 秒）</strong>或<strong>滑动拖拽</strong>时响应背景视差与粒子风场；启用陀螺仪后，倾斜机身即可平滑控制天象与天气视差，且长按与滑动仍可随时接管，互不冲突。
                          </>
                        ) : (
                          <>
                            On touch devices, single taps do not disturb dynamic backgrounds; only <strong>long-press (≥0.32s)</strong> or <strong>drag</strong> triggers parallax and wind fields. Enabling gyroscope lets you tilt the device for smooth parallax.
                          </>
                        )}
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span>{isZh ? '陀螺仪灵敏度' : 'Gyroscope Sensitivity'}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{gyro.sensitivity.toFixed(1)}×</span>
                          </div>
                          <ArcSlider
                            ariaLabel={isZh ? '陀螺仪灵敏度' : 'Gyroscope Sensitivity'}
                            value={gyro.sensitivity}
                            min={0.4}
                            max={2.0}
                            step={0.1}
                            formatValue={(v) => `${v.toFixed(1)}×`}
                            onChange={(val) =>
                              onUpdate({ gyroscope: { ...gyro, sensitivity: val } })
                            }
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="arc-btn"
                            disabled={!gyro.enabled}
                            onClick={() => {
                              onHaptic?.('selection');
                              recalibrateGyroscopeBaseline();
                              setGyroStatusMsg(
                                isZh
                                  ? '已将当前握持倾角设为零点基准。'
                                  : 'Current device tilt calibrated as zero baseline.',
                              );
                            }}
                          >
                            <RotateCw size={13} />
                            <span>{isZh ? '校准当前握持角度' : 'Calibrate Current Tilt'}</span>
                          </button>
                        </div>

                        {gyroStatusMsg && (
                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: 8,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              fontSize: 12,
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {gyroStatusMsg}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="arc-settings-card">
                      <div className="arc-settings-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MoveVertical size={15} color="var(--accent)" />
                          {isZh ? '侧边滑动组件外观与尺寸' : 'Touch Scroll Scrubber Appearance'}
                        </span>
                        <span className="arc-badge">{scrubber.size}px</span>
                      </div>

                      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                        {isZh
                          ? '手机与平板端已全面隐藏原生滚动条；在文章栏上下滑动时，右侧淡出显示当前主题造型滑块，左侧同步淡入当前章节或标题胶囊（停滑 2 秒后自动淡出，批注与修订栏不显示任何滚动条或滑块）。'
                          : 'Native scrollbars are hidden on touch devices. Scrolling reveals a themed scrubber handle on the right with a floating section pill on the left (auto-fades after 2s idle).'}
                      </p>

                      <div className="arc-scrubber-preview-stage" style={{ marginBottom: 12 }}>
                        <div className={`arc-touch-scrubber-label shape-${resolvedShape}`}>
                          <span className="arc-touch-scrubber-label-title">
                            {isZh ? '第一章 研究背景与动机' : 'Ch.1 Background & Motivation'}
                          </span>
                          <span className="arc-touch-scrubber-label-pct">38%</span>
                        </div>
                        <ScrubberHandleGlyph
                          shape={resolvedShape}
                          size={scrubber.size}
                          theme={settings.theme}
                          rotationDeg={34}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span>{isZh ? '滑动组件大小' : 'Scrubber Handle Size'}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{scrubber.size}px</span>
                          </div>
                          <ArcSlider
                            ariaLabel={isZh ? '滑动组件大小' : 'Scrubber Handle Size'}
                            value={scrubber.size}
                            min={28}
                            max={60}
                            step={2}
                            formatValue={(v) => `${v}px`}
                            onChange={(val) =>
                              onUpdate({ scrollScrubber: { ...scrubber, size: val } })
                            }
                          />
                          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                            {[
                              { label: isZh ? '紧凑 32px' : 'Compact 32px', size: 32 },
                              { label: isZh ? '标准 40px' : 'Standard 40px', size: 40 },
                              { label: isZh ? '大号 50px' : 'Large 50px', size: 50 },
                            ].map((preset) => (
                              <button
                                key={preset.size}
                                type="button"
                                className={`arc-btn ${scrubber.size === preset.size ? 'arc-btn-primary' : ''}`}
                                style={{ height: 26, fontSize: 11.5 }}
                                onClick={() => {
                                  onHaptic?.('selection');
                                  onUpdate({ scrollScrubber: { ...scrubber, size: preset.size } });
                                }}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 12, marginBottom: 6 }}>{isZh ? '滑块几何图形' : 'Scrubber Shape'}</div>
                          <div className="arc-segmented" style={{ flexWrap: 'wrap' }}>
                            {(
                              [
                                { id: 'auto', label: isZh ? '跟随主题' : 'Follow Theme' },
                                { id: 'orb', label: isZh ? '圆球' : 'Orb' },
                                { id: 'squircle', label: isZh ? '圆角矩形' : 'Squircle' },
                                { id: 'm3-burst', label: isZh ? 'M3E 花瓣' : 'M3E Burst' },
                                { id: 'm3-clover', label: isZh ? 'M3E 四叶' : 'M3E Clover' },
                              ] as const
                            ).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={scrubber.shape === item.id ? 'active' : ''}
                                onClick={() => {
                                  onHaptic?.('selection');
                                  onUpdate({ scrollScrubber: { ...scrubber, shape: item.id } });
                                }}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="arc-settings-card">
                      <div className="arc-settings-card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Wifi size={15} color="var(--accent)" />
                          {isZh ? '跨端同步与移动端节能策略' : 'Cross-Device Sync & Power Policy'}
                        </span>
                        {onOpenSync && (
                          <button
                            type="button"
                            className="arc-btn arc-btn-primary"
                            style={{ height: 28, fontSize: 12 }}
                            onClick={() => {
                              onClose();
                              onOpenSync();
                            }}
                          >
                            {isZh ? '打开 E2EE 同步中心' : 'Open E2EE Sync'}
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        {isZh ? (
                          <>
                            <div>• 桌面快捷键自适应：macOS / iPadOS 自动使用 <code>⌘Z / ⌘⇧Z / ⌘S / ⌥P</code>，Windows 使用 <code>Ctrl+Z / Ctrl+Y</code>。</div>
                            <div>• 移动端渲染功耗预算：手机与平板自动限制动态天象/天气 DPR 上限与帧率，遵循系统「减弱动态效果」。</div>
                            <div>• 同步通道：局域网扫码直连（PIN + AES-256-GCM）、WebDAV（坚果云/Alist）与 S3（Cloudflare R2/OSS）。</div>
                          </>
                        ) : (
                          <>
                            <div>• Adaptive Shortcuts: macOS / iPadOS uses <code>⌘Z / ⌘⇧Z / ⌘S / ⌥P</code>; Windows uses <code>Ctrl+Z / Ctrl+Y</code>.</div>
                            <div>• Mobile Power Budget: Phones and tablets cap dynamic shader DPR & FPS and respect system Reduce Motion.</div>
                            <div>• Sync Channels: LAN QR Pair (PIN + AES-256-GCM), WebDAV, and S3-compatible object storage.</div>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}

              {activeTab === 'ai' && (
                <>
                <div className="arc-settings-card">
                  <div className="arc-settings-card-title">
                    <span>{isZh ? '双模式 AI 网关配置' : 'Dual-Mode AI Gateway'}</span>
                    <button
                      className="arc-btn arc-btn-primary"
                      style={{ height: 28, fontSize: 12 }}
                      disabled={testing}
                      onClick={async () => {
                        setTesting(true);
                        const res = await testAiConnection(settings);
                        setTestResult({ ok: res.ok, text: res.message });
                        setTesting(false);
                      }}
                    >
                      <PlugZap size={13} />
                      <span>{testing ? (isZh ? '检测中...' : 'Testing...') : isZh ? '测试连接' : 'Test Connection'}</span>
                    </button>
                  </div>

                  <div className="arc-segmented" style={{ marginBottom: 12 }}>
                    <button
                      className={settings.aiProvider === 'offline-smart' ? 'active' : ''}
                      onClick={() => onUpdate({ aiProvider: 'offline-smart' })}
                    >
                      {isZh ? '离线智能启发式（免 Key）' : 'Offline Heuristic (No Key)'}
                    </button>
                    <button
                      className={settings.aiProvider === 'openai-compatible' ? 'active' : ''}
                      onClick={() => {
                        const isLocalEp =
                          settings.aiEndpoint.includes('11434') ||
                          settings.aiEndpoint.includes('1234') ||
                          settings.aiEndpoint.includes('8080') ||
                          settings.aiEndpoint.includes('8000') ||
                          settings.aiEndpoint.includes('localhost') ||
                          settings.aiEndpoint.includes('127.0.0.1');
                        onUpdate({
                          aiProvider: 'openai-compatible',
                          aiEndpoint: isLocalEp
                            ? 'https://api.siliconflow.cn/v1'
                            : settings.aiEndpoint,
                          aiModel:
                            settings.aiModel.includes(':') || settings.aiModel === 'local-model'
                              ? 'Qwen/Qwen2.5-7B-Instruct'
                              : settings.aiModel,
                        });
                      }}
                    >
                      {isZh ? '云端 OpenAI 兼容 API' : 'Cloud OpenAI-Compatible'}
                    </button>
                    <button
                      className={settings.aiProvider === 'ollama' ? 'active' : ''}
                      onClick={() => {
                        const isCloudEp = settings.aiEndpoint.trim().startsWith('https://');
                        onUpdate({
                          aiProvider: 'ollama',
                          aiEndpoint:
                            isCloudEp || !settings.aiEndpoint.trim()
                              ? 'http://localhost:11434/v1'
                              : settings.aiEndpoint,
                          aiModel:
                            !settings.aiModel.trim() ||
                            settings.aiModel.includes('deepseek-chat') ||
                            settings.aiModel.includes('gpt-') ||
                            settings.aiModel.includes('glm-') ||
                            settings.aiModel.includes('ernie-') ||
                            settings.aiModel.includes('hunyuan-')
                              ? 'qwen3:8b'
                              : settings.aiModel,
                        });
                      }}
                    >
                      {isZh ? '本地模型（不出本机）' : 'Local Model (On-Device)'}
                    </button>
                  </div>

                  {settings.aiProvider === 'openai-compatible' && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#16a34a', marginBottom: 6 }}>
                        {isZh ? '国内可访问免费模型（点击一键填入）：' : 'China-Accessible Free Models (One-Click Preset):'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {AI_CLOUD_FREE_PRESETS.map((p) => {
                          const isSelected =
                            settings.aiEndpoint === p.endpoint && settings.aiModel === p.model;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={`arc-btn ${isSelected ? 'arc-btn-primary' : ''}`}
                              style={{ height: 27, fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                              onClick={() => onUpdate({ aiEndpoint: p.endpoint, aiModel: p.model })}
                            >
                              <span>{isZh ? p.labelZh : p.labelEn}</span>
                              {(p.badgeZh || p.badgeEn) && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: '1px 5px',
                                    borderRadius: 999,
                                    background: isSelected ? 'rgba(255,255,255,0.22)' : 'rgba(22,163,74,0.14)',
                                    color: isSelected ? 'inherit' : '#16a34a',
                                    fontWeight: 700,
                                  }}
                                >
                                  {isZh ? p.badgeZh : p.badgeEn}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                        {isZh ? '其他常用预设：' : 'Other Common Presets:'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        {AI_CLOUD_GENERAL_PRESETS.map((p) => {
                          const isSelected =
                            settings.aiEndpoint === p.endpoint && settings.aiModel === p.model;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={`arc-btn ${isSelected ? 'arc-btn-primary' : ''}`}
                              style={{ height: 26, fontSize: 11.5 }}
                              onClick={() => onUpdate({ aiEndpoint: p.endpoint, aiModel: p.model })}
                            >
                              {isZh ? p.labelZh : p.labelEn}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {isZh
                          ? '提示：上述国内平台均可直连（无需代理），在对应官网注册并生成免费 API Key / Token 填入下方即可使用。'
                          : 'Tip: All domestic presets above are directly accessible in China; sign up on the provider console for a free API Key/Token.'}
                      </div>
                    </div>
                  )}

                  {settings.aiProvider === 'ollama' && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                        {isZh ? '本地模型运行后端预设（兼容 OpenAI / 原生协议）：' : 'Local Runtime Presets (OpenAI-Compatible / Native):'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {AI_LOCAL_RUNTIME_PRESETS.map((p) => {
                          const isSelected = settings.aiEndpoint === p.endpoint;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={`arc-btn ${isSelected ? 'arc-btn-primary' : ''}`}
                              style={{ height: 26, fontSize: 11.5 }}
                              onClick={() => onUpdate({ aiEndpoint: p.endpoint, aiModel: p.model })}
                            >
                              {isZh ? p.labelZh : p.labelEn}
                            </button>
                          );
                        })}
                      </div>

                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                          {isZh ? '自定义本地模型路径（模型文件或目录）' : 'Custom Local Model Path (File or Directory)'}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input
                            className="arc-input"
                            style={{ flex: '1 1 220px' }}
                            value={settings.aiLocalModelPath ?? ''}
                            onChange={(e) => onUpdate({ aiLocalModelPath: e.target.value })}
                            placeholder={
                              isZh
                                ? '例如：D:\\Models\\Qwen3-8B-Q4_K_M.gguf 或 D:\\OllamaModels'
                                : 'e.g., /models/Qwen3-8B-Q4_K_M.gguf or /path/to/models'
                            }
                          />
                          <input
                            ref={localModelFileInputRef}
                            type="file"
                            accept=".gguf,.onnx,.safetensors,.bin,.pt,.pth,.mlmodel,.tflite"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const patch: Partial<AppSettings> = { aiLocalModelPath: file.name };
                                if (!settings.aiModel.trim() || settings.aiModel === 'local-model') {
                                  patch.aiModel = file.name;
                                }
                                onUpdate(patch);
                              }
                              e.target.value = '';
                            }}
                          />
                          <button
                            type="button"
                            className="arc-btn"
                            style={{ height: 32, fontSize: 12 }}
                            onClick={async () => {
                              const picked = await nativePickLocalModelFile();
                              if (picked) {
                                const fileName = picked.split(/[/\\]+/).filter(Boolean).pop() ?? '';
                                const patch: Partial<AppSettings> = { aiLocalModelPath: picked };
                                if (
                                  fileName &&
                                  (!settings.aiModel.trim() || settings.aiModel === 'local-model')
                                ) {
                                  patch.aiModel = fileName;
                                }
                                onUpdate(patch);
                              } else if (!runtimeInfo.isTauri) {
                                localModelFileInputRef.current?.click();
                              }
                            }}
                          >
                            <FileCode2 size={13} />
                            <span>{isZh ? '选择模型文件' : 'Pick File'}</span>
                          </button>
                          <button
                            type="button"
                            className="arc-btn"
                            style={{ height: 32, fontSize: 12 }}
                            onClick={async () => {
                              const picked = await nativePickLocalModelDirectory();
                              if (picked) {
                                onUpdate({ aiLocalModelPath: picked });
                              }
                            }}
                          >
                            <FolderOpen size={13} />
                            <span>{isZh ? '选择目录' : 'Pick Folder'}</span>
                          </button>
                          {(settings.aiLocalModelPath ?? '').trim() && (
                            <button
                              type="button"
                              className="arc-btn"
                              style={{ height: 32, fontSize: 12 }}
                              onClick={() => onUpdate({ aiLocalModelPath: '' })}
                            >
                              <X size={13} />
                              <span>{isZh ? '清空' : 'Clear'}</span>
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                          {isZh
                            ? '支持记录本机 .gguf / .onnx / .safetensors 权重路径或模型存储目录；若下方「模型名称」留空，将自动提取路径末段文件名作为请求模型标识。'
                            : 'Stores your local .gguf / .onnx / .safetensors file or model folder path. If Model Name below is empty, the filename is automatically used.'}
                        </div>
                      </div>
                    </div>
                  )}

                  {settings.aiProvider !== 'offline-smart' && (
                    <>
                      <div className="arc-settings-grid-2" style={{ gap: 10 }}>
                        <label>
                          <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>{isZh ? '接口地址（Endpoint）' : 'Endpoint URL'}</div>
                          <input
                            className="arc-input"
                            value={settings.aiEndpoint}
                            onChange={(e) => onUpdate({ aiEndpoint: e.target.value })}
                          />
                        </label>
                        <label>
                          <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>{isZh ? '模型名称（Model）' : 'Model Name'}</div>
                          <input
                            className="arc-input"
                            value={settings.aiModel}
                            onChange={(e) => onUpdate({ aiModel: e.target.value })}
                          />
                        </label>
                        {settings.aiProvider === 'openai-compatible' && (
                          <label style={{ gridColumn: '1 / -1' }}>
                            <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>{isZh ? 'API Key（仅存本机）' : 'API Key (Stored Locally Only)'}</div>
                            <input
                              className="arc-input"
                              type="password"
                              value={settings.aiApiKey}
                              onChange={(e) => onUpdate({ aiApiKey: e.target.value })}
                              placeholder="sk-..."
                            />
                          </label>
                        )}
                      </div>

                      {(() => {
                        const deepThinking = settings.aiDeepThinking ?? true;
                        const thinkingEffort: AiThinkingEffort = settings.aiThinkingEffort ?? 'medium';
                        return (
                          <div
                            style={{
                              marginTop: 12,
                              padding: '10px 12px',
                              borderRadius: 10,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                flexWrap: 'wrap',
                                marginBottom: 8,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Brain size={15} color="var(--accent)" />
                                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {isZh ? '深度思考（Deep Thinking）' : 'Deep Thinking'}
                                </span>
                                <span className="arc-badge" style={{ fontSize: 10.5 }}>
                                  {deepThinking ? (isZh ? '默认开启' : 'Default On') : isZh ? '已关闭' : 'Off'}
                                </span>
                              </div>
                              <button
                                type="button"
                                className={`arc-btn ${deepThinking ? 'arc-btn-primary' : ''}`}
                                style={{ height: 28, fontSize: 12 }}
                                onClick={() => onUpdate({ aiDeepThinking: !deepThinking })}
                              >
                                {deepThinking ? (isZh ? '已开启' : 'Enabled') : isZh ? '已关闭' : 'Disabled'}
                              </button>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                flexWrap: 'wrap',
                                opacity: deepThinking ? 1 : 0.52,
                              }}
                            >
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {isZh ? '模型思考程度（Thinking Effort）' : 'Thinking Effort'}
                              </span>
                              <div className="arc-segmented" style={{ margin: 0 }}>
                                {(
                                  [
                                    { id: 'low', label: isZh ? '低 (low)' : 'Low' },
                                    { id: 'medium', label: isZh ? '中 (medium)' : 'Medium' },
                                    { id: 'high', label: isZh ? '高 (high)' : 'High' },
                                  ] as Array<{ id: AiThinkingEffort; label: string }>
                                ).map((opt) => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    disabled={!deepThinking}
                                    className={thinkingEffort === opt.id ? 'active' : ''}
                                    onClick={() => onUpdate({ aiThinkingEffort: opt.id })}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 7, lineHeight: 1.5 }}>
                              {isZh
                                ? '同时适用于云端与本地推理模型（DeepSeek-R1 / Qwen3 / GLM / Ollama / llama.cpp 等）；若所选模型不支持推理参数，网关会自动回退标准请求，并自动过滤回复中的 <think> 过程标签。'
                                : 'Applies to both Cloud & Local reasoning models (DeepSeek-R1, Qwen3, GLM, Ollama, llama.cpp); automatically falls back for non-reasoning models and strips <think> blocks.'}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}

                  <div
                    style={{
                      marginTop: 12,
                      padding: '9px 11px',
                      borderRadius: 8,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <ShieldCheck size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                    <span>
                      {isZh
                        ? '隐私防护：「档案保险箱」空间与标记为「仅本地 AI」的文档，网关会在发包前强制拦截任何云端请求。'
                        : 'Privacy Guard: Documents in Private Vault or marked "Local AI Only" are strictly blocked from any cloud API requests.'}
                    </span>
                  </div>

                  {testResult && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        background: testResult.ok ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
                        color: testResult.ok ? '#16a34a' : '#dc2626',
                      }}
                    >
                      {testResult.text}
                    </div>
                  )}
                </div>

                {/* AI Skills Center */}
                <div className="arc-settings-card">
                  <div className="arc-settings-card-title" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <BookOpen size={15} color="var(--accent)" />
                      <span>{isZh ? 'AI Skills 技能中心' : 'AI Skills Center'}</span>
                      <span className="arc-badge">
                        {isZh ? `已开启 ${enabledSkillCount} / ${allSkills.length} 个 Skill` : `${enabledSkillCount} / ${allSkills.length} Enabled`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <input
                        ref={skillFileInputRef}
                        type="file"
                        accept=".md,.markdown,.txt,.json"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          void handleImportSkillFiles(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      <button
                        className="arc-btn arc-btn-primary"
                        style={{ height: 28, fontSize: 12 }}
                        onClick={() => skillFileInputRef.current?.click()}
                      >
                        <Upload size={13} />
                        <span>{isZh ? '载入 Skill 文件' : 'Import Skill File'}</span>
                      </button>
                      <button
                        className="arc-btn"
                        style={{ height: 28, fontSize: 12 }}
                        onClick={() => setCreatingSkill((v) => !v)}
                      >
                        <Plus size={13} />
                        <span>{creatingSkill ? (isZh ? '取消新建' : 'Cancel') : isZh ? '新建自定义 Skill' : 'New Custom Skill'}</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.55 }}>
                    {isZh ? (
                      <>
                        采用<strong>轻量注册表 + 按需加载全文</strong>架构：平时仅常驻轻量元数据与摘要，实际调用 AI 时只按任务类型按需加载对应已开启 Skill 的完整指令（节省上下文 Token）。支持导入 <code>SKILL.md / .txt / .json</code>。
                      </>
                    ) : (
                      <>
                        Uses a <strong>lightweight registry + on-demand full-text loading</strong> architecture: only metadata stays resident, and full instructions are loaded per task type at execution time to save context tokens. Supports importing <code>SKILL.md / .txt / .json</code>.
                      </>
                    )}
                  </div>

                  <div
                    role="alert"
                    style={{
                      marginBottom: 12,
                      padding: '10px 12px',
                      borderRadius: 9,
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      borderLeft: '3px solid #d97706',
                      background: 'rgba(245, 158, 11, 0.11)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      lineHeight: 1.6,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 9,
                    }}
                  >
                    <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontWeight: 700, color: '#d97706', marginBottom: 2 }}>
                        {isZh ? '使用提醒与安全警告' : 'Usage Notice & Safety Warning'}
                      </div>
                      <div>
                        {isZh
                          ? '推荐使用付费模型如Claude Fable/Sonnet、GPT Astra/Sol、Gemini Carbon/Neon。注意合理消费，请勿通过第三方平台、二手平台进行充值，谨防受骗！不要过度依赖AI，理性辨别AI生成的内容！'
                          : 'Recommended models include Claude Fable/Sonnet, GPT Astra/Sol, and Gemini Carbon/Neon. Manage API usage responsibly, avoid unauthorized third-party top-ups, and always review AI-generated output critically.'}
                      </div>
                    </div>
                  </div>

                  {skillNotice && (
                    <div
                      style={{
                        marginBottom: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        background: skillNotice.ok ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
                        color: skillNotice.ok ? '#16a34a' : '#dc2626',
                      }}
                    >
                      {skillNotice.text}
                    </div>
                  )}

                  {creatingSkill && (
                    <div
                      style={{
                        padding: 12,
                        marginBottom: 12,
                        borderRadius: 10,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div className="arc-settings-grid-2" style={{ gap: 8 }}>
                        <label>
                          <div style={{ marginBottom: 4, fontSize: 11.5, color: 'var(--text-secondary)' }}>{isZh ? 'Skill 名称' : 'Skill Name'}</div>
                          <input
                            className="arc-input"
                            value={newSkillName}
                            onChange={(e) => setNewSkillName(e.target.value)}
                            placeholder={isZh ? '例如：IEEE LaTeX 降AI精修' : 'e.g. IEEE LaTeX Academic Polish'}
                          />
                        </label>
                        <label>
                          <div style={{ marginBottom: 4, fontSize: 11.5, color: 'var(--text-secondary)' }}>{isZh ? '一句话简介' : 'Short Description'}</div>
                          <input
                            className="arc-input"
                            value={newSkillDesc}
                            onChange={(e) => setNewSkillDesc(e.target.value)}
                            placeholder={isZh ? '例如：去除模板词并保护公式引用' : 'e.g. Remove AI clichés while preserving math & citations'}
                          />
                        </label>
                        <div>
                          <div style={{ marginBottom: 4, fontSize: 11.5, color: 'var(--text-secondary)' }}>{isZh ? '分类' : 'Category'}</div>
                          <ArcSelect
                            ariaLabel={isZh ? 'Skill 分类' : 'Skill Category'}
                            value={newSkillCategory}
                            onChange={(v) => setNewSkillCategory(v as SkillCategory)}
                            options={SKILL_CATEGORY_META.map((c) => ({ value: c.id, label: isZh ? c.labelZh : c.labelEn }))}
                          />
                        </div>
                        <div>
                          <div style={{ marginBottom: 4, fontSize: 11.5, color: 'var(--text-secondary)' }}>{isZh ? '适用语言' : 'Language'}</div>
                          <ArcSelect
                            ariaLabel={isZh ? 'Skill 语言' : 'Skill Language'}
                            value={newSkillLang}
                            onChange={(v) => setNewSkillLang(v as AiSkill['language'])}
                            options={
                              isZh
                                ? [
                                    { value: 'zh-en', label: '中英双语' },
                                    { value: 'zh', label: '仅中文' },
                                    { value: 'en', label: '仅英文' },
                                  ]
                                : [
                                    { value: 'zh-en', label: 'Bilingual (ZH/EN)' },
                                    { value: 'zh', label: 'Chinese Only' },
                                    { value: 'en', label: 'English Only' },
                                  ]
                            }
                          />
                        </div>
                      </div>
                      <label>
                        <div style={{ marginBottom: 4, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          {isZh ? '提示词规则指令（Instructions）' : 'Prompt Rules (Instructions)'}
                        </div>
                        <textarea
                          rows={4}
                          value={newSkillInstructions}
                          onChange={(e) => setNewSkillInstructions(e.target.value)}
                          placeholder={isZh ? '输入在每次调用 AI 时必须严格遵守的写法约束、禁用词或风格规范...' : 'Enter strict writing constraints, banned phrases, or style guidelines for every AI call...'}
                          style={{
                            width: '100%',
                            borderRadius: 8,
                            padding: 9,
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-app)',
                            color: 'var(--text-primary)',
                            fontSize: 12,
                            lineHeight: 1.5,
                            resize: 'vertical',
                          }}
                        />
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        <button
                          className="arc-btn"
                          style={{ height: 28, fontSize: 12 }}
                          onClick={() => setCreatingSkill(false)}
                        >
                          {isZh ? '取消' : 'Cancel'}
                        </button>
                        <button
                          className="arc-btn arc-btn-primary"
                          style={{ height: 28, fontSize: 12 }}
                          onClick={handleSaveCustomSkill}
                        >
                          <Check size={13} />
                          <span>{isZh ? '保存并启用' : 'Save & Enable'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Category Filter Pills */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    <button
                      className={`arc-btn ${skillCategoryFilter === 'all' ? 'arc-btn-primary' : ''}`}
                      style={{ height: 25, padding: '0 10px', fontSize: 11.5 }}
                      onClick={() => setSkillCategoryFilter('all')}
                    >
                      {isZh ? '全部' : 'All'} ({allSkills.length})
                    </button>
                    {SKILL_CATEGORY_META.map((cat) => {
                      const count = allSkills.filter((s) => s.category === cat.id).length;
                      return (
                        <button
                          key={cat.id}
                          className={`arc-btn ${skillCategoryFilter === cat.id ? 'arc-btn-primary' : ''}`}
                          style={{ height: 25, padding: '0 10px', fontSize: 11.5 }}
                          onClick={() => setSkillCategoryFilter(cat.id)}
                        >
                          {isZh ? cat.labelZh : cat.labelEn} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Skill Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredSkills.map((sk) => {
                      const isExpanded = expandedSkillId === sk.id;
                      const catMeta = SKILL_CATEGORY_META.find((c) => c.id === sk.category);
                      const catLabel = (isZh ? catMeta?.labelZh : catMeta?.labelEn) ?? sk.category;
                      return (
                        <div
                          key={sk.id}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: sk.enabled ? 'var(--accent-soft)' : 'var(--bg-surface)',
                            border: sk.enabled
                              ? '1px solid color-mix(in srgb, var(--accent) 45%, transparent)'
                              : '1px solid var(--border-subtle)',
                            transition: 'background-color 160ms ease, border-color 160ms ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: 12.5 }}>{sk.name}</strong>
                                <code
                                  style={{
                                    fontSize: 10.5,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: 'var(--bg-app)',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  {sk.slug}
                                </code>
                                <span className="arc-badge">{catLabel}</span>
                                <span className="arc-badge">
                                  {sk.language === 'zh-en'
                                    ? isZh
                                      ? '中英双语'
                                      : 'ZH/EN'
                                    : sk.language === 'zh'
                                      ? isZh
                                        ? '中文'
                                        : 'ZH'
                                      : 'English'}
                                </span>
                                {sk.source !== 'builtin' && (
                                  <span className="arc-badge">
                                    {sk.source === 'imported'
                                      ? isZh
                                        ? '已载入'
                                        : 'Imported'
                                      : isZh
                                        ? '自定义'
                                        : 'Custom'}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>
                                {sk.description}
                              </div>
                              {sk.origin && (
                                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
                                  {isZh ? '来源：' : 'Origin: '}
                                  {sk.origin}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                              <button
                                className={`arc-btn ${sk.enabled ? 'arc-btn-primary' : ''}`}
                                style={{ height: 26, fontSize: 11.5, padding: '0 10px' }}
                                onClick={() => toggleSkillEnabled(sk.id)}
                                title={
                                  sk.enabled
                                    ? isZh
                                      ? '点击关闭此 Skill'
                                      : 'Click to disable this skill'
                                    : isZh
                                      ? '点击开启此 Skill（开启后每次调用 AI 必执行）'
                                      : 'Click to enable this skill (enforced on every AI call)'
                                }
                              >
                                {sk.enabled ? <Check size={12} /> : null}
                                <span>{sk.enabled ? (isZh ? '已开启' : 'Enabled') : isZh ? '未开启' : 'Disabled'}</span>
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 7, gap: 6, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(sk.tags ?? []).slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  style={{
                                    fontSize: 10.5,
                                    padding: '1px 6px',
                                    borderRadius: 999,
                                    background: 'var(--bg-app)',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--border-subtle)',
                                  }}
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <button
                                className="arc-btn"
                                style={{ height: 23, fontSize: 11, padding: '0 7px' }}
                                onClick={() => {
                                  const nextExpanded = isExpanded ? null : sk.id;
                                  setExpandedSkillId(nextExpanded);
                                  if (nextExpanded && sk.hasFullSource && !loadedSkillTextById[sk.id]) {
                                    void loadSkillFullInstructions(sk).then((fullText) => {
                                      setLoadedSkillTextById((prev) => ({ ...prev, [sk.id]: fullText }));
                                    });
                                  }
                                }}
                              >
                                <ChevronDown
                                  size={12}
                                  style={{
                                    transform: isExpanded ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 180ms ease',
                                  }}
                                />
                                <span>{isExpanded ? (isZh ? '收起指令' : 'Hide Rules') : isZh ? '查看指令' : 'View Rules'}</span>
                              </button>
                              <button
                                className="arc-btn"
                                style={{ height: 23, fontSize: 11, padding: '0 7px' }}
                                onClick={async () => {
                                  const fullText = await loadSkillFullInstructions(sk);
                                  triggerBrowserDownload(
                                    `${sk.slug}.SKILL.md`,
                                    exportSkillAsMarkdown({ ...sk, instructions: fullText }),
                                    'text/markdown;charset=utf-8',
                                  );
                                }}
                                title={isZh ? '导出为标准 SKILL.md 文件' : 'Export as SKILL.md'}
                              >
                                <Download size={11} />
                                <span>{isZh ? '导出' : 'Export'}</span>
                              </button>
                              {sk.source !== 'builtin' && (
                                <button
                                  className="arc-btn"
                                  style={{ height: 23, fontSize: 11, padding: '0 7px', color: '#dc2626' }}
                                  onClick={() => deleteCustomSkill(sk.id)}
                                  title={isZh ? '删除该自定义/载入的 Skill' : 'Delete custom/imported skill'}
                                >
                                  <Trash2 size={11} />
                                  <span>{isZh ? '删除' : 'Delete'}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <pre
                              style={{
                                margin: '8px 0 0',
                                padding: 9,
                                borderRadius: 8,
                                background: 'var(--bg-app)',
                                border: '1px solid var(--border-subtle)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontSize: 11.5,
                                lineHeight: 1.55,
                                color: 'var(--text-secondary)',
                                maxHeight: 240,
                                overflowY: 'auto',
                              }}
                            >
                              {loadedSkillTextById[sk.id] ?? sk.instructions}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Academic Phrasebank Capsule Settings */}
                {(() => {
                  const pb = normalizePhrasebankSettings(settings.phrasebank);
                  const updatePb = (patch: Partial<typeof pb>) =>
                    onUpdate({ phrasebank: { ...pb, ...patch } });
                  return (
                    <div className="arc-settings-card">
                      <div className="arc-settings-card-title" style={{ flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <GraduationCap size={15} color="var(--accent)" />
                          <span>{isZh ? '学术写作句库胶囊（Academic Phrasebank）' : 'Academic Phrasebank Capsule'}</span>
                        </div>
                        <button
                          type="button"
                          className={`arc-btn ${pb.enabled ? 'arc-btn-primary' : ''}`}
                          style={{ height: 28, fontSize: 12 }}
                          onClick={() => updatePb({ enabled: !pb.enabled })}
                        >
                          {pb.enabled
                            ? isZh
                              ? '已启用（写论文时自动浮出）'
                              : 'Enabled (Auto-floats in Thesis Studio)'
                            : isZh
                              ? '已禁用（点击启用）'
                              : 'Disabled (Click to Enable)'}
                        </button>
                      </div>

                      <div className="arc-segmented" style={{ marginBottom: 12 }}>
                        <button
                          type="button"
                          className={pb.scope === 'paper-only' ? 'active' : ''}
                          onClick={() => updatePb({ scope: 'paper-only' })}
                        >
                          {isZh ? '仅在论文工作区启用' : 'Thesis Studio Only'}
                        </button>
                        <button
                          type="button"
                          className={pb.scope === 'all-spaces' ? 'active' : ''}
                          onClick={() => updatePb({ scope: 'all-spaces' })}
                        >
                          {isZh ? '所有可编辑文档启用' : 'All Editable Documents'}
                        </button>
                      </div>

                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: (pb.preferPhrasebankForAi ?? true)
                            ? '1px solid color-mix(in srgb, var(--accent) 45%, transparent)'
                            : '1px solid var(--border-subtle)',
                          background: (pb.preferPhrasebankForAi ?? true)
                            ? 'var(--accent-soft)'
                            : 'var(--bg-surface)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          marginBottom: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ minWidth: 220, flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                            {isZh
                              ? 'AI 论文修改建议优先套用 Academic Phrasebank 句式与用词（降低 AI 率）'
                              : 'Prefer Academic Phrasebank Patterns in AI Suggestions (Lower AI Detection)'}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
                            {isZh
                              ? '默认开启。在批注 AI 改写、上下文分析建议、返修 Rebuttal 等场景中，优先注入并套用 Academic Phrasebank 句库句式、谨慎避险表达与正式学术词汇，减少模板化 AI 痕。'
                              : 'Enabled by default. Injects Academic Phrasebank structures, cautious hedging, and formal scholarly lexicons into AI rewrites, context advice, and rebuttals.'}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`arc-btn ${(pb.preferPhrasebankForAi ?? true) ? 'arc-btn-primary' : ''}`}
                          style={{ height: 28, fontSize: 12, flexShrink: 0 }}
                          onClick={() =>
                            updatePb({ preferPhrasebankForAi: !(pb.preferPhrasebankForAi ?? true) })
                          }
                        >
                          {(pb.preferPhrasebankForAi ?? true)
                            ? isZh
                              ? '已开启（默认）'
                              : 'On (Default)'
                            : isZh
                              ? '已关闭'
                              : 'Off'}
                        </button>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {isZh ? '自定义胶囊栏显示的功能图标（至少保留 1 个）：' : 'Customize visible capsule icons (keep at least 1):'}
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                          gap: 6,
                        }}
                      >
                        {CAPSULE_ICON_META.map((meta) => {
                          const checked = pb.visibleIcons.includes(meta.id);
                          return (
                            <label
                              key={meta.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                padding: '6px 9px',
                                borderRadius: 8,
                                border: '1px solid var(--border-subtle)',
                                background: checked ? 'var(--accent-soft)' : 'var(--bg-surface)',
                                cursor: 'pointer',
                                fontSize: 12,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  if (checked && pb.visibleIcons.length <= 1) return;
                                  const next = checked
                                    ? pb.visibleIcons.filter((id) => id !== meta.id)
                                    : ALL_CAPSULE_ICONS.filter(
                                        (id) => id === meta.id || pb.visibleIcons.includes(id),
                                      );
                                  updatePb({ visibleIcons: next });
                                }}
                              />
                              <span>{isZh ? meta.labelCn : meta.labelEn}</span>
                            </label>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="arc-btn"
                          style={{ height: 27, fontSize: 11.5 }}
                          onClick={() => updatePb({ visibleIcons: [...ALL_CAPSULE_ICONS] })}
                        >
                          {isZh ? '恢复默认图标' : 'Reset Default Icons'}
                        </button>
                        <button
                          type="button"
                          className="arc-btn"
                          style={{ height: 27, fontSize: 11.5 }}
                          onClick={() => updatePb({ position: null, collapsed: false })}
                        >
                          {isZh ? '重置胶囊位置与展开状态' : 'Reset Position & Expand'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
                </>
              )}

              {activeTab === 'about' && (
                <>
                  <div className="arc-settings-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                      <ArcVaultLogo size={46} theme={settings.theme} />
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>
                          {isZh ? 'ArcVault · 穹档 v0.4' : 'ArcVault v0.4'}
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {isZh
                            ? 'Local-First 个人数字档案库 & 六端跨平台学术工作台'
                            : 'Local-First Personal Digital Archive & Cross-Platform Academic Studio'}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: 12.5,
                        lineHeight: 1.8,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <div>{isZh ? '运行宿主：' : 'Runtime Host: '}{runtimeInfo.platform}</div>
                      <div>{isZh ? '档案存储位置：' : 'Vault Directory: '}{runtimeInfo.vaultDir}</div>
                      <div style={{ wordBreak: 'break-all' }}>
                        {isZh ? '自动备份目录：' : 'Auto-Backup Directory: '}
                        {runtimeInfo.backupDir ?? runtimeInfo.vaultDir}
                      </div>
                      <div>
                        {isZh
                          ? '核心特性：Word 无损封面剥离 · 平行批注 Arc-Link · CAS 去重快照 · 跨版本考古 · 双模隐私 AI'
                          : 'Core Features: Lossless Word Cover Split · Parallel Arc-Link Annotations · CAS Snapshots · Version Archaeology · Dual-Mode Privacy AI'}
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' }}>
                      {onOpenVaultFolder && (
                        <button
                          type="button"
                          className="arc-btn"
                          onClick={() => {
                            onHaptic?.('light');
                            onOpenVaultFolder();
                          }}
                        >
                          <FolderOpen size={14} />
                          <span>{isZh ? '一键打开缓存目录' : 'Open Cache Folder'}</span>
                        </button>
                      )}
                      {onOpenBackupFolder && (
                        <button
                          type="button"
                          className="arc-btn"
                          onClick={() => {
                            onHaptic?.('light');
                            onOpenBackupFolder();
                          }}
                        >
                          <FolderOpen size={14} />
                          <span>
                            {runtimeInfo.isTauri
                              ? isZh
                                ? '一键打开备份文件夹'
                                : 'Open Backup Folder'
                              : isZh
                                ? '一键导出当前备份'
                                : 'Export Backup Now'}
                          </span>
                        </button>
                      )}
                      {onOpenTutorial && (
                        <button
                          type="button"
                          className="arc-btn arc-btn-primary"
                          onClick={() => {
                            onHaptic?.('light');
                            onClose();
                            onOpenTutorial();
                          }}
                        >
                          <BookOpen size={14} />
                          <span>
                            {isZh
                              ? '重播互动使用教程（支持自选板块）'
                              : 'Replay Interactive Tutorial (Select Modules)'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="arc-settings-card">
                    <div className="arc-settings-card-title">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Scale size={15} color="var(--accent)" />
                        {isZh
                          ? `致谢与开源许可 (${OPEN_SOURCE_PROJECTS.length})`
                          : `Open Source Credits & Licenses (${OPEN_SOURCE_PROJECTS.length})`}
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--text-muted)' }}>
                        {isZh
                          ? '本软件的构建离不开以下优秀开源项目'
                          : 'Built with the following open-source projects'}
                      </span>
                    </div>

                    <div className="arc-oss-grid">
                      {OPEN_SOURCE_PROJECTS.map((item) => (
                        <div key={item.id} className="arc-oss-card">
                          <div className="arc-oss-card-top">
                            <div className="arc-oss-card-title">{item.name}</div>
                            <span className="arc-badge arc-oss-license-badge">{item.license}</span>
                          </div>
                          <div className="arc-oss-card-author">
                            {isZh ? '作者：' : 'Author: '}
                            {item.author}
                          </div>
                          <p className="arc-oss-card-desc">
                            {isZh ? item.descriptionZh : item.descriptionEn}
                          </p>
                          <div className="arc-oss-card-footer">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="arc-btn arc-oss-link-btn"
                              onClick={() => onHaptic?.('light')}
                            >
                              <span>{isZh ? '访问项目主页' : 'Project Link'}</span>
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="arc-modal-footer">
          <button className="arc-btn arc-btn-primary" onClick={onClose}>
            {isZh ? '完成' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
