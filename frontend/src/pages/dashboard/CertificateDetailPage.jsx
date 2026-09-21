import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Copy, ExternalLink, Ban, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '../../lib/api.js';
import { Button, Badge, Skeleton, Modal, Textarea } from '../../components/ui.jsx';
import CertificatePreview from '../../components/CertificatePreview.jsx';

const STATUS_TONE = { valid: 'success', revoked: 'danger', expired: 'warning' };

export default function CertificateDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [reason, setReason] = useState('');

  const { data: c, isLoading } = useQuery({ queryKey: ['certificate', id], queryFn: () => apiGet(`/certificates/${id}`) });

  const revoke = useMutation({
    mutationFn: () => apiPost(`/certificates/${id}/revoke`, { reason }),
    onSuccess: () => { toast.success('Certificate revoked.'); qc.invalidateQueries({ queryKey: ['certificate', id] }); setRevokeOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const resend = useMutation({
    mutationFn: () => apiPost(`/certificates/${id}/resend`),
    onSuccess: () => toast.success('Certificate email re-queued.'),
    onError: (e) => toast.error(e.message),
  });

  async function download() {
    try { const { url } = await apiGet(`/certificates/${id}/download`); window.open(url, '_blank'); }
    catch (e) { toast.error(e.message); }
  }
  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/verify/${c.verification_code}`);
    toast.success('Verification link copied.');
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>;
  if (!c) return null;

  return (
    <div>
      <Link to="/app/certificates" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Certificates
      </Link>

      {c.effective_status === 'revoked' && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-red-50 p-3 text-sm text-danger">
          This certificate is revoked{c.revoke_reason ? `: ${c.revoke_reason}` : ''}.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="card p-2">
          <CertificatePreview
            recipient={c.recipient_name}
            course={c.fields?.event_name || c.fields?.course_name || ''}
            org={c.fields?.organization_name || ''}
            code={c.verification_code}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-ink">{c.recipient_name}</h1>
            <Badge tone={STATUS_TONE[c.effective_status]}>{c.effective_status}</Badge>
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <Field label="Event" value={c.fields?.event_name || '—'} />
            <Field label="Issued by" value={c.fields?.issued_by || '—'} />
            <Field label="Issue date" value={new Date(c.issued_at).toLocaleDateString()} />
            <Field label="Expiry date" value={c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'No expiry'} />
            <Field label="Recipient email" value={c.recipient_email || '—'} />
            <div className="flex items-center justify-between">
              <span className="text-muted">Verification code</span>
              <span className="flex items-center gap-2 font-mono text-xs text-ink">
                {c.verification_code}
                <button onClick={() => { navigator.clipboard.writeText(c.verification_code); toast.success('Copied.'); }}><Copy className="h-3.5 w-3.5 text-muted" /></button>
              </span>
            </div>
            <Field label="Verifications" value={c.verification_count} />
            <Field label="Email status" value={c.email_status?.replace('_', ' ') || '—'} />
          </dl>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={download}><Download className="h-4 w-4" /> Download PDF</Button>
            <Button variant="secondary" onClick={copyLink}><Copy className="h-4 w-4" /> Copy link</Button>
            <a href={`/verify/${c.verification_code}`} target="_blank" rel="noreferrer" className="btn-secondary"><ExternalLink className="h-4 w-4" /> Public page</a>
            {c.recipient_email && <Button variant="secondary" onClick={() => resend.mutate()} loading={resend.isPending}><Mail className="h-4 w-4" /> Resend email</Button>}
            {c.effective_status !== 'revoked' && <Button variant="danger" onClick={() => setRevokeOpen(true)}><Ban className="h-4 w-4" /> Revoke</Button>}
          </div>
        </div>
      </div>

      <Modal open={revokeOpen} onClose={() => setRevokeOpen(false)} title="Revoke certificate"
        footer={<>
          <Button variant="secondary" onClick={() => setRevokeOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => revoke.mutate()} loading={revoke.isPending}>Revoke</Button>
        </>}>
        <p className="text-sm text-muted">Revoked certificates show as invalid on the public verification page. This can be undone only by support.</p>
        <Textarea label="Reason (optional)" className="mt-3" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  );
}

function Field({ label, value }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{label}</span><span className="font-medium text-ink">{value}</span></div>;
}
