import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Plus, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { apiGetRaw, apiGet, apiPost } from '../../lib/api.js';
import { Button, Input, Select, Badge, Skeleton, EmptyState, Modal } from '../../components/ui.jsx';

const STATUS_TONE = { valid: 'success', revoked: 'danger', expired: 'warning' };

export default function CertificatesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [eventId, setEventId] = useState('');
  const [modal, setModal] = useState(false);

  // debounce search input
  useState(() => {});
  const onSearch = (v) => {
    setSearch(v);
    clearTimeout(window.__certSearch);
    window.__certSearch = setTimeout(() => { setDebounced(v); setPage(1); }, 300);
  };

  const { data: templates } = useQuery({ queryKey: ['templates'], queryFn: () => apiGet('/templates') });
  const { data: events } = useQuery({ queryKey: ['events'], queryFn: () => apiGet('/events') });
  const eventName = (id) => events?.find((e) => e.id === id)?.name || '—';

  const { data, isLoading } = useQuery({
    queryKey: ['certificates', page, debounced, status, eventId],
    queryFn: () => apiGetRaw('/certificates', { page, pageSize: 20, search: debounced || undefined, status: status || undefined, event_id: eventId || undefined }),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Certificates</h1>
          <p className="text-sm text-muted">Every certificate your organization has issued.</p>
        </div>
        <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Generate Certificate</Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search name or code…" className="input pl-9" />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-[160px]">
          <option value="">All statuses</option><option value="revoked">Revoked</option>
        </Select>
        <Select value={eventId} onChange={(e) => { setEventId(e.target.value); setPage(1); }} className="max-w-[200px]">
          <option value="">All events</option>
          {(events || []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data?.data?.length ? (
        <EmptyState icon={Award} title="No certificates yet"
          description="Create your first certificate or upload a CSV to generate certificates in bulk."
          action={<Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Generate Certificate</Button>} />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-line bg-surface text-left text-muted">
                <th className="p-3">Recipient</th><th className="p-3">Event</th><th className="p-3">Code</th>
                <th className="p-3">Status</th><th className="p-3">Issued</th><th className="p-3">Verifications</th><th className="p-3"></th>
              </tr></thead>
              <tbody>
                {data.data.map((c) => (
                  <tr key={c.id} className="border-b border-line hover:bg-surface/50">
                    <td className="p-3 font-medium text-ink">{c.recipient_name}</td>
                    <td className="p-3 text-muted">{eventName(c.event_id)}</td>
                    <td className="p-3 font-mono text-xs text-muted">{c.verification_code}</td>
                    <td className="p-3"><Badge tone={STATUS_TONE[c.effective_status]}>{c.effective_status}</Badge></td>
                    <td className="p-3 text-muted">{new Date(c.issued_at).toLocaleDateString()}</td>
                    <td className="p-3 text-muted tabular-nums">{c.verification_count}</td>
                    <td className="p-3 text-right"><button onClick={() => navigate(`/app/certificates/${c.id}`)} className="text-brand-600 hover:underline">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line p-3 text-sm">
            <span className="text-muted">Page {data.pagination.page} of {data.pagination.totalPages || 1} · {data.pagination.total} total</span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button variant="secondary" disabled={page >= (data.pagination.totalPages || 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}

      <IssueModal open={modal} onClose={() => setModal(false)} templates={templates} events={events}
        onDone={() => { qc.invalidateQueries({ queryKey: ['certificates'] }); setModal(false); }} />
    </div>
  );
}

function IssueModal({ open, onClose, templates, events, onDone }) {
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();
  const submit = async (v) => {
    if (!v.template_id) return toast.error('Choose a template.');
    try {
      await apiPost('/certificates', {
        template_id: v.template_id, event_id: v.event_id || null,
        recipient_name: v.recipient_name, recipient_email: v.recipient_email || null,
        expires_at: v.expires_at || null,
      });
      toast.success('Certificate issued.');
      reset(); onDone();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Generate a certificate"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit(submit)} loading={isSubmitting}>Generate</Button>
      </>}>
      <div className="space-y-3">
        <Select label="Template" {...register('template_id')}>
          <option value="">Select a template…</option>
          {(templates || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Select label="Event (optional)" {...register('event_id')}>
          <option value="">No event</option>
          {(events || []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
        <Input label="Recipient name" {...register('recipient_name', { required: true })} />
        <Input label="Recipient email (optional)" type="email" {...register('recipient_email')} />
        <Input label="Expiry date (optional)" type="date" {...register('expires_at')} />
      </div>
    </Modal>
  );
}
