import { type ReactNode, useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronRight, Download, Headphones, Image as ImageIcon, Languages, Lightbulb, Loader2, MessageSquareQuote, Mic, Pause, Play, RotateCcw, Sparkles, Square, Volume2 } from 'lucide-react';
import { signedUrlFor } from '../lib/workbooks';
import type { TheoryBlock, TheoryContent, TheoryExampleItem, TheoryImageBlock, TheoryTextBlock, TheoryVocabularyItem } from '../lib/theory';
import { toast } from 'sonner';
import { signedLessonAudioUrl } from '../lib/cardAudio';
import type { Lang } from '../lib/i18n';
import { WorkbookAssetImage } from './WorkbookAssetImage';

const theoryActionGradient = 'linear-gradient(90deg, #EFA4DE 0%, #D7A9E9 45%, #B6BDF9 100%)';

const formatAudioTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};

const viewCopy = {
  ru: {
    playError: 'Не удалось воспроизвести аудиозапись',
    audioDownloadError: 'Аудиозапись недоступна для скачивания',
    pause: 'Пауза',
    play: 'Воспроизвести',
    listening: 'Слушаем вместе',
    ready: 'Готово к прослушиванию',
    seek: 'Позиция аудиозаписи',
    volume: 'Громкость',
    speed: 'Скорость воспроизведения',
    download: 'Скачать',
    repeat: 'Послушай и повтори',
    audioSoon: 'Аудиозапись скоро появится.',
    noAudio: 'Для этой карточки аудио ещё не добавлено',
    pronunciationError: 'Не удалось воспроизвести произношение',
    listenWord: 'Прослушать произношение слова',
    listenSentence: 'Прослушать предложение',
    word: 'Word',
    tapToListen: 'Нажми, чтобы услышать',
    rememberRule: 'Запомни правило',
    examples: 'Примеры',
    newWords: 'Новые слова',
    grammarRule: 'Грамматическое правило',
    materialSoon: 'Материал урока скоро появится.',
    sayIt: 'Сказать',
    stop: 'Готово',
    listeningNow: 'Слушаю...',
    heard: 'Услышала',
    micUnsupported: 'Микрофон недоступен',
    micPermission: 'Разреши доступ к микрофону и попробуй ещё раз',
    tryAgain: 'Попробуй ещё раз',
    almost: 'Почти правильно',
    excellent: 'Отлично',
    listenSound: 'Послушай сложный звук',
    voicePractice: 'Голосовая практика',
    voicePracticeHint: 'Произнеси слово. Когда получится хорошо, откроется следующее.',
    nextWord: 'Следующее слово',
    repeatWord: 'Повтори слово',
    finishPractice: 'Готово',
    practiceComplete: 'Группа слов готова',
    practiceAllGreat: 'Все слова прозвучали отлично.',
    practiceNeedsRepeat: 'Эти слова лучше повторить ещё раз.',
    repeatDifficultWords: 'Повторить сложные слова',
  },
  en: {
    playError: 'Could not play the audio',
    audioDownloadError: 'Audio is not available for download',
    pause: 'Pause',
    play: 'Play',
    listening: 'Playing',
    ready: 'Ready to listen',
    seek: 'Audio position',
    volume: 'Volume',
    speed: 'Playback speed',
    download: 'Download',
    repeat: 'Listen and repeat',
    audioSoon: 'Audio will appear soon.',
    noAudio: 'Audio has not been added for this card yet',
    pronunciationError: 'Could not play pronunciation',
    listenWord: 'Listen to pronunciation of',
    listenSentence: 'Listen to sentence',
    word: 'Word',
    tapToListen: 'Tap to listen',
    rememberRule: 'Remember the rule',
    examples: 'Examples',
    newWords: 'New words',
    grammarRule: 'Grammar rule',
    materialSoon: 'Lesson material will appear soon.',
    sayIt: 'Say it',
    stop: 'Done',
    listeningNow: 'Listening...',
    heard: 'Heard',
    micUnsupported: 'Microphone unavailable',
    micPermission: 'Allow microphone access and try again',
    tryAgain: 'Try again',
    almost: 'Almost there',
    excellent: 'Great',
    listenSound: 'Listen to this sound',
    voicePractice: 'Voice practice',
    voicePracticeHint: 'Say the word. When it sounds good, the next one opens.',
    nextWord: 'Next word',
    repeatWord: 'Repeat the word',
    finishPractice: 'Done',
    practiceComplete: 'Word group complete',
    practiceAllGreat: 'Every word sounded great.',
    practiceNeedsRepeat: 'These words need one more try.',
    repeatDifficultWords: 'Repeat tricky words',
  },
  ua: {
    playError: 'Не вдалося відтворити аудіозапис',
    audioDownloadError: 'Аудіозапис недоступний для завантаження',
    pause: 'Пауза',
    play: 'Відтворити',
    listening: 'Слухаємо разом',
    ready: 'Готово до прослуховування',
    seek: 'Позиція аудіозапису',
    volume: 'Гучність',
    speed: 'Швидкість відтворення',
    download: 'Завантажити',
    repeat: 'Послухай і повтори',
    audioSoon: 'Аудіозапис скоро зʼявиться.',
    noAudio: 'Для цієї картки аудіо ще не додано',
    pronunciationError: 'Не вдалося відтворити вимову',
    listenWord: 'Прослухати вимову слова',
    listenSentence: 'Прослухати речення',
    word: 'Word',
    tapToListen: 'Натисни, щоб почути',
    rememberRule: 'Запамʼятай правило',
    examples: 'Приклади',
    newWords: 'Нові слова',
    grammarRule: 'Граматичне правило',
    materialSoon: 'Матеріал уроку скоро зʼявиться.',
    sayIt: 'Сказати',
    stop: 'Готово',
    listeningNow: 'Слухаю...',
    heard: 'Почула',
    micUnsupported: 'Мікрофон недоступний',
    micPermission: 'Дозволь доступ до мікрофона й спробуй ще раз',
    tryAgain: 'Спробуй ще раз',
    almost: 'Майже правильно',
    excellent: 'Чудово',
    listenSound: 'Послухай складний звук',
    voicePractice: 'Голосова практика',
    voicePracticeHint: 'Вимов слово. Коли вийде добре, відкриється наступне.',
    nextWord: 'Наступне слово',
    repeatWord: 'Повтори слово',
    finishPractice: 'Готово',
    practiceComplete: 'Група слів готова',
    practiceAllGreat: 'Усі слова прозвучали чудово.',
    practiceNeedsRepeat: 'Ці слова варто повторити ще раз.',
    repeatDifficultWords: 'Повторити складні слова',
  },
} as const;

