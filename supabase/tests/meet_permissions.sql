\set ON_ERROR_STOP on
-- Run after bootstrap and Meet migration, ONLY in the throwaway test database.
INSERT INTO public.profiles SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid, 'Test '||i FROM generate_series(1,9) i;
INSERT INTO public.user_roles SELECT id,CASE WHEN name='Test 1' THEN 'admin' WHEN name IN ('Test 2','Test 3') THEN 'teacher' ELSE 'student' END FROM public.profiles;
INSERT INTO public.teachers VALUES
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Anna','','active'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','Kate','','active');
INSERT INTO public.teacher_students SELECT '10000000-0000-0000-0000-000000000002',id FROM public.profiles WHERE name IN ('Test 4','Test 5','Test 6','Test 7');
CREATE FUNCTION public.test_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION public.test_denied(query text,expected text,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE query; EXCEPTION WHEN OTHERS THEN
 IF SQLERRM LIKE '%'||expected||'%' THEN RAISE NOTICE 'PASS: %',label; RETURN; END IF;
 RAISE; END;
 RAISE EXCEPTION 'FAIL: % allowed',label;
END $$;
GRANT EXECUTE ON FUNCTION public.test_assert(boolean,text),public.test_denied(text,text,text) TO authenticated,anon;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.meet_save('English — My Home','','10000000-0000-0000-0000-000000000002','group','2026-10-15 13:00Z',45,
 ARRAY['00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007']::uuid[]) AS conference \gset
SELECT room_id AS room,code AS code FROM public.video_conferences WHERE id=:'conference' \gset
SELECT public.test_assert((SELECT count(*)=4 FROM public.conference_participants),'1 admin creates four participants');
SELECT public.test_assert(jsonb_array_length(public.meet_list())=1,'1 admin sees conference');
SELECT public.meet_save('English — My Home','','10000000-0000-0000-0000-000000000002','group','2026-10-15 14:00Z',45,
 ARRAY['00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007']::uuid[], :'conference',1);
SELECT public.test_assert((SELECT room_id=:'room' AND version=2 AND scheduled_at='2026-10-15 14:00Z' FROM public.video_conferences WHERE id=:'conference'),'3 reschedule keeps room and increments version');
SELECT public.test_denied(format('SELECT public.meet_transition(%L,1,%L)',:'conference','active'),'MEET_CONFLICT','stale writer rejected');
SELECT public.test_denied(format('SELECT public.meet_save(%L,%L,%L,%L,now(),45,%L)', 'Five','','10000000-0000-0000-0000-000000000002','group','{00000000-0000-0000-0000-000000000004,00000000-0000-0000-0000-000000000005,00000000-0000-0000-0000-000000000006,00000000-0000-0000-0000-000000000007,00000000-0000-0000-0000-000000000008}'),'MEET_LIMIT','8 fifth student rejected');
SELECT public.test_assert(jsonb_array_length(public.meet_list())=1,'failed creation leaves no conference');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT public.test_assert(jsonb_array_length(public.meet_list())=1,'1 assigned teacher sees conference');
SELECT public.meet_save('Teacher lesson','','10000000-0000-0000-0000-000000000002','individual','2026-10-16 13:00Z',30,ARRAY['00000000-0000-0000-0000-000000000004']::uuid[]) AS teacher_conference \gset
SELECT public.test_assert(jsonb_array_length(public.meet_list())=2,'2 teacher creates own conference');
SELECT public.test_denied($q$SELECT public.meet_save('Forbidden','','10000000-0000-0000-0000-000000000003','individual',now(),30,ARRAY['00000000-0000-0000-0000-000000000004']::uuid[])$q$,'MEET_DENIED','teacher cannot impersonate');
SELECT public.test_denied($q$SELECT public.meet_save('Forbidden','','10000000-0000-0000-0000-000000000002','individual',now(),30,ARRAY['00000000-0000-0000-0000-000000000008']::uuid[])$q$,'MEET_STUDENT','teacher cannot assign unassigned student');
SELECT public.meet_transition(:'teacher_conference',1,'cancelled');
SELECT public.test_assert((SELECT status='cancelled' FROM public.video_conferences WHERE id=:'teacher_conference'),'4 teacher cancels and retains history');
SELECT public.meet_transition(:'conference',2,'active');
SELECT public.test_assert((SELECT status='active' AND started_at IS NOT NULL FROM public.video_conferences WHERE id=:'conference'),'9 teacher starts');
SELECT public.test_denied(format('SELECT public.meet_save(%L,%L,%L,%L,now(),45,%L,%L,3)','Locked','','10000000-0000-0000-0000-000000000002','group','{00000000-0000-0000-0000-000000000004}',:'conference'),'MEET_LOCKED','active editing rejected');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
SELECT public.test_assert(jsonb_array_length(public.meet_list())=0,'other teacher cannot read');
SELECT public.test_denied(format('SELECT public.meet_transition(%L,3,%L)',:'conference','completed'),'MEET_DENIED','7 other teacher cannot mutate');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
SELECT public.test_assert(jsonb_array_length(public.meet_list())=2,'1 and 2 assigned student sees both');
SELECT public.test_assert((public.meet_list(:'room')->0->>'status')='active','9 student sees active status by room');
SELECT public.test_assert((public.meet_list(:'code')->0->>'id')=:'conference','code lookup checks membership');
SELECT public.test_assert((SELECT count(*)=2 AND bool_and(user_id=auth.uid()) FROM public.conference_participants),'student cannot see peers');
SELECT public.test_assert((SELECT count(*)=0 FROM public.conference_events),'student cannot see audit');
SELECT public.test_assert(public.meet_people()->'students'='[]','student cannot query directory');
SELECT public.test_denied($q$SELECT public.meet_save('Forbidden','','10000000-0000-0000-0000-000000000002','individual',now(),30,ARRAY['00000000-0000-0000-0000-000000000004']::uuid[])$q$,'MEET_DENIED','6 student RPC creation denied');
SELECT public.test_denied('INSERT INTO public.video_conferences(title) VALUES (''Forbidden'')','permission denied','6 direct insert denied');
SELECT public.test_denied('UPDATE public.video_conferences SET status=''active''','permission denied','student direct update denied');
SELECT public.test_denied('DELETE FROM public.conference_participants','permission denied','student participant mutation denied');
SELECT public.test_denied(format('SELECT public.meet_transition(%L,3,%L)',:'conference','completed'),'MEET_DENIED','student status RPC denied');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000008',false);
SELECT public.test_assert(jsonb_array_length(public.meet_list(:'room'))=0 AND jsonb_array_length(public.meet_list(:'code'))=0,'5 room and code do not grant access');
SELECT public.test_assert((SELECT count(*)=0 FROM public.video_conferences),'5 direct SELECT protected by RLS');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT public.meet_transition(:'conference',3,'completed');
SELECT public.test_assert((SELECT status='completed' AND ended_at>=started_at FROM public.video_conferences WHERE id=:'conference'),'10 completed with timestamps');
SELECT public.test_denied(format('SELECT public.meet_transition(%L,4,%L)',:'conference','active'),'MEET_LOCKED','completed cannot restart');
SELECT public.test_denied(format('SELECT public.meet_transition(%L,2,%L)',:'teacher_conference','active'),'MEET_LOCKED','cancelled cannot restart');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
SELECT public.test_assert((public.meet_list()->0->>'status')='completed','10 completion visible to participant');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
SELECT public.test_assert(jsonb_array_length(public.meet_list())=1,'1 third student sees assignment');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
SELECT public.test_assert(jsonb_array_length(public.meet_list())=1,'1 fourth student sees assignment');
SET ROLE anon;
SELECT public.test_denied('SELECT public.meet_list()','permission denied','anonymous RPC denied');
RESET ROLE;
SELECT public.test_assert((SELECT bool_and(payload='{}'::jsonb AND private) FROM realtime.messages),'broadcast has no personal data');
SELECT public.test_assert((SELECT count(DISTINCT topic)=6 FROM realtime.messages),'broadcast targets admin teacher and four students');
