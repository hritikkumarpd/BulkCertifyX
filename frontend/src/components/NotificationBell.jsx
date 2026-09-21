import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api.js';
import { useOrg } from '../store/OrgContext.jsx';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { current } = useOrg();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['notifications', current?.id],
    queryFn: () => apiGet('/notifications'),
    enabled: !!current,
    refetchInterval: 60_000,
  });

  const markAll = useMutation({
    mutationFn: () => apiPost('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = data?.unread || 0;
  const items = data?.notifications || [];

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative rounded-md p-2 hover:bg-surface">
        <Bell className="h-5 w-5 text-muted" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-80 rounded-lg border border-line bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && <button onClick={() => markAll.mutate()} className="text-xs text-brand-600 hover:underline">Mark all read</button>}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">You're all caught up.</p>}
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { if (n.link) navigate(n.link); setOpen(false); }}
                  className={`block w-full border-b border-line px-4 py-3 text-left hover:bg-surface ${!n.read_at ? 'bg-brand-50/40' : ''}`}
                >
                  <p className="text-sm font-medium text-ink">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-muted/70">{new Date(n.created_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
