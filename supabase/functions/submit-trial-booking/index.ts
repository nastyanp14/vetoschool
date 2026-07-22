import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

type LanguagePreference = 'ru' | 'ua' | 'en';
type EnglishExperience = 'none' | 'lt1' | '1-2' | 'gt2';
type Recommendation = 'Mini Kids' | 'Kids Beginners' | 'Junior Beginners' | 'Kids A1' | 'Junior A1';

type TrialBookingPayload = {
  idempotencyKey: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string | null;
  preferredLanguage: LanguagePreference;
  childName: string;
  childAge: number;
  schoolGrade: string;
  englishExperience: EnglishExperience;
  parentNotes?: string | null;
  assessmentScore: number;
  preliminaryRecommendation: Recommendation;
  selectedDate: string;
  selectedTime: string;
  timezone: string;
  privacyAcceptedAt: string;
  guardianConfirmedAt: string;
  marketingConsentAt?: string | null;
};

const allowedLanguages = new Set<LanguagePreference>(['ru', 'ua', 'en']);
const allowedExperience = new Set<EnglishExperience>(['none', 'lt1', '1-2', 'gt2']);
const allowedRecommendations = new Set<Recommendation>([
  'Mini Kids',
  'Kids Beginners',
  'Junior Beginners',
  'Kids A1',
  'Junior A1',
]);

const expectedKeys = new Set([
  'idempotencyKey',
  'parentName',
  'parentEmail',
  'parentPhone',
  'preferredLanguage',
  'childName',
  'childAge',
  'schoolGrade',
  'englishExperience',
  'parentNotes',
  'assessmentScore',
  'preliminaryRecommendation',
  'selectedDate',
  'selectedTime',
  'timezone',
  'privacyAcceptedAt',
  'guardianConfirmedAt',
  'marketingConsentAt',
]);

function allowedOrigins() {
  const configured = Deno.env.get('TRIAL_BOOKING_ALLOWED_ORIGINS');
  if (configured) {
    return configured.split(',').map(origin => origin.trim()).filter(Boolean);
  }
  return [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'https://vetoschool.eu',
    'https://www.vetoschool.eu',
    'https://vetoschool.com',
    'https://www.vetoschool.com',
  ];
}

