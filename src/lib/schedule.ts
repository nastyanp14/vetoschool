import { storageGetSync, storageSet } from './storage';

export interface ScheduleSlot {
  id: string;
  day: string;
  time: string;
  topic: string;
}

const SCHEDULE_KEY = 'vetoschool_schedules';
type ScheduleMap = Record<string, ScheduleSlot[]>;

const getAllSchedules = (): ScheduleMap =>
  storageGetSync<ScheduleMap>(SCHEDULE_KEY) ?? {};

export const getStudentSchedule = (userId: string): ScheduleSlot[] =>
  getAllSchedules()[userId] ?? [];

export const saveStudentSchedule = async (userId: string, slots: ScheduleSlot[]): Promise<void> => {
  const all = getAllSchedules();
  all[userId] = slots;
  await storageSet(SCHEDULE_KEY, all);
};
