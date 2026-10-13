import { useState } from 'react';
import { CalendarDays, Clock3, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { enGB, ru, uk } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Lang } from '@/lib/i18n';

export function ConferenceSelect({ label, value, placeholder, options, onChange }: {
  label: string; value: string; placeholder?: string;
  options: { value: string; label: string }[]; onChange: (value: string) => void;
}) {
  return <Select value={value} onValueChange={onChange}>
    <SelectTrigger aria-label={label} className="conf-picker-trigger"><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent className="conf-ui conf-select-menu" position="popper" sideOffset={6} collisionPadding={16}>
      {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}

export function ConferenceDate({ label, value, lang, onChange }: {
  label: string; value: string; lang: Lang; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  const locale = { en: enGB, ru, ua: uk }[lang];
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button type="button" aria-label={label} className="conf-picker-trigger">
      <CalendarDays size={18} /><span>{selected ? format(selected, 'd MMM yyyy', { locale }) : label}</span><ChevronDown size={16} />
    </button></PopoverTrigger>
    <PopoverContent align="start" sideOffset={8} collisionPadding={16} className="conf-ui conf-picker-popover">
      <Calendar mode="single" locale={locale} weekStartsOn={1} selected={selected} defaultMonth={selected} initialFocus
        classNames={{ day_selected: 'conf-calendar-selected', day_today: 'conf-calendar-today' }}
        onSelect={date => { if (date) { onChange(format(date, 'yyyy-MM-dd')); setOpen(false); } }} />
    </PopoverContent>
  </Popover>;
}

export function ConferenceTime({ label, value, lang, onChange }: {
  label: string; value: string; lang: Lang; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hour, minute] = value.split(':');
  const labels = { en: ['Hours', 'Minutes', 'Done'], ru: ['Часы', 'Минуты', 'Готово'], ua: ['Години', 'Хвилини', 'Готово'] }[lang];
  const options = (count: number) => Array.from({ length: count }, (_, i) => {
    const text = String(i).padStart(2, '0');
    return { value: text, label: text };
  });
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button type="button" aria-label={label} className="conf-picker-trigger">
      <Clock3 size={18} /><span>{value}</span><ChevronDown size={16} />
    </button></PopoverTrigger>
    <PopoverContent align="end" sideOffset={8} collisionPadding={16} className="conf-ui conf-picker-popover conf-time-picker">
      <p className="conf-time-heading"><Clock3 size={18} />{label}</p>
      <div className="conf-time-columns">
        <div><span>{labels[0]}</span><ConferenceSelect label={labels[0]} value={hour} options={options(24)} onChange={next => onChange(`${next}:${minute}`)} /></div>
        <b>:</b>
        <div><span>{labels[1]}</span><ConferenceSelect label={labels[1]} value={minute} options={options(60)} onChange={next => onChange(`${hour}:${next}`)} /></div>
      </div>
      <button type="button" className="conf-button conf-primary" onClick={() => setOpen(false)}>{labels[2]}</button>
    </PopoverContent>
  </Popover>;
}
