export type SpaceKind = 'paper' | 'office' | 'writing' | 'vault';

export type BackupFormat = 'markdown' | 'latex' | 'both';

export type EditorFormat = 'markdown' | 'latex';

export type ThemeId =
  | 'light'
  | 'dark'
  | 'paper'
  | 'm3-expressive'
  | 'celestial-optics'
  | 'weather-live';

export type RenderBackendMode = 'auto' | 'gpu' | 'cpu';

export type ActiveRenderBackend = 'gpu' | 'cpu';

export type RenderQualityTier = 'ultra' | 'balanced' | 'eco';

export interface RenderBackendStatus {
  mode: RenderBackendMode;
  active: ActiveRenderBackend;
  reason: string;
}

export type CelestialQuality = RenderQualityTier;

export type CelestialMood = 'venus-dusk' | 'parhelion-night' | 'dawn-rays' | 'auto-solar';

export interface CelestialSettings {
  renderMode?: RenderBackendMode;
  quality: CelestialQuality;
  mood: CelestialMood;
  particleDensity: number;
  glassOpacity: number;
  darkMaskOpacity: number;
  enableConstellations: boolean;
}

export type WeatherEffectId =
  | 'clear-sun'
  | 'clouds'
  | 'rain'
  | 'thunder'
  | 'snow'
  | 'fog'
  | 'rainbow'
  | 'aurora'
  | 'wind-petals';

export type WeatherControlMode = 'live' | 'custom' | 'random';

export type WeatherTimeOfDay = 'auto' | 'day' | 'dusk' | 'night';

export interface LiveWeatherSnapshot {
  cityName: string;
  regionLabel: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  apparentTempC: number;
  humidity: number;
  windSpeedKmh: number;
  cloudCover: number;
  weatherCode: number;
  descriptionZh: string;
  isDay: boolean;
  mappedEffects: WeatherEffectId[];
  fetchedAt: string;
  sourceName?: string;
}

export interface WeatherSettings {
  mode: WeatherControlMode;
  renderMode?: RenderBackendMode;
  quality?: RenderQualityTier;
  locationQuery: string;
  latitude: number;
  longitude: number;
  regionLabel: string;
  province?: string;
  city?: string;
  county?: string;
  liveSnapshot?: LiveWeatherSnapshot;
  customEffects: WeatherEffectId[];
  timeOfDay: WeatherTimeOfDay;
  randomIntervalSeconds: number;
  effectIntensity: number;
  rainStreakOpacity: number;
  glassOpacity: number;
  darkMaskOpacity: number;
  adaptColorByTime?: boolean;
}

export type OfficePreviewData =
  | {
      kind: 'pptx';
      slides: Array<{ index: number; title: string; bullets: string[]; notes?: string }>;
    }
  | {
      kind: 'xlsx';
      sheets: Array<{ name: string; rows: string[][] }>;
    }
  | {
      kind: 'pdf';
      dataUrl: string;
      sizeBytes: number;
    };

export type Locale = 'zh-CN' | 'en-US';

export type AnnotationType = 'comment' | 'revision';

export type RevisionKind = 'delete' | 'insert' | 'replace';

export type AnnotationStatus = 'open' | 'accepted' | 'rejected' | 'resolved';

export interface AnnotationReply {
  id: string;
  author: string;
  date: string;
  text: string;
}

export interface AnnotationItem {
  id: string;
  type: AnnotationType;
  revisionKind?: RevisionKind;
  author: string;
  date: string;
  commentText?: string;
  originalText: string;
  suggestedText?: string;
  /** Character offset in the current editor document string (inclusive) */
  anchorStart: number;
  /** Character offset in the current editor document string (exclusive) */
  anchorEnd: number;
  status: AnnotationStatus;
  replies: AnnotationReply[];
}

export interface CoverRule {
  documentId: string;
  coverEndBlockIndex: number;
  remember: boolean;
  coverBlockCount: number;
}

export interface CitationSidecarEntry {
  placeholder: string;
  provider: 'zotero' | 'endnote' | 'word-field';
  rawXml: string;
  displayText: string;
}

export interface DocxStyleDef {
  styleId: string;
  name: string;
  type: 'paragraph' | 'character' | 'table' | 'numbering';
  basedOn?: string;
  outlineLvl?: number;
  isDefault?: boolean;
}

export interface DocxStyledRun {
  text: string;
  rPrXml?: string;
}

export interface DocxBlockStyleEntry {
  originalBlockText: string;
  plainText: string;
  kind: 'heading' | 'paragraph' | 'table' | 'math-block';
  headingLevel?: number;
  pStyleId?: string;
  pPrXml?: string;
  dominantRPrXml?: string;
  runs: DocxStyledRun[];
  rawXml: string;
  hasReviewMarkup?: boolean;
}

export interface DocxStyleSidecar {
  stylesMap: Record<string, DocxStyleDef>;
  headingTemplates: Record<number, { styleId: string; pPrXml: string; rPrXml?: string }>;
  bodyTemplate?: { styleId?: string; pPrXml?: string; rPrXml?: string };
  blocks: DocxBlockStyleEntry[];
}

