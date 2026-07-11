export type TheoryTextStyle = 'paragraph' | 'numbered' | 'bulleted' | 'rule';

export interface TheoryTextBlock {
  id: string;
  type: 'text';
  title: string;
  body: string;
  style: TheoryTextStyle;
}

export interface TheoryVocabularyItem {
  id: string;
  emoji: string;
  word: string;
  transcription: string;
  translation: string;
  image?: string;
  audio?: string;
  audio_url?: string;
  audio_voice_id?: string;
  audio_model_id?: string;
}

export interface TheoryVocabularyBlock {
  id: string;
  type: 'vocabulary';
  title: string;
  items: TheoryVocabularyItem[];
}

export interface TheoryGrammarBlock {
  id: string;
  type: 'grammar';
  title: string;
  columns: string[];
  rows: string[][];
}

export interface TheoryImageBlock {
  id: string;
  type: 'image';
  title: string;
  caption: string;
  image: string;
  size: 'small' | 'medium';
}

export interface TheoryAudioBlock {
  id: string;
  type: 'audio';
  title: string;
  description: string;
  audio: string;
}

export interface TheoryRuleBlock {
  id: string;
  type: 'rule';
  title: string;
  body: string;
  formula: string;
  accent: 'pink' | 'purple' | 'mint';
}

export interface TheoryExampleItem {
  id: string;
  sentence: string;
  translation: string;
  note: string;
  audio?: string;
  audio_url?: string;
  audio_voice_id?: string;
  audio_model_id?: string;
}

export interface TheoryExamplesBlock {
  id: string;
  type: 'examples';
  title: string;
  items: TheoryExampleItem[];
}

export type TheoryBlock = TheoryTextBlock | TheoryVocabularyBlock | TheoryGrammarBlock | TheoryImageBlock | TheoryAudioBlock | TheoryRuleBlock | TheoryExamplesBlock;

export interface TheoryContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  blocks: TheoryBlock[];
}

export const emptyTheoryContent = (lessonTitle = ''): TheoryContent => ({
  eyebrow: 'VetoSchool Theory',
  title: lessonTitle,
  subtitle: '',
  blocks: [],
});

export const theoryId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `theory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function createTheoryBlock(type: TheoryBlock['type']): TheoryBlock {
  if (type === 'vocabulary') {
    return {
      id: theoryId(), type, title: 'Новые слова',
      items: [{ id: theoryId(), emoji: '🌸', word: '', transcription: '', translation: '' }],
    };
  }
  if (type === 'grammar') {
    return {
      id: theoryId(), type, title: 'Грамматическое правило',
      columns: ['Форма', 'Пример', 'Перевод'],
      rows: [['', '', '']],
    };
  }
  if (type === 'image') {
    return { id: theoryId(), type, title: '', caption: '', image: '', size: 'medium' };
  }
  if (type === 'audio') {
    return { id: theoryId(), type, title: 'Послушай и повтори', description: '', audio: '' };
  }
  if (type === 'rule') {
    return { id: theoryId(), type, title: 'Запомни правило', body: '', formula: '', accent: 'pink' };
  }
  if (type === 'examples') {
    return {
      id: theoryId(), type, title: 'Примеры',
      items: [{ id: theoryId(), sentence: '', translation: '', note: '' }],
    };
  }
  return { id: theoryId(), type: 'text', title: 'Новая тема', body: '', style: 'paragraph' };
}

export type TheoryTemplate = 'vocabulary' | 'grammar' | 'alphabet';

export function createTheoryTemplate(template: TheoryTemplate, lessonTitle: string): TheoryContent {
  if (template === 'grammar') {
    return {
      eyebrow: 'VetoSchool Grammar',
      title: lessonTitle || 'Grammar Time',
      subtitle: 'Разберём правило спокойно и на понятных примерах.',
      blocks: [
        { id: theoryId(), type: 'rule', title: 'Главное правило', body: 'Напишите здесь короткое и понятное объяснение правила.', formula: 'Подлежащее + глагол + дополнение', accent: 'pink' },
        {
          id: theoryId(), type: 'grammar', title: 'Как строится предложение',
          columns: ['Форма', 'Пример', 'Перевод'],
          rows: [['I am …', 'I am happy.', 'Я счастлив(а).'], ['You are …', 'You are kind.', 'Ты добрый/добрая.']],
        },
        {
          id: theoryId(), type: 'examples', title: 'Примеры предложений',
          items: [
            { id: theoryId(), sentence: 'I am happy.', translation: 'Я счастлив(а).', note: 'am используется с I' },
            { id: theoryId(), sentence: 'You are kind.', translation: 'Ты добрый/добрая.', note: 'are используется с you' },
          ],
        },
        { id: theoryId(), type: 'text', title: 'Попробуй сам', body: 'Прочитай примеры вслух.\nПридумай своё предложение.', style: 'numbered' },
      ],
    };
  }
  if (template === 'alphabet') {
    return {
      eyebrow: 'VetoSchool Basics',
      title: lessonTitle || 'Letters & Numbers',
      subtitle: 'Знакомимся с новыми буквами и цифрами.',
      blocks: [
        {
          id: theoryId(), type: 'vocabulary', title: 'Сегодня изучаем',
          items: [
            { id: theoryId(), emoji: '🅰️', word: 'A', transcription: '[eɪ]', translation: 'буква A' },
            { id: theoryId(), emoji: '1️⃣', word: 'One', transcription: '[wʌn]', translation: 'один' },
          ],
        },
        { id: theoryId(), type: 'audio', title: 'Послушай произношение', description: 'Нажми Play, послушай и повтори несколько раз.', audio: '' },
      ],
    };
  }
  return {
    eyebrow: 'VetoSchool Words',
    title: lessonTitle || 'New Words',
    subtitle: 'Смотри, слушай и запоминай новые слова.',
    blocks: [
      { id: theoryId(), type: 'text', title: 'Наша тема', body: 'Сегодня мы познакомимся с новыми английскими словами.', style: 'paragraph' },
      {
        id: theoryId(), type: 'vocabulary', title: 'Новые слова',
        items: [
          { id: theoryId(), emoji: '🍎', word: 'Apple', transcription: '[ˈæp.əl]', translation: 'яблоко' },
          { id: theoryId(), emoji: '🌸', word: 'Flower', transcription: '[ˈflaʊ.ər]', translation: 'цветок' },
          { id: theoryId(), emoji: '☀️', word: 'Sun', transcription: '[sʌn]', translation: 'солнце' },
        ],
      },
      { id: theoryId(), type: 'audio', title: 'Послушай и повтори', description: 'Послушай запись и повтори каждое слово.', audio: '' },
    ],
  };
}
