import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { apiPost } from '../lib/api.js';
import { useAuth } from '../store/AuthContext.jsx';
import { useOrg } from '../store/OrgContext.jsx';
import { Button, Input } from '../components/ui.jsx';
import { cn } from '../lib/cn.js';

const USE_CASES = ['University', 'Coaching institute', 'Ed-tech', 'Corporate', 'Bootcamp', 'NGO', 'Event organizer'];

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const { refresh, setCurrent } = useOrg();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [useCase, setUseCase] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  async function createOrg() {
    if (name.trim().length < 2) return toast.error('Enter your organization name.');
    try {
      setBusy(true);
      const org = await apiPost('/organizations', { name: name.trim() });
      await refresh();
      setCurrent(org);
      setStep(2);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">B</span>
          <span className="font-bold tracking-tight">BulkCertifyX</span>
        </div>

        {/* Step dots */}
        <div className="mb-6 flex justify-center gap-2">
          {[1, 2, 3].map((s) => <span key={s} className={cn('h-1.5 w-8 rounded-full', s <= step ? 'bg-brand-600' : 'bg-line')} />)}
        </div>

        <div className="card p-6">
          {step === 1 && (
            <>
              <h1 className="text-xl font-bold text-ink">Create your organization</h1>
              <p className="mt-1 text-sm text-muted">This is your workspace — templates, events, and certificates live here.</p>
              <Input label="Organization name" className="mt-4" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Training Institute" autoFocus />
              <Button className="mt-5 w-full" onClick={createOrg} loading={busy}>Continue</Button>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-xl font-bold text-ink">What will you use it for?</h1>
              <p className="mt-1 text-sm text-muted">This helps us tailor examples. You can skip it.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {USE_CASES.map((u) => (
                  <button key={u} onClick={() => setUseCase(u)}
                    className={cn('rounded-full border px-3 py-1.5 text-sm', useCase === u ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line text-muted hover:bg-surface')}>
                    {u}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(3)}>Skip</Button>
                <Button className="flex-1" onClick={() => setStep(3)}>Continue</Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-xl font-bold text-ink">You're all set</h1>
              <p className="mt-1 text-sm text-muted">Create your first template, then generate certificates in bulk.</p>
              <div className="mt-5 space-y-2">
                <Button className="w-full" onClick={() => navigate('/app/templates')}>Create your first template</Button>
                <Button variant="secondary" className="w-full" onClick={() => navigate('/app')}>Go to dashboard</Button>
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-muted"><Link to="/app" className="hover:text-ink">Skip for now</Link></p>
      </div>
    </div>
  );
}
