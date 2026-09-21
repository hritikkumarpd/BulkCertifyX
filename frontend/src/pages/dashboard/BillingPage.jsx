import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost } from '../../lib/api.js';
import { useOrg } from '../../store/OrgContext.jsx';
import { Button, Badge, Skeleton, Modal } from '../../components/ui.jsx';
import { cn } from '../../lib/cn.js';

const PLANS = [
  { id: 'free', name: 'Free', monthly: 0, annual: 0 },
  { id: 'starter', name: 'Starter', monthly: 199, annual: 1990 },
  { id: 'pro', name: 'Pro', monthly: 599, annual: 5990 },
  { id: 'enterprise', name: 'Enterprise', monthly: 1999, annual: 19990 },
];

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function BillingPage() {
  const { current } = useOrg();
  const qc = useQueryClient();
  const [annual, setAnnual] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const isOwner = current?.role === 'owner';

  const { data, isLoading } = useQuery({ queryKey: ['billing'], queryFn: () => apiGet('/billing') });

  async function subscribe(tier) {
    if (!data.configured) return toast.error('Billing is not configured on this server.');
    try {
      setBusy(true);
      const { subscriptionId, keyId } = await apiPost('/billing/subscribe', { tier, cycle: annual ? 'annual' : 'monthly' });
      const ok = await loadRazorpay();
      if (!ok) return toast.error('Could not load payment gateway.');
      const rzp = new window.Razorpay({
        key: keyId, subscription_id: subscriptionId, name: 'BulkCertifyX',
        description: `${tier} plan`, theme: { color: '#4f46e5' },
        handler: () => { toast.success('Payment successful — your plan activates shortly.'); setTimeout(() => qc.invalidateQueries({ queryKey: ['billing'] }), 3000); },
      });
      rzp.open();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function cancel() {
    try { await apiPost('/billing/cancel', {}); toast.success('Subscription will cancel at period end.'); setCancelOpen(false); qc.invalidateQueries({ queryKey: ['billing'] }); }
    catch (e) { toast.error(e.message); }
  }

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-32 w-full" /></div>;

  const sub = data.subscription;

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Billing</h1>
      <p className="text-sm text-muted">Manage your subscription and view billing history.</p>

      {/* Current plan */}
      <div className="mt-6 card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Current plan</p>
            <p className="mt-1 text-xl font-bold capitalize text-ink">{sub.plan} <Badge tone={sub.status === 'active' ? 'success' : 'warning'}>{sub.status}</Badge></p>
            {sub.current_period_end && <p className="mt-1 text-xs text-muted">Next billing: {new Date(sub.current_period_end).toLocaleDateString()}</p>}
            {sub.cancel_at_period_end && <p className="mt-1 text-xs text-warning">Cancels at end of current period.</p>}
          </div>
          {isOwner && sub.plan !== 'free' && sub.status === 'active' && !sub.cancel_at_period_end && (
            <Button variant="secondary" onClick={() => setCancelOpen(true)}>Cancel subscription</Button>
          )}
        </div>
        {!data.configured && <p className="mt-3 text-xs text-muted">Billing is not configured on this server (test mode).</p>}
      </div>

      {/* Plan picker */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Plans</h2>
        <div className="inline-flex items-center gap-1 rounded-lg border border-line bg-white p-1 text-sm">
          <button onClick={() => setAnnual(false)} className={cn('rounded-md px-3 py-1 font-medium', !annual ? 'bg-brand-600 text-white' : 'text-muted')}>Monthly</button>
          <button onClick={() => setAnnual(true)} className={cn('rounded-md px-3 py-1 font-medium', annual ? 'bg-brand-600 text-white' : 'text-muted')}>Annual</button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const isCurrent = sub.plan === p.id;
          return (
            <div key={p.id} className={cn('rounded-xl border bg-white p-5', isCurrent ? 'border-brand-600' : 'border-line')}>
              <p className="font-semibold text-ink">{p.name}</p>
              <p className="mt-2"><span className="text-2xl font-bold text-ink">₹{annual ? p.annual : p.monthly}</span><span className="text-sm text-muted">/{annual ? 'yr' : 'mo'}</span></p>
              {isCurrent ? (
                <Button variant="secondary" className="mt-4 w-full" disabled>Current plan</Button>
              ) : p.id === 'free' ? (
                <Button variant="secondary" className="mt-4 w-full" disabled>—</Button>
              ) : (
                <Button className="mt-4 w-full" disabled={!isOwner || busy} onClick={() => subscribe(p.id)}>
                  {sub.plan === 'free' ? 'Upgrade' : 'Change plan'}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {!isOwner && <p className="mt-2 text-xs text-muted">Only the organization owner can change the subscription.</p>}

      {/* History */}
      <div className="mt-8 card p-5">
        <p className="mb-3 text-sm font-medium text-ink">Billing history</p>
        {!data.history?.length ? (
          <p className="py-6 text-center text-sm text-muted">No billing history yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2"></th></tr></thead>
            <tbody>
              {data.history.map((h) => (
                <tr key={h.id} className="border-b border-line">
                  <td className="p-2 text-muted">{new Date(h.created_at).toLocaleDateString()}</td>
                  <td className="p-2 capitalize text-ink">{h.type}</td>
                  <td className="p-2 text-ink">{h.amount ? `₹${(h.amount / 100).toFixed(2)}` : '—'}</td>
                  <td className="p-2"><Badge tone={h.status === 'paid' ? 'success' : h.status === 'failed' ? 'danger' : 'neutral'}>{h.status || '—'}</Badge></td>
                  <td className="p-2 text-right">{h.invoice_url && <a href={h.invoice_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Invoice</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel subscription?"
        footer={<><Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep plan</Button><Button variant="danger" onClick={cancel}>Cancel subscription</Button></>}>
        <p className="text-sm text-muted">Your plan stays active until the end of the current billing period, then reverts to Free.</p>
      </Modal>
    </div>
  );
}
