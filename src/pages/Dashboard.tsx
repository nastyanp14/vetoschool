import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getCurrentUser, logout } from '../lib/auth';
import { getStudentSchedule } from '../lib/schedule';
import { ensureStudentContent, ContentItem, getStudentRating, downloadDataUrl, loadStudentContent, openOrDownload } from '../lib/content';
import { loadStudentSchedule } from '../lib/schedule';
import { Lang, t } from '../lib/i18n';

type Tab = 'overview' | 'lessons' | 'homework' | 'schedule' | 'practice' | 'grammar' | 'listening' | 'checkpoint' | 'grades';

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

// ---- File modal (unlocked) ----
function FileModal({ item, onClose, lang }: { item: ContentItem; onClose: () => void; lang: Lang }) {
  const dataUrl = item.fileUrl || item.fileDataUrl || '';
  const hasContent = !!dataUrl || !!item.externalLink;
  const isImage = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(dataUrl) || dataUrl.startsWith('data:image');
  const isAudio = /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(dataUrl) || dataUrl.startsWith('data:audio') || (item.type === 'listening' && !!dataUrl);

  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';

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
          </div>
          <button onClick={onClose} className="text-purple-300 hover:text-pink-500 text-4xl leading-none flex-shrink-0 transition-colors">×</button>
        </div>

        {/* Content */}
        {hasContent ? (
          <div className="space-y-4">
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
            <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-4 border border-pink-100">
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); openOrDownload(item); }}
                className="btn-magic w-full py-3.5 text-white font-display font-bold text-base flex items-center justify-center gap-3 select-none"
              >
                <span className="text-xl">{item.externalLink ? '🔗' : '⬇️'}</span>
                {item.externalLink
                  ? (lang === 'en' ? 'Open link' : lang === 'ua' ? 'Відкрити посилання' : 'Открыть ссылку')
                  : t(lang, 'dash_download')}
              </button>
            </div>

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
          </div>
        ) : (
          <div className="text-center py-10 bg-purple-50 rounded-2xl">
            <div className="text-5xl mb-3">📎</div>
            <p className="font-body text-purple-500 font-600">{t(lang, 'dash_no_file')}</p>
            <p className="font-body text-purple-400 text-sm mt-1">{t(lang, 'dash_file_added_soon')}</p>
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
  const colorMap: Record<string, string> = {
    lesson: 'from-pink-50 to-rose-50 border-pink-200',
    homework: 'from-purple-50 to-violet-50 border-purple-200',
    practice: 'from-blue-50 to-cyan-50 border-blue-200',
    grammar: 'from-yellow-50 to-amber-50 border-yellow-200',
    listening: 'from-green-50 to-teal-50 border-green-200',
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
      {item.starRating && item.starRating > 0 && (
        <div className="flex gap-0.5 my-1">
          {[1,2,3,4,5].map(s => (
            <span key={s} className={`text-base ${s <= item.starRating! ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
          ))}
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

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [greeting, setGreeting] = useState('');
  const [schedule, setSchedule] = useState<ReturnType<typeof getStudentSchedule>>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [showModal, setShowModal] = useState(false);

  const effectiveUserId = previewUserId || user?.id || '';
  const langs: Lang[] = ['ru', 'en', 'ua'];
  const isPreview = !!previewUserId;

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const h = new Date().getHours();
    setGreeting(h < 12 ? t(lang, 'dash_morning') : h < 17 ? t(lang, 'dash_afternoon') : t(lang, 'dash_evening'));
    loadStudentSchedule(effectiveUserId).then(setSchedule);
    loadStudentContent(effectiveUserId).then(setContent);
  }, [user, navigate, lang, effectiveUserId]);

  useEffect(() => { setLang(propLang); }, [propLang]);

  if (!user) return null;

  const handleLogout = async () => { await logout(); navigate('/'); };
  const handleItemClick = (item: ContentItem) => { setSelectedItem(item); setShowModal(true); };

  const lessons = content.filter(i => i.type === 'lesson');
  const homework = content.filter(i => i.type === 'homework');
  const practice = content.filter(i => i.type === 'practice');
  const grammar = content.filter(i => i.type === 'grammar');
  const listening = content.filter(i => i.type === 'listening');
  const completedLessons = lessons.filter(l => l.unlocked).length;
  const { avg: ratingAvg } = getStudentRating(effectiveUserId);
  const locale = lang === 'en' ? 'en-GB' : lang === 'ua' ? 'uk-UA' : 'ru-RU';

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'overview', label: t(lang, 'dash_overview'), emoji: '🏠' },
    { id: 'lessons', label: t(lang, 'dash_lessons'), emoji: '📚' },
    { id: 'homework', label: t(lang, 'dash_homework'), emoji: '✏️' },
    { id: 'schedule', label: t(lang, 'dash_schedule'), emoji: '📅' },
    { id: 'practice', label: t(lang, 'dash_practice'), emoji: '🎮' },
    { id: 'grammar', label: t(lang, 'dash_grammar'), emoji: '📝' },
    { id: 'listening', label: t(lang, 'dash_listening'), emoji: '🎧' },
    { id: 'grades', label: t(lang, 'dash_grades'), emoji: '🏆' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #FFF0F6 0%, #F5F0FF 50%, #F0F8FF 100%)' }}>

      {/* Modals */}
      <AnimatePresence>
        {showModal && selectedItem && (
          selectedItem.unlocked
            ? <FileModal item={selectedItem} onClose={() => setShowModal(false)} lang={lang} />
            : <LockedModal item={selectedItem} onClose={() => setShowModal(false)} lang={lang} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-40 glass border-b border-pink-100" style={{ boxShadow: '0 4px 20px rgba(200,150,220,0.1)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <span className="font-display font-black text-xl bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Vetoschool</span>
          </Link>
          <div className="flex items-center gap-3">
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
            <div className="hidden sm:block text-right">
              <div className="font-display font-bold text-purple-700 text-sm">{user.name}</div>
              <div className="font-body text-xs text-purple-400">{user.hasAccess ? t(lang, 'dash_active') : t(lang, 'dash_pending')}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-300 to-purple-300 flex items-center justify-center font-display font-black text-white text-lg">
              {user.name[0].toUpperCase()}
            </div>
            {!isPreview && (
              <button onClick={handleLogout} className="text-xs text-purple-400 hover:text-pink-500 transition-colors font-body">{t(lang, 'nav_logout')}</button>
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
                : <div className="space-y-4">
                    {schedule.map((slot, i) => (
                      <motion.div key={slot.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                        className="bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-3xl p-5 card-hover">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-400 to-purple-400 flex flex-col items-center justify-center text-white font-display font-black flex-shrink-0">
                            <span className="text-xs">{slot.day.slice(0, 3)}</span>
                            <span className="text-lg">{slot.time.split(':')[0]}</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-display font-bold text-purple-700 text-lg">{slot.topic}</h4>
                            <p className="font-body text-sm text-purple-400">{slot.day} · {slot.time} · Anastasiia Vetoshchuk</p>
                          </div>
                          <span className="text-xs px-3 py-1 rounded-full bg-pink-100 text-pink-600 font-body font-600">{t(lang, 'dash_lesson_type')}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
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

                <div className="glass rounded-3xl p-6">
                  <h3 className="font-display font-bold text-xl text-purple-700 mb-4">{t(lang, 'dash_diary')}</h3>
                  {homework.length === 0 ? (
                    <p className="font-body text-sm text-purple-400 text-center py-6">{t(lang, 'dash_hw_empty_title')}</p>
                  ) : (
                    <div className="space-y-3">
                      {homework.map(hw => (
                        <div key={hw.id} onClick={() => handleItemClick(hw)}
                          className="flex items-center gap-3 p-3 bg-white/60 rounded-2xl cursor-pointer hover:bg-white/80 transition-colors">
                          <span className="text-2xl">{hw.emoji}</span>
                          <div className="flex-1">
                            <div className="font-body font-600 text-purple-700 text-sm">{hw.title}</div>
                            {hw.dueDate && hw.dueDate.length > 0 && (
                              <div className="font-body text-xs text-purple-400">
                                {t(lang, 'dash_due')} {new Date(hw.dueDate).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            {hw.starRating && hw.starRating > 0 ? (
                              <div className="flex gap-0.5 justify-end">
                                {[1,2,3,4,5].map(s => <span key={s} className={`text-base ${s <= hw.starRating! ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>)}
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
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
