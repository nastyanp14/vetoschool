import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScrollToTop from './ScrollToTop';

function NavigationHarness({ initialPath = '/' }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <ScrollToTop />
      <Link to="/privacy-policy">Privacy</Link>
      <Link to="/checkout/group-progress?currency=EUR">Euro</Link>
      <Routes>
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ScrollToTop', () => {
  const scrollTo = vi.fn();

  beforeEach(() => {
    scrollTo.mockClear();
    Object.defineProperty(window, 'scrollTo', { configurable: true, writable: true, value: scrollTo });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resets the document when the pathname changes', () => {
    render(<NavigationHarness />);
    scrollTo.mockClear();

    fireEvent.click(screen.getByRole('link', { name: 'Privacy' }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
  });

  it('does not reset the document for a query-only control change', () => {
    render(<NavigationHarness initialPath="/checkout/group-progress?currency=CZK" />);
    scrollTo.mockClear();

    fireEvent.click(screen.getByRole('link', { name: 'Euro' }));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('resets repeated navigation to the current page', () => {
    render(<NavigationHarness initialPath="/privacy-policy" />);
    scrollTo.mockClear();

    fireEvent.click(screen.getByRole('link', { name: 'Privacy' }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
  });
});
