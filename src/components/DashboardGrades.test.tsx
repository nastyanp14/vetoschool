import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardGrades from './DashboardGrades';
import type { ContentItem } from '../lib/content';

const item = (patch: Partial<ContentItem>): ContentItem => ({
  id: 'item', moduleId: 'module-1', type: 'homework', title: 'Assignment', emoji: '', unlocked: true, ...patch,
});

const itemsByType = {
  homework: [
    item({ id: 'planned', title: 'My daily routine', dueDate: '2099-09-11', homeworkStatus: 'not_submitted' }),
    item({ id: 'graded', title: 'At the zoo', submittedAt: '2026-08-28', checkedAt: '2026-08-29', homeworkStatus: 'reviewed', starRating: 4 }),
  ],
  practice: [item({ id: 'practice', type: 'practice', title: 'Everyday English', dueDate: '2099-09-12' })],
  checkpoint: [],
  grammar: [],
  listening: [],
};

describe('DashboardGrades', () => {
  afterEach(cleanup);

  it('shows an overall grades view and separates assignments by state and category', async () => {
    const onOpenItem = vi.fn();
    const { container } = render(<DashboardGrades lang="ru" ratingAverage={4.3} totalEarned={43} itemsByType={itemsByType} onOpenItem={onOpenItem} />);

    const grades = screen.getByTestId('dashboard-grades');
    expect(within(grades).getByRole('tab', { name: 'Общие оценки' })).toHaveAttribute('aria-selected', 'true');
    expect(within(grades).getByText('4.3 / 5')).toBeInTheDocument();
    expect(within(grades).getByText('Оценки по категориям')).toBeInTheDocument();
    expect(container.querySelector('img[src*="grades-hero-owl"]')).not.toBeInTheDocument();

    fireEvent.click(within(grades).getByRole('tab', { name: /Все задания 3/ }));
    await waitFor(() => expect(within(grades).getByText('My daily routine')).toBeInTheDocument());
    expect(within(grades).getByText('At the zoo')).toBeInTheDocument();
    expect(within(grades).getByText('Everyday English')).toBeInTheDocument();

    fireEvent.click(within(grades).getByRole('tab', { name: /Запланированные 2/ }));
    await waitFor(() => expect(within(grades).queryByText('At the zoo')).not.toBeInTheDocument());
    expect(within(grades).getByText('My daily routine')).toBeInTheDocument();

    fireEvent.click(within(grades).getByRole('button', { name: /Практика/ }));
    await waitFor(() => expect(within(grades).getByText('Everyday English')).toBeInTheDocument());
    expect(within(grades).queryByText('My daily routine')).not.toBeInTheDocument();
  });

  it('opens the selected assignment row', () => {
    const onOpenItem = vi.fn();
    render(<DashboardGrades lang="en" ratingAverage={0} totalEarned={0} itemsByType={itemsByType} onOpenItem={onOpenItem} />);
    fireEvent.click(screen.getByRole('tab', { name: /All assignments 3/ }));
    fireEvent.click(screen.getByRole('button', { name: /My daily routine/ }));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'planned' }));
  });
});
