import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Copy, Archive, Sparkles, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch } from '../../lib/api.js';
import { Button, Input, Textarea, Select, Badge, Skeleton, EmptyState, Modal } from '../../components/ui.jsx';

const STATUS_TONE = { draft: 'neutral', active: 'success', archived: 'warning' };

export default function EventsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // null | 'new' | eventObj

  const { data, isLoading } = useQuery({ queryKey: ['events'], queryFn: () => apiGet('/events') });
  const { data: templates } = useQuery({ queryKey: ['templates'], queryFn: () => apiGet('/templates') });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['events'] });
  const duplicate = useMutation({ mutationFn: (id) => apiPost(`/events/${id}/duplicate`), onSuccess: () => { invalidate(); toast.success('Event duplicated.'); } });
  const archive = useMutation({ mutationFn: (id) => apiPost(`/events/${id}/archive`), onSuccess: () => { invalidate(); toast.success('Event archived.'); } });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Events</h1>
          <p className="text-sm text-muted">Group certificates by course, program, or workshop.</p>
        </div>
        <Button onClick={() => setModal('new')}><Plus className="h-4 w-4" /> Create Event</Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon={CalendarDays} title="No events yet"
          description="Create an event to organize the certificates you issue."
          action={<Button onClick={() => setModal('new')}><Plus className="h-4 w-4" /> Create Event</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((e) => (
            <div key={e.id} className="card p-5">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-ink">{e.name}</h3>
                <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
              </div>
              {e.event_date && <p className="mt-1 text-xs text-muted">{new Date(e.event_date).toLocaleDateString()}</p>}
              <p className="mt-3 text-sm text-muted">{e.certificate_count} certificate{e.certificate_count === 1 ? '' : 's'}</p>
              <div className="mt-4 flex flex-wrap gap-1">
                <button onClick={() => setModal(e)} className="btn-ghost px-2 py-1 text-xs"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                <button onClick={() => navigate('/app/bulk')} className="btn-ghost px-2 py-1 text-xs text-brand-600"><Sparkles className="h-3.5 w-3.5" /> Generate</button>
                <button onClick={() => duplicate.mutate(e.id)} className="btn-ghost px-2 py-1 text-xs"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
                {e.status !== 'archived' && <button onClick={() => archive.mutate(e.id)} className="btn-ghost px-2 py-1 text-xs"><Archive className="h-3.5 w-3.5" /> Archive</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <EventModal event={modal === 'new' ? null : modal} templates={templates}
        onClose={() => setModal(null)} onDone={() => { invalidate(); setModal(null); }} />}
    </div>
  );
}

function EventModal({ event, templates, onClose, onDone }) {
  const editing = !!event;
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({ defaultValues: event || { status: 'active' } });
  const submit = async (v) => {
    try {
      const payload = { name: v.name, description: v.description, event_date: v.event_date || null, template_id: v.template_id || null, issued_by: v.issued_by, status: v.status };
      if (editing) await apiPatch(`/events/${event.id}`, payload);
      else await apiPost('/events', payload);
      toast.success(editing ? 'Event updated.' : 'Event created.');
      onDone();
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} title={editing ? 'Edit event' : 'Create event'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit(submit)} loading={isSubmitting}>{editing ? 'Save' : 'Create'}</Button>
      </>}>
      <div className="space-y-3">
        <Input label="Event name" {...register('name', { required: true })} />
        <Textarea label="Description" {...register('description')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Event date" type="date" {...register('event_date')} />
          <Input label="Issued by" {...register('issued_by')} />
        </div>
        <Select label="Default template" {...register('template_id')}>
          <option value="">None</option>
          {(templates || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        {editing && (
          <Select label="Status" {...register('status')}>
            <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
          </Select>
        )}
      </div>
    </Modal>
  );
}
