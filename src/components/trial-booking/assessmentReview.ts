import type { AssessmentQuestion } from './types';

export type AssessmentAnswerReview = {
  question: AssessmentQuestion;
  selectedOptionId?: string;
  correct: boolean;
};

export const getAssessmentAnswerReview = (
  questions: AssessmentQuestion[],
  answers: Record<string, string>,
): AssessmentAnswerReview[] => questions.map(question => ({
  question,
  selectedOptionId: answers[question.id],
  correct: answers[question.id] === question.correctOptionId,
}));
