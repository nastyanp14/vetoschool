import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getMeetRoster, heartbeatMeet, iceServers, joinMeet, leaveMeet, meetError, sendMeetSignal,
  tuneVideoSender, type MeetParticipant, type MeetSignal,
} from '@/lib/meetMedia';

type ChatMessage = { id: number; userId: string; name: string; text: string; createdAt: string };
type Peer = {
  pc: RTCPeerConnection;
  connectionId: string;
  audioSender?: RTCRtpSender;
  videoSender?: RTCRtpSender;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingAnswer: boolean;
  retries: number;
  pendingCandidates: RTCIceCandidateInit[];
};

export function useMeetCall({
  conferenceId, userId, connectionId, stream, enabled,
}: { conferenceId: string; userId: string; connectionId: string; stream: MediaStream; enabled: boolean }) {
  const [participants, setParticipants] = useState<MeetParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'failed'>('connecting');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [observerOnly, setObserverOnly] = useState(false);
  const [role, setRole] = useState<'teacher' | 'student' | 'admin'>('student');
  const [camera, setCamera] = useState(() => Boolean(stream.getVideoTracks().find(track => track.enabled)));
  const [microphone, setMicrophone] = useState(() => Boolean(stream.getAudioTracks().find(track => track.enabled)));
  const [handRaised, setHandRaised] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const peers = useRef(new Map<string, Peer>());
  const participantsRef = useRef<MeetParticipant[]>([]);
  const streamRef = useRef(stream);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const observerOnlyRef = useRef(false);
  const stateRef = useRef({ camera, microphone, handRaised, sharingScreen });
  const activeRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => { participantsRef.current = participants; }, [participants]);
  useEffect(() => { streamRef.current = stream; }, [stream]);
  useEffect(() => { stateRef.current = { camera, microphone, handRaised, sharingScreen }; }, [camera, microphone, handRaised, sharingScreen]);

  const send = useCallback((target: string | null, event: 'offer' | 'answer' | 'ice' | 'chat', payload: Record<string, unknown>) =>
    sendMeetSignal(conferenceId, connectionId, target, event, payload), [conferenceId, connectionId]);

  const closePeer = useCallback((remoteId: string) => {
    const peer = peers.current.get(remoteId);
    if (!peer) return;
    peer.pc.ontrack = null;
    peer.pc.onicecandidate = null;
    peer.pc.onnegotiationneeded = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    peers.current.delete(remoteId);
    setRemoteStreams(current => { const next = { ...current }; delete next[remoteId]; return next; });
  }, []);

  const createPeer = useCallback((remoteId: string, remoteConnectionId: string) => {
    const existing = peers.current.get(remoteId);
    if (existing?.connectionId === remoteConnectionId) return existing;
    if (existing) closePeer(remoteId);
    const pc = new RTCPeerConnection({ iceServers: iceServers(), bundlePolicy: 'max-bundle' });
    const peer: Peer = { pc, connectionId: remoteConnectionId, polite: userId.localeCompare(remoteId) > 0, makingOffer: false, ignoreOffer: false, settingAnswer: false, retries: 0, pendingCandidates: [] };
    peers.current.set(remoteId, peer);
    for (const track of streamRef.current.getTracks().filter(item => item.enabled)) {
      const sender = pc.addTrack(track, streamRef.current);
      if (track.kind === 'audio') peer.audioSender = sender; else peer.videoSender = sender;
    }
    for (const sender of pc.getSenders()) void tuneVideoSender(sender);
    pc.ontrack = event => {
      const received = event.streams[0] || new MediaStream([event.track]);
      setRemoteStreams(current => ({ ...current, [remoteId]: received }));
    };
    pc.onicecandidate = event => {
      if (event.candidate) void send(remoteId, 'ice', { candidate: event.candidate.toJSON() }).catch(() => setStatus('reconnecting'));
    };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) await send(remoteId, 'offer', { description: pc.localDescription.toJSON() });
      } catch { setStatus('reconnecting'); } finally { peer.makingOffer = false; }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { peer.retries = 0; setStatus('connected'); return; }
      if (pc.connectionState === 'disconnected') setStatus('reconnecting');
      if (pc.connectionState === 'failed') {
        if (peer.retries >= 3) { setStatus('failed'); setError('Не вдалося встановити з’єднання. Спробуйте ще раз.'); return; }
        peer.retries += 1;
        try { pc.restartIce(); } catch { setStatus('failed'); }
      }
    };
    return peer;
  }, [closePeer, send, userId]);

  const syncRoster = useCallback((next: MeetParticipant[]) => {
    participantsRef.current = next;
    setParticipants(next);
    const expected = new Set<string>();
    if (!observerOnlyRef.current) {
      for (const participant of next) {
        if (participant.userId === userId || participant.observerOnly) continue;
        expected.add(participant.userId);
        createPeer(participant.userId, participant.connectionId);
      }
    }
    for (const remoteId of peers.current.keys()) if (!expected.has(remoteId)) closePeer(remoteId);
  }, [closePeer, createPeer, userId]);

  const onSignal = useCallback(async (signal: MeetSignal) => {
    if (!activeRef.current || (signal.sender_user_id === userId && !['control', 'roster'].includes(signal.event_type))) return;
    if (signal.event_type === 'roster') {
      try { syncRoster(await getMeetRoster(conferenceId, connectionId)); } catch (caught) { setError(meetError(caught)); }
      return;
    }
    if (signal.event_type === 'chat') {
      const text = typeof signal.payload.text === 'string' ? signal.payload.text : '';
      if (!text) return;
      const sender = participantsRef.current.find(item => item.userId === signal.sender_user_id);
      setMessages(current => [...current.slice(-199), { id: signal.id, userId: signal.sender_user_id, name: sender?.name || 'Учасник', text, createdAt: signal.created_at }]);
      return;
    }
    if (signal.event_type === 'control') {
      const action = signal.payload.action;
      if (action === 'session_replaced' && signal.payload.connectionId === connectionId) {
        setError('Цю конференцію відкрито в іншій вкладці.'); activeRef.current = false;
        streamRef.current.getTracks().forEach(track => track.stop());
        for (const remoteId of [...peers.current.keys()]) closePeer(remoteId);
      } else if (action === 'mute') {
        for (const track of streamRef.current.getAudioTracks()) track.enabled = false;
        for (const peer of peers.current.values()) for (const sender of peer.pc.getSenders()) if (sender.track?.kind === 'audio') await sender.replaceTrack(null);
        stateRef.current = { ...stateRef.current, microphone: false };
        setMicrophone(false); setNotice('Викладач вимкнув ваш мікрофон. Ви можете ввімкнути його самостійно.');
      } else if (action === 'request_unmute') setNotice('Викладач просить вас увімкнути мікрофон.');
      else if (action === 'kick') {
        setError('Вас було видалено з цієї конференції.'); activeRef.current = false;
        streamRef.current.getTracks().forEach(track => track.stop());
        for (const remoteId of [...peers.current.keys()]) closePeer(remoteId);
      }
      return;
    }
    if (signal.target_user_id !== userId || !['offer', 'answer', 'ice'].includes(signal.event_type)) return;
    const peer = createPeer(signal.sender_user_id, signal.sender_connection_id);
    const pc = peer.pc;
    try {
      if (signal.event_type === 'ice') {
        const candidate = signal.payload.candidate as RTCIceCandidateInit | undefined;
        if (candidate && !pc.remoteDescription) peer.pendingCandidates.push(candidate);
        else if (candidate) await pc.addIceCandidate(candidate).catch(caught => { if (!peer.ignoreOffer) throw caught; });
        return;
      }
      const description = signal.payload.description as RTCSessionDescriptionInit | undefined;
      if (!description) return;
      const ready = !peer.makingOffer && (pc.signalingState === 'stable' || peer.settingAnswer);
      const collision = description.type === 'offer' && !ready;
      peer.ignoreOffer = !peer.polite && collision;
      if (peer.ignoreOffer) return;
      peer.settingAnswer = description.type === 'answer';
      await pc.setRemoteDescription(description);
      for (const candidate of peer.pendingCandidates.splice(0)) await pc.addIceCandidate(candidate);
      peer.settingAnswer = false;
      if (description.type === 'offer') {
        await pc.setLocalDescription();
        if (pc.localDescription) await send(signal.sender_user_id, 'answer', { description: pc.localDescription.toJSON() });
      }
    } catch { peer.settingAnswer = false; setStatus('reconnecting'); }
  }, [closePeer, conferenceId, connectionId, createPeer, send, syncRoster, userId]);

  const shutdown = useCallback(async (notify = true) => {
    if (!activeRef.current && !channelRef.current) return;
    activeRef.current = false;
    if (notify) void leaveMeet(conferenceId, connectionId).catch(() => undefined);
    for (const remoteId of [...peers.current.keys()]) closePeer(remoteId);
    if (channelRef.current) { void supabase.removeChannel(channelRef.current); channelRef.current = null; }
    const screenTrack = screenTrackRef.current;
    screenTrackRef.current = null;
    if (screenTrack) { screenTrack.onended = null; screenTrack.stop(); }
  }, [closePeer, conferenceId, connectionId]);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let heartbeatFailures = 0;
    let channel: ReturnType<typeof supabase.channel>;
    const connect = async () => {
      try {
        await supabase.realtime.setAuth();
        if (disposed) return;
        channel = supabase.channel(`meet-signals:${conferenceId}:${connectionId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conference_signals', filter: `conference_id=eq.${conferenceId}` }, payload => void onSignal(payload.new as MeetSignal))
          .subscribe(async channelStatus => {
            if (channelStatus === 'SUBSCRIBED') {
              try {
                const joined = await joinMeet(conferenceId, connectionId, stateRef.current.camera, stateRef.current.microphone);
                if (disposed) return;
                observerOnlyRef.current = joined.observerOnly;
                activeRef.current = true; heartbeatFailures = 0; setError(''); setRole(joined.role); setObserverOnly(joined.observerOnly); syncRoster(joined.participants); setStatus('connected');
                if (!heartbeat) heartbeat = setInterval(() => {
                  if (!activeRef.current) return;
                  void heartbeatMeet(conferenceId, connectionId, stateRef.current)
                    .then(next => { heartbeatFailures = 0; setStatus('connected'); syncRoster(next); }).catch(caught => {
                      heartbeatFailures += 1; setStatus('reconnecting');
                      if (heartbeatFailures >= 3) setError(meetError(caught));
                    });
                }, 15_000);
              } catch (caught) { setStatus('failed'); setError(meetError(caught)); }
            } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') setStatus('reconnecting');
          });
        channelRef.current = channel;
      } catch (caught) { setStatus('failed'); setError(meetError(caught)); }
    };
    void connect();
    const online = () => {
      if (!activeRef.current) return;
      void joinMeet(conferenceId, connectionId, stateRef.current.camera, stateRef.current.microphone)
        .then(joined => { observerOnlyRef.current = joined.observerOnly; setObserverOnly(joined.observerOnly); heartbeatFailures = 0; setError(''); setStatus('connected'); syncRoster(joined.participants); })
        .catch(() => setStatus('reconnecting'));
    };
    window.addEventListener('online', online);
    window.addEventListener('focus', online);
    const pagehide = () => { if (activeRef.current) void leaveMeet(conferenceId, connectionId).catch(() => undefined); };
    window.addEventListener('pagehide', pagehide);
    const visible = () => { if (document.visibilityState === 'visible') online(); };
    document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; clearInterval(heartbeat); window.removeEventListener('online', online); window.removeEventListener('focus', online); window.removeEventListener('pagehide', pagehide); document.removeEventListener('visibilitychange', visible); void shutdown(true); };
  }, [conferenceId, connectionId, enabled, onSignal, shutdown, syncRoster]);

  const replaceKind = useCallback(async (kind: 'audio' | 'video', track: MediaStreamTrack | null, screen = false) => {
    for (const peer of peers.current.values()) {
      let sender = kind === 'audio' ? peer.audioSender : peer.videoSender;
      if (!sender && track) {
        sender = peer.pc.addTrack(track, streamRef.current);
        if (kind === 'audio') peer.audioSender = sender; else peer.videoSender = sender;
      }
      else if (sender) await sender.replaceTrack(track);
      if (sender && kind === 'video') await tuneVideoSender(sender, screen);
    }
  }, []);

  const publishState = useCallback((next: Partial<typeof stateRef.current>) => {
    stateRef.current = { ...stateRef.current, ...next };
    if (activeRef.current) void heartbeatMeet(conferenceId, connectionId, stateRef.current).then(syncRoster).catch(caught => setError(meetError(caught)));
  }, [conferenceId, connectionId, syncRoster]);

  const toggleMicrophone = useCallback(async () => {
    const track = streamRef.current.getAudioTracks()[0];
    if (!track) { setNotice('Мікрофон недоступний. Оберіть інший пристрій у налаштуваннях.'); return; }
    const next = !microphone; track.enabled = next; await replaceKind('audio', next ? track : null); setMicrophone(next); publishState({ microphone: next });
  }, [microphone, publishState, replaceKind]);
  const toggleCamera = useCallback(async () => {
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) { setNotice('Камера недоступна. Оберіть інший пристрій у налаштуваннях.'); return; }
    const next = !camera; track.enabled = next; await replaceKind('video', next ? track : null); setCamera(next); publishState({ camera: next });
  }, [camera, publishState, replaceKind]);
  const toggleHand = useCallback(() => setHandRaised(current => { const next = !current; publishState({ handRaised: next }); return next; }), [publishState]);
  const startScreenShare = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) { setNotice('Демонстрація екрана не підтримується цим браузером.'); return; }
    if (screenTrackRef.current) return;
    let track: MediaStreamTrack | null = null;
    try {
      const shared = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 10, max: 15 } }, audio: false });
      track = shared.getVideoTracks()[0] || null;
      if (!track) return;
      await replaceKind('video', track, true);
      screenTrackRef.current = track; setScreenStream(shared); setSharingScreen(true); publishState({ sharingScreen: true });
      track.onended = () => { void (async () => {
        if (screenTrackRef.current !== track) return;
        screenTrackRef.current = null; setScreenStream(null); setSharingScreen(false); publishState({ sharingScreen: false });
        const cameraTrack = streamRef.current.getVideoTracks()[0];
        await replaceKind('video', camera && cameraTrack ? cameraTrack : null);
      })(); };
    } catch (caught) {
      if (track) { track.onended = null; track.stop(); }
      if (screenTrackRef.current === track) screenTrackRef.current = null;
      if ((caught as DOMException)?.name !== 'NotAllowedError') setNotice('Не вдалося розпочати демонстрацію екрана.');
    }
  }, [camera, publishState, replaceKind]);
  const stopScreenShare = useCallback(() => screenTrackRef.current?.stop(), []);
  const sendMessage = useCallback(async (text: string, ownName: string) => {
    const clean = text.trim().slice(0, 2000); if (!clean) return;
    await send(null, 'chat', { text: clean });
    setMessages(current => [...current.slice(-199), { id: Date.now(), userId, name: ownName, text: clean, createdAt: new Date().toISOString() }]);
  }, [send, userId]);
  const replaceDeviceTrack = useCallback(async (kind: 'audio' | 'video', track: MediaStreamTrack) => {
    const old = kind === 'audio' ? streamRef.current.getAudioTracks()[0] : streamRef.current.getVideoTracks()[0];
    if (old) { streamRef.current.removeTrack(old); old.stop(); }
    streamRef.current.addTrack(track); track.enabled = kind === 'audio' ? microphone : camera;
    if (!(kind === 'video' && sharingScreen)) await replaceKind(kind, track.enabled ? track : null);
  }, [camera, microphone, replaceKind, sharingScreen]);

  return { participants, remoteStreams, messages, status, error, notice, setNotice, observerOnly, role,
    camera, microphone, handRaised, sharingScreen, screenStream, toggleCamera, toggleMicrophone, toggleHand,
    startScreenShare, stopScreenShare, sendMessage, replaceDeviceTrack, shutdown };
}
