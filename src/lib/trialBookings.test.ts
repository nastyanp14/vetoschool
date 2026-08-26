import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmTrialLesson, getTrialConfirmationState, isValidLessonUrl } from './trialBookings';

const beforeBooking = {
  status: 'submitted',
  selected_date: '2026-09-15',
  selected_time: '15:00:00',
  teacher_confirmed_level: null,
  teacher_confirmed_direction: null,
  lesson_url: null,
};

const updatedBooking = {
  id: 'booking_valid_submitted',
  ...beforeBooking,
  status: 'confirmed',
  lesson_url: 'https://meet.google.com/abc-defg-hij',
};

const { invokeMock, fromMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    functions: {
      invoke: invokeMock,
    },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('trial lesson confirmation eligibility', () => {
  it('enables a valid submitted booking with a Google Meet link', () => {
    const state = getTrialConfirmationState({
      status: 'submitted',
      selectedDate: '2026-09-15',
      selectedTime: '15:00',
      timezone: 'Europe/Prague',
      lessonUrl: 'https://meet.google.com/abc-defg-hij',
    });

    expect(state).toEqual({ enabled: true, reason: null });
  });

  it('blocks closed bookings with a specific reason even when the Meet link is valid', () => {
    const state = getTrialConfirmationState({
      status: 'cancelled',
      selectedDate: '2026-09-15',
      selectedTime: '15:00',
      timezone: 'Europe/Prague',
      lessonUrl: 'https://meet.google.com/abc-defg-hij',
    });

    expect(state).toEqual({ enabled: false, reason: 'closed_status' });
  });

  it('keeps non-Google Meet links invalid for confirmation', () => {
    expect(isValidLessonUrl('https://vitalpoint.cz/')).toBe(false);
    expect(getTrialConfirmationState({
      status: 'submitted',
      selectedDate: '2026-09-15',
      selectedTime: '15:00',
      timezone: 'Europe/Prague',
      lessonUrl: 'https://vitalpoint.cz/',
    })).toEqual({ enabled: false, reason: 'invalid_lesson_url' });
  });
});

describe('confirmTrialLesson', () => {
  it('confirms a valid submitted booking and queues exactly one confirmation notification', async () => {
    const table = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: beforeBooking, error: null }),
        })),
      })),
      update: vi.fn((patch: unknown) => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { ...updatedBooking, ...(patch as object) }, error: null }),
          })),
        })),
      })),
    };

    fromMock.mockReturnValue(table);
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });

    const result = await confirmTrialLesson('booking_valid_submitted', 'https://meet.google.com/abc-defg-hij', {
      selected_date: '2026-09-15',
      selected_time: '15:00',
    });

    expect(result).toMatchObject({
      id: 'booking_valid_submitted',
      status: 'confirmed',
      lesson_url: 'https://meet.google.com/abc-defg-hij',
      selected_date: '2026-09-15',
      selected_time: '15:00',
    });
    expect(table.update).toHaveBeenCalledWith({
      selected_date: '2026-09-15',
      selected_time: '15:00',
      lesson_url: 'https://meet.google.com/abc-defg-hij',
      status: 'confirmed',
    });
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('telegram-notifications', {
      body: {
        action: 'trial_event',
        bookingId: 'booking_valid_submitted',
        previousStatus: 'submitted',
        previousDate: '2026-09-15',
        previousTime: '15:00:00',
      },
    });
  });
});
