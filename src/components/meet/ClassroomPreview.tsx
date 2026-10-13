import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Camera, Hand, MessageCircle, Mic, MicOff, MonitorUp, PhoneOff, Send, Users, VideoOff, X } from 'lucide-react';
import type { Lang } from '@/lib/i18n';
import { meetCopy } from './copy';
import './meet.css';

// Stage 1: local interface state only. Never requests devices, joins a room or sends messages.
export default function ClassroomPreview({ lang, title = 'English — My Home', onExit }: { lang: Lang; title?: string; onExit: () => void }) {
  const c = meetCopy[lang];
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [camera, setCamera] = useState(false);
  const [mic, setMic] = useState(false);
  const [hand, setHand] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [chat, setChat] = useState(false);
  const [active, setActive] = useState('Anna');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<{ id: number; name: string; text: string; time: string }[]>([]);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }); }, [messages, chat]);
  const studentName = name.trim() || c.guest;
  const participants = ['Anna', 'Sophie', 'Max', 'Oliver', 'self'];
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setMessages(current => [...current, { id: Date.now(), name: studentName, text: draft.trim(), time: new Date().toLocaleTimeString(lang === 'ua' ? 'uk-UA' : lang, { hour: '2-digit', minute: '2-digit' }) }]);
    setDraft('');
  };
  const toggles = <>
    <button type="button" className="meet-control" aria-pressed={mic} aria-label={`${c.mic}: ${mic ? c.on : c.off}`} onClick={() => setMic(!mic)}>{mic ? <Mic /> : <MicOff />}<span>{c.mic}</span></button>
    <button type="button" className="meet-control" aria-pressed={camera} aria-label={`${c.camera}: ${camera ? c.on : c.off}`} onClick={() => setCamera(!camera)}>{camera ? <Camera /> : <VideoOff />}<span>{c.camera}</span></button>
  </>;

  return <section className="meet-room">
    <header className="meet-room-header">
      <button type="button" className="meet-back" onClick={onExit}><ArrowLeft size={18} />{c.back}</button>
      <span className="meet-wordmark">Vetoschool <span>Meet</span></span>
    </header>
    <p className="meet-demo-note"><strong>{c.demo}.</strong> {c.demoHint}</p>
    {!joined ? <div className="meet-prejoin">
      <div><div className="meet-camera-preview"><div className="meet-person-circle">{studentName[0].toUpperCase()}</div><h3>{c.preview}</h3><p>{camera ? c.previewHint : `${c.camera}: ${c.off}`}</p><span className="meet-preview-badge">{c.demo}</span></div><div className="meet-prejoin-controls">{toggles}</div></div>
      <form className="meet-join-form" onSubmit={event => { event.preventDefault(); setJoined(true); }}>
        <p className="meet-eyebrow">{c.prejoin}</p><h1>{title}</h1><p className="meet-muted">{c.prejoinHint}</p>
        <label>{c.name}<input autoComplete="given-name" value={name} onChange={event => setName(event.target.value)} maxLength={40} placeholder={c.guest} /></label>
        <fieldset><legend>{c.devices}</legend><label>{c.camera}<select disabled><option>{c.defaultDevice}</option></select></label><label>{c.mic}<select disabled><option>{c.defaultDevice}</option></select></label></fieldset>
        <button className="meet-button meet-primary" type="submit"><Camera size={20} />{c.join}</button>
      </form>
    </div> : <>
      <div className="meet-call-title"><h1>{title}</h1><span><Users size={17} />5 / 5 · {c.participants}</span></div>
      <div className={`meet-call-layout ${chat ? 'meet-chat-open' : ''}`}>
        <div className="meet-call-main">
          {sharing && <div className="meet-screen-placeholder" role="status"><MonitorUp size={40} /><h3>{c.screenDemo}</h3><p>{c.screenHint}</p></div>}
          <div className="meet-video-grid">
            {participants.map((person, index) => <button type="button" key={person} aria-pressed={active === person} onClick={() => setActive(person)} className={`meet-video-tile meet-tile-${index} ${active === person ? 'meet-active-tile' : ''}`}>
              <span className="meet-person-circle">{person === 'self' ? studentName[0].toUpperCase() : person[0]}</span>
              <span className="meet-tile-name">{person === 'self' ? `${studentName} (${c.you})` : person}{index === 0 && <small>{c.teacher}</small>}</span>
              <span className="meet-tile-mic">{person === 'self' && mic ? <Mic size={17} /> : <MicOff size={17} />}</span>
              {person === 'self' && hand && <Hand className="meet-raised-hand" />}
              {person === 'self' && camera && <span className="meet-tile-camera"><Camera size={16} />{c.demo}</span>}
            </button>)}
          </div>
        </div>
        {chat && <aside className="meet-chat" aria-label={c.chat}>
          <div className="meet-chat-heading"><h2>{c.chat}</h2><button className="meet-icon-button" type="button" onClick={() => setChat(false)} aria-label={c.close}><X size={20} /></button></div>
          <p className="meet-chat-hint">{c.chatHint}</p>
          <div className="meet-messages" role="log" aria-live="polite"><div className="meet-message"><div><strong>Anna</strong><time>16:00</time></div><p>{c.welcome}</p></div>
            {messages.map(message => <div className="meet-message meet-message-self" key={message.id}><div><strong>{message.name}</strong><time>{message.time}</time></div><p>{message.text}</p></div>)}<div ref={chatEnd} />
          </div>
          <form className="meet-chat-form" onSubmit={send}><input aria-label={c.message} placeholder={c.message} maxLength={1000} value={draft} onChange={event => setDraft(event.target.value)} /><button className="meet-icon-button" type="submit" disabled={!draft.trim()} aria-label={c.send}><Send size={20} /></button></form>
        </aside>}
      </div>
      <footer className="meet-controls">{toggles}
        <button type="button" className="meet-control" aria-pressed={sharing} onClick={() => setSharing(!sharing)}><MonitorUp /><span>{c.share}</span></button>
        <button type="button" className="meet-control" aria-expanded={chat} onClick={() => setChat(!chat)}><MessageCircle /><span>{c.chat}</span></button>
        <button type="button" className="meet-control" aria-pressed={hand} onClick={() => setHand(!hand)}><Hand /><span>{hand ? c.lowerHand : c.hand}</span></button>
        <button type="button" className="meet-control meet-leave" onClick={onExit}><PhoneOff /><span>{c.leave}</span></button>
      </footer>
    </>}
  </section>;
}
