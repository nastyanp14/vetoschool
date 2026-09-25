import { describe, expect, it } from 'vitest';
import { isLegacyCheckpointReviewError } from './teachers';

describe('checkpoint homework review compatibility', () => {
  it('falls back when an existing checkpoint is rejected by the legacy review RPC', () => {
    expect(isLegacyCheckpointReviewError({ message: 'Homework item was not found' }, 'checkpoint')).toBe(true);
  });

  it('does not bypass real missing-item or permission errors for other content', () => {
    expect(isLegacyCheckpointReviewError({ message: 'Homework item was not found' }, 'homework')).toBe(false);
    expect(isLegacyCheckpointReviewError({ message: 'Teacher cannot review this homework' }, 'checkpoint')).toBe(false);
  });
});
