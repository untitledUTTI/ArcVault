import { MAJOR_SECTIONS } from './majorSections';
import { GENERAL_FUNCTIONS } from './generalFunctions';
import { PRESENTATION_SECTIONS } from './presentations';
import { PhraseItem, SectionModule } from '../types';

export const ALL_SECTIONS: SectionModule[] = [
  ...MAJOR_SECTIONS,
  ...GENERAL_FUNCTIONS,
  ...PRESENTATION_SECTIONS,
];

export const WRITTEN_SECTIONS: SectionModule[] = [
  ...MAJOR_SECTIONS,
  ...GENERAL_FUNCTIONS,
];

export interface IndexedPhrase {
  phrase: PhraseItem;
  section: SectionModule;
  moveId: string;
  moveTitleCn: string;
  moveTitleEn: string;
  skeletonSlot?: string;
}

export const ALL_PHRASES_MAP: Map<string, IndexedPhrase> = new Map();
export const GROUP_PHRASES_MAP: Map<string, IndexedPhrase[]> = new Map();

for (const section of ALL_SECTIONS) {
  for (const move of section.moves) {
    for (const phrase of move.phrases) {
      const entry: IndexedPhrase = {
        phrase,
        section,
        moveId: move.id,
        moveTitleCn: move.titleCn,
        moveTitleEn: move.titleEn,
        skeletonSlot: move.skeletonSlot,
      };
      ALL_PHRASES_MAP.set(phrase.id, entry);
      if (phrase.groupId) {
        const list = GROUP_PHRASES_MAP.get(phrase.groupId) ?? [];
        list.push(entry);
        GROUP_PHRASES_MAP.set(phrase.groupId, list);
      }
    }
  }
}

export { MAJOR_SECTIONS, GENERAL_FUNCTIONS, PRESENTATION_SECTIONS };
export * from './writingReference';
