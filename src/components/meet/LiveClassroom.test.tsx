import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const callState = vi.hoisted(() => ({
  participants: [], remoteStreams: {}, messages: [], status: 'connected', error: '', notice: '', observerOnly: false, role: 'student',
  camera: false, microphone: false, handRaised: false, sharingScreen: false, screenStream: null,
  diagnostics: [],
  setNotice: vi.fn(), toggleCamera: vi.fn(), toggleMicrophone: vi.fn(), toggleHand: vi.fn(), startScreenShare: vi.fn(), stopScreenShare: vi.fn(),
  sendMessage: vi.fn(), replaceDeviceTrack: vi.fn(), shutdown: vi.fn(),
}));
vi.mock('@/hooks/useMeetCall', () => ({ useMeetCall: () => callState }));
vi.mock('@/lib/conferences', () => ({ transitionConferenceRemote: vi.fn() }));
vi.mock('@/lib/meetMedia', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/meetMedia')>();
  return { ...original, controlMeetParticipant: vi.fn() };
});
import LiveClassroom from './LiveClassroom';

class TestStream {
  tracks: MediaStreamTrack[] = [];
  constructor(tracks: MediaStreamTrack[] = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio'); }
  addTrack(track: MediaStreamTrack) { this.tracks.push(track); }
  removeTrack(track: MediaStreamTrack) { this.tracks = this.tracks.filter(item => item !== track); }
}

const conference = { id:'c1', title:'English lesson', type:'group', teacherId:'t1', studentIds:['u1'], date:'2026-10-13', time:'16:00', duration:45, description:'', status:'active', code:'ROOM', version:2, startedAt:new Date().toISOString() } as const;
const user = { id:'u1', name:'Sophie Green', role:'student', email:'s@example.com', hasAccess:true, paymentStatus:'paid', accessStatus:'active', emailConfirmed:true, createdAt:'', joinedAt:'' } as const;

describe('LiveClassroom prejoin', () => {
  const getUserMedia = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('MediaStream', TestStream);
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable:true, value:vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(navigator, 'mediaDevices', { configurable:true, value:{ getUserMedia, getDisplayMedia:vi.fn(), enumerateDevices:vi.fn().mockResolvedValue([]), addEventListener:vi.fn(), removeEventListener:vi.fn() } });
    getUserMedia.mockReset();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('does not request camera or microphone before a user action', () => {
    render(<LiveClassroom conference={conference} user={user} onExit={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByRole('heading', { name:'English lesson' })).toBeInTheDocument();
    expect(screen.getByText('Готові до заняття?')).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('requests only the microphone after the microphone button is pressed', async () => {
    const track = { kind:'audio', enabled:true, readyState:'live', stop:vi.fn() } as unknown as MediaStreamTrack;
    getUserMedia.mockResolvedValue(new TestStream([track]));
    render(<LiveClassroom conference={conference} user={user} onExit={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name:/Мікрофон/ }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(getUserMedia.mock.calls[0][0]).toMatchObject({ video:false, audio:expect.any(Object) });
  });

  it('requests an ideal Full HD camera stream at 30 FPS', async () => {
    const track = { kind:'video', enabled:true, readyState:'live', stop:vi.fn(), contentHint:'' } as unknown as MediaStreamTrack;
    getUserMedia.mockResolvedValue(new TestStream([track]));
    render(<LiveClassroom conference={conference} user={user} onExit={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name:/Камера/ }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(getUserMedia.mock.calls[0][0]).toMatchObject({
      audio:false,
      video:{ width:{ ideal:1920 }, height:{ ideal:1080 }, frameRate:{ ideal:30, max:30 }, aspectRatio:{ ideal:16/9 } },
    });
    expect(track.contentHint).toBe('detail');
  });

  it('can enter presence mode without media', () => {
    render(<LiveClassroom conference={conference} user={user} onExit={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name:'Приєднатися' }));
    expect(screen.getByText('Очікуємо учасників')).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
