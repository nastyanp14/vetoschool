import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ListeningAudioPlayer from './ListeningAudioPlayer';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function setup() {
  const { container } = render(<ListeningAudioPlayer src="/test.wav" title="Listening" lang="ru" />);
  return container.querySelector('audio')!;
}

describe('listening audio controls', () => {
  it('seeks the recording and reflects time updates without enabling an unloaded recording', () => {
    const audio = setup();
    const seek = screen.getByRole('slider');
    expect(seek).toBeDisabled();
    Object.defineProperty(audio, 'duration', { configurable: true, value: 90 });
    fireEvent.loadedMetadata(audio);
    expect(seek).toBeEnabled();
    fireEvent.change(seek, { target: { value: '35' } });
    expect(audio.currentTime).toBe(35);
    audio.currentTime = 42;
    fireEvent.timeUpdate(audio);
    expect(seek).toHaveValue('42');
    expect(seek).toHaveAttribute('aria-valuetext', '0:42 / 1:30');
  });

  it('changes actual playback speed and toggles mute in both directions', () => {
    const audio = setup();
    for (const value of [1.25, 1.5, 0.75, 1]) {
      fireEvent.click(screen.getByRole('button', { name: /Скорость воспроизведения/ }));
      expect(audio.playbackRate).toBe(value);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Выключить звук' }));
    expect(audio.muted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Включить звук' }));
    expect(audio.muted).toBe(false);
  });

  it('offers retry after playback fails and clears the error after a successful retry', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(undefined);
    const reload = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    const audio = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Воспроизвести' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить аудио');
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    expect(reload).toHaveBeenCalledOnce();
    fireEvent.playing(audio);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Пауза' })).toBeInTheDocument();
    fireEvent.ended(audio);
    expect(screen.getByRole('button', { name: 'Воспроизвести' })).toBeInTheDocument();
  });
});
