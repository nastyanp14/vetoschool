import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

type ScrollLocation = {
  pathname: string;
  search: string;
  hash: string;
};

function shouldResetScroll(previous: ScrollLocation | null, current: ScrollLocation) {
  if (!previous) return true;
  if (previous.pathname !== current.pathname) return true;

  // Query controls (for example checkout currency) and in-page anchors should
  // not behave like a new page. A repeated navigation to the same URL should.
  return previous.search === current.search && previous.hash === current.hash;
}

export default function ScrollToTop() {
  const location = useLocation();
  const previousLocationRef = useRef<ScrollLocation | null>(null);

  useLayoutEffect(() => {
    if (!('scrollRestoration' in window.history)) return;

    const previousMode = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousMode;
    };
  }, []);

  useLayoutEffect(() => {
    const currentLocation = {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    };
    const resetScroll = shouldResetScroll(previousLocationRef.current, currentLocation);
    previousLocationRef.current = currentLocation;

    if (!resetScroll) return;

    const scrollToTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    scrollToTop();

    // Run once more after the route has committed so delayed layout work cannot
    // restore the scroll position from the page the visitor just left.
    const animationFrame = window.requestAnimationFrame(scrollToTop);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [location.hash, location.key, location.pathname, location.search]);

  return null;
}
