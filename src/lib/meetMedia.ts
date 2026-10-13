import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type MeetRole = 'teacher' | 'student' | 'admin';
export type MeetParticipant = {
  userId: string;
  connectionId: string;
  name: string;
  role: MeetRole;
  observerOnly: boolean;
  camera: boolean;
  microphone: boolean;
  handRaised: boolean;
  sharingScreen: boolean;
  joinedAt: string;
};
export type MeetJoinResult = { role: MeetRole; observerOnly: boolean; participants: MeetParticipant[] };
export type MeetSignalKind = 'offer' | 'answer' | 'ice' | 'chat' | 'control' | 'roster';
export type MeetSignal = {
  id: number;
  conference_id: string;
  sender_user_id: string;
  sender_connection_id: string;
  target_user_id: string | null;
  event_type: MeetSignalKind;
  payload: Record<string, unknown>;
  created_at: string;
};

export type MeetQualityLevel = 'full-hd' | 'hd' | 'balanced' | 'data-saver';

export type MeetPeerDiagnostic = {
  userId: string;
  name: string;
  connectionState: RTCPeerConnectionState;
  quality: MeetQualityLevel;
  outboundWidth: number;
  outboundHeight: number;
  outboundFps: number;
  outboundKbps: number;
  inboundWidth: number;
  inboundHeight: number;
  inboundFps: number;
  inboundKbps: number;
  packetLoss: number;
  rttMs: number;
  availableOutgoingKbps: number;
  codec: string;
  qualityLimitation: string;
};

export const CAMERA_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30, max: 30 },
  aspectRatio: { ideal: 16 / 9 },
  facingMode: 'user',
};

export const SCREEN_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30, max: 30 },
};

const QUALITY_PROFILES: Record<MeetQualityLevel, { height: number; fps: number; bitrate: number }> = {
  'full-hd': { height: 1080, fps: 30, bitrate: 3_500_000 },
  hd: { height: 720, fps: 30, bitrate: 2_000_000 },
  balanced: { height: 540, fps: 24, bitrate: 1_050_000 },
  'data-saver': { height: 360, fps: 18, bitrate: 500_000 },
};

export function meetQualityProfile(level: MeetQualityLevel) {
  return QUALITY_PROFILES[level];
}

export function cameraVideoConstraints(videoDeviceId?: string): MediaTrackConstraints {
  return {
    ...CAMERA_VIDEO_CONSTRAINTS,
    ...(videoDeviceId ? { deviceId: { exact: videoDeviceId }, facingMode: undefined } : {}),
  };
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw error;
}

export async function joinMeet(conferenceId: string, connectionId: string, camera: boolean, microphone: boolean) {
  const { data, error } = await supabase.rpc('meet_join', {
    _id: conferenceId, _connection_id: connectionId, _camera: camera, _microphone: microphone,
  });
  throwIfError(error);
  return data as unknown as MeetJoinResult;
}

export async function heartbeatMeet(conferenceId: string, connectionId: string, state: Pick<MeetParticipant, 'camera' | 'microphone' | 'handRaised' | 'sharingScreen'>) {
  const { data, error } = await supabase.rpc('meet_heartbeat', {
    _id: conferenceId, _connection_id: connectionId, _camera: state.camera,
    _microphone: state.microphone, _hand: state.handRaised, _sharing: state.sharingScreen,
  });
  throwIfError(error);
  return data as unknown as MeetParticipant[];
}

export async function getMeetRoster(conferenceId: string, connectionId: string) {
  const { data, error } = await supabase.rpc('meet_roster', { _id: conferenceId, _connection_id: connectionId });
  throwIfError(error);
  return data as unknown as MeetParticipant[];
}

export async function sendMeetSignal(conferenceId: string, connectionId: string, target: string | null, event: Exclude<MeetSignalKind, 'control' | 'roster'>, payload: Record<string, unknown>) {
  const { error } = await supabase.rpc('meet_signal', {
    _id: conferenceId, _connection_id: connectionId, _target: target, _event: event, _payload: payload as Json,
  });
  throwIfError(error);
}

