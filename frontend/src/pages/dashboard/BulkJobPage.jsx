import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, RefreshCw, AlertTriangle, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '../../lib/api.js';
import { Button, Badge, StatTile, ProgressBar, Skeleton } from '../../components/ui.jsx';

const STATUS_TONE = {
  queued: 'warning', processing: 'warning', completed: 'success',
  completed_with_errors: 'warning', failed: 'danger', cancelled: 'neutral',
};

export default function BulkJobPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showErrors, setShowErrors] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ['bulk', id],
    queryFn: () => apiGet(`/bulk/${id}`),
    refetchInterval: (q) => ['queued', 'processing'].includes(q.state.data?.status) ? 4000 : false,
  });

  const { data: errors } = useQuery({
    queryKey: ['bulk', id, 'errors'],
    queryFn: () => apiGet(`/bulk/${id}/errors`),
    enabled: showErrors,
  });

  const retry = useMutation({
    mutationFn: () => apiPost(`/bulk/${id}/retry`),
    onSuccess: (r) => { toast.success(`Retrying ${r.retried} failed row(s).`); qc.invalidateQueries({ queryKey: ['bulk', id] }); },
    onError: (e) => toast.error(e.message),
  });

  async function downloadZip() {
    try { const { url } = await apiGet(`/bulk/${id}/zip`); window.open(url, '_blank'); }
    catch (e) { toast.error(e.message); }
  }

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>;
  if (!job) return null;

  const pct = job.total_rows ? Math.round((job.processed / job.total_rows) * 100) : 0;
  const running = ['queued', 'processing'].includes(job.status);

  return (
    <div>
      <Link to="/app/bulk" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to bulk jobs
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Bulk Job</h1>
          <p className="font-mono text-xs text-muted">{job.id}</p>
        </div>
        <Badge tone={STATUS_TONE[job.status] || 'neutral'}>{job.status.replace(/_/g, ' ')}</Badge>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Total" value={job.total_rows} />
        <StatTile label="Successful" value={job.successful} accent="text-success" />
        <StatTile label="Failed" value={job.failed} accent={job.failed ? 'text-danger' : 'text-muted'} />
      </div>

      {running && (
        <div className="mt-6 card p-5">
          <ProgressBar value={pct} />
          <p className="mt-2 text-sm text-muted">{job.processed} of {job.total_rows} processed ({pct}%)</p>
        </div>
      )}

      <div className="mt-6 card p-5">
        <h2 className="font-semibold text-ink">Timeline</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <Meta label="Created" value={fmt(job.created_at)} />
          <Meta label="Started" value={fmt(job.started_at)} />
          <Meta label="Completed" value={fmt(job.completed_at)} />
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={downloadZip} disabled={!job.zip_url} title={job.zip_url ? '' : 'ZIP not ready yet'}>
          <Download className="h-4 w-4" /> Download All
        </Button>
        {job.failed > 0 && (
          <Button variant="secondary" onClick={() => retry.mutate()} loading={retry.isPending}>
            <RefreshCw className="h-4 w-4" /> Retry Failed ({job.failed})
          </Button>
        )}
        <Button variant="secondary" onClick={() => setShowErrors((v) => !v)}>
          <AlertTriangle className="h-4 w-4" /> {showErrors ? 'Hide' : 'View'} Errors
        </Button>
        <Button variant="secondary" onClick={() => navigate('/app/certificates')}>
          <ListChecks className="h-4 w-4" /> View Certificates
        </Button>
      </div>

      {showErrors && (
        <div className="mt-4 card p-5">
          <h3 className="font-semibold text-ink">Failed rows</h3>
          {!errors?.length ? (
            <p className="mt-2 text-sm text-muted">No failed rows.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead><tr className="border-b border-line text-left text-muted">
                  <th className="p-2">Row</th><th className="p-2">Data</th><th className="p-2">Error</th>
                </tr></thead>
                <tbody>
                  {errors.map((r) => (
                    <tr key={r.row_index} className="border-b border-line">
                      <td className="p-2 text-ink">{r.row_index + 1}</td>
                      <td className="p-2 text-muted"><code className="text-xs">{JSON.stringify(r.data).slice(0, 80)}</code></td>
                      <td className="p-2 text-danger">{r.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }) {
  return <div><dt className="text-xs uppercase tracking-wide text-muted/70">{label}</dt><dd className="mt-0.5 text-ink">{value}</dd></div>;
}
function fmt(ts) { return ts ? new Date(ts).toLocaleString() : '—'; }
