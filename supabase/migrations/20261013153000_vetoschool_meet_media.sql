-- Secure WebRTC signalling and live-seat reservations for Vetoschool Meet.
-- Media never passes through Supabase: only short-lived signalling and room state do.
BEGIN;

CREATE TABLE public.conference_connections (
  conference_id uuid NOT NULL REFERENCES public.video_conferences(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  participant_role text NOT NULL CHECK (participant_role IN ('teacher','student','admin')),
  observer_only boolean NOT NULL DEFAULT false,
  camera_enabled boolean NOT NULL DEFAULT false,
  microphone_enabled boolean NOT NULL DEFAULT false,
  hand_raised boolean NOT NULL DEFAULT false,
  sharing_screen boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  left_at timestamptz,
  blocked_at timestamptz,
  PRIMARY KEY (conference_id, user_id),
  UNIQUE (conference_id, connection_id)
);

CREATE TABLE public.conference_signals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conference_id uuid NOT NULL REFERENCES public.video_conferences(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_connection_id uuid NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('offer','answer','ice','chat','control','roster')),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (jsonb_typeof(payload)='object' AND pg_column_size(payload) <= 65536)
);

CREATE INDEX conference_connections_live_idx
  ON public.conference_connections(conference_id, last_seen_at DESC) WHERE left_at IS NULL;
CREATE INDEX conference_signals_room_idx ON public.conference_signals(conference_id, id);
CREATE INDEX conference_signals_expiry_idx ON public.conference_signals(created_at);

ALTER TABLE public.conference_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conference_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conference_connections, public.conference_signals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.conference_connections, public.conference_signals TO authenticated;

CREATE FUNCTION private.meet_connected(_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.conference_connections x
   JOIN public.video_conferences c ON c.id=x.conference_id
   WHERE x.conference_id=_id AND x.user_id=auth.uid() AND x.left_at IS NULL
     AND x.blocked_at IS NULL AND x.last_seen_at > clock_timestamp()-interval '45 seconds'
     AND c.status='active'
 )
$$;
REVOKE ALL ON FUNCTION private.meet_connected(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.meet_connected(uuid) TO authenticated;

CREATE POLICY meet_live_connections_read ON public.conference_connections FOR SELECT TO authenticated
 USING (private.meet_connected(conference_id));
CREATE POLICY meet_live_signals_read ON public.conference_signals FOR SELECT TO authenticated
 USING ((private.meet_connected(conference_id) OR
   (event_type='control' AND target_user_id=auth.uid() AND private.meet_visible(conference_id)))
   AND (target_user_id IS NULL OR target_user_id=auth.uid()));

CREATE FUNCTION private.meet_roster_json(_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'userId',x.user_id,'connectionId',x.connection_id,'name',x.display_name,'role',x.participant_role,
   'observerOnly',x.observer_only,'camera',x.camera_enabled,'microphone',x.microphone_enabled,
   'handRaised',x.hand_raised,'sharingScreen',x.sharing_screen,'joinedAt',x.joined_at
 ) ORDER BY CASE x.participant_role WHEN 'teacher' THEN 0 WHEN 'student' THEN 1 ELSE 2 END,x.joined_at),'[]'::jsonb)
 FROM public.conference_connections x
 WHERE x.conference_id=_id AND x.left_at IS NULL AND x.blocked_at IS NULL
   AND x.last_seen_at > clock_timestamp()-interval '45 seconds'
