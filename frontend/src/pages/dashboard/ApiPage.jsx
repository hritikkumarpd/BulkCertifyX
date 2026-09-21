import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Copy, Trash2, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiDelete } from '../../lib/api.js';
import { useOrg } from '../../store/OrgContext.jsx';
import { Button, Input, Badge, Skeleton, Modal } from '../../components/ui.jsx';

const PERMS = ['certificates:read', 'certificates:write', 'verify:read', 'events:read'];
const BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1`;

export default function ApiPage() {
  const { current } = useOrg();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const hasApi = ['pro', 'enterprise'].includes(current?.plan);

  const { data, isLoading } = useQuery({ queryKey: ['api-keys'], queryFn: () => apiGet('/api-keys'), enabled: hasApi });
  const revoke = useMutation({
    mutationFn: (id) => apiDelete(`/api-keys/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); toast.success('Key revoked.'); }, onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">API</h1>
          <p className="text-sm text-muted">Issue and verify certificates programmatically.</p>
        </div>
        {hasApi && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create API Key</Button>}
      </div>

      {!hasApi && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <p className="font-medium text-ink">API access is available on Pro and Enterprise.</p>
          <p className="mt-1 text-sm text-muted">Upgrade to create API keys and integrate certificate issuance into your systems.</p>
          <Link to="/app/billing" className="btn-primary mt-3 inline-flex">View plans</Link>
        </div>
      )}

      {hasApi && (
        <>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="card overflow-hidden p-0">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-line bg-surface text-left text-muted">
                  <th className="p-3">Name</th><th className="p-3">Key</th><th className="p-3">Permissions</th><th className="p-3">Last used</th><th className="p-3">Status</th><th className="p-3"></th>
                </tr></thead>
                <tbody>
                  {!data?.length && <tr><td colSpan={6} className="p-6 text-center text-muted">No API keys yet.</td></tr>}
                  {(data || []).map((k) => (
                    <tr key={k.id} className="border-b border-line">
                      <td className="p-3 font-medium text-ink">{k.name}</td>
                      <td className="p-3 font-mono text-xs text-muted">{k.key_prefix}…</td>
                      <td className="p-3"><div className="flex flex-wrap gap-1">{k.permissions.map((p) => <span key={p} className="badge-neutral text-[10px]">{p}</span>)}</div></td>
                      <td className="p-3 text-muted">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</td>
                      <td className="p-3"><Badge tone={k.revoked_at ? 'danger' : 'success'}>{k.revoked_at ? 'Revoked' : 'Active'}</Badge></td>
                      <td className="p-3 text-right">{!k.revoked_at && <button onClick={() => revoke.mutate(k.id)} className="btn-ghost px-2 py-1 text-xs text-danger"><Trash2 className="h-3.5 w-3.5" /> Revoke</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Documentation */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-ink">API documentation</h2>
        <div className="mt-4 space-y-6">
          <Doc title="Base URL"><CodeBlock code={BASE} /></Doc>
          <Doc title="Authentication">
            <p className="text-sm text-muted">Send your API key as a bearer token.</p>
            <CodeBlock code={`Authorization: Bearer bcx_your_api_key`} />
          </Doc>
          <Doc title="Create a certificate">
            <CodeBlock code={`POST ${BASE}/certificates
{
  "template_id": "uuid",
  "recipient_name": "Asha Menon",
  "recipient_email": "asha@example.com",
  "fields": { "course_name": "Full Stack Development" },
  "send_email": true
}`} />
            <CodeBlock code={`{ "success": true, "data": { "verification_code": "CERT-A7K2-X9PQ", ... } }`} />
          </Doc>
          <Doc title="Retrieve a certificate"><CodeBlock code={`GET ${BASE}/certificates/:id`} /></Doc>
          <Doc title="Verify a certificate"><CodeBlock code={`GET ${BASE}/verify/:code`} /></Doc>
          <Doc title="List events"><CodeBlock code={`GET ${BASE}/events`} /></Doc>
          <Doc title="Errors">
            <CodeBlock code={`{ "success": false, "error": { "code": "INVALID_API_KEY", "message": "The provided API key is invalid." } }`} />
          </Doc>
          <Doc title="Rate limits"><p className="text-sm text-muted">Authenticated API requests are limited to 120 per minute per key.</p></Doc>
        </div>
      </div>

      {createOpen && <CreateKeyModal onClose={() => setCreateOpen(false)} onCreated={(k) => { setNewKey(k); qc.invalidateQueries({ queryKey: ['api-keys'] }); setCreateOpen(false); }} />}

      <Modal open={!!newKey} onClose={() => setNewKey(null)} title="API key created"
        footer={<Button onClick={() => setNewKey(null)}>Done</Button>}>
        <p className="text-sm text-warning">Copy this key now — you won't be able to see it again.</p>
        <div className="mt-3"><CodeBlock code={newKey?.key || ''} /></div>
      </Modal>
    </div>
  );
}

function CreateKeyModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [perms, setPerms] = useState(['certificates:read', 'verify:read']);
  const [busy, setBusy] = useState(false);
  const toggle = (p) => setPerms((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);
  const submit = async () => {
    if (!name.trim()) return toast.error('Name the key.');
    if (!perms.length) return toast.error('Select at least one permission.');
    try { setBusy(true); const k = await apiPost('/api-keys', { name, permissions: perms }); onCreated(k); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Create API key"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={busy}>Create</Button></>}>
      <div className="space-y-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Production server" />
        <div>
          <label className="label">Permissions</label>
          <div className="space-y-2">
            {PERMS.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={perms.includes(p)} onChange={() => toggle(p)} className="rounded border-line" />
                <span className="font-mono text-xs text-ink">{p}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Doc({ title, children }) {
  return <div className="card p-5"><p className="mb-2 text-sm font-semibold text-ink">{title}</p>{children}</div>;
}

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); toast.success('Copied.'); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border border-line bg-surface p-3 font-mono text-xs text-ink">{code}</pre>
      <button onClick={copy} className="absolute right-2 top-2 rounded p-1 text-muted hover:bg-white">{copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}</button>
    </div>
  );
}
