export function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftedDay(date: Date, offset: number) {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  shifted.setDate(shifted.getDate() + offset);
  return shifted;
}

export function dictionaryStreak(activeDays: Iterable<string>, today = new Date()) {
  const activity = new Set(activeDays);
  let cursor = shiftedDay(today, 0);

  if (!activity.has(localDayKey(cursor))) {
    cursor = shiftedDay(today, -1);
    if (!activity.has(localDayKey(cursor))) return 0;
  }

  let streak = 0;
  while (activity.has(localDayKey(cursor))) {
    streak += 1;
    cursor = shiftedDay(cursor, -1);
  }
  return streak;
}

export function currentWeekDayKeys(today = new Date()) {
  const weekday = today.getDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  const monday = shiftedDay(today, -daysSinceMonday);
  return Array.from({ length: 7 }, (_, index) => localDayKey(shiftedDay(monday, index)));
}
