import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, CheckCircle2, ChevronDown, ChevronRight, FileText, Gamepad2,
  Layers3, Plus, Save, Sparkles, Trash2, Upload, Users, X,
} from 'lucide-react';
import {
  Workbook, Unit, Lesson, InteractiveTask,
  listWorkbooks, createWorkbook, updateWorkbook, deleteWorkbook,
  listUnits, createUnit, updateUnit, deleteUnit,
  listLessons, createLesson, updateLesson, deleteLesson,
  listTasks, createTask, updateTaskPayload, deleteTask,
  listWorkbookAssignments, setWorkbookStudentAssignments,
  uploadWorkbookAsset, signedUrlFor,
} from '../lib/workbooks';
import { MECHANICS, MechanicType, canReward, LessonKind } from '../lib/mechanics';
import { Lang, t } from '../lib/i18n';
import type { User } from '../lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import TheoryLessonEditor from './TheoryLessonEditor';
import type { TheoryContent } from '../lib/theory';

const LESSON_KINDS: LessonKind[] = ['theory','class_task','homework','practice','checkpoint'];
const LESSON_KIND_LABEL: Record<LessonKind, string> = {
  theory: '📖 Теория',
  class_task: '🧑‍🏫 Задание на уроке',
  homework: '🏠 Домашка',
  practice: '🎮 Практика',
  checkpoint: '🏆 Контрольная',
};
const FULL_MECHANICS: MechanicType[] = [
  'matching',
  'word_lego',
  'fill_letters',
  'anagram_unscramble',
  'odd_one_out',
  'category_sorting',
  'cipher_decoder',
  'word_search',
  'connect_dots',
  'spot_and_count',
  'digital_coloring',
];
const DEFAULT_UNIT_EMOJI = '🏝️';

const sortUnits = (items: Unit[]) =>
  [...items].sort((a, b) => (a.unit_number ?? a.order ?? 0) - (b.unit_number ?? b.order ?? 0));

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

// ---------- Pretty pastel primary button ----------
const primaryBtn = 'px-4 py-2 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-500 text-white font-body font-800 text-sm shadow-lg shadow-pink-200/50 hover:-translate-y-0.5 transition disabled:opacity-50 disabled:cursor-not-allowed';
const ghostBtn = 'px-4 py-2 rounded-2xl bg-white border border-purple-100 text-purple-600 font-body font-800 text-sm hover:bg-purple-50 transition';
const dangerBtn = 'px-4 py-2 rounded-2xl bg-gradient-to-r from-rose-400 to-red-500 text-white font-body font-800 text-sm shadow-lg hover:-translate-y-0.5 transition';

// ---------- Asset preview ----------
function AssetImg({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let alive = true; signedUrlFor(path).then(u => { if (alive) setUrl(u); }); return () => { alive = false; }; }, [path]);
  if (!url) return <div className={`bg-purple-100 animate-pulse ${className}`} />;
  return <img src={url} alt="" className={className} />;
}

// ---------- File upload ----------
function UploadButton({ onUploaded }: { onUploaded: (path: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-pointer transition ${busy ? 'bg-gray-200 text-gray-500' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}>
      <Upload className="w-3 h-3" />
      {busy ? '…' : 'Фото'}
      <input type="file" accept="image/*" className="hidden" disabled={busy}
        onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return;
          setBusy(true);
          const p = await uploadWorkbookAsset(f);
          setBusy(false);
          if (p) onUploaded(p);
          e.target.value = '';
        }} />
    </label>
  );
}

