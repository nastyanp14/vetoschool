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

export type AssessmentQuestionType = 'image_choice' | 'vocabulary_choice' | 'missing_letter' | 'simple_sentence';

export type LocalizedText = Record<Lang, string>;

export type AssessmentOption = {
  id: string;
  label: LocalizedText;
  visual?: string;
};

export type AssessmentQuestion = {
  id: string;
  type: AssessmentQuestionType;
  prompt: LocalizedText;
  helper?: LocalizedText;
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
  score: number;
  total: number;
  recommendation: AssessmentRecommendation;
};

export type PrivacyConsents = {
  privacyAccepted: boolean;
  guardianConfirmed: boolean;
  marketingAccepted: boolean;
};

export type TrialBookingData = {
  parent: ParentInfo;
  child: ChildInfo;
  assessment: AssessmentResult | null;
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
