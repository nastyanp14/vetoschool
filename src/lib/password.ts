export function validatePassword(password: string) {
  if (password.length < 6) return 'Пароль должен быть не короче 6 символов.';
  return null;
}

export function validatePasswordPair(password: string, confirm: string) {
  const passwordError = validatePassword(password);
  if (passwordError) return passwordError;
  if (password !== confirm) return 'Пароли не совпадают.';
  return null;
}
