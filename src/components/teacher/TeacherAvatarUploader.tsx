import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { Lang } from '@/lib/i18n';
import { clearTeacherAvatar, TeacherRecord, uploadTeacherAvatar, validateTeacherAvatar } from '@/lib/teachers';
import { teacherDisplayName } from '@/lib/teacherUi';
import { TeacherAvatar } from './TeacherAvatar';

const labels = {
  ru: {
    title: 'Фотография',
    choose: 'Выбрать фото',
    save: 'Сохранить фото',
    remove: 'Удалить фото',
    uploading: 'Загружаем...',
    saved: 'Фотография обновлена',
    removed: 'Фотография удалена',
  },
  ua: {
    title: 'Фотографія',
    choose: 'Вибрати фото',
    save: 'Зберегти фото',
    remove: 'Видалити фото',
    uploading: 'Завантажуємо...',
    saved: 'Фотографію оновлено',
    removed: 'Фотографію видалено',
  },
  en: {
    title: 'Photo',
    choose: 'Choose photo',
    save: 'Save photo',
    remove: 'Remove photo',
    uploading: 'Uploading...',
    saved: 'Photo updated',
    removed: 'Photo removed',
  },
};

export function TeacherAvatarUploader({
  teacher,
  lang,
  onSaved,
}: {
  teacher: TeacherRecord;
  lang: Lang;
  onSaved: (message: string) => Promise<void> | void;
}) {
  const copy = labels[lang];
  const name = teacherDisplayName(teacher, lang);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const visibleSrc = useMemo(() => preview || teacher.avatarUrl, [preview, teacher.avatarUrl]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] || null;
    setError('');
    if (!next) return;
    try {
      validateTeacherAvatar(next);
      setFile(next);
    } catch (err) {
      setFile(null);
      setError(err instanceof Error ? err.message : 'Invalid file');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await uploadTeacherAvatar(teacher.id, file, teacher.avatarUrl);
      setFile(null);
      await onSaved(copy.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError('');
    try {
      await clearTeacherAvatar(teacher.id, teacher.avatarUrl);
      setFile(null);
      await onSaved(copy.removed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-purple-100 bg-white/65 p-5 shadow-sm dark-panel-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <TeacherAvatar src={visibleSrc} name={name} size="xl" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-black text-purple-700">{copy.title}</h3>
          {error && <p className="mt-2 font-body text-sm font-700 text-red-500">{error}</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label className="btn-outline inline-flex cursor-pointer items-center justify-center gap-2 px-5 py-2.5 text-sm">
              <ImagePlus className="h-4 w-4" />
              {copy.choose}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleFile} />
            </label>
            <button type="button" disabled={!file || busy} onClick={handleUpload} className="btn-magic inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">
              <Upload className="h-4 w-4" />
              {busy ? copy.uploading : copy.save}
            </button>
            {(teacher.avatarUrl || preview) && (
              <button type="button" disabled={busy} onClick={handleRemove} className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-pink-200 bg-white/75 px-5 py-2.5 font-display text-sm font-bold text-pink-500 transition hover:bg-pink-50 disabled:opacity-60">
                <Trash2 className="h-4 w-4" />
                {copy.remove}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
