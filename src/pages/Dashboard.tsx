import { useCallback, useState, useEffect, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { createTelegramLink, listTelegramParents, TelegramParentAccount } from '../lib/telegram';
import { getLessonById, Lesson as WorkbookLesson } from '../lib/workbooks';
import { supabase } from '@/integrations/supabase/client';
import { pricingPlanNameKeys, type PricingPlanId } from '../lib/pricingCurrency';
import { redirectToStripeCustomerPortal } from '../lib/stripeCheckout';

type Tab = 'overview' | 'lessons' | 'homework' | 'schedule' | 'practice' | 'grammar' | 'listening' | 'checkpoint' | 'dictionary' | 'grades' | 'shop' | 'interactive';

type BillingSummary = {
  payment_status: string | null;
  payment_failed_at: string | null;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  plan_id: string | null;
  lesson_format: string | null;
  lessons_total: number | null;
  lessons_remaining: number | null;
  current_period_end: string | null;
  next_payment_date: string | null;
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
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const loadParents = async () => setParents(await listTelegramParents(studentId));
  const createLink = async () => {
    setLoading(true);
    try {
      const data = await createTelegramLink(studentId);
      setLink(data.url);
      setExpiresAt(data.expiresAt);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadParents(); }, [studentId]);

  const text = {
    ru: {
      title: 'Telegram для родителей',
      desc: 'Подключите Telegram, чтобы родители получали напоминания, домашние задания, оценки и переносы уроков.',
      button: 'Подключить Telegram',
      copy: copied ? 'Скопировано' : 'Скопировать ссылку',
      expires: 'Ссылка активна до',
      linked: 'Подключённые родители',
      empty: 'Пока нет подключённых родителей',
      settings: 'Настройки уведомлений меняются в боте: напоминания, домашки, оценки, переносы и отмены.',
    },
    ua: {
      title: 'Telegram для батьків',
      desc: 'Підключіть Telegram, щоб батьки отримували нагадування, домашні завдання, оцінки та перенесення уроків.',
      button: 'Підключити Telegram',
      copy: copied ? 'Скопійовано' : 'Скопіювати посилання',
      expires: 'Посилання активне до',
      linked: 'Підключені батьки',
      empty: 'Поки немає підключених батьків',
      settings: 'Налаштування сповіщень змінюються в боті: нагадування, домашки, оцінки, перенесення та скасування.',
    },
    en: {
      title: 'Telegram for parents',
      desc: 'Connect Telegram so parents receive reminders, homework, grades, reschedules and cancellations.',
      button: 'Connect Telegram',
      copy: copied ? 'Copied' : 'Copy link',
      expires: 'Link active until',
      linked: 'Connected parents',
      empty: 'No connected parents yet',
      settings: 'Notification settings are changed in the bot: reminders, homework, grades, reschedules and cancellations.',
    },
  }[lang];

  return (
    <div className="glass rounded-3xl p-6 border border-sky-100 bg-gradient-to-br from-white via-sky-50/50 to-purple-50/60">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h3 className="font-display font-bold text-xl text-purple-700 mb-1">💬 {text.title}</h3>
          <p className="font-body text-sm text-purple-400 max-w-2xl">{text.desc}</p>
          <p className="font-body text-xs text-purple-400 mt-2">{text.settings}</p>
        </div>
        <button onClick={createLink} disabled={loading}
          className="btn-magic px-5 py-3 text-white text-sm font-display font-bold disabled:opacity-60 flex-shrink-0">
          {loading ? '...' : text.button}
        </button>
      </div>

      {link && (
        <div className="mt-4 rounded-2xl bg-white/80 border border-purple-100 p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input readOnly value={link} className="input-magic text-sm py-2 flex-1" onFocus={e => e.currentTarget.select()} />
            <button onClick={copy} className="btn-outline px-4 py-2 text-sm font-display font-bold">{text.copy}</button>
          </div>
          {expiresAt && (
            <p className="font-body text-xs text-purple-400 mt-2">
              {text.expires}: {new Date(expiresAt).toLocaleString(lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU')}
            </p>
          )}
        </div>
      )}

      <div className="mt-4">
        <div className="font-body font-700 text-sm text-purple-600 mb-2">{text.linked}</div>
        {parents.length === 0 ? (
          <div className="font-body text-sm text-purple-400 bg-white/60 rounded-2xl px-4 py-3">{text.empty}</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {parents.map(parent => (
              <div key={parent.id} className="rounded-2xl bg-white/70 border border-purple-100 px-4 py-3">
                <div className="font-body font-700 text-purple-700 text-sm">
                  {parent.parentName || parent.telegramUsername || 'Telegram'}
                </div>
                <div className="font-body text-xs text-purple-400 uppercase">{parent.language}</div>
              </div>
            ))}
          </div>
        )}
      </div>
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-pink-400 to-purple-400 text-xl text-white shadow-sm">🎮</span>
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
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

// ================================================================
export default function Dashboard({ lang: propLang }: { lang: Lang }) {
  const [lang, setLang] = useState<Lang>(propLang);
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const previewUserId = searchParams.get('preview');
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

  const effectiveUserId = previewUserId || user?.id || '';
  const langs: Lang[] = ['ru', 'en', 'ua'];
  const isPreview = !!previewUserId;

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
    const [freshContent, billingResult] = await Promise.all([
      loadStudentContent(effectiveUserId),
      supabase
        .from('profiles')
        .select('payment_status,payment_failed_at,stripe_customer_id,subscription_status,cancel_at_period_end,canceled_at,plan_id,lesson_format,lessons_total,lessons_remaining,current_period_end,next_payment_date')
        .eq('id', effectiveUserId)
        .maybeSingle(),
      refreshStars(),
    ]);
    setContent(freshContent);
    if (billingResult.data) setBilling(billingResult.data);
    setSelectedItem(prev => prev ? freshContent.find(item => item.id === prev.id) || prev : prev);
  }, [effectiveUserId, refreshStars]);

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

  if (!user) return null;

  const handleLogout = async () => { await logout(); navigate('/'); };
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
  const { avg: ratingAvg } = getStudentRating(effectiveUserId);
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';
  const billingPlanId = billing?.plan_id && billing.plan_id in pricingPlanNameKeys ? billing.plan_id as PricingPlanId : null;
  const billingPlanName = billingPlanId ? t(lang, pricingPlanNameKeys[billingPlanId]) : billing?.plan_id || (lang === 'en' ? 'No active plan' : lang === 'ua' ? 'Немає активного тарифу' : 'Нет активного тарифа');
  const billingFormat = billing?.lesson_format === 'individual'
    ? (lang === 'en' ? 'Individual' : lang === 'ua' ? 'Індивідуально' : 'Индивидуально')
    : billing?.lesson_format === 'group'
      ? (lang === 'en' ? 'Group' : lang === 'ua' ? 'Група' : 'Группа')
      : '—';
  const hasPaymentProblem = billing?.payment_status === 'failed'
    || billing?.subscription_status === 'past_due'
    || billing?.subscription_status === 'unpaid'
    || billing?.subscription_status === 'incomplete_expired';
  const isSubscriptionCanceled = billing?.subscription_status === 'canceled';
  const isCancelAtPeriodEnd = !isSubscriptionCanceled && Boolean(billing?.cancel_at_period_end);
  const isSubscriptionActive = billing?.subscription_status === 'active' || billing?.subscription_status === 'trialing' || billing?.payment_status === 'paid';
  const billingStatus = hasPaymentProblem
    ? (lang === 'en' ? 'Payment problem' : lang === 'ua' ? 'Проблема з оплатою' : 'Проблема с оплатой')
    : isCancelAtPeriodEnd
      ? (lang === 'en' ? 'Ends at paid period end' : lang === 'ua' ? 'Скасується в кінці оплаченого періоду' : 'Отменится в конце оплаченного периода')
      : isSubscriptionCanceled
        ? (lang === 'en' ? 'Canceled' : lang === 'ua' ? 'Скасована' : 'Отменена')
        : isSubscriptionActive
          ? (lang === 'en' ? 'Active' : lang === 'ua' ? 'Активна' : 'Активна')
          : (lang === 'en' ? 'Pending payment' : lang === 'ua' ? 'Очікує оплати' : 'Ожидает оплаты');
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
  const billingStatusClass = hasPaymentProblem || isSubscriptionCanceled
    ? 'text-red-500'
    : isCancelAtPeriodEnd
      ? 'text-amber-500'
      : 'text-purple-400';
  const billingDateLabel = isCancelAtPeriodEnd || isSubscriptionCanceled ? paidPeriodEndLabel : nextPaymentLabel;

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'overview', label: t(lang, 'dash_overview'), emoji: '🏠' },
    { id: 'interactive', label: t(lang, 'dash_interactive'), emoji: '🗺️' },
    { id: 'lessons', label: t(lang, 'dash_lessons'), emoji: '📚' },
    { id: 'homework', label: t(lang, 'dash_homework'), emoji: '✏️' },
    { id: 'schedule', label: t(lang, 'dash_schedule'), emoji: '📅' },
    { id: 'practice', label: t(lang, 'dash_practice'), emoji: '🎮' },
    { id: 'grammar', label: t(lang, 'dash_grammar'), emoji: '📝' },
    { id: 'listening', label: t(lang, 'dash_listening'), emoji: '🎧' },
    { id: 'checkpoint', label: t(lang, 'dash_checkpoint'), emoji: '🏁' },
    { id: 'dictionary', label: t(lang, 'dict_tab'), emoji: '📖' },
    { id: 'grades', label: t(lang, 'dash_grades'), emoji: '🏆' },
    { id: 'shop', label: t(lang, 'shop_tab'), emoji: '🛍️' },
  ];

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
      <div className="sticky top-0 z-40 glass border-b border-pink-100" style={{ boxShadow: '0 4px 20px rgba(200,150,220,0.1)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <span className="font-display font-black text-xl bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Vetoschool</span>
          </Link>
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
            <button onClick={() => setActiveTab('shop')}
              className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-yellow-100 to-amber-100 border border-yellow-300 rounded-full px-3 py-1.5 hover:scale-105 transition-transform"
              title={t(lang, 'shop_balance')}>
              <span className="text-base">⭐</span>
              <span className="font-display font-black text-yellow-700 text-sm">{starProfile.starBalance}</span>
            </button>
            <div className="hidden sm:block text-right">
              <div className="font-display font-bold text-purple-700 text-sm">{user.name}</div>
              <div className="font-body text-xs text-purple-400">{user.hasAccess ? t(lang, 'dash_active') : t(lang, 'dash_pending')}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-300 to-purple-300 flex items-center justify-center font-display font-black text-white text-lg overflow-hidden">
              {equippedAvatar
                ? <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{equippedAvatar.emoji}</span>
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

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Welcome banner */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6 md:p-8 mb-6 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #FF8DC7 0%, #C8B3FF 50%, #7EC8FF 100%)' }}>
          <div className="absolute inset-0 opacity-10">
            {[...Array(15)].map((_, i) => <div key={i} className="absolute text-xl" style={{ left: `${(i * 6.7) % 100}%`, top: `${(i * 7.3) % 100}%` }}>✨</div>)}
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="font-body text-white/80 text-sm mb-1">{greeting}! 👋</p>
              <h1 className="font-display font-black text-2xl md:text-3xl">
                {isPreview ? `👁️ Preview` : `${user.name}`}
              </h1>
              <p className="font-body text-white/80 mt-1 text-sm">
                {user.hasAccess ? t(lang, 'dash_keep_up') : t(lang, 'dash_locked_desc')}
              </p>
            </div>
            {!user.hasAccess && !isPreview && (
              <a href="https://t.me/vetoschool_bot" target="_blank" rel="noopener noreferrer"
                className="bg-white text-purple-600 font-display font-bold px-6 py-3 rounded-2xl hover:scale-105 transition-transform shadow-lg text-sm flex-shrink-0">
                {t(lang, 'dash_activate')}
              </a>
            )}
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-body font-600 text-sm whitespace-nowrap transition-all duration-300 flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-pink-400 to-purple-400 text-white shadow-lg shadow-purple-200'
                  : 'glass text-purple-600 hover:bg-pink-50'
              }`}>
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>

            {/* OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: t(lang, 'dash_lessons_done'), value: `${completedLessons}/${lessons.length}`, emoji: '📚', color: 'from-pink-100 to-rose-100', border: 'border-pink-200' },
                    { label: t(lang, 'dash_rating'), value: ratingAvg > 0 ? `${ratingAvg}★` : '—', emoji: '⭐', color: 'from-yellow-100 to-amber-100', border: 'border-yellow-200' },
                    { label: t(lang, 'dash_hw_due'), value: homework.filter(h => !h.starRating || h.starRating === 0).length.toString(), emoji: '✏️', color: 'from-purple-100 to-violet-100', border: 'border-purple-200' },
                    { label: t(lang, 'dash_week'), value: `${schedule.length}`, emoji: '📅', color: 'from-blue-100 to-cyan-100', border: 'border-blue-200' },
                  ].map((stat, i) => (
                    <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                      className={`bg-gradient-to-br ${stat.color} border ${stat.border} rounded-3xl p-5 card-hover`}>
                      <div className="text-3xl mb-2">{stat.emoji}</div>
                      <div className="font-display font-black text-2xl text-purple-700">{stat.value}</div>
                      <div className="font-body text-xs text-purple-500 mt-1">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="glass rounded-3xl p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-body text-xs font-800 uppercase tracking-[0.12em] text-purple-300">{tariffLabel}</p>
                      <h3 className="mt-1 font-display text-2xl font-black text-purple-700">{billingPlanName}</h3>
                      <p className={`mt-1 font-body text-sm font-700 ${billingStatusClass}`}>{billingStatus}</p>
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
                    <div className="grid gap-3 sm:grid-cols-3 md:min-w-[34rem]">
                      <div className="rounded-2xl border border-purple-100 bg-white/60 px-4 py-3">
                        <p className="font-body text-xs font-800 text-purple-300">{formatLabel}</p>
                        <p className="font-display text-lg font-black text-purple-700">{billingFormat}</p>
                      </div>
                      <div className="rounded-2xl border border-purple-100 bg-white/60 px-4 py-3">
                        <p className="font-body text-xs font-800 text-purple-300">{lessonsBalanceLabel}</p>
                        <p className="font-display text-lg font-black text-purple-700">
                          {billing ? `${billing.lessons_remaining ?? 0}/${billing.lessons_total ?? 0}` : '—'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-purple-100 bg-white/60 px-4 py-3">
                        <p className="font-body text-xs font-800 text-purple-300">{billingDateLabel}</p>
                        <p className="font-display text-sm font-black text-purple-700">
                          {nextPaymentDate ? new Date(nextPaymentDate).toLocaleDateString(locale) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                  {(hasPaymentProblem || hasStripeCustomer) && (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                      {hasStripeCustomer && (
                        <button
                          type="button"
                          onClick={handleManageSubscription}
                          disabled={portalLoading}
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-purple-200 bg-white/75 px-5 py-2 font-display text-sm font-bold text-purple-600 shadow-sm transition hover:bg-purple-50 disabled:opacity-60"
                        >
                          {portalLoading ? '...' : manageSubscriptionLabel}
                        </button>
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
                    <p className="mt-2 font-body text-xs font-700 text-red-500">{portalError}</p>
                  )}
                </div>

                {!isPreview && (
                  <TelegramConnectCard studentId={effectiveUserId} lang={lang} />
                )}

                {ratingAvg > 0 && (
                  <div className="glass rounded-3xl p-6">
                    <h3 className="font-display font-bold text-xl text-purple-700 mb-4">⭐ {t(lang, 'dash_rating')}</h3>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(s => <span key={s} className={`text-3xl ${s <= Math.round(ratingAvg) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>)}
                      </div>
                      <span className="font-display font-black text-3xl text-purple-700">{ratingAvg}</span>
                      <span className="font-body text-purple-400 text-sm">/ 5 {t(lang, 'dash_stars')}</span>
                    </div>
                  </div>
                )}

                <div className="glass rounded-3xl p-6">
                  <h3 className="font-display font-bold text-xl text-purple-700 mb-4">{t(lang, 'dash_recent')}</h3>
                  {lessons.length === 0 ? (
                    <p className="font-body text-purple-400 text-sm text-center py-4">{t(lang, 'dash_lessons_empty_desc')}</p>
                  ) : (
                    <div className="space-y-3">
                      {lessons.map(lesson => (
                        <div key={lesson.id} onClick={() => handleItemClick(lesson)}
                          className="flex items-center gap-3 p-3 bg-white/60 rounded-2xl cursor-pointer hover:bg-white/80 transition-colors">
                          <span className="text-2xl">{lesson.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-body font-600 text-purple-700 text-sm truncate">{lesson.title}</div>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-body font-600 flex-shrink-0 ${lesson.unlocked ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                            {lesson.unlocked ? t(lang, 'dash_done') : '🔒'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                          <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-white font-display font-black flex-shrink-0 ${done ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-pink-400 to-purple-400'}`}>
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
              <AvatarShop userId={effectiveUserId} hasAccess={user.hasAccess} lang={lang} onChange={refreshStars} />
            )}

            {/* INTERACTIVE LESSONS */}
            {activeTab === 'interactive' && (
              <InteractiveLessonMap
                userId={effectiveUserId}
                hasAccess={user.hasAccess}
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
