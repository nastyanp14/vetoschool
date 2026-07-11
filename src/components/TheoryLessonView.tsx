import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, Download, Headphones, Image as ImageIcon, Languages, Lightbulb, Loader2, MessageSquareQuote, Pause, Play, Sparkles, Volume2 } from 'lucide-react';
import { signedUrlFor } from '../lib/workbooks';
import type { TheoryBlock, TheoryContent, TheoryExampleItem, TheoryImageBlock, TheoryTextBlock, TheoryVocabularyItem } from '../lib/theory';
import { toast } from 'sonner';
import { signedLessonAudioUrl } from '../lib/cardAudio';

const formatAudioTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};

function PremiumAudioPlayer({ url, title }: { url: string; title: string }) {
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
      toast.error('Не удалось воспроизвести аудиозапись');
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
      toast.error('Аудиозапись недоступна для скачивания');
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
        <button type="button" onClick={togglePlayback} aria-label={playing ? 'Пауза' : 'Воспроизвести'} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-md transition hover:scale-105 hover:brightness-105">
          {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3 font-body text-xs font-black text-purple-500 dark:text-purple-200">
            <span>{playing ? 'Слушаем вместе' : 'Готово к прослушиванию'}</span>
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
            aria-label="Позиция аудиозаписи"
            className="h-2 w-full cursor-pointer accent-pink-500"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-purple-50 pt-4 dark:border-purple-400/10">
        <div className="flex min-w-[150px] flex-1 items-center gap-2 text-purple-400 dark:text-purple-200">
          <Volume2 className="h-4 w-4 shrink-0" />
          <input type="range" min="0" max="1" step="0.05" value={volume} onChange={event => { const value = Number(event.target.value); setVolume(value); if (audioRef.current) audioRef.current.volume = value; }} aria-label="Громкость" className="h-1.5 max-w-32 flex-1 cursor-pointer accent-purple-500" />
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-purple-50 p-1 dark:bg-white/5" aria-label="Скорость воспроизведения">
          {[0.75, 1, 1.25, 1.5].map(value => <button key={value} type="button" onClick={() => changeSpeed(value)} className={`rounded-lg px-2.5 py-1.5 font-body text-xs font-black transition ${speed === value ? 'bg-white text-purple-700 shadow-sm dark:bg-purple-500/25 dark:text-purple-100' : 'text-purple-400 hover:text-purple-600 dark:text-purple-300'}`}>{value}x</button>)}
        </div>
        <button type="button" onClick={download} disabled={downloading} className="inline-flex items-center gap-2 rounded-xl border border-purple-100 bg-white px-3 py-2 font-body text-xs font-black text-purple-600 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500 disabled:opacity-50 dark:border-purple-400/20 dark:bg-white/5 dark:text-purple-100 dark:hover:bg-pink-500/10">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Скачать
        </button>
      </div>
    </div>
  );
}

function TheoryAudio({ block }: { block: Extract<TheoryBlock, { type: 'audio' }> }) {
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
          <h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{block.title || 'Послушай и повтори'}</h3>
          {block.description && <p className="mt-1 font-body text-sm font-bold leading-6 text-purple-500 dark:text-purple-200">{block.description}</p>}
        </div>
      </div>
      {url ? <PremiumAudioPlayer url={url} title={block.title} /> : <div className="mt-4 rounded-2xl border border-dashed border-purple-200 bg-white/60 px-4 py-3 text-center text-sm font-bold text-purple-400 dark:border-purple-700 dark:bg-white/5">Аудиозапись скоро появится.</div>}
    </section>
  );
}

let activeVocabularyAudio: HTMLAudioElement | null = null;

