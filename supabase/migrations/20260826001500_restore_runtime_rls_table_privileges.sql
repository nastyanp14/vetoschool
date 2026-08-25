-- Restore base table privileges after the new Supabase migration.
-- RLS remains the access boundary: these grants only let PostgREST reach the
-- existing admin/teacher/student policies instead of failing at table privilege.

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

DO $$
DECLARE
  table_name text;
  authenticated_all text[] := ARRAY[
    'user_roles',
    'teachers',
    'teacher_students',
    'student_groups',
    'student_group_members',
    'content_items',
    'schedules',
    'grades',
    'dictionary_words',
    'workbooks',
    'units',
    'lessons',
    'interactive_tasks',
    'workbook_assignments',
    'lesson_live_sessions',
    'lesson_live_events',
    'lesson_plan_blocks',
    'lesson_results',
    'lesson_attendance',
    'teacher_student_notes',
    'teacher_notifications',
    'lesson_change_requests'
  ];
  authenticated_select_update text[] := ARRAY[
    'trial_bookings'
  ];
  authenticated_select_insert text[] := ARRAY[
    'admin_access_overrides',
    'manual_access_overrides'
  ];
  authenticated_select text[] := ARRAY[
    'stripe_payments',
    'stripe_payment_failures',
    'stripe_refunds',
    'admin_lesson_adjustments',
    'notification_log',
    'email_notifications',
    'telegram_parent_accounts',
    'student_parent_links',
    'telegram_notifications'
  ];
  service_runtime text[] := ARRAY[
    'profiles',
    'user_roles',
    'teachers',
    'teacher_students',
    'student_groups',
    'student_group_members',
    'content_items',
    'schedules',
    'grades',
    'dictionary_words',
    'workbooks',
    'units',
    'lessons',
    'interactive_tasks',
    'workbook_assignments',
    'lesson_live_sessions',
    'lesson_live_events',
    'lesson_plan_blocks',
    'lesson_results',
    'lesson_attendance',
    'teacher_student_notes',
    'teacher_notifications',
    'lesson_change_requests',
    'trial_bookings',
    'trial_booking_rate_limits',
    'telegram_notifications',
    'telegram_parent_accounts',
    'telegram_link_tokens',
    'student_parent_links',
    'notification_log',
    'transactional_emails',
    'email_send_log',
    'email_send_state',
    'email_unsubscribe_tokens',
    'suppressed_emails',
    'email_notifications',
    'stripe_payments',
    'stripe_payment_failures',
    'stripe_refunds',
    'stripe_webhook_events',
    'admin_lesson_adjustments',
    'admin_access_overrides',
    'manual_access_overrides',
    'avatar_purchases'
  ];
BEGIN
  GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

  FOREACH table_name IN ARRAY authenticated_all LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY authenticated_select_update LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, UPDATE ON public.%I TO authenticated', table_name);
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY authenticated_select_insert LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT ON public.%I TO authenticated', table_name);
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY authenticated_select LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', table_name);
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY service_runtime LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', table_name);
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_trial_bookings_updated_at() FROM PUBLIC, anon, authenticated;
