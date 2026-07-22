import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Download, Headphones, Image, Languages, Lightbulb, Loader2, MessageSquareQuote, Play, Plus, RefreshCw, Save, Sparkles, Table2, Trash2, Type, Upload, Volume2, Wand2 } from 'lucide-react';
import type { InteractiveTask } from '../lib/workbooks';
import { uploadWorkbookAsset } from '../lib/workbooks';
import {
  createTheoryBlock, createTheoryTemplate, emptyTheoryContent, theoryId,
  TheoryAudioBlock, TheoryBlock, TheoryContent, TheoryExamplesBlock, TheoryGrammarBlock, TheoryImageBlock, TheoryRuleBlock, TheoryTemplate, TheoryTextBlock, TheoryVocabularyBlock,
} from '../lib/theory';
import { toast } from 'sonner';
import {
  DEFAULT_ELEVENLABS_MODEL_ID, DEFAULT_ELEVENLABS_VOICE_ID, deleteCardAudio,
  generateCardAudio, signedLessonAudioUrl,
} from '../lib/cardAudio';
import { persistFunctionalLocalStorage, readFunctionalLocalStorage } from '../lib/cookieConsent';
import type { Lang } from '../lib/i18n';

const emojiChoices = ['🌸','🌈','⭐','❤️','🍎','🍓','🍊','🍋','🥕','🐶','🐱','🐰','🦋','🌻','☀️','🌙','☁️','🏠','🚗','✈️','📚','✏️','🎨','🎵','🔢','🔤','😊','😢','😴','🖐️','👀','👂','👄','👩‍🏫','👦','👧'];

const inputClass = 'w-full rounded-2xl border border-pink-100 bg-white px-4 py-3 font-body text-sm font-bold text-purple-700 outline-none transition placeholder:text-purple-200 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/60 dark:border-purple-700 dark:bg-[#241331] dark:text-purple-100';
const tinyButton = 'inline-flex items-center justify-center rounded-xl border border-purple-100 bg-white p-2 text-purple-400 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500 disabled:opacity-30 dark:border-purple-700 dark:bg-[#241331]';
const ELEVENLABS_VOICE_STORAGE_KEY = 'vetoschool-elevenlabs-voice-id';
const ELEVENLABS_MODEL_STORAGE_KEY = 'vetoschool-elevenlabs-model-id';

