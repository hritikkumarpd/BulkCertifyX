import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, LayoutTemplate } from 'lucide-react';
import { apiGet } from '../../lib/api.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { Button, StatTile, ProgressBar, Badge, Skeleton, EmptyState } from '../../components/ui.jsx';

const STATUS_TONE = { valid: 'success', completed: 'success', completed_with_errors: 'warning', failed: 'danger', processing: 'warning', queued: 'warning', revoked: 'danger' };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = (user?.user_metadata?.full_name || user?.email || 'there').split(/[\s@]/)[0];

  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => apiGet('/dashboard') });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>;

  const u = data.usage;
  const remaining = u.certificates.remaining === -1 ? 'Unlimited' : u.certificates.remaining;
  const limit = u.certificates.limit;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{greeting()}, {firstName}</h1>
          <p className="text-sm text-muted">Here's what's happening with your certificates.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/app/bulk')}><Sparkles className="h-4 w-4" /> Generate Certificates</Button>
          <Button variant="secondary" onClick={() => navigate('/app/templates')}><LayoutTemplate className="h-4 w-4" /> Create Template</Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Certificates this month" value={u.certificates.used} />
        <StatTile label="Remaining credits" value={remaining} accent={remaining === 0 ? 'text-danger' : 'text-muted'} />
        <StatTile label="Total certificates" value={u.totalCertificates} />
        <StatTile label="Templates" value={u.templates.used} sublabel={u.templates.limit === -1 ? 'Unlimited' : `of ${u.templates.limit}`} />
      </div>

      {/* Monthly usage */}
      <div className="mt-6 card p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Monthly usage</p>
          <p className="text-sm text-muted">{limit === -1 ? `${u.certificates.used} (unlimited)` : `${u.certificates.used} / ${limit}`}</p>
        </div>
        {limit !== -1 && <div className="mt-3"><ProgressBar value={(u.certificates.used / limit) * 100} /></div>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent bulk jobs */}
        <div className="card p-5">
          <p className="mb-3 text-sm font-medium text-ink">Recent bulk jobs</p>
          {!data.recentBulkJobs.length ? (
            <p className="py-6 text-center text-sm text-muted">No bulk jobs yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="pb-2">Total</th><th className="pb-2">Success</th><th className="pb-2">Failed</th><th className="pb-2">Status</th></tr></thead>
              <tbody>
                {data.recentBulkJobs.map((j) => (
                  <tr key={j.id} className="cursor-pointer border-t border-line hover:bg-surface" onClick={() => navigate(`/app/bulk/${j.id}`)}>
                    <td className="py-2">{j.total_rows}</td><td className="py-2 text-success">{j.successful}</td>
                    <td className="py-2 text-danger">{j.failed}</td>
                    <td className="py-2"><Badge tone={STATUS_TONE[j.status] || 'neutral'}>{j.status.replace(/_/g, ' ')}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent certificates */}
        <div className="card p-5">
          <p className="mb-3 text-sm font-medium text-ink">Recent certificates</p>
          {!data.recentCertificates.length ? (
            <EmptyState title="No certificates yet" description="Generate your first certificate to see it here."
              action={<Button onClick={() => navigate('/app/bulk')}>Generate</Button>} />
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="pb-2">Recipient</th><th className="pb-2">Code</th><th className="pb-2">Issued</th></tr></thead>
              <tbody>
                {data.recentCertificates.map((c) => (
                  <tr key={c.id} className="cursor-pointer border-t border-line hover:bg-surface" onClick={() => navigate(`/app/certificates/${c.id}`)}>
                    <td className="py-2 text-ink">{c.recipient_name}</td>
                    <td className="py-2 font-mono text-xs text-muted">{c.verification_code}</td>
                    <td className="py-2 text-muted">{new Date(c.issued_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
