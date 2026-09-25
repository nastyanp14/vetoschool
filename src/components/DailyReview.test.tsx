import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DailyReview from './DailyReview';
import type { DictWord } from '../lib/dictionary';

vi.mock('../lib/dictionaryAudio', () => ({
  playDictionaryWordAudio: vi.fn(async (_word, setPlaying?: (playing: boolean) => void) => {
    setPlaying?.(true);
    setPlaying?.(false);
  }),
  stopDictionaryAudio: vi.fn(),
}));

const words: DictWord[] = [
  { id: 'apple', userId: 'daily-review-test', lesson: 'Food', category: 'Food', word: 'Apple', translation: 'яблоко', emoji: '🍎', audioUrl: '/preview/audio/apple.wav' },
  { id: 'banana', userId: 'daily-review-test', lesson: 'Food', category: 'Food', word: 'Banana', translation: 'банан', emoji: '🍌', audioUrl: '/preview/audio/banana.wav' },
];

class MockMediaRecorder {
  static isTypeSupported() { return true; }
  state: RecordingState = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;

  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) } as BlobEvent);
    this.onstop?.();
  }
}

let recognizedTranscript = 'banana';

class MockSpeechRecognition {
  lang = '';
  interimResults = false;
  continuous = false;
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;

  start() {
    window.setTimeout(() => this.onresult?.({ results: [{ 0: { transcript: recognizedTranscript } }] }), 0);
  }
  stop() { this.onend?.(); }
}

class MockAudio {
  onended: (() => void) | null = null;
  pause = vi.fn();
  play = vi.fn(async () => undefined);
}

describe('DailyReview speaking card', () => {
  beforeEach(() => {
    recognizedTranscript = 'banana';
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() { return storage.size; },
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, String(value)),
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
    });
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition);
    vi.stubGlobal('Audio', MockAudio);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:voice-attempt') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('records the pronunciation and exposes local playback without star rewards', async () => {
    const { container } = render(<DailyReview
      userId="daily-review-test"
      lang="ru"
      words={words}
      learnedIds={new Set(words.map(word => word.id))}
      preview
      onClose={() => undefined}
    />);

    await screen.findByTestId('daily-review-screen');
    expect(screen.getByRole('heading', { name: 'Ежедневное повторение' })).not.toHaveTextContent('✨');
    expect(container.querySelector('img[src*="rating-user-star"]')).not.toBeInTheDocument();
    expect(screen.queryByText('Я слушаю тебя')).not.toBeInTheDocument();
    expect(screen.queryByText('Послушай слово')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Choose next card' }));
    await waitFor(() => expect(screen.getByTestId('daily-review-card-0')).toHaveAttribute('data-card-word', 'Banana'), { timeout: 1800 });

    const activeCard = screen.getByTestId('daily-review-card-0');
    fireEvent.click(within(activeCard).getByRole('button', { name: 'Нажми и скажи' }));

    const recordingButton = await within(activeCard).findByRole('button', { name: 'Прослушать запись' });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(within(activeCard).getByRole('status')).toHaveTextContent('Отлично!');
    expect(within(activeCard).getByRole('status')).not.toHaveTextContent('✨');

    fireEvent.click(recordingButton);
    await waitFor(() => expect(within(activeCard).getByTestId('recorded-audio-wave')).toHaveAttribute('data-playing', 'true'));
    expect(within(activeCard).getByRole('button', { name: 'Пауза' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('replaces word building with a silent picture-choice card', async () => {
    const pictureWords: DictWord[] = [
      ...words,
      { id: 'book', userId: 'daily-review-test', lesson: 'School', category: 'School', word: 'Book', translation: 'книга', emoji: '📚' },
    ];
    render(<DailyReview
      userId="daily-review-test"
      lang="ru"
      words={pictureWords}
      learnedIds={new Set(pictureWords.map(word => word.id))}
      preview
      onClose={() => undefined}
    />);

    await screen.findByTestId('daily-review-screen');
    const nextButton = screen.getByRole('button', { name: 'Choose next card' });
    fireEvent.click(nextButton);
    await waitFor(() => expect(screen.getByTestId('daily-review-card-0')).toHaveAttribute('data-card-word', 'Banana'), { timeout: 1800 });
    await waitFor(() => expect(nextButton).not.toBeDisabled());
    fireEvent.click(nextButton);
    await waitFor(() => expect(screen.getByTestId('daily-review-card-0')).toHaveAttribute('data-card-word', 'Book'), { timeout: 1800 });

    const activeCard = screen.getByTestId('daily-review-card-0');
    expect(within(activeCard).getByTestId('daily-review-picture-choice')).toBeInTheDocument();
    expect(within(activeCard).getByText('Выбери по картинке')).toBeInTheDocument();
    expect(within(activeCard).getByText('Что изображено на картинке?')).toBeInTheDocument();
    expect(within(activeCard).getByText('📚')).toBeInTheDocument();
    expect(within(activeCard).queryByRole('button', { name: /Послушать/i })).not.toBeInTheDocument();

    expect(within(activeCard).getByRole('button', { name: 'Book' })).toBeInTheDocument();
    expect(within(activeCard).queryByRole('button', { name: 'книга' })).not.toBeInTheDocument();
    fireEvent.click(within(activeCard).getByRole('button', { name: 'Book' }));
    await waitFor(() => expect(within(activeCard).getByRole('status')).toHaveTextContent('Отлично!'));
  });

  it('accepts Schoolbag when speech recognition returns school bag', async () => {
    recognizedTranscript = 'school bag';
    const schoolbagWords: DictWord[] = [
      words[0],
      { id: 'schoolbag', userId: 'daily-review-test', lesson: 'School', category: 'School', word: 'Schoolbag', translation: 'школьный рюкзак', emoji: '🎒' },
    ];
    render(<DailyReview
      userId="daily-review-test"
      lang="ru"
      words={schoolbagWords}
      learnedIds={new Set(schoolbagWords.map(word => word.id))}
      preview
      onClose={() => undefined}
    />);

    await screen.findByTestId('daily-review-screen');
    fireEvent.click(screen.getByRole('button', { name: 'Choose next card' }));
    await waitFor(() => expect(screen.getByTestId('daily-review-card-0')).toHaveAttribute('data-card-word', 'Schoolbag'), { timeout: 1800 });

    const activeCard = screen.getByTestId('daily-review-card-0');
    fireEvent.click(within(activeCard).getByRole('button', { name: 'Нажми и скажи' }));
    await waitFor(() => expect(within(activeCard).getByRole('status')).toHaveTextContent('Отлично!'));
  });
});
