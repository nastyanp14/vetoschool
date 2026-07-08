import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Plus, ChevronDown, ChevronRight, Upload, X } from 'lucide-react';
import {
  Workbook, Unit, Lesson, InteractiveTask,
  listWorkbooks, createWorkbook, updateWorkbook, deleteWorkbook,
  listUnits, createUnit, updateUnit, deleteUnit,
  listLessons, createLesson, updateLesson, deleteLesson,
  listTasks, createTask, updateTaskPayload, deleteTask,
  uploadWorkbookAsset, signedUrlFor,
} from '../lib/workbooks';
import { MECHANICS, MechanicType, canReward, LessonKind } from '../lib/mechanics';
import { Lang, t } from '../lib/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const LESSON_KINDS: LessonKind[] = ['theory','class_task','homework','practice','checkpoint'];
const LESSON_KIND_LABEL: Record<LessonKind, string> = {
  theory: '📖 Теория',
  class_task: '👩‍🏫 Задание на уроке',
  homework: '🏠 Домашка',
  practice: '🎯 Практика',
  checkpoint: '🏆 Контрольная',
};
const FULL_MECHANICS: MechanicType[] = ['matching','word_lego','fill_letters','anagram_unscramble'];

// ---------- Pretty pastel primary button ----------
const primaryBtn = 'px-4 py-2 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 text-white font-body font-600 text-sm shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed';
const ghostBtn = 'px-4 py-2 rounded-2xl bg-white border border-purple-200 text-purple-600 font-body font-600 text-sm hover:bg-purple-50';
const dangerBtn = 'px-4 py-2 rounded-2xl bg-gradient-to-r from-rose-400 to-red-500 text-white font-body font-600 text-sm shadow-lg hover:scale-105 transition-transform';

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
            className="flex items-center gap-2 bg-white/60 p-2 rounded-xl border border-purple-100">
            <span className="text-xs font-bold text-purple-500 w-5">{i+1}</span>
            {(['left','right'] as const).map(side => (
              <div key={side} className="flex-1 flex items-center gap-1">
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
            <button onClick={() => removePair(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
      <button onClick={addPair} className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-xl inline-flex items-center gap-1"><Plus className="w-3 h-3" /> добавить пару</button>
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
      className="bg-white/70 border border-purple-100 rounded-2xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-body font-600 text-sm text-purple-700">
          <span className="mr-1">{def?.emoji}</span>{def?.label}
        </div>
        <div className="flex items-center gap-2">
          {isFull && dirty && <button onClick={save} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg">Сохранить</button>}
          <button onClick={() => setConfirmOpen(true)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {task.mechanic_type === 'matching' || task.mechanic_type === 'word_lego'
        ? <PairEditor payload={payload} onChange={update} />
        : task.mechanic_type === 'fill_letters'
          ? <FillEditor payload={payload} onChange={update} />
        : task.mechanic_type === 'anagram_unscramble'
          ? <AnagramEditor payload={payload} onChange={update} />
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
function AddUnitDialog({ open, onOpenChange, onCreate }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreate: (title: string, emoji: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🏝️');
  const [busy, setBusy] = useState(false);
  const EMOJI_CHOICES = ['🏝️','🌈','🐣','🍭','🎈','🚀','🐶','🧸','🍎','🎨','🦄','⭐'];
  useEffect(() => { if (open) { setTitle(''); setEmoji('🏝️'); } }, [open]);
  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try { await onCreate(title.trim(), emoji); onOpenChange(false); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-pink-50 via-white to-purple-50 border-2 border-purple-200 rounded-3xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-purple-700">✨ Новый юнит</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-body font-600 text-purple-600 mb-1 block">Иконка</label>
            <div className="flex flex-wrap gap-1">
              {EMOJI_CHOICES.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  className={`text-2xl w-10 h-10 rounded-xl border-2 transition ${emoji === e ? 'bg-purple-100 border-purple-400 scale-110' : 'bg-white border-purple-100 hover:bg-purple-50'}`}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-body font-600 text-purple-600 mb-1 block">Название</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && title.trim()) submit(); }}
              className="input-magic w-full" placeholder="Например: Family & Friends" />
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

// ---------- Lesson editor ----------
function LessonEditor({ lesson, onSaved, onDelete }: { lesson: Lesson; onSaved: () => void; onDelete: () => void }) {
  const [local, setLocal] = useState<Lesson>(lesson);
  const [tasks, setTasks] = useState<InteractiveTask[]>([]);
  const [taskDialog, setTaskDialog] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refresh = () => listTasks(lesson.id).then(setTasks);
  useEffect(() => { setLocal(lesson); refresh(); }, [lesson.id]);

  const rewardable = canReward(local.type);
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
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-2">
        <input value={local.title} onChange={e => setLocal({ ...local, title: e.target.value })}
          className="input-magic !text-sm sm:col-span-2" placeholder="Название урока" />
        <select value={local.type} onChange={e => setLocal({ ...local, type: e.target.value as LessonKind })} className="input-magic !text-sm">
          {LESSON_KINDS.map(k => <option key={k} value={k}>{LESSON_KIND_LABEL[k]}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-body font-600 text-purple-600">⭐ Награда:</label>
        <input type="number" min={0} max={100} disabled={!rewardable}
          value={rewardable ? local.stars_reward : 0}
          onChange={e => setLocal({ ...local, stars_reward: parseInt(e.target.value) || 0 })}
          className={`input-magic !py-1 !text-sm w-20 ${!rewardable ? 'opacity-50 cursor-not-allowed' : ''}`} />
        {!rewardable && <span className="text-xs text-purple-400">(только homework/practice/checkpoint)</span>}
        <button onClick={saveMeta} className="ml-auto text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-xl hover:bg-green-200">💾 Сохранить урок</button>
      </div>

      <div className="border-t border-purple-100 pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-600 text-purple-500">Задания ({tasks.length})</span>
          <button onClick={() => setTaskDialog(true)} className="ml-auto text-xs bg-gradient-to-r from-pink-400 to-purple-400 text-white px-3 py-1.5 rounded-xl inline-flex items-center gap-1 shadow hover:scale-105 transition">
            <Plus className="w-3 h-3"/>Добавить задание
          </button>
        </div>
        <AnimatePresence initial={false}>
          {tasks.map(tk => (
            <TaskCard key={tk.id} task={tk}
              onDelete={async () => { await deleteTask(tk.id); refresh(); toast.success('Задание удалено'); }}
              onChange={async (p) => { await updateTaskPayload(tk.id, p); refresh(); }} />
          ))}
        </AnimatePresence>
      </div>

      <button onClick={() => setDeleteOpen(true)} className="text-xs text-red-500 hover:text-red-700 inline-flex items-center gap-1">
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
  const [open, setOpen] = useState(false);
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
      className="ml-4 border-l-2 border-purple-200 pl-3 py-1">
      <div className="flex items-center gap-2 group">
        <button onClick={() => setOpen(o => !o)} className="text-purple-500">{open ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}</button>
        <span className="text-xl">{unit.emoji}</span>
        <input value={title} onChange={e => setTitle(e.target.value)}
          onBlur={() => title !== unit.title && updateUnit(unit.id, { title }).then(onChanged)}
          className="font-body font-600 text-sm bg-transparent border-b border-transparent focus:border-purple-300 outline-none flex-1" />
        <button onClick={() => setDeleteOpen(true)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition"><Trash2 className="w-3.5 h-3.5"/></button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-2 overflow-hidden">
            <AnimatePresence initial={false}>
              {lessons.map(l => (
                <motion.div key={l.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white/60 rounded-2xl border border-purple-100 overflow-hidden">
                  <button onClick={() => setOpenLesson(id => id === l.id ? null : l.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-purple-50 transition">
                    {openLesson === l.id ? <ChevronDown className="w-4 h-4 text-purple-500"/> : <ChevronRight className="w-4 h-4 text-purple-500"/>}
                    <span className="text-xs bg-purple-200 text-purple-800 rounded-full px-2 py-0.5 font-bold">#{l.lesson_number}</span>
                    <span className="font-body text-sm text-purple-700 flex-1">{l.title}</span>
                    <span className="text-xs text-purple-400">{LESSON_KIND_LABEL[l.type]}</span>
                    {canReward(l.type) && <span className="text-xs text-yellow-600">⭐{l.stars_reward}</span>}
                  </button>
                  {openLesson === l.id && <div className="p-3 border-t border-purple-100"><LessonEditor lesson={l} onSaved={refresh} onDelete={() => { setOpenLesson(null); refresh(); }} /></div>}
                </motion.div>
              ))}
            </AnimatePresence>
            <button onClick={() => setAddLessonOpen(true)}
              className="text-xs bg-gradient-to-r from-pink-300 to-purple-300 text-white px-3 py-1.5 rounded-xl inline-flex items-center gap-1 shadow hover:scale-105 transition">
              <Plus className="w-3 h-3"/> Добавить урок
            </button>
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
function WorkbookNode({ wb, onChanged }: { wb: Workbook; onChanged: () => void }) {
  const [open, setOpen] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [title, setTitle] = useState(wb.title);
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refresh = () => listUnits(wb.id).then(setUnits);
  useEffect(() => { refresh(); }, [wb.id]);

  const submitUnit = async (title: string, emoji: string) => {
    await createUnit(wb.id, title, emoji);
    toast.success('Юнит создан');
    refresh();
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      className="glass rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-3 group flex-wrap">
        <button onClick={() => setOpen(o => !o)} className="text-purple-500 shrink-0">{open ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}</button>
        <span className="text-2xl shrink-0">📘</span>
        <input value={title} onChange={e => setTitle(e.target.value)}
          onBlur={() => title !== wb.title && updateWorkbook(wb.id, { title }).then(onChanged)}
          className="font-display font-bold text-lg text-purple-800 bg-transparent border-b border-transparent focus:border-purple-300 outline-none flex-1 min-w-[8rem]" />
        <label className="flex items-center gap-2 text-xs text-purple-500 select-none cursor-pointer bg-white/60 px-3 py-1.5 rounded-full border border-purple-100">
          <input type="checkbox" className="accent-purple-500 w-3.5 h-3.5" checked={wb.is_published}
            onChange={e => updateWorkbook(wb.id, { is_published: e.target.checked }).then(onChanged)} />
          <span className="font-body font-600">опубликован</span>
        </label>
        <button onClick={() => setDeleteOpen(true)}
          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl transition"><Trash2 className="w-4 h-4"/></button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="space-y-1 overflow-hidden">
            <AnimatePresence initial={false}>
              {units.map(u => <UnitNode key={u.id} unit={u} onChanged={refresh} />)}
            </AnimatePresence>
            <div className="ml-4 pl-3">
              <button onClick={() => setAddUnitOpen(true)}
                className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-xl inline-flex items-center gap-1 transition"><Plus className="w-3 h-3"/> Добавить юнит</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AddUnitDialog open={addUnitOpen} onOpenChange={setAddUnitOpen} onCreate={submitUnit} />
      <ConfirmDelete open={deleteOpen} onOpenChange={setDeleteOpen}
        title="Удалить воркбук?" description={`Воркбук «${wb.title}» со всеми юнитами, уроками и заданиями будет удалён безвозвратно.`}
        onConfirm={async () => { setDeleteOpen(false); await deleteWorkbook(wb.id); toast.success('Воркбук удалён'); onChanged(); }} />
    </motion.div>
  );
}

// ---------- ROOT ----------
export default function WorkbookBuilder({ lang = 'ru' }: { lang?: Lang }) {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { setWorkbooks(await listWorkbooks()); }
    catch (error: any) { toast.error('Ошибка базы: ' + (error?.message || 'не удалось загрузить воркбуки')); }
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
      toast.success('Воркбук создан!');
      setShowCreate(false);
      setNewTitle('');
      await refresh();
    } catch (error: any) {
      toast.error('Ошибка базы: ' + (error?.message || 'неизвестная ошибка'));
    } finally { setCreating(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-bold text-xl text-purple-700">{t(lang, 'wb_title')}</h3>
          <p className="font-body text-sm text-purple-400">{t(lang, 'wb_subtitle')}</p>
        </div>
        <button onClick={openCreate} className={primaryBtn + ' inline-flex items-center gap-1'}>
          <Plus className="w-4 h-4"/> {t(lang, 'wb_create')}
        </button>
      </div>
      {loading && <p className="text-sm text-purple-400">…</p>}
      {!loading && workbooks.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center">
          <div className="text-5xl mb-3">📚</div>
          <p className="font-body text-purple-500">{t(lang, 'wb_empty')}</p>
        </div>
      )}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {workbooks.map(w => <WorkbookNode key={w.id} wb={w} onChanged={refresh} />)}
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
