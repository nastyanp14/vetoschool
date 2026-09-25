import { describe, expect, it } from 'vitest';
import { currentWeekDayKeys, dictionaryStreak, localDayKey } from './dictionaryStreak';

describe('dictionary study streak', () => {
  const today = new Date(2026, 8, 2, 12);

  it('counts consecutive study days through today', () => {
    expect(dictionaryStreak(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'], today)).toBe(4);
  });

  it('keeps the current streak available until the end of the next day', () => {
    expect(dictionaryStreak(['2026-08-31', '2026-09-01'], today)).toBe(2);
  });

  it('returns zero after a missed day', () => {
    expect(dictionaryStreak(['2026-08-30', '2026-08-31'], today)).toBe(0);
  });

  it('uses the local calendar day and returns Monday through Sunday for the current week', () => {
    expect(localDayKey(today)).toBe('2026-09-02');
    expect(currentWeekDayKeys(today)).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
  });
});