const vc = (lang: Lang) => viewCopy[lang] || viewCopy.ru;
type SpeechRecognitionResultLike = ArrayLike<{ transcript?: string; confidence?: number }> & { isFinal?: boolean };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous?: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function VocabularyVisual({ image, emoji, alt, className = '' }: { image?: string; emoji?: string; alt?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center text-6xl transition ${className}`}>
      {image
        ? <WorkbookAssetImage path={image} alt={alt || ''} className="h-full w-full scale-[1.35] object-contain" surface="TheoryLessonView.VocabularyVisual" fallback={emoji || '✨'} />
        : emoji || '✨'}
    </div>
  );
}

function HorizontalCardScroller({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const scrollNext = () => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: Math.max(260, rail.clientWidth * 0.75), behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={railRef}
        className="-mt-4 flex snap-x gap-4 overflow-x-auto scroll-smooth pb-5 pt-4 pr-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={scrollNext}
        aria-label={ariaLabel}
        className="absolute right-2 top-1/2 z-20 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-purple-100 bg-white/95 text-[#8B3DFF] shadow-[0_14px_30px_rgba(126,87,194,0.18)] transition hover:-translate-y-[52%] hover:scale-105 hover:bg-white focus:outline-none focus:ring-4 focus:ring-purple-100 dark:border-purple-400/15 dark:bg-[#2B1541]/95 dark:text-purple-100 dark:focus:ring-purple-400/10"
      >
        <ChevronRight className="h-7 w-7" />
      </button>
    </div>
  );
}

function getSpeechRecognitionConstructor() {
  return ((window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }).SpeechRecognition || (window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }).webkitSpeechRecognition);
}

const translateDefaultTitle = (lang: Lang, value: string) => {
  if (lang === 'ru') return value;
  const map: Record<string, string> = lang === 'en'
    ? {
        'Примеры': 'Examples',
        'Примеры предложений': 'Example sentences',
        'Новые слова': 'New words',
        'Сегодня изучаем': 'Today we learn',
        'Послушай и повтори': 'Listen and repeat',
        'Послушай произношение': 'Listen to the pronunciation',
        'Грамматическое правило': 'Grammar rule',
        'Главное правило': 'Main rule',
        'Как строится предложение': 'How the sentence is built',
        'Запомни правило': 'Remember the rule',
        'Наша тема': 'Our topic',
        'Попробуй сам': 'Try it yourself',
      }
    : {
        'Примеры': 'Приклади',
        'Примеры предложений': 'Приклади речень',
        'Новые слова': 'Нові слова',
        'Сегодня изучаем': 'Сьогодні вивчаємо',
        'Послушай и повтори': 'Послухай і повтори',
        'Послушай произношение': 'Послухай вимову',
        'Грамматическое правило': 'Граматичне правило',
        'Главное правило': 'Головне правило',
        'Как строится предложение': 'Як будується речення',
        'Запомни правило': 'Запамʼятай правило',
        'Наша тема': 'Наша тема',
        'Попробуй сам': 'Спробуй сам',
      };
  return map[value] || value;
};

function PremiumAudioPlayer({ url, title, lang }: { url: string; title: string; lang: Lang }) {
  const copy = vc(lang);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const progressPercent = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const volumePercent = Math.min(100, Math.max(0, volume * 100));
  const speedOptions = [0.75, 1, 1.25, 1.5];

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [url]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        stopActivePronunciation();
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      toast.error(copy.playError);
    }
  };

  const changeSpeed = (value: number) => {
    setSpeed(value);
    if (audioRef.current) audioRef.current.playbackRate = value;
  };

  const download = async () => {
    setDownloading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('download failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      const extension = blob.type.includes('mpeg') ? 'mp3' : blob.type.includes('wav') ? 'wav' : blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : blob.type.includes('webm') ? 'webm' : 'mp3';
      anchor.download = `${(title || 'vetoschool-audio').replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, '-').replace(/^-|-$/g, '') || 'vetoschool-audio'}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      toast.error(copy.audioDownloadError);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`theory-audio-player relative mt-5 overflow-hidden rounded-[1.65rem] border border-white/80 bg-white/90 p-4 shadow-[0_20px_46px_rgba(168,85,247,0.16)] transition duration-500 dark:border-purple-400/20 dark:bg-[#241331] dark:shadow-none sm:p-5 ${playing ? 'is-playing' : ''}`}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={event => setDuration(event.currentTarget.duration)}
        onDurationChange={event => setDuration(event.currentTarget.duration)}
        onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <div className="pointer-events-none absolute inset-0 opacity-80 transition duration-500 dark:opacity-35" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.92)_0%,rgba(255,246,252,0.72)_42%,rgba(240,246,255,0.74)_100%)] dark:bg-[linear-gradient(135deg,rgba(64,31,94,0.86)_0%,rgba(35,17,55,0.72)_58%,rgba(20,30,65,0.62)_100%)]" />
        <div className="theory-audio-sheen absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/65 to-transparent" />
      </div>

      <div className="relative z-10 grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={playing ? copy.pause : copy.play}
          className={`theory-audio-play relative mx-auto flex h-[4.45rem] w-[4.45rem] shrink-0 items-center justify-center rounded-[1.35rem] text-white shadow-[0_18px_35px_rgba(168,85,247,0.25)] transition duration-300 hover:-translate-y-0.5 hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-purple-200/80 dark:focus:ring-purple-400/20 lg:mx-0 ${playing ? 'is-playing' : ''}`}
          style={{ background: theoryActionGradient }}
        >
          <span className="theory-audio-play-ring" aria-hidden="true" />
          {playing ? <Pause className="relative z-10 h-7 w-7 fill-current" /> : <Play className="relative z-10 ml-1 h-7 w-7 fill-current" />}
        </button>

        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <span className={`h-2.5 w-2.5 rounded-full ${playing ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.65)]' : 'bg-purple-200 dark:bg-purple-400/[0.45]'}`} />
                <span className="font-body text-xs font-black uppercase text-purple-400 dark:text-purple-200">{playing ? copy.listening : copy.ready}</span>
              </div>
              <div className="mt-1 truncate font-display text-xl font-black leading-tight text-purple-800 dark:text-purple-100 sm:text-2xl">{translateDefaultTitle(lang, title) || copy.repeat}</div>
            </div>
            <div className="mx-auto flex items-center gap-3 rounded-2xl border border-purple-100/[0.7] bg-white/[0.78] px-3 py-2 shadow-sm dark:border-purple-400/15 dark:bg-white/[0.08] sm:mx-0">
              <div className={`theory-audio-eq ${playing ? 'is-active' : ''}`} aria-hidden="true">
                <span /><span /><span /><span /><span /><span /><span />
              </div>
              <span className="whitespace-nowrap font-body text-xs font-black text-purple-500 dark:text-purple-100">{formatAudioTime(currentTime)} / {formatAudioTime(duration)}</span>
            </div>
          </div>

          <div className="relative rounded-full bg-white/70 p-1.5 shadow-inner dark:bg-white/10">
            <div className="relative h-3 overflow-hidden rounded-full bg-purple-100/[0.85] dark:bg-[#1d1031]">
              <div className="theory-audio-progress absolute inset-y-0 left-0 rounded-full" style={{ width: `${progressPercent}%`, background: theoryActionGradient }} />
            </div>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              onChange={event => {
                const value = Number(event.target.value);
                setCurrentTime(value);
                if (audioRef.current) audioRef.current.currentTime = value;
              }}
              aria-label={copy.seek}
              className="theory-audio-range absolute inset-0 h-full w-full cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4 flex flex-col gap-3 border-t border-white/80 pt-4 dark:border-purple-400/10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-[11rem] flex-1 items-center gap-3 rounded-2xl bg-white/[0.62] px-3 py-2 text-purple-500 shadow-sm dark:bg-white/[0.08] dark:text-purple-100 sm:max-w-[16rem]">
          <Volume2 className="h-4 w-4 shrink-0" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={event => {
              const value = Number(event.target.value);
              setVolume(value);
              if (audioRef.current) audioRef.current.volume = value;
            }}
            aria-label={copy.volume}
            className="theory-audio-volume h-5 min-w-0 flex-1 cursor-pointer"
            style={{ background: `linear-gradient(90deg, #B58DFF 0%, #EFA4DE ${volumePercent}%, rgba(216,180,254,0.28) ${volumePercent}%, rgba(216,180,254,0.28) 100%)` }}
          />
        </div>
        <div className="flex items-center justify-center gap-1 rounded-2xl bg-purple-50/80 p-1 dark:bg-white/[0.08]" aria-label={copy.speed}>
          {speedOptions.map(value => <button key={value} type="button" onClick={() => changeSpeed(value)} className={`rounded-xl px-3 py-2 font-body text-xs font-black transition duration-200 hover:-translate-y-0.5 ${speed === value ? 'bg-white text-purple-700 shadow-sm dark:bg-white/[0.18] dark:text-white' : 'text-purple-400 hover:text-purple-600 dark:text-purple-300'}`}>{value}x</button>)}
        </div>
        <button type="button" onClick={download} disabled={downloading} style={downloading ? { background: theoryActionGradient } : undefined} className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 font-body text-xs font-black shadow-sm transition duration-200 hover:-translate-y-0.5 disabled:opacity-50 ${downloading ? 'border-transparent text-white' : 'border-purple-100 bg-white/[0.85] text-purple-600 hover:border-purple-200 hover:bg-white dark:border-purple-400/20 dark:bg-white/[0.08] dark:text-purple-100'}`}>
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{copy.download}
        </button>
      </div>
    </div>
  );
}

function TheoryAudio({ block, lang }: { block: Extract<TheoryBlock, { type: 'audio' }>; lang: Lang }) {
  const copy = vc(lang);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!block.audio) return setUrl(null);
    if (/^(https?:|data:|blob:)/.test(block.audio)) setUrl(block.audio);
    else signedUrlFor(block.audio, 3600).then(value => { if (alive) setUrl(value); });
    return () => { alive = false; };
  }, [block.audio]);
  return (
    <section className="rounded-[1.75rem] border border-pink-100 bg-gradient-to-r from-pink-50/80 via-white to-purple-50/80 p-5 dark:border-pink-400/15 dark:from-pink-500/10 dark:via-white/5 dark:to-purple-500/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-pink-500 shadow-md dark:bg-white/10 dark:text-pink-200"><Headphones className="h-7 w-7" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{translateDefaultTitle(lang, block.title) || copy.repeat}</h3>
          {block.description && <p className="mt-1 font-body text-sm font-bold leading-6 text-purple-500 dark:text-purple-200">{block.description}</p>}
        </div>
      </div>
      {url ? <PremiumAudioPlayer url={url} title={block.title} lang={lang} /> : <div className="mt-4 rounded-2xl border border-dashed border-purple-200 bg-white/60 px-4 py-3 text-center text-sm font-bold text-purple-400 dark:border-purple-700 dark:bg-white/5">{copy.audioSoon}</div>}
    </section>
  );
}

let activeVocabularyAudio: HTMLAudioElement | null = null;

function stopActivePronunciation() {
  activeVocabularyAudio?.pause();
  activeVocabularyAudio = null;
}

function usePronunciation(lang: Lang, generatedAudioPath?: string, uploadedAudioPath?: string) {
  const copy = vc(lang);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    let alive = true;
    const audioPath = generatedAudioPath || uploadedAudioPath;
    if (!audioPath) {
      setAudioUrl(null);
      return;
    }
    if (/^(https?:|data:|blob:)/.test(audioPath)) setAudioUrl(audioPath);
    else (generatedAudioPath ? signedLessonAudioUrl(audioPath, 3600) : signedUrlFor(audioPath, 3600)).then(value => { if (alive) setAudioUrl(value); });
    return () => { alive = false; };
  }, [generatedAudioPath, uploadedAudioPath]);

  const pronounce = async (text: string) => {
    const phrase = text.trim();
    if (!phrase) return;
    stopActivePronunciation();
    if (!audioUrl) {
      toast.info(copy.noAudio);
      return;
    }
    setSpeaking(true);
    const audio = new Audio(audioUrl);
    audio.volume = 1;
    activeVocabularyAudio = audio;
    audio.onended = () => setSpeaking(false);
    audio.onpause = () => setSpeaking(false);
    audio.onerror = () => {
      setSpeaking(false);
      toast.error(copy.pronunciationError);
    };
    try { await audio.play(); } catch { setSpeaking(false); toast.error(copy.pronunciationError); }
  };

  return { speaking, pronounce };
}

function normalizeVoice(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-zа-яёіїєґ0-9\s'-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function voiceSimilarity(a: string, b: string) {
  const left = normalizeVoice(a);
  const right = normalizeVoice(b);
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  const dp = Array.from({ length: left.length + 1 }, (_, row) =>
    Array.from({ length: right.length + 1 }, (_, col) => row === 0 ? col : col === 0 ? row : 0),
  );
  for (let row = 1; row <= left.length; row++) for (let col = 1; col <= right.length; col++) {
    const cost = left[row - 1] === right[col - 1] ? 0 : 1;
    dp[row][col] = Math.min(dp[row - 1][col] + 1, dp[row][col - 1] + 1, dp[row - 1][col - 1] + cost);
  }
  return 1 - dp[left.length][right.length] / Math.max(left.length, right.length);
}

function voicePracticeTone(status: VoicePracticeStatus | null) {
  if (status === 'excellent') {
    return {
      word: 'text-emerald-500 drop-shadow-[0_10px_18px_rgba(16,185,129,0.18)] dark:text-emerald-200',
      panel: 'border-emerald-300/90 bg-emerald-50 text-emerald-700 shadow-emerald-100/40 dark:border-emerald-300/45 dark:bg-emerald-500/10 dark:text-emerald-100',
      transcript: 'text-emerald-700 dark:text-emerald-100',
      summary: 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100',
    };
  }
  if (status === 'almost' || status === 'sound') {
    return {
      word: 'text-yellow-500 drop-shadow-[0_10px_18px_rgba(234,179,8,0.20)] dark:text-yellow-100',
      panel: 'border-yellow-300/90 bg-yellow-50 text-yellow-700 shadow-yellow-100/40 dark:border-yellow-300/45 dark:bg-yellow-500/10 dark:text-yellow-100',
      transcript: 'text-yellow-700 dark:text-yellow-100',
      summary: 'border-yellow-100 bg-yellow-50 text-yellow-700 dark:border-yellow-500/25 dark:bg-yellow-500/10 dark:text-yellow-100',
    };
  }
  if (status === 'retry') {
    return {
      word: 'text-rose-500 drop-shadow-[0_10px_18px_rgba(244,63,94,0.18)] dark:text-rose-100',
      panel: 'border-rose-300/90 bg-rose-50 text-rose-700 shadow-rose-100/40 dark:border-rose-300/45 dark:bg-rose-500/10 dark:text-rose-100',
      transcript: 'text-rose-700 dark:text-rose-100',
      summary: 'border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100',
    };
  }
  return {
    word: 'text-[#7C3EDB] drop-shadow-sm dark:text-purple-100',
    panel: 'border-purple-300/90 bg-white text-purple-600 shadow-purple-100/40 dark:border-purple-300/50 dark:bg-white/10 dark:text-purple-100',
    transcript: 'text-[#7C3EDB] dark:text-purple-100',
    summary: 'border-orange-100 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-100',
  };
}

function speechTranscriptFromEvent(event: SpeechRecognitionEventLike) {
  const results = Array.from(event.results);
  return {
    text: results.map(result => Array.from(result)[0]?.transcript || '').join(' ').trim(),
    isFinal: results.some(result => Boolean(result.isFinal)),
  };
}

function playVoiceAttemptSound(kind: 'correct' | 'try') {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const notes = kind === 'correct' ? [659.25, 783.99, 1046.5] : [293.66, 246.94];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.095;
      oscillator.type = kind === 'correct' ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === 'correct' ? 0.16 : 0.11, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.28);
    });
    window.setTimeout(() => context.close(), 800);
  } catch {
    // Optional sound cue.
  }
}

type VoicePracticeStatus = 'excellent' | 'almost' | 'sound' | 'retry';
type VoicePracticeResult = { status: VoicePracticeStatus; transcript: string };

function TheoryVoicePractice({ items, lang }: { items: TheoryVocabularyItem[]; lang: Lang }) {
  const copy = vc(lang);
  const listenCta = lang === 'en' ? 'Listen' : lang === 'ua' ? 'Слухати' : 'Слушать';
  const listeningLabel = lang === 'ru' ? 'Слушаем тебя...' : copy.listeningNow;
  const practiceItems = items.filter(item => item.word?.trim());
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<Record<string, VoicePracticeResult>>({});
  const current = practiceItems[index];
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [message, setMessage] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const autoStopTimerRef = useRef<number | null>(null);
  const playedTranscriptRef = useRef('');
  const { speaking, pronounce } = usePronunciation(lang, current?.audio_url, current?.audio);
  const score = transcript && current ? voiceSimilarity(current.word, transcript) : null;
  const status = score === null ? null : score >= 0.86 ? 'excellent' : score >= 0.62 ? 'almost' : score >= 0.38 ? 'sound' : 'retry';
  const label = status === 'excellent' ? copy.excellent : status === 'almost' ? copy.almost : status === 'sound' ? copy.listenSound : status === 'retry' ? copy.tryAgain : '';
  const isVoiceActive = recording || speaking;
  const tone = voicePracticeTone(recording ? null : status);
  useEffect(() => () => {
    if (autoStopTimerRef.current) window.clearTimeout(autoStopTimerRef.current);
    recognitionRef.current?.stop?.();
    micStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    setTranscript('');
    setMessage('');
    playedTranscriptRef.current = '';
  }, [index]);

  useEffect(() => {
    if (recording || !transcript || !status || playedTranscriptRef.current === transcript) return;
    playedTranscriptRef.current = transcript;
    if (current) {
      setResults(prev => ({ ...prev, [current.id]: { status, transcript } }));
    }
    playVoiceAttemptSound(status === 'excellent' ? 'correct' : 'try');
  }, [current, recording, status, transcript]);

  if (practiceItems.length === 0 || !current) return null;

  const difficultItems = practiceItems.filter(item => results[item.id]?.status !== 'excellent');
  const allExcellent = difficultItems.length === 0;

  const stop = () => {
    if (autoStopTimerRef.current) window.clearTimeout(autoStopTimerRef.current);
    autoStopTimerRef.current = null;
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setRecording(false);
    micStreamRef.current?.getTracks().forEach(track => track.stop());
    micStreamRef.current = null;
  };

  const start = async () => {
    const SpeechRecognitionClass = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionClass) {
      setMessage(copy.micUnsupported);
      return;
    }
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch {
      setMessage(copy.micPermission);
      return;
    }
    setTranscript('');
    setMessage('');
    const recognition = new SpeechRecognitionClass();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const { text, isFinal } = speechTranscriptFromEvent(event);
      setTranscript(text);
      if (!text) return;
      if (autoStopTimerRef.current) window.clearTimeout(autoStopTimerRef.current);
      const recognizedScore = current ? voiceSimilarity(current.word, text) : 0;
      const shouldStopNow = isFinal || recognizedScore >= 0.86;
      autoStopTimerRef.current = window.setTimeout(stop, shouldStopNow ? 150 : 850);
    };
    recognition.onerror = () => {
      if (autoStopTimerRef.current) window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
      setMessage(copy.tryAgain);
      setRecording(false);
      micStreamRef.current?.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    };
    recognition.onend = () => {
      if (autoStopTimerRef.current) window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
      setRecording(false);
      micStreamRef.current?.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    };
    try {
      recognition.start();
      setRecording(true);
    } catch {
      setMessage(copy.micUnsupported);
      micStreamRef.current?.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
  };

  const goNextOrFinish = () => {
    if (index >= practiceItems.length - 1) {
      setFinished(true);
      return;
    }
    setIndex(value => Math.min(practiceItems.length - 1, value + 1));
  };

  const repeatDifficult = () => {
    const firstDifficult = difficultItems[0];
    if (!firstDifficult) return;
    setIndex(Math.max(0, practiceItems.findIndex(item => item.id === firstDifficult.id)));
    setFinished(false);
    setTranscript('');
    setMessage('');
    playedTranscriptRef.current = '';
  };

  return (
    <section className="rounded-[1.75rem] border border-pink-100 bg-gradient-to-br from-white via-pink-50/70 to-sky-50 p-5 shadow-lg shadow-purple-100/35 dark:border-pink-400/15 dark:from-pink-500/10 dark:via-white/5 dark:to-sky-500/10 dark:shadow-none">
      <div className="mb-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:text-left">
        <span className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md sm:mx-0" style={{ background: theoryActionGradient }}><Mic className="h-7 w-7" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{copy.voicePractice}</h3>
          <p className="mt-1 font-body text-sm font-bold leading-6 text-purple-500 dark:text-purple-200">{copy.voicePracticeHint}</p>
        </div>
        <div className="rounded-2xl bg-white/80 px-4 py-2 text-center font-body text-xs font-black text-purple-400 shadow-sm dark:bg-white/10 dark:text-purple-200">{index + 1} / {practiceItems.length}</div>
      </div>

      {finished ? (
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-white bg-white/90 p-5 shadow-md dark:border-purple-400/15 dark:bg-white/5">
          <div className="flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:text-left">
            <span className={`mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md sm:mx-0 ${allExcellent ? 'bg-emerald-400' : ''}`} style={allExcellent ? undefined : { background: theoryActionGradient }}>
              {allExcellent ? <Check className="h-7 w-7" /> : <Headphones className="h-7 w-7" />}
            </span>
            <div className="pt-[clamp(2.05rem,2.6vw,2.45rem)]">
              <h4 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{copy.practiceComplete}</h4>
              <p className="mt-1 font-body text-sm font-bold text-purple-500 dark:text-purple-200">{allExcellent ? copy.practiceAllGreat : copy.practiceNeedsRepeat}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {practiceItems.map(item => {
              const result = results[item.id];
              const ok = result?.status === 'excellent';
              const resultTone = voicePracticeTone(result?.status || null);
              const resultLabel = result?.status === 'excellent'
                ? copy.excellent
                : result?.status === 'almost'
                  ? copy.almost
                  : result?.status === 'sound'
                    ? copy.listenSound
                    : copy.tryAgain;
              return (
                <div key={item.id} className={`rounded-2xl border px-3 py-3 ${resultTone.summary}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-black">{item.word}</span>
                    <span className="font-body text-[10px] font-black uppercase tracking-wider">{resultLabel}</span>
                  </div>
                  {result?.transcript && <div className="mt-1 font-body text-xs font-bold opacity-80">{copy.heard}: {result.transcript}</div>}
                </div>
              );
            })}
          </div>
          {!allExcellent && (
            <div className="mt-5 flex justify-center">
              <button type="button" onClick={repeatDifficult} style={{ background: theoryActionGradient }} className="rounded-2xl px-5 py-2.5 font-body text-sm font-black text-white shadow-lg shadow-purple-200/40 transition hover:-translate-y-0.5 hover:brightness-105 dark:shadow-none">
                {copy.repeatDifficultWords}
              </button>
            </div>
          )}
        </div>
      ) : (
      <div className="theory-voice-practice-card relative mx-auto min-h-[430px] w-full overflow-hidden rounded-[2rem] border border-pink-100 bg-cover p-5 text-center shadow-md shadow-purple-100/45 dark:border-purple-400/15 dark:shadow-none sm:min-h-[455px] sm:p-6">
        <div className="relative z-10 flex min-h-[390px] flex-col items-center justify-end pt-40 sm:min-h-[410px] sm:pt-44">
          <div className="flex items-center justify-center gap-2 font-body text-sm font-black text-purple-500 drop-shadow-sm sm:text-base">
            <span className="voice-practice-star" aria-hidden="true" />
            <span>{copy.repeatWord}</span>
            <span className="voice-practice-star" aria-hidden="true" />
          </div>
          <div className="mt-3 grid w-full max-w-[24rem] grid-cols-[1fr_auto_1fr] items-center gap-x-4">
            <span aria-hidden="true" />
            <h4 className={`text-center font-display text-5xl font-black leading-none transition-colors duration-300 sm:text-6xl ${tone.word}`}>{current.word}</h4>
            <button type="button" onClick={() => pronounce(current.word)} style={speaking ? { background: theoryActionGradient } : undefined} className={`flex h-12 w-12 translate-y-1 items-center justify-center rounded-2xl shadow-md transition hover:translate-y-0.5 ${speaking ? 'animate-pulse text-white hover:brightness-105 dark:text-white' : 'bg-white/90 text-[#7C3EDB] hover:bg-white dark:bg-white/15 dark:text-purple-100'}`} aria-label={copy.listenWord}>
              <Volume2 className="h-5 w-5" />
            </button>
          </div>
          {current.transcription && <div className="mt-2 font-body text-sm font-bold text-pink-400">{current.transcription}</div>}
          <div className="mt-3 w-full text-center font-body text-base font-semibold text-[#7C3EDB] dark:text-purple-200">{current.translation}</div>

          <div className={`mt-5 w-full max-w-2xl rounded-[2rem] border-[3px] border-dashed px-5 py-4 text-center shadow-sm transition-colors duration-300 dark:shadow-none ${tone.panel}`}>
            <div className="grid items-center gap-3 sm:grid-cols-[auto_auto_minmax(0,1fr)] sm:text-left">
              <Mic className="mx-auto h-8 w-8 shrink-0 opacity-90 sm:mx-0" />
              <div className={`voice-practice-wave mx-auto sm:mx-0 ${isVoiceActive ? 'is-active' : ''}`} aria-hidden="true">
                <span /><span /><span /><span /><span />
              </div>
              <div className="min-w-0 text-center sm:-translate-x-10 sm:text-center">
                <div className="font-body text-sm font-black">{recording ? listeningLabel : label || copy.heard}</div>
                {isVoiceActive ? (
                  <div className="mt-2 flex min-h-6 items-center justify-center gap-2" aria-hidden="true">
                    <span className="voice-practice-dot is-active" />
                    <span className="voice-practice-dot is-active" />
                    <span className="voice-practice-dot is-active" />
                  </div>
                ) : transcript || message ? (
                    <div className={`mt-1 min-h-6 break-words text-center font-body text-sm font-black ${tone.transcript}`}>{transcript || message}</div>
                  ) : (
                    <div className="mt-2 flex min-h-6 items-center justify-center gap-2" aria-hidden="true">
                      <span className="voice-practice-dot" />
                      <span className="voice-practice-dot" />
                      <span className="voice-practice-dot" />
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div className="mt-7 grid w-full max-w-[34rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6 sm:gap-10">
            <div className="flex justify-end">
              <button type="button" onClick={() => pronounce(current.word)} style={speaking ? { background: theoryActionGradient } : undefined} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-body text-sm font-black shadow-md transition hover:-translate-y-0.5 ${speaking ? 'animate-pulse text-white hover:brightness-105 dark:text-white' : 'bg-white/90 text-[#7C3EDB] hover:bg-white dark:bg-white/15 dark:text-purple-100'}`} aria-label={copy.listenWord}>
                <Volume2 className="h-5 w-5" />
                {listenCta}
              </button>
            </div>
            <button type="button" onClick={recording ? stop : start} style={{ background: theoryActionGradient }} className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-xl shadow-purple-200/50 transition hover:-translate-y-0.5 hover:brightness-105 dark:shadow-none ${recording ? 'animate-pulse' : ''}`} aria-label={recording ? copy.stop : copy.sayIt}>
              {recording ? <Square className="h-6 w-6 fill-current" /> : <Mic className="h-8 w-8" />}
            </button>
            <div className="flex justify-start">
              <button type="button" onClick={() => { stop(); setTranscript(''); setMessage(''); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/90 px-5 font-body text-sm font-black text-purple-600 shadow-md transition hover:-translate-y-0.5 hover:bg-white dark:bg-white/15 dark:text-purple-100" aria-label={copy.tryAgain}>
                <RotateCcw className="h-5 w-5" />
                {copy.tryAgain}
              </button>
            </div>
          </div>
        </div>
        {status === 'excellent' && (
          <button type="button" onClick={goNextOrFinish} style={{ background: theoryActionGradient }} className="mt-4 rounded-2xl px-5 py-2.5 font-body text-sm font-black text-white shadow-lg shadow-purple-200/40 transition hover:-translate-y-0.5 hover:brightness-105 dark:shadow-none">
            {index >= practiceItems.length - 1 ? copy.finishPractice : copy.nextWord}
          </button>
        )}
      </div>
      )}
    </section>
  );
}

