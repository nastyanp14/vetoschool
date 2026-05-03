// Lesson and homework data for the dashboard
export interface Lesson {
  id: string;
  title: string;
  topic: string;
  duration: string;
  level: 'Beginner' | 'Elementary' | 'Pre-Intermediate';
  completed: boolean;
  locked: boolean;
  emoji: string;
}

export interface Homework {
  id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'submitted' | 'graded';
  grade?: number;
  emoji: string;
  imageUrl?: string;
}

export interface GrammarItem {
  id: string;
  title: string;
  description: string;
  example: string;
  emoji: string;
}

export interface PracticeItem {
  id: string;
  title: string;
  description: string;
  type: string;
  emoji: string;
}

export const lessons: Lesson[] = [
  {
    id: 'l1',
    title: 'Lesson 1: Welcome to the World of Colors! 🎨🇬🇧',
    topic: 'Colors vocabulary & basic greetings',
    duration: '60 min',
    level: 'Beginner',
    completed: false,
    locked: false,
    emoji: '🎨',
  },
  {
    id: 'l2',
    title: 'Lesson 2: Numbers & Toys! 🔢🧸',
    topic: 'Numbers 1–10 & toy vocabulary',
    duration: '60 min',
    level: 'Beginner',
    completed: false,
    locked: false,
    emoji: '🔢',
  },
];

export const homework: Homework[] = [
  {
    id: 'h1',
    title: 'Home Task 1: Colors 🎨✨',
    dueDate: '2026-05-02',
    status: 'pending',
    emoji: '🎨',
    imageUrl: '/uploads/upload_1.PNG',
  },
  {
    id: 'h2',
    title: 'Home Task 2: Numbers & Toys 🔢🧸',
    dueDate: '2026-05-09',
    status: 'pending',
    emoji: '🔢',
    imageUrl: '/uploads/upload_1.PNG',
  },
];

export const grammarItems: GrammarItem[] = [
  {
    id: 'g1',
    title: 'Articles: a / an',
    description: 'Use "a" before consonant sounds, "an" before vowel sounds.',
    example: 'a cat 🐱 / an apple 🍎',
    emoji: '📖',
  },
  {
    id: 'g2',
    title: 'Colors as adjectives',
    description: 'Colors describe nouns and come before the noun.',
    example: 'a red ball 🔴 / a blue sky 🔵',
    emoji: '🎨',
  },
  {
    id: 'g3',
    title: 'Numbers 1–10',
    description: 'Cardinal numbers used for counting objects.',
    example: 'one toy 🧸 / three cats 🐱🐱🐱',
    emoji: '🔢',
  },
];

export const practiceItems: PracticeItem[] = [
  {
    id: 'p1',
    title: 'Color Matching',
    description: 'Match the color words to the correct pictures',
    type: 'Matching',
    emoji: '🌈',
  },
  {
    id: 'p2',
    title: 'Count the Toys',
    description: 'Count the toys and write the correct number',
    type: 'Writing',
    emoji: '🧸',
  },
  {
    id: 'p3',
    title: 'Spell the Color',
    description: 'Listen and spell the color you hear',
    type: 'Listening',
    emoji: '🎧',
  },
];

export const grades = [
  { subject: 'Listening', score: 0, emoji: '👂' },
  { subject: 'Speaking', score: 0, emoji: '🗣️' },
  { subject: 'Reading', score: 0, emoji: '📖' },
  { subject: 'Writing', score: 0, emoji: '✏️' },
  { subject: 'Vocabulary', score: 0, emoji: '📚' },
  { subject: 'Grammar', score: 0, emoji: '📝' },
];
