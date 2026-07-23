// Universal catalog of interactive-task mechanics.
// `mechanic_type` in the `interactive_tasks` table stores one of these string ids.
// `payload_json` shape is mechanic-specific and documented alongside each entry.

export type MechanicType =
  | 'theory_content'
  | 'word_lego'
  | 'matching'
  | 'odd_one_out'
  | 'fill_letters'
  | 'category_sorting'
  | 'word_search'
  | 'connect_dots'
  | 'spot_and_count'
  | 'anagram_unscramble'
  | 'speaking_practice'
  | 'digital_coloring'
  | 'cipher_decoder'
  | 'true_false'
  | 'mini_shop';

export interface MechanicDef {
  id: MechanicType;
  emoji: string;
  /** Short English label; UI localises via i18n keys later. */
  label: string;
  /** One-line description of what the child does. */
  description: string;
  /** Free-form doc for the admin builder — describes the expected payload_json. */
  payloadShape: string;
}

export const MECHANICS: MechanicDef[] = [
  {
    id: 'word_lego',
    emoji: '🧩',
    label: 'Word Lego',
    description: 'Combine two halves into a word or phrase.',
    payloadShape: '{ pairs: Array<{ left: {text?, image?}, right: {text?, image?} }> }',
  },
  {
    id: 'matching',
    emoji: '🔗',
    label: 'Matching',
    description: 'Draw lines between matching pairs.',
    payloadShape: '{ pairs: Array<{ left: {text?, image?}, right: {text?, image?} }> }',
  },
  {
    id: 'odd_one_out',
    emoji: '🚫',
    label: 'Odd One Out',
    description: 'Pick the element that does not fit.',
    payloadShape: '{ items: Array<{ text?, image?, is_odd: boolean }> }',
  },
  {
    id: 'fill_letters',
    emoji: '✍️',
    label: 'Fill Letters / Words',
    description: 'Type the missing letters or words into the blanks.',
    payloadShape: '{ segments: Array<{ text: string, blanks: string[] }> }',
  },
  {
    id: 'category_sorting',
    emoji: '🗂️',
    label: 'Category Sorting',
    description: 'Drag items into the correct group / container.',
    payloadShape: '{ categories: Array<{ name: string, items: Array<{ text?, image? }> }> }',
  },
  {
    id: 'word_search',
    emoji: '🔍',
    label: 'Word Search',
    description: 'Find target words hidden in a letter grid.',
    payloadShape: '{ words: string[], size?: number }  // grid auto-generated from words',
  },
  {
    id: 'anagram_unscramble',
    emoji: '🔤',
    label: 'Anagram Unscramble',
    description: 'Rebuild a word from shuffled letters.',
    payloadShape: '{ answer: string }  // system shuffles at render time',
  },
  {
    id: 'speaking_practice',
    emoji: '🎙️',
    label: 'Speaking Practice',
    description: 'Say a word, sentence, answer, or short free-speaking prompt aloud.',
    payloadShape: '{ mode: "repeat_word"|"read_sentence"|"name_picture"|"answer_question"|"describe_animal"|"speak_20_seconds", prompt?: string, target?: string, image?: string, audio?: string, seconds?: number }',
  },
  {
    id: 'digital_coloring',
    emoji: '🎨',
    label: 'Digital Coloring',
    description: 'Color regions using colour/number codes.',
    payloadShape: '{ image_url: string, palette: Array<{ code: string|number, color: string }>, regions: Array<{ id, code }> }',
  },
  {
    id: 'cipher_decoder',
    emoji: '🕵️',
    label: 'Cipher Decoder',
    description: 'Decode a word/phrase using a numeric or letter key.',
    payloadShape: '{ answer: string, key?: Record<string,string|number> }  // system encodes at render',
  },
  {
    id: 'true_false',
    emoji: '✅',
    label: 'True / False',
    description: 'Decide whether each statement is true or false.',
    payloadShape: '{ statements: Array<{ text: string, is_true: boolean, explanation?: string }> }',
  },
  {
    id: 'mini_shop',
    emoji: '🛒',
    label: 'Mini-shop',
    description: 'Choose items in a pretend shop and match the target total.',
    payloadShape: '{ items: Array<{ name: string, price: number, image?: string }>, target_total: number }',
  },
];

export const MECHANIC_TYPES: MechanicType[] = MECHANICS.map(m => m.id);
export const findMechanic = (id: string) => MECHANICS.find(m => m.id === id);

// ============ Storage helpers ============
export const WORKBOOK_ASSETS_BUCKET = 'workbook-assets';

// ============ Lesson-kind tuning ============
export type LessonKind = 'theory' | 'class_task' | 'homework' | 'practice' | 'checkpoint';

/** Kinds that can reward stars. */
export const REWARDABLE_KINDS: LessonKind[] = ['homework', 'practice', 'checkpoint'];
export const canReward = (k: LessonKind) => REWARDABLE_KINDS.includes(k);
