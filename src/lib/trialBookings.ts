import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AssessmentRecommendation,
  EnglishExperience,
  LanguagePreference,
  TrialBookingData,
} from '@/components/trial-booking/types';

export type TrialBookingStatus =
  | 'submitted'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'converted';

export type TrialBookingRecord = {
  id: string;
  idempotency_key: string | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string | null;
  preferred_language: LanguagePreference;
  child_name: string;
  child_age: number;
  school_grade: string;
  english_experience: EnglishExperience;
  parent_notes: string | null;
  assessment_score: number;
  preliminary_recommendation: AssessmentRecommendation;
  selected_date: string;
  selected_time: string;
  timezone: string;
  privacy_accepted_at: string;
  guardian_confirmed_at: string;
  marketing_consent_at: string | null;
  status: TrialBookingStatus;
  teacher_confirmed_level: string | null;
  teacher_confirmed_direction: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TrialBookingUpdate = Partial<
  Pick<
    TrialBookingRecord,
    | 'status'
    | 'selected_date'
    | 'selected_time'
    | 'teacher_confirmed_level'
    | 'teacher_confirmed_direction'
    | 'internal_notes'
  >
>;

type TrialBookingSchema = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      trial_bookings: {
        Row: TrialBookingRecord;
        Insert: Partial<TrialBookingRecord>;
        Update: TrialBookingUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const trialBookingClient = supabase as unknown as SupabaseClient<TrialBookingSchema>;

export function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `trial_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getTimezone() {
  if (typeof Intl === 'undefined') return 'Europe/Prague';
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Prague';
}

export async function submitTrialBooking(data: TrialBookingData, idempotencyKey: string) {
  if (!data.assessment) throw new Error('missing_assessment');
  if (!data.privacy.privacyAccepted || !data.privacy.guardianConfirmed) throw new Error('missing_consents');

  const submittedAt = new Date().toISOString();
  const { data: response, error } = await supabase.functions.invoke<{
    success: boolean;
    bookingId?: string;
    duplicate?: boolean;
    error?: string;
  }>('submit-trial-booking', {
    body: {
      idempotencyKey,
      parentName: data.parent.parentName,
      parentEmail: data.parent.email,
      parentPhone: data.parent.phone || null,
      preferredLanguage: data.parent.languagePreference,
      childName: data.child.childName,
      childAge: data.child.age,
      schoolGrade: data.child.schoolGrade,
      englishExperience: data.child.englishExperience,
      parentNotes: data.child.notes || null,
      assessmentScore: data.assessment.score,
      preliminaryRecommendation: data.assessment.recommendation,
      selectedDate: data.selectedDate,
      selectedTime: data.selectedTime,
      timezone: getTimezone(),
      privacyAcceptedAt: submittedAt,
      guardianConfirmedAt: submittedAt,
      marketingConsentAt: data.privacy.marketingAccepted ? submittedAt : null,
    },
  });

  if (error) throw new Error(error.message || 'submission_failed');
  if (!response?.success) throw new Error(response?.error || 'submission_failed');
  return response;
}

export async function loadTrialBookings() {
  const { data, error } = await trialBookingClient
    .from('trial_bookings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateTrialBooking(id: string, patch: TrialBookingUpdate) {
  const { data, error } = await trialBookingClient
    .from('trial_bookings')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
