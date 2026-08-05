
REVOKE EXECUTE ON FUNCTION public.cleanup_lesson_block_content_items() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_content_items_for_lesson_plan_block() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_content_items_for_schedule() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_star_economy_self_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_teacher_restricted_self_update() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.clear_star_celebration() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_star_celebration() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.purchase_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_avatar(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.equip_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_avatar(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.avatar_cost(text) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_assigned_interactive_content(uuid, uuid, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_assigned_interactive_content(uuid, uuid, integer, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_interactive_tasks_for_lesson(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_interactive_tasks_for_lesson(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_student_content_items(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_content_items(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_visible_live_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visible_live_sessions() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.repair_student_interactive_completion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_student_interactive_completion(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teacher_start_lesson(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teacher_start_lesson(uuid) TO authenticated;

-- Pre-login OTP expiry check must stay callable by visitors (returns only a boolean).
REVOKE EXECUTE ON FUNCTION public.email_otp_is_expired(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_otp_is_expired(text, integer) TO anon, authenticated;