export interface MediaAsset {
  id: string;
  filename: string;
  mimeType: string;
  dataUrl: string;
}

export interface Snapshot {
  id: string;
  documentId: string;
  branchId: string;
  parentId: string | null;
  createdAt: string;
  label: string;
  isMilestone: boolean;
  tags: string[];
  contentHash: string;
  markdownHash: string;
  latexHash: string;
  wordCount: number;
  deltaChars: number;
  aiSummary: string;
  /** Optional motivation note (e.g., advisor feedback summary) */
  motivationNote?: string;
  /** Snapshot copy of annotations at the time of snapshot */
  annotationsCount: number;
}

export interface Branch {
  id: string;
  documentId: string;
  name: string;
  isMain: boolean;
  createdAt: string;
  headSnapshotId: string | null;
}

export interface DeletedDarling {
  id: string;
  documentId: string;
  snapshotId: string;
  deletedAt: string;
  text: string;
  charCount: number;
  tags: string[];
}

export type AiPrivacyPolicy = 'cloud-or-local' | 'local-only' | 'disabled';

export interface MotivationAttachment {
  id: string;
  documentId: string;
  snapshotId?: string;
  kind: 'screenshot' | 'email' | 'reviewer-comment' | 'note';
  title: string;
  content: string;
  imageDataUrl?: string;
  createdAt: string;
}

export interface LinkedAsset {
  id: string;
  documentId: string;
  name: string;
  category: 'figure' | 'data' | 'code' | 'bibliography';
  relativePath: string;
  sizeBytes: number;
  contentHash: string;
  updatedAt: string;
  snapshotIds: string[];
}

export interface ConsistencyIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: 'numeric-mismatch' | 'broken-ref' | 'math-syntax' | 'citation-integrity' | 'terminology';
  title: string;
  detail: string;
  snippet: string;
  suggestedFix?: string;
}

export interface WritingActivityDay {
  date: string;
  charsDelta: number;
  editSessions: number;
  peakHour: number;
}

export interface ArchiveDocument {
  id: string;
  spaceId: string;
  title: string;
  sourceExt: '.doc' | '.docx' | '.md' | '.tex' | '.pdf' | '.pptx' | '.xlsx' | '.txt' | '.other';
  sourceFileName: string;
  backupFormat: BackupFormat;
  activeFormat: EditorFormat;
  markdownText: string;
  latexText: string;
  annotations: AnnotationItem[];
  /** Base64 encoded original .docx binary for lossless export & cover re-attachment */
  baseDocxBase64?: string;
  /** Raw XML strings of cover blocks stripped from the body */
  coverXmlNodes: string[];
  /** Plain preview labels of cover blocks for CoverSplitModal */
  coverRule: CoverRule;
  citationsSidecar: CitationSidecarEntry[];
  styleSidecar?: DocxStyleSidecar;
  mediaAssets: Record<string, MediaAsset>;
  /** Integrity & seal state */
  isSealed: boolean;
  sealedHash?: string;
  sealedAt?: string;
  /** Optional document-level AI privacy override */
  aiPolicyOverride?: AiPrivacyPolicy;
  /** Structured preview data for PPTX / XLSX / PDF documents */
  officePreview?: OfficePreviewData;
  /** AES-256-GCM encrypted envelope when document is locked in Private Vault */
  encryptedPayload?: string;
  /** Watch folder path on desktop (optional) */
  watchPath?: string;
  /** ISO timestamp when moved into built-in Trash (permanently retained, never auto-purged) */
  trashedAt?: string;
  /** Original spaceId before moving into Trash for lossless restoration */
  trashedFromSpaceId?: string;
  updatedAt: string;
  createdAt: string;
  currentBranchId: string;
  tags: string[];
}

export interface Space {
  id: string;
  kind: SpaceKind;
  nameZh: string;
  nameEn: string;
  aiPolicy: AiPrivacyPolicy;
  locked?: boolean;
}

export interface AutoBackupPolicy {
  enabled: boolean;
  debounceMinutes: number;
  dailyTime: string;
  minCharChangeThreshold: number;
}

export type UiFontPreset = 'system-sans' | 'pingfang' | 'serif' | 'rounded' | 'custom';

export type EditorFontPreset = 'sans' | 'academic-serif' | 'wenkai' | 'mono' | 'custom';

export interface TypographySettings {
  uiFontPreset: UiFontPreset;
  uiFontCustom: string;
  editorFontPreset: EditorFontPreset;
  editorFontCustom: string;
  editorFontSize: number;
  editorLineHeight: number;
}

export type MonetStyle =
  | 'tonal-spot'
  | 'neutral'
  | 'monochrome'
  | 'vibrant'
  | 'rainbow'
  | 'expressive'
  | 'fantasy'
  | 'content'
  | 'fruit-salad'
  | 'fidelity';

