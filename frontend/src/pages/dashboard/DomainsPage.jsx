import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Plus, Trash2, Copy, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiDelete } from '../../lib/api.js';
import { useOrg } from '../../store/OrgContext.jsx';
import { Button, Input, Badge, Skeleton, EmptyState, Modal } from '../../components/ui.jsx';

export default function DomainsPage() {
  const { current } = useOrg();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [instructions, setInstructions] = useState(null);
  const hasFeature = ['pro', 'enterprise'].includes(current?.plan);

  const { data, isLoading } = useQuery({ queryKey: ['domains'], queryFn: () => apiGet('/domains'), enabled: hasFeature });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['domains'] });

  const verify = useMutation({
    mutationFn: (id) => apiPost(`/domains/${id}/verify`),
    onSuccess: () => { invalidate(); toast.success('Domain verified.'); }, onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => apiDelete(`/domains/${id}`),
    onSuccess: () => { invalidate(); toast.success('Domain removed.'); }, onError: (e) => toast.error(e.message),
  });

  if (!hasFeature) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ink">Custom Domains</h1>
        <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <p className="font-medium text-ink">Custom domains are available on Pro and Enterprise.</p>
          <p className="mt-1 text-sm text-muted">Verify certificates on your own branded domain.</p>
          <Link to="/app/billing" className="btn-primary mt-3 inline-flex">View plans</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Custom Domains</h1>
          <p className="text-sm text-muted">Serve verification pages on your own domain.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add domain</Button>
      </div>

      {instructions && (
        <div className="mb-6 card p-5">
          <p className="font-medium text-ink">Add these DNS records for {instructions.hostname}</p>
          <div className="mt-3 space-y-2">
            <DnsRow type={instructions.instructions.type} name={instructions.instructions.name} value={instructions.instructions.value} />
            <DnsRow type="CNAME" name={instructions.instructions.cname.name} value={instructions.instructions.cname.value} />
          </div>
          <p className="mt-2 text-xs text-muted">DNS changes can take up to 48 hours. Click Verify once added.</p>
        </div>
      )}

      {isLoading ? <Skeleton className="h-32 w-full" /> : !data?.length ? (
        <EmptyState icon={Globe} title="No domains yet" description="Add a domain to serve branded verification pages."
          action={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add domain</Button>} />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="p-4 font-medium text-ink">{d.hostname}</td>
                  <td className="p-4"><Badge tone={d.verified ? 'success' : 'warning'}>{d.verified ? 'Verified' : 'Pending'}</Badge></td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1">
                      {!d.verified && <button onClick={() => verify.mutate(d.id)} className="btn-ghost px-2 py-1 text-xs"><ShieldCheck className="h-3.5 w-3.5" /> Verify</button>}
                      <button onClick={() => remove.mutate(d.id)} className="btn-ghost px-2 py-1 text-xs text-danger"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && <AddDomainModal onClose={() => setAddOpen(false)} onDone={(res) => { setInstructions(res); invalidate(); setAddOpen(false); }} />}
    </div>
  );
}

function DnsRow({ type, name, value }) {
  return (
    <div className="grid grid-cols-[80px_1fr_auto] items-center gap-3 rounded-md border border-line bg-surface p-2 text-xs">
      <span className="font-semibold text-ink">{type}</span>
      <div className="min-w-0">
        <p className="truncate font-mono text-muted">{name}</p>
        <p className="truncate font-mono text-ink">{value}</p>
      </div>
      <button onClick={() => { navigator.clipboard.writeText(value); toast.success('Copied.'); }}><Copy className="h-4 w-4 text-muted" /></button>
    </div>
  );
}

function AddDomainModal({ onClose, onDone }) {
  const [hostname, setHostname] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    try { setBusy(true); const res = await apiPost('/domains', { hostname: hostname.trim().toLowerCase() }); toast.success('Domain added. Configure DNS to verify.'); onDone(res); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Add a custom domain"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={busy}>Add</Button></>}>
      <Input label="Domain" value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="verify.yourorg.com" />
      <p className="mt-2 text-xs text-muted">You'll get DNS records to add after this step.</p>
    </Modal>
  );
}