const theoryCopy = {
  ru: {
    moveUp: 'Выше',
    moveDown: 'Ниже',
    deleteBlock: 'Удалить блок',
    blockTitle: 'Заголовок блока',
    paragraph: 'Обычный текст',
    numbered: 'Нумерованный список',
    bulleted: 'Список',
    ruleStyle: 'Важное правило',
    explanation: 'Напишите красивое объяснение…',
    listItems: 'Каждый пункт пишите с новой строки',
    uploadPronunciationError: 'Не удалось загрузить произношение',
    pronunciationAdded: 'Произношение добавлено',
    loading: 'Загрузка…',
    replacePronunciation: 'Заменить произношение',
    addPronunciation: 'Добавить произношение',
    saveTheoryFirst: 'Сначала сохраните теоретический урок',
    fillEnglishFirst: 'Сначала заполните английский текст карточки',
    voiceIdRequired: 'Укажите Voice ID ElevenLabs',
    audioRegenerated: 'Аудио перегенерировано',
    audioGenerated: 'Аудио сгенерировано',
    audioGenerateError: 'Не удалось сгенерировать аудио',
    audioDeleted: 'Сгенерированное аудио удалено',
    audioDeleteError: 'Не удалось удалить аудио',
    mp3Unavailable: 'MP3 недоступен для скачивания',
    regenerate: 'Перегенерировать',
    generateAudio: 'Сгенерировать аудио',
    play: 'Прослушать',
    downloadMp3: 'Скачать MP3',
    deleteAudio: 'Удалить аудио',
    saveLessonFirst: 'Сначала сохраните урок',
    vocabTitlePlaceholder: 'Название: Новые слова',
    emoji: 'Эмодзи',
    wordPlaceholder: 'Слово: flower',
    translationPlaceholder: 'Перевод: цветок',
    transcriptionPlaceholder: 'Транскрипция: [ˈflaʊə]',
    deleteWord: 'Удалить слово',
    addWord: 'Добавить слово',
    tableTitle: 'Название таблицы',
    row: 'Строка',
    column: 'Колонка',
    removeRow: 'Убрать строку',
    imageUploadError: 'Не удалось загрузить изображение',
    imageUploaded: 'Изображение загружено',
    imageTitle: 'Заголовок изображения',
    small: 'Небольшое',
    medium: 'Среднее',
    imageCaption: 'Подпись под изображением',
    replaceImage: 'Заменить изображение',
    uploadImage: 'Загрузить изображение',
    audioUploadError: 'Не удалось загрузить аудио',
    audioUploaded: 'Аудиозапись загружена',
    audioTitle: 'Название: Послушай и повтори',
    audioInstruction: 'Короткая инструкция для ребёнка',
    replaceAudio: 'Заменить аудиозапись',
    uploadAudio: 'Загрузить аудио',
    audioAttached: 'Аудио прикреплено:',
    ruleTitle: 'Название правила',
    pinkAccent: 'Розовый акцент',
    purpleAccent: 'Фиолетовый акцент',
    mintAccent: 'Мятный акцент',
    ruleBody: 'Объясните правило простыми словами…',
    formula: 'Формула: I + am + adjective',
    examplesTitle: 'Название блока: Примеры',
    exampleTranslation: 'У меня есть кот.',
    exampleNote: 'Необязательная подсказка к примеру',
    deleteExample: 'Удалить пример',
    addExample: 'Добавить пример',
    textLists: 'Текст и списки',
    vocabularyCards: 'Словарные карточки',
    grammarTable: 'Грамматическая таблица',
    image: 'Изображение',
    audio: 'Аудио',
    rule: 'Правило',
    examples: 'Примеры предложений',
    templateAdded: 'Шаблон добавлен. Теперь его можно изменить под свой урок',
    theorySaved: 'Теория сохранена',
    builderTitle: 'Конструктор теории',
    builderSubtitle: 'Соберите красивую страницу урока из содержательных блоков',
    saving: 'Сохраняю…',
    saveTheory: 'Сохранить теорию',
    eyebrowPlaceholder: 'Надпись над заголовком',
    lessonTitlePlaceholder: 'Красивый заголовок урока',
    subtitlePlaceholder: 'Короткое вступление к теме',
    cardAudio: 'Озвучивание карточек',
    voiceModel: 'Голос: George · Модель: Multilingual v2',
    voiceSettings: 'Дополнительные настройки голоса',
    voiceSettingsHint: 'Меняйте эти значения только при выборе другого голоса или модели ElevenLabs. API key здесь не вводится.',
    templates: 'Готовые шаблоны',
    newWords: 'Новые слова',
    grammar: 'Грамматика',
    alphabet: 'Буквы и цифры',
    addFirstBlock: 'Добавьте первый блок теории',
    addFirstBlockHint: 'Начните с текста, новых слов или грамматической таблицы.',
  },
  en: {
    moveUp: 'Move up',
    moveDown: 'Move down',
    deleteBlock: 'Delete block',
    blockTitle: 'Block title',
    paragraph: 'Paragraph',
    numbered: 'Numbered list',
    bulleted: 'Bulleted list',
    ruleStyle: 'Important rule',
    explanation: 'Write a clear explanation…',
    listItems: 'Put each item on a new line',
    uploadPronunciationError: 'Could not upload pronunciation',
    pronunciationAdded: 'Pronunciation added',
    loading: 'Loading…',
    replacePronunciation: 'Replace pronunciation',
    addPronunciation: 'Add pronunciation',
    saveTheoryFirst: 'Save the theory lesson first',
    fillEnglishFirst: 'Fill in the English card text first',
    voiceIdRequired: 'Enter an ElevenLabs Voice ID',
    audioRegenerated: 'Audio regenerated',
    audioGenerated: 'Audio generated',
    audioGenerateError: 'Could not generate audio',
    audioDeleted: 'Generated audio deleted',
    audioDeleteError: 'Could not delete audio',
    mp3Unavailable: 'MP3 is not available for download',
    regenerate: 'Regenerate',
    generateAudio: 'Generate audio',
    play: 'Listen',
    downloadMp3: 'Download MP3',
    deleteAudio: 'Delete audio',
    saveLessonFirst: 'Save the lesson first',
    vocabTitlePlaceholder: 'Title: New words',
    emoji: 'Emoji',
    wordPlaceholder: 'Word: flower',
    translationPlaceholder: 'Translation: flower',
    transcriptionPlaceholder: 'Transcription: [ˈflaʊə]',
    deleteWord: 'Delete word',
    addWord: 'Add word',
    tableTitle: 'Table title',
    row: 'Row',
    column: 'Column',
    removeRow: 'Remove row',
    imageUploadError: 'Could not upload image',
    imageUploaded: 'Image uploaded',
    imageTitle: 'Image title',
    small: 'Small',
    medium: 'Medium',
    imageCaption: 'Image caption',
    replaceImage: 'Replace image',
    uploadImage: 'Upload image',
    audioUploadError: 'Could not upload audio',
    audioUploaded: 'Audio uploaded',
    audioTitle: 'Title: Listen and repeat',
    audioInstruction: 'Short instruction for the child',
    replaceAudio: 'Replace audio',
    uploadAudio: 'Upload audio',
    audioAttached: 'Audio attached:',
    ruleTitle: 'Rule title',
    pinkAccent: 'Pink accent',
    purpleAccent: 'Purple accent',
    mintAccent: 'Mint accent',
    ruleBody: 'Explain the rule in simple words…',
    formula: 'Formula: I + am + adjective',
    examplesTitle: 'Block title: Examples',
    exampleTranslation: 'I have a cat.',
    exampleNote: 'Optional hint for the example',
    deleteExample: 'Delete example',
    addExample: 'Add example',
    textLists: 'Text and lists',
    vocabularyCards: 'Vocabulary cards',
    grammarTable: 'Grammar table',
    image: 'Image',
    audio: 'Audio',
    rule: 'Rule',
    examples: 'Example sentences',
    templateAdded: 'Template added. You can now adapt it for your lesson',
    theorySaved: 'Theory saved',
    builderTitle: 'Theory builder',
    builderSubtitle: 'Build a beautiful lesson page from content blocks',
    saving: 'Saving…',
    saveTheory: 'Save theory',
    eyebrowPlaceholder: 'Eyebrow above the title',
    lessonTitlePlaceholder: 'Beautiful lesson title',
    subtitlePlaceholder: 'Short introduction to the topic',
    cardAudio: 'Card audio',
    voiceModel: 'Voice: George · Model: Multilingual v2',
    voiceSettings: 'Additional voice settings',
    voiceSettingsHint: 'Change these values only when using another ElevenLabs voice or model. Do not enter the API key here.',
    templates: 'Ready templates',
    newWords: 'New words',
    grammar: 'Grammar',
    alphabet: 'Letters and numbers',
    addFirstBlock: 'Add the first theory block',
    addFirstBlockHint: 'Start with text, new words, or a grammar table.',
  },
  ua: {
    moveUp: 'Вище',
    moveDown: 'Нижче',
    deleteBlock: 'Видалити блок',
    blockTitle: 'Заголовок блока',
    paragraph: 'Звичайний текст',
    numbered: 'Нумерований список',
    bulleted: 'Список',
    ruleStyle: 'Важливе правило',
    explanation: 'Напишіть гарне пояснення…',
    listItems: 'Кожен пункт пишіть з нового рядка',
    uploadPronunciationError: 'Не вдалося завантажити вимову',
    pronunciationAdded: 'Вимову додано',
    loading: 'Завантаження…',
    replacePronunciation: 'Замінити вимову',
    addPronunciation: 'Додати вимову',
    saveTheoryFirst: 'Спочатку збережіть теоретичний урок',
    fillEnglishFirst: 'Спочатку заповніть англійський текст картки',
    voiceIdRequired: 'Вкажіть Voice ID ElevenLabs',
    audioRegenerated: 'Аудіо перегенеровано',
    audioGenerated: 'Аудіо згенеровано',
    audioGenerateError: 'Не вдалося згенерувати аудіо',
    audioDeleted: 'Згенероване аудіо видалено',
    audioDeleteError: 'Не вдалося видалити аудіо',
    mp3Unavailable: 'MP3 недоступний для завантаження',
    regenerate: 'Перегенерувати',
    generateAudio: 'Згенерувати аудіо',
    play: 'Прослухати',
    downloadMp3: 'Завантажити MP3',
    deleteAudio: 'Видалити аудіо',
    saveLessonFirst: 'Спочатку збережіть урок',
    vocabTitlePlaceholder: 'Назва: Нові слова',
    emoji: 'Емодзі',
    wordPlaceholder: 'Слово: flower',
    translationPlaceholder: 'Переклад: квітка',
    transcriptionPlaceholder: 'Транскрипція: [ˈflaʊə]',
    deleteWord: 'Видалити слово',
    addWord: 'Додати слово',
    tableTitle: 'Назва таблиці',
    row: 'Рядок',
    column: 'Колонка',
    removeRow: 'Прибрати рядок',
    imageUploadError: 'Не вдалося завантажити зображення',
    imageUploaded: 'Зображення завантажено',
    imageTitle: 'Заголовок зображення',
    small: 'Невелике',
    medium: 'Середнє',
    imageCaption: 'Підпис під зображенням',
    replaceImage: 'Замінити зображення',
    uploadImage: 'Завантажити зображення',
    audioUploadError: 'Не вдалося завантажити аудіо',
    audioUploaded: 'Аудіозапис завантажено',
    audioTitle: 'Назва: Послухай і повтори',
    audioInstruction: 'Коротка інструкція для дитини',
    replaceAudio: 'Замінити аудіозапис',
    uploadAudio: 'Завантажити аудіо',
    audioAttached: 'Аудіо прикріплено:',
    ruleTitle: 'Назва правила',
    pinkAccent: 'Рожевий акцент',
    purpleAccent: 'Фіолетовий акцент',
    mintAccent: 'Мʼятний акцент',
    ruleBody: 'Поясніть правило простими словами…',
    formula: 'Формула: I + am + adjective',
    examplesTitle: 'Назва блока: Приклади',
    exampleTranslation: 'У мене є кіт.',
    exampleNote: 'Необовʼязкова підказка до прикладу',
    deleteExample: 'Видалити приклад',
    addExample: 'Додати приклад',
    textLists: 'Текст і списки',
    vocabularyCards: 'Словникові картки',
    grammarTable: 'Граматична таблиця',
    image: 'Зображення',
    audio: 'Аудіо',
    rule: 'Правило',
    examples: 'Приклади речень',
    templateAdded: 'Шаблон додано. Тепер його можна змінити під свій урок',
    theorySaved: 'Теорію збережено',
    builderTitle: 'Конструктор теорії',
    builderSubtitle: 'Зберіть красиву сторінку уроку зі змістових блоків',
    saving: 'Зберігаю…',
    saveTheory: 'Зберегти теорію',
    eyebrowPlaceholder: 'Напис над заголовком',
    lessonTitlePlaceholder: 'Красивий заголовок уроку',
    subtitlePlaceholder: 'Короткий вступ до теми',
    cardAudio: 'Озвучування карток',
    voiceModel: 'Голос: George · Модель: Multilingual v2',
    voiceSettings: 'Додаткові налаштування голосу',
    voiceSettingsHint: 'Змінюйте ці значення лише при виборі іншого голосу або моделі ElevenLabs. API key тут не вводиться.',
    templates: 'Готові шаблони',
    newWords: 'Нові слова',
    grammar: 'Граматика',
    alphabet: 'Літери й цифри',
    addFirstBlock: 'Додайте перший блок теорії',
    addFirstBlockHint: 'Почніть з тексту, нових слів або граматичної таблиці.',
  },
} as const;

