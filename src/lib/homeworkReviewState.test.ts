import { describe, expect, it } from 'vitest';
import { reviewStatusAfterInteractiveRepair } from './homeworkReviewState';

describe('interactive homework repair review status', () => {
  it('preserves a teacher revision request', () => {
    expect(reviewStatusAfterInteractiveRepair('revision_requested')).toBe('revision_requested');
  });

  it('marks ordinary completed interactive work as reviewed', () => {
    expect(reviewStatusAfterInteractiveRepair('submitted')).toBe('reviewed');
    expect(reviewStatusAfterInteractiveRepair(null)).toBe('reviewed');
  });
});
