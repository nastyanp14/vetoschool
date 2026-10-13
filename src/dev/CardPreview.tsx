import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ContentCard, FileModal, LockedModal } from '../pages/Dashboard';
import DictionaryView from '../components/DictionaryView';
import MeetDesignPreview from './MeetDesignPreview';
import DashboardGrades from '../components/DashboardGrades';
import type { ContentItem } from '../lib/content';
import type { DictWord } from '../lib/dictionary';
import { t, type Lang } from '../lib/i18n';

type PreviewSection = 'online-class' | 'listening' | 'checkpoint' | 'grammar' | 'practice' | 'homework' | 'dictionary' | 'grades';
type Example = { label: string; item: ContentItem };
const base: ContentItem = { id: 'demo', moduleId: 'preview', type: 'listening', title: '', emoji: '🎧', unlocked: true };
const date = '2026-08-29T12:00:00';
const examples: Example[] = [
  { label: 'Заблокировано', item: { ...base, id: 'locked', title: 'Урок пока закрыт', unlocked: false } },
  { label: 'Доступное интерактивное задание', item: { ...base, id: 'interactive', title: 'Listen and choose', interactiveLessonId: 'demo-lesson', materialMode: 'interactive', dueDate: '2026-09-15' } },
  { label: 'Проверено · оценка и отзыв', item: { ...base, id: 'reviewed', title: 'Everyday conversations', interactiveLessonId: 'demo-lesson', materialMode: 'interactive', starRating: 3, interactiveScorePercent: 60, interactiveCompletedAt: date, submittedAt: date, checkedAt: date, reviewComment: 'Good work. Listen again to the final dialogue.' } },
  { label: 'На доработке · с оценкой', item: { ...base, id: 'reviewed-revision', title: 'Listening revision', interactiveLessonId: 'demo-lesson', materialMode: 'interactive', starRating: 3, interactiveScorePercent: 60, interactiveCompletedAt: date, submittedAt: date, checkedAt: date, reviewComment: 'Please correct the last answer.', homeworkStatus: 'revision_requested' } },
  { label: 'Аудиофайл · можно отправить работу', item: { ...base, id: 'audio', title: 'Listen to the recording', fileUrl: '/preview/sample.wav', fileName: 'sample.wav' } },
  { label: 'Работа отправлена · ждёт проверки', item: { ...base, id: 'submitted', title: 'Listening worksheet', externalLink: '/preview/answers.txt', submittedAt: date, submittedAttachmentName: 'answers.txt', homeworkStatus: 'submitted' } },
  { label: 'На доработке · без оценки', item: { ...base, id: 'file-revision', title: 'Worksheet revision', externalLink: '/preview/answers.txt', homeworkStatus: 'revision_requested' } },
  { label: 'Аудиофайл · проверено', item: { ...base, id: 'audio-reviewed', title: 'Reviewed recording', fileUrl: '/preview/sample.wav', fileName: 'sample.wav', starRating: 4, reviewComment: 'Well done!', checkedAt: date, submittedAt: date } },
  { label: 'Документ · можно скачать', item: { ...base, id: 'document', title: 'Reading the transcript', fileUrl: '/preview/answers.txt', fileName: 'answers.txt' } },
  { label: 'Картинка с заданием', item: { ...base, id: 'image', title: 'Picture worksheet', fileUrl: '/dashboard/listening-assessment-card.png', fileName: 'worksheet.png' } },
];

const grammarTitles = ['Урок пока закрыт', 'Choose the correct form', 'Present simple', 'Grammar revision', 'Grammar worksheet', 'Articles: a, an, the', 'Worksheet revision', 'Reviewed worksheet', 'Grammar rules', 'Build a sentence'];
const grammarExamples: Example[] = examples.map((example, index) => ({
  ...example,
  item: { ...example.item, title: grammarTitles[index], emoji: '📖', type: 'grammar' },
}));
grammarExamples[2].item.reviewComment = 'Good work. Check the verb endings once more.';
grammarExamples[4] = { label: 'Файл с заданием · можно отправить работу', item: { ...grammarExamples[4].item, fileUrl: '/preview/answers.txt', fileName: 'grammar-worksheet.txt' } };
grammarExamples[7] = { label: 'Файл с заданием · проверено', item: { ...grammarExamples[7].item, fileUrl: '/preview/answers.txt', fileName: 'grammar-worksheet.txt' } };
grammarExamples[9].item.fileUrl = '/dashboard/grammar-assessment-card.png';

