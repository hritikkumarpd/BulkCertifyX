import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UploadCloud, Download, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '../../lib/api.js';
import { getSocket } from '../../lib/socket.js';
import { Button, Select, StatTile, ProgressBar, Badge } from '../../components/ui.jsx';
import { cn } from '../../lib/cn.js';

const STEPS = ['Upload', 'Map Fields', 'Preview', 'Generate', 'Complete'];
const CERT_FIELDS = [
  { key: 'recipient_name', label: 'Recipient Name', required: true },
  { key: 'recipient_email', label: 'Email' },
  { key: 'event_name', label: 'Event Name' },
  { key: 'course_name', label: 'Course' },
  { key: 'event_date', label: 'Date' },
  { key: 'grade', label: 'Grade' },
];

export default function BulkGeneratePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState('');
  const [eventId, setEventId] = useState('');
  const [csv, setCsv] = useState('');
  const [fileMeta, setFileMeta] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [columnMap, setColumnMap] = useState({});
  const [validation, setValidation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState({ processed: 0, successful: 0, failed: 0, total: 0, percent: 0 });
  const [finalStats, setFinalStats] = useState(null);
  const dropRef = useRef(null);

  const { data: templates } = useQuery({ queryKey: ['templates'], queryFn: () => apiGet('/templates') });
  const { data: events } = useQuery({ queryKey: ['events'], queryFn: () => apiGet('/events') });

  async function handleFile(file) {
    if (!templateId) return toast.error('Please select a template first.');
    if (!file) return;
    if (!file.name.endsWith('.csv')) return toast.error('Please choose a .csv file.');
    const text = await file.text();
    setCsv(text);
    setFileMeta({ name: file.name, size: file.size });
    try {
      setBusy(true);
      const res = await apiPost('/bulk/parse', { csv: text, size: file.size });
      setParsed(res);
      setColumnMap(res.suggestedMap || {});
      setStep(1);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  function downloadSample() {
    const sample = 'recipient_name,recipient_email,course_name,event_date,grade\nAsha Menon,asha@example.com,Full Stack Development,2026-05-12,A\nRahul Verma,rahul@example.com,Full Stack Development,2026-05-12,A+\n';
    const url = URL.createObjectURL(new Blob([sample], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'sample-recipients.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function runValidate() {
    if (!columnMap.recipient_name) return toast.error('Map the Recipient Name field first.');
    try {
      setBusy(true);
      const res = await apiPost('/bulk/validate', { csv, columnMap });
      setValidation(res);
      setStep(2);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function runGenerate() {
    try {
      setBusy(true);
      setStep(3);
      const job = await apiPost('/bulk/generate', { csv, columnMap, template_id: templateId, event_id: eventId || null });
      setJobId(job.id);
      setProgress((p) => ({ ...p, total: job.total_rows }));
    } catch (e) {
      toast.error(e.message);
      setStep(2);
    } finally { setBusy(false); }
  }

  // Live progress via socket once a job is running.
  useEffect(() => {
    if (!jobId) return;
    let socket;
    let mounted = true;
    (async () => {
      socket = await getSocket();
      const onProgress = (p) => { if (mounted && p.jobId === jobId) setProgress(p); };
      const onComplete = (p) => {
        if (mounted && p.jobId === jobId) { setFinalStats(p); setStep(4); }
      };
      socket.on('bulk:progress', onProgress);
      socket.on('bulk:complete', onComplete);
      socket._bcxHandlers = { onProgress, onComplete };
    })();
    return () => {
      mounted = false;
      if (socket?._bcxHandlers) {
        socket.off('bulk:progress', socket._bcxHandlers.onProgress);
        socket.off('bulk:complete', socket._bcxHandlers.onComplete);
      }
    };
  }, [jobId]);

  function reset() {
    setStep(0); setCsv(''); setFileMeta(null); setParsed(null); setColumnMap({});
    setValidation(null); setJobId(null); setFinalStats(null);
    setProgress({ processed: 0, successful: 0, failed: 0, total: 0, percent: 0 });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Bulk Generate</h1>
        <p className="text-sm text-muted">Upload a CSV and generate certificates for every recipient.</p>
      </div>

      {/* Step indicator */}
      <ol className="mb-8 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className={cn('flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
            i === step ? 'border-brand-600 bg-brand-50 text-brand-700' : i < step ? 'border-line bg-white text-ink' : 'border-line bg-white text-muted')}>
            <span className={cn('grid h-5 w-5 place-items-center rounded-full text-xs font-bold',
              i <= step ? 'bg-brand-600 text-white' : 'bg-line text-muted')}>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="card p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Select a template…</option>
              {(templates || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select label="Event (optional)" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">No event</option>
              {(events || []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </div>

          <div
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              if (!templateId) return toast.error('Please select a template first.');
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className="mt-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-surface py-12 text-center"
          >
            <UploadCloud className="h-8 w-8 text-muted" />
            <p className="mt-3 text-sm font-medium text-ink">Drag & drop your CSV here</p>
            <p className="text-xs text-muted">or</p>
            <label className="mt-2">
              <span className="btn-secondary cursor-pointer">Choose file</span>
              <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} disabled={!templateId} />
            </label>
            {!templateId && <p className="mt-2 text-xs text-warning">Select a template first.</p>}
            <button onClick={downloadSample} className="mt-4 text-xs text-brand-600 hover:underline">Download sample CSV</button>
          </div>

          {fileMeta && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-line bg-white p-3 text-sm">
              <FileSpreadsheet className="h-5 w-5 text-brand-600" />
              <div>
                <p className="font-medium text-ink">{fileMeta.name}</p>
                <p className="text-xs text-muted">{parsed?.rowCount ?? '—'} rows · {parsed?.headers?.length ?? '—'} columns · {(fileMeta.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 1 && parsed && (
        <div className="card p-6">
          <h2 className="font-semibold text-ink">Map your columns</h2>
          <p className="text-sm text-muted">Match certificate fields to your CSV columns. We auto-matched what we could.</p>
          <div className="mt-5 space-y-3">
            {CERT_FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-2 items-center gap-3">
                <span className="text-sm text-ink">{f.label}{f.required && <span className="text-danger"> *</span>}</span>
                <Select value={columnMap[f.key] || ''} onChange={(e) => setColumnMap((m) => ({ ...m, [f.key]: e.target.value }))}>
                  <option value="">— none —</option>
                  {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={runValidate} loading={busy}>Continue</Button>
          </div>
        </div>
      )}

      {step === 2 && validation && (
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <Badge tone="success">{validation.validCount} valid</Badge>
            {validation.errorCount > 0 && <Badge tone="danger">{validation.errorCount} with issues</Badge>}
          </div>
          {validation.errorCount > 0 && <p className="mt-2 text-sm text-muted">Only valid rows will be generated.</p>}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead><tr className="border-b border-line text-left text-muted">
                <th className="p-2">Recipient</th><th className="p-2">Email</th><th className="p-2">Issues</th>
              </tr></thead>
              <tbody>
                {validation.preview.map((row, i) => (
                  <tr key={i} className={cn('border-b border-line', !row.valid && 'bg-red-50/50')}>
                    <td className="p-2 text-ink">{row.data.recipient_name || '—'}</td>
                    <td className="p-2 text-muted">{row.data.recipient_email || '—'}</td>
                    <td className="p-2 text-danger">{row.errors.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={runGenerate} loading={busy} disabled={validation.validCount === 0}>Generate {validation.validCount} certificates</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-6">
          <h2 className="font-semibold text-ink">Generation in progress</h2>
          <p className="text-sm text-muted">You can leave this page — generation continues in the background.</p>
          <div className="mt-5"><ProgressBar value={progress.percent} /></div>
          <p className="mt-2 text-sm text-muted">{progress.processed} of {progress.total} processed ({progress.percent}%)</p>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Total" value={progress.total} />
            <StatTile label="Processed" value={progress.processed} />
            <StatTile label="Successful" value={progress.successful} accent="text-success" />
            <StatTile label="Failed" value={progress.failed} accent={progress.failed ? 'text-danger' : 'text-muted'} />
          </div>
          {jobId && <Button variant="secondary" className="mt-6" onClick={() => navigate(`/app/bulk/${jobId}`)}>View job details</Button>}
        </div>
      )}

      {step === 4 && (
        <div className="card p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <h2 className="mt-2 text-lg font-bold text-ink">Generation complete</h2>
          <p className="text-sm text-muted">{(finalStats?.successful ?? progress.successful)} of {finalStats?.total ?? progress.total} certificates generated{(finalStats?.failed ?? progress.failed) ? `, ${finalStats?.failed ?? progress.failed} failed` : ''}.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => navigate(`/app/bulk/${jobId}`)}><Download className="h-4 w-4" /> View job & download</Button>
            <Button variant="secondary" onClick={reset}>Start another</Button>
          </div>
          {(finalStats?.failed ?? progress.failed) > 0 && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> Some rows failed — you can retry them from the job page.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
