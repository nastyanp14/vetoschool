import { createRoot } from 'react-dom/client';
import '../index.css';

// Separate dev entry: never mounted by the application or its production router.
if (import.meta.env.DEV) {
  void import('./CardPreview').then(({ default: CardPreview }) => {
    createRoot(document.getElementById('root')!).render(<CardPreview />);
  });
}
