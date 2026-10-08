import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the real Edge Function with in-memory database and notification adapters.
// No production bookings or messages are created by these tests.
const source = ts.transpileModule(readFileSync(
  'supabase/functions/submit-trial-booking/index.ts', 'utf8',
), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

const legacyPayload = {
  idempotencyKey: 'trial-regression-test-20260926',
  parentName: 'Test Parent', parentEmail: 'parent@example.com', preferredLanguage: 'ru',
  childName: 'Test Child', childAge: 5, schoolGrade: '0', englishExperience: 'none',
  assessmentScore: 11, preliminaryRecommendation: 'Mini Kids',
  selectedDate: '2026-09-30', selectedTime: '17:30', timezone: 'Europe/Prague',
  privacyAcceptedAt: '2026-09-26T19:00:00Z', guardianConfirmedAt: '2026-09-26T19:00:00Z',
};
const assessment = {
  correctAnswers: 11, totalQuestions: 12, percentage: 92, englishLevel: 'A1 Strong',
  recommendedGroup: 'Mini Kids', ageGroup: 'Mini Kids 5–6', testVersion: 'mini-kids-5-6-v1',
};

let handler: (request: Request) => Promise<Response>;
let insert: ReturnType<typeof vi.fn>;
let notify: ReturnType<typeof vi.fn>;
let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  const table = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'booking-test' }, error: null }),
  };
  insert = table.insert;
  from = vi.fn().mockReturnValue(table);
  notify = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  runInNewContext(source, {
    exports: {}, require: () => ({ createClient: () => ({ from }) }),
    Deno: { env: { get: (name: string) => ({
      SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only',
    })[name] }, serve: (callback: typeof handler) => { handler = callback; } },
    Response, crypto: webcrypto, TextEncoder, fetch: notify, console,
  });
});

function submit(payload: object, origin = 'http://127.0.0.1:5173') {
  return handler(new Request('https://example.supabase.co/functions/v1/submit-trial-booking', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

describe('trial booking endpoint compatibility', () => {
  it.each([
    { childAge: 5, ...assessment },
    { childAge: 8, correctAnswers: 17, totalQuestions: 20, percentage: 85, englishLevel: 'A1 Strong', recommendedGroup: 'Kids A1', ageGroup: 'Kids 7–9', testVersion: 'kids-7-9-v1' },
    { childAge: 11, correctAnswers: 21, totalQuestions: 25, percentage: 84, englishLevel: 'A1 Strong', recommendedGroup: 'Junior A1', ageGroup: 'Juniors 10–12', testVersion: 'junior-10-12-v1' },
  ])('saves the current assessment for age $childAge', async result => {
    const response = await submit({ ...legacyPayload, ...result, assessmentScore: result.correctAnswers, preliminaryRecommendation: result.recommendedGroup });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, bookingId: 'booking-test' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      correct_answers: result.correctAnswers, total_questions: result.totalQuestions,
      english_level: result.englishLevel, test_version: result.testVersion,
    }));
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('still accepts an already-open page using the old payload', async () => {
    const response = await submit(legacyPayload);
    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ assessment_score: 11, correct_answers: null, test_version: null }));
  });

  it.each([
    { correctAnswers: 11 },
    { ...assessment, percentage: 50 },
    { ...assessment, totalQuestions: 20 },
    { ...assessment, testVersion: 'kids-7-9-v1' },
    { ...assessment, correctAnswers: null },
  ])('rejects incomplete or inconsistent new assessment data', async result => {
    const response = await submit({ ...legacyPayload, ...result });
    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('continues to reject unknown fields', async () => {
    const response = await submit({ ...legacyPayload, ...assessment, status: 'confirmed' });
    expect(await response.json()).toEqual({ error: 'unexpected_fields' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('continues to reject unapproved origins', async () => {
    const response = await submit({ ...legacyPayload, ...assessment }, 'https://example.org');
    expect(response.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });
});
