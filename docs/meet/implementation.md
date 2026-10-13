# Vetoschool Meet — implementation notes, 13.10.2026

## Current status

The existing conference management layer remains the source of truth: `video_conferences`, `conference_participants`, `conference_events`, `meet_save`, `meet_transition`, `meet_list`, and `meet_people` are reused unchanged.

The media client is implemented in the existing `/classroom/:roomId` route. It uses browser WebRTC mesh for audio/video and short-lived Supabase Realtime Postgres-change events for signalling. Supabase never transports media.

`20261013153000_vetoschool_meet_media.sql` is a new, separate migration. It has passed the disposable PostgreSQL permission/concurrency suite but has **not** been applied to production. Do not publish the frontend before this migration is explicitly approved and applied; otherwise joining a real room will fail safely because the new RPCs do not exist.

## Browser flow

- Protected route and `meet_list` verify Auth, room membership, conference status, and safe projection.
- Active rooms open a prejoin screen without requesting camera or microphone automatically.
- Users may enable either device, select available input/output devices, or join in presence-only mode.
- Calls show up to five media participants, local mirrored video, remote unmirrored video, mute/camera/hand state, active-speaker highlighting, chat, roster, and responsive panels.
- The teacher can share a real display track, mute a student, request unmute, kick a student for the current conference, and complete the room through `meet_transition`.
- Admins enter an observer-only control mode. They do not create a sixth peer/media connection.
- Completed rooms render the dedicated completion screen.

## WebRTC

`useMeetCall` owns one `RTCPeerConnection` per remote media participant. It implements deterministic polite peers (perfect-negotiation collision handling), queued early ICE candidates, bounded ICE restart, sender track replacement, reconnect on online/focus, duplicate-session replacement, and complete peer/track/channel cleanup.

Default video constraints are 640×360, up to 24 fps, approximately 550 kbps. Screen share targets up to 15 fps and approximately 1.5 Mbps for readable text. Audio keeps echo cancellation, noise suppression, and automatic gain control. Default ICE servers are Cloudflare and Google STUN. Optional TURN/STUN configuration can be supplied through `VITE_MEET_ICE_SERVERS` as an `RTCIceServer[]` JSON value; no paid TURN service or secret is included.

Without TURN, calls cannot be guaranteed on restrictive corporate/mobile NATs. The UI reports a connection failure instead of claiming a false connected state.

## Signalling and security

The additional schema contains only:

- `conference_connections`: one server-controlled active session per `(conference,user)`, heartbeat, device state, observer flag, and current-room kick block.
- `conference_signals`: short-lived, RLS-protected offers, answers, ICE candidates, chat, moderation control, and roster invalidations.

All writes are RPC-only. `meet_join`, `meet_heartbeat`, `meet_roster`, `meet_signal`, `meet_control`, and `meet_leave` bind the actor to `auth.uid()` on the server. Clients cannot choose the sender identity. SDP/ICE is target-addressed and readable only by a currently connected authorized target. Chat payloads are normalized to a bounded text string; React renders them as text, not HTML.

Room-row locking serializes joins. A second tab replaces the first session for the same user. Media seats are counted from fresh, non-observer server sessions; the teacher plus four assigned students is the maximum. An admin remains observer-only. Kicked students cannot rejoin that conference. Terminal status closes sessions and deletes ephemeral signals.

## Validation completed

- Targeted ESLint: pass.
- Vite production build: pass (existing large-chunk warning remains).
- Full Vitest: 45 files, 254 tests passed.
- Disposable PostgreSQL suite: pass, including existing management/RLS/concurrency cases plus media seats, observer admin, duplicate tab, sender binding, outsider denial, mute, kick, blocked rejoin, and terminal cleanup.
- In-app browser: narrow responsive prejoin inspected at 419×736 with no horizontal overflow.

The browser preview is a visual check only. The database suite validates authorization and state transitions, not WebRTC media. A real multi-user test still requires the migration in a non-production Supabase environment and separate authenticated browsers/devices. Five simultaneous real camera/microphone streams, Safari/iPhone autoplay/device behavior, screen sharing, network loss, and restrictive-NAT behavior remain manual acceptance items.

## Relevant files

- `src/pages/Classroom.tsx`
- `src/components/meet/LiveClassroom.tsx`
- `src/hooks/useMeetCall.ts`
- `src/lib/meetMedia.ts`
- `src/components/meet/meet.css`
- `supabase/migrations/20261013153000_vetoschool_meet_media.sql`
- `supabase/tests/meet_media_permissions.sql`
- `scripts/test-meet-db.py`
