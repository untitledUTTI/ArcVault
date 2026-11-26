export type DomainId = 'sections' | 'functions' | 'presentations';

export type ToneStrength = 'cautious' | 'neutral' | 'assertive';

export type TenseTag = 'present' | 'past' | 'present_perfect' | 'future' | 'mixed';

export type VoiceTag = 'passive' | 'active' | 'impersonal';

export interface PhraseItem {
  id: string;
  en: string;
  intentCn: string;
  tone: ToneStrength;
  tense?: TenseTag;
  voice?: VoiceTag;
  tags: string[];
  groupId?: string;
  isCore?: boolean;
}

export interface BuilderColumn {
  labelCn: string;
  options: string[];
  optional?: boolean;
}

export interface PhraseBuilder {
  id: string;
  titleCn: string;
  descCn?: string;
  columns: BuilderColumn[];
  tone?: ToneStrength;
  tense?: TenseTag;
  tags: string[];
}

export interface MoveCategory {
  id: string;
  titleEn: string;
  titleCn: string;
  tipCn?: string;
  skeletonSlot?: string;
  phrases: PhraseItem[];
  builders?: PhraseBuilder[];
}

export interface SectionModule {
  id: string;
  domain: DomainId;
  titleEn: string;
  titleCn: string;
  shortCn: string;
  summaryCn: string;
  keyRulesCn: string[];
  moves: MoveCategory[];
}

export interface PlaceholderValues {
  X: string;
  Y: string;
  Z: string;
  Author: string;
  Year: string;
  Author2: string;
  Year2: string;
}

export interface CustomPhrase {
  id: string;
  en: string;
  intentCn: string;
  sectionLabel: string;
  tone: ToneStrength;
  tense?: TenseTag;
  tags: string[];
  createdAt: number;
}

export interface RecentCopyItem {
  id: string;
  text: string;
  sourceLabel: string;
  copiedAt: number;
}

export interface SkeletonSlot {
  id: string;
  labelCn: string;
  hintCn: string;
  required?: boolean;
}

export interface SkeletonTemplate {
  id: string;
  titleCn: string;
  subtitleCn: string;
  slots: SkeletonSlot[];
}

export interface SkeletonItem {
  id: string;
  slotId: string;
  text: string;
  sourceLabel?: string;
}

export interface FilterState {
  tone: ToneStrength | 'all';
  tense: TenseTag | 'all';
  coreOnly: boolean;
}

export interface UserBackupPayload {
  version: number;
  exportedAt: string;
  favorites: string[];
  pinnedFavorites: string[];
  customPhrases: CustomPhrase[];
  placeholders: PlaceholderValues;
  skeletonItems: SkeletonItem[];
  activeTemplateId: string;
}

export type CapsuleIconId =
  | 'smart'
  | 'sections'
  | 'context'
  | 'lookup'
  | 'reference'
  | 'favorites'
  | 'placeholders'
  | 'skeleton';

export interface DetectedPaperSection {
  id: string;
  title: string;
  level: number;
  startOffset: number;
  endOffset: number;
  mappedSectionId: string;
  mappedSectionLabel: string;
  recommendedFunctionIds: string[];
  wordCount: number;
  source: 'heading' | 'heuristic';
}

export type SmartIssueKind =
  | 'everyday-word'
  | 'contraction'
  | 'confused-word'
  | 'spelling-bre'
  | 'hedging'
  | 'impersonal'
  | 'rhetorical-question'
  | 'weak-verb'
  | 'zh-colloquial'
  | 'phrase-repetition';

export interface SmartIssue {
  id: string;
  kind: SmartIssueKind;
  severity: 'warning' | 'suggestion' | 'info';
  title: string;
  detail: string;
  matchedText: string;
  startOffset: number;
  endOffset: number;
  replacements: string[];
  ruleRef?: string;
}

export interface RecommendedPhrase {
  phrase: PhraseItem;
  sectionShortCn: string;
  moveTitleCn: string;
  skeletonSlot?: string;
  reason: string;
  score: number;
}

export interface ContextAdviceItem {
  id: string;
  category:
    | 'academic-tone'
    | 'logic-cohesion'
    | 'clarity-conciseness'
    | 'section-structure'
    | 'phrase-upgrade';
  title: string;
  rationale: string;
  originalExcerpt?: string;
  startOffset?: number;
  endOffset?: number;
  suggestedRewrite?: string;
  recommendedPhrases?: string[];
}

export interface PhrasebankUserState {
  favorites: string[];
  pinnedFavorites: string[];
  customPhrases: CustomPhrase[];
  recentCopies: RecentCopyItem[];
  placeholders: PlaceholderValues;
  placeholdersEnabled: boolean;
  skeletonItems: SkeletonItem[];
  activeTemplateId: string;
}
