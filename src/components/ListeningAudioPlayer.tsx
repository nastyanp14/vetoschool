import { useRef, useState, type CSSProperties } from 'react';
import { Loader2, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { Lang } from '../lib/i18n';
import './ListeningAudioPlayer.css';

const labels = {
  ru: { play: 'Воспроизвести', pause: 'Пауза', seek: 'Позиция аудиозаписи', mute: 'Выключить звук', unmute: 'Включить звук', speed: 'Скорость воспроизведения', error: 'Не удалось загрузить аудио', retry: 'Попробовать снова' },
  en: { play: 'Play', pause: 'Pause', seek: 'Audio position', mute: 'Mute', unmute: 'Unmute', speed: 'Playback speed', error: 'Unable to load audio', retry: 'Try again' },
  ua: { play: 'Відтворити', pause: 'Пауза', seek: 'Позиція аудіозапису', mute: 'Вимкнути звук', unmute: 'Увімкнути звук', speed: 'Швидкість відтворення', error: 'Не вдалося завантажити аудіо', retry: 'Спробувати ще раз' },
};
const speeds = [1, 1.25, 1.5, 0.75];
const timestamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** A single-row player that fits the existing listening material slot. */
export default function ListeningAudioPlayer({ src, title, lang, className = '' }: {
  src: string; title: string; lang: Lang; className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const copy = labels[lang];
  const progress = duration ? Math.min(100, (position / duration) * 100) : 0;

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    if (failed) audio.load();
    audio.playbackRate = speed;
    audio.muted = muted;
    setFailed(false);
    setWaiting(true);
    try { await audio.play(); }
    catch { setFailed(true); setWaiting(false); setPlaying(false); }
  };
  const updateDuration = (audio: HTMLAudioElement) => {
    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
  };

  return (
    <div className={`listening-audio ${playing ? 'listening-audio--playing' : ''} ${className}`} role="group" aria-label={title}>
      <audio ref={audioRef} src={src} preload="metadata" aria-label={title}
        onLoadedMetadata={event => updateDuration(event.currentTarget)}
        onDurationChange={event => updateDuration(event.currentTarget)}
        onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPlaying={() => { setPlaying(true); setWaiting(false); }}
        onPause={() => { setPlaying(false); setWaiting(false); }}
        onEnded={() => { setPlaying(false); setWaiting(false); }}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => setWaiting(false)}
        onError={() => { setFailed(true); setPlaying(false); setWaiting(false); }}
      />
      <button type="button" className="listening-audio__play" onClick={togglePlay}
        aria-label={failed ? copy.retry : playing ? copy.pause : copy.play} title={failed ? copy.retry : playing ? copy.pause : copy.play}>
        {failed ? <RotateCcw /> : waiting ? <Loader2 className="listening-audio__spinner" /> : playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
      </button>
      {failed ? <span className="listening-audio__error" role="alert">{copy.error}</span> : <>
        <div className="listening-audio__seek">
          <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(position, duration)}
            disabled={!duration} aria-label={copy.seek} aria-valuetext={`${timestamp(position)} / ${timestamp(duration)}`}
            style={{ '--audio-progress': `${progress}%` } as CSSProperties}
            onChange={event => {
              const value = Number(event.target.value);
              if (audioRef.current) audioRef.current.currentTime = value;
              setPosition(value);
            }} />
        </div>
        <span className="listening-audio__time">{timestamp(position)}<span> / {timestamp(duration)}</span></span>
      </>}
      <button type="button" className="listening-audio__speed" aria-label={`${copy.speed}: ${speed}x`} title={copy.speed}
        onClick={() => {
          const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
          if (audioRef.current) audioRef.current.playbackRate = next;
          setSpeed(next);
        }}>{speed}×</button>
      <button type="button" className="listening-audio__mute" aria-label={muted ? copy.unmute : copy.mute} aria-pressed={muted} title={muted ? copy.unmute : copy.mute}
        onClick={() => {
          if (audioRef.current) audioRef.current.muted = !muted;
          setMuted(!muted);
        }}>{muted ? <VolumeX /> : <Volume2 />}</button>
    </div>
  );
}
