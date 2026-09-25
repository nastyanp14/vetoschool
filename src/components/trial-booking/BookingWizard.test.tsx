import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BookingWizard from './BookingWizard';

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('BookingWizard', () => {
  it('keeps unfinished parent and child form values when navigating back', async () => {
    render(<BookingWizard lang="ru" />);

    fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
    await screen.findByRole('heading', { name: 'Расскажите о себе' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Имя родителя' }), { target: { value: 'Анна' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'anna@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    await screen.findByRole('heading', { name: 'Расскажите о ребёнке' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Имя ребёнка' }), { target: { value: 'Маша' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Возраст' }), { target: { value: '6' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Класс в школе' }), { target: { value: '1А' } });
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    await screen.findByRole('heading', { name: 'Расскажите о себе' });

    expect(screen.getByRole('textbox', { name: 'Имя родителя' })).toHaveValue('Анна');
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('anna@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    await screen.findByRole('heading', { name: 'Расскажите о ребёнке' });

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Имя ребёнка' })).toHaveValue('Маша');
      expect(screen.getByRole('spinbutton', { name: 'Возраст' })).toHaveValue(6);
      expect(screen.getByRole('textbox', { name: 'Класс в школе' })).toHaveValue('1А');
    });
  });
});
