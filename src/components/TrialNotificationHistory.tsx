import { useCallback, useEffect, useState } from 'react';
import { BellRing, Loader2, Mail, RefreshCw, Send } from 'lucide-react';
import type { Lang } from '@/lib/i18n';
import {
  loadTrialNotificationHistory,
  resendTrialNotification,
  type TrialNotificationLogEntry,
} from '@/lib/trialBookings';

const copy = {
  ru: {
    title: 'История уведомлений',
    empty: 'По этой заявке уведомлений ещё не было.',
    resend: 'Отправить повторно',
    reload: 'Обновить',
    error: 'Не удалось загрузить историю',
    resent: 'Уведомление отправлено повторно',
    version: 'версия',
    statuses: { sent: 'отправлено', pending: 'в очереди', failed: 'ошибка', skipped: 'пропущено' } as Record<string, string>,
  },
  ua: {
    title: 'Історія сповіщень',
    empty: 'За цією заявкою сповіщень ще не було.',
    resend: 'Надіслати повторно',
    reload: 'Оновити',
    error: 'Не вдалося завантажити історію',
    resent: 'Сповіщення надіслано повторно',
    version: 'версія',
    statuses: { sent: 'надіслано', pending: 'у черзі', failed: 'помилка', skipped: 'пропущено' } as Record<string, string>,
  },
  en: {
    title: 'Notification history',
    empty: 'No notifications for this request yet.',
    resend: 'Send again',
    reload: 'Refresh',
    error: 'Could not load the history',
    resent: 'Notification sent again',
    version: 'version',
    statuses: { sent: 'sent', pending: 'queued', failed: 'failed', skipped: 'skipped' } as Record<string, string>,
  },
} as const;

function timeLabel(value: string | null, lang: Lang) {
  if (!value) return '';
  return new Date(value).toLocaleString(lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function TrialNotificationHistory({ bookingId, lang }: { bookingId: string; lang: Lang }) {
  const labels = copy[lang] || copy.ru;
  const [items, setItems] = useState<TrialNotificationLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await loadTrialNotificationHistory(bookingId));
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }, [bookingId, labels.error]);

  useEffect(() => { void load(); }, [load]);

  const resend = async (eventType: string) => {
    setResending(eventType);
    setMessage('');
    try {
      await resendTrialNotification(bookingId, eventType);
      setMessage(labels.resent);
      await load();
    } catch {
      setError(labels.error);
    } finally {
      setResending('');
    }
  };

  const latestByEvent = Array.from(
    items.reduce((acc, item) => {
      if (!acc.has(item.event_type)) acc.set(item.event_type, item);
      return acc;
    }, new Map<string, TrialNotificationLogEntry>()).values(),
  );

  return (
    <section className="grid gap-3 rounded-3xl bg-purple-50/60 p-4 dark:bg-white/10">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 font-display text-lg font-black text-purple-700 dark:text-purple-100">
          <BellRing className="h-4 w-4" aria-hidden="true" />
          {labels.title}
        </h4>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-body text-xs font-bold text-purple-500 transition hover:bg-white/70 dark:text-purple-200 dark:hover:bg-white/10"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          {labels.reload}
        </button>
      </div>

      {error && <p className="font-body text-xs font-bold text-red-500">{error}</p>}
      {message && <p className="font-body text-xs font-bold text-green-600 dark:text-green-300">{message}</p>}

      {!loading && items.length === 0 && (
        <p className="font-body text-xs font-semibold text-purple-400 dark:text-purple-300">{labels.empty}</p>
      )}

      <ul className="grid gap-2">
        {items.map(item => (
          <li key={item.id} className="rounded-2xl bg-white/80 px-3 py-2 dark:bg-white/10">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-body text-xs font-black text-purple-700 dark:text-purple-100">
                {item.channel === 'email'
                  ? <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
                {item.event_type}
              </span>
              <span className="font-body text-[11px] font-bold text-purple-400 dark:text-purple-300">
                {labels.statuses[item.status] || item.status} · {labels.version} {item.event_version}
              </span>
            </div>
            <p className="mt-0.5 font-body text-[11px] font-semibold text-purple-400 dark:text-purple-300">
              {item.recipient_email || item.telegram_chat_id} · {item.language.toUpperCase()} · {timeLabel(item.sent_at || item.created_at, lang)}
            </p>
            {item.error_message && (
              <p className="mt-0.5 font-body text-[11px] font-bold text-red-500">{item.error_message}</p>
            )}
          </li>
        ))}
      </ul>

      {latestByEvent.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {latestByEvent.map(item => (
            <button
              key={`resend-${item.event_type}`}
              type="button"
              onClick={() => void resend(item.event_type)}
              disabled={!!resending}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-purple-100 px-3 py-1.5 font-body text-xs font-black text-purple-600 transition hover:bg-pink-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/10 dark:text-purple-100"
            >
              {resending === item.event_type
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
              {labels.resend}: {item.event_type}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
