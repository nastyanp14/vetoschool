import type { CefrLevel, EnglishLevel } from '@/components/trial-booking/types';

export type AssessmentLevelDefinition = {
  minCorrectAnswers: number;
  level: EnglishLevel;
};

export type AssessmentLevelConfig = {
  ageRange: readonly [number, number];
  maxCefrLevel: CefrLevel;
  thresholds: readonly AssessmentLevelDefinition[];
};

export type EnglishLevelResult = {
  englishLevel: EnglishLevel;
  percentage: number;
};

const cefrRank: Record<CefrLevel, number> = {
  Starter: 0,
  'Pre-A1': 1,
  A1: 2,
  A2: 3,
  B1: 4,
  B2: 5,
};

const levelCefr: Record<EnglishLevel, CefrLevel> = {
  Starter: 'Starter',
  'Pre-A1': 'Pre-A1',
  'A1 Beginner': 'A1',
  'A1 Strong': 'A1',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
};

const cappedLevelByCefr: Record<CefrLevel, EnglishLevel> = {
  Starter: 'Starter',
  'Pre-A1': 'Pre-A1',
  A1: 'A1 Strong',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
};

// Each version owns its thresholds and CEFR ceiling. New age-specific tests
// only need another entry here; scoring itself remains in AssessmentStep.
export const assessmentLevelConfigs: Record<string, AssessmentLevelConfig> = {
  'mini-kids-5-6-v1': {
    ageRange: [5, 6],
    maxCefrLevel: 'A1',
    thresholds: [
      { minCorrectAnswers: 0, level: 'Starter' },
      { minCorrectAnswers: 4, level: 'Pre-A1' },
      { minCorrectAnswers: 8, level: 'A1 Beginner' },
      { minCorrectAnswers: 11, level: 'A1 Strong' },
    ],
  },
  'legacy-general-v1': {
    ageRange: [4, 16],
    maxCefrLevel: 'A1',
    thresholds: [
      { minCorrectAnswers: 0, level: 'Starter' },
      { minCorrectAnswers: 4, level: 'Pre-A1' },
      { minCorrectAnswers: 7, level: 'A1 Beginner' },
      { minCorrectAnswers: 9, level: 'A1 Strong' },
    ],
  },
  'kids-7-9-v1': {
    ageRange: [7, 9],
    maxCefrLevel: 'A1',
    thresholds: [
      { minCorrectAnswers: 0, level: 'Starter' },
      { minCorrectAnswers: 8, level: 'Pre-A1' },
      { minCorrectAnswers: 13, level: 'A1 Beginner' },
      { minCorrectAnswers: 17, level: 'A1 Strong' },
    ],
  },
  'junior-10-12-v1': {
    ageRange: [10, 12],
    maxCefrLevel: 'A1',
    thresholds: [
      { minCorrectAnswers: 0, level: 'Starter' },
      { minCorrectAnswers: 9, level: 'Pre-A1' },
      { minCorrectAnswers: 15, level: 'A1 Beginner' },
      { minCorrectAnswers: 21, level: 'A1 Strong' },
    ],
  },
};

export function determineEnglishLevel(
  age: number,
  correctAnswers: number,
  totalQuestions: number,
  testVersion: string,
): EnglishLevelResult {
  const config = assessmentLevelConfigs[testVersion];
  if (!config) throw new Error(`Unknown assessment test version: ${testVersion}`);
  if (!Number.isInteger(age) || age < config.ageRange[0] || age > config.ageRange[1]) {
    throw new Error(`Age ${age} is not supported by ${testVersion}`);
  }
  if (!Number.isInteger(correctAnswers) || !Number.isInteger(totalQuestions) || correctAnswers < 0 || totalQuestions < 1 || correctAnswers > totalQuestions) {
    throw new Error('Invalid assessment score');
  }

  const selected = [...config.thresholds]
    .sort((a, b) => a.minCorrectAnswers - b.minCorrectAnswers)
    .reduce<EnglishLevel>((level, threshold) => (
      correctAnswers >= threshold.minCorrectAnswers ? threshold.level : level
    ), config.thresholds[0].level);
  const englishLevel = cefrRank[levelCefr[selected]] > cefrRank[config.maxCefrLevel]
    ? cappedLevelByCefr[config.maxCefrLevel]
    : selected;

  return {
    englishLevel,
    percentage: Math.round((correctAnswers / totalQuestions) * 100),
  };
}