const practiceTitles = ['Урок пока закрыт', 'Choose the right answer', 'Everyday English', 'Practice revision', 'Practice worksheet', 'Make your own sentences', 'Worksheet revision', 'Reviewed worksheet', 'Practice guide', 'Match and complete'];
const practiceExamples: Example[] = examples.map((example, index) => ({
  ...example,
  item: { ...example.item, title: practiceTitles[index], emoji: '🎯', type: 'practice' },
}));
practiceExamples[2].item.reviewComment = 'Good work. Try the last exercise once more.';
practiceExamples[4] = { label: 'Файл с заданием · можно отправить работу', item: { ...practiceExamples[4].item, fileUrl: '/preview/answers.txt', fileName: 'practice-worksheet.txt' } };
practiceExamples[7] = { label: 'Файл с заданием · проверено', item: { ...practiceExamples[7].item, fileUrl: '/preview/answers.txt', fileName: 'practice-worksheet.txt' } };
practiceExamples[9].item.fileUrl = '/dashboard/practice-assessment-card.png';

const homeworkTitles = ['Урок пока закрыт', 'Complete the sentences', 'My daily routine', 'Homework revision', 'Homework worksheet', 'Write about your family', 'Worksheet revision', 'Reviewed homework', 'Homework instructions', 'Describe the picture'];
const homeworkExamples: Example[] = examples.map((example, index) => ({
  ...example,
  item: { ...example.item, title: homeworkTitles[index], emoji: '📚', type: 'homework' },
}));
homeworkExamples[2].item.reviewComment = 'Good work. Check the last sentence once more.';
homeworkExamples[4] = { label: 'Файл с заданием · можно отправить работу', item: { ...homeworkExamples[4].item, fileUrl: '/preview/answers.txt', fileName: 'homework-worksheet.txt' } };
homeworkExamples[7] = { label: 'Файл с заданием · проверено', item: { ...homeworkExamples[7].item, fileUrl: '/preview/answers.txt', fileName: 'homework-worksheet.txt', submittedAttachmentName: 'answers.txt' } };
homeworkExamples[9].item.fileUrl = '/dashboard/homework-assessment-card.png';