// ---------- Pretty confirm dialog ----------
function ConfirmDelete({ open, onOpenChange, title, description, onConfirm }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; description: string; onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-gradient-to-br from-pink-50 via-white to-purple-50 border-2 border-purple-200 rounded-3xl shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl text-purple-800">{title}</AlertDialogTitle>
          <AlertDialogDescription className="font-body text-purple-500">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className={ghostBtn}>Отмена</AlertDialogCancel>
          <AlertDialogAction className={dangerBtn} onClick={() => onConfirm()}>Да, удалить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------- Pair editor ----------
type Side = { text?: string; image?: string };
type Pair = { left: Side; right: Side };
function PairEditor({ payload, onChange }: { payload: any; onChange: (p: any) => void }) {
  const pairs: Pair[] = payload?.pairs || [];
  const update = (next: Pair[]) => onChange({ ...payload, pairs: next });
  const addPair = () => update([...pairs, { left: { text: '' }, right: { text: '' } }]);
  const removePair = (i: number) => update(pairs.filter((_, idx) => idx !== i));
  const setSide = (i: number, side: 'left'|'right', patch: Partial<Side>) => {
    update(pairs.map((p, idx) => idx === i ? { ...p, [side]: { ...p[side], ...patch } } : p));
  };
  return (
    <div className="space-y-2">
      {pairs.length === 0 && <p className="text-xs text-purple-400 italic">Пока пар нет — добавьте первую.</p>}
      <AnimatePresence initial={false}>
        {pairs.map((p, i) => (
          <motion.div key={i} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -12 }}
            className="grid gap-2 rounded-2xl border border-purple-100 bg-white p-3 shadow-sm sm:grid-cols-[2rem_1fr_1fr_2rem] sm:items-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 to-purple-100 text-xs font-bold text-purple-600">{i+1}</span>
            {(['left','right'] as const).map(side => (
              <div key={side} className="flex min-w-0 items-center gap-2 rounded-xl bg-purple-50/60 p-2">
                <input type="text" placeholder={side==='left'?'элемент 1':'элемент 2'} value={p[side].text || ''}
                  onChange={e => setSide(i, side, { text: e.target.value })}
                  className="input-magic !py-1 !text-sm flex-1" />
                {p[side].image
                  ? <div className="relative"><AssetImg path={p[side].image!} className="w-9 h-9 object-cover rounded-lg" />
                      <button onClick={() => setSide(i, side, { image: undefined })} className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow"><X className="w-3 h-3 text-red-500"/></button>
                    </div>
                  : <UploadButton onUploaded={path => setSide(i, side, { image: path })} />}
              </div>
            ))}
            <button onClick={() => removePair(i)} className="justify-self-end rounded-xl p-2 text-red-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
      <button onClick={addPair} className="inline-flex items-center gap-1 rounded-xl bg-purple-100 px-3 py-1.5 text-xs font-700 text-purple-700 transition hover:bg-purple-200"><Plus className="w-3 h-3" /> добавить пару</button>
    </div>
  );
}

function FillEditor({ payload, onChange }: { payload: any; onChange: (p: any) => void }) {
  const text: string = payload?.text || '';
  return (
    <div className="space-y-2">
      <p className="text-xs text-purple-500">Замените пропуски знаком <b>___</b> (три подчёркивания).</p>
      <textarea value={text} onChange={e => onChange({ ...payload, text: e.target.value })}
        rows={4} className="input-magic w-full !text-sm" placeholder="I ___ a student. She ___ happy." />
      <p className="text-xs text-purple-400">Правильные ответы (по одному на строку):</p>
      <textarea value={(payload?.answers || []).join('\n')}
        onChange={e => onChange({ ...payload, answers: e.target.value.split('\n').map(s=>s.trim()).filter(Boolean) })}
        rows={3} className="input-magic w-full !text-sm font-mono" placeholder="am&#10;is" />
    </div>
  );
}

function AnagramEditor({ payload, onChange }: { payload: any; onChange: (p: any) => void }) {
  return (
    <div>
      <p className="text-xs text-purple-500 mb-1">Правильное слово или короткая фраза (ученик увидит буквы в перемешанном порядке).</p>
      <input type="text" value={payload?.answer || ''} onChange={e => onChange({ ...payload, answer: e.target.value })}
        className="input-magic w-full" placeholder="ELEPHANT" />
    </div>
  );
}

function OddOneOutEditor({ payload, onChange }: { payload: any; onChange: (p: any) => void }) {
  const items: Array<{ text?: string; image?: string; is_odd?: boolean }> = payload?.items || [];
  const update = (next: typeof items) => onChange({ ...payload, items: next });
  const addItem = () => update([...items, { text: '', is_odd: items.length === 0 }]);
  const setOdd = (i: number) => update(items.map((item, idx) => ({ ...item, is_odd: idx === i })));
  return (
    <div className="space-y-2">
      <p className="text-xs text-purple-500">Добавьте варианты и отметьте один лишний.</p>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 rounded-2xl border border-purple-100 bg-white p-2">
          <input type="radio" checked={!!item.is_odd} onChange={() => setOdd(i)} className="h-4 w-4 accent-pink-500" />
          <input
            type="text"
            value={item.text || ''}
            onChange={e => update(items.map((it, idx) => idx === i ? { ...it, text: e.target.value } : it))}
            className="input-magic flex-1 !py-1 !text-sm"
            placeholder={`Вариант ${i + 1}`}
          />
          <button onClick={() => update(items.filter((_, idx) => idx !== i))} className="rounded-xl p-2 text-red-400 transition hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button onClick={addItem} className="inline-flex items-center gap-1 rounded-xl bg-purple-100 px-3 py-1.5 text-xs font-700 text-purple-700 transition hover:bg-purple-200">
        <Plus className="h-3 w-3" /> добавить вариант
      </button>
    </div>
  );
}

function CategorySortingEditor({ payload, onChange }: { payload: any; onChange: (p: any) => void }) {
  const categories: Array<{ name: string; items: Array<{ text?: string; image?: string }> }> = payload?.categories || [];
  const update = (next: typeof categories) => onChange({ ...payload, categories: next });
  const addCategory = () => update([...categories, { name: `Категория ${categories.length + 1}`, items: [] }]);
  return (
    <div className="space-y-3">
      <p className="text-xs text-purple-500">Создайте категории и впишите элементы по одному в строке.</p>
      {categories.map((cat, i) => (
        <div key={i} className="rounded-2xl border border-purple-100 bg-purple-50/50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <input
              type="text"
              value={cat.name}
              onChange={e => update(categories.map((c, idx) => idx === i ? { ...c, name: e.target.value } : c))}
              className="input-magic flex-1 !py-1 !text-sm"
              placeholder="Название категории"
            />
            <button onClick={() => update(categories.filter((_, idx) => idx !== i))} className="rounded-xl p-2 text-red-400 transition hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            value={(cat.items || []).map(item => item.text || '').join('\n')}
            onChange={e => update(categories.map((c, idx) => idx === i ? {
              ...c,
              items: e.target.value.split('\n').map(text => ({ text: text.trim() })).filter(item => item.text),
            } : c))}
            rows={3}
            className="input-magic w-full !text-sm"
            placeholder="cat&#10;dog&#10;horse"
          />
        </div>
      ))}
      <button onClick={addCategory} className="inline-flex items-center gap-1 rounded-xl bg-purple-100 px-3 py-1.5 text-xs font-700 text-purple-700 transition hover:bg-purple-200">
        <Plus className="h-3 w-3" /> добавить категорию
      </button>
    </div>
  );
}

function CipherEditor({ payload, onChange }: { payload: any; onChange: (p: any) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs text-purple-500">Слово будет зашифровано числами A1-Z26, ребенок введет ответ.</p>
      <input
        type="text"
        value={payload?.answer || ''}
        onChange={e => onChange({ ...payload, answer: e.target.value })}
        className="input-magic w-full"
        placeholder="RAINBOW"
      />
    </div>
  );
}

function WordSearchEditor({ payload, onChange }: { payload: any; onChange: (p: any) => void }) {
  const words: string[] = payload?.words || [];
  const size = payload?.size || 10;
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-xs text-purple-500">Слова для поиска, каждое с новой строки.</p>
        <textarea
          value={words.join('\n')}
          onChange={e => onChange({ ...payload, words: e.target.value.split('\n').map(w => w.trim()).filter(Boolean) })}
          rows={4}
          className="input-magic w-full !text-sm font-mono"
          placeholder="cat&#10;dog&#10;sun"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-body font-700 text-purple-500">Размер поля</label>
        <input
          type="number"
          min={6}
          max={14}
          value={size}
          onChange={e => onChange({ ...payload, size: Math.max(6, Math.min(14, parseInt(e.target.value) || 10)) })}
          className="input-magic w-24 !py-1 !text-sm"
        />
      </div>
    </div>
  );
}

function ConnectDotsEditor({ payload, onChange }: { payload: any; onChange: (p: any) => void }) {
  const points: Array<{ x: number; y: number; order: number }> = payload?.points || [];
  const update = (next: typeof points) => onChange({ ...payload, points: [...next].sort((a, b) => a.order - b.order) });
  const addPoint = () => {
    const order = points.length + 1;
    update([...points, {
      order,
      x: Math.min(88, 15 + ((order - 1) * 16) % 70),
      y: 25 + ((order - 1) % 3) * 20,
    }]);
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-purple-500">Точки задаются в процентах: x слева направо, y сверху вниз.</p>
      {points.map((point, i) => (
        <div key={`${point.order}-${i}`} className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2 rounded-2xl border border-purple-100 bg-white p-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-xs font-900 text-purple-700">#{point.order}</span>
          <input
            type="number"
            min={0}
            max={100}
            value={point.x}
            onChange={e => update(points.map((p, idx) => idx === i ? { ...p, x: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) } : p))}
            className="input-magic !py-1 !text-sm"
            placeholder="x"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={point.y}
            onChange={e => update(points.map((p, idx) => idx === i ? { ...p, y: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) } : p))}
            className="input-magic !py-1 !text-sm"
            placeholder="y"
          />
          <button onClick={() => update(points.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, order: idx + 1 })))} className="rounded-xl p-2 text-red-400 transition hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button onClick={addPoint} className="inline-flex items-center gap-1 rounded-xl bg-purple-100 px-3 py-1.5 text-xs font-700 text-purple-700 transition hover:bg-purple-200">
        <Plus className="h-3 w-3" /> добавить точку
      </button>
    </div>
  );
}

