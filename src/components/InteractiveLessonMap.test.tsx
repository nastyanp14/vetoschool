import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InteractiveUnits } from './InteractiveLessonMap';
import type { Lesson, Unit } from '../lib/workbooks';
const units: Unit[] = [{ id: 'a', workbook_id: 'w', title: 'English Start', unit_number: 1 }, { id: 'b', workbook_id: 'w', title: 'My Family', unit_number: 2 }];
const makeLesson = (id: string, unit_id: string): Lesson => ({ id, unit_id, title: id, type: 'class_task', lesson_number: 1, order: 1, stars_reward: 5 });
const lessons = { a: [makeLesson('Hello', 'a'), makeLesson('Letters', 'a'), makeLesson('Numbers', 'a'), makeLesson('Colors', 'a'), makeLesson('My Things', 'a'), makeLesson('Review', 'a')], b: [makeLesson('Family', 'b')] };
const progress = { Hello: { completed_at: '2026-10-13', stars_awarded: 3 } };
afterEach(cleanup);
describe('Interactive units', () => {
  it('shows all lessons, preserves sequential access and opens the selected lesson', () => {
    const onOpen = vi.fn();
    render(<InteractiveUnits units={units} lessons={lessons} progress={progress} hasAccess lang="en" onOpen={onOpen} />);
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Locked' })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onOpen).toHaveBeenCalledWith(lessons.a[1]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Locked' })[0]);
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Unit 2/ }));
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onOpen).toHaveBeenLastCalledWith(lessons.b[0]);
  });
  it('shows actual awarded stars in the reward dialog', () => {
    const rewardLessons = {
      ...lessons,
      a: [...lessons.a, { ...makeLesson('Theory', 'a'), type: 'theory' as const, stars_reward: 0 }],
    };
    const rewardProgress = {
      Hello: { completed_at: '2026-10-13', stars_awarded: 3 },
      Letters: { completed_at: '2026-10-14', stars_awarded: 4 },
      Theory: { completed_at: '2026-10-15', stars_awarded: 5 },
    };
    render(<InteractiveUnits units={units} lessons={rewardLessons} progress={rewardProgress} hasAccess lang="en" onOpen={vi.fn()} />);
    expect(screen.getByLabelText('Stars earned: 3 / 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Stars earned: 4 / 5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View rewards' }));
    expect(within(screen.getByRole('dialog')).getByText('7 ★')).toBeInTheDocument();
  });
  it('disables opening every lesson without access, including completed lessons', () => {
    render(<InteractiveUnits units={units} lessons={lessons} progress={progress} hasAccess={false} lang="en" onOpen={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Repeat' })).toBeDisabled();
    screen.getAllByRole('button', { name: 'Locked' }).forEach(button => expect(button).toBeDisabled());
  });
  it('handles an empty unit', () => {
    render(<InteractiveUnits units={units} lessons={{}} progress={{}} hasAccess lang="en" onOpen={vi.fn()} />);
    expect(screen.getByText('New lessons are coming soon.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