const previewGradeItems: Record<'homework' | 'practice' | 'checkpoint' | 'grammar' | 'listening', ContentItem[]> = {
  homework: [
    { ...homeworkExamples[2].item, id: 'grade-homework-1', moduleId: 'module-1', title: 'My daily routine', dueDate: '2026-09-11', submittedAt: null, checkedAt: null, homeworkStatus: 'not_submitted', starRating: null },
    { ...homeworkExamples[4].item, id: 'grade-homework-2', moduleId: 'module-1', title: 'Describe your family', dueDate: '2026-09-15', submittedAt: null, checkedAt: null, homeworkStatus: 'not_submitted', starRating: null },
    { ...homeworkExamples[7].item, id: 'grade-homework-3', moduleId: 'module-1', title: 'At the zoo', dueDate: '2026-08-28', submittedAt: '2026-08-28T12:00:00', checkedAt: '2026-08-29T12:00:00', homeworkStatus: 'reviewed', starRating: 4 },
    { ...homeworkExamples[7].item, id: 'grade-homework-4', moduleId: 'module-1', title: 'My bedroom', dueDate: '2026-08-24', submittedAt: '2026-08-24T12:00:00', checkedAt: '2026-08-25T12:00:00', homeworkStatus: 'reviewed', starRating: 5 },
    { ...homeworkExamples[7].item, id: 'grade-homework-5', moduleId: 'module-1', title: 'Food and drinks', dueDate: '2026-08-20', submittedAt: '2026-08-20T12:00:00', checkedAt: null, homeworkStatus: 'submitted', starRating: null },
  ],
  practice: [
    { ...practiceExamples[4].item, id: 'grade-practice-1', moduleId: 'module-2', title: 'Everyday English', dueDate: '2026-09-12', submittedAt: null, checkedAt: null, homeworkStatus: 'not_submitted', starRating: null },
    { ...practiceExamples[7].item, id: 'grade-practice-2', moduleId: 'module-2', title: 'Match and complete', submittedAt: '2026-09-01T12:00:00', checkedAt: '2026-09-02T12:00:00', homeworkStatus: 'reviewed', starRating: 5 },
  ],
  checkpoint: [
    { ...base, id: 'grade-checkpoint-1', moduleId: 'module-2', type: 'checkpoint', emoji: '🏁', title: 'Unit 2 Checkpoint', dueDate: '2026-09-18', homeworkStatus: 'not_submitted' },
    { ...base, id: 'grade-checkpoint-2', moduleId: 'module-1', type: 'checkpoint', emoji: '🏁', title: 'Unit 1 Checkpoint', submittedAt: '2026-08-25T12:00:00', checkedAt: '2026-08-26T12:00:00', homeworkStatus: 'reviewed', starRating: 4 },
  ],
  grammar: [
    { ...grammarExamples[4].item, id: 'grade-grammar-1', moduleId: 'module-2', title: 'Present Simple', dueDate: '2026-09-14', submittedAt: null, checkedAt: null, homeworkStatus: 'not_submitted', starRating: null },
    { ...grammarExamples[7].item, id: 'grade-grammar-2', moduleId: 'module-1', title: 'Articles: a, an, the', submittedAt: '2026-08-30T12:00:00', checkedAt: '2026-08-31T12:00:00', homeworkStatus: 'revision_requested', studentResult: 'Revision Requested', starRating: 3 },
  ],
  listening: [
    { ...examples[4].item, id: 'grade-listening-1', moduleId: 'module-2', title: 'Everyday conversations', dueDate: '2026-09-16', submittedAt: null, checkedAt: null, homeworkStatus: 'not_submitted', starRating: null },
    { ...examples[7].item, id: 'grade-listening-2', moduleId: 'module-1', title: 'At the airport', submittedAt: '2026-09-02T12:00:00', checkedAt: '2026-09-03T12:00:00', homeworkStatus: 'reviewed', starRating: 4 },
  ],
};

function GradesPreview({ lang }: { lang: Lang }) {
  return (
    <div className="mx-auto max-w-[1248px]">
      <DashboardGrades lang={lang} ratingAverage={4.3} totalEarned={43} itemsByType={previewGradeItems} onOpenItem={() => {}} />
    </div>
  );
}

const dictionaryWords: DictWord[] = [
  { id: 'dictionary-elephant', userId: 'local-dictionary-preview', lesson: 'Animals 1', category: 'Animals', word: 'Elephant', translation: 'слон', emoji: '🐘', audioUrl: '/preview/audio/elephant.wav' },
  { id: 'dictionary-lion', userId: 'local-dictionary-preview', lesson: 'Animals 1', category: 'Animals', word: 'Lion', translation: 'лев', emoji: '🦁', audioUrl: '/preview/audio/lion.wav' },
  { id: 'dictionary-apple', userId: 'local-dictionary-preview', lesson: 'Food 1', category: 'Food', word: 'Apple', translation: 'яблоко', emoji: '🍎', audioUrl: '/preview/audio/apple.wav' },
  { id: 'dictionary-banana', userId: 'local-dictionary-preview', lesson: 'Food 1', category: 'Food', word: 'Banana', translation: 'банан', emoji: '🍌', audioUrl: '/preview/audio/banana.wav' },
  { id: 'dictionary-schoolbag', userId: 'local-dictionary-preview', lesson: 'School 1', category: 'School', word: 'Schoolbag', translation: 'школьный рюкзак', emoji: '🎒', audioUrl: '/preview/audio/schoolbag.wav' },
  { id: 'dictionary-pencil', userId: 'local-dictionary-preview', lesson: 'School 1', category: 'School', word: 'Pencil', translation: 'карандаш', emoji: '✏️', audioUrl: '/preview/audio/pencil.wav' },
  { id: 'dictionary-globe', userId: 'local-dictionary-preview', lesson: 'School 1', category: 'School', word: 'Globe', translation: 'глобус', emoji: '🌍', audioUrl: '/preview/audio/globe.wav' },
  { id: 'dictionary-book', userId: 'local-dictionary-preview', lesson: 'School 1', category: 'School', word: 'Book', translation: 'книга', emoji: '📚', audioUrl: '/preview/audio/book.wav' },
];

