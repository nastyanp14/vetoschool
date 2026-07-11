import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Download, Headphones, Image, Languages, Lightbulb, Loader2, MessageSquareQuote, Play, Plus, RefreshCw, Save, Sparkles, Table2, Trash2, Type, Upload, Volume2, Wand2 } from 'lucide-react';
import type { InteractiveTask } from '../lib/workbooks';
import { uploadWorkbookAsset } from '../lib/workbooks';
import {
  createTheoryBlock, createTheoryTemplate, emptyTheoryContent, theoryId,
  TheoryAudioBlock, TheoryBlock, TheoryContent, TheoryExamplesBlock, TheoryGrammarBlock, TheoryImageBlock, TheoryRuleBlock, TheoryTemplate, TheoryTextBlock, TheoryVocabularyBlock,
} from '../lib/theory';
import { toast } from 'sonner';
import {
  DEFAULT_ELEVENLABS_MODEL_ID, DEFAULT_ELEVENLABS_VOICE_ID, deleteCardAudio,
  generateCardAudio, signedLessonAudioUrl,
} from '../lib/cardAudio';

const emojiChoices = ['🌸','🌈','⭐','❤️','🍎','🍓','🍊','🍋','🥕','🐶','🐱','🐰','🦋','🌻','☀️','🌙','☁️','🏠','🚗','✈️','📚','✏️','🎨','🎵','🔢','🔤','😊','😢','😴','🖐️','👀','👂','👄','👩‍🏫','👦','👧'];

const inputClass = 'w-full rounded-2xl border border-pink-100 bg-white px-4 py-3 font-body text-sm font-bold text-purple-700 outline-none transition placeholder:text-purple-200 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/60 dark:border-purple-700 dark:bg-[#241331] dark:text-purple-100';
const tinyButton = 'inline-flex items-center justify-center rounded-xl border border-purple-100 bg-white p-2 text-purple-400 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500 disabled:opacity-30 dark:border-purple-700 dark:bg-[#241331]';

function BlockToolbar({ index, total, onMove, onDelete }: { index: number; total: number; onMove: (to: number) => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={tinyButton} disabled={index === 0} onClick={() => onMove(index - 1)} title="Выше"><ArrowUp className="h-4 w-4" /></button>
      <button type="button" className={tinyButton} disabled={index === total - 1} onClick={() => onMove(index + 1)} title="Ниже"><ArrowDown className="h-4 w-4" /></button>
      <button type="button" className={`${tinyButton} hover:text-red-500`} onClick={onDelete} title="Удалить блок"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function TextEditor({ block, onChange }: { block: TheoryTextBlock; onChange: (b: TheoryTextBlock) => void }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_190px]">
        <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder="Заголовок блока" />
        <select className={inputClass} value={block.style} onChange={e => onChange({ ...block, style: e.target.value as TheoryTextBlock['style'] })}>
          <option value="paragraph">Обычный текст</option>
          <option value="numbered">Нумерованный список</option>
          <option value="bulleted">Список</option>
          <option value="rule">Важное правило</option>
        </select>
      </div>
      <textarea className={`${inputClass} min-h-32 resize-y leading-7`} value={block.body} onChange={e => onChange({ ...block, body: e.target.value })}
        placeholder={block.style === 'paragraph' || block.style === 'rule' ? 'Напишите красивое объяснение…' : 'Каждый пункт пишите с новой строки'} />
    </div>
  );
}

