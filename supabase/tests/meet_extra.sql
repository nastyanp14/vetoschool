\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.meet_save('Membership','','10000000-0000-0000-0000-000000000002','group',now(),45,ARRAY['00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005']::uuid[]) AS c \gset
SELECT public.meet_save('Membership','','10000000-0000-0000-0000-000000000003','individual',now(),45,ARRAY['00000000-0000-0000-0000-000000000005']::uuid[],:'c',1);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.video_conferences WHERE id=:'c'),'removed student loses direct access');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.video_conferences WHERE id=:'c'),'old teacher loses access after reassignment');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
SELECT public.test_assert(EXISTS(SELECT 1 FROM public.video_conferences WHERE id=:'c'),'new teacher gains access');
SELECT set_config('realtime.topic','meet:00000000-0000-0000-0000-000000000003',false);
SELECT public.test_assert(EXISTS(SELECT 1 FROM realtime.messages WHERE topic='meet:00000000-0000-0000-0000-000000000003'),'own realtime channel allowed');
SELECT set_config('realtime.topic','meet:00000000-0000-0000-0000-000000000002',false);
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM realtime.messages),'other realtime channel denied');
RESET ROLE;
SELECT public.test_assert(EXISTS(SELECT 1 FROM realtime.messages WHERE topic='meet:00000000-0000-0000-0000-000000000004'),'removed student receives invalidation');
INSERT INTO public.schedules VALUES('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004',NULL);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.meet_save('Linked','','10000000-0000-0000-0000-000000000002','individual',now(),45,ARRAY['00000000-0000-0000-0000-000000000004']::uuid[],NULL,NULL,'20000000-0000-0000-0000-000000000001') AS linked \gset
SELECT public.test_assert((SELECT schedule_id='20000000-0000-0000-0000-000000000001' FROM public.video_conferences WHERE id=:'linked'),'existing schedule link preserved');
SELECT public.test_denied($q$SELECT public.meet_save('Bad link','','10000000-0000-0000-0000-000000000003','individual',now(),45,ARRAY['00000000-0000-0000-0000-000000000004']::uuid[],NULL,NULL,'20000000-0000-0000-0000-000000000001')$q$,'MEET_SCHEDULE','wrong schedule teacher denied');
SELECT public.meet_transition(:'linked',1,'active');
SELECT public.test_assert((SELECT status='active' FROM public.video_conferences WHERE id=:'linked'),'admin can start');
SELECT public.meet_transition(:'linked',2,'completed');
SELECT public.test_assert((SELECT status='completed' FROM public.video_conferences WHERE id=:'linked'),'admin can end');
RESET ROLE;

CREATE FUNCTION public.test_fail_participant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test_insertion_failure'; END $$;
CREATE TRIGGER test_fail_participant AFTER INSERT ON public.conference_participants FOR EACH ROW EXECUTE FUNCTION public.test_fail_participant();
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.test_denied($q$SELECT public.meet_save('Rollback test','','10000000-0000-0000-0000-000000000002','individual',now(),45,ARRAY['00000000-0000-0000-0000-000000000004']::uuid[])$q$,'test_insertion_failure','insert failure propagated');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.video_conferences WHERE title='Rollback test'),'participant insert failure rolls back parent');
RESET ROLE;
DROP TRIGGER test_fail_participant ON public.conference_participants;
DROP FUNCTION public.test_fail_participant();

-- A disposable teacher without external schedule/assignment dependencies.
INSERT INTO public.user_roles VALUES('00000000-0000-0000-0000-000000000009','teacher');
INSERT INTO public.teachers VALUES('10000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000009','Temporary','','active');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.meet_save('Deleted teacher','','10000000-0000-0000-0000-000000000009','individual',now(),45,ARRAY['00000000-0000-0000-0000-000000000004']::uuid[]) AS deleted_teacher \gset
RESET ROLE;
DELETE FROM public.teachers WHERE id='10000000-0000-0000-0000-000000000009';
SELECT public.test_assert((SELECT status='cancelled' AND teacher_id IS NULL FROM public.video_conferences WHERE id=:'deleted_teacher'),'teacher deletion preserves and cancels conference');
SET ROLE authenticated;
SELECT public.test_assert(EXISTS(SELECT 1 FROM jsonb_array_elements(public.meet_list()) x WHERE x->>'id'=:'deleted_teacher'),'deleted teacher history visible to admin');
RESET ROLE;