function corsHeaders(origin: string | null) {
  const allowed = allowedOrigins();
  const resolvedOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': resolvedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonResponse(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function assertAllowedOrigin(origin: string | null) {
  if (!origin) return;
  if (!allowedOrigins().includes(origin)) {
    throw new ValidationError('origin_not_allowed');
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function normalizeString(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== 'string') throw new ValidationError(`${field}_invalid`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw new ValidationError(`${field}_invalid`);
  return trimmed;
}

function optionalString(value: unknown, field: string, max: number) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ValidationError(`${field}_invalid`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw new ValidationError(`${field}_invalid`);
  return trimmed;
}

function validateIsoTimestamp(value: unknown, field: string) {
  const text = normalizeString(value, field, 10, 40);
  const date = new Date(text);
  if (Number.isNaN(date.getTime()) || !text.includes('T')) throw new ValidationError(`${field}_invalid`);
  return date.toISOString();
}

function validateDate(value: unknown) {
  const text = normalizeString(value, 'selectedDate', 10, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new ValidationError('selectedDate_invalid');
  const parsed = new Date(`${text}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new ValidationError('selectedDate_invalid');
  }
  return text;
}

function validateTime(value: unknown) {
  const text = normalizeString(value, 'selectedTime', 5, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new ValidationError('selectedTime_invalid');
  return text;
}

function validatePayload(raw: unknown): TrialBookingPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError('payload_invalid');
  const input = raw as Record<string, unknown>;
  const unexpected = Object.keys(input).filter(key => !expectedKeys.has(key));
  if (unexpected.length > 0) throw new ValidationError('unexpected_fields');

  const parentEmail = normalizeString(input.parentEmail, 'parentEmail', 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) throw new ValidationError('parentEmail_invalid');

  const preferredLanguage = input.preferredLanguage;
  if (typeof preferredLanguage !== 'string' || !allowedLanguages.has(preferredLanguage as LanguagePreference)) {
    throw new ValidationError('preferredLanguage_invalid');
  }

  const englishExperience = input.englishExperience;
  if (typeof englishExperience !== 'string' || !allowedExperience.has(englishExperience as EnglishExperience)) {
    throw new ValidationError('englishExperience_invalid');
  }

  const preliminaryRecommendation = input.preliminaryRecommendation;
  if (typeof preliminaryRecommendation !== 'string' || !allowedRecommendations.has(preliminaryRecommendation as Recommendation)) {
    throw new ValidationError('preliminaryRecommendation_invalid');
  }

  const childAge = Number(input.childAge);
  if (!Number.isInteger(childAge) || childAge < 4 || childAge > 16) throw new ValidationError('childAge_invalid');

  const assessmentScore = Number(input.assessmentScore);
  if (!Number.isInteger(assessmentScore) || assessmentScore < 0 || assessmentScore > 100) {
    throw new ValidationError('assessmentScore_invalid');
  }

  const privacyAcceptedAt = validateIsoTimestamp(input.privacyAcceptedAt, 'privacyAcceptedAt');
  const guardianConfirmedAt = validateIsoTimestamp(input.guardianConfirmedAt, 'guardianConfirmedAt');
  const marketingConsentAt = input.marketingConsentAt ? validateIsoTimestamp(input.marketingConsentAt, 'marketingConsentAt') : null;

  return {
    idempotencyKey: normalizeString(input.idempotencyKey, 'idempotencyKey', 16, 120),
    parentName: normalizeString(input.parentName, 'parentName', 2, 120),
    parentEmail,
    parentPhone: optionalString(input.parentPhone, 'parentPhone', 40),
    preferredLanguage: preferredLanguage as LanguagePreference,
    childName: normalizeString(input.childName, 'childName', 2, 120),
    childAge,
    schoolGrade: normalizeString(input.schoolGrade, 'schoolGrade', 1, 40),
    englishExperience: englishExperience as EnglishExperience,
    parentNotes: optionalString(input.parentNotes, 'parentNotes', 2000),
    assessmentScore,
    preliminaryRecommendation: preliminaryRecommendation as Recommendation,
    selectedDate: validateDate(input.selectedDate),
    selectedTime: validateTime(input.selectedTime),
    timezone: normalizeString(input.timezone || 'Europe/Prague', 'timezone', 3, 80),
    privacyAcceptedAt,
    guardianConfirmedAt,
    marketingConsentAt,
  };
}

async function sha256(text: string) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async req => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    try {
      assertAllowedOrigin(origin);
      return new Response(null, { headers: corsHeaders(origin) });
    } catch {
      return jsonResponse({ error: 'origin_not_allowed' }, 403, origin);
    }
  }

  try {
    assertAllowedOrigin(origin);
    if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, origin);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'server_not_configured' }, 500, origin);

    const payload = validatePayload(await req.json());
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || 'unknown';
    const ipHash = await sha256(clientIp);
    const windowStartDate = new Date();
    windowStartDate.setUTCMinutes(0, 0, 0);
    const windowStart = windowStartDate.toISOString();

    const { data: rateLimitRow, error: rateReadError } = await supabase
      .from('trial_booking_rate_limits')
      .select('attempts')
      .eq('ip_hash', ipHash)
      .eq('window_start', windowStart)
      .maybeSingle();

    if (rateReadError) throw rateReadError;
    if (rateLimitRow && rateLimitRow.attempts >= 5) {
      return jsonResponse({ error: 'rate_limited' }, 429, origin);
    }

    const { error: rateWriteError } = await supabase
      .from('trial_booking_rate_limits')
      .upsert({
        ip_hash: ipHash,
        window_start: windowStart,
        attempts: (rateLimitRow?.attempts || 0) + 1,
      }, { onConflict: 'ip_hash,window_start' });

    if (rateWriteError) throw rateWriteError;

    const { data: existingByKey, error: keyError } = await supabase
      .from('trial_bookings')
      .select('id')
      .eq('idempotency_key', payload.idempotencyKey)
      .maybeSingle();

    if (keyError) throw keyError;
    if (existingByKey) return jsonResponse({ success: true, bookingId: existingByKey.id, duplicate: true }, 200, origin);

    const duplicateSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentDuplicate, error: duplicateError } = await supabase
      .from('trial_bookings')
      .select('id')
      .eq('parent_email', payload.parentEmail)
      .ilike('child_name', payload.childName)
      .eq('selected_date', payload.selectedDate)
      .eq('selected_time', payload.selectedTime)
      .gte('created_at', duplicateSince)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (recentDuplicate) return jsonResponse({ error: 'duplicate_booking' }, 409, origin);

    const { data: booking, error: insertError } = await supabase
      .from('trial_bookings')
      .insert({
        idempotency_key: payload.idempotencyKey,
        parent_name: payload.parentName,
        parent_email: payload.parentEmail,
        parent_phone: payload.parentPhone,
        preferred_language: payload.preferredLanguage,
        child_name: payload.childName,
        child_age: payload.childAge,
        school_grade: payload.schoolGrade,
        english_experience: payload.englishExperience,
        parent_notes: payload.parentNotes,
        assessment_score: payload.assessmentScore,
        preliminary_recommendation: payload.preliminaryRecommendation,
        selected_date: payload.selectedDate,
        selected_time: payload.selectedTime,
        timezone: payload.timezone,
        privacy_accepted_at: payload.privacyAcceptedAt,
        guardian_confirmed_at: payload.guardianConfirmedAt,
        marketing_consent_at: payload.marketingConsentAt,
        status: 'submitted',
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    return jsonResponse({ success: true, bookingId: booking.id }, 201, origin);
  } catch (error) {
    if (error instanceof ValidationError) {
      const status = error.message === 'origin_not_allowed' ? 403 : 400;
      return jsonResponse({ error: error.message }, status, origin);
    }
    console.error('submit-trial-booking error', error);
    return jsonResponse({ error: 'internal_error' }, 500, origin);
  }
});
