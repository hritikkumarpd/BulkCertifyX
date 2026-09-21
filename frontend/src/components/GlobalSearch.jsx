import { useEffect, useState } from 'react';
import { Search, Award, CalendarDays, LayoutTemplate } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../lib/api.js';

export default function GlobalSearch({ open, onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState({ certificates: [], events: [], templates: [] });
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) { setQ(''); setResults({ certificates: [], events: [], templates: [] }); }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults({ certificates: [], events: [], templates: [] }); return; }
    const t = setTimeout(async () => {
      try { setResults(await apiGet('/search', { q })); } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!open) return null;
  const go = (path) => { navigate(path); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-pop">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="h-4 w-4 text-muted" />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search certificates, events, templates…"
            className="w-full bg-transparent py-4 text-sm focus:outline-none"
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {q.length >= 2 && !results.certificates.length && !results.events.length && !results.templates.length && (
            <p className="px-3 py-6 text-center text-sm text-muted">No results for "{q}".</p>
          )}
          <ResultGroup label="Certificates" icon={Award} items={results.certificates}
            render={(c) => ({ title: c.recipient_name, sub: c.verification_code, onClick: () => go(`/app/certificates/${c.id}`) })} />
          <ResultGroup label="Events" icon={CalendarDays} items={results.events}
            render={(e) => ({ title: e.name, onClick: () => go('/app/events') })} />
          <ResultGroup label="Templates" icon={LayoutTemplate} items={results.templates}
            render={(t) => ({ title: t.name, onClick: () => go(`/app/templates/${t.id}`) })} />
        </div>
      </div>
    </div>
  );
}

function ResultGroup({ label, icon: Icon, items, render }) {
  if (!items?.length) return null;
  return (
    <div className="mb-1">
      <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted/70">{label}</p>
      {items.map((item, i) => {
        const r = render(item);
        return (
          <button key={i} onClick={r.onClick} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-surface">
            <Icon className="h-4 w-4 text-muted" />
            <span className="text-sm text-ink">{r.title}</span>
            {r.sub && <span className="ml-auto font-mono text-xs text-muted">{r.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
