import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutTemplate, Copy, Trash2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiDelete } from '../../lib/api.js';
import { Button, Badge, Skeleton, EmptyState, Modal } from '../../components/ui.jsx';

const SIZE_LABEL = {
  'a4-landscape': 'A4 Landscape', 'a4-portrait': 'A4 Portrait',
  'letter-landscape': 'Letter Landscape', 'letter-portrait': 'Letter Portrait',
};

export default function TemplatesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState(null);

  const { data, isLoading } = useQuery({ queryKey: ['templates'], queryFn: () => apiGet('/templates') });

  const create = useMutation({
    mutationFn: () => apiPost('/templates', { name: 'Untitled template', page_size: 'a4-landscape', design: { background: '#ffffff', elements: [] } }),
    onSuccess: (t) => navigate(`/app/templates/${t.id}`),
    onError: (e) => toast.error(e.message),
  });
  const duplicate = useMutation({
    mutationFn: (id) => apiPost(`/templates/${id}/duplicate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast.success('Template duplicated.'); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => apiDelete(`/templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast.success('Template deleted.'); setToDelete(null); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Templates</h1>
          <p className="text-sm text-muted">Design certificates once, reuse them across events.</p>
        </div>
        <Button onClick={() => create.mutate()} loading={create.isPending}><Plus className="h-4 w-4" /> New Template</Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 w-full" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon={LayoutTemplate} title="No templates yet"
          description="Create your first template to start issuing certificates."
          action={<Button onClick={() => create.mutate()}><Plus className="h-4 w-4" /> New Template</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((t) => (
            <div key={t.id} className="card overflow-hidden p-0">
              <button onClick={() => navigate(`/app/templates/${t.id}`)} className="grid h-32 w-full place-items-center border-b border-line bg-surface">
                <div className="text-center">
                  <LayoutTemplate className="mx-auto h-7 w-7 text-muted/50" />
                  <p className="mt-2 px-4 text-sm font-medium text-ink line-clamp-1">{t.name}</p>
                </div>
              </button>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">{SIZE_LABEL[t.page_size] || t.page_size}</p>
                  <Badge tone={t.is_published ? 'success' : 'neutral'}>{t.is_published ? 'Published' : 'Draft'}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted/70">Updated {new Date(t.updated_at).toLocaleDateString()}</p>
                <div className="mt-3 flex gap-1">
                  <button onClick={() => navigate(`/app/templates/${t.id}`)} className="btn-ghost px-2 py-1 text-xs"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  <button onClick={() => duplicate.mutate(t.id)} className="btn-ghost px-2 py-1 text-xs"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
                  <button onClick={() => setToDelete(t)} className="btn-ghost px-2 py-1 text-xs text-danger"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Delete template?"
        footer={<>
          <Button variant="secondary" onClick={() => setToDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => remove.mutate(toDelete.id)} loading={remove.isPending}>Delete</Button>
        </>}>
        <p className="text-sm text-muted">This will permanently delete "{toDelete?.name}". Certificates already issued from it are unaffected.</p>
      </Modal>
    </div>
  );
}
