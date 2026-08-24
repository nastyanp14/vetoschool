import { useCallback, useState, useEffect, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock, Crown, Lock, Unlock } from 'lucide-react';
import { getCurrentUser, logout } from '../lib/auth';
import { getStudentSchedule } from '../lib/schedule';
import { ensureStudentContent, ContentItem, getStudentRating, isGradedContentType, loadStudentContent, openOrDownload, submitStudentContentWork } from '../lib/content';
import { loadStudentSchedule } from '../lib/schedule';
import { Lang, t } from '../lib/i18n';
import ThemeToggle from '../components/ThemeToggle';
import DictionaryView from '../components/DictionaryView';
import AvatarShop, { StarCelebration } from '../components/AvatarShop';
import InteractiveLessonMap from '../components/InteractiveLessonMap';
import InteractiveLessonRoom from '../components/InteractiveLessonRoom';
import { loadStarProfile, clearCelebration, findAvatar } from '../lib/stars';
import { createTelegramLink, disconnectTelegramParent, listTelegramParents, TelegramParentAccount } from '../lib/telegram';
import { getLessonById, Lesson as WorkbookLesson } from '../lib/workbooks';
import { supabase } from '@/integrations/supabase/client';
import { pricingPlanNameKeys, type PricingPlanId } from '../lib/pricingCurrency';
import { redirectToStripeCustomerPortal } from '../lib/stripeCheckout';
import { activeSubscriptionStatus, billingStatusClass, billingStatusLabel, shouldShowActiveTariff } from '../lib/subscriptionStatus';

const RATING_STAR_SRC = '/dashboard/rating-user-star.png?v=20260815';
const withoutLeadingStar = (value: string) => value.replace(/^⭐\s*/, '');

type Tab = 'overview' | 'lessons' | 'homework' | 'schedule' | 'practice' | 'grammar' | 'listening' | 'checkpoint' | 'dictionary' | 'grades' | 'shop' | 'interactive';

type BillingSummary = {
  access_status: string | null;
  has_access: boolean | null;
  payment_status: string | null;
  payment_failed_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  plan_id: string | null;
  lesson_format: string | null;
  lessons_total: number | null;
  lessons_remaining: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_payment_date: string | null;
  manual_access_override: boolean | null;
  manual_access_override_by: string | null;
  manual_access_override_at: string | null;
};

// ---- Audio player ----
function AudioPlayer({ dataUrl }: { dataUrl: string }) {
  return (
    <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-2xl p-4 border border-green-100">
      <audio controls className="w-full rounded-xl">
        <source src={dataUrl} />
        Your browser does not support audio.
      </audio>
    </div>
  );
}