$$;
REVOKE ALL ON FUNCTION private.meet_roster_json(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.meet_emit_roster(_id uuid, _actor uuid, _connection uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
 INSERT INTO public.conference_signals(conference_id,sender_user_id,sender_connection_id,event_type,payload)
 VALUES(_id,_actor,_connection,'roster','{}')
$$;
REVOKE ALL ON FUNCTION private.meet_emit_roster(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.meet_join(
  _id uuid, _connection_id uuid, _camera boolean DEFAULT false, _microphone boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.video_conferences; existing public.conference_connections; role_name text;
 observer boolean := false; person_name text; active_count integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'MEET_AUTH'; END IF;
 IF _connection_id IS NULL THEN RAISE EXCEPTION 'MEET_INPUT'; END IF;
 SELECT * INTO c FROM public.video_conferences WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR NOT private.meet_visible(_id) THEN RAISE EXCEPTION 'MEET_DENIED'; END IF;
 IF c.status<>'active' THEN RAISE EXCEPTION 'MEET_INACTIVE'; END IF;

 IF EXISTS (SELECT 1 FROM public.teachers t WHERE t.id=c.teacher_id AND t.teacher_user_id=auth.uid()
   AND t.status='active' AND private.is_teacher(auth.uid())) THEN role_name := 'teacher';
 ELSIF EXISTS (SELECT 1 FROM public.conference_participants p WHERE p.conference_id=_id AND p.user_id=auth.uid()) THEN role_name := 'student';
 ELSIF private.is_admin(auth.uid()) THEN role_name := 'admin'; observer := true;
 ELSE RAISE EXCEPTION 'MEET_DENIED'; END IF;

 SELECT * INTO existing FROM public.conference_connections WHERE conference_id=_id AND user_id=auth.uid() FOR UPDATE;
 IF FOUND AND existing.blocked_at IS NOT NULL THEN RAISE EXCEPTION 'MEET_BLOCKED'; END IF;
 UPDATE public.conference_connections SET left_at=coalesce(left_at,clock_timestamp())
   WHERE conference_id=_id AND left_at IS NULL AND last_seen_at <= clock_timestamp()-interval '45 seconds';
 SELECT count(*) INTO active_count FROM public.conference_connections
   WHERE conference_id=_id AND user_id<>auth.uid() AND observer_only=false AND left_at IS NULL
     AND blocked_at IS NULL AND last_seen_at > clock_timestamp()-interval '45 seconds';
 IF NOT observer AND active_count>=5 THEN RAISE EXCEPTION 'MEET_CAPACITY'; END IF;

 SELECT coalesce(nullif(btrim(name),''),'Учасник') INTO person_name FROM public.profiles WHERE id=auth.uid();
 IF role_name='admin' THEN person_name := 'Адміністратор'; END IF;
 IF FOUND AND existing.left_at IS NULL AND existing.connection_id<>_connection_id THEN
   INSERT INTO public.conference_signals(conference_id,sender_user_id,sender_connection_id,target_user_id,event_type,payload)
   VALUES(_id,auth.uid(),existing.connection_id,auth.uid(),'control',jsonb_build_object('action','session_replaced','connectionId',existing.connection_id));
 END IF;

 INSERT INTO public.conference_connections(conference_id,user_id,connection_id,display_name,participant_role,
   observer_only,camera_enabled,microphone_enabled,joined_at,last_seen_at,left_at)
 VALUES(_id,auth.uid(),_connection_id,left(person_name,80),role_name,observer,
   CASE WHEN observer THEN false ELSE coalesce(_camera,false) END,
   CASE WHEN observer THEN false ELSE coalesce(_microphone,false) END,clock_timestamp(),clock_timestamp(),NULL)
 ON CONFLICT(conference_id,user_id) DO UPDATE SET connection_id=EXCLUDED.connection_id,
   display_name=EXCLUDED.display_name,participant_role=EXCLUDED.participant_role,observer_only=EXCLUDED.observer_only,
   camera_enabled=EXCLUDED.camera_enabled,microphone_enabled=EXCLUDED.microphone_enabled,
   hand_raised=CASE WHEN public.conference_connections.connection_id=EXCLUDED.connection_id THEN public.conference_connections.hand_raised ELSE false END,
   sharing_screen=CASE WHEN public.conference_connections.connection_id=EXCLUDED.connection_id THEN public.conference_connections.sharing_screen ELSE false END,
   joined_at=CASE WHEN public.conference_connections.connection_id=EXCLUDED.connection_id THEN public.conference_connections.joined_at ELSE clock_timestamp() END,
   last_seen_at=clock_timestamp(),left_at=NULL;
 PERFORM private.meet_emit_roster(_id,auth.uid(),_connection_id);
 DELETE FROM public.conference_signals WHERE created_at < clock_timestamp()-interval '10 minutes';
 RETURN jsonb_build_object('role',role_name,'observerOnly',observer,'participants',private.meet_roster_json(_id));
END $$;

CREATE FUNCTION public.meet_heartbeat(
 _id uuid, _connection_id uuid, _camera boolean, _microphone boolean, _hand boolean, _sharing boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_row public.conference_connections; changed boolean;
BEGIN
 SELECT * INTO old_row FROM public.conference_connections
   WHERE conference_id=_id AND user_id=auth.uid() AND connection_id=_connection_id FOR UPDATE;
 IF NOT FOUND OR old_row.left_at IS NOT NULL OR old_row.blocked_at IS NOT NULL THEN RAISE EXCEPTION 'MEET_SESSION'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.video_conferences WHERE id=_id AND status='active') THEN RAISE EXCEPTION 'MEET_INACTIVE'; END IF;
 changed := old_row.camera_enabled IS DISTINCT FROM (coalesce(_camera,false) AND NOT old_row.observer_only)
   OR old_row.microphone_enabled IS DISTINCT FROM (coalesce(_microphone,false) AND NOT old_row.observer_only)
   OR old_row.hand_raised IS DISTINCT FROM coalesce(_hand,false)
   OR old_row.sharing_screen IS DISTINCT FROM (coalesce(_sharing,false) AND old_row.participant_role='teacher');
 UPDATE public.conference_connections SET camera_enabled=coalesce(_camera,false) AND NOT observer_only,
   microphone_enabled=coalesce(_microphone,false) AND NOT observer_only,hand_raised=coalesce(_hand,false),
   sharing_screen=coalesce(_sharing,false) AND participant_role='teacher',last_seen_at=clock_timestamp()
   WHERE conference_id=_id AND user_id=auth.uid() AND connection_id=_connection_id;
 UPDATE public.conference_connections SET left_at=coalesce(left_at,clock_timestamp())
   WHERE conference_id=_id AND left_at IS NULL AND last_seen_at <= clock_timestamp()-interval '45 seconds';
 IF changed THEN PERFORM private.meet_emit_roster(_id,auth.uid(),_connection_id); END IF;
 RETURN private.meet_roster_json(_id);
END $$;

CREATE FUNCTION public.meet_roster(_id uuid, _connection_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.conference_connections x JOIN public.video_conferences c ON c.id=x.conference_id
   WHERE x.conference_id=_id AND x.user_id=auth.uid() AND x.connection_id=_connection_id
   AND x.left_at IS NULL AND x.blocked_at IS NULL
   AND x.last_seen_at > clock_timestamp()-interval '45 seconds' AND c.status='active') THEN RAISE EXCEPTION 'MEET_SESSION'; END IF;
 RETURN private.meet_roster_json(_id);
END $$;

CREATE FUNCTION public.meet_signal(
 _id uuid, _connection_id uuid, _target uuid, _event text, _payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE clean_payload jsonb;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.conference_connections x JOIN public.video_conferences c ON c.id=x.conference_id
   WHERE x.conference_id=_id AND x.user_id=auth.uid() AND x.connection_id=_connection_id
   AND x.left_at IS NULL AND x.blocked_at IS NULL AND x.last_seen_at > clock_timestamp()-interval '45 seconds'
   AND c.status='active') THEN RAISE EXCEPTION 'MEET_SESSION'; END IF;
 IF _event NOT IN ('offer','answer','ice','chat') OR jsonb_typeof(_payload)<>'object' OR pg_column_size(_payload)>65536 THEN RAISE EXCEPTION 'MEET_SIGNAL'; END IF;
 IF _event IN ('offer','answer','ice') THEN
   IF EXISTS (SELECT 1 FROM public.conference_connections WHERE conference_id=_id AND user_id=auth.uid()
     AND connection_id=_connection_id AND observer_only=true) THEN RAISE EXCEPTION 'MEET_DENIED'; END IF;
   IF _target IS NULL OR _target=auth.uid() OR NOT EXISTS (SELECT 1 FROM public.conference_connections
     WHERE conference_id=_id AND user_id=_target AND observer_only=false AND left_at IS NULL AND blocked_at IS NULL
       AND last_seen_at > clock_timestamp()-interval '45 seconds') THEN RAISE EXCEPTION 'MEET_TARGET'; END IF;
   clean_payload := _payload;
 ELSE
   IF _target IS NOT NULL OR jsonb_typeof(_payload->'text')<>'string'
      OR length(_payload->>'text') NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'MEET_SIGNAL'; END IF;
   clean_payload := jsonb_build_object('text',_payload->>'text');
 END IF;
 INSERT INTO public.conference_signals(conference_id,sender_user_id,sender_connection_id,target_user_id,event_type,payload)
 VALUES(_id,auth.uid(),_connection_id,_target,_event,clean_payload);
END $$;

CREATE FUNCTION public.meet_control(
 _id uuid, _connection_id uuid, _target uuid, _action text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF _action NOT IN ('mute','request_unmute','kick') OR NOT private.meet_manager(_id) THEN RAISE EXCEPTION 'MEET_DENIED'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.conference_connections x JOIN public.video_conferences c ON c.id=x.conference_id
   WHERE x.conference_id=_id AND x.user_id=auth.uid() AND x.connection_id=_connection_id
   AND x.left_at IS NULL AND x.blocked_at IS NULL
   AND x.last_seen_at > clock_timestamp()-interval '45 seconds' AND c.status='active') THEN RAISE EXCEPTION 'MEET_SESSION'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.conference_connections WHERE conference_id=_id AND user_id=_target
   AND participant_role='student' AND left_at IS NULL AND blocked_at IS NULL
   AND last_seen_at > clock_timestamp()-interval '45 seconds') THEN RAISE EXCEPTION 'MEET_TARGET'; END IF;
 IF _action='mute' THEN
   UPDATE public.conference_connections SET microphone_enabled=false WHERE conference_id=_id AND user_id=_target;
 ELSIF _action='kick' THEN
   UPDATE public.conference_connections SET blocked_at=clock_timestamp(),left_at=clock_timestamp(),camera_enabled=false,
     microphone_enabled=false,hand_raised=false,sharing_screen=false WHERE conference_id=_id AND user_id=_target;
 END IF;
 INSERT INTO public.conference_signals(conference_id,sender_user_id,sender_connection_id,target_user_id,event_type,payload)
 VALUES(_id,auth.uid(),_connection_id,_target,'control',jsonb_build_object('action',_action));
 PERFORM private.meet_emit_roster(_id,auth.uid(),_connection_id);
 INSERT INTO public.conference_events(conference_id,actor_id,event_type,metadata)
 VALUES(_id,auth.uid(),'participant_'||_action,jsonb_build_object('user_id',_target));
END $$;

CREATE FUNCTION public.meet_leave(_id uuid, _connection_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 UPDATE public.conference_connections SET left_at=clock_timestamp(),camera_enabled=false,microphone_enabled=false,
   hand_raised=false,sharing_screen=false WHERE conference_id=_id AND user_id=auth.uid()
   AND connection_id=_connection_id AND left_at IS NULL;
 IF FOUND THEN PERFORM private.meet_emit_roster(_id,auth.uid(),_connection_id); END IF;
END $$;

CREATE FUNCTION private.meet_terminal_cleanup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.status IN ('completed','cancelled') AND OLD.status IS DISTINCT FROM NEW.status THEN
   UPDATE public.conference_connections SET left_at=coalesce(left_at,clock_timestamp()),camera_enabled=false,
     microphone_enabled=false,hand_raised=false,sharing_screen=false WHERE conference_id=NEW.id;
   DELETE FROM public.conference_signals WHERE conference_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.meet_terminal_cleanup() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER meet_terminal_cleanup AFTER UPDATE OF status ON public.video_conferences
 FOR EACH ROW EXECUTE FUNCTION private.meet_terminal_cleanup();

REVOKE ALL ON FUNCTION public.meet_join(uuid,uuid,boolean,boolean), public.meet_heartbeat(uuid,uuid,boolean,boolean,boolean,boolean),
 public.meet_roster(uuid,uuid), public.meet_signal(uuid,uuid,uuid,text,jsonb), public.meet_control(uuid,uuid,uuid,text),
 public.meet_leave(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meet_join(uuid,uuid,boolean,boolean), public.meet_heartbeat(uuid,uuid,boolean,boolean,boolean,boolean),
 public.meet_roster(uuid,uuid), public.meet_signal(uuid,uuid,uuid,text,jsonb), public.meet_control(uuid,uuid,uuid,text),
 public.meet_leave(uuid,uuid) TO authenticated;

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
 AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='conference_signals') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.conference_signals;
 END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
