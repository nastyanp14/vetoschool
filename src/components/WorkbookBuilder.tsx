import { useEffect, useMemo, useState } from 'react';
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
import { MECHANICS, MechanicType, canReward, LessonKind, REWARDABLE_KINDS } from '../lib/mechanics';
import { Lang, t } from '../lib/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const LESSON_KINDS: LessonKind[] = ['theory','class_task','homework','practice','checkpoint'];

const FULL_MECHANICS: MechanicType[] = ['matching','word_lego','fill_letters','anagram_unscramble'];

// ---------- Asset preview (loads signed URL on demand) ----------
function AssetImg({ path, className }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let alive = true; signedUrlFor(path).then(u => { if (alive) setUrl(u); }); return () => { alive = false; }; }, [path]);
  if (!url) return <div className={`bg-purple-100 animate-pulse ${className}`} />;
  return <img src={url} alt="" className={className} />;
}

// ---------- File upload button ----------
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

// ---------- Pair editor (matching / word_lego) ----------
type Side = { text?: string; image?: string };
type Pair = { left: Side; right: Side };
function PairEditor({ payload, onChange }: { payload: any; onChange: (p: any) => void }) {
  const pairs: Pair[] = payload?.pairs || [];
  const update = (next: Pair[]) => onChange({ ...payload, pairs: next });
  const addPair = () => update([...pairs, { left: { text: '' }, right: { text: '' } }]);
  const removePair = (i: number) => update(pairs.filter((_, idx) => idx !== i));
  const setSide = (i: number, side: 'left'|'right', patch: Partial<Side>) => {
    const next = pairs.map((p, idx) => idx === i ? { ...p, [side]: { ...p[side], ...patch } } : p);
    update(next);
  };

  return (
    <div className="space-y-2">
      {pairs.length === 0 && <p className="text-xs text-purple-400 italic">Пока пар нет — добавьте первую.</p>}
      {pairs.map((p, i) => (
        <div key={i} className="flex items-center gap-2 bg-white/60 p-2 rounded-xl border border-purple-100">
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
        </div>
      ))}
      <button onClick={addPair} className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-xl inline-flex items-center gap-1"><Plus className="w-3 h-3" /> добавить пару</button>
    </div>
  );
}

// ---------- Fill letters editor ----------
function FillEditor({ payload, onChange }: { payload: any; onChange: (p: any) => void }) {
  const text: string = payload?.text || '';
  return (
    <div className="space-y-2">
      <p className="text-xs text-purple-500">Замените пропуски знаком <b>___</b> (три подчёркивания). Пример: <i>The c___ is on the m___.</i></p>
      <textarea value={text} onChange={e => onChange({ ...payload, text: e.target.value })}
        rows={4} className="input-magic w-full !text-sm" placeholder="I ___ a student. She ___ happy." />
      <p className="text-xs text-purple-400">Правильные ответы вводите ниже, по одному на строку (в порядке появления пропусков):</p>
      <textarea value={(payload?.answers || []).join('\n')}
        onChange={e => onChange({ ...payload, answers: e.target.value.split('\n').map(s=>s.trim()).filter(Boolean) })}
        rows={3} className="input-magic w-full !text-sm font-mono" placeholder="am&#10;is" />
    </div>
  );
}

// ---------- Anagram editor ----------
function AnagramEditor({ payload, onChange }: { payload: any; onChange: (p: any) => void }) {
  return (
    <div>
      <p className="text-xs text-purple-500 mb-1">Введите правильное слово или короткую фразу. Ученик увидит буквы в перемешанном порядке.</p>
      <input type="text" value={payload?.answer || ''} onChange={e => onChange({ ...payload, answer: e.target.value })}
        className="input-magic w-full" placeholder="ELEPHANT" />
    </div>
  );
}

