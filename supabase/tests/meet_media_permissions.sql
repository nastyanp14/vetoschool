\set ON_ERROR_STOP on
-- Runs only inside scripts/test-meet-db.py's disposable PostgreSQL cluster.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.meet_save('Live room','','10000000-0000-0000-0000-000000000002','group',now(),45,
 ARRAY['00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007']::uuid[]) AS live \gset
SELECT public.meet_transition(:'live',1,'active');

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT public.test_assert(public.meet_join(:'live','30000000-0000-0000-0000-000000000002',true,true)->>'role'='teacher','media teacher joins');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
SELECT public.test_assert(public.meet_join(:'live','30000000-0000-0000-0000-000000000004',true,true)->>'role'='student','media first student joins');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
SELECT public.meet_join(:'live','30000000-0000-0000-0000-000000000005',true,true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
SELECT public.meet_join(:'live','30000000-0000-0000-0000-000000000006',false,true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
SELECT public.meet_join(:'live','30000000-0000-0000-0000-000000000007',false,false);
SELECT public.test_assert((SELECT count(*)=5 FROM public.conference_connections WHERE conference_id=:'live' AND observer_only=false AND left_at IS NULL),'media limit has teacher and four students');

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.test_assert(public.meet_join(:'live','30000000-0000-0000-0000-000000000001',true,true)->>'observerOnly'='true','admin joins observer-only');
SELECT public.test_assert((SELECT count(*)=5 FROM public.conference_connections WHERE conference_id=:'live' AND observer_only=false AND left_at IS NULL),'admin does not take sixth media seat');
SELECT public.test_denied(format('SELECT public.meet_signal(%L,%L,%L,%L,%L::jsonb)',:'live','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','offer','{"description":{"type":"offer","sdp":"x"}}'),'MEET_DENIED','observer cannot send WebRTC signalling');

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
SELECT public.meet_join(:'live','40000000-0000-0000-0000-000000000004',true,false);
SELECT public.test_assert((SELECT count(*)=1 AND bool_and(connection_id='40000000-0000-0000-0000-000000000004') FROM public.conference_connections WHERE conference_id=:'live' AND user_id=auth.uid()),'second tab replaces first without extra seat');
SELECT public.test_denied(format('SELECT public.meet_heartbeat(%L,%L,true,true,false,false)',:'live','30000000-0000-0000-0000-000000000004'),'MEET_SESSION','replaced tab loses session');
SELECT public.meet_heartbeat(:'live','40000000-0000-0000-0000-000000000004',true,false,true,false);
SELECT public.meet_join(:'live','40000000-0000-0000-0000-000000000004',true,false);
SELECT public.test_assert((SELECT hand_raised FROM public.conference_connections WHERE conference_id=:'live' AND user_id=auth.uid()),'same-session reconnect preserves raised hand');
SELECT public.meet_signal(:'live','40000000-0000-0000-0000-000000000004',NULL,'chat','{"text":"Привіт <b>all</b>","forged":"ignored"}'::jsonb);
SELECT public.test_assert((SELECT sender_user_id=auth.uid() AND payload='{"text":"Привіт <b>all</b>"}'::jsonb FROM public.conference_signals WHERE conference_id=:'live' AND event_type='chat' ORDER BY id DESC LIMIT 1),'server binds sender and normalizes chat payload');
SELECT public.test_denied(format('SELECT public.meet_signal(%L,%L,%L,%L,%L::jsonb)',:'live','40000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','offer','{"description":{}}'),'MEET_TARGET','media cannot target observer');
SELECT public.test_denied(format('SELECT public.meet_control(%L,%L,%L,%L)',:'live','40000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','mute'),'MEET_DENIED','student cannot moderate');
SELECT public.test_denied($q$INSERT INTO public.conference_signals(conference_id,sender_user_id,sender_connection_id,event_type) VALUES(gen_random_uuid(),auth.uid(),gen_random_uuid(),'chat')$q$,'permission denied','direct forged signal denied');

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000008',false);
SELECT public.test_denied(format('SELECT public.meet_join(%L,%L,false,false)',:'live','30000000-0000-0000-0000-000000000008'),'MEET_DENIED','unassigned student cannot join');
SELECT public.test_assert((SELECT count(*)=0 FROM public.conference_connections WHERE conference_id=:'live'),'outsider cannot inspect live roster');

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT public.meet_control(:'live','30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000005','mute');
SELECT public.test_assert((SELECT microphone_enabled=false FROM public.conference_connections WHERE conference_id=:'live' AND user_id='00000000-0000-0000-0000-000000000005'),'teacher mute is server enforced');
SELECT public.meet_control(:'live','30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000006','kick');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
SELECT public.test_denied(format('SELECT public.meet_join(%L,%L,false,false)',:'live','40000000-0000-0000-0000-000000000006'),'MEET_BLOCKED','kicked student cannot rejoin');

RESET ROLE;
UPDATE public.conference_connections SET last_seen_at=clock_timestamp()-interval '1 minute'
 WHERE conference_id=:'live' AND user_id='00000000-0000-0000-0000-000000000002';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT public.test_denied(format('SELECT public.meet_roster(%L,%L)',:'live','30000000-0000-0000-0000-000000000002'),'MEET_SESSION','stale session cannot read roster');
SELECT public.test_denied(format('SELECT public.meet_control(%L,%L,%L,%L)',:'live','30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000005','mute'),'MEET_SESSION','stale manager cannot moderate');
SELECT public.meet_transition(:'live',2,'completed');
RESET ROLE;
SELECT public.test_assert((SELECT count(*)=0 FROM public.conference_signals WHERE conference_id=:'live'),'terminal room deletes ephemeral signals');
SELECT public.test_assert((SELECT bool_and(left_at IS NOT NULL) FROM public.conference_connections WHERE conference_id=:'live'),'terminal room closes connections');
