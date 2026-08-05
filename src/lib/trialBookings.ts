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
  lesson_url: string | null;
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
    | 'lesson_url'
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
  const { data: before, error: beforeError } = await trialBookingClient.from('trial_bookings').select('status,selected_date,selected_time,teacher_confirmed_level,teacher_confirmed_direction,lesson_url').eq('id', id).single();
  if (beforeError) throw beforeError;
  const { data, error } = await trialBookingClient
    .from('trial_bookings')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;

  const statusChanged = before.status !== data.status
    || before.selected_date !== data.selected_date
    || before.selected_time !== data.selected_time
    || (data.status === 'confirmed' && before.lesson_url !== data.lesson_url);
  const recommendationReady = !!data.teacher_confirmed_level
    && (before.teacher_confirmed_level !== data.teacher_confirmed_level
      || before.teacher_confirmed_direction !== data.teacher_confirmed_direction);

  if (statusChanged) {
    const { error: notificationError } = await supabase.functions.invoke('telegram-notifications', {
      body: { action: 'trial_event', bookingId: id, previousStatus: before.status, previousDate: before.selected_date, previousTime: before.selected_time },
    });
    if (notificationError) throw notificationError;
  }

  // Рекомендация преподавателя — отдельное событие, а не часть смены статуса.
  if (recommendationReady) {
    const { error: recommendationError } = await supabase.functions.invoke('telegram-notifications', {
      body: { action: 'trial_event', bookingId: id, type: 'trial_recommendation_ready' },
    });
    if (recommendationError) throw recommendationError;
  }

  return data;
}

/** Ссылка на урок обязательна и должна быть корректным https-адресом. */
export function isValidLessonUrl(value: string): boolean {
  const url = value.trim();
  if (!/^https:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Подтверждение пробного урока: без валидной ссылки подтвердить нельзя. */
export async function confirmTrialLesson(id: string, lessonUrl: string, patch: TrialBookingUpdate = {}) {
  if (!isValidLessonUrl(lessonUrl)) throw new Error('invalid_lesson_url');
  return updateTrialBooking(id, { ...patch, lesson_url: lessonUrl.trim(), status: 'confirmed' });
}

export interface TrialNotificationLogEntry {
  id: string;
  event_type: string;
  event_version: number;
  channel: 'telegram' | 'email';
  recipient_role: string;
  recipient_email: string | null;
  telegram_chat_id: string | null;
  language: string;
  status: string;
  subject: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export async function loadTrialNotificationHistory(bookingId: string) {
  const { data, error } = await supabase.functions.invoke<{ items: TrialNotificationLogEntry[] }>('telegram-notifications', {
    body: { action: 'notification_history', entityType: 'trial_booking', entityId: bookingId, limit: 50 },
  });
  if (error) throw error;
  return data?.items || [];
}

/** Повторная отправка поднимает event_version, поэтому не считается дублем. */
export async function resendTrialNotification(bookingId: string, eventType?: string) {
  const { data, error } = await supabase.functions.invoke('telegram-notifications', {
    body: { action: 'trial_event', bookingId, resend: true, ...(eventType ? { type: eventType } : {}) },
  });
  if (error) throw error;
  return data;
}