// ---------- Task card ----------
function TaskCard({ task, onDelete, onChange }: { task: InteractiveTask; onDelete: () => void; onChange: (p: any) => void }) {
  const def = MECHANICS.find(m => m.id === task.mechanic_type);
  const [payload, setPayload] = useState<any>(task.payload_json || {});
  const [dirty, setDirty] = useState(false);

  const update = (p: any) => { setPayload(p); setDirty(true); };
  const save = async () => { await onChange(payload); setDirty(false); };

  const isFull = FULL_MECHANICS.includes(task.mechanic_type);
  return (
    <div className="bg-white/70 border border-purple-100 rounded-2xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-body font-600 text-sm text-purple-700">
          <span className="mr-1">{def?.emoji}</span>{def?.label}
        </div>
        <div className="flex items-center gap-2">
          {isFull && dirty && <button onClick={save} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg">Сохранить</button>}
          <button onClick={onDelete} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {task.mechanic_type === 'matching' || task.mechanic_type === 'word_lego'
        ? <PairEditor payload={payload} onChange={update} />
        : task.mechanic_type === 'fill_letters'
          ? <FillEditor payload={payload} onChange={update} />
        : task.mechanic_type === 'anagram_unscramble'
          ? <AnagramEditor payload={payload} onChange={update} />
        : <div className="text-xs text-purple-400 italic bg-purple-50 rounded-xl p-3 text-center">🚧 Механика «{def?.label}» — в разработке. Данные пока не редактируются.</div>}
    </div>
  );
}

// ---------- Lesson editor ----------
function LessonEditor({ lesson, onSaved, onDelete }: { lesson: Lesson; onSaved: () => void; onDelete: () => void }) {
  const [local, setLocal] = useState<Lesson>(lesson);
  const [tasks, setTasks] = useState<InteractiveTask[]>([]);
  const [addingMech, setAddingMech] = useState<MechanicType | ''>('');

  const refresh = () => listTasks(lesson.id).then(setTasks);
  useEffect(() => { setLocal(lesson); refresh(); }, [lesson.id]);

  const rewardable = canReward(local.type);
  const saveMeta = async () => {
    await updateLesson(lesson.id, { title: local.title, type: local.type, stars_reward: rewardable ? local.stars_reward : 0 });
    onSaved();
  };
  const addTask = async () => {
    if (!addingMech) return;
    await createTask(lesson.id, addingMech as MechanicType);
    setAddingMech('');
    refresh();
  };

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-2">
        <input value={local.title} onChange={e => setLocal({ ...local, title: e.target.value })}
          className="input-magic !text-sm sm:col-span-2" placeholder="Название урока" />
        <select value={local.type} onChange={e => setLocal({ ...local, type: e.target.value as LessonKind })} className="input-magic !text-sm">
          {LESSON_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-body font-600 text-purple-600">⭐ Награда:</label>
        <input type="number" min={0} max={100} disabled={!rewardable}
          value={rewardable ? local.stars_reward : 0}
          onChange={e => setLocal({ ...local, stars_reward: parseInt(e.target.value) || 0 })}
          className={`input-magic !py-1 !text-sm w-20 ${!rewardable ? 'opacity-50 cursor-not-allowed' : ''}`} />
        {!rewardable && <span className="text-xs text-purple-400">(только для homework/practice/checkpoint)</span>}
        <button onClick={saveMeta} className="ml-auto text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-xl hover:bg-green-200">💾 Сохранить урок</button>
      </div>

      <div className="border-t border-purple-100 pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-600 text-purple-500">Задания ({tasks.length}):</span>
          <select value={addingMech} onChange={e => setAddingMech(e.target.value as any)} className="input-magic !py-1 !text-xs flex-1">
            <option value="">— выберите механику —</option>
            {MECHANICS.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.label}{FULL_MECHANICS.includes(m.id) ? '' : ' 🚧'}</option>)}
          </select>
          <button onClick={addTask} disabled={!addingMech} className="text-xs bg-purple-500 hover:bg-purple-600 text-white px-3 py-1.5 rounded-xl disabled:opacity-40 inline-flex items-center gap-1"><Plus className="w-3 h-3"/>Добавить</button>
        </div>
        {tasks.map(tk => (
          <TaskCard key={tk.id} task={tk}
            onDelete={async () => { await deleteTask(tk.id); refresh(); }}
            onChange={async (p) => { await updateTaskPayload(tk.id, p); refresh(); }} />
        ))}
      </div>
      <button onClick={async () => { if (confirm('Удалить урок целиком?')) { await deleteLesson(lesson.id); onDelete(); } }}
        className="text-xs text-red-500 hover:text-red-700 inline-flex items-center gap-1"><Trash2 className="w-3 h-3"/> Удалить урок</button>
    </div>
  );
}

