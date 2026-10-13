import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InteractiveLessonMap from './InteractiveLessonMap';

const workbooks = [{ id: 'workbook-1', title: 'English Start', description: null, is_published: true }];
const units = [
  { id: 'unit-1', workbook_id: 'workbook-1', title: 'English Start', unit_number: 1 },
  { id: 'unit-2', workbook_id: 'workbook-1', title: 'Everyday English', unit_number: 2 },
];
const lessons = [
  { id: 'lesson-1', unit_id: 'unit-1', title: 'Hello!', lesson_number: 1, order: 1, type: 'practice', stars_reward: 3 },
  { id: 'lesson-2', unit_id: 'unit-1', title: 'My family', lesson_number: 2, order: 2, type: 'practice', stars_reward: 3 },
  { id: 'lesson-3', unit_id: 'unit-2', title: 'At school', lesson_number: 3, order: 1, type: 'practice', stars_reward: 3 },
  { id: 'lesson-4', unit_id: 'unit-2', title: 'My day', lesson_number: 4, order: 2, type: 'practice', stars_reward: 3 },
];

vi.mock('../lib/workbooks', () => ({
  listAvailableWorkbooks: vi.fn(async () => workbooks),
  listUnitsForWorkbooks: vi.fn(async () => units),
  listLessonsForUnits: vi.fn(async () => lessons),
  getLessonProgress: vi.fn(async () => ({
    'lesson-1': { completed_at: '2026-10-01', stars_awarded: 3 },
    'lesson-2': { completed_at: '2026-10-02', stars_awarded: 3 },
  })),
}));

vi.mock('../lib/mechanics', () => ({ canReward: () => true }));

vi.mock('./InteractiveLessonRoom', () => ({
  default: ({ lesson }: { lesson: { id: string } }) => <div data-testid="lesson-room">{lesson.id}</div>,
}));

describe('InteractiveLessonMap redesign', () => {
  afterEach(cleanup);

  it('uses real progress and schedule data without the removed decorative blocks', async () => {
    const onOpenSchedule = vi.fn();
    render(
      <InteractiveLessonMap
        userId="student-1"
        hasAccess
        lang="ua"
        schedule={[{
          id: 'slot-1',
          day: 'Неділя',
          date: '2099-05-17',
          time: '17:00',
          durationMinutes: 45,
          topic: 'Практика мовлення',
          isConducted: false,
        }]}
        onOpenSchedule={onOpenSchedule}
      />,
    );

    const dashboard = await screen.findByTestId('interactive-dashboard');
    expect(within(dashboard).getByRole('heading', { name: 'Інтерактивний зошит' })).toBeInTheDocument();
    expect(within(dashboard).getByText('2 із 4 уроків завершено')).toBeInTheDocument();
    expect(within(dashboard).getByRole('progressbar', { name: 'Твій прогрес' })).toHaveAttribute('aria-valuenow', '50');
    expect(within(dashboard).getByText('17 травня · 17:00–17:45')).toBeInTheDocument();
    expect(within(dashboard).getByText('Практика мовлення')).toBeInTheDocument();
    expect(within(dashboard).queryByText('Чудова робота')).not.toBeInTheDocument();
    expect(within(dashboard).queryByText('Останні уроки')).not.toBeInTheDocument();
    expect(within(dashboard).queryByText(/зірок зароблено/i)).not.toBeInTheDocument();

    fireEvent.click(within(dashboard).getByRole('button', { name: /До розкладу/ }));
    expect(onOpenSchedule).toHaveBeenCalledTimes(1);
  });

  it('switches units and preserves completed, in-progress and locked lesson actions', async () => {
    render(
      <InteractiveLessonMap
        userId="student-1"
        hasAccess
        lang="ua"
        assignedContent={[{ id: 'content-3', interactiveLessonId: 'lesson-3', interactiveScorePercent: 35 }]}
      />,
    );

    const dashboard = await screen.findByTestId('interactive-dashboard');
    expect(within(dashboard).getByText('Hello!')).toBeInTheDocument();
    fireEvent.click(within(dashboard).getByRole('button', { name: /UNIT 2 Everyday English/ }));

    await waitFor(() => expect(within(dashboard).getByText('At school')).toBeInTheDocument());
    expect(within(dashboard).getByText('У процесі')).toBeInTheDocument();
    expect(within(dashboard).getByRole('button', { name: /Продовжити/ })).toBeEnabled();
    expect(within(dashboard).getByRole('button', { name: /Відкриється пізніше/ })).toBeDisabled();

    fireEvent.click(within(dashboard).getByRole('button', { name: /Продовжити/ }));
    expect(screen.getByTestId('lesson-room')).toHaveTextContent('lesson-3');
  });

  it('shows the localized empty schedule state', async () => {
    render(<InteractiveLessonMap userId="student-1" hasAccess lang="en" schedule={[]} />);
    const dashboard = await screen.findByTestId('interactive-dashboard');
    expect(within(dashboard).getByText('No upcoming lessons yet')).toBeInTheDocument();
    expect(within(dashboard).getByText('Your units')).toBeInTheDocument();
  });
});
