import DictionaryView from '../components/DictionaryView';
import type { DictWord } from '../lib/dictionary';
import type { DictionaryReviewProgress } from '../lib/dailyReview';

const previewWords: DictWord[] = [
  { id: 'demo-new', userId: 'demo', lesson: '', category: 'Food', word: 'Apple', translation: 'Яблоко', emoji: '🍎' },
  { id: 'demo-studying', userId: 'demo', lesson: '', category: 'Home', word: 'House', translation: 'Дом', emoji: '🏠' },
  { id: 'demo-reinforcing', userId: 'demo', lesson: '', category: 'Nature', word: 'Star', translation: 'Звезда', emoji: '⭐' },
  { id: 'demo-learned', userId: 'demo', lesson: '', category: 'School', word: 'Book', translation: 'Книга', emoji: '📘' },
];

const yesterday = new Date(Date.now() - 86_400_000).toISOString();
const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
const previewProgress: DictionaryReviewProgress[] = [
  { wordId: 'demo-studying', learnedAt: yesterday, lastReviewedAt: null, nextReviewAt: yesterday, reviewIntervalDays: 1, successCount: 0, errorCount: 0, mastery: 0, priority: 0, lastExerciseType: null },
  { wordId: 'demo-reinforcing', learnedAt: yesterday, lastReviewedAt: yesterday, nextReviewAt: yesterday, reviewIntervalDays: 1, successCount: 1, errorCount: 0, mastery: 40, priority: 0, lastExerciseType: 'translation' },
  { wordId: 'demo-learned', learnedAt: yesterday, lastReviewedAt: yesterday, nextReviewAt: tomorrow, reviewIntervalDays: 3, successCount: 4, errorCount: 0, mastery: 100, priority: 0, lastExerciseType: 'word_building' },
];

export default function DictionaryPreview() {
  return <main className="min-h-screen bg-gradient-to-br from-[#f8f0ff] via-[#fdf6ff] to-[#eef5ff] px-2 py-3 sm:px-5 sm:py-6">
    <div className="mx-auto max-w-[100rem]">
      <p className="mb-3 rounded-2xl border border-purple-100 bg-white/85 px-4 py-2 text-center font-body text-xs font-semibold text-purple-700 shadow-sm sm:mb-4 sm:text-sm">
        Демо словарика · тестовые слова · данные учеников не используются
      </p>
      <DictionaryView userId="public-dictionary-preview" lang="ru" previewWords={previewWords} previewProgress={previewProgress} />
    </div>
  </main>;
}