function TelegramConnectCard({ studentId, lang }: { studentId: string; lang: Lang }) {
  const [parents, setParents] = useState<TelegramParentAccount[]>([]);
  const [link, setLink] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [waitingForLink, setWaitingForLink] = useState(false);

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const loadParents = async () => setParents(await listTelegramParents(studentId));
  const refreshParents = async () => {
    setRefreshing(true);
    try {
      await loadParents();
    } finally {
      setRefreshing(false);
    }
  };
  const disconnectParent = async (parentId: string) => {
    setDisconnectingId(parentId);
    setStatusMessage(null);
    try {
      const removed = await disconnectTelegramParent(studentId, parentId);
      setParents(current => current.filter(parent => parent.id !== parentId));
      await loadParents();
      setStatusMessage({ kind: removed ? 'ok' : 'error', text: removed ? 'disconnected' : 'notFound' });
    } catch (error) {
      console.error('Telegram disconnect failed', error);
      setStatusMessage({ kind: 'error', text: 'failed' });
    } finally {
      setDisconnectingId(null);
      setConfirmDisconnectId(null);
    }
  };
  const createLink = async () => {
    setLoading(true);
    try {
      const data = await createTelegramLink(studentId);
      setLink(data.url);
      setExpiresAt(data.expiresAt);
      setWaitingForLink(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadParents(); }, [studentId]);
  useEffect(() => {
    if (!waitingForLink) return;
    let alive = true;
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts += 1;
      const nextParents = await listTelegramParents(studentId);
      if (!alive) return;
      setParents(nextParents);
      if (nextParents.length > 0 || attempts >= 12) {
        setWaitingForLink(false);
        window.clearInterval(interval);
      }
    }, 2500);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [studentId, waitingForLink]);

  const text = {
    ru: {
      title: 'Telegram для родителей',
      desc: 'Подключите Telegram, чтобы родители получали напоминания, домашние задания, оценки и переносы уроков.',
      button: 'Подключить Telegram',
      copy: copied ? 'Скопировано' : 'Скопировать ссылку',
      expires: 'Ссылка активна до',
      linked: 'Подключённые родители',
      empty: 'Пока нет подключённых родителей',
      refresh: 'Обновить',
      disconnect: 'Отключить',
      confirm: 'Точно отключить?',
      cancel: 'Отмена',
      disconnected: 'Родитель отключён',
      notFound: 'Связь уже отключена',
      failed: 'Не удалось отключить. Попробуйте ещё раз.',
      settings: 'Настройки уведомлений меняются в боте: напоминания, домашки, оценки, переносы и отмены.',
      waiting: 'Ждём подтверждения из Telegram...',
      linkedAt: 'Подключён',
      prefs: ['Напоминания', 'Домашки', 'Оценки', 'Расписание'],
    },
    ua: {
      title: 'Telegram для батьків',
      desc: 'Підключіть Telegram, щоб батьки отримували нагадування, домашні завдання, оцінки та перенесення уроків.',
      button: 'Підключити Telegram',
      copy: copied ? 'Скопійовано' : 'Скопіювати посилання',
      expires: 'Посилання активне до',
      linked: 'Підключені батьки',
      empty: 'Поки немає підключених батьків',
      refresh: 'Оновити',
      disconnect: 'Відключити',
      confirm: 'Точно відключити?',
      cancel: 'Скасувати',
      disconnected: 'Батька відключено',
      notFound: "Зв'язок вже відключено",
      failed: 'Не вдалося відключити. Спробуйте ще раз.',
      settings: 'Налаштування сповіщень змінюються в боті: нагадування, домашки, оцінки, перенесення та скасування.',
      waiting: 'Чекаємо підтвердження з Telegram...',
      linkedAt: 'Підключено',
      prefs: ['Нагадування', 'Домашки', 'Оцінки', 'Розклад'],
    },
    en: {
      title: 'Telegram for parents',
      desc: 'Connect Telegram so parents receive reminders, homework, grades, reschedules and cancellations.',
      button: 'Connect Telegram',
      copy: copied ? 'Copied' : 'Copy link',
      expires: 'Link active until',
      linked: 'Connected parents',
      empty: 'No connected parents yet',
      refresh: 'Refresh',
      disconnect: 'Disconnect',
      confirm: 'Really disconnect?',
      cancel: 'Cancel',
      disconnected: 'Parent disconnected',
      notFound: 'This link is already disconnected',
      failed: 'Could not disconnect. Please try again.',
      settings: 'Notification settings are changed in the bot: reminders, homework, grades, reschedules and cancellations.',
      waiting: 'Waiting for Telegram confirmation...',
      linkedAt: 'Linked',
      prefs: ['Reminders', 'Homework', 'Grades', 'Schedule'],
    },
  }[lang];
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';

  return (
    <div className="relative overflow-visible">
      <div className="glass relative overflow-hidden rounded-3xl p-6 border border-sky-100 bg-white">
        <img
          src="/dashboard/telegram-parents-bg.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full scale-[1.08] select-none object-cover dark:hidden"
        />
        <img
          src="/dashboard/telegram-parents-bg-dark.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden h-full w-full scale-[1.08] select-none object-cover dark:block"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/70 via-white/34 to-white/8 dark:hidden" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h3 className="font-display font-bold text-xl text-purple-700 mb-1 dark:text-violet-50">💬 {text.title}</h3>
          <p className="font-body text-sm text-purple-400 max-w-2xl dark:text-violet-100/78">{text.desc}</p>
          <p className="font-body text-xs text-purple-400 mt-2 dark:text-violet-200/65">{text.settings}</p>
        </div>
        <button onClick={createLink} disabled={loading}
          className="btn-magic px-5 py-3 text-white text-sm font-display font-bold disabled:opacity-60 flex-shrink-0">
          {loading ? '...' : text.button}
        </button>
      </div>

      {link && (
        <div className="relative z-10 mt-4 rounded-2xl bg-white/80 border border-purple-100 p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input readOnly value={link} className="input-magic text-sm py-2 flex-1" onFocus={e => e.currentTarget.select()} />
            <button onClick={copy} className="btn-outline px-4 py-2 text-sm font-display font-bold">{text.copy}</button>
          </div>
          {expiresAt && (
            <p className="font-body text-xs text-purple-400 mt-2">
              {text.expires}: {new Date(expiresAt).toLocaleString(lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU')}
            </p>
          )}
          {waitingForLink && <p className="mt-2 font-body text-xs font-700 text-sky-500">{text.waiting}</p>}
        </div>
      )}

      <div className="relative z-10 mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="font-body font-700 text-sm text-purple-600 dark:text-violet-100">{text.linked}</div>
          <button onClick={refreshParents} disabled={refreshing} className="rounded-xl bg-white/70 px-3 py-1.5 font-body text-xs font-800 text-purple-500 hover:bg-pink-50 disabled:opacity-60 dark:bg-[#251143]/72 dark:text-violet-100 dark:hover:bg-[#311858]">
            {refreshing ? '...' : text.refresh}
          </button>
        </div>
        {parents.length === 0 ? (
          <div className="font-body text-sm text-purple-400 bg-white/60 rounded-2xl px-4 py-3 dark:bg-[#251143]/70 dark:text-violet-100/75">{text.empty}</div>
        ) : (
          <div className="grid gap-2">
            {parents.map(parent => (
              <div key={parent.id} className="rounded-2xl bg-white/70 border border-purple-100 px-4 py-3 dark:border-violet-300/16 dark:bg-[#251143]/74">
                <div className="font-body font-700 text-purple-700 text-sm dark:text-violet-50">
                  {parent.parentName || parent.telegramUsername || 'Telegram'}
                </div>
                <div className="mt-0.5 font-body text-xs text-purple-400 dark:text-violet-200/72">
                  {parent.telegramUsername ? `@${parent.telegramUsername.replace(/^@/, '')}` : 'Telegram'} · {parent.language.toUpperCase()}
                </div>
                {parent.linkedAt && (
                  <div className="mt-1 font-body text-[11px] font-700 text-purple-300 dark:text-violet-200/55">
                    {text.linkedAt}: {new Date(parent.linkedAt).toLocaleString(locale)}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    parent.notifyLessonReminders,
                    parent.notifyHomework,
                    parent.notifyGrades,
                    parent.notifyScheduleChanges,
                  ].map((enabled, index) => (
                    <span key={text.prefs[index]} className={`rounded-full px-2 py-1 font-body text-[10px] font-800 ${enabled ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      {text.prefs[index]}
                    </span>
                  ))}
                </div>
                {confirmDisconnectId === parent.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-body text-xs font-800 text-red-500">{text.confirm}</span>
                    <button
	                      type="button"
	                      onClick={() => disconnectParent(parent.id)}
	                      disabled={disconnectingId === parent.id}
	                      className="telegram-disconnect-button rounded-xl border border-red-200 bg-red-100 px-3 py-1.5 font-body text-xs font-800 text-red-600 hover:bg-red-200 disabled:opacity-60"
                    >
                      {disconnectingId === parent.id ? '...' : text.disconnect}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDisconnectId(null)}
                      className="rounded-xl bg-white/80 px-3 py-1.5 font-body text-xs font-800 text-purple-500 hover:bg-purple-50"
                    >
                      {text.cancel}
                    </button>
                  </div>
                ) : (
                  <button
	                    type="button"
	                    onClick={() => { setStatusMessage(null); setConfirmDisconnectId(parent.id); }}
	                    className="telegram-disconnect-button mt-2 rounded-xl border border-red-100 bg-red-50/70 px-3 py-1.5 font-body text-xs font-800 text-red-500 hover:bg-red-100"
	                  >
                    {text.disconnect}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {statusMessage && (
          <div className={`mt-2 rounded-2xl px-4 py-2 font-body text-xs font-800 ${statusMessage.kind === 'ok' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {text[statusMessage.text as 'disconnected' | 'notFound' | 'failed']}
          </div>
        )}
      </div>
      </div>
      <img
        src="/dashboard/telegram-phone-sticker.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-0.4rem] right-[-1.1rem] z-20 h-32 w-auto select-none object-contain drop-shadow-[0_16px_20px_rgba(88,28,135,0.18)] dark:hidden md:h-40"
      />
      <img
        src="/dashboard/telegram-phone-sticker-dark.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-0.8rem] right-[-1.1rem] z-20 hidden h-[8.5rem] w-auto select-none object-contain drop-shadow-[0_18px_24px_rgba(88,28,135,0.28)] dark:block md:h-[10.5rem]"
      />
    </div>
  );
}

// ---- File modal (unlocked) ----
function FileModal({ item, userId, canSubmitWork, onClose, onSubmitted, onStartInteractive, lang }: { item: ContentItem; userId: string; canSubmitWork: boolean; onClose: () => void; onSubmitted: () => Promise<void>; onStartInteractive?: (item: ContentItem) => void; lang: Lang }) {
  const dataUrl = item.fileUrl || item.fileDataUrl || '';
  const hasContent = !!dataUrl || !!item.externalLink;
  const hasInteractive = !!item.interactiveLessonId;
  const isImage = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(dataUrl) || dataUrl.startsWith('data:image');
  const isAudio = /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(dataUrl) || dataUrl.startsWith('data:audio') || (item.type === 'listening' && !!dataUrl);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';
  const submittedText = lang === 'en' ? 'Submitted' : lang === 'ua' ? 'Здано' : 'Сдано';
  const submitTitle = lang === 'en' ? 'Send completed work' : lang === 'ua' ? 'Надіслати виконану роботу' : 'Отправить выполненную работу';
  const chooseText = lang === 'en' ? 'Choose photo or file' : lang === 'ua' ? 'Вибрати фото або файл' : 'Выбрать фото или файл';
  const sendText = lang === 'en' ? 'Send to teacher' : lang === 'ua' ? 'Надіслати вчителю' : 'Отправить учителю';
  const sentText = lang === 'en' ? 'Work sent to teacher' : lang === 'ua' ? 'Роботу надіслано вчителю' : 'Работа отправлена учителю';
  const noFileText = lang === 'en' ? 'Choose a file first' : lang === 'ua' ? 'Спочатку виберіть файл' : 'Сначала выберите файл';
  const alreadyGradedText = lang === 'en' ? 'Already graded' : lang === 'ua' ? 'Вже оцінено' : 'Уже оценено';
  const teacherReviewText = lang === 'en' ? 'Teacher feedback' : lang === 'ua' ? 'Відгук учителя' : 'Отзыв учителя';
  const checkedText = lang === 'en' ? 'Checked' : lang === 'ua' ? 'Перевірено' : 'Проверено';
  const revisionText = lang === 'en' ? 'Needs revision' : lang === 'ua' ? 'Потрібно доопрацювати' : 'Нужно доработать';
  const unavailableText = lang === 'en'
    ? 'File is unavailable for download'
    : lang === 'ua'
      ? 'Файл недоступний для завантаження'
      : 'Файл недоступен для скачивания';
  const handleDownload = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDownloadError('');
    setIsDownloading(true);
    try {
      await openOrDownload(item);
    } catch (error) {
      console.error('download failed', error);
      setDownloadError(unavailableText);
    } finally {
      setIsDownloading(false);
    }
  };
  const canUploadSubmission = canSubmitWork && isGradedContentType(item.type) && !(item.starRating && item.starRating > 0);
  const teacherFeedback = (item.reviewComment || item.teacherComment || '').trim();
  const isRevisionRequested = item.homeworkStatus === 'revision_requested' || item.studentResult === 'Revision Requested';
  const isInteractiveReviewed = !!item.interactiveCompletedAt || item.studentResult === 'Interactive completed' || item.interactiveScorePercent != null;
  const handleSubmitWork = async () => {
    if (!submissionFile) {
      setSubmitMessage(noFileText);
      return;
    }
    setIsSubmitting(true);
    setSubmitMessage('');
    try {
      await submitStudentContentWork(userId, item.id, submissionFile);
      setSubmissionFile(null);
      setSubmitMessage(sentText);
      await onSubmitted();
    } catch (error) {
      console.error('submit homework failed', error);
      setSubmitMessage(error instanceof Error ? error.message : noFileText);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(80,40,120,0.6)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.85, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 40 }}
        className="glass rounded-3xl p-6 max-w-lg w-full shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-4xl mb-1">{item.emoji}</div>
            <h3 className="font-display font-black text-xl text-purple-700 leading-snug pr-4">{item.title}</h3>
            {item.dueDate && item.dueDate.length > 0 && (
              <p className="font-body text-sm text-purple-400 mt-1">
                📅 {t(lang, 'dash_due')}{' '}
                {new Date(item.dueDate).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            {item.scheduledDate && item.scheduledDate.length > 0 && (
              <p className="font-body text-sm text-blue-400 mt-0.5">
                🗓 {item.scheduledDate} {item.scheduledTime}
              </p>
            )}
            {item.submittedAt && (
              <p className="font-body text-sm text-green-500 mt-0.5">
                ✅ {submittedText}: {new Date(item.submittedAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-purple-300 hover:text-pink-500 text-4xl leading-none flex-shrink-0 transition-colors">×</button>
        </div>

        {/* Content */}
        {(hasContent || hasInteractive) ? (
          <div className="space-y-4">
            {hasInteractive && (
              <div className="rounded-2xl border border-pink-100 bg-gradient-to-br from-white via-pink-50/70 to-purple-50/70 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <span className="student-accent-gradient grid h-11 w-11 place-items-center rounded-2xl text-xl text-white shadow-sm">🎮</span>
                  <div>
                    <div className="font-display font-bold text-purple-700">
                      {lang === 'en' ? 'Interactive task' : lang === 'ua' ? 'Інтерактивне завдання' : 'Интерактивное задание'}
                    </div>
                    <p className="font-body text-xs font-700 text-purple-300">
                      {item.interactiveCompletedAt
                        ? (lang === 'en' ? 'Completed' : lang === 'ua' ? 'Виконано' : 'Выполнено')
                        : (lang === 'en' ? 'Open and complete it here' : lang === 'ua' ? 'Відкрийте та виконайте тут' : 'Откройте и выполните здесь')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onStartInteractive?.(item)}
                  className="btn-magic w-full py-3.5 font-display font-bold text-white"
                >
                  {item.interactiveCompletedAt
                    ? (lang === 'en' ? 'Open again' : lang === 'ua' ? 'Відкрити ще раз' : 'Открыть снова')
                    : (lang === 'en' ? 'Start interactive' : lang === 'ua' ? 'Почати інтерактив' : 'Начать интерактив')}
                </button>
              </div>
            )}
            {/* Audio player */}
            {dataUrl && isAudio && <AudioPlayer dataUrl={dataUrl} />}

            {/* Image preview */}
            {dataUrl && isImage && !isAudio && (
              <div className="rounded-2xl overflow-hidden border border-purple-100 bg-white shadow-sm">
                <img src={dataUrl} alt={item.title} className="w-full max-h-72 object-contain" />
              </div>
            )}

            {/* Other file (PDF, doc etc) */}
            {dataUrl && !isImage && !isAudio && item.fileName && (
              <div className="flex items-center gap-3 bg-purple-50 rounded-2xl p-4 border border-purple-100">
                <span className="text-4xl">📄</span>
                <div>
                  <p className="font-body font-600 text-purple-700 text-sm">{item.fileName}</p>
                  <p className="font-body text-xs text-purple-400">{t(lang, 'dash_file_click_download')}</p>
                </div>
              </div>
            )}

            {/* External link only */}
            {!dataUrl && item.externalLink && (
              <div className="flex items-center gap-3 bg-purple-50 rounded-2xl p-4 border border-purple-100">
                <span className="text-4xl">🔗</span>
                <div className="min-w-0">
                  <p className="font-body font-600 text-purple-700 text-sm truncate">{item.externalLink}</p>
                </div>
              </div>
            )}

            {/* Download button — prevent long-press context menu on mobile */}
            {hasContent && (
              <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-4 border border-pink-100">
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="btn-magic w-full py-3.5 text-white font-display font-bold text-base flex items-center justify-center gap-3 select-none disabled:cursor-wait disabled:opacity-70"
                >
                  <span className="text-xl">{isDownloading ? '…' : item.externalLink ? '🔗' : '⬇️'}</span>
                  {isDownloading
                    ? (lang === 'en' ? 'Preparing...' : lang === 'ua' ? 'Готуємо...' : 'Готовим...')
                    : item.externalLink
                    ? (lang === 'en' ? 'Open link' : lang === 'ua' ? 'Відкрити посилання' : 'Открыть ссылку')
                    : t(lang, 'dash_download')}
                </button>
                {downloadError && (
                  <p className="mt-2 text-center font-body text-xs font-700 text-rose-500">{downloadError}</p>
                )}
              </div>
            )}

            {/* Star rating */}
            {item.starRating && item.starRating > 0 && (
              <div className="flex items-center gap-3 bg-yellow-50 rounded-2xl p-3 border border-yellow-100">
                <span className="font-body text-sm text-yellow-700 font-600">{t(lang, 'dash_grade_label')}</span>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} className={`text-2xl ${s <= item.starRating! ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                  ))}
                </div>
              </div>
            )}

            {(teacherFeedback || item.checkedAt || isRevisionRequested || isInteractiveReviewed) && (
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/70 to-yellow-50/60 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/85 px-3 py-1 font-body text-xs font-900 text-emerald-600 shadow-sm">
                    {isRevisionRequested ? `🔁 ${revisionText}` : `✅ ${checkedText}`}
                  </span>
                  {item.checkedAt && (
                    <span className="font-body text-xs font-700 text-purple-300">
                      {new Date(item.checkedAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <div className="font-display font-bold text-purple-700">{teacherReviewText}</div>
                <p className="mt-1 whitespace-pre-wrap font-body text-sm leading-6 text-purple-500">
                  {teacherFeedback || (isRevisionRequested ? revisionText : checkedText)}
                  {isInteractiveReviewed && item.interactiveScorePercent != null ? ` · ${item.interactiveScorePercent}%` : ''}
                </p>
              </div>
            )}

            {isGradedContentType(item.type) && (
              <div className="rounded-2xl border border-pink-100 bg-gradient-to-br from-white via-pink-50/60 to-purple-50/60 p-4">
                <div className="mb-3 font-display font-bold text-purple-700">{submitTitle}</div>
                {item.submittedAttachmentName && (
                  <div className="mb-3 rounded-2xl bg-white/80 px-3 py-2 font-body text-xs font-700 text-purple-500">
                    📎 {item.submittedAttachmentName}
                  </div>
                )}
                {canUploadSubmission ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-pink-100 bg-white px-4 py-3 font-body text-sm font-800 text-purple-600 shadow-sm transition hover:bg-pink-50">
                      {submissionFile ? submissionFile.name : chooseText}
                      <input
                        type="file"
                        accept="image/*,application/pdf,.doc,.docx,audio/*"
                        className="hidden"
                        onChange={event => setSubmissionFile(event.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleSubmitWork}
                      disabled={isSubmitting}
                      className="btn-magic px-5 py-3 font-display font-bold text-white disabled:opacity-60"
                    >
                      {isSubmitting ? '...' : sendText}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white/75 px-3 py-2 font-body text-sm font-700 text-purple-400">
                    {item.starRating && item.starRating > 0 ? alreadyGradedText : submittedText}
                  </div>
                )}
                {submitMessage && <p className="mt-2 font-body text-xs font-800 text-pink-500">{submitMessage}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center py-10 bg-purple-50 rounded-2xl">
              <div className="text-5xl mb-3">📎</div>
              <p className="font-body text-purple-500 font-600">{t(lang, 'dash_no_file')}</p>
              <p className="font-body text-purple-400 text-sm mt-1">{t(lang, 'dash_file_added_soon')}</p>
            </div>
            {isGradedContentType(item.type) && (
              <div className="rounded-2xl border border-pink-100 bg-gradient-to-br from-white via-pink-50/60 to-purple-50/60 p-4">
                {(teacherFeedback || item.checkedAt || isRevisionRequested) && (
                  <div className="mb-3 rounded-2xl border border-emerald-100 bg-white/80 px-3 py-2">
                    <div className="font-body text-xs font-900 text-emerald-600">{teacherReviewText}</div>
                    <p className="mt-1 whitespace-pre-wrap font-body text-sm leading-5 text-purple-500">
                      {teacherFeedback || (isRevisionRequested ? revisionText : checkedText)}
                    </p>
                  </div>
                )}
                <div className="mb-3 font-display font-bold text-purple-700">{submitTitle}</div>
                {item.submittedAttachmentName && (
                  <div className="mb-3 rounded-2xl bg-white/80 px-3 py-2 font-body text-xs font-700 text-purple-500">
                    📎 {item.submittedAttachmentName}
                  </div>
                )}
                {canUploadSubmission ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-pink-100 bg-white px-4 py-3 font-body text-sm font-800 text-purple-600 shadow-sm transition hover:bg-pink-50">
                      {submissionFile ? submissionFile.name : chooseText}
                      <input
                        type="file"
                        accept="image/*,application/pdf,.doc,.docx,audio/*"
                        className="hidden"
                        onChange={event => setSubmissionFile(event.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleSubmitWork}
                      disabled={isSubmitting}
                      className="btn-magic px-5 py-3 font-display font-bold text-white disabled:opacity-60"
                    >
                      {isSubmitting ? '...' : sendText}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white/75 px-3 py-2 font-body text-sm font-700 text-purple-400">
                    {item.starRating && item.starRating > 0 ? alreadyGradedText : submittedText}
                  </div>
                )}
                {submitMessage && <p className="mt-2 font-body text-xs font-800 text-pink-500">{submitMessage}</p>}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ---- Locked modal ----
function LockedModal({ item, onClose, lang }: { item: ContentItem; onClose: () => void; lang: Lang }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(80,40,120,0.5)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.85, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85 }}
        className="glass rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
        onClick={e => e.stopPropagation()}>
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }} className="text-6xl mb-4">🔒</motion.div>
        <h3 className="font-display font-black text-xl text-purple-700 mb-2">{item.title}</h3>
        <p className="font-body text-purple-500 text-sm mb-6">
          {item.type === 'homework' ? t(lang, 'dash_hw_locked') :
           item.type === 'practice' ? t(lang, 'dash_practice_locked') :
           t(lang, 'dash_lesson_locked')}
        </p>
        <a href="https://t.me/vetoschool_bot" target="_blank" rel="noopener noreferrer"
          className="btn-magic px-6 py-3 text-white font-display font-bold text-sm inline-block mb-3">
          {t(lang, 'dash_contact_teacher')}
        </a>
        <br />
        <button onClick={onClose} className="font-body text-sm text-purple-400 hover:text-pink-500 mt-2">
          {t(lang, 'dash_close')}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ---- Content card ----
function ContentCard({ item, lang, onClick }: { item: ContentItem; lang: Lang; onClick: () => void }) {
  const isLocked = !item.unlocked;
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';
  const teacherFeedback = (item.reviewComment || item.teacherComment || '').trim();
  const checkedText = lang === 'en' ? 'Checked' : lang === 'ua' ? 'Перевірено' : 'Проверено';
  const revisionText = lang === 'en' ? 'Needs revision' : lang === 'ua' ? 'Потрібно доопрацювати' : 'Нужно доработать';
  const isRevisionRequested = item.homeworkStatus === 'revision_requested' || item.studentResult === 'Revision Requested';
  const isInteractiveReviewed = !!item.interactiveCompletedAt || item.studentResult === 'Interactive completed' || item.interactiveScorePercent != null;
  const colorMap: Record<string, string> = {
    lesson: 'from-pink-50 to-rose-50 border-pink-200',
    homework: 'from-purple-50 to-violet-50 border-purple-200',
    practice: 'from-blue-50 to-cyan-50 border-blue-200',
    grammar: 'from-yellow-50 to-amber-50 border-yellow-200',
    listening: 'from-green-50 to-teal-50 border-green-200',
    checkpoint: 'from-orange-50 to-amber-50 border-orange-200',
  };
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: isLocked ? 1.01 : 1.03, y: isLocked ? 0 : -4 }}
      onClick={onClick}
      className={`bg-gradient-to-br ${colorMap[item.type] || colorMap.lesson} border rounded-3xl p-5 cursor-pointer relative overflow-hidden transition-shadow hover:shadow-lg`}
    >
      {isLocked && <div className="absolute top-3 right-3 text-xl opacity-60">🔒</div>}
      {!isLocked && item.fileDataUrl && (
        <div className="absolute top-3 right-3 text-xs bg-white/80 text-purple-500 px-2 py-0.5 rounded-full font-body font-600 shadow-sm">📎</div>
      )}
      {!isLocked && item.interactiveLessonId && (
        <div className="absolute top-3 right-3 text-xs bg-white/80 text-blue-500 px-2 py-0.5 rounded-full font-body font-600 shadow-sm">🎮</div>
      )}
      <div className="text-4xl mb-3">{item.emoji}</div>
      <h4 className={`font-display font-bold text-base mb-2 leading-snug pr-10 ${isLocked ? 'text-gray-400' : 'text-purple-700'}`}>
        {item.title}
      </h4>
      {item.dueDate && item.dueDate.length > 0 && (
        <p className="font-body text-xs text-purple-400 mb-1">
          📅 {t(lang, 'dash_due')} {new Date(item.dueDate).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
        </p>
      )}
      {item.scheduledDate && item.scheduledDate.length > 0 && (
        <p className="font-body text-xs text-blue-400 mb-1">🗓 {item.scheduledDate} {item.scheduledTime}</p>
      )}
      {item.submittedAt && (
        <p className="font-body text-xs text-green-500 mb-1">
          ✅ {lang === 'en' ? 'Submitted' : lang === 'ua' ? 'Здано' : 'Сдано'}
        </p>
      )}
      {item.starRating && item.starRating > 0 && (
        <div className="flex gap-0.5 my-1">
          {[1,2,3,4,5].map(s => (
            <span key={s} className={`text-base ${s <= item.starRating! ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
          ))}
        </div>
      )}
      {(item.checkedAt || teacherFeedback || isRevisionRequested || isInteractiveReviewed) && (
        <div className="mt-2 rounded-2xl border border-white/75 bg-white/80 px-3 py-2 shadow-sm">
          <div className={`font-body text-xs font-800 ${isRevisionRequested ? 'text-orange-500' : 'text-emerald-600'}`}>
            {isRevisionRequested ? `🔁 ${revisionText}` : `✅ ${checkedText}`}
          </div>
          {isInteractiveReviewed && item.interactiveScorePercent != null && (
            <p className="mt-1 font-body text-xs font-800 text-emerald-500">
              {item.interactiveScorePercent}%
            </p>
          )}
          {teacherFeedback && (
            <p className="mt-1 line-clamp-2 font-body text-xs leading-5 text-purple-500">
              {teacherFeedback}
            </p>
          )}
        </div>
      )}
      <div className={`mt-3 text-xs font-body font-600 px-3 py-1.5 rounded-full inline-block ${
        isLocked ? 'bg-gray-100 text-gray-400' : 'bg-white/80 text-purple-600 shadow-sm'
      }`}>
        {isLocked ? `🔒 ${t(lang, 'dash_locked_item')}` : `👆 ${t(lang, 'dash_tap_to_view')}`}
      </div>
    </motion.div>
  );
}

// ---- Empty section ----
function EmptySection({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-12 text-center">
      <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }} className="text-6xl mb-4">{emoji}</motion.div>
      <h3 className="font-display font-bold text-2xl text-purple-700 mb-2">{title}</h3>
      <p className="font-body text-purple-400">{desc}</p>
    </motion.div>
  );
}

function RatingStatIcon() {
	return (
	  <img
	    src={RATING_STAR_SRC}
	    alt=""
	    className="h-14 w-14 translate-y-[3px] object-contain drop-shadow-[0_8px_9px_rgba(217,119,6,0.18)]"
	    aria-hidden="true"
    />
  );
}

// ================================================================
export default function Dashboard({ lang: propLang }: { lang: Lang }) {
  const [lang, setLang] = useState<Lang>(propLang);
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const previewUserId = searchParams.get('preview');
  const isPreview = !!previewUserId;
  const initialTabParam = searchParams.get('tab');
  const allowedTabs: Tab[] = ['overview', 'interactive', 'lessons', 'homework', 'schedule', 'practice', 'grammar', 'listening', 'checkpoint', 'dictionary', 'grades', 'shop'];
  const initialTab = allowedTabs.includes(initialTabParam as Tab) ? initialTabParam as Tab : 'overview';

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [greeting, setGreeting] = useState('');
  const [schedule, setSchedule] = useState<ReturnType<typeof getStudentSchedule>>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [assignedInteractive, setAssignedInteractive] = useState<{ item: ContentItem; lesson: WorkbookLesson } | null>(null);
  const [starProfile, setStarProfile] = useState({ starBalance: 0, totalEarned: 0, pendingCelebration: 0, avatarId: null as string | null });
  const [celebrationAmount, setCelebrationAmount] = useState(0);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');
  const [isWelcomeScrolledUnderHeader, setIsWelcomeScrolledUnderHeader] = useState(false);

  const effectiveUserId = previewUserId || user?.id || '';
  const billingAccessStatus = billing?.access_status || user?.accessStatus || null;
  const billingHasAccess = Boolean(
    billing?.has_access
    || billingAccessStatus === 'active'
    || shouldShowActiveTariff({
      paymentStatus: billing?.payment_status,
      subscriptionStatus: billing?.subscription_status,
      stripeCustomerId: billing?.stripe_customer_id || user?.stripeCustomerId,
      stripeSubscriptionId: billing?.stripe_subscription_id || user?.stripeSubscriptionId,
      cancelAtPeriodEnd: billing?.cancel_at_period_end,
      manualAccessOverride: billing?.manual_access_override,
      accessStatus: billingAccessStatus,
    }),
  );
  const isLimitedAccess = Boolean(user?.role === 'student' && !billingHasAccess && !isPreview);
  const langs: Lang[] = ['ru', 'en', 'ua'];

  const refreshStars = useCallback(async () => {
    if (!effectiveUserId) return;
    const p = await loadStarProfile(effectiveUserId);
    setStarProfile(p);
    if (!isPreview && p.pendingCelebration > 0) {
      setCelebrationAmount(p.pendingCelebration);
      await clearCelebration(effectiveUserId);
    }
  }, [effectiveUserId, isPreview]);

  const refreshStudentData = useCallback(async () => {
    if (!effectiveUserId) return;
    const billingQuery = supabase
      .from('profiles')
      .select('access_status,has_access,payment_status,payment_failed_at,stripe_customer_id,stripe_subscription_id,stripe_price_id,subscription_status,cancel_at_period_end,canceled_at,plan_id,lesson_format,lessons_total,lessons_remaining,current_period_start,current_period_end,next_payment_date,manual_access_override,manual_access_override_by,manual_access_override_at')
      .eq('id', effectiveUserId)
      .maybeSingle();

    if (isLimitedAccess) {
      const [, billingResult] = await Promise.all([
        refreshStars(),
        billingQuery,
      ]);
      setContent([]);
      if (billingResult.data) setBilling(billingResult.data);
      setSelectedItem(null);
      return;
    }

    const [freshContent, billingResult] = await Promise.all([
      loadStudentContent(effectiveUserId),
      billingQuery,
      refreshStars(),
    ]);
    setContent(freshContent);
    if (billingResult.data) setBilling(billingResult.data);
    setSelectedItem(prev => prev ? freshContent.find(item => item.id === prev.id) || prev : prev);
  }, [effectiveUserId, isLimitedAccess, refreshStars]);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const h = new Date().getHours();
    setGreeting(h < 12 ? t(lang, 'dash_morning') : h < 17 ? t(lang, 'dash_afternoon') : t(lang, 'dash_evening'));
    loadStudentSchedule(effectiveUserId).then(setSchedule);
    refreshStudentData();
  }, [user, navigate, lang, effectiveUserId, refreshStudentData]);

  useEffect(() => {
    if (!effectiveUserId || isPreview) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshStudentData();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const interval = window.setInterval(() => void refreshStudentData(), 15000);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, [effectiveUserId, isPreview, refreshStudentData]);

  useEffect(() => { setLang(propLang); }, [propLang]);

  useEffect(() => {
    if (isLimitedAccess && activeTab !== 'overview') setActiveTab('overview');
  }, [activeTab, isLimitedAccess]);

  useEffect(() => {
    const updateWelcomeLayer = () => setIsWelcomeScrolledUnderHeader(window.scrollY > 8);
    updateWelcomeLayer();
    window.addEventListener('scroll', updateWelcomeLayer, { passive: true });
    return () => window.removeEventListener('scroll', updateWelcomeLayer);
  }, []);

  if (!user) return null;

  const handleLogout = async () => { await logout(); navigate('/'); };
  const handleShopBack = () => {
    setActiveTab('overview');
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  };
  const handleItemClick = (item: ContentItem) => { setSelectedItem(item); setShowModal(true); };
  const friendlyPortalError = (error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Log in')) {
      return lang === 'en' ? 'Log in to manage your subscription.' : lang === 'ua' ? 'Увійдіть, щоб керувати підпискою.' : 'Войдите, чтобы управлять подпиской.';
    }
    if (message.includes('No Stripe subscription')) {
      return lang === 'en'
        ? 'No Stripe subscription is connected to this account yet.'
        : lang === 'ua'
          ? 'До цього акаунта ще не підключена Stripe-підписка.'
          : 'К этому аккаунту пока не подключена Stripe-подписка.';
    }
    return lang === 'en'
      ? 'Could not open subscription management.'
      : lang === 'ua'
        ? 'Не вдалося відкрити керування підпискою.'
        : 'Не удалось открыть управление подпиской.';
  };
  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setPortalError('');
    try {
      await redirectToStripeCustomerPortal();
    } catch (error) {
      setPortalError(friendlyPortalError(error));
      setPortalLoading(false);
    }
  };
  const startAssignedInteractive = async (item: ContentItem) => {
    if (!item.interactiveLessonId) return;
    const lesson = await getLessonById(item.interactiveLessonId);
    if (!lesson) return;
    setShowModal(false);
    setAssignedInteractive({ item, lesson });
  };

  const lessons = content.filter(i => i.type === 'lesson');
  const homework = content.filter(i => i.type === 'homework');
  const practice = content.filter(i => i.type === 'practice');
  const grammar = content.filter(i => i.type === 'grammar');
  const listening = content.filter(i => i.type === 'listening');
  const checkpoint = content.filter(i => i.type === 'checkpoint');
  const completedLessons = lessons.filter(l => l.unlocked).length;
  const recentLesson = lessons[lessons.length - 1] || null;
  const recentLessonCompleted = Boolean(
    recentLesson?.interactiveCompletedAt ||
    recentLesson?.checkedAt ||
    (recentLesson?.starRating && recentLesson.starRating > 0)
  );
  const recentLessonUnlocked = Boolean(recentLesson?.unlocked);
  const { avg: ratingAvg } = getStudentRating(effectiveUserId);
  const ratingFullStars = Math.max(0, Math.min(5, Math.floor(ratingAvg)));
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';
  const billingPlanId = billing?.plan_id && billing.plan_id in pricingPlanNameKeys ? billing.plan_id as PricingPlanId : null;
  const billingKind = activeSubscriptionStatus({
    paymentStatus: billing?.payment_status,
    subscriptionStatus: billing?.subscription_status,
    stripeCustomerId: billing?.stripe_customer_id || user.stripeCustomerId,
    stripeSubscriptionId: billing?.stripe_subscription_id || user.stripeSubscriptionId,
    cancelAtPeriodEnd: billing?.cancel_at_period_end,
    manualAccessOverride: billing?.manual_access_override,
    accessStatus: billingAccessStatus,
  });
  const hasVisibleTariff = shouldShowActiveTariff({
    paymentStatus: billing?.payment_status,
    subscriptionStatus: billing?.subscription_status,
    stripeCustomerId: billing?.stripe_customer_id || user.stripeCustomerId,
    stripeSubscriptionId: billing?.stripe_subscription_id || user.stripeSubscriptionId,
    cancelAtPeriodEnd: billing?.cancel_at_period_end,
    manualAccessOverride: billing?.manual_access_override,
    accessStatus: billingAccessStatus,
  });
  const billingPlanName = hasVisibleTariff
    ? (billingPlanId ? t(lang, pricingPlanNameKeys[billingPlanId]) : billing?.plan_id || (billingKind === 'manual_access' ? billingStatusLabel('manual_access', lang) : '—'))
    : (lang === 'en' ? 'No active plan' : lang === 'ua' ? 'Немає активного тарифу' : 'Нет активного тарифа');
  const billingFormat = billing?.lesson_format === 'individual'
    ? (lang === 'en' ? 'Individual' : lang === 'ua' ? 'Індивідуально' : 'Индивидуально')
    : billing?.lesson_format === 'group'
      ? (lang === 'en' ? 'Group' : lang === 'ua' ? 'Група' : 'Группа')
      : '—';
  const hasPaymentProblem = billingKind === 'payment_failed';
  const isSubscriptionCanceled = billing?.subscription_status === 'canceled';
  const isCancelAtPeriodEnd = billingKind === 'cancels_at_period_end';
  const billingStatus = billingStatusLabel(billingKind, lang);
  const paymentFailedLabel = lang === 'en' ? 'Failed charge' : lang === 'ua' ? 'Невдале списання' : 'Неуспешное списание';
  const updatePaymentMethodLabel = lang === 'en' ? 'Update payment method' : lang === 'ua' ? 'Оновити спосіб оплати' : 'Обновить способ оплаты';
  const nextPaymentLabel = lang === 'en' ? 'Next payment' : lang === 'ua' ? 'Наступний платіж' : 'Следующий платёж';
  const paidPeriodEndLabel = lang === 'en' ? 'Paid period ends' : lang === 'ua' ? 'Оплачений період до' : 'Оплаченный период до';
  const lessonsBalanceLabel = lang === 'en' ? 'Lessons remaining' : lang === 'ua' ? 'Залишок уроків' : 'Осталось уроков';
  const tariffLabel = lang === 'en' ? 'Current plan' : lang === 'ua' ? 'Поточний тариф' : 'Текущий тариф';
  const formatLabel = lang === 'en' ? 'Format' : lang === 'ua' ? 'Формат' : 'Формат';
  const nextPaymentDate = billing?.next_payment_date || billing?.current_period_end;
  const hasStripeCustomer = Boolean(billing?.stripe_customer_id || user.stripeCustomerId);
  const manageSubscriptionLabel = lang === 'en' ? 'Manage subscription' : lang === 'ua' ? 'Керування підпискою' : 'Управление подпиской';
  const changeTariffLabel = lang === 'en' ? 'Change tariff' : lang === 'ua' ? 'Змінити тариф' : 'Сменить тариф';
  const billingStatusTextClass = hasPaymentProblem || isSubscriptionCanceled
    ? 'text-red-500'
    : isCancelAtPeriodEnd
      ? 'text-amber-500'
      : billingKind === 'manual_access'
        ? 'text-blue-500'
        : 'text-purple-400';
  const billingDateLabel = isCancelAtPeriodEnd || isSubscriptionCanceled ? paidPeriodEndLabel : nextPaymentLabel;
  const limitedCopy = {
    ru: {
      banner: 'Кабинет уже открыт. Полный доступ появится после пробного урока, выбора тарифа или подтверждения администратором.',
      cta: 'Выбрать следующий шаг',
      title: 'Личный кабинет готов',
      desc: 'Пока уроки, домашние задания, интерактивы, оценки и материалы закрыты. Здесь можно записаться на пробный урок, выбрать тариф или написать нам в Telegram.',
      trial: 'Пробный урок',
      pricing: 'Выбрать тариф',
      telegram: 'Написать в Telegram',
      nowTitle: 'Сейчас доступно',
      nowDesc: 'Профиль, статус аккаунта, Telegram для родителей и выбор следующего шага.',
      lockedTitle: 'Откроется после активации',
      lockedDesc: 'Уроки, домашки, интерактивы, оценки, словарь, аудио и рейтинг.',
    },
    en: {
      banner: 'Your cabinet is open. Full access appears after a trial lesson, plan choice, or admin activation.',
      cta: 'Choose next step',
      title: 'Your cabinet is ready',
      desc: 'Lessons, homework, interactives, grades and materials are locked for now. You can book a trial lesson, choose a plan or message us on Telegram.',
      trial: 'Trial lesson',
      pricing: 'Choose plan',
      telegram: 'Message Telegram',
      nowTitle: 'Available now',
      nowDesc: 'Profile, account status, parent Telegram and next-step choices.',
      lockedTitle: 'Unlocks after activation',
      lockedDesc: 'Lessons, homework, interactives, grades, dictionary, audio and rating.',
    },
    ua: {
      banner: 'Кабінет уже відкритий. Повний доступ зʼявиться після пробного уроку, вибору тарифу або підтвердження адміністратором.',
      cta: 'Обрати наступний крок',
      title: 'Особистий кабінет готовий',
      desc: 'Поки уроки, домашні завдання, інтерактиви, оцінки й матеріали закриті. Тут можна записатися на пробний урок, обрати тариф або написати нам у Telegram.',
      trial: 'Пробний урок',
      pricing: 'Обрати тариф',
      telegram: 'Написати в Telegram',
      nowTitle: 'Доступно зараз',
      nowDesc: 'Профіль, статус акаунта, Telegram для батьків і вибір наступного кроку.',
      lockedTitle: 'Відкриється після активації',
      lockedDesc: 'Уроки, домашки, інтерактиви, оцінки, словник, аудіо й рейтинг.',
    },
  }[lang];

  const tabs: { id: Tab; label: string; iconSrc: string }[] = [
    { id: 'overview', label: t(lang, 'dash_overview'), iconSrc: '/dashboard/menu-icons/overview.png' },
    { id: 'interactive', label: t(lang, 'dash_interactive'), iconSrc: '/dashboard/menu-icons/interactive.png' },
    { id: 'lessons', label: t(lang, 'dash_lessons'), iconSrc: '/dashboard/menu-icons/lessons.png' },
    { id: 'homework', label: t(lang, 'dash_homework'), iconSrc: '/dashboard/menu-icons/homework.png' },
    { id: 'schedule', label: t(lang, 'dash_schedule'), iconSrc: '/dashboard/menu-icons/schedule.png' },
    { id: 'practice', label: t(lang, 'dash_practice'), iconSrc: '/dashboard/menu-icons/practice.png' },
    { id: 'grammar', label: t(lang, 'dash_grammar'), iconSrc: '/dashboard/menu-icons/grammar.png' },
    { id: 'listening', label: t(lang, 'dash_listening'), iconSrc: '/dashboard/menu-icons/listening.png' },
    { id: 'checkpoint', label: t(lang, 'dash_checkpoint'), iconSrc: '/dashboard/menu-icons/checkpoint.png' },
    { id: 'dictionary', label: t(lang, 'dict_tab'), iconSrc: '/dashboard/menu-icons/dictionary.png' },
    { id: 'grades', label: t(lang, 'dash_grades'), iconSrc: '/dashboard/menu-icons/grades.png' },
    { id: 'shop', label: t(lang, 'shop_tab'), iconSrc: '/dashboard/menu-icons/shop.png' },
  ];
  const visibleTabs = isLimitedAccess ? tabs.filter(tab => tab.id === 'overview') : tabs;

  const equippedAvatar = findAvatar(starProfile.avatarId);

  return (
    <div className="min-h-screen page-bg-dashboard">


      {/* Modals */}
      <AnimatePresence>
        {showModal && selectedItem && (
          selectedItem.unlocked
            ? <FileModal
                item={selectedItem}
                userId={effectiveUserId}
                canSubmitWork={!isPreview}
                onClose={() => setShowModal(false)}
                onSubmitted={refreshStudentData}
                onStartInteractive={startAssignedInteractive}
                lang={lang}
              />
            : <LockedModal item={selectedItem} onClose={() => setShowModal(false)} lang={lang} />
        )}
      </AnimatePresence>
      {assignedInteractive && (
        <InteractiveLessonRoom
          lesson={assignedInteractive.lesson}
          userId={effectiveUserId}
          contentItemId={assignedInteractive.item.id}
          lang={lang}
          onExit={() => {
            setAssignedInteractive(null);
            void refreshStudentData();
          }}
          onCompleted={() => {
            void refreshStudentData();
            void refreshStars();
          }}
        />
      )}

      {/* Header */}
      <div
        className="student-dashboard-header sticky top-0 z-40 glass border-b border-pink-100"
      >
        <div className="relative max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <span className="font-display font-black text-xl bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Vetoschool</span>
          </Link>
          {activeTab === 'shop' && (
            <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2">
              <button
                type="button"
                onClick={handleShopBack}
                className="inline-flex items-center gap-1.5 font-body text-xs font-700 text-purple-400 transition-colors hover:text-pink-500"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {lang === 'en' ? 'Back' : 'Назад'}
              </button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {/* Lang switcher */}
            <div className="flex gap-1 bg-white/60 rounded-full px-1 py-1">
              {langs.map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-2.5 py-1 rounded-full text-xs font-body font-700 uppercase transition-all ${
                    lang === l ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow' : 'text-purple-500 hover:text-purple-700'
                  }`}>{l}</button>
              ))}
            </div>
            {isPreview && (
              <Link to="/admin" className="text-xs bg-purple-100 text-purple-600 px-3 py-1.5 rounded-xl font-body font-600 hover:bg-purple-200 transition-colors">← Admin</Link>
            )}
            {/* Stars balance widget */}
            <button onClick={() => { if (!isLimitedAccess) setActiveTab('shop'); }}
	              disabled={isLimitedAccess}
	              className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-yellow-100 to-amber-100 border border-yellow-300 rounded-full px-3 py-1.5 hover:scale-105 transition-transform"
	              title={t(lang, 'shop_balance')}>
		              <img src={RATING_STAR_SRC} alt="" aria-hidden="true" className="h-6 w-6 scale-[1.22] object-contain drop-shadow-[0_4px_7px_rgba(217,119,6,0.2)]" />
	              <span className="font-display font-black text-yellow-700 text-sm">{starProfile.starBalance}</span>
	            </button>
            <div className="hidden sm:block text-right">
              <div className="font-display font-bold text-purple-700 text-sm">{user.name}</div>
              <div className="font-body text-xs text-purple-400">{billingHasAccess ? t(lang, 'dash_active') : t(lang, 'dash_pending')}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-300 to-purple-300 flex items-center justify-center font-display font-black text-white text-lg overflow-hidden">
              {equippedAvatar
                ? equippedAvatar.imageSrc
                  ? <img src={equippedAvatar.imageSrc} alt="" className="h-full w-full object-contain" />
                  : <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{equippedAvatar.emoji}</span>
                : user.name[0].toUpperCase()}
            </div>
            {!isPreview && (
              <div className="flex flex-col items-start leading-tight">
                <button onClick={handleLogout} className="font-body text-xs text-purple-400 hover:text-pink-500 transition-colors">{t(lang, 'nav_logout')}</button>
                <Link to="/account/security" className="mt-1 font-body text-[11px] text-purple-300 hover:text-pink-500 transition-colors">
                  {lang === 'en' ? 'Security' : lang === 'ua' ? 'Безпека' : '🔒 Пароль'}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={activeTab === 'shop' ? 'mx-auto max-w-[100rem] px-2 py-2 sm:px-4' : 'max-w-7xl mx-auto px-4 py-6'}>

        {/* Welcome banner */}
        {activeTab !== 'shop' && (<>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`student-welcome-banner rounded-3xl p-6 md:p-8 mb-8 text-white relative overflow-visible ${isWelcomeScrolledUnderHeader ? 'z-10' : 'z-[60]'}`}>
          <div className="absolute inset-0 overflow-hidden rounded-3xl opacity-10">
            {[...Array(15)].map((_, i) => <div key={i} className="absolute text-xl" style={{ left: `${(i * 6.7) % 100}%`, top: `${(i * 7.3) % 100}%` }}>✨</div>)}
          </div>
          <div
            className={`student-welcome-owl-stage pointer-events-none absolute bottom-0 right-0 top-[-80px] hidden w-[68%] max-w-[850px] overflow-hidden rounded-r-3xl md:block ${isWelcomeScrolledUnderHeader ? 'z-20' : 'z-[70]'}`}
            style={{ clipPath: 'inset(0 round 0 1.5rem 1.5rem 0)' }}
          >
            <img
              src="/dashboard/student-welcome-owl-v2.png"
              alt=""
              className="student-welcome-owl-art absolute bottom-[-24px] right-[-14px] w-full origin-bottom-right scale-[0.98] select-none object-contain drop-shadow-[0_22px_32px_rgba(90,38,160,0.22)] dark:hidden"
            />
            <img
              src="/dashboard/student-welcome-owl-dark.png"
              alt=""
              className="student-welcome-owl-art absolute bottom-[-135px] right-[2px] hidden w-full origin-bottom-right scale-[0.9] select-none object-contain drop-shadow-[0_22px_32px_rgba(3,1,12,0.36)] dark:block"
            />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="font-body text-white/80 text-sm mb-1">{greeting}! 👋</p>
              <h1 className="font-display font-black text-2xl md:text-3xl">
                {isPreview ? `👁️ Preview` : `${user.name}`}
              </h1>
	              <p className="font-body text-white/80 mt-1 flex items-center gap-1.5 text-sm">
	                {!isLimitedAccess && billingHasAccess && (
	                  <img src={RATING_STAR_SRC} alt="" aria-hidden="true" className="h-6 w-6 object-contain drop-shadow-[0_5px_8px_rgba(217,119,6,0.24)]" />
	                )}
	                <span>{isLimitedAccess ? limitedCopy.banner : billingHasAccess ? withoutLeadingStar(t(lang, 'dash_keep_up')) : t(lang, 'dash_locked_desc')}</span>
	              </p>
            </div>
            {isLimitedAccess ? (
              <Link
                to="/trial-booking"
                className="bg-white text-purple-600 font-display font-bold px-6 py-3 rounded-2xl hover:scale-105 transition-transform shadow-lg text-sm flex-shrink-0"
              >
                {limitedCopy.cta}
              </Link>
            ) : !billingHasAccess && !isPreview && (
              <a href="https://t.me/vetoschool_bot" target="_blank" rel="noopener noreferrer"
                className="bg-white text-purple-600 font-display font-bold px-6 py-3 rounded-2xl hover:scale-105 transition-transform shadow-lg text-sm flex-shrink-0">
                {t(lang, 'dash_activate')}
              </a>
            )}
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6" style={{ scrollbarWidth: 'none' }}>
          {visibleTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-body font-600 text-sm whitespace-nowrap transition-all duration-300 flex-shrink-0 ${
                activeTab === tab.id
                  ? 'student-accent-gradient text-white shadow-lg shadow-purple-200'
                  : 'glass text-purple-600 hover:bg-pink-50'
              }`}>
              <span className="relative h-6 w-6 flex-shrink-0">
                <img
                  src={tab.iconSrc}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className={`absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-sm ${
                    tab.id === 'interactive'
                      ? 'h-9 w-9'
                      : ['practice', 'listening', 'shop'].includes(tab.id)
                        ? 'h-8 w-8'
                        : 'h-7 w-7'
                  }`}
                />
              </span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        </>)}

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>

            {/* OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {isLimitedAccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border border-pink-100 bg-white/85 p-6 shadow-xl shadow-pink-100/40"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="max-w-3xl">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-100 bg-pink-50 px-3 py-1 font-body text-xs font-800 text-pink-500">
                          <span>⏳</span>
                          <span>{t(lang, 'dash_pending')}</span>
                        </div>
                        <h2 className="font-display text-2xl font-black text-purple-700">{limitedCopy.title}</h2>
                        <p className="mt-2 font-body text-sm font-600 leading-relaxed text-purple-400">{limitedCopy.desc}</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
                        <Link to="/trial-booking" className="btn-magic inline-flex min-h-11 items-center justify-center px-5 py-2 text-sm font-bold text-white">
                          {limitedCopy.trial}
                        </Link>
                        <Link to="/pricing" className="inline-flex min-h-11 items-center justify-center rounded-full border border-pink-200 bg-white px-5 py-2 font-display text-sm font-bold text-pink-600 shadow-sm transition hover:bg-pink-50">
                          {limitedCopy.pricing}
                        </Link>
                        <a href="https://t.me/vetoschool_bot" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-full border border-purple-200 bg-white px-5 py-2 font-display text-sm font-bold text-purple-600 shadow-sm transition hover:bg-purple-50">
                          {limitedCopy.telegram}
                        </a>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
                        <p className="font-display text-base font-black text-green-600">✅ {limitedCopy.nowTitle}</p>
                        <p className="mt-1 font-body text-xs font-600 leading-relaxed text-green-600/75">{limitedCopy.nowDesc}</p>
                      </div>
                      <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4">
                        <p className="font-display text-base font-black text-purple-600">🔒 {limitedCopy.lockedTitle}</p>
                        <p className="mt-1 font-body text-xs font-600 leading-relaxed text-purple-500/75">{limitedCopy.lockedDesc}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: t(lang, 'dash_lessons_done'), value: `${completedLessons}/${lessons.length}`, icon: '/dashboard/stat-icons/lessons.png', color: 'from-pink-100 to-rose-100', border: 'border-pink-200', iconClass: 'h-full w-full object-contain drop-shadow-[0_8px_10px_rgba(126,34,206,0.16)]' },
                    { label: t(lang, 'dash_rating'), value: ratingAvg > 0 ? `${ratingAvg}` : '—', icon: null, color: 'from-yellow-100 to-amber-100', border: 'border-yellow-200', iconClass: '' },
                    { label: t(lang, 'dash_hw_due'), value: homework.filter(h => !h.starRating || h.starRating === 0).length.toString(), icon: '/dashboard/stat-icons/homework.png', color: 'from-purple-100 to-violet-100', border: 'border-purple-200', iconClass: 'h-full w-full object-contain drop-shadow-[0_8px_10px_rgba(126,34,206,0.16)]' },
                    { label: t(lang, 'dash_week'), value: `${schedule.length}`, icon: '/dashboard/stat-icons/schedule.png', color: 'from-blue-100 to-cyan-100', border: 'border-blue-200', iconClass: 'h-full w-full object-contain drop-shadow-[0_8px_10px_rgba(14,116,144,0.16)]' },
                  ].map((stat, i) => (
                    <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                      className={`bg-gradient-to-br ${stat.color} border ${stat.border} rounded-3xl p-5 pt-4 min-h-[8.5rem] card-hover`}>
                      <div className="-mt-2 mb-1 flex h-14 w-14 items-center justify-center">
                        {stat.icon ? (
                          <img src={stat.icon} alt="" className={stat.iconClass} aria-hidden="true" />
                        ) : (
                          <RatingStatIcon />
                        )}
                      </div>
                      <div className="font-display font-black text-2xl text-purple-700">{stat.value}</div>
                      <div className="mt-1 font-display text-[13px] font-bold leading-none text-purple-500/90">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                <div className="glass relative min-h-[20.5rem] overflow-hidden rounded-3xl p-6 md:p-7">
                  <img
                    src="/dashboard/tariff-intensive-bg.png"
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full -translate-x-6 scale-[1.10] select-none object-cover dark:hidden"
                  />
                  <img
                    src="/dashboard/tariff-intensive-bg-dark.png"
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 hidden h-full w-full -translate-x-6 scale-[1.10] select-none object-cover dark:block"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/45 via-white/18 to-transparent dark:hidden" />
                  <div className="relative z-10 flex max-w-[39rem] flex-col gap-5">
                    <div>
                      <p className="font-display text-sm font-bold uppercase tracking-[0.08em] text-violet-400 dark:text-violet-200/85">{tariffLabel}</p>
                      <h3 className="mt-2 font-display text-2xl font-black leading-tight text-violet-700 drop-shadow-[0_2px_0_rgba(255,255,255,0.65)] dark:text-violet-50 dark:drop-shadow-[0_0_18px_rgba(168,85,247,0.42)] md:text-3xl">{billingPlanName}</h3>
                      <p className={`mt-4 inline-flex rounded-2xl border px-4 py-1.5 font-body text-sm font-800 ${billingStatusClass(billingKind)}`}>{billingStatus}</p>
                      {billingKind === 'manual_access' && billing?.manual_access_override_at && (
                        <p className={`mt-2 font-body text-xs font-700 ${billingStatusTextClass}`}>
                          {lang === 'en' ? 'Manual access' : lang === 'ua' ? 'Ручний доступ' : 'Ручной доступ'}: {new Date(billing.manual_access_override_at).toLocaleString(locale)}
                        </p>
                      )}
                      {hasPaymentProblem && billing?.payment_failed_at && (
                        <p className="mt-1 font-body text-xs font-700 text-purple-400">
                          {paymentFailedLabel}: {new Date(billing.payment_failed_at).toLocaleDateString(locale)}
                        </p>
                      )}
                      {(isCancelAtPeriodEnd || isSubscriptionCanceled) && billing?.current_period_end && (
                        <p className="mt-1 font-body text-xs font-700 text-purple-400">
                          {paidPeriodEndLabel}: {new Date(billing.current_period_end).toLocaleDateString(locale)}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-violet-100 bg-white/70 px-4 py-3 shadow-sm shadow-violet-100/40 backdrop-blur dark:border-violet-300/16 dark:bg-[#241042]/62 dark:shadow-black/15">
                        <p className="font-display text-sm font-bold text-violet-400 dark:text-violet-200/80">{formatLabel}</p>
                        <p className="mt-1 font-display text-lg font-black text-violet-800 dark:text-white">{billingFormat}</p>
                      </div>
                      <div className="rounded-2xl border border-violet-100 bg-white/70 px-4 py-3 shadow-sm shadow-violet-100/40 backdrop-blur dark:border-violet-300/16 dark:bg-[#241042]/62 dark:shadow-black/15">
                        <p className="font-display text-sm font-bold text-violet-400 dark:text-violet-200/80">{lessonsBalanceLabel}</p>
                        <p className="mt-1 font-display text-lg font-black text-violet-800 dark:text-white">
                          {billing ? `${billing.lessons_remaining ?? 0}/${billing.lessons_total ?? 0}` : '—'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-violet-100 bg-white/70 px-4 py-3 shadow-sm shadow-violet-100/40 backdrop-blur dark:border-violet-300/16 dark:bg-[#241042]/62 dark:shadow-black/15">
                        <p className="font-display text-sm font-bold text-violet-400 dark:text-violet-200/80">{billingDateLabel}</p>
                        <p className="mt-1 font-display text-sm font-black text-violet-800 dark:text-white">
                          {nextPaymentDate ? new Date(nextPaymentDate).toLocaleDateString(locale) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                  {(hasPaymentProblem || hasStripeCustomer || !isPreview) && (
                    <div className="relative z-10 mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                      {hasStripeCustomer && (
                        <button
                          type="button"
                          onClick={handleManageSubscription}
                          disabled={portalLoading}
                          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-3 font-display text-base font-bold text-white shadow-lg shadow-violet-300/45 transition hover:-translate-y-0.5 hover:shadow-violet-300/60 disabled:opacity-60"
                        >
                          {portalLoading ? '...' : (
                            <>
                              <Crown className="h-5 w-5 fill-yellow-300 text-yellow-300" aria-hidden="true" />
                              {manageSubscriptionLabel}
                            </>
                          )}
                        </button>
                      )}
                      {!isPreview && (
                        <Link
                          to="/pricing"
                          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-violet-100 bg-white px-6 py-3 font-display text-base font-bold text-violet-700 shadow-md shadow-violet-100/50 transition hover:-translate-y-0.5 hover:bg-white dark:border-violet-300/20 dark:bg-[#241042]/76 dark:text-violet-50 dark:shadow-black/20 dark:hover:bg-[#2b124f]"
                        >
                          <Clock className="h-5 w-5 text-violet-600 dark:text-violet-200" aria-hidden="true" />
                          {changeTariffLabel}
                        </Link>
                      )}
                      {hasPaymentProblem && !hasStripeCustomer && (
                        <button
                          type="button"
                          disabled
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-200 bg-red-50 px-5 py-2 font-display text-sm font-bold text-red-500 opacity-80"
                        >
                          {updatePaymentMethodLabel}
                        </button>
                      )}
                    </div>
                  )}
                  {portalError && (
                    <p className="relative z-10 mt-2 font-body text-xs font-700 text-red-500">{portalError}</p>
                  )}
                </div>

                  {!isPreview && (
                    <TelegramConnectCard studentId={effectiveUserId} lang={lang} />
                  )}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {ratingAvg > 0 && (
                    <div className="glass relative overflow-hidden rounded-3xl p-6" data-testid="student-rating-card">
                      <img
	                        src="/dashboard/rating-bg.png"
	                        alt=""
	                        aria-hidden="true"
	                        className="pointer-events-none absolute inset-0 h-full w-full scale-[1.03] select-none object-cover dark:hidden"
	                      />
	                      <img
	                        src="/dashboard/rating-bg-dark.png"
	                        alt=""
	                        aria-hidden="true"
	                        className="pointer-events-none absolute inset-0 hidden h-full w-full scale-[1.03] select-none object-cover dark:block"
	                      />
	                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/72 via-white/34 to-white/6 dark:hidden" />
	                      <h3 className="relative z-10 mb-4 flex items-center gap-2 font-display text-xl font-bold text-purple-700 dark:text-violet-50">
                        <img
                          src={RATING_STAR_SRC}
                          alt=""
                          className="h-7 w-7 object-contain drop-shadow-[0_4px_7px_rgba(217,119,6,0.18)]"
                          aria-hidden="true"
                        />
                        {t(lang, 'dash_rating')}
                      </h3>
                      <div className="relative z-10 flex flex-wrap items-center gap-x-5 gap-y-3">
                        <div className="flex items-center gap-1.5" data-testid="student-rating-stars" aria-label={`${ratingAvg} / 5 ${t(lang, 'dash_stars')}`}>
                          {[1,2,3,4,5].map(s => (
	                            <img
	                              key={s}
	                              src={RATING_STAR_SRC}
	                              alt=""
	                              className={`h-9 w-9 object-contain drop-shadow-[0_6px_8px_rgba(217,119,6,0.16)] transition sm:h-10 sm:w-10 ${
	                                s <= ratingFullStars ? 'opacity-100' : 'opacity-30'
	                              }`}
	                              aria-hidden="true"
	                            />
                          ))}
                        </div>
                        <div className="flex items-baseline gap-2">
	                          <span className="font-display text-4xl font-black leading-none text-purple-700 dark:text-violet-50">{ratingAvg}</span>
	                          <span className="font-body text-sm font-700 text-purple-400 dark:text-violet-200/78">/ 5 {t(lang, 'dash_stars')}</span>
                        </div>
                      </div>
                    </div>
                  )}

	                  <div
	                    className="student-recent-lessons-card glass rounded-3xl p-6"
	                    data-recent-lesson-state={recentLessonUnlocked ? 'open' : 'locked'}
	                    style={{
	                      backgroundImage: `url('${recentLessonUnlocked ? '/dashboard/recent-lessons-open-bg.png' : '/dashboard/recent-lessons-bg.png'}')`,
	                      backgroundPosition: 'calc(50% - 3px) 48.5%',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '104% auto',
                    }}
                  >
	                    <h3 className="-translate-y-3 font-display font-bold text-xl text-purple-700 dark:text-violet-50 mb-4">{t(lang, 'dash_recent')}</h3>
                    {recentLesson ? (
                      <button
                        type="button"
                        onClick={() => handleItemClick(recentLesson)}
                        className="ml-[4.75rem] block h-14 w-[min(23.5rem,62%)] rounded-2xl px-3 py-0.5 text-left transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-2 focus:ring-offset-white/70"
                      >
	                        <div className="-translate-y-[0.6rem] truncate font-display text-sm font-black leading-5 text-purple-700 dark:text-violet-50">{recentLesson.title}</div>
                        <div className="-translate-y-1 mt-0.5 grid grid-cols-3 items-start gap-2">
                          <div className="flex min-w-0 flex-col items-center gap-0.5">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-violet-200 bg-white text-violet-500 shadow-[0_3px_8px_rgba(139,92,246,0.18)]">
                              <Check className="h-3.5 w-3.5" strokeWidth={3.2} aria-hidden="true" />
                            </div>
                            <span className="w-full truncate text-center font-display text-[10px] font-bold leading-3 text-violet-300">{t(lang, 'dash_recent_start')}</span>
                          </div>
                          <div className="relative flex min-w-0 flex-col items-center gap-0.5">
                            <div className="absolute left-[calc(-50%+0.75rem)] right-[calc(50%+0.75rem)] top-3 h-0.5 rounded-full bg-[repeating-linear-gradient(90deg,rgba(167,139,250,0.82)_0_6px,transparent_6px_11px)]" />
                            <div className="absolute left-[calc(50%+0.75rem)] right-[calc(-50%+0.75rem)] top-3 h-0.5 rounded-full bg-[repeating-linear-gradient(90deg,rgba(167,139,250,0.82)_0_6px,transparent_6px_11px)]" />
                            <div className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-[0_3px_8px_rgba(139,92,246,0.18)] ${
                              recentLessonCompleted
                                ? 'border-violet-300 bg-white text-violet-500'
                                : recentLessonUnlocked
                                  ? 'border-white bg-gradient-to-br from-violet-400 to-purple-500 text-white'
                                  : 'border-violet-200 bg-white text-violet-300'
                            }`}>
                              {recentLessonCompleted ? (
                                <Check className="h-3.5 w-3.5" strokeWidth={3.2} aria-hidden="true" />
                              ) : (
                                <span className="h-2.5 w-2.5 rounded-full bg-current ring-2 ring-white/75" aria-hidden="true" />
                              )}
                            </div>
                            <span className={`w-full truncate text-center font-display text-[10px] font-bold leading-3 ${
                              recentLessonUnlocked ? 'text-violet-500' : 'text-violet-300'
                            }`}>
                              {t(lang, 'dash_recent_progress')}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-col items-center gap-0.5">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-violet-200 bg-white text-violet-500 shadow-[0_4px_9px_rgba(139,92,246,0.18)] ring-1 ring-white/80">
                              {recentLessonUnlocked ? (
                                <Unlock className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                              ) : (
                                <Lock className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                              )}
                            </div>
                            <span className="w-full truncate text-center font-display text-[10px] font-bold leading-3 text-violet-500">
                              {recentLessonUnlocked ? t(lang, 'dash_recent_unlocked') : t(lang, 'dash_recent_locked')}
                            </span>
                          </div>
                        </div>
                      </button>
                    ) : (
                      <p className="font-body text-purple-400 text-sm text-center py-4">{t(lang, 'dash_lessons_empty_desc')}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* LESSONS */}
            {activeTab === 'lessons' && (
              lessons.length === 0
                ? <EmptySection emoji="📚" title={t(lang, 'dash_lessons_empty_title')} desc={t(lang, 'dash_lessons_empty_desc')} />
                : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {lessons.map(item => <ContentCard key={item.id} item={item} lang={lang} onClick={() => handleItemClick(item)} />)}
                  </div>
            )}

            {/* HOMEWORK */}
            {activeTab === 'homework' && (
              homework.length === 0
                ? <EmptySection emoji="✏️" title={t(lang, 'dash_hw_empty_title')} desc={t(lang, 'dash_hw_empty_desc')} />
                : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {homework.map(item => <ContentCard key={item.id} item={item} lang={lang} onClick={() => handleItemClick(item)} />)}
                  </div>
            )}

            {/* SCHEDULE */}
            {activeTab === 'schedule' && (
              schedule.length === 0
                ? <EmptySection emoji="📅" title={t(lang, 'dash_no_schedule')} desc={t(lang, 'dash_no_schedule_desc')} />
                : (() => {
                    const upcoming = schedule.filter(s => !s.isConducted);
                    const conducted = schedule.filter(s => s.isConducted);
                    const renderCard = (slot: typeof schedule[number], i: number, done: boolean) => (
                      <motion.div key={slot.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                        className={`glass border rounded-3xl p-5 card-hover ${done ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 opacity-90' : 'bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200'}`}>
                        <div className="flex items-center gap-4">
                          <input type="checkbox" checked={slot.isConducted} disabled readOnly
                            className="w-5 h-5 accent-green-500 cursor-not-allowed flex-shrink-0"
                            title={t(lang, 'sched_conducted_label')} />
                          <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-white font-display font-black flex-shrink-0 ${done ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'student-accent-gradient'}`}>
                            <span className="text-xs">{slot.day.slice(0, 3)}</span>
                            <span className="text-lg">{slot.time.split(':')[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-display font-bold text-lg ${done ? 'text-green-700 line-through decoration-green-300' : 'text-purple-700'}`}>{slot.topic}</h4>
                            <p className={`font-body text-sm ${done ? 'text-green-500' : 'text-purple-400'}`}>{slot.day} · {slot.time} · Anastasiia Vetoshchuk</p>
                          </div>
                          <span className={`text-xs px-3 py-1 rounded-full font-body font-600 flex-shrink-0 ${done ? 'bg-green-100 text-green-600' : 'bg-pink-100 text-pink-600'}`}>
                            {done ? `✅ ${t(lang, 'sched_conducted_label')}` : t(lang, 'dash_lesson_type')}
                          </span>
                        </div>
                        {!done && /^https:\/\//i.test(String(slot.onlineUrl || '')) && (
                          <a
                            href={slot.onlineUrl as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="student-accent-gradient mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 font-display text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5"
                          >
                            🎥 {t(lang, 'sched_join')}
                          </a>
                        )}
                      </motion.div>
                    );
                    return (
                      <div className="space-y-8">
                        <div>
                          <h3 className="font-display font-bold text-xl text-purple-700 mb-4 flex items-center gap-2">📅 {t(lang, 'sched_upcoming')} <span className="text-sm text-purple-400 font-600">({upcoming.length})</span></h3>
                          {upcoming.length === 0
                            ? <div className="glass rounded-2xl p-6 text-center font-body text-sm text-purple-400">—</div>
                            : <div className="space-y-4">{upcoming.map((s, i) => renderCard(s, i, false))}</div>
                          }
                        </div>
                        {conducted.length > 0 && (
                          <details className="group" open>
                            <summary className="cursor-pointer list-none mb-4">
                              <h3 className="font-display font-bold text-xl text-green-700 inline-flex items-center gap-2">
                                <span className="transition-transform group-open:rotate-90">▶</span>
                                ✅ {t(lang, 'sched_conducted')} <span className="text-sm text-green-500 font-600">({conducted.length})</span>
                              </h3>
                            </summary>
                            <div className="space-y-4">{conducted.map((s, i) => renderCard(s, i, true))}</div>
                          </details>
                        )}
                      </div>
                    );
                  })()
            )}

            {/* PRACTICE */}
            {activeTab === 'practice' && (
              practice.length === 0
                ? <EmptySection emoji="🎮" title={t(lang, 'dash_practice_empty_title')} desc={t(lang, 'dash_practice_empty_desc')} />
                : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {practice.map(item => <ContentCard key={item.id} item={item} lang={lang} onClick={() => handleItemClick(item)} />)}
                  </div>
            )}

            {/* GRAMMAR */}
            {activeTab === 'grammar' && (
              grammar.length === 0
                ? <EmptySection emoji="📝" title={t(lang, 'dash_grammar_title')} desc={t(lang, 'dash_coming_soon_desc')} />
                : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {grammar.map(item => <ContentCard key={item.id} item={item} lang={lang} onClick={() => handleItemClick(item)} />)}
                  </div>
            )}

            {/* LISTENING */}
            {activeTab === 'listening' && (
              listening.length === 0
                ? <EmptySection emoji="🎧" title={t(lang, 'dash_listening')} desc={t(lang, 'dash_coming_soon_desc')} />
                : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {listening.map(item => <ContentCard key={item.id} item={item} lang={lang} onClick={() => handleItemClick(item)} />)}
                  </div>
            )}

            {/* CHECKPOINT */}
            {activeTab === 'checkpoint' && (
              checkpoint.length === 0
                ? <EmptySection emoji="🏁" title={t(lang, 'dash_checkpoint')} desc={t(lang, 'dash_coming_soon_desc')} />
                : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {checkpoint.map(item => <ContentCard key={item.id} item={item} lang={lang} onClick={() => handleItemClick(item)} />)}
                  </div>
            )}

            {/* DICTIONARY */}
            {activeTab === 'dictionary' && (
              <DictionaryView userId={effectiveUserId} lang={lang} />
            )}


            {/* GRADES */}
            {activeTab === 'grades' && (
              <div className="space-y-6">
                <div className="rounded-3xl p-6 text-white text-center" style={{ background: 'linear-gradient(135deg, #FF8DC7, #C8B3FF, #7EC8FF)' }}>
                  {ratingAvg > 0 ? (
                    <>
                      <div className="flex justify-center gap-1 mb-2">
                        {[1,2,3,4,5].map(s => <span key={s} className={`text-5xl ${s <= Math.round(ratingAvg) ? 'text-yellow-300' : 'text-white/30'}`}>★</span>)}
                      </div>
                      <div className="font-display font-black text-4xl mb-1">{ratingAvg} / 5</div>
                    </>
                  ) : (
                    <div className="font-display font-black text-4xl mb-2">—</div>
                  )}
                  <div className="font-body text-white/90">{t(lang, 'dash_overall')}</div>
                  {ratingAvg === 0 && <p className="font-body text-white/70 text-sm mt-2">{t(lang, 'dash_grades_empty')}</p>}
                </div>

                {([
                  { key: 'hw', title: t(lang, 'dash_diary'), items: homework, emptyTitle: t(lang, 'dash_hw_empty_title') },
                  { key: 'practice', title: t(lang, 'dash_practice_diary'), items: practice, emptyTitle: t(lang, 'dash_practice_empty_title') },
                  { key: 'checkpoint', title: t(lang, 'dash_checkpoint_results'), items: checkpoint, emptyTitle: t(lang, 'dash_checkpoint') },
                ] as const).map(section => (
                  <div key={section.key} className="glass rounded-3xl p-6">
                    <h3 className="font-display font-bold text-xl text-purple-700 mb-4">{section.title}</h3>
                    {section.items.length === 0 ? (
                      <p className="font-body text-sm text-purple-400 text-center py-6">{section.emptyTitle}</p>
                    ) : (
                      <div className="space-y-3">
                        {section.items.map(it => (
                          <div key={it.id} onClick={() => handleItemClick(it)}
                            className="flex items-center gap-3 p-3 bg-white/60 rounded-2xl cursor-pointer hover:bg-white/80 transition-colors">
                            <span className="text-2xl">{it.emoji}</span>
                            <div className="flex-1">
                              <div className="font-body font-600 text-purple-700 text-sm">{it.title}</div>
                              {it.dueDate && it.dueDate.length > 0 && (
                                <div className="font-body text-xs text-purple-400">
                                  {t(lang, 'dash_due')} {new Date(it.dueDate).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                                </div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              {it.starRating && it.starRating > 0 ? (
                                <div className="flex gap-0.5 justify-end">
                                  {[1,2,3,4,5].map(s => <span key={s} className={`text-base ${s <= it.starRating! ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>)}
                                </div>
                              ) : (
                                <span className="text-xs text-purple-400 font-body">{t(lang, 'dash_not_graded')}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* SHOP */}
            {activeTab === 'shop' && (
              <AvatarShop
                userId={effectiveUserId}
                hasAccess={billingHasAccess}
                lang={lang}
                userName={user.name}
                onChange={refreshStars}
              />
            )}

            {/* INTERACTIVE LESSONS */}
            {activeTab === 'interactive' && (
              <InteractiveLessonMap
                userId={effectiveUserId}
                hasAccess={billingHasAccess}
                lang={lang}
                assignedContent={content.filter(item => !!item.interactiveLessonId)}
                onStarsChanged={refreshStars}
                onContentChanged={refreshStudentData}
              />
            )}


          </motion.div>
        </AnimatePresence>
      </div>

      {/* Star celebration popup */}
      <AnimatePresence>
        {celebrationAmount > 0 && (
          <StarCelebration amount={celebrationAmount} lang={lang} onDone={() => setCelebrationAmount(0)} />
        )}
      </AnimatePresence>
    </div>
  );
}