export async function controlMeetParticipant(conferenceId: string, connectionId: string, target: string, action: 'mute' | 'request_unmute' | 'kick') {
  const { error } = await supabase.rpc('meet_control', {
    _id: conferenceId, _connection_id: connectionId, _target: target, _action: action,
  });
  throwIfError(error);
}

export async function leaveMeet(conferenceId: string, connectionId: string) {
  const { error } = await supabase.rpc('meet_leave', { _id: conferenceId, _connection_id: connectionId });
  throwIfError(error);
}

export function meetError(error: unknown) {
  const raw = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (raw.includes('MEET_CAPACITY')) return 'У конференції вже немає вільних місць.';
  if (raw.includes('MEET_BLOCKED')) return 'Вас було видалено з цієї конференції.';
  if (raw.includes('MEET_INACTIVE')) return 'Конференція вже не активна.';
  if (raw.includes('MEET_SESSION')) return 'Підключення відкрито в іншій вкладці або вже завершено.';
  if (raw.includes('MEET_DENIED')) return 'У вас немає доступу до цієї конференції.';
  return 'Не вдалося встановити з’єднання. Спробуйте ще раз.';
}

export function makeConnectionId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function iceServers(): RTCIceServer[] {
  const fallback: RTCIceServer[] = [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
  ];
  const configured = import.meta.env.VITE_MEET_ICE_SERVERS as string | undefined;
  if (!configured) return fallback;
  try {
    const parsed = JSON.parse(configured) as RTCIceServer[];
    return Array.isArray(parsed) && parsed.every(item => item && item.urls) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function mediaConstraints(videoDeviceId?: string, audioDeviceId?: string): MediaStreamConstraints {
  return {
    audio: audioDeviceId ? { deviceId: { exact: audioDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: cameraVideoConstraints(videoDeviceId),
  };
}

export async function tuneVideoSender(sender: RTCRtpSender, options: {
  level?: MeetQualityLevel;
  screen?: boolean;
  maxBitrate?: number;
} = {}) {
  if (sender.track?.kind !== 'video' || !sender.getParameters || !sender.setParameters) return;
  const { level = 'hd', screen = false, maxBitrate } = options;
  const profile = QUALITY_PROFILES[level];
  const parameters = sender.getParameters();
  if (!parameters.encodings?.length) parameters.encodings = [{}];
  parameters.encodings[0].maxBitrate = maxBitrate || (screen ? 4_000_000 : profile.bitrate);
  parameters.encodings[0].maxFramerate = screen ? 30 : profile.fps;
  parameters.degradationPreference = screen ? 'maintain-resolution' : 'balanced';
  const sourceHeight = sender.track.getSettings?.().height;
  if (sourceHeight && !screen) parameters.encodings[0].scaleResolutionDownBy = Math.max(1, sourceHeight / profile.height);
  else if (!screen && level === 'full-hd') parameters.encodings[0].scaleResolutionDownBy = 1;
  try {
    await sender.setParameters(parameters);
  } catch {
    // WebKit versions differ in support for degradationPreference and scaling.
    // Retry with progressively smaller, standards-compatible parameter sets so
    // an unsupported hint does not discard the useful bitrate ceiling too.
    try {
      const fallback = sender.getParameters();
      if (!fallback.encodings?.length) fallback.encodings = [{}];
      fallback.encodings[0].maxBitrate = maxBitrate || (screen ? 4_000_000 : profile.bitrate);
      fallback.encodings[0].maxFramerate = screen ? 30 : profile.fps;
      await sender.setParameters(fallback);
    } catch {
      try {
        const bitrateOnly = sender.getParameters();
        if (!bitrateOnly.encodings?.length) bitrateOnly.encodings = [{}];
        bitrateOnly.encodings[0].maxBitrate = maxBitrate || (screen ? 4_000_000 : profile.bitrate);
        await sender.setParameters(bitrateOnly);
      } catch { /* The browser remains responsible for congestion control. */ }
    }
  }
}
