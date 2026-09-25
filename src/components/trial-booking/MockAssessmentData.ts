import type { AssessmentQuestion, AssessmentRecommendation } from './types';

const englishOptions = (...values: string[]) => values.map(value => ({
  id: value,
  label: { ru: value, ua: value, en: value },
}));

// The existing general assessment remains available for children whose dedicated
// age-specific version has not been supplied yet.
export const legacyAssessmentQuestions: AssessmentQuestion[] = [
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
      ru: 'Как по-английски “кот”?',
      ua: 'Як англійською “кіт”?',
      en: 'How do we say “cat” in English?',
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
      ru: 'Что значит “small”?',
      ua: 'Що означає “small”?',
      en: 'What does “small” mean?',
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

export const miniKids56AssessmentQuestions: AssessmentQuestion[] = [
  {
    id: 'mini-q1', type: 'image_choice', correctOptionId: 'apple',
    prompt: { ru: 'Выбери apple', ua: 'Обери apple', en: 'Choose apple' },
    helper: { ru: 'Нажми на картинку, которая подходит к слову.', ua: 'Натисни на картинку, яка підходить до слова.', en: 'Tap the picture that matches the word.' },
    options: [
      { id: 'apple', label: { ru: 'Яблоко', ua: 'Яблуко', en: 'Apple' }, visual: '/trial-booking/apple-sticker.png' },
      { id: 'banana', label: { ru: 'Банан', ua: 'Банан', en: 'Banana' }, visual: '/trial-booking/banana-sticker.png' },
      { id: 'car', label: { ru: 'Машина', ua: 'Машина', en: 'Car' }, visual: '/trial-booking/car-sticker.png' },
    ],
  },
  {
    id: 'mini-q2', type: 'vocabulary_choice', correctOptionId: 'cat',
    prompt: { ru: 'Как по-английски “кот”?', ua: 'Як англійською “кіт”?', en: 'How do we say “cat” in English?' },
    options: ['dog', 'cat', 'fish'].map(word => ({ id: word, label: { ru: word, ua: word, en: word } })),
  },
  {
    id: 'mini-q3', type: 'missing_letter', correctOptionId: 'o',
    prompt: { ru: 'Вставь пропущенную букву: d_g', ua: 'Встав пропущену літеру: d_g', en: 'Choose the missing letter: d_g' },
    options: ['a', 'o', 'e'].map(letter => ({ id: letter, label: { ru: letter, ua: letter, en: letter } })),
  },
  {
    id: 'mini-q4', type: 'image_choice', correctOptionId: 'ball',
    prompt: { ru: 'Выбери ball', ua: 'Обери ball', en: 'Choose ball' },
    options: [
      { id: 'bear', label: { ru: 'Мишка', ua: 'Ведмедик', en: 'Teddy bear' }, visual: '/trial-booking/bear-sticker.png' },
      { id: 'ball', label: { ru: 'Мяч', ua: 'М’яч', en: 'Ball' }, visual: '/trial-booking/ball-sticker.png' },
      { id: 'train', label: { ru: 'Поезд', ua: 'Потяг', en: 'Train' }, visual: '/trial-booking/train-sticker.png' },
    ],
  },
  {
    id: 'mini-q5', type: 'vocabulary_choice', correctOptionId: 'small',
    prompt: { ru: 'Что значит “small”?', ua: 'Що означає “small”?', en: 'What does “small” mean?' },
    options: [
      { id: 'big', label: { ru: 'большой', ua: 'великий', en: 'big' } },
      { id: 'small', label: { ru: 'маленький', ua: 'маленький', en: 'small' } },
      { id: 'long', label: { ru: 'длинный', ua: 'довгий', en: 'long' } },
    ],
  },
  {
    id: 'mini-q6', type: 'image_choice', correctOptionId: 'blue-balloon',
    prompt: { ru: 'Выбери blue', ua: 'Обери blue', en: 'Choose blue' },
    helper: { ru: 'Выбери голубой воздушный шар.', ua: 'Обери блакитну повітряну кульку.', en: 'Choose the blue balloon.' },
    options: [
      { id: 'red-balloon', label: { ru: 'Красный шар', ua: 'Червона кулька', en: 'Red balloon' }, visual: '/trial-booking/red-balloon-sticker.png' },
      { id: 'blue-balloon', label: { ru: 'Голубой шар', ua: 'Блакитна кулька', en: 'Blue balloon' }, visual: '/trial-booking/blue-balloon-sticker.png' },
      { id: 'yellow-balloon', label: { ru: 'Жёлтый шар', ua: 'Жовта кулька', en: 'Yellow balloon' }, visual: '/trial-booking/yellow-balloon-sticker.png' },
    ],
  },
  {
    id: 'mini-q7', type: 'image_choice', correctOptionId: 'three-stars',
    prompt: { ru: 'Выбери three stars', ua: 'Обери three stars', en: 'Choose three stars' },
    options: [
      { id: 'two-stars', label: { ru: 'Две звезды', ua: 'Дві зірки', en: 'Two stars' }, visual: Array(2).fill('/dashboard/rating-user-star.png?v=20260815') },
      { id: 'three-stars', label: { ru: 'Три звезды', ua: 'Три зірки', en: 'Three stars' }, visual: Array(3).fill('/dashboard/rating-user-star.png?v=20260815') },
      { id: 'four-stars', label: { ru: 'Четыре звезды', ua: 'Чотири зірки', en: 'Four stars' }, visual: Array(4).fill('/dashboard/rating-user-star.png?v=20260815') },
    ],
  },
  {
    id: 'mini-q8', type: 'simple_sentence', correctOptionId: 'fine',
    prompt: { ru: 'Выбери ответ на вопрос: How are you?', ua: 'Обери відповідь на питання: How are you?', en: 'Choose the answer: How are you?' },
    options: [
      { id: 'fine', label: { ru: 'I’m fine!', ua: 'I’m fine!', en: 'I’m fine!' } },
      { id: 'tom', label: { ru: 'My name is Tom.', ua: 'My name is Tom.', en: 'My name is Tom.' } },
      { id: 'goodbye', label: { ru: 'Goodbye!', ua: 'Goodbye!', en: 'Goodbye!' } },
    ],
  },
  {
    id: 'mini-q9', type: 'simple_sentence', correctOptionId: 'cat',
    prompt: { ru: 'Что подходит к картинке?', ua: 'Що підходить до картинки?', en: 'What matches the picture?' },
    illustration: '/trial-booking/cat-sentence.png',
    options: ['cat', 'dog', 'apple'].map(word => ({ id: word, label: { ru: `This is a ${word}.`, ua: `This is a ${word}.`, en: `This is a ${word}.` } })),
  },
  {
    id: 'mini-q10', type: 'simple_sentence', correctOptionId: 'i-like-blue',
    prompt: { ru: 'Выбери правильное предложение.', ua: 'Обери правильне речення.', en: 'Choose the correct sentence.' },
    options: [
      { id: 'i-like-blue', label: { ru: 'I like blue.', ua: 'I like blue.', en: 'I like blue.' } },
      { id: 'blue-like-i', label: { ru: 'Blue like I.', ua: 'Blue like I.', en: 'Blue like I.' } },
      { id: 'like-blue-i', label: { ru: 'Like blue I.', ua: 'Like blue I.', en: 'Like blue I.' } },
    ],
  },
  {
    id: 'mini-q11', type: 'simple_sentence', correctOptionId: 'am',
    prompt: { ru: 'Выбери правильное слово: I ___ six.', ua: 'Обери правильне слово: I ___ six.', en: 'Choose the correct word: I ___ six.' },
    options: ['am', 'is', 'are'].map(word => ({ id: word, label: { ru: word, ua: word, en: word } })),
  },
  {
    id: 'mini-q12', type: 'simple_sentence', correctOptionId: 'fly',
    prompt: { ru: 'Выбери правильное предложение', ua: 'Обери правильне речення', en: 'Choose the correct sentence' },
    illustration: '/trial-booking/bird-sentence.png',
    options: [
      { id: 'fly', label: { ru: 'A bird can fly.', ua: 'A bird can fly.', en: 'A bird can fly.' } },
      { id: 'read', label: { ru: 'A bird can read.', ua: 'A bird can read.', en: 'A bird can read.' } },
      { id: 'drive', label: { ru: 'A bird can drive.', ua: 'A bird can drive.', en: 'A bird can drive.' } },
    ],
  },
];

export const kids79AssessmentQuestions: AssessmentQuestion[] = [
  {
    id: 'kids-q1', type: 'image_choice', correctOptionId: 'kitchen',
    prompt: { ru: 'Выбери kitchen', ua: 'Обери kitchen', en: 'Choose kitchen' },
    options: [
      { id: 'bedroom', label: { ru: 'Спальня', ua: 'Спальня', en: 'Bedroom' }, visual: '/trial-booking/bedroom-sticker.png' },
      { id: 'kitchen', label: { ru: 'Кухня', ua: 'Кухня', en: 'Kitchen' }, visual: '/trial-booking/kitchen-sticker.png' },
      { id: 'bathroom', label: { ru: 'Ванная', ua: 'Ванна кімната', en: 'Bathroom' }, visual: '/trial-booking/bathroom-sticker.png' },
    ],
  },
  {
    id: 'kids-q2', type: 'vocabulary_choice', correctOptionId: 'window',
    prompt: { ru: 'Как по-английски “окно”?', ua: 'Як англійською “вікно”?', en: 'How do we say “window” in English?' },
    options: ['door', 'window', 'wall'].map(word => ({ id: word, label: { ru: word, ua: word, en: word } })),
  },
  {
    id: 'kids-q3', type: 'missing_letter', correctOptionId: 'oo',
    prompt: { ru: 'Вставь пропущенные буквы: sch__l', ua: 'Встав пропущені літери: sch__l', en: 'Choose the missing letters: sch__l' },
    options: ['oo', 'oa', 'ee'].map(letters => ({ id: letters, label: { ru: letters, ua: letters, en: letters } })),
  },
  {
    id: 'kids-q4', type: 'vocabulary_choice', correctOptionId: 'grandmother',
    prompt: { ru: 'Кто такая “grandmother”?', ua: 'Хто така “grandmother”?', en: 'Who is “grandmother”?' },
    options: [
      { id: 'grandmother', label: { ru: 'бабушка', ua: 'бабуся', en: 'grandmother' } },
      { id: 'sister', label: { ru: 'сестра', ua: 'сестра', en: 'sister' } },
      { id: 'mother', label: { ru: 'мама', ua: 'мама', en: 'mother' } },
    ],
  },
  {
    id: 'kids-q5', type: 'vocabulary_choice', correctOptionId: 'hungry',
    prompt: { ru: 'Что значит “hungry”?', ua: 'Що означає “hungry”?', en: 'What does “hungry” mean?' },
    options: [
      { id: 'hungry', label: { ru: 'голодный', ua: 'голодний', en: 'hungry' } },
      { id: 'tired', label: { ru: 'уставший', ua: 'втомлений', en: 'tired' } },
      { id: 'happy', label: { ru: 'весёлый', ua: 'веселий', en: 'happy' } },
    ],
  },
  {
    id: 'kids-q6', type: 'image_choice', correctOptionId: 'jumping',
    prompt: { ru: 'Выбери jumping', ua: 'Обери jumping', en: 'Choose jumping' },
    options: [
      { id: 'running', label: { ru: 'Ребёнок бежит', ua: 'Дитина біжить', en: 'Running' }, visual: '/trial-booking/owl-running-sticker.png' },
      { id: 'jumping', label: { ru: 'Ребёнок прыгает', ua: 'Дитина стрибає', en: 'Jumping' }, visual: '/trial-booking/owl-jumping-sticker.png' },
      { id: 'sleeping', label: { ru: 'Ребёнок спит', ua: 'Дитина спить', en: 'Sleeping' }, visual: '/trial-booking/owl-sleeping-sticker.png' },
    ],
  },
  {
    id: 'kids-q7', type: 'simple_sentence', correctOptionId: 'rainy',
    prompt: { ru: 'Выбери правильное предложение', ua: 'Обери правильне речення', en: 'Choose the correct sentence' },
    illustration: '/trial-booking/rainy-weather-sticker.png',
    options: [
      { id: 'rainy', label: { ru: 'It is rainy.', ua: 'It is rainy.', en: 'It is rainy.' } },
      { id: 'sunny', label: { ru: 'It is sunny.', ua: 'It is sunny.', en: 'It is sunny.' } },
      { id: 'hot', label: { ru: 'It is hot.', ua: 'It is hot.', en: 'It is hot.' } },
    ],
  },
  {
    id: 'kids-q8', type: 'vocabulary_choice', correctOptionId: 'tuesday',
    prompt: { ru: 'What day comes after Monday?', ua: 'What day comes after Monday?', en: 'What day comes after Monday?' },
    options: ['Sunday', 'Tuesday', 'Friday'].map(day => ({ id: day.toLowerCase(), label: { ru: day, ua: day, en: day } })),
  },
  {
    id: 'kids-q9', type: 'simple_sentence', correctOptionId: 'two-children',
    prompt: { ru: 'Выбери правильный вариант', ua: 'Обери правильний варіант', en: 'Choose the correct option' },
    illustration: '/trial-booking/two-owls-sticker.png',
    options: [
      { id: 'two-child', label: { ru: 'two child', ua: 'two child', en: 'two child' } },
      { id: 'two-childs', label: { ru: 'two childs', ua: 'two childs', en: 'two childs' } },
      { id: 'two-children', label: { ru: 'two children', ua: 'two children', en: 'two children' } },
    ],
  },
  {
    id: 'kids-q10', type: 'simple_sentence', correctOptionId: 'are',
    prompt: { ru: 'Выбери правильное слово: They ___ in the classroom.', ua: 'Обери правильне слово: They ___ in the classroom.', en: 'Choose the correct word: They ___ in the classroom.' },
    options: ['am', 'is', 'are'].map(word => ({ id: word, label: { ru: word, ua: word, en: word } })),
  },
  {
    id: 'kids-q11', type: 'simple_sentence', correctOptionId: 'isnt-sad',
    prompt: { ru: 'Выбери правильное предложение.', ua: 'Обери правильне речення.', en: 'Choose the correct sentence.' },
    options: [
      { id: 'not-is-sad', label: { ru: 'Tom not is sad.', ua: 'Tom not is sad.', en: 'Tom not is sad.' } },
      { id: 'isnt-sad', label: { ru: 'Tom isn’t sad.', ua: 'Tom isn’t sad.', en: 'Tom isn’t sad.' } },
      { id: 'dont-sad', label: { ru: 'Tom don’t sad.', ua: 'Tom don’t sad.', en: 'Tom don’t sad.' } },
    ],
  },
  {
    id: 'kids-q12', type: 'simple_sentence', correctOptionId: 'is-she-teacher',
    prompt: { ru: 'Выбери правильный вопрос.', ua: 'Обери правильне питання.', en: 'Choose the correct question.' },
    options: [
      { id: 'is-she-teacher', label: { ru: 'Is she your teacher?', ua: 'Is she your teacher?', en: 'Is she your teacher?' } },
      { id: 'she-is-teacher', label: { ru: 'She is your teacher?', ua: 'She is your teacher?', en: 'She is your teacher?' } },
      { id: 'are-she-teacher', label: { ru: 'Are she your teacher?', ua: 'Are she your teacher?', en: 'Are she your teacher?' } },
    ],
  },
  {
    id: 'kids-q13', type: 'simple_sentence', correctOptionId: 'has-got',
    prompt: { ru: 'Выбери правильное предложение.', ua: 'Обери правильне речення.', en: 'Choose the correct sentence.' },
    options: [
      { id: 'have-got', label: { ru: 'Anna have got a brother.', ua: 'Anna have got a brother.', en: 'Anna have got a brother.' } },
      { id: 'has-got', label: { ru: 'Anna has got a brother.', ua: 'Anna has got a brother.', en: 'Anna has got a brother.' } },
      { id: 'is-got', label: { ru: 'Anna is got a brother.', ua: 'Anna is got a brother.', en: 'Anna is got a brother.' } },
    ],
  },
  {
    id: 'kids-q14', type: 'simple_sentence', correctOptionId: 'cant-walk',
    prompt: { ru: 'Выбери правильное предложение', ua: 'Обери правильне речення', en: 'Choose the correct sentence' },
    illustration: '/trial-booking/fish-sticker.png',
    options: [
      { id: 'can-walk', label: { ru: 'A fish can walk.', ua: 'A fish can walk.', en: 'A fish can walk.' } },
      { id: 'cant-swim', label: { ru: 'A fish can’t swim.', ua: 'A fish can’t swim.', en: 'A fish can’t swim.' } },
      { id: 'cant-walk', label: { ru: 'A fish can’t walk.', ua: 'A fish can’t walk.', en: 'A fish can’t walk.' } },
    ],
  },
  {
    id: 'kids-q15', type: 'simple_sentence', correctOptionId: 'her',
    prompt: { ru: 'Emma has a book. It is ___ book.', ua: 'Emma has a book. It is ___ book.', en: 'Emma has a book. It is ___ book.' },
    options: ['she', 'her', 'he'].map(word => ({ id: word, label: { ru: word, ua: word, en: word } })),
  },
  {
    id: 'kids-q16', type: 'simple_sentence', correctOptionId: 'works',
    prompt: { ru: 'Выбери правильное слово: My dad ___ in a hospital.', ua: 'Обери правильне слово: My dad ___ in a hospital.', en: 'Choose the correct word: My dad ___ in a hospital.' },
    options: ['work', 'works', 'working'].map(word => ({ id: word, label: { ru: word, ua: word, en: word } })),
  },
  {
    id: 'kids-q17', type: 'simple_sentence', correctOptionId: 'does-he-play',
    prompt: { ru: 'Выбери правильный вопрос.', ua: 'Обери правильне питання.', en: 'Choose the correct question.' },
    options: [
      { id: 'does-he-play', label: { ru: 'Does he play tennis?', ua: 'Does he play tennis?', en: 'Does he play tennis?' } },
      { id: 'do-he-play', label: { ru: 'Do he play tennis?', ua: 'Do he play tennis?', en: 'Do he play tennis?' } },
      { id: 'does-he-plays', label: { ru: 'Does he plays tennis?', ua: 'Does he plays tennis?', en: 'Does he plays tennis?' } },
    ],
  },
  {
    id: 'kids-q18', type: 'simple_sentence', correctOptionId: 'there-are',
    prompt: { ru: 'Выбери правильное предложение', ua: 'Обери правильне речення', en: 'Choose the correct sentence' },
    illustration: '/trial-booking/pencils-table-sticker.png',
    options: [
      { id: 'there-is', label: { ru: 'There is three pencils on the table.', ua: 'There is three pencils on the table.', en: 'There is three pencils on the table.' } },
      { id: 'there-are', label: { ru: 'There are three pencils on the table.', ua: 'There are three pencils on the table.', en: 'There are three pencils on the table.' } },
      { id: 'pencils-is', label: { ru: 'Three pencils is on the table.', ua: 'Three pencils is on the table.', en: 'Three pencils is on the table.' } },
    ],
  },
  {
    id: 'kids-q19', type: 'audio_choice', correctOptionId: 'between-boxes', audioText: 'The ball is between the boxes.', audioSrc: '/trial-booking/ball-between-boxes.mp3',
    prompt: { ru: 'Прослушай фразу и выбери правильную картинку.', ua: 'Прослухай фразу та обери правильну картинку.', en: 'Listen to the sentence and choose the correct picture.' },
    options: [
      { id: 'on-box', label: { ru: 'Мяч на коробке', ua: 'М’яч на коробці', en: 'Ball on a box' }, visual: '/trial-booking/ball-on-box.png' },
      { id: 'between-boxes', label: { ru: 'Мяч между коробками', ua: 'М’яч між коробками', en: 'Ball between boxes' }, visual: '/trial-booking/ball-between-boxes.png' },
      { id: 'under-box', label: { ru: 'Мяч под коробкой', ua: 'М’яч під коробкою', en: 'Ball under a box' }, visual: '/trial-booking/ball-under-box.png' },
    ],
  },
  {
    id: 'kids-q20', type: 'simple_sentence', correctOptionId: 'plays-football',
    prompt: { ru: 'Leo is nine. He lives with his mum, dad and sister. After school, Leo plays football with his friends. His sister likes drawing.\n\nWhat does Leo do after school?', ua: 'Leo is nine. He lives with his mum, dad and sister. After school, Leo plays football with his friends. His sister likes drawing.\n\nWhat does Leo do after school?', en: 'Leo is nine. He lives with his mum, dad and sister. After school, Leo plays football with his friends. His sister likes drawing.\n\nWhat does Leo do after school?' },
    options: [
      { id: 'draws-pictures', label: { ru: 'He draws pictures.', ua: 'He draws pictures.', en: 'He draws pictures.' } },
      { id: 'plays-football', label: { ru: 'He plays football.', ua: 'He plays football.', en: 'He plays football.' } },
      { id: 'reads-books', label: { ru: 'He reads books.', ua: 'He reads books.', en: 'He reads books.' } },
    ],
  },
];

export const junior1012AssessmentQuestions: AssessmentQuestion[] = [
  { id: 'junior-q1', type: 'image_choice', correctOptionId: 'library', prompt: { ru: 'Выбери library', ua: 'Обери library', en: 'Choose library' }, options: [
    { id: 'library', label: { ru: 'Библиотека', ua: 'Бібліотека', en: 'Library' }, visual: '/trial-booking/library-sticker.png' }, { id: 'shop', label: { ru: 'Магазин', ua: 'Магазин', en: 'Shop' }, visual: '/trial-booking/shop-sticker.png' }, { id: 'hospital', label: { ru: 'Больница', ua: 'Лікарня', en: 'Hospital' }, visual: '/trial-booking/hospital-sticker.png' },
  ] },
  { id: 'junior-q2', type: 'vocabulary_choice', correctOptionId: 'usually', prompt: { ru: 'Что значит “usually”?', ua: 'Що означає “usually”?', en: 'What does “usually” mean?' }, options: [
    { id: 'never', label: { ru: 'никогда', ua: 'ніколи', en: 'never' } }, { id: 'usually', label: { ru: 'обычно', ua: 'зазвичай', en: 'usually' } }, { id: 'now', label: { ru: 'сейчас', ua: 'зараз', en: 'now' } },
  ] },
  { id: 'junior-q3', type: 'vocabulary_choice', correctOptionId: 'breakfast', prompt: { ru: 'Как по-английски “завтрак”?', ua: 'Як англійською “сніданок”?', en: 'How do we say “breakfast” in English?' }, options: englishOptions('dinner', 'breakfast', 'lunch') },
  { id: 'junior-q4', type: 'missing_letter', correctOptionId: 'a', prompt: { ru: 'Вставь пропущенную букву: f_mily', ua: 'Встав пропущену літеру: f_mily', en: 'Choose the missing letter: f_mily' }, options: englishOptions('a', 'e', 'i') },
  { id: 'junior-q5', type: 'vocabulary_choice', correctOptionId: 'cheap', helper: { ru: 'Выбери противоположное по значению слово', ua: 'Обери слово з протилежним значенням', en: 'Choose the opposite word' }, prompt: { ru: 'Выбери противоположное слово: expensive — ___', ua: 'Обери протилежне слово: expensive — ___', en: 'Choose the opposite word: expensive — ___' }, options: englishOptions('cheap', 'beautiful', 'difficult') },
  { id: 'junior-q6', type: 'simple_sentence', correctOptionId: 'We', prompt: { ru: 'Ben and I are friends. ___ play together.', ua: 'Ben and I are friends. ___ play together.', en: 'Ben and I are friends. ___ play together.' }, options: englishOptions('They', 'We', 'You') },
  { id: 'junior-q7', type: 'simple_sentence', correctOptionId: 'their', prompt: { ru: 'Tom and Mia live here. This is ___ house.', ua: 'Tom and Mia live here. This is ___ house.', en: 'Tom and Mia live here. This is ___ house.' }, options: englishOptions('their', 'our', 'his') },
  { id: 'junior-q8', type: 'simple_sentence', correctOptionId: 'goes', prompt: { ru: 'Lisa ___ to school every day.', ua: 'Lisa ___ to school every day.', en: 'Lisa ___ to school every day.' }, options: englishOptions('go', 'goes', 'going') },
  { id: 'junior-q9', type: 'simple_sentence', correctOptionId: 'We don’t watch TV in the morning.', prompt: { ru: 'Выбери правильное предложение.', ua: 'Обери правильне речення.', en: 'Choose the correct sentence.' }, options: englishOptions('We doesn’t watch TV in the morning.', 'We don’t watch TV in the morning.', 'We not watch TV in the morning.') },
  { id: 'junior-q10', type: 'simple_sentence', correctOptionId: 'Does your friend like music?', prompt: { ru: 'Выбери правильный вопрос.', ua: 'Обери правильне питання.', en: 'Choose the correct question.' }, options: englishOptions('Does your friend like music?', 'Do your friend likes music?', 'Does your friend likes music?') },
  { id: 'junior-q11', type: 'simple_sentence', correctOptionId: 'is sleeping', prompt: { ru: 'Look! The baby ___ now.', ua: 'Look! The baby ___ now.', en: 'Look! The baby ___ now.' }, options: englishOptions('sleeps', 'is sleeping', 'sleep') },
  { id: 'junior-q12', type: 'simple_sentence', correctOptionId: 'was', prompt: { ru: 'Yesterday I ___ at home.', ua: 'Yesterday I ___ at home.', en: 'Yesterday I ___ at home.' }, options: englishOptions('am', 'was', 'were') },
  { id: 'junior-q13', type: 'simple_sentence', correctOptionId: 'any', prompt: { ru: 'Are there ___ oranges in the fridge?', ua: 'Are there ___ oranges in the fridge?', en: 'Are there ___ oranges in the fridge?' }, options: englishOptions('some', 'any', 'a') },
  { id: 'junior-q14', type: 'simple_sentence', correctOptionId: 'I usually get up at seven.', prompt: { ru: 'Выбери правильное предложение.', ua: 'Обери правильне речення.', en: 'Choose the correct sentence.' }, options: englishOptions('I usually get up at seven.', 'Usually I at seven get up.', 'I get usually at seven up.') },
  { id: 'junior-q15', type: 'simple_sentence', correctOptionId: 'He is riding a bike.', prompt: { ru: 'Выбери предложение, которое описывает, что происходит сейчас', ua: 'Обери речення, яке описує, що відбувається зараз', en: 'Choose the sentence that describes what is happening now' }, illustration: '/trial-booking/owl-cycling-sticker.png', options: englishOptions('He rides a bike every day.', 'He is riding a bike.', 'He can riding a bike.') },
  { id: 'junior-q16', type: 'simple_sentence', correctOptionId: 'What time do you go to school?', prompt: { ru: 'Какой вопрос подходит к ответу “At eight o’clock”?', ua: 'Яке запитання підходить до відповіді “At eight o’clock”?', en: 'Which question matches the answer “At eight o’clock”?' }, options: englishOptions('Where do you go to school?', 'What time do you go to school?', 'How do you go to school?') },
  { id: 'junior-q17', type: 'simple_sentence', correctOptionId: 'Yes, please.', prompt: { ru: 'Выбери ответ: Would you like some juice?', ua: 'Обери відповідь: Would you like some juice?', en: 'Choose the answer: Would you like some juice?' }, options: englishOptions('Yes, please.', 'I am ten.', 'It is sunny.') },
  { id: 'junior-q18', type: 'simple_sentence', correctOptionId: 'At seven o’clock.', prompt: { ru: 'Emma lives in a small town. She gets up at seven o’clock and walks to school with her brother. Her favourite subject is Art because she loves drawing.\n\nWhat time does Emma get up?', ua: 'Emma lives in a small town. She gets up at seven o’clock and walks to school with her brother. Her favourite subject is Art because she loves drawing.\n\nWhat time does Emma get up?', en: 'Emma lives in a small town. She gets up at seven o’clock and walks to school with her brother. Her favourite subject is Art because she loves drawing.\n\nWhat time does Emma get up?' }, options: englishOptions('At six o’clock.', 'At seven o’clock.', 'At eight o’clock.') },
  { id: 'junior-q19', type: 'simple_sentence', correctOptionId: 'Because she loves drawing.', prompt: { ru: 'Emma lives in a small town. She gets up at seven o’clock and walks to school with her brother. Her favourite subject is Art because she loves drawing.\n\nWhy does Emma like Art?', ua: 'Emma lives in a small town. She gets up at seven o’clock and walks to school with her brother. Her favourite subject is Art because she loves drawing.\n\nWhy does Emma like Art?', en: 'Emma lives in a small town. She gets up at seven o’clock and walks to school with her brother. Her favourite subject is Art because she loves drawing.\n\nWhy does Emma like Art?' }, options: englishOptions('Because she loves drawing.', 'Because she likes running.', 'Because her brother likes it.') },
  { id: 'junior-q20', type: 'simple_sentence', correctOptionId: 'He visits his grandparents.', prompt: { ru: 'Sam visits his grandparents on Saturday. He helps them in the garden and plays with their dog. On Sunday, he stays at home and reads adventure books.\n\nWhat does Sam do on Saturday?', ua: 'Sam visits his grandparents on Saturday. He helps them in the garden and plays with their dog. On Sunday, he stays at home and reads adventure books.\n\nWhat does Sam do on Saturday?', en: 'Sam visits his grandparents on Saturday. He helps them in the garden and plays with their dog. On Sunday, he stays at home and reads adventure books.\n\nWhat does Sam do on Saturday?' }, options: englishOptions('He visits his grandparents.', 'He goes to school.', 'He stays at home.') },
  { id: 'junior-q21', type: 'simple_sentence', correctOptionId: 'Adventure books.', prompt: { ru: 'Sam visits his grandparents on Saturday. He helps them in the garden and plays with their dog. On Sunday, he stays at home and reads adventure books.\n\nWhat does Sam read on Sunday?', ua: 'Sam visits his grandparents on Saturday. He helps them in the garden and plays with their dog. On Sunday, he stays at home and reads adventure books.\n\nWhat does Sam read on Sunday?', en: 'Sam visits his grandparents on Saturday. He helps them in the garden and plays with their dog. On Sunday, he stays at home and reads adventure books.\n\nWhat does Sam read on Sunday?' }, options: englishOptions('School books.', 'Adventure books.', 'Comic books.') },
  { id: 'junior-q22', type: 'audio_choice', correctOptionId: 'next-to-lamp', audioText: 'The book is next to the lamp.', audioSrc: '/trial-booking/book-next-to-lamp.mp3', prompt: { ru: 'Прослушай фразу и выбери правильную картинку.', ua: 'Прослухай фразу та обери правильну картинку.', en: 'Listen to the sentence and choose the correct picture.' }, options: [
    { id: 'under-lamp', label: { ru: 'Книга под лампой', ua: 'Книга під лампою', en: 'Book under the lamp' }, visual: '/trial-booking/book-under-lamp.png' }, { id: 'next-to-lamp', label: { ru: 'Книга возле лампы', ua: 'Книга біля лампи', en: 'Book next to the lamp' }, visual: '/trial-booking/book-next-to-lamp.png' }, { id: 'in-cabinet', label: { ru: 'Книга в шкафу', ua: 'Книга в шафі', en: 'Book in a cupboard' }, visual: '/trial-booking/book-in-cabinet.png' },
  ] },
  { id: 'junior-q23', type: 'audio_choice', correctOptionId: 'two', audioText: 'Tom has two sisters and one brother.', audioSrc: '/trial-booking/tom-two-sisters.mp3', prompt: { ru: 'Прослушай фразу. How many sisters has Tom got?', ua: 'Прослухай фразу. How many sisters has Tom got?', en: 'Listen to the sentence. How many sisters has Tom got?' }, options: englishOptions('one', 'two', 'three') },
  { id: 'junior-q24', type: 'audio_choice', correctOptionId: 'jacket', audioText: 'It is cold and windy. Put on your jacket.', audioSrc: '/trial-booking/put-on-your-jacket.mp3', prompt: { ru: 'Прослушай фразу и выбери правильную одежду.', ua: 'Прослухай фразу та обери правильний одяг.', en: 'Listen to the sentence and choose the right clothes.' }, options: [
    { id: 'jacket', label: { ru: 'Куртка', ua: 'Куртка', en: 'Jacket' }, visual: '/trial-booking/clothing-jacket.png' }, { id: 't-shirt', label: { ru: 'Футболка', ua: 'Футболка', en: 'T-shirt' }, visual: '/trial-booking/clothing-t-shirt.png' }, { id: 'swimsuit', label: { ru: 'Купальник', ua: 'Купальник', en: 'Swimsuit' }, visual: '/trial-booking/clothing-swimsuit.png' },
  ] },
  { id: 'junior-q25', type: 'audio_choice', correctOptionId: 'three', audioText: 'On Saturday, Kate is going to visit her grandmother at three o’clock.', audioSrc: '/trial-booking/kate-visit-grandmother.mp3', prompt: { ru: 'Прослушай фразу. What time will Kate visit her grandmother?', ua: 'Прослухай фразу. What time will Kate visit her grandmother?', en: 'Listen to the sentence. What time will Kate visit her grandmother?' }, options: englishOptions('At two o’clock.', 'At three o’clock.', 'At five o’clock.') },
];

export type AssessmentTest = {
  testVersion: 'mini-kids-5-6-v1' | 'kids-7-9-v1' | 'junior-10-12-v1' | 'legacy-general-v1';
  ageGroup: 'Mini Kids 5–6' | 'Kids 7–9' | 'Juniors 10–12';
  questions: AssessmentQuestion[];
};

export function getAssessmentTestForAge(age: number): AssessmentTest {
  if (age >= 5 && age <= 6) {
    return {
      testVersion: 'mini-kids-5-6-v1',
      ageGroup: 'Mini Kids 5–6',
      questions: miniKids56AssessmentQuestions,
    };
  }
  if (age >= 7 && age <= 9) {
    return {
      testVersion: 'kids-7-9-v1',
      ageGroup: 'Kids 7–9',
      questions: kids79AssessmentQuestions,
    };
  }
  if (age >= 10 && age <= 12) {
    return {
      testVersion: 'junior-10-12-v1',
      ageGroup: 'Juniors 10–12',
      questions: junior1012AssessmentQuestions,
    };
  }
  return {
    testVersion: 'legacy-general-v1',
    ageGroup: age <= 9 ? 'Kids 7–9' : 'Juniors 10–12',
    questions: legacyAssessmentQuestions,
  };
}

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
  if (age <= 9) return score >= 13 ? 'Kids A1' : 'Kids Beginners';
  return score >= 15 ? 'Junior A1' : 'Junior Beginners';
}
