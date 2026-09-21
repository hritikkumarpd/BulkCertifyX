import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldX, ShieldAlert, Search, Loader2, Building2 } from 'lucide-react';
import axios from 'axios';
import CertificatePreview from '../components/CertificatePreview.jsx';

const API = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/public`;

export default function VerifyPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(code || '');
  const [state, setState] = useState({ status: 'idle' }); // idle|loading|done|error

  useEffect(() => { if (code) runVerify(code); }, [code]);

  async function runVerify(c) {
    setState({ status: 'loading' });
    try {
      const { data } = await axios.get(`${API}/verify/${encodeURIComponent(c.trim().toUpperCase())}`);
      setState({ status: 'done', data: data.data });
    } catch {
      setState({ status: 'error' });
    }
  }

  const submit = (e) => { e.preventDefault(); if (input.trim()) navigate(`/verify/${input.trim().toUpperCase()}`); };
  const r = state.data;

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="text-center">
          <span className="grid mx-auto h-12 w-12 place-items-center rounded-xl bg-brand-600 text-lg font-bold text-white">B</span>
          <h1 className="mt-4 text-2xl font-bold text-ink">Verify a certificate</h1>
          <p className="mt-1 text-sm text-muted">Enter the verification code or scan the QR on any certificate.</p>
        </div>

        <form onSubmit={submit} className="mx-auto mt-6 flex max-w-md gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="CERT-XXXX-XXXX" className="input font-mono uppercase" />
          <button className="btn-primary shrink-0"><Search className="h-4 w-4" /> Verify</button>
        </form>

        <div className="mt-8">
          {state.status === 'loading' && (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>
          )}

          {state.status === 'done' && r?.result === 'valid' && <ValidResult r={r} />}
          {state.status === 'done' && r?.result === 'revoked' && (
            <StatusCard icon={ShieldX} tone="danger" title="Certificate Revoked"
              body={`This certificate is no longer considered valid by the issuing organization.${r.certificate.revokeReason ? ` Reason: ${r.certificate.revokeReason}.` : ''}`} r={r} />
          )}
          {state.status === 'done' && r?.result === 'expired' && (
            <StatusCard icon={ShieldAlert} tone="warning" title="Certificate Expired"
              body="This certificate has passed its expiry date and is no longer valid." r={r} />
          )}
          {state.status === 'done' && r?.result === 'not_found' && (
            <StatusCard icon={ShieldX} tone="neutral" title="Certificate Not Found"
              body="Check the verification code and try again." />
          )}
          {state.status === 'error' && (
            <StatusCard icon={ShieldX} tone="neutral" title="Something went wrong"
              body="We couldn't verify this certificate right now. Please try again." />
          )}
        </div>
      </div>
    </div>
  );
}

function ValidResult({ r }) {
  const c = r.certificate;
  return (
    <div>
      <div className="rounded-xl border border-success/30 bg-green-50 p-5 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-success" />
        <h2 className="mt-2 text-lg font-bold text-ink">Certificate Verified</h2>
        <p className="text-sm text-muted">This certificate was issued by {r.organization.name}.</p>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Recipient" value={c.recipientName} />
          <Field label="Certificate" value={c.eventName || '—'} />
          <Field label="Issued by" value={c.issuedBy} />
          <Field label="Issue date" value={c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : '—'} />
          {c.expiresAt && <Field label="Expires" value={new Date(c.expiresAt).toLocaleDateString()} />}
          <Field label="Verification ID" value={c.code} mono />
        </div>
        <div className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-sm text-muted">
          <Building2 className="h-4 w-4" /> {r.organization.name}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-white p-2">
        <CertificatePreview recipient={c.recipientName} course={c.eventName || ''} org={r.organization.name} code={c.code} />
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, tone, title, body, r }) {
  const toneMap = {
    danger: 'border-danger/30 bg-red-50 text-danger',
    warning: 'border-warning/30 bg-amber-50 text-warning',
    neutral: 'border-line bg-white text-muted',
  };
  return (
    <div className={`rounded-xl border p-6 text-center ${toneMap[tone]}`}>
      <Icon className="mx-auto h-10 w-10" />
      <h2 className="mt-2 text-lg font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{body}</p>
      {r?.certificate && (
        <div className="mx-auto mt-4 max-w-xs text-left text-sm">
          <Field label="Recipient" value={r.certificate.recipientName} />
          <Field label="Verification ID" value={r.certificate.code} mono />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted/70">{label}</p>
      <p className={`mt-0.5 text-ink ${mono ? 'font-mono text-sm' : 'font-medium'}`}>{value}</p>
    </div>
  );
}
