import type { Lang } from '@/lib/i18n';

export type TrialStepId =
  | 'welcome'
  | 'parent'
  | 'child'
  | 'assessment'
  | 'date'
  | 'time'
  | 'privacy'
  | 'confirmation';

export type LanguagePreference = 'ua' | 'ru' | 'en';
export type EnglishExperience = 'none' | 'lt1' | '1-2' | 'gt2';

export type ParentInfo = {
  parentName: string;
  email: string;
  phone?: string;
  languagePreference: LanguagePreference;
};

export type ChildInfo = {
  childName: string;
  age: number;
  schoolGrade: string;
  englishExperience: EnglishExperience;
  notes?: string;
};

export type AssessmentQuestionType = 'image_choice' | 'vocabulary_choice' | 'missing_letter' | 'simple_sentence' | 'audio_choice';

export type CefrLevel = 'Starter' | 'Pre-A1' | 'A1' | 'A2' | 'B1' | 'B2';
export type EnglishLevel = 'Starter' | 'Pre-A1' | 'A1 Beginner' | 'A1 Strong' | 'A2' | 'B1' | 'B2';

export type LocalizedText = Record<Lang, string>;

export type AssessmentOption = {
  id: string;
  label: LocalizedText;
  visual?: string | string[];
};

export type AssessmentQuestion = {
  id: string;
  type: AssessmentQuestionType;
  prompt: LocalizedText;
  helper?: LocalizedText;
  illustration?: string;
  audioText?: string;
  audioSrc?: string;
  options: AssessmentOption[];
  correctOptionId: string;
};

export type AssessmentRecommendation =
  | 'Mini Kids'
  | 'Kids Beginners'
  | 'Junior Beginners'
  | 'Kids A1'
  | 'Junior A1';

export type AssessmentResult = {
  // score, total and recommendation are retained for the existing booking flow.
  score: number;
  total: number;
  recommendation: AssessmentRecommendation;
  correctAnswers: number;
  totalQuestions: number;
  percentage: number;
  englishLevel: EnglishLevel;
  recommendedGroup: AssessmentRecommendation;
  ageGroup: string;
  testVersion: string;
};

export type PrivacyConsents = {
  privacyAccepted: boolean;
  guardianConfirmed: boolean;
  marketingAccepted: boolean;
};

export type AssessmentProgress = {
  started: boolean;
  questionIndex: number;
  answers: Record<string, string>;
  selectedOptionId: string;
  resultView: 'summary' | 'review';
};

export type TrialBookingData = {
  parent: ParentInfo;
  child: ChildInfo;
  assessment: AssessmentResult | null;
  assessmentProgress: AssessmentProgress;
  selectedDate: string;
  selectedTime: string;
  privacy: PrivacyConsents;
};

export type TrialBookingStepProps = {
  lang: Lang;
  data: TrialBookingData;
  onBack: () => void;
  onNext: () => void;
  updateData: (patch: Partial<TrialBookingData>) => void;
};