// ---------- Unit node ----------
function UnitNode({ unit, onChanged }: { unit: Unit; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [title, setTitle] = useState(unit.title);

  const refresh = () => listLessons(unit.id).then(setLessons);
  useEffect(() => { if (open) refresh(); }, [open, unit.id]);

  const addLesson = async () => {
    const l = await createLesson(unit.id, `Урок ${lessons.length + 1}`, 'practice');
    if (l) { refresh(); setOpenLesson(l.id); }
  };

  return (
    <div className="ml-4 border-l-2 border-purple-200 pl-3 py-1">
      <div className="flex items-center gap-2 group">
        <button onClick={() => setOpen(o => !o)} className="text-purple-500">{open ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}</button>
        <span className="text-xl">{unit.emoji}</span>
        <input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => title !== unit.title && updateUnit(unit.id, { title }).then(onChanged)}
          className="font-body font-600 text-sm bg-transparent border-b border-transparent focus:border-purple-300 outline-none flex-1" />
        <button onClick={async () => { if (confirm('Удалить юнит и все уроки?')) { await deleteUnit(unit.id); onChanged(); } }}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5"/></button>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          {lessons.map(l => (
            <div key={l.id} className="bg-white/60 rounded-2xl border border-purple-100 overflow-hidden">
              <button onClick={() => setOpenLesson(id => id === l.id ? null : l.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-purple-50">
                {openLesson === l.id ? <ChevronDown className="w-4 h-4 text-purple-500"/> : <ChevronRight className="w-4 h-4 text-purple-500"/>}
                <span className="text-xs bg-purple-200 text-purple-800 rounded-full px-2 py-0.5 font-bold">#{l.lesson_number}</span>
                <span className="font-body text-sm text-purple-700 flex-1">{l.title}</span>
                <span className="text-xs text-purple-400">{l.type}</span>
                {canReward(l.type) && <span className="text-xs text-yellow-600">⭐{l.stars_reward}</span>}
              </button>
              {openLesson === l.id && <div className="p-3 border-t border-purple-100"><LessonEditor lesson={l} onSaved={refresh} onDelete={() => { setOpenLesson(null); refresh(); }} /></div>}
            </div>
          ))}
          <button onClick={addLesson} className="text-xs bg-pink-100 text-pink-700 hover:bg-pink-200 px-3 py-1.5 rounded-xl inline-flex items-center gap-1"><Plus className="w-3 h-3"/> Добавить урок</button>
        </div>
      )}
    </div>
  );
}

// ---------- Workbook node ----------
function WorkbookNode({ wb, onChanged }: { wb: Workbook; onChanged: () => void }) {
  const [open, setOpen] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [title, setTitle] = useState(wb.title);

  const refresh = () => listUnits(wb.id).then(setUnits);
  useEffect(() => { refresh(); }, [wb.id]);

  return (
    <div className="glass rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2 group">
        <button onClick={() => setOpen(o => !o)} className="text-purple-500">{open ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}</button>
        <span className="text-2xl">📘</span>
        <input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => title !== wb.title && updateWorkbook(wb.id, { title }).then(onChanged)}
          className="font-display font-bold text-lg text-purple-800 bg-transparent border-b border-transparent focus:border-purple-300 outline-none flex-1" />
        <label className="flex items-center gap-1 text-xs text-purple-500">
          <input type="checkbox" checked={wb.is_published} onChange={e => updateWorkbook(wb.id, { is_published: e.target.checked }).then(onChanged)} />
          опубликован
        </label>
        <button onClick={async () => { if (confirm('Удалить весь воркбук?')) { await deleteWorkbook(wb.id); onChanged(); } }}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
      </div>
      {open && (
        <div className="space-y-1">
          {units.map(u => <UnitNode key={u.id} unit={u} onChanged={refresh} />)}
          <div className="ml-4 pl-3">
            <button onClick={async () => { const t = prompt('Название юнита:'); if (t) { await createUnit(wb.id, t); refresh(); } }}
              className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-xl inline-flex items-center gap-1"><Plus className="w-3 h-3"/> Добавить юнит</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- ROOT ----------
export default function WorkbookBuilder() {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => { setLoading(true); setWorkbooks(await listWorkbooks()); setLoading(false); };
  useEffect(() => { refresh(); }, []);

  const addWorkbook = async () => {
    const title = prompt('Название воркбука:');
    if (!title) return;
    await createWorkbook(title);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-xl text-purple-700">🧱 Конструктор воркбуков</h3>
          <p className="font-body text-sm text-purple-400">Дерево: Воркбук → Юнит → Урок → Задания</p>
        </div>
        <button onClick={addWorkbook} className="bg-gradient-to-r from-pink-400 to-purple-400 text-white px-4 py-2 rounded-2xl font-body font-600 text-sm shadow-lg hover:scale-105 transition-transform inline-flex items-center gap-1">
          <Plus className="w-4 h-4"/> Создать воркбук
        </button>
      </div>
      {loading && <p className="text-sm text-purple-400">Загрузка…</p>}
      {!loading && workbooks.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center">
          <div className="text-5xl mb-3">📚</div>
          <p className="font-body text-purple-500">Пока нет воркбуков — создайте первый.</p>
        </div>
      )}
      <div className="space-y-3">
        {workbooks.map(w => <WorkbookNode key={w.id} wb={w} onChanged={refresh} />)}
      </div>
    </div>
  );
}