function VocabularyCard({ item, lang }: { item: TheoryVocabularyItem; lang: Lang }) {
  const copy = vc(lang);
  const { speaking, pronounce } = usePronunciation(lang, item.audio_url, item.audio);

  return (
    <button type="button" onClick={() => pronounce(item.word)} aria-label={`${copy.listenWord} ${item.word}`} className="group relative w-[min(15.5rem,76vw)] shrink-0 snap-start rounded-3xl border border-white bg-white/90 p-4 text-center shadow-md shadow-purple-100/40 transition duration-300 hover:-translate-y-1 hover:border-pink-200 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-pink-100 dark:border-purple-400/15 dark:bg-white/5 dark:shadow-none dark:hover:border-pink-400/30 dark:focus:ring-pink-400/10">
      <span style={speaking ? { background: theoryActionGradient } : undefined} className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl shadow-md transition ${speaking ? 'text-white' : 'bg-purple-50 text-purple-400 group-hover:bg-purple-100 group-hover:text-purple-600 dark:bg-white/10 dark:text-purple-200'}`}><Volume2 className={`h-4 w-4 ${speaking ? 'animate-pulse' : ''}`} /></span>
      <VocabularyVisual image={item.image} emoji={item.emoji} alt={item.word} className="mx-auto h-28 w-28 group-hover:scale-105" />
      <h4 className="mt-3 font-display text-xl font-black text-purple-800 dark:text-purple-100">{item.word || copy.word}</h4>
      {item.transcription && <div className="mt-1 font-body text-sm font-bold text-pink-400">{item.transcription}</div>}
      <div className="mt-2 font-body text-sm font-extrabold text-purple-500 dark:text-purple-200">{item.translation}</div>
      <div className="mt-3 font-body text-[11px] font-black uppercase text-purple-300 transition group-hover:text-pink-400 dark:text-purple-400">{copy.tapToListen}</div>
    </button>
  );
}

function ExampleCard({ item, index, lang }: { item: TheoryExampleItem; index: number; lang: Lang }) {
  const copy = vc(lang);
  const { speaking, pronounce } = usePronunciation(lang, item.audio_url, item.audio);
  const listenCta = lang === 'en' ? 'Listen' : lang === 'ua' ? 'Прослухати' : 'Прослушать';
  const sentenceKey = item.sentence.toLowerCase();
  const imageClass = sentenceKey.includes('love')
    ? 'absolute bottom-20 right-5 z-10 h-24 w-28 transition group-hover:scale-105 sm:h-28 sm:w-32'
    : sentenceKey.includes('morning')
      ? 'absolute bottom-16 right-5 z-10 h-28 w-32 transition group-hover:scale-105 sm:h-32 sm:w-36'
      : 'absolute bottom-16 right-5 z-10 h-24 w-28 transition group-hover:scale-105 sm:h-28 sm:w-32';
  return (
    <button type="button" onClick={() => pronounce(item.sentence)} aria-label={`${copy.listenSentence} ${item.sentence}`} className={`group relative min-h-[18rem] w-[min(17.5rem,78vw)] shrink-0 snap-start overflow-hidden rounded-[1.7rem] border bg-white p-5 text-left shadow-[0_16px_32px_rgba(126,87,194,0.10)] transition duration-300 hover:-translate-y-1 hover:border-purple-300 hover:shadow-[0_22px_42px_rgba(126,87,194,0.16)] focus:border-[#C084FC] focus:bg-[#FFF8FF] focus:outline-none focus:ring-4 focus:ring-purple-100 dark:border-purple-400/15 dark:bg-white/5 dark:focus:ring-pink-400/10 ${speaking ? 'border-[#C084FC] bg-[#FFF8FF]' : 'border-purple-100'}`}>
      <div className={`absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(250,232,255,0.95),transparent_38%),radial-gradient(circle_at_80%_82%,rgba(237,233,254,0.72),transparent_38%)] transition-opacity dark:opacity-20 ${speaking ? 'opacity-100' : 'opacity-0 group-focus:opacity-100'}`} />
      <div className="absolute left-5 right-5 top-5 z-10 flex items-center justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-2xl font-display text-sm font-black shadow-sm transition ${speaking ? 'bg-purple-100 text-[#7C3EDB]' : 'bg-pink-50 text-pink-500 group-focus:bg-purple-100 group-focus:text-[#7C3EDB] dark:bg-pink-500/20 dark:text-pink-100'}`}>{index + 1}</span>
        <span style={speaking ? { background: theoryActionGradient } : undefined} className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow-md transition ${speaking ? 'text-white' : 'bg-white text-[#7C3EDB] group-hover:bg-purple-50 dark:bg-white/10 dark:text-purple-100'}`}><Volume2 className={`h-5 w-5 ${speaking ? 'animate-pulse' : ''}`} /></span>
      </div>
      <div className="absolute left-5 top-[4.6rem] z-10 max-w-[72%]">
        <div className="font-display text-xl font-black text-purple-950 dark:text-purple-100">{item.sentence || 'Example sentence'}</div>
        {item.translation && <div className="mt-3 font-body text-sm font-extrabold text-purple-500 dark:text-purple-200">{item.translation}</div>}
        {item.note && <div className="mt-3 rounded-xl bg-purple-50/80 px-3 py-2 font-body text-xs font-bold text-purple-400 dark:bg-white/5 dark:text-purple-300">{item.note}</div>}
      </div>
      {item.image && <VocabularyVisual image={item.image} alt={item.sentence} className={imageClass} />}
      <span className="absolute bottom-5 left-5 z-10 inline-flex min-h-10 items-center gap-2 rounded-2xl border border-purple-100 bg-white/80 px-4 font-body text-sm font-black text-[#9B48FF] shadow-sm transition group-hover:border-purple-200 group-hover:bg-purple-50 dark:border-purple-400/15 dark:bg-white/10 dark:text-purple-100">
        <Volume2 className="h-4 w-4" />
        {listenCta}
      </span>
    </button>
  );
}

function VocabularySection({ title, items, lang }: { title: string; items: TheoryVocabularyItem[]; lang: Lang }) {
  const copy = vc(lang);
  if (items.length === 0) return null;
  const scrollLabel = lang === 'en' ? 'Scroll words' : lang === 'ua' ? 'Прокрутити слова' : 'Прокрутить слова';
  return (
    <section className="rounded-[1.75rem] border border-pink-100 bg-gradient-to-br from-pink-50/60 via-white to-purple-50/50 p-5 dark:border-pink-400/15 dark:from-pink-500/10 dark:via-white/5 dark:to-purple-500/10">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-pink-500 shadow-sm dark:bg-white/10"><Languages className="h-5 w-5" /></span>
        <h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{translateDefaultTitle(lang, title) || copy.newWords}</h3>
      </div>
      <HorizontalCardScroller ariaLabel={scrollLabel}>
        {items.map(item => <VocabularyCard key={item.id} item={item} lang={lang} />)}
      </HorizontalCardScroller>
    </section>
  );
}

function ExamplesSection({ title, items, lang }: { title: string; items: TheoryExampleItem[]; lang: Lang }) {
  const copy = vc(lang);
  if (items.length === 0) return null;
  const scrollLabel = lang === 'en' ? 'Scroll examples' : lang === 'ua' ? 'Прокрутити приклади' : 'Прокрутить примеры';
  return (
    <section className="rounded-[1.75rem] border border-violet-100 bg-gradient-to-br from-violet-50/70 via-white to-pink-50/50 p-5 dark:border-violet-400/15 dark:from-violet-500/10 dark:via-white/5 dark:to-pink-500/10">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-violet-500 shadow-sm dark:bg-white/10"><MessageSquareQuote className="h-5 w-5" /></span>
        <h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{translateDefaultTitle(lang, title) || copy.examples}</h3>
      </div>
      <HorizontalCardScroller ariaLabel={scrollLabel}>
        {items.map((item, index) => <ExampleCard key={item.id} item={item} index={index} lang={lang} />)}
      </HorizontalCardScroller>
    </section>
  );
}

function TheoryImage({ block, lang }: { block: TheoryImageBlock; lang: Lang }) {
  return (
    <section className="rounded-[1.75rem] border border-sky-100 bg-gradient-to-br from-sky-50/80 via-white to-purple-50/60 p-5 dark:border-sky-400/15 dark:from-sky-500/10 dark:via-white/5 dark:to-purple-500/10">
      {block.title && <h3 className="mb-4 font-display text-2xl font-black text-purple-800 dark:text-purple-100">{translateDefaultTitle(lang, block.title)}</h3>}
      {block.image
        ? <WorkbookAssetImage path={block.image} alt={block.caption || block.title || 'Theory'} className={`mx-auto rounded-3xl object-contain shadow-lg ${block.size === 'small' ? 'max-h-52 max-w-sm' : 'max-h-96 max-w-2xl'}`} surface="TheoryLessonView.TheoryImage" fallback={<div className="mx-auto flex h-40 max-w-md items-center justify-center rounded-3xl border border-dashed border-purple-200 bg-white/70 text-purple-300 dark:border-purple-700 dark:bg-white/5"><ImageIcon className="h-10 w-10" /></div>} />
        : <div className="mx-auto flex h-40 max-w-md items-center justify-center rounded-3xl border border-dashed border-purple-200 bg-white/70 text-purple-300 dark:border-purple-700 dark:bg-white/5"><ImageIcon className="h-10 w-10" /></div>}
      {block.caption && <p className="mx-auto mt-4 max-w-2xl text-center font-body text-sm font-bold leading-6 text-purple-500 dark:text-purple-200">{block.caption}</p>}
    </section>
  );
}

function TextBlock({ block, lang }: { block: TheoryTextBlock; lang: Lang }) {
  const lines = block.body.split('\n').map(line => line.trim()).filter(Boolean);
  if (block.style === 'rule') return (
    <section className="rounded-[1.75rem] border border-pink-100 bg-gradient-to-r from-pink-50 via-purple-50 to-sky-50 p-5 shadow-sm dark:border-pink-400/15 dark:from-pink-500/10 dark:via-purple-500/10 dark:to-sky-500/10">
      <div className="flex gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-pink-500 shadow-sm dark:bg-white/10"><Sparkles className="h-5 w-5" /></span><div>{block.title && <h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{translateDefaultTitle(lang, block.title)}</h3>}<p className="mt-2 whitespace-pre-line font-body text-base font-bold leading-8 text-purple-600 dark:text-purple-200">{block.body}</p></div></div>
    </section>
  );
  return (
    <section className="rounded-[1.75rem] border border-purple-100 bg-white/85 p-5 shadow-sm dark:border-purple-400/15 dark:bg-white/5">
      {block.title && <h3 className="mb-3 font-display text-2xl font-black text-purple-800 dark:text-purple-100">{translateDefaultTitle(lang, block.title)}</h3>}
      {block.style === 'paragraph' ? <p className="whitespace-pre-line font-body text-base font-bold leading-8 text-purple-600 dark:text-purple-200">{block.body}</p> : block.style === 'numbered' ? <ol className="space-y-3">{lines.map((line, index) => <li key={index} className="flex gap-3 font-body text-base font-bold leading-7 text-purple-600 dark:text-purple-200"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 to-purple-100 text-xs font-black text-purple-600 dark:from-pink-500/20 dark:to-purple-500/20 dark:text-purple-100">{index + 1}</span><span>{line}</span></li>)}</ol> : <ul className="space-y-3">{lines.map((line, index) => <li key={index} className="flex gap-3 font-body text-base font-bold leading-7 text-purple-600 dark:text-purple-200"><Check className="mt-1 h-5 w-5 shrink-0 text-pink-400" /><span>{line}</span></li>)}</ul>}
    </section>
  );
}

function BlockView({ block, lang }: { block: TheoryBlock; lang: Lang }) {
  const copy = vc(lang);
  if (block.type === 'text') return <TextBlock block={block} lang={lang} />;
  if (block.type === 'image') return <TheoryImage block={block} lang={lang} />;
  if (block.type === 'audio') return <TheoryAudio block={block} lang={lang} />;
  if (block.type === 'rule') {
    const accent = block.accent === 'mint'
      ? 'border-emerald-100 from-emerald-50 via-white to-sky-50 dark:border-emerald-400/15 dark:from-emerald-500/10 dark:to-sky-500/10'
      : block.accent === 'purple'
        ? 'border-purple-100 from-purple-50 via-white to-violet-50 dark:border-purple-400/15 dark:from-purple-500/10 dark:to-violet-500/10'
        : 'border-pink-100 from-pink-50 via-white to-purple-50 dark:border-pink-400/15 dark:from-pink-500/10 dark:to-purple-500/10';
    return (
      <section className={`rounded-[1.75rem] border bg-gradient-to-r p-5 shadow-sm ${accent}`}>
        <div className="flex gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-500 shadow-md dark:bg-white/10"><Lightbulb className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{translateDefaultTitle(lang, block.title) || copy.rememberRule}</h3>
            <p className="mt-2 whitespace-pre-line font-body text-base font-bold leading-8 text-purple-600 dark:text-purple-200">{block.body}</p>
            {block.formula && <div className="mt-4 rounded-2xl border border-white bg-white/80 px-4 py-3 text-center font-display text-base font-black text-purple-700 shadow-sm dark:border-purple-400/15 dark:bg-white/5 dark:text-purple-100">{block.formula}</div>}
          </div>
        </div>
      </section>
    );
  }
  if (block.type === 'examples') return (
    <section className="rounded-[1.75rem] border border-violet-100 bg-gradient-to-br from-violet-50/70 via-white to-pink-50/50 p-5 dark:border-violet-400/15 dark:from-violet-500/10 dark:via-white/5 dark:to-pink-500/10">
      <div className="mb-5 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-violet-500 shadow-sm dark:bg-white/10"><MessageSquareQuote className="h-5 w-5" /></span><h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{translateDefaultTitle(lang, block.title) || copy.examples}</h3></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{block.items.map((item, index) => <ExampleCard key={item.id} item={item} index={index} lang={lang} />)}</div>
    </section>
  );
  if (block.type === 'vocabulary') return (
    <>
      <section className="rounded-[1.75rem] border border-pink-100 bg-gradient-to-br from-pink-50/60 via-white to-purple-50/50 p-5 dark:border-pink-400/15 dark:from-pink-500/10 dark:via-white/5 dark:to-purple-500/10">
        <div className="mb-5 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-pink-500 shadow-sm dark:bg-white/10"><Languages className="h-5 w-5" /></span><h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{translateDefaultTitle(lang, block.title) || copy.newWords}</h3></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{block.items.map(item => <VocabularyCard key={item.id} item={item} lang={lang} />)}</div>
      </section>
      <TheoryVoicePractice items={block.items} lang={lang} />
    </>
  );
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-purple-100 bg-white shadow-sm dark:border-purple-400/15 dark:bg-white/5">
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 px-5 py-4 dark:from-pink-500/10 dark:to-purple-500/10"><h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{translateDefaultTitle(lang, block.title) || copy.grammarRule}</h3></div>
      <div className="overflow-x-auto"><table className="min-w-[620px] w-full border-collapse"><thead><tr>{block.columns.map((column, index) => <th key={index} className="border-b border-r border-purple-100 bg-purple-50/60 px-4 py-3 text-left font-display text-sm font-black text-purple-700 last:border-r-0 dark:border-purple-400/15 dark:bg-white/5 dark:text-purple-100">{column}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="transition hover:bg-pink-50/40 dark:hover:bg-white/5">{block.columns.map((_, cellIndex) => <td key={cellIndex} className="border-b border-r border-purple-50 px-4 py-3 font-body text-sm font-bold leading-6 text-purple-600 last:border-r-0 dark:border-purple-400/10 dark:text-purple-200">{row[cellIndex]}</td>)}</tr>)}</tbody></table></div>
    </section>
  );
}

export default function TheoryLessonView({ content, fallbackTitle, lang = 'ru' }: { content?: Partial<TheoryContent>; fallbackTitle: string; lang?: Lang }) {
  const copy = vc(lang);
  const title = content?.title || fallbackTitle;
  const blocks = content?.blocks || [];
  const vocabularyBlocks = blocks.filter((block): block is Extract<TheoryBlock, { type: 'vocabulary' }> => block.type === 'vocabulary');
  const audioBlocks = blocks.filter((block): block is Extract<TheoryBlock, { type: 'audio' }> => block.type === 'audio');
  const exampleBlocks = blocks.filter((block): block is Extract<TheoryBlock, { type: 'examples' }> => block.type === 'examples');
  const vocabularyItems = vocabularyBlocks.flatMap(block => block.items);
  const exampleItems = exampleBlocks.flatMap(block => block.items);
  const firstTextBlock = blocks.find((block): block is Extract<TheoryBlock, { type: 'text' }> => block.type === 'text' && Boolean(block.body?.trim()));
  const supportingBlocks = blocks.filter(block => block.type !== 'vocabulary' && block.type !== 'examples' && block.id !== firstTextBlock?.id);
  const progressPercent = Math.min(100, Math.round((Math.min(vocabularyItems.length, 10) / 10) * 100));
  const layoutCopy = {
    ru: {
      badge: 'Теоретический урок',
      progress: 'Твой прогресс',
      words: 'слов изучено',
      practice: 'практика',
      audio: 'аудио',
      plan: 'Что будем делать?',
      heroGreetingTitle: 'Привет! 👋',
      heroGreetingBody: 'Давай выучим новые слова\nи разберём теорию в этом уроке!',
      defaultIntro: 'Сегодня мы учим новую тему на английском языке. Слушай произношение и повторяй за диктором.',
      steps: ['Изучим новые слова', 'Послушаем произношение', 'Потренируемся в примерах'],
      tip: 'Совет',
      tipBody: 'Повторяй слова вслух несколько раз, чтобы лучше запомнить!',
      howTitle: 'Как это работает?',
      howSteps: [
        'Нажми на микрофон и произнеси слово',
        'Сова послушает и оценит твоё произношение',
        'Когда произнесёшь правильно — откроется следующее слово!',
      ],
      goalTitle: 'Ты почти на вершине!',
      goalBody: 'Продолжай практиковаться каждый день и получай звёзды!',
      goalProgress: '14 / 20',
      encourageTitle: 'Ты справишься!',
      encourageBody: 'Наша сова-учитель всегда рядом',
    },
    en: {
      badge: 'Theory lesson',
      progress: 'Your progress',
      words: 'words learned',
      practice: 'practice',
      audio: 'audio',
      plan: 'What will we do?',
      heroGreetingTitle: 'Hi! 👋',
      heroGreetingBody: 'Let’s learn new words\nand explore the theory in this lesson!',
      defaultIntro: 'Today we learn a new topic in English. Listen to the pronunciation and repeat after the speaker.',
      steps: ['Learn new words', 'Listen to pronunciation', 'Practice with examples'],
      tip: 'Tip',
      tipBody: 'Repeat the words aloud a few times so they stick better!',
      howTitle: 'How does it work?',
      howSteps: [
        'Tap the microphone and say the word',
        'The owl will listen and check your pronunciation',
        'Say it correctly to unlock the next word!',
      ],
      goalTitle: 'Almost at the top!',
      goalBody: 'Keep practicing every day and collect stars!',
      goalProgress: '14 / 20',
      encourageTitle: 'You can do it!',
      encourageBody: 'Our owl teacher is always nearby',
    },
    ua: {
      badge: 'Теоретичний урок',
      progress: 'Твій прогрес',
      words: 'слів вивчено',
      practice: 'практика',
      audio: 'аудіо',
      plan: 'Що будемо робити?',
      heroGreetingTitle: 'Привіт! 👋',
      heroGreetingBody: 'Давай вивчимо нові слова\nі розберемо теорію в цьому уроці!',
      defaultIntro: 'Сьогодні ми вивчаємо нову тему англійською. Слухай вимову та повторюй за диктором.',
      steps: ['Вивчимо нові слова', 'Послухаємо вимову', 'Потренуємося у прикладах'],
      tip: 'Порада',
      tipBody: 'Повторюй слова вголос кілька разів, щоб краще запамʼятати!',
      howTitle: 'Як це працює?',
      howSteps: [
        'Натисни на мікрофон і промов слово',
        'Сова послухає й оцінить твою вимову',
        'Коли промовиш правильно — відкриється наступне слово!',
      ],
      goalTitle: 'Ти майже на вершині!',
      goalBody: 'Продовжуй тренуватися щодня та отримуй зірки!',
      goalProgress: '14 / 20',
      encourageTitle: 'Ти впораєшся!',
      encourageBody: 'Наша сова-вчитель завжди поруч',
    },
  }[lang] || {
    badge: 'Теоретический урок',
    progress: 'Твой прогресс',
    words: 'слов изучено',
    practice: 'практика',
    audio: 'аудио',
    plan: 'Что будем делать?',
    heroGreetingTitle: 'Привет! 👋',
    heroGreetingBody: 'Давай выучим новые слова\nи разберём теорию в этом уроке!',
    defaultIntro: 'Сегодня мы учим новую тему на английском языке. Слушай произношение и повторяй за диктором.',
    steps: ['Изучим новые слова', 'Послушаем произношение', 'Потренируемся в примерах'],
    tip: 'Совет',
    tipBody: 'Повторяй слова вслух несколько раз, чтобы лучше запомнить!',
    howTitle: 'Как это работает?',
    howSteps: [
      'Нажми на микрофон и произнеси слово',
      'Сова послушает и оценит твоё произношение',
      'Когда произнесёшь правильно — откроется следующее слово!',
    ],
    goalTitle: 'Ты почти на вершине!',
    goalBody: 'Продолжай практиковаться каждый день и получай звёзды!',
    goalProgress: '14 / 20',
    encourageTitle: 'Ты справишься!',
    encourageBody: 'Наша сова-учитель всегда рядом',
  };
  const progressStats = [
    { value: `${Math.min(vocabularyItems.length, 10)}/10`, label: layoutCopy.words },
    { value: `${Math.min(exampleBlocks.reduce((sum, block) => sum + block.items.length, 0), 3)}/3`, label: layoutCopy.practice },
    { value: `${Math.min(audioBlocks.length, 2)}/2`, label: layoutCopy.audio },
  ];
  const goalProgressTotal = 20;
  const goalProgressValue = Math.round((progressPercent / 100) * goalProgressTotal);
  const goalProgressLabel = `${goalProgressValue} / ${goalProgressTotal}`;
  const planTitle = content?.planTitle?.trim() || layoutCopy.plan;
  const planSteps = (content?.planSteps || []).map(step => step.trim()).filter(Boolean);
  const visiblePlanSteps = planSteps.length > 0 ? planSteps : layoutCopy.steps;
  const tipTitle = content?.tipTitle?.trim() || layoutCopy.tip;
  const tipBody = content?.tipBody?.trim() || layoutCopy.tipBody;

  return (
    <div className="relative space-y-5">
      <section
        className="relative h-[clamp(18.7rem,23.5vw,21.7rem)] min-w-0 overflow-hidden rounded-[1.7rem] shadow-[0_18px_44px_rgba(139,92,246,0.14)]"
      >
        <div
          className="absolute inset-0 bg-center bg-no-repeat dark:hidden"
          style={{
            backgroundImage: "url('/backgrounds/theory-lesson-owl-hero.png')",
            backgroundPosition: 'center 50%',
            backgroundSize: '103% auto',
          }}
        />
        <div
          className="absolute inset-0 hidden bg-center bg-no-repeat dark:block"
          style={{
            backgroundImage: "url('/backgrounds/theory-lesson-owl-hero-dark.png')",
            backgroundPosition: 'center 50%',
            backgroundSize: '100% auto',
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(112,67,222,0.2)_0%,rgba(112,67,222,0.05)_50%,rgba(255,255,255,0)_100%)]" />
        <div className="relative z-10 flex h-full px-[clamp(1.5rem,2.45vw,2.65rem)] py-[clamp(1rem,1.9vw,1.45rem)]">
          <div className="flex max-w-[29rem] flex-col justify-between">
            <div className="translate-x-3 translate-y-2">
              <h2 className="font-display text-[clamp(2.75rem,6vw,4.75rem)] font-black leading-none text-white drop-shadow-[0_8px_22px_rgba(58,28,128,0.24)]">{title}</h2>
              {content?.subtitle && <p className="mt-3 translate-x-2 font-display text-[clamp(1.08rem,1.7vw,1.45rem)] font-bold leading-snug text-white drop-shadow-[0_4px_14px_rgba(58,28,128,0.18)]">{content.subtitle}</p>}
            </div>
            <div className="relative mt-6 max-w-[25rem] translate-x-3 rounded-[1.35rem] bg-white/95 px-6 py-5 font-body text-sm font-extrabold leading-7 text-purple-900 shadow-[0_18px_38px_rgba(105,62,185,0.20)]">
              <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rotate-45 bg-white/94" />
              <span className="relative block font-display text-lg font-black text-purple-700">{layoutCopy.heroGreetingTitle}</span>
              <span className="relative mt-2 block whitespace-pre-line">{layoutCopy.heroGreetingBody}</span>
            </div>
          </div>

        </div>
      </section>

      <div className="relative isolate grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <main className="relative z-10 space-y-5">
          {blocks.length > 0 ? (
            <>
              <VocabularySection title={vocabularyBlocks[0]?.title || ''} items={vocabularyItems} lang={lang} />
              {vocabularyItems.length > 0 && <TheoryVoicePractice items={vocabularyItems} lang={lang} />}
              <ExamplesSection title={exampleBlocks[0]?.title || ''} items={exampleItems} lang={lang} />
              {supportingBlocks.map(block => <BlockView key={block.id} block={block} lang={lang} />)}
            </>
          ) : <div className="rounded-3xl border border-dashed border-purple-200 bg-purple-50/50 p-8 text-center font-body font-bold text-purple-400 dark:border-purple-700 dark:bg-white/5">{copy.materialSoon}</div>}
        </main>

        <aside className="relative z-20 flex flex-col gap-4">
        <section className="theory-dark-solid-card rounded-[1.7rem] border border-purple-100 bg-white px-6 py-5 shadow-[0_18px_38px_rgba(168,85,247,0.10)] dark:border-purple-500/25">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-display text-xl font-black text-purple-700 dark:text-purple-100">{layoutCopy.progress}</h3>
            <span className="font-display text-lg font-black text-purple-500 dark:text-purple-100">{progressPercent}%</span>
          </div>
          <div className="h-3.5 rounded-full bg-purple-50 shadow-inner dark:bg-white/20">
            <div className="h-full rounded-full shadow-[0_0_16px_rgba(168,85,247,0.28)]" style={{ width: `${progressPercent}%`, background: theoryActionGradient }} />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {progressStats.map(item => (
              <div key={item.label} className="theory-dark-solid-stat rounded-[1.15rem] border border-purple-100 bg-white px-2 py-3 text-center shadow-sm dark:border-purple-500/25 dark:!bg-[#231135]">
                <div className="font-display text-xl font-black text-purple-700 dark:text-purple-100">{item.value}</div>
                <div className="mt-1 font-body text-[0.64rem] font-black text-purple-300 dark:text-purple-200">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="theory-dark-solid-card rounded-[1.7rem] border border-purple-100 bg-white px-6 py-5 shadow-[0_18px_38px_rgba(168,85,247,0.10)] dark:border-purple-500/25">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-xl font-black text-purple-700 dark:text-purple-100">{planTitle}</h3>
            <img src="/backgrounds/theory-plan-star.png" alt="" draggable={false} className="h-11 w-11 scale-[1.85] select-none object-contain" />
          </div>
          <div className="space-y-3">
            {visiblePlanSteps.map((step, index) => (
              <div key={step} className="flex items-center gap-3 font-body text-sm font-extrabold text-purple-700 dark:text-purple-200">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${index === 2 ? 'bg-pink-100 text-pink-500 dark:bg-pink-500/20 dark:text-pink-100' : 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-100'}`}><Check className="h-4 w-4" /></span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="theory-dark-solid-card rounded-[1.7rem] border border-purple-100 bg-white px-6 py-5 shadow-[0_18px_38px_rgba(168,85,247,0.10)] dark:border-purple-500/25">
          <div className="mb-3 flex items-center gap-3">
            <img src="/backgrounds/theory-tip-bulb.png" alt="" draggable={false} className="h-10 w-10 scale-[1.55] select-none object-contain" />
            <h3 className="font-display text-xl font-black text-purple-700 dark:text-purple-100">{tipTitle}</h3>
          </div>
          <div className="theory-dark-solid-stat rounded-[1.2rem] border border-dashed border-pink-200 bg-white/80 px-5 py-4 text-center font-body text-sm font-extrabold leading-6 text-purple-900 dark:border-pink-400/30 dark:!bg-[#231135] dark:text-purple-100">
            {tipBody}
          </div>
        </section>

        <section className="theory-dark-solid-card rounded-[1.7rem] border border-dashed border-purple-200 bg-white px-6 py-5 shadow-[0_18px_38px_rgba(168,85,247,0.10)] dark:border-purple-500/30">
          <h3 className="font-display text-xl font-black text-purple-800 dark:text-purple-100">{layoutCopy.howTitle}</h3>
          <div className="mt-5 space-y-4">
            {layoutCopy.howSteps.map((step, index) => (
              <div key={step} className="flex items-start gap-4 font-body text-sm font-extrabold leading-6 text-purple-900 dark:text-purple-100">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center text-xl text-[#7C3EDB]">
                  {index === 0 ? <Mic className="h-6 w-6" /> : index === 1 ? '🦉' : '⭐'}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="theory-dark-solid-card relative min-h-[8.7rem] overflow-hidden rounded-[1.7rem] border border-purple-100 bg-white px-6 py-5 shadow-[0_18px_38px_rgba(168,85,247,0.10)] dark:border-purple-500/25">
          <div className="relative z-10 max-w-[12rem] pt-3">
            <h3 className="font-display text-xl font-black text-purple-700 dark:text-purple-100">{layoutCopy.encourageTitle}</h3>
            <p className="mt-3 font-body text-sm font-extrabold leading-6 text-purple-500 dark:text-purple-200">{layoutCopy.encourageBody} 💜</p>
          </div>
          <img
            src="/backgrounds/theory-lesson-encourage-owl.png"
            alt=""
            draggable={false}
            className="absolute bottom-[-0.9rem] right-[0.25rem] h-[8.9rem] w-[13.35rem] select-none object-contain object-right-bottom [mask-image:linear-gradient(to_right,transparent_0%,black_22%)]"
          />
        </section>

        <section className="relative w-full">
          <img
            src="/backgrounds/theory-goal-owl-card.png"
            alt=""
            draggable={false}
            className="block h-[28.6rem] w-full select-none rounded-[1.7rem] object-cover dark:hidden"
          />
          <img
            src="/backgrounds/theory-goal-owl-card-dark.png"
            alt=""
            draggable={false}
            className="hidden h-[28.6rem] w-full select-none rounded-[1.7rem] object-cover object-center dark:block"
          />
          <div className="pointer-events-none absolute inset-x-[8%] top-[10%] z-10 flex flex-col items-center text-center">
            <h3 className="max-w-[18rem] font-display text-xl font-black leading-tight text-purple-900 drop-shadow-[0_2px_8px_rgba(255,255,255,0.9)] dark:text-purple-100 dark:drop-shadow-[0_2px_8px_rgba(33,16,52,0.9)]">{layoutCopy.goalTitle}</h3>
            <p className="mt-2 max-w-[19rem] font-body text-xs font-bold leading-5 text-purple-700 drop-shadow-[0_2px_8px_rgba(255,255,255,0.9)] dark:text-purple-200 dark:drop-shadow-[0_2px_8px_rgba(33,16,52,0.9)]">{layoutCopy.goalBody}</p>
            <div className="-mt-1 flex -translate-x-9 items-center justify-center gap-0.5">
              <img src="/backgrounds/theory-goal-progress-star.png" alt="" draggable={false} className="h-[4.35rem] w-[4.35rem] translate-x-2 select-none object-contain" />
              <span className="font-display text-lg font-black leading-none text-purple-900 drop-shadow-[0_2px_8px_rgba(255,255,255,0.9)] dark:text-purple-100 dark:drop-shadow-[0_2px_8px_rgba(33,16,52,0.9)]">{goalProgressLabel}</span>
            </div>
            <div className="-mt-3 h-2.5 w-full max-w-[18rem] overflow-hidden rounded-full bg-purple-100/80 dark:bg-[#26114a]/85">
              <div className="h-full rounded-full bg-gradient-to-r from-[#B54EFF] to-[#D879FF] dark:from-[#7D2BCC] dark:to-[#B747E7]" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </section>
        </aside>
      </div>
      <div className="pointer-events-none absolute bottom-0 right-0 z-30 hidden h-[32.4rem] w-[33.5rem] translate-x-[3.25rem] translate-y-[6.75rem] overflow-hidden xl:block dark:hidden 2xl:h-[35.7rem] 2xl:w-[37rem] 2xl:translate-x-[3.75rem] 2xl:translate-y-[7.25rem]">
        <img
          src="/backgrounds/theory-bottom-cloud-books.png"
          alt=""
          draggable={false}
          className="absolute bottom-[-1.4rem] right-0 h-[33.5rem] w-[33.5rem] select-none object-contain 2xl:h-[37rem] 2xl:w-[37rem]"
        />
      </div>
      <div className="pointer-events-none absolute bottom-0 right-0 z-30 hidden h-[32.4rem] w-[33.5rem] translate-x-[3.25rem] translate-y-[6.75rem] overflow-hidden dark:xl:block 2xl:h-[35.7rem] 2xl:w-[37rem] 2xl:translate-x-[3.75rem] 2xl:translate-y-[7.25rem]">
        <img
          src="/backgrounds/theory-bottom-cloud-books-dark.png"
          alt=""
          draggable={false}
          className="absolute bottom-[-1.4rem] right-0 h-[33.5rem] w-[33.5rem] select-none object-contain 2xl:h-[37rem] 2xl:w-[37rem]"
        />
      </div>
    </div>
  );
}
