import type { AssessmentQuestion, AssessmentRecommendation } from './types';

export const mockAssessmentQuestions: AssessmentQuestion[] = [
  {
    id: 'q1',
    type: 'image_choice',
    prompt: {
      ru: 'Выбери apple',
      ua: 'Обери apple',
      en: 'Choose apple',
    },
    helper: {
      ru: 'Нажми на картинку, которая подходит к слову.',
      ua: 'Натисни на картинку, яка підходить до слова.',
      en: 'Tap the picture that matches the word.',
    },
    correctOptionId: 'apple',
    options: [
      { id: 'apple', label: { ru: 'Яблоко', ua: 'Яблуко', en: 'Apple' }, visual: '🍎' },
      { id: 'banana', label: { ru: 'Банан', ua: 'Банан', en: 'Banana' }, visual: '🍌' },
      { id: 'car', label: { ru: 'Машина', ua: 'Машина', en: 'Car' }, visual: '🚗' },
    ],
  },
  {
    id: 'q2',
    type: 'vocabulary_choice',
    prompt: {
      ru: 'Как по-английски "кот"?',
      ua: 'Як англійською "кіт"?',
      en: 'How do we say "cat" in English?',
    },
    correctOptionId: 'cat',
    options: [
      { id: 'dog', label: { ru: 'dog', ua: 'dog', en: 'dog' } },
      { id: 'cat', label: { ru: 'cat', ua: 'cat', en: 'cat' } },
      { id: 'fish', label: { ru: 'fish', ua: 'fish', en: 'fish' } },
    ],
  },
  {
    id: 'q3',
    type: 'missing_letter',
    prompt: {
      ru: 'Вставь пропущенную букву: d_g',
      ua: 'Встав пропущену літеру: d_g',
      en: 'Choose the missing letter: d_g',
    },
    correctOptionId: 'o',
    options: [
      { id: 'a', label: { ru: 'a', ua: 'a', en: 'a' } },
      { id: 'o', label: { ru: 'o', ua: 'o', en: 'o' } },
      { id: 'e', label: { ru: 'e', ua: 'e', en: 'e' } },
    ],
  },
  {
    id: 'q4',
    type: 'simple_sentence',
    prompt: {
      ru: 'Выбери правильное предложение.',
      ua: 'Обери правильне речення.',
      en: 'Choose the correct sentence.',
    },
    correctOptionId: 'i-like-blue',
    options: [
      { id: 'i-like-blue', label: { ru: 'I like blue.', ua: 'I like blue.', en: 'I like blue.' } },
      { id: 'blue like I', label: { ru: 'Blue like I.', ua: 'Blue like I.', en: 'Blue like I.' } },
      { id: 'like blue i', label: { ru: 'Like blue I.', ua: 'Like blue I.', en: 'Like blue I.' } },
    ],
  },
  {
    id: 'q5',
    type: 'image_choice',
    prompt: {
      ru: 'Где находится sun?',
      ua: 'Де знаходиться sun?',
      en: 'Where is the sun?',
    },
    correctOptionId: 'sun',
    options: [
      { id: 'moon', label: { ru: 'Луна', ua: 'Місяць', en: 'Moon' }, visual: '🌙' },
      { id: 'star', label: { ru: 'Звезда', ua: 'Зірка', en: 'Star' }, visual: '⭐' },
      { id: 'sun', label: { ru: 'Солнце', ua: 'Сонце', en: 'Sun' }, visual: '☀️' },
    ],
  },
  {
    id: 'q6',
    type: 'vocabulary_choice',
    prompt: {
      ru: 'Что значит "small"?',
      ua: 'Що означає "small"?',
      en: 'What does "small" mean?',
    },
    correctOptionId: 'small',
    options: [
      { id: 'small', label: { ru: 'маленький', ua: 'маленький', en: 'little' } },
      { id: 'fast', label: { ru: 'быстрый', ua: 'швидкий', en: 'fast' } },
      { id: 'red', label: { ru: 'красный', ua: 'червоний', en: 'red' } },
    ],
  },
  {
    id: 'q7',
    type: 'missing_letter',
    prompt: {
      ru: 'Вставь пропущенную букву: b_ll',
      ua: 'Встав пропущену літеру: b_ll',
      en: 'Choose the missing letter: b_ll',
    },
    correctOptionId: 'a',
    options: [
      { id: 'i', label: { ru: 'i', ua: 'i', en: 'i' } },
      { id: 'a', label: { ru: 'a', ua: 'a', en: 'a' } },
      { id: 'u', label: { ru: 'u', ua: 'u', en: 'u' } },
    ],
  },
  {
    id: 'q8',
    type: 'simple_sentence',
    prompt: {
      ru: 'Выбери ответ на вопрос: How are you?',
      ua: 'Обери відповідь на питання: How are you?',
      en: 'Choose the answer: How are you?',
    },
    correctOptionId: 'fine',
    options: [
      { id: 'fine', label: { ru: 'I am fine.', ua: 'I am fine.', en: 'I am fine.' } },
      { id: 'seven', label: { ru: 'I am seven.', ua: 'I am seven.', en: 'I am seven.' } },
      { id: 'blue', label: { ru: 'It is blue.', ua: 'It is blue.', en: 'It is blue.' } },
    ],
  },
  {
    id: 'q9',
    type: 'image_choice',
    prompt: {
      ru: 'Выбери book',
      ua: 'Обери book',
      en: 'Choose book',
    },
    correctOptionId: 'book',
    options: [
      { id: 'pencil', label: { ru: 'Карандаш', ua: 'Олівець', en: 'Pencil' }, visual: '✏️' },
      { id: 'book', label: { ru: 'Книга', ua: 'Книга', en: 'Book' }, visual: '📚' },
      { id: 'ball', label: { ru: 'Мяч', ua: 'Мʼяч', en: 'Ball' }, visual: '⚽' },
    ],
  },
  {
    id: 'q10',
    type: 'simple_sentence',
    prompt: {
      ru: 'Что подходит к картинке: 🐶',
      ua: 'Що підходить до картинки: 🐶',
      en: 'What matches the picture: 🐶',
    },
    correctOptionId: 'dog',
    options: [
      { id: 'dog', label: { ru: 'This is a dog.', ua: 'This is a dog.', en: 'This is a dog.' } },
      { id: 'cat', label: { ru: 'This is a cat.', ua: 'This is a cat.', en: 'This is a cat.' } },
      { id: 'bird', label: { ru: 'This is a bird.', ua: 'This is a bird.', en: 'This is a bird.' } },
    ],
  },
];

export const mockTimeSlots = ['09:00', '10:00', '14:00', '17:30'];

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMockAvailableDates(base = new Date()) {
  return [2, 4, 5, 8, 10, 12, 15].map(offset => {
    const date = new Date(base);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return date;
  });
}

export function getMockRecommendation(age: number, score: number): AssessmentRecommendation {
  if (age <= 6) return 'Mini Kids';
  if (age <= 9) return score >= 6 ? 'Kids A1' : 'Kids Beginners';
  return score >= 6 ? 'Junior A1' : 'Junior Beginners';
}
