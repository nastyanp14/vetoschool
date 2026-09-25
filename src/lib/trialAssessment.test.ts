import { describe, expect, it } from 'vitest';
import { getAssessmentTestForAge } from '@/components/trial-booking/MockAssessmentData';
import { determineEnglishLevel } from './trialAssessment';

describe('determineEnglishLevel', () => {
  it.each([
    [0, 'Starter'],
    [3, 'Starter'],
    [4, 'Pre-A1'],
    [7, 'Pre-A1'],
    [8, 'A1 Beginner'],
    [10, 'A1 Beginner'],
    [11, 'A1 Strong'],
    [12, 'A1 Strong'],
  ] as const)('assigns %s correct Mini Kids answers to %s', (correctAnswers, englishLevel) => {
    expect(determineEnglishLevel(5, correctAnswers, 12, 'mini-kids-5-6-v1')).toEqual({
      englishLevel,
      percentage: Math.round((correctAnswers / 12) * 100),
    });
  });

  it('does not permit the Mini Kids version to produce a level above A1', () => {
    expect(determineEnglishLevel(6, 12, 12, 'mini-kids-5-6-v1').englishLevel).toBe('A1 Strong');
  });

  it.each([
    [0, 'Starter'],
    [7, 'Starter'],
    [8, 'Pre-A1'],
    [12, 'Pre-A1'],
    [13, 'A1 Beginner'],
    [16, 'A1 Beginner'],
    [17, 'A1 Strong'],
    [20, 'A1 Strong'],
  ] as const)('assigns %s correct Kids 7–9 answers to %s', (correctAnswers, englishLevel) => {
    expect(determineEnglishLevel(7, correctAnswers, 20, 'kids-7-9-v1')).toEqual({
      englishLevel,
      percentage: Math.round((correctAnswers / 20) * 100),
    });
  });

  it('selects the dedicated 20-question Kids 7–9 test, including its listening task', () => {
    const test = getAssessmentTestForAge(8);
    expect(test.testVersion).toBe('kids-7-9-v1');
    expect(test.ageGroup).toBe('Kids 7–9');
    expect(test.questions).toHaveLength(20);
    expect(test.questions[18].audioText).toBe('The ball is between the boxes.');
  });

  it.each([
    [0, 'Starter'], [8, 'Starter'], [9, 'Pre-A1'], [14, 'Pre-A1'],
    [15, 'A1 Beginner'], [20, 'A1 Beginner'], [21, 'A1 Strong'], [25, 'A1 Strong'],
  ] as const)('assigns %s correct Junior 10–12 answers to %s', (correctAnswers, englishLevel) => {
    expect(determineEnglishLevel(10, correctAnswers, 25, 'junior-10-12-v1')).toEqual({
      englishLevel,
      percentage: Math.round((correctAnswers / 25) * 100),
    });
  });

  it('selects the dedicated 25-question Junior test with four listening tasks', () => {
    const test = getAssessmentTestForAge(11);
    expect(test.testVersion).toBe('junior-10-12-v1');
    expect(test.ageGroup).toBe('Juniors 10–12');
    expect(test.questions).toHaveLength(25);
    expect(test.questions.filter(question => question.audioText)).toHaveLength(4);
  });

  it('uses the present-continuous instruction for the cycling question in every language', () => {
    const question = getAssessmentTestForAge(11).questions.find(({ id }) => id === 'junior-q15');
    expect(question?.prompt).toEqual({
      ru: 'Выбери предложение, которое описывает, что происходит сейчас',
      ua: 'Обери речення, яке описує, що відбувається зараз',
      en: 'Choose the sentence that describes what is happening now',
    });
  });
});