function usePronunciation(generatedAudioPath?: string, uploadedAudioPath?: string) {
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
      toast.info('Для этой карточки аудио ещё не добавлено');
      return;
    }
    setSpeaking(true);
    const audio = new Audio(audioUrl);
    activeVocabularyAudio = audio;
    audio.onended = () => setSpeaking(false);
    audio.onpause = () => setSpeaking(false);
    audio.onerror = () => {
      setSpeaking(false);
      toast.error('Не удалось воспроизвести произношение');
    };
    try { await audio.play(); } catch { setSpeaking(false); toast.error('Не удалось воспроизвести произношение'); }
  };

  return { speaking, pronounce };
}

function VocabularyCard({ item }: { item: TheoryVocabularyItem }) {
  const { speaking, pronounce } = usePronunciation(item.audio_url, item.audio);

  return (
    <button type="button" onClick={() => pronounce(item.word)} aria-label={`Прослушать произношение слова ${item.word}`} className="group relative rounded-3xl border border-white bg-white/90 p-4 text-center shadow-md shadow-purple-100/40 transition duration-300 hover:-translate-y-1 hover:border-pink-200 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-pink-100 dark:border-purple-400/15 dark:bg-white/5 dark:shadow-none dark:hover:border-pink-400/30 dark:focus:ring-pink-400/10">
      <span className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl transition ${speaking ? 'bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-md' : 'bg-purple-50 text-purple-400 group-hover:bg-pink-50 group-hover:text-pink-500 dark:bg-white/10 dark:text-purple-200'}`}><Volume2 className={`h-4 w-4 ${speaking ? 'animate-pulse' : ''}`} /></span>
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-pink-50 to-purple-50 text-5xl transition group-hover:scale-105 dark:from-pink-500/10 dark:to-purple-500/10">{item.emoji || '✨'}</div>
      <h4 className="mt-3 font-display text-xl font-black text-purple-800 dark:text-purple-100">{item.word || 'Word'}</h4>
      {item.transcription && <div className="mt-1 font-body text-sm font-bold text-pink-400">{item.transcription}</div>}
      <div className="mt-2 font-body text-sm font-extrabold text-purple-500 dark:text-purple-200">{item.translation}</div>
      <div className="mt-3 font-body text-[11px] font-black uppercase text-purple-300 transition group-hover:text-pink-400 dark:text-purple-400">Нажми, чтобы услышать</div>
    </button>
  );
}

function ExampleCard({ item, index }: { item: TheoryExampleItem; index: number }) {
  const { speaking, pronounce } = usePronunciation(item.audio_url, item.audio);
  return (
    <button type="button" onClick={() => pronounce(item.sentence)} aria-label={`Прослушать предложение ${item.sentence}`} className="group relative rounded-3xl border border-white bg-white/90 p-4 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-pink-100 dark:border-purple-400/15 dark:bg-white/5 dark:focus:ring-pink-400/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 to-purple-100 font-display text-xs font-black text-purple-600 dark:from-pink-500/20 dark:to-purple-500/20 dark:text-purple-100">{index + 1}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${speaking ? 'bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-md' : 'bg-purple-50 text-purple-400 group-hover:bg-pink-50 group-hover:text-pink-500 dark:bg-white/10 dark:text-purple-200'}`}><Volume2 className={`h-4 w-4 ${speaking ? 'animate-pulse' : ''}`} /></span>
      </div>
      <div className="font-display text-lg font-black text-purple-800 dark:text-purple-100">{item.sentence || 'Example sentence'}</div>
      {item.translation && <div className="mt-2 font-body text-sm font-extrabold text-purple-500 dark:text-purple-200">{item.translation}</div>}
      {item.note && <div className="mt-3 rounded-xl bg-purple-50 px-3 py-2 font-body text-xs font-bold text-purple-400 dark:bg-white/5 dark:text-purple-300">{item.note}</div>}
      <div className="mt-3 font-body text-[11px] font-black uppercase text-purple-300 transition group-hover:text-pink-400 dark:text-purple-400">Нажми, чтобы услышать</div>
    </button>
  );
}

