import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, Download, Headphones, Image as ImageIcon, Languages, Lightbulb, Loader2, MessageSquareQuote, Mic, Pause, Play, RotateCcw, Sparkles, Square, Volume2 } from 'lucide-react';
import { signedUrlFor } from '../lib/workbooks';
import type { TheoryBlock, TheoryContent, TheoryExampleItem, TheoryImageBlock, TheoryTextBlock, TheoryVocabularyItem } from '../lib/theory';
import { toast } from 'sonner';
import { signedLessonAudioUrl } from '../lib/cardAudio';
import type { Lang } from '../lib/i18n';

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
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<{ transcript?: string }>> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

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

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [url]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
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
    <div className="mt-5 rounded-3xl border border-pink-100 bg-white/90 p-4 shadow-lg shadow-purple-100/40 dark:border-purple-400/20 dark:bg-[#241331] dark:shadow-none">
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
      <div className="flex items-center gap-3">
        <button type="button" onClick={togglePlayback} aria-label={playing ? copy.pause : copy.play} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-md transition hover:scale-105 hover:brightness-105">
          {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3 font-body text-xs font-black text-purple-500 dark:text-purple-200">
            <span>{playing ? copy.listening : copy.ready}</span>
            <span>{formatAudioTime(currentTime)} / {formatAudioTime(duration)}</span>
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
            className="h-2 w-full cursor-pointer accent-pink-500"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-purple-50 pt-4 dark:border-purple-400/10">
        <div className="flex min-w-[150px] flex-1 items-center gap-2 text-purple-400 dark:text-purple-200">
          <Volume2 className="h-4 w-4 shrink-0" />
          <input type="range" min="0" max="1" step="0.05" value={volume} onChange={event => { const value = Number(event.target.value); setVolume(value); if (audioRef.current) audioRef.current.volume = value; }} aria-label={copy.volume} className="h-1.5 max-w-32 flex-1 cursor-pointer accent-purple-500" />
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-purple-50 p-1 dark:bg-white/5" aria-label={copy.speed}>
          {[0.75, 1, 1.25, 1.5].map(value => <button key={value} type="button" onClick={() => changeSpeed(value)} className={`rounded-lg px-2.5 py-1.5 font-body text-xs font-black transition ${speed === value ? 'bg-white text-purple-700 shadow-sm dark:bg-purple-500/25 dark:text-purple-100' : 'text-purple-400 hover:text-purple-600 dark:text-purple-300'}`}>{value}x</button>)}
        </div>
        <button type="button" onClick={download} disabled={downloading} className="inline-flex items-center gap-2 rounded-xl border border-purple-100 bg-white px-3 py-2 font-body text-xs font-black text-purple-600 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500 disabled:opacity-50 dark:border-purple-400/20 dark:bg-white/5 dark:text-purple-100 dark:hover:bg-pink-500/10">
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
    activeVocabularyAudio?.pause();
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
  const playedTranscriptRef = useRef('');
  const { speaking, pronounce } = usePronunciation(lang, current?.audio_url, current?.audio);
  const score = transcript && current ? voiceSimilarity(current.word, transcript) : null;
  const status = score === null ? null : score >= 0.86 ? 'excellent' : score >= 0.62 ? 'almost' : score >= 0.38 ? 'sound' : 'retry';
  const label = status === 'excellent' ? copy.excellent : status === 'almost' ? copy.almost : status === 'sound' ? copy.listenSound : status === 'retry' ? copy.tryAgain : '';
  const tone = status === 'excellent'
    ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100'
    : status === 'almost'
      ? 'border-yellow-100 bg-yellow-50 text-yellow-700 dark:border-yellow-500/25 dark:bg-yellow-500/10 dark:text-yellow-100'
      : status === 'sound'
        ? 'border-orange-100 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-100'
        : 'border-purple-100 bg-purple-50 text-purple-500 dark:border-purple-500/20 dark:bg-white/5 dark:text-purple-200';

  useEffect(() => () => {
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
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const value = Array.from(event.results).map(result => Array.from(result)[0]?.transcript || '').join(' ').trim();
      setTranscript(value);
    };
    recognition.onerror = () => {
      setMessage(copy.tryAgain);
      setRecording(false);
      micStreamRef.current?.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    };
    recognition.onend = () => {
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
        <span className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-md sm:mx-0"><Mic className="h-7 w-7" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{copy.voicePractice}</h3>
          <p className="mt-1 font-body text-sm font-bold leading-6 text-purple-500 dark:text-purple-200">{copy.voicePracticeHint}</p>
        </div>
        <div className="rounded-2xl bg-white/80 px-4 py-2 text-center font-body text-xs font-black text-purple-400 shadow-sm dark:bg-white/10 dark:text-purple-200">{index + 1} / {practiceItems.length}</div>
      </div>

      {finished ? (
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-white bg-white/90 p-5 shadow-md dark:border-purple-400/15 dark:bg-white/5">
          <div className="flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:text-left">
            <span className={`mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md sm:mx-0 ${allExcellent ? 'bg-emerald-400' : 'bg-gradient-to-br from-pink-400 to-purple-500'}`}>
              {allExcellent ? <Check className="h-7 w-7" /> : <Headphones className="h-7 w-7" />}
            </span>
            <div>
              <h4 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{copy.practiceComplete}</h4>
              <p className="mt-1 font-body text-sm font-bold text-purple-500 dark:text-purple-200">{allExcellent ? copy.practiceAllGreat : copy.practiceNeedsRepeat}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {practiceItems.map(item => {
              const result = results[item.id];
              const ok = result?.status === 'excellent';
              return (
                <div key={item.id} className={`rounded-2xl border px-3 py-3 ${ok ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100' : 'border-orange-100 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-100'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-black">{item.word}</span>
                    <span className="font-body text-[10px] font-black uppercase tracking-wider">{ok ? copy.excellent : copy.tryAgain}</span>
                  </div>
                  {result?.transcript && <div className="mt-1 font-body text-xs font-bold opacity-80">{copy.heard}: {result.transcript}</div>}
                </div>
              );
            })}
          </div>
          {!allExcellent && (
            <div className="mt-5 flex justify-center">
              <button type="button" onClick={repeatDifficult} className="rounded-2xl bg-gradient-to-r from-pink-400 to-purple-500 px-5 py-2.5 font-body text-sm font-black text-white shadow-lg shadow-pink-200/40 transition hover:-translate-y-0.5 dark:shadow-none">
                {copy.repeatDifficultWords}
              </button>
            </div>
          )}
        </div>
      ) : (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-white bg-white/90 p-5 text-center shadow-md dark:border-purple-400/15 dark:bg-white/5">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-pink-50 to-purple-50 text-5xl dark:from-pink-500/10 dark:to-purple-500/10">{current.emoji || '✨'}</div>
        <div className="mt-4 font-body text-xs font-black uppercase tracking-wider text-pink-400">{copy.repeatWord}</div>
        <h4 className="mt-1 font-display text-3xl font-black text-purple-800 dark:text-purple-100">{current.word}</h4>
        {current.transcription && <div className="mt-1 font-body text-sm font-bold text-pink-400">{current.transcription}</div>}
        <div className="mt-2 font-body text-sm font-extrabold text-purple-500 dark:text-purple-200">{current.translation}</div>

        <div className={`mt-4 rounded-2xl border px-3 py-3 text-left transition ${tone}`}>
          <div className="font-body text-[11px] font-black uppercase tracking-wider opacity-80">{recording ? copy.listeningNow : label || copy.heard}</div>
          <div className="mt-1 min-h-6 font-body text-sm font-extrabold">{transcript || message || '...'}</div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <button type="button" onClick={() => pronounce(current.word)} className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-500 transition hover:-translate-y-0.5 hover:bg-pink-50 hover:text-pink-500 dark:bg-white/10 dark:text-purple-100 ${speaking ? 'animate-pulse' : ''}`} aria-label={copy.listenWord}>
            <Volume2 className="h-5 w-5" />
          </button>
          <button type="button" onClick={recording ? stop : start} className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition hover:-translate-y-0.5 ${recording ? 'bg-gradient-to-br from-rose-400 to-pink-500 shadow-rose-200/50' : 'bg-gradient-to-br from-pink-400 to-purple-500 shadow-pink-200/50'}`} aria-label={recording ? copy.stop : copy.sayIt}>
            {recording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-6 w-6" />}
          </button>
          <button type="button" onClick={() => { setTranscript(''); setMessage(''); }} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-500 transition hover:-translate-y-0.5 hover:bg-purple-100 dark:bg-white/10 dark:text-purple-100" aria-label={copy.tryAgain}>
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
        {status === 'excellent' && (
          <button type="button" onClick={goNextOrFinish} className="mt-4 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-500 px-5 py-2.5 font-body text-sm font-black text-white shadow-lg shadow-pink-200/40 transition hover:-translate-y-0.5 dark:shadow-none">
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
    <button type="button" onClick={() => pronounce(item.word)} aria-label={`${copy.listenWord} ${item.word}`} className="group relative rounded-3xl border border-white bg-white/90 p-4 text-center shadow-md shadow-purple-100/40 transition duration-300 hover:-translate-y-1 hover:border-pink-200 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-pink-100 dark:border-purple-400/15 dark:bg-white/5 dark:shadow-none dark:hover:border-pink-400/30 dark:focus:ring-pink-400/10">
      <span className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl transition ${speaking ? 'bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-md' : 'bg-purple-50 text-purple-400 group-hover:bg-pink-50 group-hover:text-pink-500 dark:bg-white/10 dark:text-purple-200'}`}><Volume2 className={`h-4 w-4 ${speaking ? 'animate-pulse' : ''}`} /></span>
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-pink-50 to-purple-50 text-5xl transition group-hover:scale-105 dark:from-pink-500/10 dark:to-purple-500/10">{item.emoji || '✨'}</div>
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
  return (
    <button type="button" onClick={() => pronounce(item.sentence)} aria-label={`${copy.listenSentence} ${item.sentence}`} className="group relative rounded-3xl border border-white bg-white/90 p-4 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-pink-100 dark:border-purple-400/15 dark:bg-white/5 dark:focus:ring-pink-400/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 to-purple-100 font-display text-xs font-black text-purple-600 dark:from-pink-500/20 dark:to-purple-500/20 dark:text-purple-100">{index + 1}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${speaking ? 'bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-md' : 'bg-purple-50 text-purple-400 group-hover:bg-pink-50 group-hover:text-pink-500 dark:bg-white/10 dark:text-purple-200'}`}><Volume2 className={`h-4 w-4 ${speaking ? 'animate-pulse' : ''}`} /></span>
      </div>
      <div className="font-display text-lg font-black text-purple-800 dark:text-purple-100">{item.sentence || 'Example sentence'}</div>
      {item.translation && <div className="mt-2 font-body text-sm font-extrabold text-purple-500 dark:text-purple-200">{item.translation}</div>}
      {item.note && <div className="mt-3 rounded-xl bg-purple-50 px-3 py-2 font-body text-xs font-bold text-purple-400 dark:bg-white/5 dark:text-purple-300">{item.note}</div>}
      <div className="mt-3 font-body text-[11px] font-black uppercase text-purple-300 transition group-hover:text-pink-400 dark:text-purple-400">{copy.tapToListen}</div>
    </button>
  );
}

function TheoryImage({ block, lang }: { block: TheoryImageBlock; lang: Lang }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!block.image) return setUrl(null);
    if (/^(https?:|data:|blob:)/.test(block.image)) setUrl(block.image);
    else signedUrlFor(block.image, 3600).then(value => { if (alive) setUrl(value); });
    return () => { alive = false; };
  }, [block.image]);
  return (
    <section className="rounded-[1.75rem] border border-sky-100 bg-gradient-to-br from-sky-50/80 via-white to-purple-50/60 p-5 dark:border-sky-400/15 dark:from-sky-500/10 dark:via-white/5 dark:to-purple-500/10">
      {block.title && <h3 className="mb-4 font-display text-2xl font-black text-purple-800 dark:text-purple-100">{translateDefaultTitle(lang, block.title)}</h3>}
      {url ? <img src={url} alt={block.caption || block.title || 'Theory'} className={`mx-auto rounded-3xl object-contain shadow-lg ${block.size === 'small' ? 'max-h-52 max-w-sm' : 'max-h-96 max-w-2xl'}`} /> : <div className="mx-auto flex h-40 max-w-md items-center justify-center rounded-3xl border border-dashed border-purple-200 bg-white/70 text-purple-300 dark:border-purple-700 dark:bg-white/5"><ImageIcon className="h-10 w-10" /></div>}
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
      <div className="grid gap-3 sm:grid-cols-2">{block.items.map((item, index) => <ExampleCard key={item.id} item={item} index={index} lang={lang} />)}</div>
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
  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-[2rem] border border-pink-100 bg-gradient-to-br from-pink-50 via-purple-50 to-sky-50 px-5 py-8 text-center shadow-lg shadow-purple-100/40 dark:border-purple-400/15 dark:from-pink-500/10 dark:via-purple-500/10 dark:to-sky-500/10 dark:shadow-none">
        <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border border-white bg-white/80 px-4 py-2 font-display text-xs font-black uppercase text-pink-500 shadow-sm dark:border-purple-400/15 dark:bg-white/5 dark:text-pink-200"><BookOpen className="h-4 w-4" />{content?.eyebrow || 'VetoSchool Theory'}</div>
        <h2 className="theory-hero-title bg-gradient-to-r from-pink-500 via-purple-600 to-violet-500 bg-clip-text font-display text-3xl font-black leading-tight text-transparent sm:text-5xl">{title}</h2>
        {content?.subtitle && <p className="mx-auto mt-3 max-w-2xl font-body text-base font-extrabold leading-7 text-purple-500 dark:text-purple-200">{content.subtitle}</p>}
      </header>
      {blocks.length > 0 ? blocks.map(block => <BlockView key={block.id} block={block} lang={lang} />) : <div className="rounded-3xl border border-dashed border-purple-200 bg-purple-50/50 p-8 text-center font-body font-bold text-purple-400 dark:border-purple-700 dark:bg-white/5">{copy.materialSoon}</div>}
    </div>
  );
}
