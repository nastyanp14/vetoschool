import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeetParticipant, MeetSignal } from '@/lib/meetMedia';

const realtime = vi.hoisted(() => ({
  signal: undefined as ((payload: { new: MeetSignal }) => void) | undefined,
  status: undefined as ((status: string) => void) | undefined,
  removeChannel: vi.fn(),
}));

const media = vi.hoisted(() => ({
  joinMeet: vi.fn(),
  heartbeatMeet: vi.fn(),
  getMeetRoster: vi.fn(),
  sendMeetSignal: vi.fn().mockResolvedValue(undefined),
  leaveMeet: vi.fn().mockResolvedValue(undefined),
}));

function subscribe(handler: (status: string) => void) {
  realtime.status = handler;
  return {};
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    realtime: { setAuth: vi.fn().mockResolvedValue(undefined) },
    channel: vi.fn(() => ({
      on: vi.fn((_event, _filter, handler) => { realtime.signal = handler; return { subscribe }; }),
    })),
    removeChannel: realtime.removeChannel,
  },
}));

vi.mock('@/lib/meetMedia', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/meetMedia')>();
  return { ...original, ...media, iceServers: () => [], tuneVideoSender: vi.fn().mockResolvedValue(undefined) };
});

import { useMeetCall } from './useMeetCall';

class TestPeerConnection {
  static instances: TestPeerConnection[] = [];
  close = vi.fn();
  addTrack = vi.fn((track: MediaStreamTrack) => ({ track, replaceTrack: vi.fn(), getParameters: vi.fn(() => ({})), setParameters: vi.fn() }));
  getSenders = vi.fn(() => []);
  restartIce = vi.fn();
  setLocalDescription = vi.fn();
  setRemoteDescription = vi.fn();
  addIceCandidate = vi.fn();
  localDescription = null;
  remoteDescription = null;
  connectionState = 'new';
  signalingState = 'stable';
  ontrack = null;
  onicecandidate = null;
  onnegotiationneeded = null;
  onconnectionstatechange = null;
  constructor() { TestPeerConnection.instances.push(this); }
}

const self = (overrides: Partial<MeetParticipant> = {}): MeetParticipant => ({
  userId: 'self', connectionId: 'self-connection', name: 'Self', role: 'student', observerOnly: false,
  camera: false, microphone: false, handRaised: false, sharingScreen: false, joinedAt: '2026-10-13T12:00:00Z', ...overrides,
});
const remote = (connectionId: string): MeetParticipant => ({
  userId: 'remote', connectionId, name: 'Remote', role: 'teacher', observerOnly: false,
  camera: false, microphone: false, handRaised: false, sharingScreen: false, joinedAt: '2026-10-13T12:00:00Z',
});
const stream = { getTracks: () => [], getAudioTracks: () => [], getVideoTracks: () => [] } as unknown as MediaStream;

async function subscribeToRoom() {
  await waitFor(() => expect(realtime.status).toBeTypeOf('function'));
  await act(async () => { await realtime.status?.('SUBSCRIBED'); });
}

describe('useMeetCall peer lifecycle', () => {
  beforeEach(() => {
    vi.stubGlobal('RTCPeerConnection', TestPeerConnection);
    TestPeerConnection.instances = [];
    realtime.signal = undefined;
    realtime.status = undefined;
    vi.clearAllMocks();
    media.heartbeatMeet.mockResolvedValue([]);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('keeps an admin observer out of the media mesh', async () => {
    media.joinMeet.mockResolvedValue({ role: 'admin', observerOnly: true, participants: [self({ role: 'admin', observerOnly: true }), remote('remote-1')] });
    const { result, unmount } = renderHook(() => useMeetCall({ conferenceId: 'room', userId: 'self', connectionId: 'self-connection', stream, enabled: true }));
    await subscribeToRoom();
    await waitFor(() => expect(result.current.observerOnly).toBe(true));
    expect(TestPeerConnection.instances).toHaveLength(0);
    unmount();
  });

  it('replaces a stale peer when the same participant reconnects with a new connection id', async () => {
    media.joinMeet.mockResolvedValue({ role: 'student', observerOnly: false, participants: [self(), remote('remote-1')] });
    media.getMeetRoster.mockResolvedValue([self(), remote('remote-2')]);
    const { unmount } = renderHook(() => useMeetCall({ conferenceId: 'room', userId: 'self', connectionId: 'self-connection', stream, enabled: true }));
    await subscribeToRoom();
    await waitFor(() => expect(TestPeerConnection.instances).toHaveLength(1));
    const first = TestPeerConnection.instances[0];
    await act(async () => {
      realtime.signal?.({ new: {
        id: 1, conference_id: 'room', sender_user_id: 'self', sender_connection_id: 'self-connection',
        target_user_id: null, event_type: 'roster', payload: {}, created_at: '2026-10-13T12:00:01Z',
      } });
    });
    await waitFor(() => expect(TestPeerConnection.instances).toHaveLength(2));
    expect(media.getMeetRoster).toHaveBeenCalledWith('room', 'self-connection');
    expect(first.close).toHaveBeenCalledOnce();
    unmount();
  });

  it('stops screen sharing explicitly and restores the camera when stop does not emit ended', async () => {
    const cameraTrack = { kind: 'video', enabled: true, readyState: 'live', stop: vi.fn() } as unknown as MediaStreamTrack;
    const screenTrack = { kind: 'video', enabled: true, readyState: 'live', stop: vi.fn(), onended: null } as unknown as MediaStreamTrack;
    const cameraStream = { getTracks: () => [cameraTrack], getAudioTracks: () => [], getVideoTracks: () => [cameraTrack] } as unknown as MediaStream;
    const screenStream = { getTracks: () => [screenTrack], getAudioTracks: () => [], getVideoTracks: () => [screenTrack] } as unknown as MediaStream;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: vi.fn().mockResolvedValue(screenStream) } });
    const roster = [self({ camera: true }), remote('remote-1')];
    media.joinMeet.mockResolvedValue({ role: 'student', observerOnly: false, participants: roster });
    media.heartbeatMeet.mockResolvedValue(roster);

    const { result, unmount } = renderHook(() => useMeetCall({ conferenceId: 'room', userId: 'self', connectionId: 'self-connection', stream: cameraStream, enabled: true }));
    await subscribeToRoom();
    await waitFor(() => expect(TestPeerConnection.instances).toHaveLength(1));
    const videoSender = TestPeerConnection.instances[0].addTrack.mock.results[0].value;

    await act(async () => { await result.current.startScreenShare(); });
    expect(result.current.sharingScreen).toBe(true);
    expect(videoSender.replaceTrack).toHaveBeenCalledWith(screenTrack);

    await act(async () => { await result.current.stopScreenShare(); });
    expect(screenTrack.stop).toHaveBeenCalledOnce();
    expect(result.current.sharingScreen).toBe(false);
    expect(result.current.screenStream).toBeNull();
    expect(videoSender.replaceTrack).toHaveBeenLastCalledWith(cameraTrack);
    expect(media.heartbeatMeet).toHaveBeenCalledWith('room', 'self-connection', expect.objectContaining({ sharingScreen: false }));
    unmount();
  });
});