function TheoryImage({ block }: { block: TheoryImageBlock }) {
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
      {block.title && <h3 className="mb-4 font-display text-2xl font-black text-purple-800 dark:text-purple-100">{block.title}</h3>}
      {url ? <img src={url} alt={block.caption || block.title || 'Theory'} className={`mx-auto rounded-3xl object-contain shadow-lg ${block.size === 'small' ? 'max-h-52 max-w-sm' : 'max-h-96 max-w-2xl'}`} /> : <div className="mx-auto flex h-40 max-w-md items-center justify-center rounded-3xl border border-dashed border-purple-200 bg-white/70 text-purple-300 dark:border-purple-700 dark:bg-white/5"><ImageIcon className="h-10 w-10" /></div>}
      {block.caption && <p className="mx-auto mt-4 max-w-2xl text-center font-body text-sm font-bold leading-6 text-purple-500 dark:text-purple-200">{block.caption}</p>}
    </section>
  );
}

function TextBlock({ block }: { block: TheoryTextBlock }) {
  const lines = block.body.split('\n').map(line => line.trim()).filter(Boolean);
  if (block.style === 'rule') return (
    <section className="rounded-[1.75rem] border border-pink-100 bg-gradient-to-r from-pink-50 via-purple-50 to-sky-50 p-5 shadow-sm dark:border-pink-400/15 dark:from-pink-500/10 dark:via-purple-500/10 dark:to-sky-500/10">
      <div className="flex gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-pink-500 shadow-sm dark:bg-white/10"><Sparkles className="h-5 w-5" /></span><div>{block.title && <h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{block.title}</h3>}<p className="mt-2 whitespace-pre-line font-body text-base font-bold leading-8 text-purple-600 dark:text-purple-200">{block.body}</p></div></div>
    </section>
  );
  return (
    <section className="rounded-[1.75rem] border border-purple-100 bg-white/85 p-5 shadow-sm dark:border-purple-400/15 dark:bg-white/5">
      {block.title && <h3 className="mb-3 font-display text-2xl font-black text-purple-800 dark:text-purple-100">{block.title}</h3>}
      {block.style === 'paragraph' ? <p className="whitespace-pre-line font-body text-base font-bold leading-8 text-purple-600 dark:text-purple-200">{block.body}</p> : block.style === 'numbered' ? <ol className="space-y-3">{lines.map((line, index) => <li key={index} className="flex gap-3 font-body text-base font-bold leading-7 text-purple-600 dark:text-purple-200"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 to-purple-100 text-xs font-black text-purple-600 dark:from-pink-500/20 dark:to-purple-500/20 dark:text-purple-100">{index + 1}</span><span>{line}</span></li>)}</ol> : <ul className="space-y-3">{lines.map((line, index) => <li key={index} className="flex gap-3 font-body text-base font-bold leading-7 text-purple-600 dark:text-purple-200"><Check className="mt-1 h-5 w-5 shrink-0 text-pink-400" /><span>{line}</span></li>)}</ul>}
    </section>
  );
}

function BlockView({ block }: { block: TheoryBlock }) {
  if (block.type === 'text') return <TextBlock block={block} />;
  if (block.type === 'image') return <TheoryImage block={block} />;
  if (block.type === 'audio') return <TheoryAudio block={block} />;
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
            <h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{block.title || 'Запомни правило'}</h3>
            <p className="mt-2 whitespace-pre-line font-body text-base font-bold leading-8 text-purple-600 dark:text-purple-200">{block.body}</p>
            {block.formula && <div className="mt-4 rounded-2xl border border-white bg-white/80 px-4 py-3 text-center font-display text-base font-black text-purple-700 shadow-sm dark:border-purple-400/15 dark:bg-white/5 dark:text-purple-100">{block.formula}</div>}
          </div>
        </div>
      </section>
    );
  }
  if (block.type === 'examples') return (
    <section className="rounded-[1.75rem] border border-violet-100 bg-gradient-to-br from-violet-50/70 via-white to-pink-50/50 p-5 dark:border-violet-400/15 dark:from-violet-500/10 dark:via-white/5 dark:to-pink-500/10">
      <div className="mb-5 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-violet-500 shadow-sm dark:bg-white/10"><MessageSquareQuote className="h-5 w-5" /></span><h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{block.title || 'Примеры'}</h3></div>
      <div className="grid gap-3 sm:grid-cols-2">{block.items.map((item, index) => <ExampleCard key={item.id} item={item} index={index} />)}</div>
    </section>
  );
  if (block.type === 'vocabulary') return (
    <section className="rounded-[1.75rem] border border-pink-100 bg-gradient-to-br from-pink-50/60 via-white to-purple-50/50 p-5 dark:border-pink-400/15 dark:from-pink-500/10 dark:via-white/5 dark:to-purple-500/10">
      <div className="mb-5 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-pink-500 shadow-sm dark:bg-white/10"><Languages className="h-5 w-5" /></span><h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{block.title || 'Новые слова'}</h3></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{block.items.map(item => <VocabularyCard key={item.id} item={item} />)}</div>
    </section>
  );
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-purple-100 bg-white shadow-sm dark:border-purple-400/15 dark:bg-white/5">
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 px-5 py-4 dark:from-pink-500/10 dark:to-purple-500/10"><h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{block.title || 'Грамматическое правило'}</h3></div>
      <div className="overflow-x-auto"><table className="min-w-[620px] w-full border-collapse"><thead><tr>{block.columns.map((column, index) => <th key={index} className="border-b border-r border-purple-100 bg-purple-50/60 px-4 py-3 text-left font-display text-sm font-black text-purple-700 last:border-r-0 dark:border-purple-400/15 dark:bg-white/5 dark:text-purple-100">{column}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="transition hover:bg-pink-50/40 dark:hover:bg-white/5">{block.columns.map((_, cellIndex) => <td key={cellIndex} className="border-b border-r border-purple-50 px-4 py-3 font-body text-sm font-bold leading-6 text-purple-600 last:border-r-0 dark:border-purple-400/10 dark:text-purple-200">{row[cellIndex]}</td>)}</tr>)}</tbody></table></div>
    </section>
  );
}

