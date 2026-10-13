-- Meet uses the existing profiles, teachers, role helpers and schedules.
BEGIN;
CREATE TABLE public.video_conferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1500),
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  conference_type text NOT NULL CHECK (conference_type IN ('individual','group')),
  scheduled_at timestamptz NOT NULL CHECK (isfinite(scheduled_at)),
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','completed','cancelled')),
  room_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL,
  started_at timestamptz,
  ended_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status <> 'active' OR (started_at IS NOT NULL AND ended_at IS NULL)) AND
    (status <> 'completed' OR (started_at IS NOT NULL AND ended_at >= started_at)))
);
CREATE TABLE public.conference_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES public.video_conferences(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conference_id, user_id)
);
CREATE TABLE public.conference_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES public.video_conferences(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.video_conferences(teacher_id, scheduled_at);
CREATE INDEX ON public.video_conferences(scheduled_at, id);
CREATE INDEX ON public.conference_participants(user_id, conference_id);
CREATE INDEX ON public.conference_events(conference_id, created_at);
ALTER TABLE public.video_conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conference_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conference_events ENABLE ROW LEVEL SECURITY;
-- Writes only via transactional RPC. No client can bypass the lock/validation/audit.
REVOKE ALL ON public.video_conferences, public.conference_participants, public.conference_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.video_conferences, public.conference_participants, public.conference_events TO authenticated;

CREATE FUNCTION private.meet_manager(_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND (private.is_admin(auth.uid()) OR EXISTS (
 SELECT 1 FROM public.video_conferences c JOIN public.teachers t ON t.id=c.teacher_id
 WHERE c.id=_id AND t.teacher_user_id=auth.uid() AND t.status='active' AND private.is_teacher(auth.uid())))
$$;
CREATE FUNCTION private.meet_visible(_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT private.meet_manager(_id) OR EXISTS (SELECT 1 FROM public.conference_participants p
 WHERE p.conference_id=_id AND p.user_id=auth.uid())
$$;
REVOKE ALL ON FUNCTION private.meet_manager(uuid), private.meet_visible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.meet_manager(uuid), private.meet_visible(uuid) TO authenticated;
CREATE POLICY meet_read ON public.video_conferences FOR SELECT TO authenticated USING (private.meet_visible(id));
CREATE POLICY meet_participants_read ON public.conference_participants FOR SELECT TO authenticated
 USING (private.meet_manager(conference_id) OR user_id=auth.uid());
CREATE POLICY meet_events_read ON public.conference_events FOR SELECT TO authenticated USING (private.meet_manager(conference_id));

-- Lock the parent even for privileged direct participant inserts. Serializes capacity checks.
CREATE FUNCTION private.meet_participant_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.video_conferences;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.conference_id<>OLD.conference_id OR NEW.user_id<>OLD.user_id) THEN
   RAISE EXCEPTION 'MEET_PARTICIPANT_IMMUTABLE';
 END IF;
 SELECT * INTO c FROM public.video_conferences WHERE id=NEW.conference_id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=NEW.user_id AND role::text='student')
 OR EXISTS (SELECT 1 FROM public.teachers WHERE id=c.teacher_id AND teacher_user_id=NEW.user_id) THEN
   RAISE EXCEPTION 'MEET_STUDENT';
 END IF;
 IF (SELECT count(*) FROM public.conference_participants WHERE conference_id=c.id AND id<>NEW.id)
 >= (CASE WHEN c.conference_type='individual' THEN 1 ELSE 4 END) THEN RAISE EXCEPTION 'MEET_LIMIT'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.meet_participant_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER meet_participant_guard BEFORE INSERT OR UPDATE ON public.conference_participants
 FOR EACH ROW EXECUTE FUNCTION private.meet_participant_guard();

-- Personal invalidation contains no names, room IDs or lesson data; includes removed users.
CREATE FUNCTION private.meet_notify(_users uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid;
BEGIN
 FOR u IN SELECT DISTINCT x FROM (
   SELECT unnest(_users) x UNION SELECT user_id FROM public.user_roles WHERE role::text='admin'
 ) recipients WHERE x IS NOT NULL LOOP
   PERFORM realtime.send('{}'::jsonb, 'changed', 'meet:' || u::text, true);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.meet_notify(uuid[]) FROM PUBLIC, anon, authenticated;
CREATE POLICY meet_personal_updates ON realtime.messages FOR SELECT TO authenticated
 USING (extension='broadcast' AND (SELECT realtime.topic())='meet:' || (SELECT auth.uid())::text);

CREATE FUNCTION public.meet_save(
 _title text, _description text, _teacher_id uuid, _type text, _scheduled_at timestamptz,
 _duration integer, _students uuid[], _id uuid DEFAULT NULL, _version integer DEFAULT NULL,
 _schedule_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.video_conferences; t public.teachers; old_students uuid[] := '{}'; recipients uuid[] := '{}';
 admin boolean; result_id uuid; student uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'MEET_AUTH'; END IF;
 admin := private.is_admin(auth.uid());
 IF NOT admin AND NOT private.is_teacher(auth.uid()) THEN RAISE EXCEPTION 'MEET_DENIED'; END IF;
 IF _id IS NOT NULL THEN
   SELECT * INTO c FROM public.video_conferences WHERE id=_id FOR UPDATE;
   IF NOT FOUND OR NOT private.meet_manager(_id) THEN RAISE EXCEPTION 'MEET_DENIED'; END IF;
   IF _version IS DISTINCT FROM c.version THEN RAISE EXCEPTION 'MEET_CONFLICT'; END IF;
   IF c.status <> 'scheduled' THEN RAISE EXCEPTION 'MEET_LOCKED'; END IF;
   SELECT coalesce(array_agg(user_id), '{}') INTO old_students FROM public.conference_participants WHERE conference_id=_id;
   SELECT ARRAY[teacher_user_id] INTO recipients FROM public.teachers WHERE id=c.teacher_id;
 END IF;
 SELECT * INTO t FROM public.teachers WHERE id=_teacher_id AND status='active' AND teacher_user_id IS NOT NULL;
 IF NOT FOUND OR NOT private.is_teacher(t.teacher_user_id) THEN RAISE EXCEPTION 'MEET_TEACHER'; END IF;
 IF NOT admin AND t.teacher_user_id<>auth.uid() THEN RAISE EXCEPTION 'MEET_DENIED'; END IF;
 IF _title IS NULL OR length(btrim(_title)) NOT BETWEEN 1 AND 120 OR _description IS NULL OR length(_description)>1500
 OR _type IS NULL OR _type NOT IN ('individual','group') OR _scheduled_at IS NULL OR NOT isfinite(_scheduled_at)
 OR _duration IS NULL OR _duration NOT BETWEEN 1 AND 1440 THEN RAISE EXCEPTION 'MEET_INPUT'; END IF;
 IF _students IS NULL OR cardinality(_students)<1 THEN RAISE EXCEPTION 'MEET_STUDENT'; END IF;
 IF cardinality(_students)>(CASE WHEN _type='individual' THEN 1 ELSE 4 END)
 OR cardinality(_students)<>(SELECT count(DISTINCT s) FROM unnest(_students) s) THEN RAISE EXCEPTION 'MEET_LIMIT'; END IF;
 FOREACH student IN ARRAY _students LOOP
   IF student IS NULL OR student=t.teacher_user_id OR NOT EXISTS (
     SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
     WHERE p.id=student AND r.role::text='student'
   ) OR (NOT admin AND NOT private.teacher_can_access_student(auth.uid(), student)) THEN
     RAISE EXCEPTION 'MEET_STUDENT';
   END IF;
 END LOOP;
 IF _schedule_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.schedules s WHERE s.id=_schedule_id AND s.teacher_id=t.id
   AND NOT EXISTS (SELECT 1 FROM unnest(_students) chosen WHERE NOT (
     chosen IS NOT DISTINCT FROM s.user_id OR EXISTS (SELECT 1 FROM public.student_group_members gm WHERE gm.group_id=s.group_id AND gm.user_id=chosen)))
 ) THEN RAISE EXCEPTION 'MEET_SCHEDULE'; END IF;
 IF _id IS NULL THEN
   -- Unique constraints guard collisions; no client-controlled room or creator.
   INSERT INTO public.video_conferences(title,description,teacher_id,created_by,conference_type,scheduled_at,duration_minutes,schedule_id)
   VALUES(btrim(_title),btrim(_description),t.id,auth.uid(),_type,_scheduled_at,_duration,_schedule_id) RETURNING id INTO result_id;
 ELSE
   result_id := _id;
   -- Remove first so changing group -> individual remains valid throughout the transaction.
   DELETE FROM public.conference_participants WHERE conference_id=_id AND NOT(user_id=ANY(_students));
   UPDATE public.video_conferences SET title=btrim(_title),description=btrim(_description),teacher_id=t.id,
    conference_type=_type,scheduled_at=_scheduled_at,duration_minutes=_duration,schedule_id=_schedule_id,
    version=version+1,updated_at=clock_timestamp() WHERE id=_id;
 END IF;
 INSERT INTO public.conference_participants(conference_id,user_id)
 SELECT result_id,s FROM unnest(_students) s WHERE NOT EXISTS (
 SELECT 1 FROM public.conference_participants p WHERE p.conference_id=result_id AND p.user_id=s);
 INSERT INTO public.conference_events(conference_id,actor_id,event_type,metadata)
 VALUES(result_id,auth.uid(),CASE WHEN _id IS NULL THEN 'created' ELSE 'updated' END,'{}');
 IF _id IS NOT NULL AND c.scheduled_at IS DISTINCT FROM _scheduled_at THEN
 INSERT INTO public.conference_events(conference_id,actor_id,event_type,metadata)
 VALUES(result_id,auth.uid(),'rescheduled',jsonb_build_object('from',c.scheduled_at,'to',_scheduled_at)); END IF;
 INSERT INTO public.conference_events(conference_id,actor_id,event_type,metadata)
 SELECT result_id,auth.uid(),'participant_added',jsonb_build_object('user_id',s) FROM unnest(_students) s WHERE NOT(s=ANY(old_students));
 INSERT INTO public.conference_events(conference_id,actor_id,event_type,metadata)
 SELECT result_id,auth.uid(),'participant_removed',jsonb_build_object('user_id',s) FROM unnest(old_students) s WHERE NOT(s=ANY(_students));
 PERFORM private.meet_notify(recipients || ARRAY[t.teacher_user_id] || old_students || _students);
 RETURN result_id;
END $$;

CREATE FUNCTION public.meet_transition(_id uuid, _version integer, _status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.video_conferences; recipients uuid[];
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'MEET_AUTH'; END IF;
 SELECT * INTO c FROM public.video_conferences WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR NOT private.meet_manager(_id) THEN RAISE EXCEPTION 'MEET_DENIED'; END IF;
 IF _version IS DISTINCT FROM c.version THEN RAISE EXCEPTION 'MEET_CONFLICT'; END IF;
 IF _status IS NULL OR NOT ((c.status='scheduled' AND _status IN ('active','cancelled'))
 OR (c.status='active' AND _status IN ('completed','cancelled'))) THEN RAISE EXCEPTION 'MEET_LOCKED'; END IF;
 UPDATE public.video_conferences SET status=_status,version=version+1,updated_at=clock_timestamp(),
 started_at=CASE WHEN _status='active' THEN clock_timestamp() ELSE started_at END,
 ended_at=CASE WHEN _status IN ('completed','cancelled') THEN clock_timestamp() ELSE ended_at END WHERE id=_id;
 INSERT INTO public.conference_events(conference_id,actor_id,event_type) VALUES(_id,auth.uid(),_status);
 SELECT array_agg(user_id) INTO recipients FROM public.conference_participants WHERE conference_id=_id;
 PERFORM private.meet_notify(recipients || ARRAY(SELECT teacher_user_id FROM public.teachers WHERE id=c.teacher_id));
END $$;

-- Keep existing teacher deletion working, retaining lesson history and cancelling open rooms.
CREATE FUNCTION private.meet_teacher_removed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE recipients uuid[];
BEGIN
 NEW.version := OLD.version+1;
 NEW.updated_at := clock_timestamp();
 IF OLD.status IN ('scheduled','active') THEN
   NEW.status := 'cancelled'; NEW.ended_at := clock_timestamp();
 END IF;
 INSERT INTO public.conference_events(conference_id,actor_id,event_type)
 VALUES(OLD.id,(SELECT id FROM public.profiles WHERE id=auth.uid()),'teacher_removed');
 SELECT array_agg(user_id) INTO recipients FROM public.conference_participants WHERE conference_id=OLD.id;
 PERFORM private.meet_notify(recipients);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.meet_teacher_removed() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER meet_teacher_removed BEFORE UPDATE OF teacher_id ON public.video_conferences
 FOR EACH ROW WHEN (OLD.teacher_id IS NOT NULL AND NEW.teacher_id IS NULL)
 EXECUTE FUNCTION private.meet_teacher_removed();

-- Explicit safe projection: students never receive peer identities or teacher private fields.
CREATE FUNCTION public.meet_list(_room text DEFAULT NULL, _offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(jsonb_agg(item ORDER BY scheduled_at,id),'[]'::jsonb) FROM (
 SELECT c.scheduled_at,c.id,jsonb_build_object(
 'id',c.id,'title',c.title,'description',c.description,'teacherId',coalesce(c.teacher_id::text,''),
 'teacherName',coalesce(nullif(concat_ws(' ',t.first_name,t.last_name),''),'—'),'type',c.conference_type,
 'scheduledAt',c.scheduled_at,'duration',c.duration_minutes,'status',c.status,'roomId',c.room_id,
 'code',c.code,'version',c.version,'scheduleId',c.schedule_id,'startedAt',c.started_at,'endedAt',c.ended_at,
 'studentNames',CASE WHEN private.meet_manager(c.id) THEN
 (SELECT coalesce(jsonb_object_agg(p.user_id,pr.name),'{}') FROM public.conference_participants p JOIN public.profiles pr ON pr.id=p.user_id WHERE p.conference_id=c.id)
 ELSE '{}'::jsonb END,
 'studentIds',CASE WHEN private.meet_manager(c.id) THEN
 (SELECT coalesce(jsonb_agg(p.user_id),'[]') FROM public.conference_participants p WHERE p.conference_id=c.id)
 ELSE '[]'::jsonb END) item
 FROM public.video_conferences c LEFT JOIN public.teachers t ON t.id=c.teacher_id
 WHERE auth.uid() IS NOT NULL AND private.meet_visible(c.id)
 AND (_room IS NULL OR c.room_id::text=_room OR c.code=upper(_room))
 ORDER BY c.scheduled_at,c.id LIMIT 100 OFFSET greatest(0,coalesce(_offset,0))
 ) rows
$$;
CREATE FUNCTION public.meet_people() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT jsonb_build_object('teachers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',concat_ws(' ',first_name,last_name)))
 FROM public.teachers WHERE status='active' AND teacher_user_id IS NOT NULL AND private.is_teacher(teacher_user_id)
 AND (private.is_admin(auth.uid()) OR (private.is_teacher(auth.uid()) AND teacher_user_id=auth.uid()))),'[]'),
 'students',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)) FROM public.profiles p
 WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role::text='student')
 AND (private.is_admin(auth.uid()) OR (private.is_teacher(auth.uid()) AND private.teacher_can_access_student(auth.uid(),p.id)))),'[]'))
$$;
REVOKE ALL ON FUNCTION public.meet_save(text,text,uuid,text,timestamptz,integer,uuid[],uuid,integer,uuid),
 public.meet_transition(uuid,integer,text), public.meet_list(text,integer), public.meet_people() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meet_save(text,text,uuid,text,timestamptz,integer,uuid[],uuid,integer,uuid),
 public.meet_transition(uuid,integer,text), public.meet_list(text,integer), public.meet_people() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