export interface MonetSettings {
  seedColor: string;
  style: MonetStyle;
  isDark: boolean;
  contrastLevel: number;
  extractedSeeds?: string[];
  wallpaperThumbDataUrl?: string;
}

export type SkillCategory = 'de-ai' | 'academic' | 'rebuttal' | 'formatting' | 'custom';

export type SkillTaskType = 'rewrite' | 'rebuttal' | 'consistency' | 'summary' | 'general';

export interface AiSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: SkillCategory;
  language: 'zh-en' | 'zh' | 'en';
  /** Lightweight summary in registry; full source is loaded on demand when hasFullSource is true */
  instructions: string;
  hasFullSource?: boolean;
  enabled: boolean;
  source: 'builtin' | 'imported' | 'custom';
  origin?: string;
  tags?: string[];
  fileName?: string;
  createdAt?: string;
}

export type PhrasebankCapsuleIconId =
  | 'smart'
  | 'sections'
  | 'context'
  | 'lookup'
  | 'reference'
  | 'favorites'
  | 'placeholders'
  | 'skeleton';

export type PhrasebankActivationScope = 'paper-only' | 'all-spaces';

export interface PhrasebankSettings {
  enabled: boolean;
  dismissed?: boolean;
  preferPhrasebankForAi?: boolean;
  scope: PhrasebankActivationScope;
  visibleIcons: PhrasebankCapsuleIconId[];
  collapsed: boolean;
  position?: { x: number; y: number } | null;
}

export type PlatformOS = 'windows' | 'macos' | 'ios' | 'ipados' | 'android' | 'web';

export type DeviceFormFactor = 'phone' | 'tablet-portrait' | 'tablet-landscape' | 'desktop';

export type DevicePreviewOverride = 'auto' | DeviceFormFactor;

export type HapticIntensity = 'off' | 'gentle' | 'standard';

export type HapticPattern =
  | 'selection'
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error';

export interface HapticsSettings {
  enabled: boolean;
  intensity: HapticIntensity;
}

export interface GyroscopeSettings {
  enabled: boolean;
  sensitivity: number;
}

export type ScrollScrubberShape =
  | 'auto'
  | 'orb'
  | 'squircle'
  | 'm3-clover'
  | 'm3-burst';

export interface ScrollScrubberSettings {
  /** Base handle size in px (28..60, default 40) */
  size: number;
  /** 'auto' matches active theme's signature shape */
  shape: ScrollScrubberShape;
}

export type SyncMode = 'lan' | 'webdav' | 's3';

export type WebdavPresetId =
  | 'jianguoyun'
  | 'nextcloud'
  | 'alist'
  | 'synology'
  | 'custom';

export interface HlcTimestamp {
  wallMs: number;
  logical: number;
  nodeId: string;
}

export interface SyncOpLogEntry {
  id: string;
  docId: string;
  docTitle: string;
  op: 'upsert' | 'seal' | 'merge';
  hlc: HlcTimestamp;
  contentHash: string;
  deviceId: string;
  deviceName: string;
  createdAt: string;
}

export interface SyncConflictItem {
  id: string;
  docId: string;
  title: string;
  localText: string;
  remoteText: string;
  baseText: string;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  remoteDeviceName: string;
  remoteDoc: ArchiveDocument;
}

export interface SyncSettings {
  enabled: boolean;
  mode: SyncMode;
  deviceId: string;
  deviceName: string;
  e2eePassphrase: string;
  lanPort: number;
  lanPeerUrl: string;
  lanPin: string;
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavBasePath: string;
  webdavPreset?: WebdavPresetId;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3Prefix: string;
  syncMediaAssets?: boolean;
  compressImagesToWebp?: boolean;
  monthlyTrafficUsedBytes?: number;
  monthlyTrafficMonth?: string;
  monthlyTrafficLimitMb?: number;
  circuitBreakerUntil?: string;
  circuitBreakerReason?: string;
  lastSyncedAt?: string;
}

export interface AppSettings {
  theme: ThemeId;
  locale: Locale;
  commentColor: string;
  revisionColor: string;
  defaultBackupFormat: BackupFormat;
  autoBackup: AutoBackupPolicy;
  aiProvider: 'offline-smart' | 'openai-compatible' | 'ollama';
  aiEndpoint: string;
  aiModel: string;
  aiApiKey: string;
  skills?: AiSkill[];
  phrasebank?: PhrasebankSettings;
  watchDirectory: string;
  watchActive: boolean;
  typography?: TypographySettings;
  monet?: MonetSettings;
  celestial?: CelestialSettings;
  weather?: WeatherSettings;
  haptics?: HapticsSettings;
  gyroscope?: GyroscopeSettings;
  scrollScrubber?: ScrollScrubberSettings;
  devicePreview?: DevicePreviewOverride;
  sync?: SyncSettings;
  biometricEnabled?: boolean;
}

export interface DocEditableState {
  markdownText: string;
  latexText: string;
  annotations: AnnotationItem[];
  activeFormat: EditorFormat;
}
