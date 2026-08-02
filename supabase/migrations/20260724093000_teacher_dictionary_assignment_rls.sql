-- Teacher dictionary assignment safety: teachers may update/delete only rows assigned to their own students.

create index if not exists idx_dictionary_words_user_word
on public.dictionary_words(user_id, lower(word), lower(translation), lower(category), lower(lesson));

drop policy if exists dict_teacher_insert on public.dictionary_words;
drop policy if exists dict_teacher_update on public.dictionary_words;
drop policy if exists dict_teacher_delete on public.dictionary_words;

create policy dict_teacher_insert
on public.dictionary_words
for insert
to authenticated
with check (private.teacher_can_access_student(auth.uid(), user_id));

create policy dict_teacher_update
on public.dictionary_words
for update
to authenticated
using (private.teacher_can_access_student(auth.uid(), user_id))
with check (private.teacher_can_access_student(auth.uid(), user_id));

create policy dict_teacher_delete
on public.dictionary_words
for delete
to authenticated
using (private.teacher_can_access_student(auth.uid(), user_id));

notify pgrst, 'reload schema';
