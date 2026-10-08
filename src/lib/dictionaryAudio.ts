import type { DictWord } from './dictionary';
import { signedLessonAudioUrl } from './cardAudio';

let stopActiveWordAudio: (() => void) | null = null;

export function stopDictionaryAudio() {
  stopActiveWordAudio?.();
  stopActiveWordAudio = null;
}

export async function playDictionaryWordAudio(word: DictWord, setPlaying: (playing: boolean) => void) {
  stopDictionaryAudio();
  let audio: HTMLAudioElement | null = null;
  let speech: SpeechSynthesisUtterance | null = null;
  let active = true;
  const finish = () => {
    if (!active) return;
    active = false;
    setPlaying(false);
    if (stopActiveWordAudio === stop) stopActiveWordAudio = null;
  };
  const stop = () => {
    if (!active) return;
    active = false;
    audio?.pause();
    if (speech && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setPlaying(false);
  };
  stopActiveWordAudio = stop;
  setPlaying(true);
  if (word.audioUrl) {
    try {
      const url = /^(?:https?:|data:|blob:|\/)/i.test(word.audioUrl)
        ? word.audioUrl
        : await signedLessonAudioUrl(word.audioUrl);
      if (url) {
        audio = new Audio(url);
        audio.volume = 0.95;
        audio.onended = finish;
        audio.onerror = finish;
        await audio.play();
        return;
      }
    } catch {
      audio = null;
    }
  }
  try {
    if ('speechSynthesis' in window && word.word) {
      window.speechSynthesis.cancel();
      speech = new SpeechSynthesisUtterance(word.word);
      speech.lang = 'en-US';
      speech.rate = 0.82;
      speech.pitch = 1.08;
      const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLocaleLowerCase().startsWith('en'));
      if (voice) speech.voice = voice;
      speech.onend = finish;
      speech.onerror = finish;
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(speech);
      return;
    }
  } catch {
    // Audio is an enhancement; the exercise remains usable without it.
  }
  finish();
}
