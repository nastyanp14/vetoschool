import { ReactNode } from 'react';

export function TeacherFormSection({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-purple-100 bg-white/55 p-4 shadow-sm dark-panel-soft md:p-5">
      <div className="mb-4">
        <h3 className="font-display text-xl font-black text-purple-700">{title}</h3>
        {description && <p className="mt-1 font-body text-sm text-purple-500">{description}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
      {footer && <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">{footer}</div>}
    </section>
  );
}

export function TeacherField({
  label,
  children,
  error,
  className = '',
}: {
  label: string;
  children: ReactNode;
  error?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block font-body text-sm font-700 text-purple-600">{label}</span>
      {children}
      {error && <span className="mt-1 block font-body text-xs font-700 text-red-500">{error}</span>}
    </label>
  );
}
