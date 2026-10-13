import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft, Camera, Check, Hand, LogOut, MessageCircle, Mic, MicOff, MonitorUp,
  PhoneOff, Send, Settings, Shield, UserRoundX, Users, VideoOff, X,
} from 'lucide-react';
import { controlMeetParticipant, makeConnectionId } from '@/lib/meetMedia';
import { transitionConferenceRemote } from '@/lib/conferences';
import type { Conference } from '@/components/meet-management/model';
import type { User } from '@/lib/auth';
import { useMeetCall } from '@/hooks/useMeetCall';
import './meet.css';

type DeviceOption = { deviceId: string; label: string };
type Devices = { cameras: DeviceOption[]; microphones: DeviceOption[]; speakers: DeviceOption[] };

function storedDevice(key: string) {
  try { return window.localStorage?.getItem(key) || ''; } catch { return ''; }
}

function rememberDevice(key: string, value: string) {
  try { window.localStorage?.setItem(key, value); } catch { /* Device preferences are optional. */ }
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'V';
}

function useDuration(startedAt?: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt || now).getTime()) / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function Video({ stream, muted = false, mirrored = false, sinkId, className = '' }: { stream?: MediaStream | null; muted?: boolean; mirrored?: boolean; sinkId?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current; if (!video) return;
    video.srcObject = stream || null;
    void video.play().catch(() => undefined);
    if ('setSinkId' in video) void (video as HTMLVideoElement & { setSinkId(id: string): Promise<void> }).setSinkId(sinkId || 'default').catch(() => undefined);
  }, [sinkId, stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${className} ${mirrored ? 'meet-mirrored' : ''}`} />;
}

function useSpeaking(stream?: MediaStream, disabled = false) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!stream || disabled || !stream.getAudioTracks().length || !AudioContextClass) return;
    const context = new AudioContextClass(); void context.resume().catch(() => undefined);
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser(); analyser.fftSize = 256; source.connect(analyser);
    const values = new Uint8Array(analyser.frequencyBinCount);
    const timer = setInterval(() => {
      analyser.getByteFrequencyData(values);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      setSpeaking(average > 18);
    }, 220);
    return () => { clearInterval(timer); source.disconnect(); void context.close(); };
  }, [disabled, stream]);
  return speaking;
}

function VideoTile({ participant, stream, self, sinkId }: { participant: ReturnType<typeof useMeetCall>['participants'][number]; stream?: MediaStream; self: boolean; sinkId?: string }) {
  const speaking = useSpeaking(stream, !participant.microphone);
  return <article className={`meet-video-tile ${speaking ? 'meet-active-tile' : ''}`}>
    <Video stream={stream} muted={self} mirrored={self} sinkId={sinkId} className={participant.camera ? 'meet-video-visible' : 'meet-video-hidden'} />
    {!participant.camera && <div className="meet-person-circle">{initials(participant.name)}</div>}
    <span className="meet-tile-name">{participant.name}{self ? ' (Ви)' : ''}<small>{participant.role === 'teacher' ? 'Викладач' : 'Учень'}</small></span>
    <span className="meet-tile-mic">{participant.microphone ? <Mic size={17} /> : <MicOff size={17} />}</span>
    {participant.handRaised && <Hand className="meet-raised-hand" aria-label="Піднята рука" />}
  </article>;
}

function MicrophoneCheck({ stream }: { stream: MediaStream }) {
  const speaking = useSpeaking(stream);
  return <div className={`meet-mic-test ${speaking ? 'meet-mic-test-active' : ''}`} role="status"><Mic size={15} /><span>Перевірка мікрофона</span><i /><i /><i /><i /></div>;
}

export default function LiveClassroom({ conference, user, onExit, onRefresh }: {
  conference: Conference; user: User; onExit: () => void; onRefresh: () => Promise<void>;
}) {
  const localStream = useRef(new MediaStream());
  const [phase, setPhase] = useState<'prejoin' | 'call'>('prejoin');
  const [mediaVersion, setMediaVersion] = useState(0);
  const [mediaError, setMediaError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<Devices>({ cameras: [], microphones: [], speakers: [] });
  const [cameraId, setCameraId] = useState(() => storedDevice('meet_camera'));
  const [microphoneId, setMicrophoneId] = useState(() => storedDevice('meet_microphone'));
  const [speakerId, setSpeakerId] = useState(() => storedDevice('meet_speaker'));
  const [cameraOn, setCameraOn] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(false);
  const [panel, setPanel] = useState<'chat' | 'participants' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState(0);
  const [actionError, setActionError] = useState('');
  const connectionId = useMemo(() => makeConnectionId(), []);
  const duration = useDuration(conference.startedAt);
  const call = useMeetCall({ conferenceId: conference.id, userId: user.id, connectionId, stream: localStream.current, enabled: phase === 'call' });
  const previewRef = useRef<HTMLVideoElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const lastMessages = useRef(0);
  const isManager = call.role === 'teacher' || call.role === 'admin';
  const outputSelectionSupported = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  const screenSupported = Boolean(navigator.mediaDevices?.getDisplayMedia);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    const map = (kind: MediaDeviceKind, prefix: string) => list.filter(item => item.kind === kind).map((item, index) => ({ deviceId: item.deviceId, label: item.label || `${prefix} ${index + 1}` }));
    setDevices({ cameras: map('videoinput', 'Камера'), microphones: map('audioinput', 'Мікрофон'), speakers: map('audiooutput', 'Динаміки') });
  }, []);

  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.addEventListener) return;
    const changed = () => void refreshDevices(); media.addEventListener('devicechange', changed);
    return () => media.removeEventListener('devicechange', changed);
  }, [refreshDevices]);
  useEffect(() => {
    const video = previewRef.current; if (!video) return; video.srcObject = localStream.current; void video.play().catch(() => undefined);
  }, [mediaVersion]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }); }, [call.messages, panel]);
  useEffect(() => {
    if (call.messages.length > lastMessages.current && panel !== 'chat') setUnread(value => value + call.messages.length - lastMessages.current);
    lastMessages.current = call.messages.length;
  }, [call.messages.length, panel]);
  useEffect(() => { if (panel === 'chat') setUnread(0); }, [panel]);
  useEffect(() => () => localStream.current.getTracks().forEach(track => track.stop()), []);

  const acquire = useCallback(async (kind: 'audio' | 'video', deviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
    const constraints: MediaStreamConstraints = kind === 'video'
      ? { video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 20, max: 24 }, facingMode: deviceId ? undefined : 'user' }, audio: false }
      : { audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false };
    const captured = await navigator.mediaDevices.getUserMedia(constraints);
    const track = kind === 'video' ? captured.getVideoTracks()[0] : captured.getAudioTracks()[0];
    if (!track) throw new Error('missing');
    if (phase === 'call') await call.replaceDeviceTrack(kind, track);
    else {
      const old = kind === 'video' ? localStream.current.getVideoTracks()[0] : localStream.current.getAudioTracks()[0];
      if (old) { localStream.current.removeTrack(old); old.stop(); }
      localStream.current.addTrack(track); track.enabled = true;
      if (kind === 'video') setCameraOn(true); else setMicrophoneOn(true);
    }
    setMediaVersion(value => value + 1); setMediaError(''); await refreshDevices();
    return track;
  }, [call, phase, refreshDevices]);

  const togglePrejoin = async (kind: 'audio' | 'video') => {
    const isOn = kind === 'video' ? cameraOn : microphoneOn;
    const track = kind === 'video' ? localStream.current.getVideoTracks()[0] : localStream.current.getAudioTracks()[0];
    if (isOn && track) { track.enabled = false; if (kind === 'video') setCameraOn(false); else setMicrophoneOn(false); return; }
    if (track && track.readyState === 'live') { track.enabled = true; if (kind === 'video') setCameraOn(true); else setMicrophoneOn(true); return; }
    setBusy(true);
    try { await acquire(kind, kind === 'video' ? cameraId : microphoneId); }
    catch (caught) {
      const name = (caught as DOMException)?.name;
      setMediaError(name === 'NotAllowedError' ? 'Доступ до камери або мікрофона заборонено. Дозвольте його в налаштуваннях браузера або приєднайтеся без медіа.' : 'Пристрій недоступний. Ви можете обрати інший або приєднатися без медіа.');
    } finally { setBusy(false); }
  };
  const toggleDuringCall = async (kind: 'audio' | 'video') => {
    const track = kind === 'video' ? localStream.current.getVideoTracks()[0] : localStream.current.getAudioTracks()[0];
    if (!track || track.readyState !== 'live') {
      setBusy(true);
      try { await acquire(kind, kind === 'video' ? cameraId : microphoneId); }
      catch { setMediaError('Не вдалося отримати доступ до пристрою. Перевірте дозволи браузера.'); setBusy(false); return; }
      setBusy(false);
    }
    if (kind === 'video') await call.toggleCamera(); else await call.toggleMicrophone();
  };

  const changeDevice = async (kind: 'audio' | 'video', id: string) => {
    if (kind === 'video') { setCameraId(id); rememberDevice('meet_camera', id); }
    else { setMicrophoneId(id); rememberDevice('meet_microphone', id); }
    setBusy(true); try { await acquire(kind, id); } catch { setMediaError('Не вдалося підключити вибраний пристрій.'); } finally { setBusy(false); }
  };
  const leave = async () => { await call.shutdown(true); localStream.current.getTracks().forEach(track => track.stop()); onExit(); };
  const endForAll = async () => {
    if (!window.confirm('Завершити заняття для всіх учасників?')) return;
    setBusy(true); setActionError('');
    try { await transitionConferenceRemote(conference, 'completed'); await call.shutdown(false); localStream.current.getTracks().forEach(track => track.stop()); await onRefresh(); }
    catch { setActionError('Не вдалося завершити заняття. Оновіть сторінку та спробуйте ще раз.'); }
    finally { setBusy(false); }
  };
  const sendMessage = async (event: FormEvent) => {
    event.preventDefault(); const text = draft; if (!text.trim()) return;
    try { await call.sendMessage(text, user.name); setDraft(''); } catch { setActionError('Повідомлення не надіслано. Перевірте з’єднання.'); }
  };
  const moderate = async (target: string, action: 'mute' | 'request_unmute' | 'kick') => {
    try { await controlMeetParticipant(conference.id, connectionId, target, action); }
    catch { setActionError('Не вдалося виконати дію. Список учасників міг змінитися.'); }
  };
  const tiles = call.participants.filter(participant => !participant.observerOnly);
  const sharing = tiles.find(participant => participant.sharingScreen);
  const streamFor = (id: string) => id === user.id ? (sharing?.userId === user.id && call.screenStream ? call.screenStream : localStream.current) : call.remoteStreams[id];

  if (phase === 'prejoin') return <main className="meet-room meet-live-room">
    <header className="meet-room-header"><button type="button" className="meet-back" onClick={onExit}><ArrowLeft size={18} />Повернутися</button><span className="meet-wordmark">Vetoschool <span>Meet</span></span></header>
    <div className="meet-prejoin">
      <div>
        <div className="meet-camera-preview">
          <video ref={previewRef} autoPlay playsInline muted className={cameraOn ? 'meet-video-visible meet-mirrored' : 'meet-video-hidden'} />
          {!cameraOn && <><div className="meet-person-circle">{initials(user.name)}</div><h3>{user.name}</h3><p>Камеру вимкнено</p></>}
        </div>
        <div className="meet-prejoin-controls">
          <button type="button" className="meet-control" aria-pressed={microphoneOn} onClick={() => void togglePrejoin('audio')} disabled={busy}>{microphoneOn ? <Mic /> : <MicOff />}<span>Мікрофон</span></button>
          <button type="button" className="meet-control" aria-pressed={cameraOn} onClick={() => void togglePrejoin('video')} disabled={busy}>{cameraOn ? <Camera /> : <VideoOff />}<span>Камера</span></button>
        </div>
        {microphoneOn && <MicrophoneCheck stream={localStream.current} />}
      </div>
      <section className="meet-join-form"><p className="meet-eyebrow">Готові до заняття?</p><h1>{conference.title}</h1><p className="meet-muted">Перевірте камеру й мікрофон. Можна приєднатися без медіа.</p>
        {mediaError && <p className="meet-inline-error" role="alert">{mediaError}</p>}
        <DeviceFields devices={devices} cameraId={cameraId} microphoneId={microphoneId} speakerId={speakerId} outputSelectionSupported={outputSelectionSupported} disabled={busy}
          onCamera={id => void changeDevice('video', id)} onMicrophone={id => void changeDevice('audio', id)} onSpeaker={id => { setSpeakerId(id); rememberDevice('meet_speaker', id); }} />
        <button className="meet-button meet-primary" type="button" onClick={() => setPhase('call')} disabled={busy}><Camera size={20} />Приєднатися</button>
        <button className="meet-button meet-secondary" type="button" onClick={onExit}>Повернутися</button>
      </section>
    </div>
  </main>;

  return <main className="meet-room meet-live-room">
    <header className="meet-call-header"><span className="meet-wordmark">Vetoschool <span>Meet</span></span><div><h1>{conference.title}</h1><p><span className={`meet-connection-dot meet-${call.status}`} />{call.status === 'connected' ? 'Підключено' : call.status === 'connecting' ? 'Підключення…' : call.status === 'reconnecting' ? 'Відновлення зв’язку…' : 'Помилка з’єднання'} · {duration}</p></div></header>
    {(call.error || actionError) && <div className="meet-call-error" role="alert">{call.error || actionError}<button type="button" onClick={() => void leave()}>Повернутися</button></div>}
    {call.notice && <div className="meet-call-notice" role="status">{call.notice}<button type="button" aria-label="Закрити" onClick={() => call.setNotice('')}><X size={16} /></button></div>}
    {call.observerOnly && <div className="meet-observer-note"><Shield size={18} />Адміністративний режим: медіапотоки не підключаються і ліміт п’яти учасників не використовується.</div>}
    <div className={`meet-call-layout ${panel ? 'meet-panel-open' : ''} ${sharing ? 'meet-sharing-layout' : ''}`}>
      <section className="meet-call-main">
        {sharing ? <><div className="meet-screen-stage"><Video stream={streamFor(sharing.userId)} muted={sharing.userId === user.id} sinkId={speakerId} /><span>{sharing.name} демонструє екран</span></div><div className="meet-video-strip">{tiles.filter(participant => participant.userId !== sharing.userId).map(participant => <VideoTile key={participant.userId} participant={participant} stream={streamFor(participant.userId)} self={participant.userId === user.id} sinkId={speakerId} />)}</div></>
          : tiles.length ? <div className={`meet-video-grid meet-grid-${Math.min(tiles.length, 5)}`}>{tiles.map(participant => <VideoTile key={participant.userId} participant={participant} stream={streamFor(participant.userId)} self={participant.userId === user.id} sinkId={speakerId} />)}</div>
          : <div className="meet-waiting"><Users size={36} /><h2>Очікуємо учасників</h2></div>}
      </section>
      {panel && <aside className="meet-side-panel" aria-label={panel === 'chat' ? 'Чат' : 'Учасники'}>
        <div className="meet-chat-heading"><h2>{panel === 'chat' ? 'Чат' : `Учасники (${call.participants.length})`}</h2><button className="meet-icon-button" type="button" onClick={() => setPanel(null)} aria-label="Закрити"><X size={20} /></button></div>
        {panel === 'chat' ? <><p className="meet-chat-hint">Повідомлення тимчасові та не зберігаються після заняття.</p><div className="meet-messages" role="log" aria-live="polite">{call.messages.map(message => <div className={`meet-message ${message.userId === user.id ? 'meet-message-self' : ''}`} key={`${message.id}-${message.userId}`}><div><strong>{message.name}</strong><time>{new Date(message.createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.text}</p></div>)}<div ref={chatEnd} /></div><form className="meet-chat-form" onSubmit={event => void sendMessage(event)}><input aria-label="Повідомлення" placeholder="Напишіть повідомлення…" maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} /><button className="meet-icon-button" type="submit" disabled={!draft.trim()} aria-label="Надіслати"><Send size={20} /></button></form></>
          : <div className="meet-participant-list">{call.participants.map(participant => <div className="meet-participant-row" key={participant.userId}><span className="meet-participant-avatar">{initials(participant.name)}</span><div><strong>{participant.name}{participant.userId === user.id ? ' (Ви)' : ''}</strong><small>{participant.role === 'teacher' ? 'Викладач' : participant.role === 'admin' ? 'Адміністратор · без медіа' : 'Учень'} · {participant.microphone ? 'мікрофон увімкнено' : 'мікрофон вимкнено'} · {participant.camera ? 'камера увімкнена' : 'камера вимкнена'}{participant.handRaised ? ' · ✋' : ''}</small>{isManager && participant.role === 'student' && participant.userId !== user.id && <span className="meet-moderation"><button type="button" onClick={() => void moderate(participant.userId, 'mute')}>Вимкнути мікрофон</button><button type="button" onClick={() => void moderate(participant.userId, 'request_unmute')}>Попросити ввімкнути</button><button type="button" className="meet-kick" onClick={() => void moderate(participant.userId, 'kick')}><UserRoundX size={14} />Видалити</button></span>}</div><span className="meet-online-dot" title="Підключено" /></div>)}</div>}
      </aside>}
    </div>
    <footer className="meet-controls">
      {!call.observerOnly && <><button type="button" className="meet-control" aria-pressed={call.microphone} disabled={busy} onClick={() => void toggleDuringCall('audio')}>{call.microphone ? <Mic /> : <MicOff />}<span>Мікрофон</span></button><button type="button" className="meet-control" aria-pressed={call.camera} disabled={busy || call.sharingScreen} title={call.sharingScreen ? 'Спочатку зупиніть демонстрацію екрана' : ''} onClick={() => void toggleDuringCall('video')}>{call.camera ? <Camera /> : <VideoOff />}<span>Камера</span></button></>}
      {call.role === 'teacher' && <button type="button" className="meet-control" aria-pressed={call.sharingScreen} disabled={!screenSupported} title={screenSupported ? '' : 'Браузер не підтримує демонстрацію екрана'} onClick={() => call.sharingScreen ? call.stopScreenShare() : void call.startScreenShare()}><MonitorUp /><span>{call.sharingScreen ? 'Зупинити показ' : 'Показати екран'}</span></button>}
      <button type="button" className="meet-control" aria-expanded={panel === 'chat'} onClick={() => setPanel(panel === 'chat' ? null : 'chat')}><MessageCircle /><span>Чат{unread ? ` (${unread})` : ''}</span></button>
      <button type="button" className="meet-control" aria-expanded={panel === 'participants'} onClick={() => setPanel(panel === 'participants' ? null : 'participants')}><Users /><span>Учасники</span></button>
      <button type="button" className="meet-control" aria-pressed={call.handRaised} onClick={call.toggleHand}><Hand /><span>{call.handRaised ? 'Опустити руку' : 'Підняти руку'}</span></button>
      {!call.observerOnly && <button type="button" className="meet-control" onClick={() => setSettingsOpen(true)}><Settings /><span>Налаштування</span></button>}
      <button type="button" className="meet-control meet-leave" onClick={() => void leave()}><LogOut /><span>Вийти</span></button>
      {isManager && <button type="button" className="meet-control meet-end" disabled={busy} onClick={() => void endForAll()}><PhoneOff /><span>Завершити для всіх</span></button>}
    </footer>
    {settingsOpen && <div className="meet-modal-backdrop" role="presentation"><section className="meet-settings" role="dialog" aria-modal="true" aria-labelledby="meet-settings-title"><div className="meet-chat-heading"><h2 id="meet-settings-title">Налаштування</h2><button className="meet-icon-button" type="button" onClick={() => setSettingsOpen(false)} aria-label="Закрити"><X /></button></div><p className="meet-chat-hint"><Check size={14} />Камера і мікрофон перевіряються одразу після вибору.</p><DeviceFields devices={devices} cameraId={cameraId} microphoneId={microphoneId} speakerId={speakerId} outputSelectionSupported={outputSelectionSupported} disabled={busy} onCamera={id => void changeDevice('video', id)} onMicrophone={id => void changeDevice('audio', id)} onSpeaker={id => { setSpeakerId(id); rememberDevice('meet_speaker', id); }} /><button className="meet-button meet-primary" type="button" onClick={() => setSettingsOpen(false)}>Готово</button></section></div>}
  </main>;
}

function DeviceFields({ devices, cameraId, microphoneId, speakerId, outputSelectionSupported, disabled, onCamera, onMicrophone, onSpeaker }: {
  devices: Devices; cameraId: string; microphoneId: string; speakerId: string; outputSelectionSupported: boolean; disabled: boolean;
  onCamera(id: string): void; onMicrophone(id: string): void; onSpeaker(id: string): void;
}) {
  return <fieldset className="meet-device-fields"><legend>Пристрої</legend>
    {devices.cameras.length > 0 && <label>Камера<select value={cameraId} disabled={disabled} onChange={event => onCamera(event.target.value)}><option value="">Стандартна камера</option>{devices.cameras.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}</select></label>}
    {devices.microphones.length > 0 && <label>Мікрофон<select value={microphoneId} disabled={disabled} onChange={event => onMicrophone(event.target.value)}><option value="">Стандартний мікрофон</option>{devices.microphones.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}</select></label>}
    {outputSelectionSupported && devices.speakers.length > 0 && <label>Динаміки<select value={speakerId} disabled={disabled} onChange={event => onSpeaker(event.target.value)}><option value="">Стандартні динаміки</option>{devices.speakers.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}</select></label>}
    {!devices.cameras.length && !devices.microphones.length && <p className="meet-muted">Увімкніть камеру або мікрофон, щоб браузер показав доступні пристрої.</p>}
  </fieldset>;
}
