import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmEmailCode, homePathForUser, resendConfirmationEmail } from '../lib/auth';
import { Lang } from '../lib/i18n';
import { AuthAlert, AuthHeader, AuthPageShell } from '../components/AuthCard';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const text = {
  ru: {
    title: 'Проверьте почту',
    sub: 'Введите код из письма, чтобы подтвердить email.',
    sentTo: 'Код отправлен на',
    code: 'Код подтверждения',
    codePlaceholder: '6 цифр',
    confirm: 'Подтвердить email',
    resend: 'Отправить код ещё раз',
    wait: 'Новый код через',
    done: 'Новый код отправлен.',
    login: 'Перейти ко входу',
    hint: 'После подтверждения вы попадёте в аккаунт. Доступ к урокам откроет администратор.',
  },
  ua: {
    title: 'Перевірте пошту',
    sub: 'Введіть код з листа, щоб підтвердити email.',
    sentTo: 'Код надіслано на',
    code: 'Код підтвердження',
    codePlaceholder: '6 цифр',
    confirm: 'Підтвердити email',
    resend: 'Надіслати код ще раз',
    wait: 'Новий код через',
    done: 'Новий код надіслано.',
    login: 'Перейти до входу',
    hint: 'Після підтвердження ви потрапите в акаунт. Доступ до уроків відкриє адміністратор.',
  },
  en: {
    title: 'Check your email',
    sub: 'Enter the code from the email to confirm your address.',
    sentTo: 'Code sent to',
    code: 'Confirmation code',
    codePlaceholder: '6 digits',
    confirm: 'Confirm email',
    resend: 'Send code again',
    wait: 'New code in',
    done: 'A new code has been sent.',
    login: 'Go to login',
    hint: 'After confirmation you will enter your account. Lesson access is opened by an administrator.',
  },
};

export default function CheckEmail({ lang }: { lang: Lang }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = useMemo(() => {
    const stateEmail = (location.state as { email?: string } | null)?.email;
    return stateEmail || params.get('email') || '';
  }, [location.state, params]);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const copy = text[lang] || text.ru;

  const startCooldown = () => {
    setCooldown(60);
    const timer = window.setInterval(() => {
      setCooldown(value => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  };

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) return;
    setError('');
    setMessage('');
    setLoading(true);
    let result: Awaited<ReturnType<typeof confirmEmailCode>>;
    try {
      result = await confirmEmailCode(email, code);
    } catch (error) {
      result = { success: false, error: error instanceof Error ? error.message : 'Could not confirm email.' };
    } finally {
      setLoading(false);
    }

    if (result.success && result.data) {
      navigate(homePathForUser(result.data), { replace: true });
    } else {
      setError(result.error || 'Неверный или устаревший код.');
    }
  };

  const resend = async () => {
    if (!email || cooldown > 0) return;
    setError('');
    setMessage('');
    setResending(true);
    let result: Awaited<ReturnType<typeof resendConfirmationEmail>>;
    try {
      result = await resendConfirmationEmail(email);
    } catch (error) {
      result = { success: false, error: error instanceof Error ? error.message : 'Could not resend email' };
    } finally {
      setResending(false);
      startCooldown();
    }
    if (result.success) setMessage(copy.done);
    else setError(result.error || 'Could not resend email');
  };

  return (
    <AuthPageShell tone="blue">
      <AuthHeader icon="📧" title={copy.title} subtitle={copy.sub} />
      <div className="space-y-4">
        {email && (
          <div className="rounded-2xl bg-white/70 border border-purple-100 px-4 py-3 text-center">
            <div className="font-body text-xs text-purple-400">{copy.sentTo}</div>
            <div className="font-display font-bold text-purple-700 break-all">{email}</div>
          </div>
        )}

        <form onSubmit={confirm} className="space-y-4">
          <div>
            <label className="font-body font-600 text-purple-600 text-sm mb-2 block">{copy.code}</label>
            <InputOTP
              maxLength={6}
              value={code}
              onChange={value => setCode(value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              containerClassName="mt-3 justify-center gap-2 sm:gap-3"
              className="w-full"
            >
              <InputOTPGroup className="gap-2 sm:gap-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="h-12 w-11 rounded-2xl border border-pink-100 bg-white/85 text-center font-display text-2xl font-bold text-purple-700 shadow-sm transition-all first:rounded-2xl first:border last:rounded-2xl sm:h-14 sm:w-12"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <p className="mt-2 text-center font-body text-xs font-600 text-purple-300">{copy.codePlaceholder}</p>
          </div>
          <AuthAlert type="info">{copy.hint}</AuthAlert>
          {message && <AuthAlert type="success">{message}</AuthAlert>}
          {error && <AuthAlert>{error}</AuthAlert>}
          <button type="submit" disabled={!email || code.length < 6 || loading} className="btn-magic w-full py-4 text-white font-display font-bold disabled:opacity-60">
            {loading ? '...' : copy.confirm}
          </button>
        </form>

        <button
          type="button"
          onClick={resend}
          disabled={!email || resending || cooldown > 0}
          className="w-full rounded-2xl bg-white/75 border border-purple-100 px-4 py-3 font-body text-sm font-700 text-purple-500 hover:bg-white disabled:opacity-60"
        >
          {cooldown > 0 ? `${copy.wait} ${cooldown}s` : resending ? '...' : copy.resend}
        </button>
        <Link to="/login" className="block text-center font-body text-sm font-700 text-pink-500 hover:text-purple-500">
          {copy.login}
        </Link>
      </div>
    </AuthPageShell>
  );
}
