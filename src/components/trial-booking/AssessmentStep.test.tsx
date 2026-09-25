import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AssessmentStep from './AssessmentStep';
import { getAssessmentTestForAge } from './MockAssessmentData';
import { getAssessmentAnswerReview } from './assessmentReview';
import type { TrialBookingData } from './types';

const baseData: TrialBookingData = {
  parent: { parentName: '', email: '', languagePreference: 'ua' },
  child: { childName: '', age: 7, schoolGrade: '', englishExperience: 'none' },
  assessment: null,
  assessmentProgress: { started: false, questionIndex: 0, answers: {}, selectedOptionId: '', resultView: 'summary' },
  selectedDate: '',
  selectedTime: '',
  privacy: { privacyAccepted: false, guardianConfirmed: false, marketingAccepted: false },
};

afterEach(cleanup);

describe('AssessmentStep question navigation', () => {
  it('opens the detailed review only after continuing from the summary, then advances to booking', () => {
    const onNext = vi.fn();
    render(
      <AssessmentStep
        lang="ru"
        data={{
          ...baseData,
          assessment: {
            score: 1,
            total: 20,
            recommendation: 'Kids A1',
            correctAnswers: 1,
            totalQuestions: 20,
            percentage: 5,
            englishLevel: 'Starter',
            recommendedGroup: 'Kids A1',
            ageGroup: 'Kids 7–9',
            testVersion: 'kids-7-9-v1',
          },
        }}
        updateData={vi.fn()}
        onBack={vi.fn()}
        onNext={onNext}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Результаты по заданиям' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(screen.getByRole('heading', { name: 'Результаты по заданиям' })).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it.each([5, 8, 11])('shows correct and incorrect results for every question at age %s', age => {
    const questions = getAssessmentTestForAge(age).questions;
    const incorrectOption = questions[1].options.find(option => option.id !== questions[1].correctOptionId)!;
    const review = getAssessmentAnswerReview(questions, {
      [questions[0].id]: questions[0].correctOptionId,
      [questions[1].id]: incorrectOption.id,
    });

    expect(review).toHaveLength(questions.length);
    expect(review[0].correct).toBe(true);
    expect(review[1]).toMatchObject({ selectedOptionId: incorrectOption.id, correct: false });
  });

  it.each([5, 8, 11])('returns to the answered question for age %s without a forward-navigation control', async age => {
    render(
      <AssessmentStep
        lang="ru"
        data={{ ...baseData, child: { ...baseData.child, age } }}
        updateData={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Начать мини-игру' }));
    expect(screen.queryByRole('button', { name: 'Назад' })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { pressed: false })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Следующий вопрос' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Назад' })).toBeInTheDocument());
    expect(screen.getByText(/Вопрос 2 \//)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Назад' })).not.toBeInTheDocument());
    expect(screen.getByText(/Вопрос 1 \//)).toBeInTheDocument();
    expect(screen.getByRole('button', { pressed: true })).toBeInTheDocument();
  });
});
