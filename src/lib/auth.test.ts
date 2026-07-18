import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './authRedirects';

describe('safeRedirectPath', () => {
  it('allows known internal paths', () => {
    expect(safeRedirectPath('/dashboard')).toBe('/dashboard');
    expect(safeRedirectPath('/auth/confirmed?from=email')).toBe('/auth/confirmed?from=email');
  });

  it('blocks external and unknown redirects', () => {
    expect(safeRedirectPath('https://example.com')).toBe('/dashboard');
    expect(safeRedirectPath('//example.com')).toBe('/dashboard');
    expect(safeRedirectPath('/admin/users')).toBe('/dashboard');
  });
});