const tc = (lang: Lang) => theoryCopy[lang] || theoryCopy.ru;

const blockMetaBase: Record<TheoryBlock['type'], { icon: typeof Type; color: string }> = {
  text: { icon: Type, color: 'text-purple-500 bg-purple-50' },
  vocabulary: { icon: Languages, color: 'text-pink-500 bg-pink-50' },
  grammar: { icon: Table2, color: 'text-sky-500 bg-sky-50' },
  image: { icon: Image, color: 'text-emerald-500 bg-emerald-50' },
  audio: { icon: Headphones, color: 'text-fuchsia-500 bg-fuchsia-50' },
  rule: { icon: Lightbulb, color: 'text-amber-500 bg-amber-50' },
  examples: { icon: MessageSquareQuote, color: 'text-violet-500 bg-violet-50' },
};

const blockLabel = (lang: Lang, type: TheoryBlock['type']) => {
  const copy = tc(lang);
  return {
    text: copy.textLists,
    vocabulary: copy.vocabularyCards,
    grammar: copy.grammarTable,
    image: copy.image,
    audio: copy.audio,
    rule: copy.rule,
    examples: copy.examples,
  }[type];
};

function BlockToolbar({ index, total, onMove, onDelete, lang }: { index: number; total: number; onMove: (to: number) => void; onDelete: () => void; lang: Lang }) {
  const copy = tc(lang);
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={tinyButton} disabled={index === 0} onClick={() => onMove(index - 1)} title={copy.moveUp}><ArrowUp className="h-4 w-4" /></button>
      <button type="button" className={tinyButton} disabled={index === total - 1} onClick={() => onMove(index + 1)} title={copy.moveDown}><ArrowDown className="h-4 w-4" /></button>
      <button type="button" className={`${tinyButton} hover:text-red-500`} onClick={onDelete} title={copy.deleteBlock}><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function TextEditor({ block, onChange, lang }: { block: TheoryTextBlock; onChange: (b: TheoryTextBlock) => void; lang: Lang }) {
  const copy = tc(lang);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_190px]">
        <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder={copy.blockTitle} />
        <select className={inputClass} value={block.style} onChange={e => onChange({ ...block, style: e.target.value as TheoryTextBlock['style'] })}>
          <option value="paragraph">{copy.paragraph}</option>
          <option value="numbered">{copy.numbered}</option>
          <option value="bulleted">{copy.bulleted}</option>
          <option value="rule">{copy.ruleStyle}</option>
        </select>
      </div>
      <textarea className={`${inputClass} min-h-32 resize-y leading-7`} value={block.body} onChange={e => onChange({ ...block, body: e.target.value })}
        placeholder={block.style === 'paragraph' || block.style === 'rule' ? copy.explanation : copy.listItems} />
    </div>
  );
}

