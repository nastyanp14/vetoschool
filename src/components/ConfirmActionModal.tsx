import { motion } from 'framer-motion';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmActionModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  tone?: 'danger' | 'warning';
}

export default function ConfirmActionModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  tone = 'danger',
}: ConfirmActionModalProps) {
  const Icon = tone === 'danger' ? Trash2 : AlertTriangle;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-purple-950/35 p-4 backdrop-blur-md"
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_28px_80px_rgba(126,87,194,0.28)]"
      >
        <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-blue-50 p-6 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-pink-400 to-purple-400 text-white shadow-lg">
            <Icon className="h-6 w-6" />
          </div>
          <h3 className="font-display text-2xl font-black text-purple-700">{title}</h3>
          <p className="mx-auto mt-2 max-w-sm font-body text-sm leading-6 text-purple-500">{message}</p>
        </div>
        <div className="flex flex-col gap-2 bg-white/85 p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-purple-100 bg-white px-5 py-3 font-body text-sm font-900 text-purple-600 shadow-sm transition hover:bg-purple-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-full bg-gradient-to-r from-red-400 to-pink-500 px-5 py-3 font-body text-sm font-900 text-white shadow-lg transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
          >
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}
