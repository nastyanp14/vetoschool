import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/theme';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all bg-white/60 dark:bg-purple-900/40 border border-pink-200/60 dark:border-purple-500/30 hover:scale-110 hover:shadow-lg ${className}`}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        {isDark
          ? <Moon className="w-5 h-5 text-purple-200" fill="currentColor" />
          : <Sun className="w-5 h-5 text-amber-500" />}
      </motion.div>
    </button>
  );
}