export default function TheoryLessonView({ content, fallbackTitle }: { content?: Partial<TheoryContent>; fallbackTitle: string }) {
  const title = content?.title || fallbackTitle;
  const blocks = content?.blocks || [];
  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-[2rem] border border-pink-100 bg-gradient-to-br from-pink-50 via-purple-50 to-sky-50 px-5 py-8 text-center shadow-lg shadow-purple-100/40 dark:border-purple-400/15 dark:from-pink-500/10 dark:via-purple-500/10 dark:to-sky-500/10 dark:shadow-none">
        <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border border-white bg-white/80 px-4 py-2 font-display text-xs font-black uppercase text-pink-500 shadow-sm dark:border-purple-400/15 dark:bg-white/5 dark:text-pink-200"><BookOpen className="h-4 w-4" />{content?.eyebrow || 'VetoSchool Theory'}</div>
        <h2 className="bg-gradient-to-r from-pink-500 via-purple-600 to-violet-500 bg-clip-text font-display text-3xl font-black leading-tight text-transparent sm:text-5xl">{title}</h2>
        {content?.subtitle && <p className="mx-auto mt-3 max-w-2xl font-body text-base font-extrabold leading-7 text-purple-500 dark:text-purple-200">{content.subtitle}</p>}
      </header>
      {blocks.length > 0 ? blocks.map(block => <BlockView key={block.id} block={block} />) : <div className="rounded-3xl border border-dashed border-purple-200 bg-purple-50/50 p-8 text-center font-body font-bold text-purple-400 dark:border-purple-700 dark:bg-white/5">Материал урока скоро появится.</div>}
    </div>
  );
}
