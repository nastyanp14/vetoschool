import { describe, expect, it } from 'vitest';
import { validatePassword, validatePasswordPair } from './password';

describe('password validation', () => {
  it('keeps the existing minimum length requirement', () => {
    expect(validatePassword('12345')).toBe('Пароль должен быть не короче 6 символов.');
    expect(validatePassword('123456')).toBeNull();
  });

  it('requires password confirmation to match', () => {
    expect(validatePasswordPair('123456', 'abcdef')).toBe('Пароли не совпадают.');
    expect(validatePasswordPair('123456', '123456')).toBeNull();
  });
});