function VocabularyAudioUpload({ audio, onUploaded }: { audio?: string; onUploaded: (path: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const path = await uploadWorkbookAsset(file);
    setUploading(false);
    if (!path) return toast.error('Не удалось загрузить произношение');
    onUploaded(path);
    toast.success('Произношение добавлено');
  };

  return (
    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-purple-100 bg-white px-3 py-2 text-xs font-black text-purple-500 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500 dark:border-purple-700 dark:bg-[#241331] dark:text-purple-200">
      {uploading ? <Sparkles className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
      {uploading ? 'Загрузка…' : audio ? 'Заменить произношение' : 'Добавить произношение'}
      <input type="file" accept="audio/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
    </label>
  );
}

function GeneratedAudioControls({ lessonId, cardId, text, audioUrl, voiceId, modelId, onChanged }: {
  lessonId?: string;
  cardId: string;
  text: string;
  audioUrl?: string;
  voiceId: string;
  modelId: string;
  onChanged: (audioUrl?: string) => void;
}) {
  const [busy, setBusy] = useState<'generate' | 'delete' | 'download' | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!audioUrl) {
      setPlayUrl(null);
      return;
    }
    signedLessonAudioUrl(audioUrl).then(url => { if (alive) setPlayUrl(url); });
    return () => { alive = false; };
  }, [audioUrl]);

  const generate = async () => {
    if (!lessonId) return toast.error('Сначала сохраните теоретический урок');
    if (!text.trim()) return toast.error('Сначала заполните английский текст карточки');
    if (!voiceId.trim()) return toast.error('Укажите Voice ID ElevenLabs');
    setBusy('generate');
    try {
      const result = await generateCardAudio({
        card_id: cardId,
        lesson_id: lessonId,
        text: text.trim(),
        voice_id: voiceId.trim(),
        model_id: modelId.trim() || DEFAULT_ELEVENLABS_MODEL_ID,
      });
      onChanged(result.audio_url);
      toast.success(audioUrl ? 'Аудио перегенерировано' : 'Аудио сгенерировано');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось сгенерировать аудио');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!lessonId) return;
    setBusy('delete');
    try {
      await deleteCardAudio(cardId, lessonId);
      onChanged(undefined);
      toast.success('Сгенерированное аудио удалено');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить аудио');
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    if (!playUrl) return;
    setBusy('download');
    try {
      const response = await fetch(playUrl);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${text.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'vetoschool-card'}.mp3`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      toast.error('MP3 недоступен для скачивания');
    } finally {
      setBusy(null);
    }
  };

  const buttonClass = 'inline-flex items-center gap-1.5 rounded-xl border border-purple-100 bg-white px-3 py-2 text-xs font-black text-purple-500 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-500 disabled:cursor-not-allowed disabled:opacity-45 dark:border-purple-700 dark:bg-[#241331] dark:text-purple-200';
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-purple-100 bg-white/70 p-2 dark:border-purple-700 dark:bg-white/5">
      <button type="button" onClick={generate} disabled={busy !== null || !lessonId || !text.trim()} className={buttonClass}>
        {busy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : audioUrl ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        {audioUrl ? 'Перегенерировать' : 'Сгенерировать аудио'}
      </button>
      {audioUrl && <>
        <button type="button" onClick={() => playUrl ? new Audio(playUrl).play().catch(() => toast.error('Не удалось воспроизвести аудио')) : toast.error('Аудио ещё загружается')} disabled={busy !== null} className={buttonClass}><Play className="h-4 w-4" />Прослушать</button>
        <button type="button" onClick={download} disabled={busy !== null || !playUrl} className={buttonClass}>{busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Скачать MP3</button>
        <button type="button" onClick={remove} disabled={busy !== null} className={`${buttonClass} text-red-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500`}>{busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Удалить аудио</button>
      </>}
      {!lessonId && <span className="text-xs font-bold text-amber-500">Сначала сохраните урок</span>}
    </div>
  );
}

function VocabularyEditor({ block, onChange, lessonId, voiceId, modelId }: { block: TheoryVocabularyBlock; onChange: (b: TheoryVocabularyBlock) => void; lessonId?: string; voiceId: string; modelId: string }) {
  const updateItem = (index: number, patch: Partial<TheoryVocabularyBlock['items'][number]>) =>
    onChange({ ...block, items: block.items.map((item, i) => i === index ? { ...item, ...patch } : item) });
  return (
    <div className="space-y-3">
      <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder="Название: Новые слова" />
      {block.items.map((item, index) => (
        <div key={item.id} className="rounded-2xl border border-purple-100 bg-purple-50/35 p-3 dark:border-purple-700 dark:bg-white/5">
          <div className="grid gap-2 sm:grid-cols-[74px_1fr_1fr]">
            <input className={`${inputClass} text-center text-2xl`} value={item.emoji} onChange={e => updateItem(index, { emoji: e.target.value })} maxLength={8} aria-label="Эмодзи" />
            <input className={inputClass} value={item.word} onChange={e => updateItem(index, { word: e.target.value })} placeholder="Слово: flower" />
            <input className={inputClass} value={item.translation} onChange={e => updateItem(index, { translation: e.target.value })} placeholder="Перевод: цветок" />
            <div className="sm:col-start-2">
              <input className={inputClass} value={item.transcription} onChange={e => updateItem(index, { transcription: e.target.value })} placeholder="Транскрипция: [ˈflaʊə]" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <VocabularyAudioUpload audio={item.audio} onUploaded={audio => updateItem(index, { audio })} />
              <button type="button" className="rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-black text-red-400 hover:bg-red-50 dark:border-red-900 dark:bg-[#241331]"
                onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== index) })}>Удалить слово</button>
            </div>
            <div className="sm:col-span-3">
              <GeneratedAudioControls lessonId={lessonId} cardId={item.id} text={item.word} audioUrl={item.audio_url} voiceId={voiceId} modelId={modelId} onChanged={audio_url => updateItem(index, { audio_url, audio_voice_id: audio_url ? voiceId : undefined, audio_model_id: audio_url ? modelId : undefined })} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {emojiChoices.map(emoji => <button type="button" key={emoji} onClick={() => updateItem(index, { emoji })} className="h-8 w-8 rounded-xl bg-white text-lg shadow-sm transition hover:-translate-y-0.5 hover:bg-pink-50 dark:bg-[#321b45]">{emoji}</button>)}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...block, items: [...block.items, { id: theoryId(), emoji: '⭐', word: '', transcription: '', translation: '' }] })}
        className="inline-flex items-center gap-2 rounded-2xl bg-purple-100 px-4 py-2 text-sm font-black text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-100"><Plus className="h-4 w-4" />Добавить слово</button>
    </div>
  );
}

function GrammarEditor({ block, onChange }: { block: TheoryGrammarBlock; onChange: (b: TheoryGrammarBlock) => void }) {
  const setColumn = (index: number, value: string) => onChange({ ...block, columns: block.columns.map((column, i) => i === index ? value : column) });
  const setCell = (rowIndex: number, cellIndex: number, value: string) => onChange({ ...block, rows: block.rows.map((row, r) => r === rowIndex ? row.map((cell, c) => c === cellIndex ? value : cell) : row) });
  return (
    <div className="space-y-3">
      <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder="Название таблицы" />
      <div className="overflow-x-auto rounded-2xl border border-purple-100 dark:border-purple-700">
        <table className="min-w-[620px] w-full border-collapse">
          <thead><tr className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950 dark:to-purple-950">
            {block.columns.map((column, index) => <th key={index} className="border-r border-purple-100 p-2 last:border-r-0 dark:border-purple-700"><input className={inputClass} value={column} onChange={e => setColumn(index, e.target.value)} /></th>)}
          </tr></thead>
          <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="bg-white dark:bg-[#241331]">
            {block.columns.map((_, cellIndex) => <td key={cellIndex} className="border-r border-t border-purple-100 p-2 last:border-r-0 dark:border-purple-700"><input className={inputClass} value={row[cellIndex] || ''} onChange={e => setCell(rowIndex, cellIndex, e.target.value)} /></td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange({ ...block, rows: [...block.rows, block.columns.map(() => '')] })} className="rounded-2xl bg-purple-100 px-4 py-2 text-sm font-black text-purple-700">+ Строка</button>
        <button type="button" onClick={() => onChange({ ...block, columns: [...block.columns, 'Колонка'], rows: block.rows.map(row => [...row, '']) })} className="rounded-2xl bg-pink-100 px-4 py-2 text-sm font-black text-pink-600">+ Колонка</button>
        {block.rows.length > 1 && <button type="button" onClick={() => onChange({ ...block, rows: block.rows.slice(0, -1) })} className="rounded-2xl bg-red-50 px-4 py-2 text-sm font-black text-red-400">Убрать строку</button>}
      </div>
    </div>
  );
}

function ImageEditor({ block, onChange }: { block: TheoryImageBlock; onChange: (b: TheoryImageBlock) => void }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const path = await uploadWorkbookAsset(file);
    setUploading(false);
    if (!path) return toast.error('Не удалось загрузить изображение');
    onChange({ ...block, image: path });
    toast.success('Изображение загружено');
  };
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder="Заголовок изображения" />
        <select className={inputClass} value={block.size} onChange={e => onChange({ ...block, size: e.target.value as TheoryImageBlock['size'] })}><option value="small">Небольшое</option><option value="medium">Среднее</option></select>
      </div>
      <input className={inputClass} value={block.caption} onChange={e => onChange({ ...block, caption: e.target.value })} placeholder="Подпись под изображением" />
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-purple-200 bg-purple-50/60 px-4 py-4 font-body text-sm font-black text-purple-600 transition hover:border-pink-300 hover:bg-pink-50 dark:border-purple-700 dark:bg-white/5">
        {uploading ? <Sparkles className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}{uploading ? 'Загрузка…' : block.image ? 'Заменить изображение' : 'Загрузить изображение'}
        <input type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
      </label>
    </div>
  );
}

function AudioEditor({ block, onChange }: { block: TheoryAudioBlock; onChange: (b: TheoryAudioBlock) => void }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const path = await uploadWorkbookAsset(file);
    setUploading(false);
    if (!path) return toast.error('Не удалось загрузить аудио');
    onChange({ ...block, audio: path });
    toast.success('Аудиозапись загружена');
  };
  return (
    <div className="grid gap-3">
      <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder="Название: Послушай и повтори" />
      <textarea className={`${inputClass} min-h-24 resize-y`} value={block.description} onChange={e => onChange({ ...block, description: e.target.value })} placeholder="Короткая инструкция для ребёнка" />
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-pink-200 bg-gradient-to-r from-pink-50 to-purple-50 px-4 py-4 font-body text-sm font-black text-purple-600 transition hover:border-purple-300 dark:border-purple-700 dark:from-pink-500/10 dark:to-purple-500/10 dark:text-purple-100">
        {uploading ? <Sparkles className="h-5 w-5 animate-spin" /> : <Headphones className="h-5 w-5 text-pink-400" />}
        {uploading ? 'Загрузка…' : block.audio ? 'Заменить аудиозапись' : 'Загрузить аудио'}
        <input type="file" accept="audio/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
      </label>
      {block.audio && <div className="truncate rounded-2xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200">Аудио прикреплено: {block.audio}</div>}
    </div>
  );
}

function RuleEditor({ block, onChange }: { block: TheoryRuleBlock; onChange: (b: TheoryRuleBlock) => void }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder="Название правила" />
        <select className={inputClass} value={block.accent} onChange={e => onChange({ ...block, accent: e.target.value as TheoryRuleBlock['accent'] })}>
          <option value="pink">Розовый акцент</option>
          <option value="purple">Фиолетовый акцент</option>
          <option value="mint">Мятный акцент</option>
        </select>
      </div>
      <textarea className={`${inputClass} min-h-28 resize-y leading-7`} value={block.body} onChange={e => onChange({ ...block, body: e.target.value })} placeholder="Объясните правило простыми словами…" />
      <input className={inputClass} value={block.formula} onChange={e => onChange({ ...block, formula: e.target.value })} placeholder="Формула: I + am + adjective" />
    </div>
  );
}

function ExamplesEditor({ block, onChange, lessonId, voiceId, modelId }: { block: TheoryExamplesBlock; onChange: (b: TheoryExamplesBlock) => void; lessonId?: string; voiceId: string; modelId: string }) {
  const updateItem = (index: number, patch: Partial<TheoryExamplesBlock['items'][number]>) =>
    onChange({ ...block, items: block.items.map((item, i) => i === index ? { ...item, ...patch } : item) });
  return (
    <div className="space-y-3">
      <input className={inputClass} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} placeholder="Название блока: Примеры" />
      {block.items.map((item, index) => (
        <div key={item.id} className="grid gap-2 rounded-2xl border border-purple-100 bg-purple-50/35 p-3 sm:grid-cols-2 dark:border-purple-700 dark:bg-white/5">
          <input className={inputClass} value={item.sentence} onChange={e => updateItem(index, { sentence: e.target.value })} placeholder="I have a cat." />
          <input className={inputClass} value={item.translation} onChange={e => updateItem(index, { translation: e.target.value })} placeholder="У меня есть кот." />
          <input className={`${inputClass} sm:col-span-2`} value={item.note} onChange={e => updateItem(index, { note: e.target.value })} placeholder="Необязательная подсказка к примеру" />
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <VocabularyAudioUpload audio={item.audio} onUploaded={audio => updateItem(index, { audio })} />
            <button type="button" className="w-fit rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-400 hover:bg-red-100 dark:bg-red-950/30" onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== index) })}>Удалить пример</button>
          </div>
          <div className="sm:col-span-2">
            <GeneratedAudioControls lessonId={lessonId} cardId={item.id} text={item.sentence} audioUrl={item.audio_url} voiceId={voiceId} modelId={modelId} onChanged={audio_url => updateItem(index, { audio_url, audio_voice_id: audio_url ? voiceId : undefined, audio_model_id: audio_url ? modelId : undefined })} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...block, items: [...block.items, { id: theoryId(), sentence: '', translation: '', note: '' }] })} className="inline-flex items-center gap-2 rounded-2xl bg-purple-100 px-4 py-2 text-sm font-black text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-100"><Plus className="h-4 w-4" />Добавить пример</button>
    </div>
  );
}

const blockMeta: Record<TheoryBlock['type'], { label: string; icon: typeof Type; color: string }> = {
  text: { label: 'Текст и списки', icon: Type, color: 'text-purple-500 bg-purple-50' },
  vocabulary: { label: 'Словарные карточки', icon: Languages, color: 'text-pink-500 bg-pink-50' },
  grammar: { label: 'Грамматическая таблица', icon: Table2, color: 'text-sky-500 bg-sky-50' },
  image: { label: 'Изображение', icon: Image, color: 'text-emerald-500 bg-emerald-50' },
  audio: { label: 'Аудио', icon: Headphones, color: 'text-fuchsia-500 bg-fuchsia-50' },
  rule: { label: 'Правило', icon: Lightbulb, color: 'text-amber-500 bg-amber-50' },
  examples: { label: 'Примеры предложений', icon: MessageSquareQuote, color: 'text-violet-500 bg-violet-50' },
};

export default function TheoryLessonEditor({ lessonTitle, task, onCreate, onSave }: {
  lessonTitle: string;
  task?: InteractiveTask;
  onCreate: (content: TheoryContent) => Promise<void>;
  onSave: (content: TheoryContent) => Promise<void>;
}) {
  const [content, setContent] = useState<TheoryContent>(() => ({ ...emptyTheoryContent(lessonTitle), ...(task?.payload_json || {}) }));
  const [saving, setSaving] = useState(false);
  const [voiceId, setVoiceId] = useState(() => localStorage.getItem('vetoschool-elevenlabs-voice-id') || DEFAULT_ELEVENLABS_VOICE_ID);
  const [modelId, setModelId] = useState(() => localStorage.getItem('vetoschool-elevenlabs-model-id') || DEFAULT_ELEVENLABS_MODEL_ID);
  useEffect(() => setContent({ ...emptyTheoryContent(lessonTitle), ...(task?.payload_json || {}) }), [task?.id, lessonTitle]);
  const setBlock = (index: number, block: TheoryBlock) => setContent(current => ({ ...current, blocks: current.blocks.map((item, i) => i === index ? block : item) }));
  const moveBlock = (from: number, to: number) => setContent(current => { const blocks = [...current.blocks]; const [item] = blocks.splice(from, 1); blocks.splice(to, 0, item); return { ...current, blocks }; });
  const applyTemplate = (template: TheoryTemplate) => {
    const prepared = createTheoryTemplate(template, content.title || lessonTitle);
    setContent(current => ({
      ...current,
      eyebrow: current.blocks.length === 0 ? prepared.eyebrow : current.eyebrow,
      title: current.title || prepared.title,
      subtitle: current.subtitle || prepared.subtitle,
      blocks: [...current.blocks, ...prepared.blocks],
    }));
    toast.success('Шаблон добавлен. Теперь его можно изменить под свой урок');
  };
  const save = async () => { setSaving(true); try { task ? await onSave(content) : await onCreate(content); toast.success('Теория сохранена'); } finally { setSaving(false); } };
  return (
    <section className="space-y-4 rounded-3xl border border-purple-100 bg-white p-4 shadow-sm dark:border-purple-700 dark:bg-[#1f122d]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 text-purple-600"><BookOpen className="h-5 w-5" /></span><div><div className="font-display text-lg font-black text-purple-800 dark:text-purple-100">Конструктор теории</div><p className="text-xs font-bold text-purple-400">Соберите красивую страницу урока из содержательных блоков</p></div></div>
        <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-500 px-4 py-2.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Сохраняю…' : 'Сохранить теорию'}</button>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <input className={inputClass} value={content.eyebrow} onChange={e => setContent({ ...content, eyebrow: e.target.value })} placeholder="Надпись над заголовком" />
        <input className={`${inputClass} sm:col-span-2`} value={content.title} onChange={e => setContent({ ...content, title: e.target.value })} placeholder="Красивый заголовок урока" />
        <input className={`${inputClass} sm:col-span-3`} value={content.subtitle} onChange={e => setContent({ ...content, subtitle: e.target.value })} placeholder="Короткое вступление к теме" />
      </div>
      <div className="rounded-3xl border border-purple-100 bg-gradient-to-r from-purple-50/80 via-white to-pink-50/80 p-3 dark:border-purple-700 dark:from-purple-500/10 dark:via-white/5 dark:to-pink-500/10">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-pink-500 shadow-sm dark:bg-white/10"><Volume2 className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-black text-purple-700 dark:text-purple-100">Озвучивание карточек</div>
            <p className="mt-1 text-xs font-bold text-purple-400">Голос: George · Модель: Multilingual v2</p>
            <details className="mt-2">
              <summary className="w-fit cursor-pointer text-xs font-black text-purple-500 transition hover:text-pink-500">Дополнительные настройки голоса</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="space-y-1"><span className="text-xs font-black text-purple-400">Voice ID</span><input className={inputClass} value={voiceId} onChange={e => { setVoiceId(e.target.value); localStorage.setItem('vetoschool-elevenlabs-voice-id', e.target.value); }} placeholder="Voice ID" /></label>
                <label className="space-y-1"><span className="text-xs font-black text-purple-400">Model ID</span><input className={inputClass} value={modelId} onChange={e => { setModelId(e.target.value); localStorage.setItem('vetoschool-elevenlabs-model-id', e.target.value); }} placeholder="Model ID" /></label>
              </div>
              <p className="mt-2 text-xs font-bold text-purple-400">Меняйте эти значения только при выборе другого голоса или модели ElevenLabs. API key здесь не вводится.</p>
            </details>
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-pink-100 bg-gradient-to-r from-pink-50/80 via-white to-purple-50/80 p-3 dark:border-purple-700 dark:from-pink-500/10 dark:via-white/5 dark:to-purple-500/10">
        <div className="mb-2 flex items-center gap-2 font-display text-sm font-black text-purple-700 dark:text-purple-100"><Wand2 className="h-4 w-4 text-pink-400" />Готовые шаблоны</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => applyTemplate('vocabulary')} className="rounded-2xl border border-white bg-white px-4 py-2 text-xs font-black text-purple-700 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 dark:border-purple-700 dark:bg-[#2a183a] dark:text-purple-100">🌸 Новые слова</button>
          <button type="button" onClick={() => applyTemplate('grammar')} className="rounded-2xl border border-white bg-white px-4 py-2 text-xs font-black text-purple-700 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 dark:border-purple-700 dark:bg-[#2a183a] dark:text-purple-100">📘 Грамматика</button>
          <button type="button" onClick={() => applyTemplate('alphabet')} className="rounded-2xl border border-white bg-white px-4 py-2 text-xs font-black text-purple-700 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 dark:border-purple-700 dark:bg-[#2a183a] dark:text-purple-100">🔤 Буквы и цифры</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 rounded-2xl bg-purple-50/70 p-3 dark:bg-white/5">
        {(Object.keys(blockMeta) as TheoryBlock['type'][]).map(type => { const meta = blockMeta[type]; const Icon = meta.icon; return <button type="button" key={type} onClick={() => setContent(current => ({ ...current, blocks: [...current.blocks, createTheoryBlock(type)] }))} className="inline-flex items-center gap-2 rounded-2xl border border-white bg-white px-3 py-2 text-xs font-black text-purple-700 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 dark:border-purple-700 dark:bg-[#2a183a] dark:text-purple-100"><Icon className="h-4 w-4 text-pink-400" />{meta.label}</button>; })}
      </div>
      {content.blocks.length === 0 && <div className="rounded-3xl border border-dashed border-purple-200 bg-purple-50/40 p-8 text-center"><Sparkles className="mx-auto mb-2 h-7 w-7 text-pink-400" /><p className="font-display font-black text-purple-700">Добавьте первый блок теории</p><p className="mt-1 text-sm font-bold text-purple-400">Начните с текста, новых слов или грамматической таблицы.</p></div>}
      <div className="space-y-3">{content.blocks.map((block, index) => { const meta = blockMeta[block.type]; const Icon = meta.icon; return <article key={block.id} className="rounded-3xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/35 p-4 dark:border-purple-700 dark:from-[#241331] dark:to-[#1c1029]"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-display text-sm font-black text-purple-700 dark:text-purple-100"><span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${meta.color}`}><Icon className="h-4 w-4" /></span>{meta.label}</div><BlockToolbar index={index} total={content.blocks.length} onMove={to => moveBlock(index, to)} onDelete={() => setContent(current => ({ ...current, blocks: current.blocks.filter((_, i) => i !== index) }))} /></div>{block.type === 'text' && <TextEditor block={block} onChange={next => setBlock(index, next)} />}{block.type === 'vocabulary' && <VocabularyEditor block={block} onChange={next => setBlock(index, next)} lessonId={task?.lesson_id} voiceId={voiceId} modelId={modelId} />}{block.type === 'grammar' && <GrammarEditor block={block} onChange={next => setBlock(index, next)} />}{block.type === 'image' && <ImageEditor block={block} onChange={next => setBlock(index, next)} />}{block.type === 'audio' && <AudioEditor block={block} onChange={next => setBlock(index, next)} />}{block.type === 'rule' && <RuleEditor block={block} onChange={next => setBlock(index, next)} />}{block.type === 'examples' && <ExamplesEditor block={block} onChange={next => setBlock(index, next)} lessonId={task?.lesson_id} voiceId={voiceId} modelId={modelId} />}</article>; })}</div>
    </section>
  );
}
