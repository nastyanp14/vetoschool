import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Lang, TranslationKey } from '@/lib/i18n';
import BookingProgress from './BookingProgress';
import WelcomeStep from './WelcomeStep';
import ParentStep from './ParentStep';
import ChildStep from './ChildStep';
import AssessmentStep from './AssessmentStep';
import DateStep from './DateStep';
import TimeStep from './TimeStep';
import PrivacyStep from './PrivacyStep';
import ConfirmationStep from './ConfirmationStep';
import type { TrialBookingData, TrialStepId } from './types';

const steps: Array<{ id: TrialStepId; title: TranslationKey }> = [
  { id: 'welcome', title: 'trial_step_welcome' },
  { id: 'parent', title: 'trial_step_parent' },
  { id: 'child', title: 'trial_step_child' },
  { id: 'assessment', title: 'trial_step_assessment' },
  { id: 'date', title: 'trial_step_date' },
  { id: 'time', title: 'trial_step_time' },
  { id: 'privacy', title: 'trial_step_privacy' },
  { id: 'confirmation', title: 'trial_step_confirmation' },
];

const initialData: TrialBookingData = {
  parent: {
    parentName: '',
    email: '',
    phone: '',
    languagePreference: 'ua',
  },
  child: {
    childName: '',
    age: 7,
    schoolGrade: '',
    englishExperience: 'none',
    notes: '',
  },
  assessment: null,
  selectedDate: '',
  selectedTime: '',
  privacy: {
    privacyAccepted: false,
    guardianConfirmed: false,
    marketingAccepted: false,
  },
};

export default function BookingWizard({ lang }: { lang: Lang }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<TrialBookingData>(initialData);
  const stepRegionRef = useRef<HTMLDivElement>(null);
  const current = steps[stepIndex];

  useEffect(() => {
    stepRegionRef.current?.focus();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [stepIndex]);

  const updateData = (patch: Partial<TrialBookingData>) => {
    setData(currentData => ({ ...currentData, ...patch }));
  };

  const goNext = () => setStepIndex(index => Math.min(index + 1, steps.length - 1));
  const goBack = () => setStepIndex(index => Math.max(index - 1, 0));
  const goEditBooking = () => setStepIndex(1);

  const sharedProps = {
    lang,
    data,
    updateData,
    onNext: goNext,
    onBack: goBack,
  };

  const renderStep = () => {
    if (current.id === 'welcome') return <WelcomeStep {...sharedProps} />;
    if (current.id === 'parent') return <ParentStep {...sharedProps} />;
    if (current.id === 'child') return <ChildStep {...sharedProps} />;
    if (current.id === 'assessment') return <AssessmentStep {...sharedProps} />;
    if (current.id === 'date') return <DateStep {...sharedProps} />;
    if (current.id === 'time') return <TimeStep {...sharedProps} />;
    if (current.id === 'privacy') return <PrivacyStep {...sharedProps} />;
    return <ConfirmationStep {...sharedProps} onEditBooking={goEditBooking} />;
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-28 sm:pt-32">
      <BookingProgress
        lang={lang}
        currentStep={stepIndex + 1}
        totalSteps={steps.length}
        stepTitle={current.title}
        canGoBack={stepIndex > 0}
        onBack={goBack}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          ref={stepRegionRef}
          tabIndex={-1}
          aria-live="polite"
          className="outline-none"
          initial={{ opacity: 0, y: 20, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.99 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