function SpotCountEditor({ payload, onChange }: { payload: any; onChange: (p: any) => void }) {
  const spots: Array<{ x: number; y: number; r: number }> = payload?.spots || [];
  const update = (next: typeof spots) => onChange({ ...payload, spots: next, expected_count: next.length });
  const addSpot = () => {
    const index = spots.length;
    update([...spots, {
      x: Math.min(88, 18 + (index * 17) % 70),
      y: 25 + (index % 3) * 22,
      r: 8,
    }]);
  };
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-purple-100 bg-white p-3">
        <p className="mb-2 text-xs text-purple-500">Добавьте картинку и зоны, которые ребенок должен найти.</p>
        {payload?.background_url ? (
          <div className="flex items-center gap-3">
            <AssetImg path={payload.background_url} className="h-16 w-24 rounded-xl object-cover" />
            <button onClick={() => onChange({ ...payload, background_url: undefined })} className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-800 text-red-500">Удалить фото</button>
          </div>
        ) : (
          <UploadButton onUploaded={path => onChange({ ...payload, background_url: path })} />
        )}
      </div>
      {spots.map((spot, i) => (
        <div key={i} className="grid grid-cols-[2rem_1fr_1fr_1fr_2rem] items-center gap-2 rounded-2xl border border-purple-100 bg-white p-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-100 text-xs font-900 text-pink-600">#{i + 1}</span>
          {(['x', 'y', 'r'] as const).map(key => (
            <input
              key={key}
              type="number"
              min={key === 'r' ? 2 : 0}
              max={key === 'r' ? 30 : 100}
              value={spot[key]}
              onChange={e => update(spots.map((s, idx) => idx === i ? {
                ...s,
                [key]: Math.max(key === 'r' ? 2 : 0, Math.min(key === 'r' ? 30 : 100, parseInt(e.target.value) || 0)),
              } : s))}
              className="input-magic !py-1 !text-sm"
              placeholder={key}
            />
          ))}
          <button onClick={() => update(spots.filter((_, idx) => idx !== i))} className="rounded-xl p-2 text-red-400 transition hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button onClick={addSpot} className="inline-flex items-center gap-1 rounded-xl bg-purple-100 px-3 py-1.5 text-xs font-700 text-purple-700 transition hover:bg-purple-200">
        <Plus className="h-3 w-3" /> добавить объект
      </button>
    </div>
  );
}

function DigitalColoringEditor({ payload, onChange }: { payload: any; onChange: (p: any) => void }) {
  const palette: Array<{ code: string; color: string }> = payload?.palette || [];
  const regions: Array<{ id: string; code: string }> = payload?.regions || [];
  const updatePalette = (next: typeof palette) => onChange({ ...payload, palette: next });
  const updateRegions = (next: typeof regions) => onChange({ ...payload, regions: next });
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-purple-100 bg-white p-3">
        <div className="mb-2 text-xs font-800 uppercase tracking-wider text-purple-500">Палитра</div>
        <div className="space-y-2">
          {palette.map((item, i) => (
            <div key={i} className="grid grid-cols-[3rem_1fr_2rem] items-center gap-2">
              <input
                type="color"
                value={item.color || '#f472b6'}
                onChange={e => updatePalette(palette.map((p, idx) => idx === i ? { ...p, color: e.target.value } : p))}
                className="h-10 w-12 cursor-pointer rounded-xl border border-purple-100 bg-white p-1"
              />
              <input
                value={item.code || ''}
                onChange={e => updatePalette(palette.map((p, idx) => idx === i ? { ...p, code: e.target.value } : p))}
                className="input-magic !py-1 !text-sm"
                placeholder="код, например 1"
              />
              <button onClick={() => updatePalette(palette.filter((_, idx) => idx !== i))} className="rounded-xl p-2 text-red-400 transition hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => updatePalette([...palette, { code: String(palette.length + 1), color: ['#f472b6', '#a78bfa', '#60a5fa', '#34d399'][palette.length % 4] }])}
          className="mt-2 inline-flex items-center gap-1 rounded-xl bg-purple-100 px-3 py-1.5 text-xs font-700 text-purple-700 transition hover:bg-purple-200">
          <Plus className="h-3 w-3" /> добавить цвет
        </button>
      </div>
      <div className="rounded-2xl border border-purple-100 bg-white p-3">
        <div className="mb-2 text-xs font-800 uppercase tracking-wider text-purple-500">Области</div>
        <p className="mb-2 text-xs text-purple-400">Каждая область получает код из палитры.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {regions.map((region, i) => (
            <div key={region.id || i} className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-100 text-xs font-900 text-pink-600">#{i + 1}</span>
              <input
                value={region.code || ''}
                onChange={e => updateRegions(regions.map((r, idx) => idx === i ? { ...r, code: e.target.value } : r))}
                className="input-magic flex-1 !py-1 !text-sm"
                placeholder="код"
              />
              <button onClick={() => updateRegions(regions.filter((_, idx) => idx !== i))} className="rounded-xl p-2 text-red-400 transition hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => updateRegions([...regions, { id: `region-${regions.length + 1}`, code: palette[regions.length % Math.max(1, palette.length)]?.code || '1' }])}
          className="mt-2 inline-flex items-center gap-1 rounded-xl bg-purple-100 px-3 py-1.5 text-xs font-700 text-purple-700 transition hover:bg-purple-200">
          <Plus className="h-3 w-3" /> добавить область
        </button>
      </div>
    </div>
  );
}

// ---------- Task card ----------
function TaskCard({ task, onDelete, onChange }: { task: InteractiveTask; onDelete: () => void; onChange: (p: any) => Promise<void> }) {
  const def = MECHANICS.find(m => m.id === task.mechanic_type);
  const [payload, setPayload] = useState<any>(task.payload_json || {});
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const update = (p: any) => { setPayload(p); setDirty(true); };
  const save = async () => { await onChange(payload); setDirty(false); toast.success('Задание сохранено'); };
  const isFull = FULL_MECHANICS.includes(task.mechanic_type);
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-3xl border border-purple-100 bg-white p-4 shadow-sm shadow-purple-100/60 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-body text-sm font-800 text-purple-700">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 text-lg">{def?.emoji}</span>
          <span>{def?.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {isFull && dirty && <button onClick={save} className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-800 text-emerald-700"><Save className="h-3.5 w-3.5" /> Сохранить</button>}
          <button onClick={() => setConfirmOpen(true)} className="rounded-xl p-2 text-red-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {task.mechanic_type === 'matching' || task.mechanic_type === 'word_lego'
        ? <PairEditor payload={payload} onChange={update} />
        : task.mechanic_type === 'fill_letters'
          ? <FillEditor payload={payload} onChange={update} />
        : task.mechanic_type === 'anagram_unscramble'
          ? <AnagramEditor payload={payload} onChange={update} />
        : task.mechanic_type === 'odd_one_out'
          ? <OddOneOutEditor payload={payload} onChange={update} />
        : task.mechanic_type === 'category_sorting'
          ? <CategorySortingEditor payload={payload} onChange={update} />
        : task.mechanic_type === 'cipher_decoder'
          ? <CipherEditor payload={payload} onChange={update} />
        : task.mechanic_type === 'word_search'
          ? <WordSearchEditor payload={payload} onChange={update} />
        : task.mechanic_type === 'connect_dots'
          ? <ConnectDotsEditor payload={payload} onChange={update} />
        : task.mechanic_type === 'spot_and_count'
          ? <SpotCountEditor payload={payload} onChange={update} />
        : task.mechanic_type === 'digital_coloring'
          ? <DigitalColoringEditor payload={payload} onChange={update} />
        : <div className="text-xs text-purple-400 italic bg-purple-50 rounded-xl p-3 text-center">🚧 Механика «{def?.label}» — в разработке.</div>}
      <ConfirmDelete open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Удалить задание?" description={`Механика «${def?.label}» будет удалена без возможности восстановления.`}
        onConfirm={() => { setConfirmOpen(false); onDelete(); }} />
    </motion.div>
  );
}

// ---------- Add-task dialog ----------
function AddTaskDialog({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (v: boolean) => void; onPick: (m: MechanicType) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-pink-50 via-white to-purple-50 border-2 border-purple-200 rounded-3xl shadow-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-purple-700">✨ Добавить задание</DialogTitle>
        </DialogHeader>
        <p className="font-body text-sm text-purple-500 -mt-2">Выберите механику для нового задания:</p>
        <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
          {MECHANICS.map(m => {
            const ready = FULL_MECHANICS.includes(m.id);
            return (
              <button key={m.id} disabled={!ready}
                onClick={() => { onPick(m.id); onOpenChange(false); }}
                className={`text-left p-3 rounded-2xl border-2 transition ${ready
                  ? 'bg-white border-purple-100 hover:border-purple-300 hover:bg-purple-50 hover:scale-[1.02]'
                  : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'}`}>
                <div className="text-2xl mb-1">{m.emoji}</div>
                <div className="font-body font-600 text-sm text-purple-700">{m.label} {!ready && '🚧'}</div>
                <div className="font-body text-xs text-purple-400 line-clamp-2">{m.description}</div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Add-lesson dialog ----------
function AddLessonDialog({ open, onOpenChange, onCreate, defaultNumber }: {
  open: boolean; onOpenChange: (v: boolean) => void; defaultNumber: number;
  onCreate: (data: { title: string; type: LessonKind; stars: number }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<LessonKind>('practice');
  const [stars, setStars] = useState(5);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setTitle(`Урок ${defaultNumber}`); setType('practice'); setStars(5); } }, [open, defaultNumber]);
  const rewardable = canReward(type);
  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try { await onCreate({ title: title.trim(), type, stars: rewardable ? stars : 0 }); onOpenChange(false); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-pink-50 via-white to-purple-50 border-2 border-purple-200 rounded-3xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-purple-700">✨ Новый урок</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-body font-600 text-purple-600 mb-1 block">Название</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && title.trim()) submit(); }}
              className="input-magic w-full" placeholder="Название урока" />
          </div>
          <div>
            <label className="text-xs font-body font-600 text-purple-600 mb-1 block">Тип урока</label>
            <div className="grid grid-cols-2 gap-2">
              {LESSON_KINDS.map(k => (
                <button key={k} onClick={() => setType(k)}
                  className={`px-3 py-2 rounded-2xl text-sm font-body font-600 border-2 transition ${type === k
                    ? 'bg-gradient-to-r from-pink-100 to-purple-100 border-purple-300 text-purple-800 scale-[1.02]'
                    : 'bg-white border-purple-100 text-purple-500 hover:bg-purple-50'}`}>
                  {LESSON_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-body font-600 text-purple-600 mb-1 block">
              ⭐ Награда {!rewardable && <span className="text-purple-300">(недоступно для этого типа)</span>}
            </label>
            <input type="number" min={0} max={100} disabled={!rewardable} value={rewardable ? stars : 0}
              onChange={e => setStars(parseInt(e.target.value) || 0)}
              className={`input-magic w-full ${!rewardable ? 'opacity-50 cursor-not-allowed' : ''}`} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={() => onOpenChange(false)} className={ghostBtn}>Отмена</button>
          <button onClick={submit} disabled={!title.trim() || busy} className={primaryBtn}>{busy ? '…' : 'Создать'}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Add-unit dialog ----------
function AddUnitDialog({ open, onOpenChange, onCreate, lang }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreate: (title: string, emoji: string) => Promise<void>; lang: Lang;
}) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🏝️');
  const [busy, setBusy] = useState(false);
  const EMOJI_CHOICES = ['🏝️','🌈','🐣','🍭','🎈','🚀','🐶','🧸','🍎','🎨','🦄','⭐'];
  useEffect(() => { if (open) { setTitle(''); setEmoji('🏝️'); } }, [open]);
  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onCreate(title.trim(), emoji);
      onOpenChange(false);
    } catch {
      // The parent handler owns the user-facing error toast.
    }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-pink-50 via-white to-purple-50 border-2 border-purple-200 rounded-3xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-purple-700">✨ {t(lang, 'wb_new_unit')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-body font-600 text-purple-600 mb-1 block">{t(lang, 'wb_unit_icon')}</label>
            <div className="flex flex-wrap gap-1">
              {EMOJI_CHOICES.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  className={`text-2xl w-10 h-10 rounded-xl border-2 transition ${emoji === e ? 'bg-purple-100 border-purple-400 scale-110' : 'bg-white border-purple-100 hover:bg-purple-50'}`}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-body font-600 text-purple-600 mb-1 block">{t(lang, 'wb_unit_name')}</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && title.trim()) submit(); }}
              className="input-magic w-full" placeholder={t(lang, 'wb_unit_placeholder')} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={() => onOpenChange(false)} className={ghostBtn}>{t(lang, 'wb_cancel')}</button>
          <button onClick={submit} disabled={!title.trim() || busy} className={primaryBtn}>{busy ? '…' : t(lang, 'wb_create_action')}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Lesson editor ----------
function LessonEditor({ lesson, onSaved, onDelete }: { lesson: Lesson; onSaved: () => void; onDelete: () => void }) {
  const [local, setLocal] = useState<Lesson>(lesson);
  const [tasks, setTasks] = useState<InteractiveTask[]>([]);
  const [taskDialog, setTaskDialog] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refresh = () => listTasks(lesson.id).then(setTasks);
  useEffect(() => { setLocal(lesson); refresh(); }, [lesson.id]);

  const rewardable = canReward(local.type);
  const theoryTask = tasks.find(task => task.mechanic_type === 'theory_content');
  const gameTasks = tasks.filter(task => task.mechanic_type !== 'theory_content');
  const saveMeta = async () => {
    await updateLesson(lesson.id, { title: local.title, type: local.type, stars_reward: rewardable ? local.stars_reward : 0 });
    toast.success('Урок сохранён');
    onSaved();
  };
  const pickMechanic = async (m: MechanicType) => {
    await createTask(lesson.id, m);
    toast.success('Задание добавлено');
    refresh();
  };

  return (
    <div className="space-y-4 rounded-3xl bg-gradient-to-br from-white via-pink-50/40 to-purple-50/70 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <input value={local.title} onChange={e => setLocal({ ...local, title: e.target.value })}
          className="input-magic !text-sm" placeholder="Название урока" />
        <Select value={local.type} onValueChange={value => setLocal({ ...local, type: value as LessonKind })}>
          <SelectTrigger className="h-12 rounded-2xl border border-pink-100 bg-white/95 px-4 font-body text-sm font-extrabold text-purple-700 shadow-sm transition hover:border-pink-200 hover:bg-pink-50/70 focus:ring-2 focus:ring-pink-200 dark:border-purple-700/60 dark:bg-[#241331] dark:text-purple-100 dark:hover:bg-[#2f1b42]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border border-pink-100 bg-white/95 p-1 shadow-2xl backdrop-blur dark:border-purple-700 dark:bg-[#241331]">
            {LESSON_KINDS.map(k => (
              <SelectItem
                key={k}
                value={k}
                className="rounded-xl py-2 font-body text-sm font-bold text-purple-700 focus:bg-pink-50 focus:text-purple-800 dark:text-purple-100 dark:focus:bg-purple-900/60"
              >
                {LESSON_KIND_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-purple-100 bg-white/80 p-3">
        <label className="text-xs font-body font-800 uppercase tracking-wider text-purple-500">⭐ Награда</label>
        <input type="number" min={0} max={100} disabled={!rewardable}
          value={rewardable ? local.stars_reward : 0}
          onChange={e => setLocal({ ...local, stars_reward: parseInt(e.target.value) || 0 })}
          className={`input-magic !py-1 !text-sm w-20 ${!rewardable ? 'opacity-50 cursor-not-allowed' : ''}`} />
        {!rewardable && <span className="text-xs text-purple-400">(для домашки, практики и контрольной)</span>}
        <button onClick={saveMeta} className="ml-auto inline-flex items-center gap-1 rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-800 text-emerald-700 transition hover:bg-emerald-200">
          <Save className="h-3.5 w-3.5" /> Сохранить урок
        </button>
      </div>

      {local.type === 'theory' ? (
        <TheoryLessonEditor
          lessonTitle={local.title}
          task={theoryTask}
          onCreate={async (content: TheoryContent) => {
            const created = await createTask(lesson.id, 'theory_content', content);
            if (!created) throw new Error('Не удалось создать теоретическую страницу');
            refresh();
          }}
          onSave={async (content: TheoryContent) => {
            if (!theoryTask) return;
            await updateTaskPayload(theoryTask.id, content);
            refresh();
          }}
        />
      ) : (
      <div className="space-y-3 rounded-3xl border border-purple-100 bg-white p-4">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-pink-400" />
          <span className="font-body text-xs font-800 uppercase tracking-wider text-purple-500">Задания ({gameTasks.length})</span>
          <button onClick={() => setTaskDialog(true)} className="ml-auto inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-pink-400 to-purple-500 px-3 py-1.5 text-xs font-800 text-white shadow transition hover:-translate-y-0.5">
            <Plus className="w-3 h-3"/>Добавить задание
          </button>
        </div>
        <AnimatePresence initial={false}>
          {gameTasks.map(tk => (
            <TaskCard key={tk.id} task={tk}
              onDelete={async () => { await deleteTask(tk.id); refresh(); toast.success('Задание удалено'); }}
              onChange={async (p) => { await updateTaskPayload(tk.id, p); refresh(); }} />
          ))}
        </AnimatePresence>
      </div>
      )}

      <button onClick={() => setDeleteOpen(true)} className="inline-flex items-center gap-1 text-xs font-700 text-red-500 hover:text-red-700">
        <Trash2 className="w-3 h-3"/> Удалить урок
      </button>

      <AddTaskDialog open={taskDialog} onOpenChange={setTaskDialog} onPick={pickMechanic} />
      <ConfirmDelete open={deleteOpen} onOpenChange={setDeleteOpen}
        title="Удалить урок?" description={`Урок «${local.title}» и все его задания будут удалены безвозвратно.`}
        onConfirm={async () => { setDeleteOpen(false); await deleteLesson(lesson.id); toast.success('Урок удалён'); onDelete(); }} />
    </div>
  );
}

// ---------- Unit node ----------
function UnitNode({ unit, onChanged }: { unit: Unit; onChanged: () => void }) {
  const [open, setOpen] = useState(true);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [title, setTitle] = useState(unit.title);
  const [addLessonOpen, setAddLessonOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refresh = () => listLessons(unit.id).then(setLessons);
  useEffect(() => { if (open) refresh(); }, [open, unit.id]);

  const submitLesson = async ({ title, type, stars }: { title: string; type: LessonKind; stars: number }) => {
    const l = await createLesson(unit.id, title, type);
    if (l) {
      if (stars !== l.stars_reward) await updateLesson(l.id, { stars_reward: stars });
      toast.success('Урок создан');
      refresh();
      setOpenLesson(l.id);
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
      className="rounded-3xl border border-pink-100 bg-white p-4 shadow-sm shadow-purple-100/50 dark:border-purple-700/60 dark:bg-[#211331] dark:shadow-none">
      <div className="group flex flex-wrap items-center gap-3">
        <button onClick={() => setOpen(o => !o)} className="rounded-xl bg-purple-50 p-2 text-purple-500 transition hover:bg-purple-100 dark:bg-[#2f1b42] dark:text-purple-100 dark:hover:bg-[#3a2451]">{open ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}</button>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 text-xl shadow-inner dark:from-[#3a2451] dark:to-[#2a183a]">{unit.emoji || DEFAULT_UNIT_EMOJI}</span>
        <input value={title} onChange={e => setTitle(e.target.value)}
          onBlur={() => title !== unit.title && updateUnit(unit.id, { title }).then(onChanged)}
          className="min-w-[10rem] flex-1 border-b border-transparent bg-transparent font-display text-xl font-black text-purple-800 outline-none focus:border-purple-300 dark:text-purple-100" />
        <button onClick={() => setAddLessonOpen(true)}
          className="inline-flex items-center gap-1 rounded-xl bg-purple-100 px-3 py-2 text-xs font-800 text-purple-700 transition hover:bg-purple-200 dark:bg-[#2f1b42] dark:text-purple-100 dark:hover:bg-[#3a2451]">
          <Plus className="w-3 h-3"/> Добавить урок
        </button>
        <button onClick={() => setDeleteOpen(true)} className="rounded-xl p-2 text-red-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5"/></button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3 overflow-hidden">
            <AnimatePresence initial={false}>
              {lessons.map(l => (
                <motion.div key={l.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="overflow-hidden rounded-3xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/60 dark:border-purple-700/50 dark:from-[#2a183a] dark:to-[#211331]">
                  <button onClick={() => setOpenLesson(id => id === l.id ? null : l.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/70 dark:hover:bg-white/5">
                    {openLesson === l.id ? <ChevronDown className="w-4 h-4 text-purple-500"/> : <ChevronRight className="w-4 h-4 text-purple-500"/>}
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-xs font-black text-purple-700 shadow-sm dark:bg-[#1b1028] dark:text-purple-100">#{l.lesson_number}</span>
                    <span className="flex-1 font-display text-base font-black text-purple-800 dark:text-purple-100">{l.title}</span>
                    <span className="hidden rounded-full bg-white px-3 py-1 text-xs font-800 text-purple-500 shadow-sm sm:inline-flex dark:bg-[#1b1028] dark:text-purple-200">{LESSON_KIND_LABEL[l.type]}</span>
                    {canReward(l.type) && <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-800 text-yellow-600">⭐ {l.stars_reward}</span>}
                  </button>
                  {openLesson === l.id && <div className="p-3 border-t border-purple-100"><LessonEditor lesson={l} onSaved={refresh} onDelete={() => { setOpenLesson(null); refresh(); }} /></div>}
                </motion.div>
              ))}
            </AnimatePresence>
            {lessons.length === 0 && (
              <div className="rounded-3xl border border-dashed border-purple-200 bg-purple-50/70 p-6 text-center font-body text-sm font-700 text-purple-400">
                Уроков пока нет. Добавьте первый урок для этого юнита.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AddLessonDialog open={addLessonOpen} onOpenChange={setAddLessonOpen} defaultNumber={lessons.length + 1} onCreate={submitLesson} />
      <ConfirmDelete open={deleteOpen} onOpenChange={setDeleteOpen}
        title="Удалить юнит?" description={`Юнит «${unit.title}» и все его уроки будут удалены безвозвратно.`}
        onConfirm={async () => { setDeleteOpen(false); await deleteUnit(unit.id); toast.success('Юнит удалён'); onChanged(); }} />
    </motion.div>
  );
}

// ---------- Workbook node ----------
function WorkbookAccessPanel({ wb, students, onChanged, lang }: { wb: Workbook; students: User[]; onChanged: () => void; lang: Lang }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignmentsReady, setAssignmentsReady] = useState(true);
  const selectedMode = !wb.is_published;

  const labels = {
    ru: {
      accessLabel: 'Access Control',
      title: 'Кому доступен воркбук',
      all: 'Всем ученикам',
      selected: 'Выбранным ученикам',
      selectedHint: 'Отметьте детей, которым нужно показать этот интерактив.',
      noStudents: 'Пока нет учеников для выбора.',
      needsDb: 'Назначения включатся после применения миграции Supabase.',
      save: 'Сохранить доступ',
      saved: 'Доступ сохранён',
      loadError: 'Не удалось загрузить назначения',
      saveError: 'Не удалось сохранить доступ',
    },
    en: {
      accessLabel: 'Access Control',
      title: 'Workbook access',
      all: 'All students',
      selected: 'Selected students',
      selectedHint: 'Choose which children should see this interactive workbook.',
      noStudents: 'No students to choose yet.',
      needsDb: 'Assignments will turn on after the Supabase migration is applied.',
      save: 'Save access',
      saved: 'Access saved',
      loadError: 'Could not load assignments',
      saveError: 'Could not save access',
    },
    ua: {
      accessLabel: 'Access Control',
      title: 'Кому доступний воркбук',
      all: 'Усім учням',
      selected: 'Обраним учням',
      selectedHint: 'Позначте дітей, яким потрібно показати цей інтерактив.',
      noStudents: 'Поки немає учнів для вибору.',
      needsDb: 'Призначення увімкнуться після застосування міграції Supabase.',
      save: 'Зберегти доступ',
      saved: 'Доступ збережено',
      loadError: 'Не вдалося завантажити призначення',
      saveError: 'Не вдалося зберегти доступ',
    },
  }[lang];

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listWorkbookAssignments(wb.id);
      setSelectedIds(rows.filter(row => row.assignee_type === 'student' && row.user_id).map(row => row.user_id!));
      setAssignmentsReady(true);
    } catch (error) {
      setAssignmentsReady(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [wb.id]);

  const setMode = async (mode: 'all' | 'selected') => {
    const nextPublished = mode === 'all';
    if (nextPublished === wb.is_published) return;
    try {
      await updateWorkbook(wb.id, { is_published: nextPublished });
      onChanged();
    } catch (error) {
      toast.error(`${labels.saveError}: ${errorText(error, 'Supabase access denied')}`);
    }
  };

  const toggleStudent = (studentId: string) => {
    setSelectedIds(prev => prev.includes(studentId)
      ? prev.filter(id => id !== studentId)
      : [...prev, studentId]);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateWorkbook(wb.id, { is_published: false });
      await setWorkbookStudentAssignments(wb.id, selectedIds);
      toast.success(labels.saved);
      onChanged();
    } catch (error) {
      toast.error(`${labels.saveError}: ${errorText(error, 'Supabase access denied')}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-3xl border border-pink-100 bg-gradient-to-br from-white via-pink-50/60 to-violet-50/70 p-4 dark:border-purple-700/50 dark:from-[#241331] dark:via-[#21112e] dark:to-[#1a1028]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-purple-500 shadow-sm dark:bg-[#2f1b42] dark:text-pink-200">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <div className="mb-1 inline-flex rounded-full bg-pink-100/80 px-3 py-1 font-body text-[10px] font-extrabold uppercase tracking-wider text-pink-500 shadow-sm dark:bg-pink-500/15 dark:text-pink-200">
              {labels.accessLabel}
            </div>
            <div className="font-display text-xl font-black text-purple-700 dark:text-purple-100">{labels.title}</div>
            <div className="font-body text-xs font-bold text-purple-400 dark:text-purple-300">
              {selectedMode ? labels.selectedHint : labels.all}
            </div>
          </div>
        </div>
        <div className="flex gap-2 rounded-2xl bg-white p-1 shadow-sm dark:bg-[#2f1b42]">
          <button type="button" onClick={() => setMode('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-body font-800 transition ${!selectedMode ? 'bg-gradient-to-r from-pink-300 to-violet-400 text-white shadow-sm' : 'text-purple-400 hover:text-purple-600 dark:text-purple-200'}`}>
            {labels.all}
          </button>
          <button type="button" onClick={() => setMode('selected')}
            className={`rounded-xl px-3 py-1.5 text-xs font-body font-800 transition ${selectedMode ? 'bg-gradient-to-r from-pink-300 to-violet-400 text-white shadow-sm' : 'text-purple-400 hover:text-purple-600 dark:text-purple-200'}`}>
            {labels.selected}
          </button>
        </div>
      </div>

      {selectedMode && (
        <div className="space-y-3">
          {!assignmentsReady ? (
            <p className="rounded-2xl bg-yellow-50 p-3 text-xs font-body text-yellow-700">{labels.needsDb}</p>
          ) : loading ? (
            <p className="text-xs text-purple-400">...</p>
          ) : students.length === 0 ? (
            <p className="rounded-2xl bg-purple-50 p-3 text-xs text-purple-400">{labels.noStudents}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {students.map(student => {
                const checked = selectedIds.includes(student.id);
                return (
                  <label key={student.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${checked ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-600/50 dark:bg-emerald-950/40 dark:text-emerald-100' : 'border-purple-100 bg-white text-purple-500 hover:border-pink-200 hover:bg-pink-50/60 dark:border-purple-700/60 dark:bg-[#2a183a] dark:text-purple-100 dark:hover:bg-[#342047]'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleStudent(student.id)}
                      className="h-4 w-4 accent-pink-400" />
                    <span className="min-w-0">
                      <span className="block truncate font-body text-sm font-700">{student.name}</span>
                      <span className="block truncate font-body text-xs text-purple-300">{student.email}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <button type="button" onClick={save} disabled={saving || !assignmentsReady}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-300 to-violet-400 px-4 py-2 text-sm font-body font-800 text-white shadow-lg shadow-pink-200/40 transition hover:-translate-y-0.5 disabled:opacity-50 dark:shadow-none">
            <CheckCircle2 className="h-4 w-4" />
            {saving ? '...' : labels.save}
          </button>
        </div>
      )}
    </div>
  );
}

function WorkbookNode({ wb, onChanged, lang, students }: { wb: Workbook; onChanged: () => void; lang: Lang; students: User[] }) {
  const [open, setOpen] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [title, setTitle] = useState(wb.title);
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refresh = async () => {
    try {
      setUnits(sortUnits(await listUnits(wb.id)));
    } catch (error) {
      toast.error(`${t(lang, 'wb_units_load_error')}: ${errorText(error, t(lang, 'wb_unknown_error'))}`);
    }
  };
  useEffect(() => { refresh(); }, [wb.id]);

  const submitUnit = async (title: string, emoji: string) => {
    try {
      const created = await createUnit(wb.id, title, emoji);
      if (!created) throw new Error(t(lang, 'wb_unknown_error'));
      setUnits(prev => sortUnits([...prev.filter(unit => unit.id !== created.id), created]));
      toast.success(t(lang, 'wb_unit_created'));
    } catch (error) {
      toast.error(`${t(lang, 'wb_unit_create_error')}: ${errorText(error, t(lang, 'wb_unknown_error'))}`);
      throw error;
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      className="overflow-hidden rounded-[2rem] border border-pink-100 bg-white shadow-xl shadow-purple-100/40 dark:border-purple-700/60 dark:bg-[#1b1028] dark:shadow-none">
      <div className="group flex flex-wrap items-center gap-3 border-b border-pink-100 bg-gradient-to-r from-white via-pink-50/80 to-violet-50 px-4 py-4 sm:px-5 dark:border-purple-700/50 dark:from-[#241331] dark:via-[#21112e] dark:to-[#1a1028]">
        <button onClick={() => setOpen(o => !o)} className="shrink-0 rounded-xl bg-white p-2 text-purple-500 shadow-sm transition hover:bg-purple-50 dark:bg-[#2f1b42] dark:text-purple-100 dark:hover:bg-[#3a2451]">{open ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}</button>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-300 to-violet-400 text-white shadow-lg dark:from-pink-500/70 dark:to-purple-500/70">
          <BookOpen className="h-6 w-6" />
        </span>
        <input value={title} onChange={e => setTitle(e.target.value)}
          onBlur={() => title !== wb.title && updateWorkbook(wb.id, { title }).then(onChanged)}
          className="min-w-[8rem] flex-1 border-b border-transparent bg-transparent font-display text-2xl font-black text-purple-800 outline-none focus:border-purple-300 dark:text-purple-100" />
        <button onClick={() => setDeleteOpen(true)}
          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl transition"><Trash2 className="w-4 h-4"/></button>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
      <WorkbookAccessPanel wb={wb} students={students} onChanged={onChanged} lang={lang} />
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden">
            <AnimatePresence initial={false}>
              {units.map(u => <UnitNode key={u.id} unit={u} onChanged={refresh} />)}
            </AnimatePresence>
            <div>
              <button onClick={() => setAddUnitOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-purple-200 bg-purple-50 px-4 py-2 text-sm font-800 text-purple-700 transition hover:border-pink-300 hover:bg-pink-50"><Plus className="w-4 h-4"/> {t(lang, 'wb_add_unit')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      <AddUnitDialog open={addUnitOpen} onOpenChange={setAddUnitOpen} onCreate={submitUnit} lang={lang} />
      <ConfirmDelete open={deleteOpen} onOpenChange={setDeleteOpen}
        title={t(lang, 'wb_delete_workbook_title')} description={`${t(lang, 'wb_delete_workbook_desc_prefix')} «${wb.title}» ${t(lang, 'wb_delete_workbook_desc_suffix')}`}
        onConfirm={async () => { setDeleteOpen(false); await deleteWorkbook(wb.id); toast.success(t(lang, 'wb_workbook_deleted')); onChanged(); }} />
    </motion.div>
  );
}

// ---------- ROOT ----------
export default function WorkbookBuilder({ lang = 'ru', students = [] }: { lang?: Lang; students?: User[] }) {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { setWorkbooks(await listWorkbooks()); }
    catch (error: any) { toast.error(`${t(lang, 'wb_db_error')}: ${error?.message || t(lang, 'wb_load_error')}`); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const openCreate = () => { setNewTitle(''); setShowCreate(true); };
  const submitCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const created = await createWorkbook(title);
      if (created) setWorkbooks(prev => [...prev, created]);
      toast.success(t(lang, 'wb_workbook_created'));
      setShowCreate(false);
      setNewTitle('');
      await refresh();
    } catch (error: any) {
      toast.error(`${t(lang, 'wb_db_error')}: ${error?.message || t(lang, 'wb_unknown_error')}`);
    } finally { setCreating(false); }
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[2rem] border border-pink-100 bg-gradient-to-br from-white via-pink-50 to-violet-50 shadow-xl shadow-purple-100/40 dark:border-purple-700/60 dark:from-[#241331] dark:via-[#21112e] dark:to-[#1a1028] dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-200 via-fuchsia-200 to-violet-300 text-purple-700 shadow-lg shadow-pink-100/60 dark:from-pink-500/40 dark:via-purple-500/40 dark:to-sky-500/30 dark:text-purple-100 dark:shadow-none">
            <Layers3 className="h-7 w-7" />
          </span>
          <div>
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-800 uppercase tracking-wider text-pink-500 shadow-sm dark:bg-[#2f1b42] dark:text-pink-200">
              <Sparkles className="h-3.5 w-3.5" /> Content studio
            </div>
            <h3 className="font-display text-2xl font-black text-purple-800 dark:text-purple-100">{t(lang, 'wb_title')}</h3>
            <p className="font-body text-sm font-700 text-purple-400 dark:text-purple-200">{t(lang, 'wb_subtitle')}</p>
          </div>
        </div>
        <button onClick={openCreate} className={primaryBtn + ' inline-flex items-center gap-1'}>
          <Plus className="w-4 h-4"/> {t(lang, 'wb_create')}
        </button>
        </div>
      </div>
      {loading && <p className="text-sm text-purple-400">…</p>}
      {!loading && workbooks.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center">
          <div className="text-5xl mb-3">📚</div>
          <p className="font-body text-purple-500">{t(lang, 'wb_empty')}</p>
        </div>
      )}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {workbooks.map(w => <WorkbookNode key={w.id} wb={w} onChanged={refresh} lang={lang} students={students} />)}
        </AnimatePresence>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-gradient-to-br from-pink-50 via-white to-purple-50 border-2 border-purple-200 rounded-3xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-purple-700">✨ {t(lang, 'wb_create_title')}</DialogTitle>
          </DialogHeader>
          <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newTitle.trim()) submitCreate(); }}
            placeholder={t(lang, 'wb_name_placeholder')} className="input-magic w-full" />
          <DialogFooter className="gap-2">
            <button onClick={() => setShowCreate(false)} className={ghostBtn}>{t(lang, 'wb_cancel')}</button>
            <button onClick={submitCreate} disabled={!newTitle.trim() || creating} className={primaryBtn}>
              {creating ? '…' : t(lang, 'wb_save')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