export default function CardPreview() {
  const previewParams = new URLSearchParams(window.location.search);
  const previewDailyReview = previewParams.get('review') === 'daily';
  const forceDarkPreview = previewParams.get('theme') === 'dark';
  const previewUserId = previewDailyReview ? 'local-daily-review-preview-v1' : 'local-dictionary-preview';
  const [lang, setLang] = useState<Lang>(() => { const value = previewParams.get('lang'); return value === 'ua' || value === 'en' ? value : 'ru'; });
  const [section, setSection] = useState<PreviewSection>(() => {
    const requested = previewParams.get('section');
    return requested === 'online-class' || requested === 'grammar' || requested === 'checkpoint' || requested === 'practice' || requested === 'homework' || requested === 'dictionary' || requested === 'grades' ? requested : 'listening';
  });
  const [selectedId, setSelectedId] = useState<string | null>(() => previewParams.get('open'));
  const [changes, setChanges] = useState<Record<string, Partial<ContentItem>>>({});
  const [message, setMessage] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const cards = section === 'online-class' || section === 'dictionary' || section === 'grades' ? [] : (section === 'homework' ? homeworkExamples : section === 'practice' ? practiceExamples : section === 'grammar' ? grammarExamples : examples).map(example => ({ ...example, item: { ...example.item, ...changes[`${section}:${example.item.id}`], type: section } }));
  const selected = cards.find(example => example.item.id === selectedId)?.item;

  useEffect(() => {
    if (!forceDarkPreview) return undefined;

    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.add('dark');

    return () => {
      if (!wasDark) root.classList.remove('dark');
    };
  }, [forceDarkPreview]);

  const patchItem = (id: string, patch: Partial<ContentItem>) => {
    setChanges(current => ({ ...current, [`${section}:${id}`]: { ...current[`${section}:${id}`], ...patch } }));
  };
  const reset = () => {
    setSelectedId(null);
    setChanges({});
    setMessage('');
    localStorage.removeItem('dictionary-learned:local-dictionary-preview');
    localStorage.removeItem('dictionary-favorites:local-dictionary-preview');
    localStorage.removeItem('dictionary-review-progress:local-dictionary-preview');
    localStorage.removeItem('dictionary-review-days:local-dictionary-preview');
    localStorage.removeItem('dictionary-learned:local-daily-review-preview-v1');
    localStorage.removeItem('dictionary-favorites:local-daily-review-preview-v1');
    localStorage.removeItem('dictionary-review-progress:local-daily-review-preview-v1');
    localStorage.removeItem('dictionary-review-days:local-daily-review-preview-v1');
    setResetKey(value => value + 1);
  };
  const openMaterial = async (item: ContentItem) => {
    const url = item.externalLink || item.fileUrl;
    // Only the local demo fixtures above can be opened from this page.
    if (url?.startsWith('/preview/') || url?.startsWith('/dashboard/')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f3ff] px-4 py-6 font-body text-purple-700 sm:px-6">
      <header className="mx-auto mb-8 max-w-[1248px] rounded-3xl border border-white bg-white/80 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-purple-400">Vetoschool · локальный предпросмотр</p>
            <h1 className="font-display text-2xl font-bold">Все состояния карточек</h1>
          </div>
          <div className="flex gap-1 rounded-full bg-purple-50 p-1" aria-label="Язык карточек">
            {(['ru', 'en', 'ua'] as const).map(value => (
              <button key={value} type="button" aria-pressed={lang === value} onClick={() => setLang(value)} className={`rounded-full px-3 py-2 text-sm font-bold ${lang === value ? 'bg-purple-500 text-white' : 'text-purple-500 hover:bg-white'}`}>{value.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-purple-500">Переключай разделы и нажимай на карточки. Здесь используются настоящие компоненты сайта — правки появляются автоматически. Аккаунт не нужен: данные вымышленные, выбранные файлы никуда не отправляются.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {([{ id: 'listening', title: 'Аудирование' }, { id: 'checkpoint', title: 'Unit Checkpoint' }, { id: 'grammar', title: 'Грамматика' }, { id: 'practice', title: 'Практика' }, { id: 'homework', title: 'Домашние задания' }, { id: 'dictionary', title: 'Словарик' }, { id: 'grades', title: 'Оценки' }, { id: 'online-class', title: 'Онлайн-клас' }] as const).map(tab => (
            <button key={tab.id} type="button" aria-pressed={section === tab.id} onClick={() => { setSelectedId(null); setSection(tab.id); setMessage(''); }} className={`rounded-full px-5 py-2.5 font-bold ${section === tab.id ? 'student-accent-gradient text-white shadow-sm' : 'bg-purple-50 hover:bg-purple-100'}`}>{tab.title}</button>
          ))}
          <button type="button" onClick={reset} className="rounded-full border border-purple-200 px-4 py-2.5 text-sm hover:bg-purple-50 sm:ml-auto">Сбросить примеры</button>
        </div>
        {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
      </header>
      {section === 'online-class' ? <MeetDesignPreview lang={lang} /> : section === 'grades' ? <GradesPreview lang={lang} /> : section === 'dictionary' ? <div className="mx-auto max-w-[1488px]"><DictionaryView key={resetKey} userId={previewUserId} lang={lang} previewWords={dictionaryWords} previewDailyReview={previewDailyReview} /></div> : <div className="mx-auto grid max-w-[1248px] gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ label, item }, index) => (
            <section key={`${section}:${item.id}`}>
              <p className="mb-2 px-1 text-sm font-bold text-purple-500">{index + 1}. {label}</p>
              <ContentCard item={item} lang={lang} ordinal={index + 1} onClick={() => setSelectedId(item.id)} />
            </section>
          ))}
        </div>}
      <AnimatePresence>
        {selected && (selected.unlocked ? (
          <FileModal key={`${resetKey}:${section}:${selected.id}`} item={selected} userId="local-demo" canSubmitWork lang={lang}
            onClose={() => setSelectedId(null)} onSubmitted={async () => {}}
            onDownloadMaterial={openMaterial}
            onSubmitFile={async (_userId, itemId, file) => {
              patchItem(itemId, { submittedAt: new Date().toISOString(), submittedAttachmentName: file.name, homeworkStatus: 'submitted', studentResult: 'Submitted', starRating: null, checkedAt: null, reviewComment: null, teacherComment: null });
              setMessage(`Пример: «${file.name}» выбран, карточка переведена в состояние «Отправлено». Файл не загружался на сервер.`);
            }}
            onStartInteractive={item => {
              const now = new Date().toISOString();
              patchItem(item.id, { starRating: 4, interactiveScorePercent: 80, interactiveCompletedAt: now, submittedAt: now, checkedAt: now, reviewComment: 'Great work! You completed the practice.', homeworkStatus: 'reviewed', studentResult: 'Interactive completed' });
              setSelectedId(null);
              setMessage('Пример выполнения: результат 80%, четыре звезды. Это демонстрация состояния, настоящий урок не запускался.');
            }}
          />
        ) : <LockedModal key={`${section}:${selected.id}`} item={selected} lang={lang} onClose={() => setSelectedId(null)} />)}
      </AnimatePresence>
    </main>
  );
}
