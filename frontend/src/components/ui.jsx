import { cn } from '../lib/cn.js';
import { Loader2 } from 'lucide-react';

export function Button({ variant = 'primary', loading, className, children, ...props }) {
  const map = {
    primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger',
  };
  return (
    <button className={cn(map[variant], className)} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Input({ label, error, className, ...props }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <input className={cn('input', error && 'border-danger focus:ring-red-100', className)} {...props} />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className, ...props }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <textarea className={cn('input min-h-[90px]', className)} {...props} />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function Select({ label, children, className, ...props }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <select className={cn('input', className)} {...props}>{children}</select>
    </div>
  );
}

export function Card({ className, children }) {
  return <div className={cn('card p-5', className)}>{children}</div>;
}

export function Badge({ tone = 'neutral', children }) {
  const map = { success: 'badge-success', warning: 'badge-warning', danger: 'badge-danger', neutral: 'badge-neutral' };
  return <span className={map[tone]}>{children}</span>;
}

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} />;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white py-16 px-6 text-center">
      {Icon && <div className="mb-4 rounded-full bg-brand-50 p-3"><Icon className="h-6 w-6 text-brand-600" /></div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatTile({ label, value, sublabel, accent }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink tabular-nums">{value}</p>
      {sublabel && <p className={cn('mt-1 text-xs', accent || 'text-muted')}>{sublabel}</p>}
    </div>
  );
}

export function ProgressBar({ value, className }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-line', className)}>
      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-pop">
        {title && <div className="border-b border-line px-5 py-4"><h3 className="font-semibold text-ink">{title}</h3></div>}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