function VocabularyAudioUpload({ audio, onUploaded, lang }: { audio?: string; onUploaded: (path: string) => void; lang: Lang }) {
  const copy = tc(lang);
  const [uploading, setUploading] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const path = await uploadWorkbookAsset(file);
    setUploading(false);
    if (!path) return toast.error(copy.uploadPronunciationError);
    onUploaded(path);
    toast.success(copy.pronunciationAdded);
  };

  return (
    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-purple-100 bg-white px-3 py-2 text-xs font-black text-purple-500 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500 dark:border-purple-700 dark:bg-[#241331] dark:text-purple-200">
      {uploading ? <Sparkles className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
      {uploading ? copy.loading : audio ? copy.replacePronunciation : copy.addPronunciation}
      <input type="file" accept="audio/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
    </label>
  );
}

function GeneratedAudioControls({ lessonId, cardId, text, audioUrl, voiceId, modelId, onChanged, lang }: {
  lessonId?: string;
  cardId: string;
  text: string;
  audioUrl?: string;
  voiceId: string;
  modelId: string;
  onChanged: (audioUrl?: string) => void;
  lang: Lang;
}) {
  const copy = tc(lang);
  const [busy, setBusy] = useState<'generate' | 'delete' | 'download' | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!audioUrl) {
      setPlayUrl(null);
      return;
    }
    signedLessonAudioUrl(audioUrl).then(url => { if (alive) setPlayUrl(url); });
    return () => { alive = false; };
  }, [audioUrl]);

  const generate = async () => {
    if (!lessonId) return toast.error(copy.saveTheoryFirst);
    if (!text.trim()) return toast.error(copy.fillEnglishFirst);
    if (!voiceId.trim()) return toast.error(copy.voiceIdRequired);
    setBusy('generate');
    try {
      const result = await generateCardAudio({
        card_id: cardId,
        lesson_id: lessonId,
        text: text.trim(),
        voice_id: voiceId.trim(),
        model_id: modelId.trim() || DEFAULT_ELEVENLABS_MODEL_ID,
      });
      onChanged(result.audio_url);
      toast.success(audioUrl ? copy.audioRegenerated : copy.audioGenerated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.audioGenerateError);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!lessonId) return;
    setBusy('delete');
    try {
      await deleteCardAudio(cardId, lessonId);
      onChanged(undefined);
      toast.success(copy.audioDeleted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.audioDeleteError);
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    if (!playUrl) return;
    setBusy('download');
    try {
      const response = await fetch(playUrl);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${text.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'vetoschool-card'}.mp3`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      toast.error(copy.mp3Unavailable);
    } finally {
      setBusy(null);
    }
  };

  const buttonClass = 'inline-flex items-center gap-1.5 rounded-xl border border-purple-100 bg-white px-3 py-2 text-xs font-black text-purple-500 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500 disabled:cursor-not-allowed disabled:opacity-45 dark:border-purple-700 dark:bg-[#241331] dark:text-purple-200';
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-purple-100 bg-white/70 p-2 dark:border-purple-700 dark:bg-white/5">
      <button type="button" onClick={generate} disabled={busy !== null || !lessonId || !text.trim()} className={buttonClass}>
        {busy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : audioUrl ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        {audioUrl ? copy.regenerate : copy.generateAudio}
      </button>
      {audioUrl && <>
        <button type="button" onClick={() => playUrl ? new Audio(playUrl).play().catch(() => toast.error(copy.audioGenerateError)) : toast.error(copy.loading)} disabled={busy !== null} className={buttonClass}><Play className="h-4 w-4" />{copy.play}</button>
        <button type="button" onClick={download} disabled={busy !== null || !playUrl} className={buttonClass}>{busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{copy.downloadMp3}</button>
        <button type="button" onClick={remove} disabled={busy !== null} className={`${buttonClass} text-red-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500`}>{busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{copy.deleteAudio}</button>
      </>}
      {!lessonId && <span className="text-xs font-bold text-amber-500">{copy.saveLessonFirst}</span>}
    </div>
  );
}

function VocabularyEditor({ block, onChange, lessonId, voiceId, modelId, lang }: { block: TheoryVocabularyBlock; onChange: (b: TheoryVocabularyBlock) => void; lessonId?: string; voiceId: string; modelId: string; lang: Lang }) {
  const copy = tc(lang);
  const updateItem = (index: number, patch: Partial<TheoryVocabularyBlock['items'][number]>) =>
    onChange({ ...block, items: block.items.map((item, i) => i === index ? { ...item, ...patch } : item) });
  return (
    <div className="space-y-3">
      <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder={copy.vocabTitlePlaceholder} />
      {block.items.map((item, index) => (
        <div key={item.id} className="rounded-2xl border border-purple-100 bg-purple-50/35 p-3 dark:border-purple-700 dark:bg-white/5">
          <div className="grid gap-2 sm:grid-cols-[74px_1fr_1fr]">
            <input className={`${inputClass} text-center text-2xl`} value={item.emoji} onChange={e => updateItem(index, { emoji: e.target.value })} maxLength={8} aria-label={copy.emoji} />
            <input className={inputClass} value={item.word} onChange={e => updateItem(index, { word: e.target.value })} placeholder={copy.wordPlaceholder} />
            <input className={inputClass} value={item.translation} onChange={e => updateItem(index, { translation: e.target.value })} placeholder={copy.translationPlaceholder} />
            <div className="sm:col-start-2">
              <input className={inputClass} value={item.transcription} onChange={e => updateItem(index, { transcription: e.target.value })} placeholder={copy.transcriptionPlaceholder} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <VocabularyAudioUpload audio={item.audio} lang={lang} onUploaded={audio => updateItem(index, { audio })} />
              <button type="button" className="rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-black text-red-400 hover:bg-red-50 dark:border-red-900 dark:bg-[#241331]"
                onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== index) })}>{copy.deleteWord}</button>
            </div>
            <div className="sm:col-span-3">
              <GeneratedAudioControls lessonId={lessonId} cardId={item.id} text={item.word} audioUrl={item.audio_url} voiceId={voiceId} modelId={modelId} lang={lang} onChanged={audio_url => updateItem(index, { audio_url, audio_voice_id: audio_url ? voiceId : undefined, audio_model_id: audio_url ? modelId : undefined })} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {emojiChoices.map(emoji => <button type="button" key={emoji} onClick={() => updateItem(index, { emoji })} className="h-8 w-8 rounded-xl bg-white text-lg shadow-sm transition hover:-translate-y-0.5 hover:bg-pink-50 dark:bg-[#321b45]">{emoji}</button>)}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...block, items: [...block.items, { id: theoryId(), emoji: '⭐', word: '', transcription: '', translation: '' }] })}
        className="inline-flex items-center gap-2 rounded-2xl bg-purple-100 px-4 py-2 text-sm font-black text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-100"><Plus className="h-4 w-4" />{copy.addWord}</button>
    </div>
  );
}

function GrammarEditor({ block, onChange, lang }: { block: TheoryGrammarBlock; onChange: (b: TheoryGrammarBlock) => void; lang: Lang }) {
  const copy = tc(lang);
  const setColumn = (index: number, value: string) => onChange({ ...block, columns: block.columns.map((column, i) => i === index ? value : column) });
  const setCell = (rowIndex: number, cellIndex: number, value: string) => onChange({ ...block, rows: block.rows.map((row, r) => r === rowIndex ? row.map((cell, c) => c === cellIndex ? value : cell) : row) });
  return (
    <div className="space-y-3">
      <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder={copy.tableTitle} />
      <div className="overflow-x-auto rounded-2xl border border-purple-100 dark:border-purple-700">
        <table className="min-w-[620px] w-full border-collapse">
          <thead><tr className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950 dark:to-purple-950">
            {block.columns.map((column, index) => <th key={index} className="border-r border-purple-100 p-2 last:border-r-0 dark:border-purple-700"><input className={inputClass} value={column} onChange={e => setColumn(index, e.target.value)} /></th>)}
          </tr></thead>
          <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="bg-white dark:bg-[#241331]">
            {block.columns.map((_, cellIndex) => <td key={cellIndex} className="border-r border-t border-purple-100 p-2 last:border-r-0 dark:border-purple-700"><input className={inputClass} value={row[cellIndex] || ''} onChange={e => setCell(rowIndex, cellIndex, e.target.value)} /></td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange({ ...block, rows: [...block.rows, block.columns.map(() => '')] })} className="rounded-2xl bg-purple-100 px-4 py-2 text-sm font-black text-purple-700">+ {copy.row}</button>
        <button type="button" onClick={() => onChange({ ...block, columns: [...block.columns, copy.column], rows: block.rows.map(row => [...row, '']) })} className="rounded-2xl bg-pink-100 px-4 py-2 text-sm font-black text-pink-600">+ {copy.column}</button>
        {block.rows.length > 1 && <button type="button" onClick={() => onChange({ ...block, rows: block.rows.slice(0, -1) })} className="rounded-2xl bg-red-50 px-4 py-2 text-sm font-black text-red-400">{copy.removeRow}</button>}
      </div>
    </div>
  );
}

function ImageEditor({ block, onChange, lang }: { block: TheoryImageBlock; onChange: (b: TheoryImageBlock) => void; lang: Lang }) {
  const copy = tc(lang);
  const [uploading, setUploading] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const path = await uploadWorkbookAsset(file);
    setUploading(false);
    if (!path) return toast.error(copy.imageUploadError);
    onChange({ ...block, image: path });
    toast.success(copy.imageUploaded);
  };
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder={copy.imageTitle} />
        <select className={inputClass} value={block.size} onChange={e => onChange({ ...block, size: e.target.value as TheoryImageBlock['size'] })}><option value="small">{copy.small}</option><option value="medium">{copy.medium}</option></select>
      </div>
      <input className={inputClass} value={block.caption} onChange={e => onChange({ ...block, caption: e.target.value })} placeholder={copy.imageCaption} />
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-purple-200 bg-purple-50/60 px-4 py-4 font-body text-sm font-black text-purple-600 transition hover:border-pink-300 hover:bg-pink-50 dark:border-purple-700 dark:bg-white/5">
        {uploading ? <Sparkles className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}{uploading ? copy.loading : block.image ? copy.replaceImage : copy.uploadImage}
        <input type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
      </label>
    </div>
  );
}

function AudioEditor({ block, onChange, lang }: { block: TheoryAudioBlock; onChange: (b: TheoryAudioBlock) => void; lang: Lang }) {
  const copy = tc(lang);
  const [uploading, setUploading] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const path = await uploadWorkbookAsset(file);
    setUploading(false);
    if (!path) return toast.error(copy.audioUploadError);
    onChange({ ...block, audio: path });
    toast.success(copy.audioUploaded);
  };
  return (
    <div className="grid gap-3">
      <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder={copy.audioTitle} />
      <textarea className={`${inputClass} min-h-24 resize-y`} value={block.description} onChange={e => onChange({ ...block, description: e.target.value })} placeholder={copy.audioInstruction} />
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-pink-200 bg-gradient-to-r from-pink-50 to-purple-50 px-4 py-4 font-body text-sm font-black text-purple-600 transition hover:border-purple-300 dark:border-purple-700 dark:from-pink-500/10 dark:to-purple-500/10 dark:text-purple-100">
        {uploading ? <Sparkles className="h-5 w-5 animate-spin" /> : <Headphones className="h-5 w-5 text-pink-400" />}
        {uploading ? copy.loading : block.audio ? copy.replaceAudio : copy.uploadAudio}
        <input type="file" accept="audio/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
      </label>
      {block.audio && <div className="truncate rounded-2xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200">{copy.audioAttached} {block.audio}</div>}
    </div>
  );
}

function RuleEditor({ block, onChange, lang }: { block: TheoryRuleBlock; onChange: (b: TheoryRuleBlock) => void; lang: Lang }) {
  const copy = tc(lang);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder={copy.ruleTitle} />
        <select className={inputClass} value={block.accent} onChange={e => onChange({ ...block, accent: e.target.value as TheoryRuleBlock['accent'] })}>
          <option value="pink">{copy.pinkAccent}</option>
          <option value="purple">{copy.purpleAccent}</option>
          <option value="mint">{copy.mintAccent}</option>
        </select>
      </div>
      <textarea className={`${inputClass} min-h-28 resize-y leading-7`} value={block.body} onChange={e => onChange({ ...block, body: e.target.value })} placeholder={copy.ruleBody} />
      <input className={inputClass} value={block.formula} onChange={e => onChange({ ...block, formula: e.target.value })} placeholder={copy.formula} />
    </div>
  );
}

function ExamplesEditor({ block, onChange, lessonId, voiceId, modelId, lang }: { block: TheoryExamplesBlock; onChange: (b: TheoryExamplesBlock) => void; lessonId?: string; voiceId: string; modelId: string; lang: Lang }) {
  const copy = tc(lang);
  const updateItem = (index: number, patch: Partial<TheoryExamplesBlock['items'][number]>) =>
    onChange({ ...block, items: block.items.map((item, i) => i === index ? { ...item, ...patch } : item) });
  return (
    <div className="space-y-3">
      <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder={copy.examplesTitle} />
      {block.items.map((item, index) => (
        <div key={item.id} className="grid gap-2 rounded-2xl border border-purple-100 bg-purple-50/35 p-3 sm:grid-cols-2 dark:border-purple-700 dark:bg-white/5">
          <input className={inputClass} value={item.sentence} onChange={e => updateItem(index, { sentence: e.target.value })} placeholder="I have a cat." />
          <input className={inputClass} value={item.translation} onChange={e => updateItem(index, { translation: e.target.value })} placeholder={copy.exampleTranslation} />
          <input className={`${inputClass} sm:col-span-2`} value={item.note} onChange={e => updateItem(index, { note: e.target.value })} placeholder={copy.exampleNote} />
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <VocabularyAudioUpload audio={item.audio} lang={lang} onUploaded={audio => updateItem(index, { audio })} />
            <button type="button" className="w-fit rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-400 hover:bg-red-100 dark:bg-red-950/30" onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== index) })}>{copy.deleteExample}</button>
          </div>
          <div className="sm:col-span-2">
            <GeneratedAudioControls lessonId={lessonId} cardId={item.id} text={item.sentence} audioUrl={item.audio_url} voiceId={voiceId} modelId={modelId} lang={lang} onChanged={audio_url => updateItem(index, { audio_url, audio_voice_id: audio_url ? voiceId : undefined, audio_model_id: audio_url ? modelId : undefined })} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...block, items: [...block.items, { id: theoryId(), sentence: '', translation: '', note: '' }] })} className="inline-flex items-center gap-2 rounded-2xl bg-purple-100 px-4 py-2 text-sm font-black text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-100"><Plus className="h-4 w-4" />{copy.addExample}</button>
    </div>
  );
}

export default function TheoryLessonEditor({ lessonTitle, task, onCreate, onSave, lang = 'ru' }: {
  lessonTitle: string;
  task?: InteractiveTask;
  onCreate: (content: TheoryContent) => Promise<void>;
  onSave: (content: TheoryContent) => Promise<void>;
  lang?: Lang;
}) {
  const copy = tc(lang);
  const [content, setContent] = useState<TheoryContent>(() => ({ ...emptyTheoryContent(lessonTitle), ...(task?.payload_json || {}) }));
  const [saving, setSaving] = useState(false);
  const [voiceId, setVoiceId] = useState(() => readFunctionalLocalStorage(ELEVENLABS_VOICE_STORAGE_KEY, DEFAULT_ELEVENLABS_VOICE_ID));
  const [modelId, setModelId] = useState(() => readFunctionalLocalStorage(ELEVENLABS_MODEL_STORAGE_KEY, DEFAULT_ELEVENLABS_MODEL_ID));
  useEffect(() => setContent({ ...emptyTheoryContent(lessonTitle), ...(task?.payload_json || {}) }), [task?.id, lessonTitle]);
  const setBlock = (index: number, block: TheoryBlock) => setContent(current => ({ ...current, blocks: current.blocks.map((item, i) => i === index ? block : item) }));
  const moveBlock = (from: number, to: number) => setContent(current => { const blocks = [...current.blocks]; const [item] = blocks.splice(from, 1); blocks.splice(to, 0, item); return { ...current, blocks }; });
  const makeBlock = (type: TheoryBlock['type']): TheoryBlock => {
    const block = createTheoryBlock(type);
    if (block.type === 'text') return { ...block, title: lang === 'en' ? 'New topic' : lang === 'ua' ? 'Нова тема' : 'Новая тема' };
    if (block.type === 'vocabulary') return { ...block, title: copy.newWords };
    if (block.type === 'grammar') {
      return {
        ...block,
        title: copy.grammarTable,
        columns: lang === 'en' ? ['Form', 'Example', 'Translation'] : lang === 'ua' ? ['Форма', 'Приклад', 'Переклад'] : block.columns,
      };
    }
    if (block.type === 'audio') return { ...block, title: lang === 'en' ? 'Listen and repeat' : lang === 'ua' ? 'Послухай і повтори' : block.title };
    if (block.type === 'rule') return { ...block, title: lang === 'en' ? 'Remember the rule' : lang === 'ua' ? 'Запамʼятай правило' : block.title };
    if (block.type === 'examples') return { ...block, title: copy.examples };
    return block;
  };
  const localizeTemplate = (template: TheoryContent): TheoryContent => {
    if (lang === 'ru') return template;
    const map: Record<string, string> = lang === 'en'
      ? {
          'Разберём правило спокойно и на понятных примерах.': 'Let’s explore the rule calmly with clear examples.',
          'Главное правило': 'Main rule',
          'Напишите здесь короткое и понятное объяснение правила.': 'Write a short, clear explanation of the rule here.',
          'Подлежащее + глагол + дополнение': 'Subject + verb + object',
          'Как строится предложение': 'How the sentence is built',
          'Форма': 'Form',
          'Пример': 'Example',
          'Перевод': 'Translation',
          'Я счастлив(а).': 'I am happy.',
          'Ты добрый/добрая.': 'You are kind.',
          'Примеры предложений': 'Example sentences',
          'am используется с I': 'am is used with I',
          'are используется с you': 'are is used with you',
          'Попробуй сам': 'Try it yourself',
          'Прочитай примеры вслух.\nПридумай своё предложение.': 'Read the examples aloud.\nMake your own sentence.',
          'Знакомимся с новыми буквами и цифрами.': 'Meet new letters and numbers.',
          'Сегодня изучаем': 'Today we learn',
          'буква A': 'letter A',
          'один': 'one',
          'Послушай произношение': 'Listen to the pronunciation',
          'Нажми Play, послушай и повтори несколько раз.': 'Press Play, listen, and repeat a few times.',
          'Смотри, слушай и запоминай новые слова.': 'Look, listen, and remember new words.',
          'Наша тема': 'Our topic',
          'Сегодня мы познакомимся с новыми английскими словами.': 'Today we will meet new English words.',
          'Новые слова': 'New words',
          'яблоко': 'apple',
          'цветок': 'flower',
          'солнце': 'sun',
          'Послушай и повтори': 'Listen and repeat',
          'Послушай запись и повтори каждое слово.': 'Listen to the recording and repeat each word.',
        }
      : {
          'Разберём правило спокойно и на понятных примерах.': 'Розберімо правило спокійно й на зрозумілих прикладах.',
          'Главное правило': 'Головне правило',
          'Напишите здесь короткое и понятное объяснение правила.': 'Напишіть тут коротке й зрозуміле пояснення правила.',
          'Подлежащее + глагол + дополнение': 'Підмет + дієслово + додаток',
          'Как строится предложение': 'Як будується речення',
          'Пример': 'Приклад',
          'Перевод': 'Переклад',
          'Я счастлив(а).': 'Я щасливий/щаслива.',
          'Ты добрый/добрая.': 'Ти добрий/добра.',
          'Примеры предложений': 'Приклади речень',
          'am используется с I': 'am використовується з I',
          'are используется с you': 'are використовується з you',
          'Попробуй сам': 'Спробуй сам',
          'Прочитай примеры вслух.\nПридумай своё предложение.': 'Прочитай приклади вголос.\nПридумай своє речення.',
          'Знакомимся с новыми буквами и цифрами.': 'Знайомимося з новими літерами й цифрами.',
          'Сегодня изучаем': 'Сьогодні вивчаємо',
          'буква A': 'літера A',
          'один': 'один',
          'Послушай произношение': 'Послухай вимову',
          'Нажми Play, послушай и повтори несколько раз.': 'Натисни Play, послухай і повтори кілька разів.',
          'Смотри, слушай и запоминай новые слова.': 'Дивись, слухай і запамʼятовуй нові слова.',
          'Наша тема': 'Наша тема',
          'Сегодня мы познакомимся с новыми английскими словами.': 'Сьогодні ми познайомимося з новими англійськими словами.',
          'Новые слова': 'Нові слова',
          'яблоко': 'яблуко',
          'цветок': 'квітка',
          'солнце': 'сонце',
          'Послушай и повтори': 'Послухай і повтори',
          'Послушай запись и повтори каждое слово.': 'Послухай запис і повтори кожне слово.',
        };
    const translate = (value: string) => map[value] || value;
    return {
      ...template,
      subtitle: translate(template.subtitle),
      blocks: template.blocks.map(block => {
        if (block.type === 'text') return { ...block, title: translate(block.title), body: translate(block.body) };
        if (block.type === 'vocabulary') return { ...block, title: translate(block.title), items: block.items.map(item => ({ ...item, translation: translate(item.translation) })) };
        if (block.type === 'grammar') return { ...block, title: translate(block.title), columns: block.columns.map(translate), rows: block.rows.map(row => row.map(translate)) };
        if (block.type === 'audio') return { ...block, title: translate(block.title), description: translate(block.description) };
        if (block.type === 'rule') return { ...block, title: translate(block.title), body: translate(block.body), formula: translate(block.formula) };
        if (block.type === 'examples') return { ...block, title: translate(block.title), items: block.items.map(item => ({ ...item, translation: translate(item.translation), note: translate(item.note) })) };
        return block;
      }),
    };
  };
  const applyTemplate = (template: TheoryTemplate) => {
    const prepared = localizeTemplate(createTheoryTemplate(template, content.title || lessonTitle));
    setContent(current => ({
      ...current,
      eyebrow: current.blocks.length === 0 ? prepared.eyebrow : current.eyebrow,
      title: current.title || prepared.title,
      subtitle: current.subtitle || prepared.subtitle,
      blocks: [...current.blocks, ...prepared.blocks],
    }));
    toast.success(copy.templateAdded);
  };
  const save = async () => {
    setSaving(true);
    try {
      if (task) await onSave(content);
      else await onCreate(content);
      toast.success(copy.theorySaved);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="space-y-4 rounded-3xl border border-purple-100 bg-white p-4 shadow-sm dark:border-purple-700 dark:bg-[#1f122d]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 text-purple-600"><BookOpen className="h-5 w-5" /></span><div><div className="font-display text-lg font-black text-purple-800 dark:text-purple-100">{copy.builderTitle}</div><p className="text-xs font-bold text-purple-400">{copy.builderSubtitle}</p></div></div>
        <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-500 px-4 py-2.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? copy.saving : copy.saveTheory}</button>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <input className={inputClass} value={content.eyebrow} onChange={e => setContent({ ...content, eyebrow: e.target.value })} placeholder={copy.eyebrowPlaceholder} />
        <input className={`${inputClass} sm:col-span-2`} value={content.title} onChange={e => setContent({ ...content, title: e.target.value })} placeholder={copy.lessonTitlePlaceholder} />
        <input className={`${inputClass} sm:col-span-3`} value={content.subtitle} onChange={e => setContent({ ...content, subtitle: e.target.value })} placeholder={copy.subtitlePlaceholder} />
      </div>
      <div className="rounded-3xl border border-purple-100 bg-gradient-to-r from-purple-50/80 via-white to-pink-50/80 p-3 dark:border-purple-700 dark:from-purple-500/10 dark:via-white/5 dark:to-pink-500/10">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-pink-500 shadow-sm dark:bg-white/10"><Volume2 className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-black text-purple-700 dark:text-purple-100">{copy.cardAudio}</div>
            <p className="mt-1 text-xs font-bold text-purple-400">{copy.voiceModel}</p>
            <details className="mt-2">
              <summary className="w-fit cursor-pointer text-xs font-black text-purple-500 transition hover:text-pink-500">{copy.voiceSettings}</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="space-y-1"><span className="text-xs font-black text-purple-400">Voice ID</span><input className={inputClass} value={voiceId} onChange={e => { setVoiceId(e.target.value); persistFunctionalLocalStorage(ELEVENLABS_VOICE_STORAGE_KEY, e.target.value); }} placeholder="Voice ID" /></label>
                <label className="space-y-1"><span className="text-xs font-black text-purple-400">Model ID</span><input className={inputClass} value={modelId} onChange={e => { setModelId(e.target.value); persistFunctionalLocalStorage(ELEVENLABS_MODEL_STORAGE_KEY, e.target.value); }} placeholder="Model ID" /></label>
              </div>
              <p className="mt-2 text-xs font-bold text-purple-400">{copy.voiceSettingsHint}</p>
            </details>
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-pink-100 bg-gradient-to-r from-pink-50/80 via-white to-purple-50/80 p-3 dark:border-purple-700 dark:from-pink-500/10 dark:via-white/5 dark:to-purple-500/10">
        <div className="mb-2 flex items-center gap-2 font-display text-sm font-black text-purple-700 dark:text-purple-100"><Wand2 className="h-4 w-4 text-pink-400" />{copy.templates}</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => applyTemplate('vocabulary')} className="rounded-2xl border border-white bg-white px-4 py-2 text-xs font-black text-purple-700 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 dark:border-purple-700 dark:bg-[#2a183a] dark:text-purple-100">🌸 {copy.newWords}</button>
          <button type="button" onClick={() => applyTemplate('grammar')} className="rounded-2xl border border-white bg-white px-4 py-2 text-xs font-black text-purple-700 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 dark:border-purple-700 dark:bg-[#2a183a] dark:text-purple-100">📘 {copy.grammar}</button>
          <button type="button" onClick={() => applyTemplate('alphabet')} className="rounded-2xl border border-white bg-white px-4 py-2 text-xs font-black text-purple-700 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 dark:border-purple-700 dark:bg-[#2a183a] dark:text-purple-100">🔤 {copy.alphabet}</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 rounded-2xl bg-purple-50/70 p-3 dark:bg-white/5">
        {(Object.keys(blockMetaBase) as TheoryBlock['type'][]).map(type => { const meta = blockMetaBase[type]; const Icon = meta.icon; return <button type="button" key={type} onClick={() => setContent(current => ({ ...current, blocks: [...current.blocks, makeBlock(type)] }))} className="inline-flex items-center gap-2 rounded-2xl border border-white bg-white px-3 py-2 text-xs font-black text-purple-700 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 dark:border-purple-700 dark:bg-[#2a183a] dark:text-purple-100"><Icon className="h-4 w-4 text-pink-400" />{blockLabel(lang, type)}</button>; })}
      </div>
      {content.blocks.length === 0 && <div className="rounded-3xl border border-dashed border-purple-200 bg-purple-50/40 p-8 text-center"><Sparkles className="mx-auto mb-2 h-7 w-7 text-pink-400" /><p className="font-display font-black text-purple-700">{copy.addFirstBlock}</p><p className="mt-1 text-sm font-bold text-purple-400">{copy.addFirstBlockHint}</p></div>}
      <div className="space-y-3">{content.blocks.map((block, index) => { const meta = blockMetaBase[block.type]; const Icon = meta.icon; return <article key={block.id} className="rounded-3xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/35 p-4 dark:border-purple-700 dark:from-[#241331] dark:to-[#1c1029]"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-display text-sm font-black text-purple-700 dark:text-purple-100"><span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${meta.color}`}><Icon className="h-4 w-4" /></span>{blockLabel(lang, block.type)}</div><BlockToolbar index={index} total={content.blocks.length} lang={lang} onMove={to => moveBlock(index, to)} onDelete={() => setContent(current => ({ ...current, blocks: current.blocks.filter((_, i) => i !== index) }))} /></div>{block.type === 'text' && <TextEditor block={block} lang={lang} onChange={next => setBlock(index, next)} />}{block.type === 'vocabulary' && <VocabularyEditor block={block} lang={lang} onChange={next => setBlock(index, next)} lessonId={task?.lesson_id} voiceId={voiceId} modelId={modelId} />}{block.type === 'grammar' && <GrammarEditor block={block} lang={lang} onChange={next => setBlock(index, next)} />}{block.type === 'image' && <ImageEditor block={block} lang={lang} onChange={next => setBlock(index, next)} />}{block.type === 'audio' && <AudioEditor block={block} lang={lang} onChange={next => setBlock(index, next)} />}{block.type === 'rule' && <RuleEditor block={block} lang={lang} onChange={next => setBlock(index, next)} />}{block.type === 'examples' && <ExamplesEditor block={block} lang={lang} onChange={next => setBlock(index, next)} lessonId={task?.lesson_id} voiceId={voiceId} modelId={modelId} />}</article>; })}</div>
    </section>
  );
}
