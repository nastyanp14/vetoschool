# Vetoschool Meet — implementation notes, 13.10.2026

## Current status

The existing conference management layer remains the source of truth: `video_conferences`, `conference_participants`, `conference_events`, `meet_save`, `meet_transition`, `meet_list`, and `meet_people` are reused unchanged.

The media client is implemented in the existing `/classroom/:roomId` route. It uses browser WebRTC mesh for audio/video and short-lived Supabase Realtime Postgres-change events for signalling. Supabase never transports media.

`20261013153000_vetoschool_meet_media.sql` was explicitly approved and applied to the linked production Supabase on 13.10.2026 as one isolated transaction, then recorded in the Supabase migration journal. Read-only catalog checks confirmed both tables with RLS, both SELECT policies, six authenticated-only RPCs, safe table privileges, empty initial media state, and `conference_signals` in the `supabase_realtime` publication.

Frontend commit `272c999` was pushed to GitHub `main` and the Cloudflare build completed successfully. Production serves `index-Dc9wUsvt.js`; `/` and `/classroom/:roomId` return HTTP 200, both completion-screen stickers return HTTP 200, classroom deep links remain `noindex`, and unauthenticated access redirects to login. No production Supabase change was required for the video-quality upgrade.

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

Camera capture now uses compatible `ideal` constraints up to 1920×1080 at 30 fps, with an ideal 16:9 aspect ratio that does not force cropping on cameras with another native ratio. The local preview reuses that same high-quality capture, while every network sender starts at HD 1280×720 / 30 fps and is scaled by `RTCRtpSender.setParameters()` without reopening the camera.

Every peer connection is sampled with `getStats()` every five seconds. Packet loss, RTT, available outgoing bitrate, the browser's quality-limitation reason, real send/receive resolution, FPS, bitrate, and negotiated codec feed a hysteresis-controlled quality ladder: 1080p, 720p, 540p, and 360p. Poor conditions lower quality quickly; recovery requires three healthy samples and a cooldown to avoid oscillation. Full HD is attempted only for calls with at most two remote peers; larger mesh calls remain capped at HD and divide a bounded total upload budget across connections. A student's stream receives a larger share toward the teacher. Audio remains outside the video ceiling and therefore retains congestion-control priority.

Screen share requests up to 1920×1080 / 30 fps, uses the browser's `detail` content hint and `maintain-resolution` degradation preference where supported, and adapts from approximately 750 kbps to 4 Mbps. WebKit-safe fallbacks retry bitrate/FPS tuning if Safari rejects optional sender hints. Camera video also uses the `detail` hint, is rendered without filters or forced aspect-ratio cropping, mirrors only the local tile, and keeps remote video unmirrored.

Codec selection remains standards-based browser negotiation instead of a forced codec that could break Safari/Chrome interoperability. The technical panel exposes the actually negotiated codec. Audio keeps echo cancellation, noise suppression, and automatic gain control. Default ICE servers are Cloudflare and Google STUN. Optional TURN/STUN configuration can be supplied through `VITE_MEET_ICE_SERVERS` as an `RTCIceServer[]` JSON value; no paid TURN service or secret is included.

Teacher/admin settings include a collapsed developer diagnostic panel. Students do not see it. It reports capture resolution plus per-peer send/receive resolution, FPS, bitrate, packet loss, RTT, available outbound bandwidth, negotiated codec, connection state, active quality tier, and browser quality limitation.

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
- Full Vitest: 46 files, 260 tests passed, including HD/FHD constraints, sender bitrate tuning, WebKit fallbacks, mesh sender setup, screen-share restoration, and the existing signalling lifecycle.
- Disposable PostgreSQL suite: pass, including existing management/RLS/concurrency cases plus media seats, observer admin, duplicate tab, sender binding, outsider denial, mute, kick, blocked rejoin, and terminal cleanup.
- In-app browser: narrow responsive prejoin inspected at 419×736 with no horizontal overflow; the redesigned completion screen was inspected at mobile and 1440×900 desktop sizes with both supplied transparent stickers loaded correctly.
- Production: Cloudflare build succeeded; the deployed bundle contains the 1080p constraints, adaptive quality tiers, developer diagnostics, and completion assets. The authenticated completed lesson `dddd` was visually verified in Safari with the real 91-minute / 1-student summary.

The browser preview and production bundle checks are not a real multi-user media test. Five simultaneous real camera/microphone streams, Safari/iPhone autoplay/device behavior, screen sharing, chat/moderation between authenticated accounts, network loss, and restrictive-NAT behavior remain manual acceptance items on separate browsers/devices.

## Relevant files

- `src/pages/Classroom.tsx`
- `src/components/meet/LiveClassroom.tsx`
- `src/hooks/useMeetCall.ts`
- `src/lib/meetMedia.ts`
- `src/components/meet/meet.css`
- `supabase/migrations/20261013153000_vetoschool_meet_media.sql`
- `supabase/tests/meet_media_permissions.sql`
- `scripts/test-meet-db.py`
