import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import MarketingNav from '../components/MarketingNav.jsx';
import MarketingFooter from '../components/MarketingFooter.jsx';

const PLANS = [
  { id: 'free', name: 'Free', monthly: 0, annual: 0, tagline: 'For getting started', cta: 'Start free' },
  { id: 'starter', name: 'Starter', monthly: 199, annual: 1990, tagline: 'For small institutes', cta: 'Choose Starter' },
  { id: 'pro', name: 'Pro', monthly: 599, annual: 5990, tagline: 'For growing organizations', cta: 'Choose Pro', featured: true },
  { id: 'enterprise', name: 'Enterprise', monthly: 1999, annual: 19990, tagline: 'For large teams', cta: 'Choose Enterprise' },
];

const ROWS = [
  ['Certificates / month', ['25', '500', '5,000', 'Unlimited']],
  ['Bulk per job', ['10', '200', '1,000', 'Unlimited']],
  ['Templates', ['1', '5', 'Unlimited', 'Unlimited']],
  ['Team members', ['1', '2', '3', 'Unlimited']],
  ['Email delivery', [false, true, true, true]],
  ['Analytics', ['Basic', 'Basic', 'Full', 'Full']],
  ['Custom domain', [false, false, true, true]],
  ['White label', [false, false, true, true]],
  ['Developer API', [false, false, true, true]],
  ['Support', ['Community', 'Email', 'Priority', 'Dedicated']],
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  return (
    <div className="min-h-screen bg-canvas">
      <MarketingNav />
      <section className="mx-auto max-w-content px-4 py-16 lg:px-8">
        <div className="text-center">
          <span className="eyebrow">Pricing</span>
          <h1 className="mt-2 text-4xl font-bold text-ink">Simple, transparent pricing</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted">Start free. Upgrade as you grow. No hidden fees.</p>
          <div className="mt-6 inline-flex items-center gap-1 rounded-lg border border-line bg-white p-1">
            <button onClick={() => setAnnual(false)} className={`rounded-md px-4 py-1.5 text-sm font-medium ${!annual ? 'bg-brand-600 text-white' : 'text-muted'}`}>Monthly</button>
            <button onClick={() => setAnnual(true)} className={`rounded-md px-4 py-1.5 text-sm font-medium ${annual ? 'bg-brand-600 text-white' : 'text-muted'}`}>Annual <span className="text-xs opacity-80">save ~2mo</span></button>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.id} className={`relative rounded-xl border bg-white p-6 ${p.featured ? 'border-brand-600 shadow-pop' : 'border-line'}`}>
              {p.featured && <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">Most popular</span>}
              <h3 className="font-semibold text-ink">{p.name}</h3>
              <p className="text-sm text-muted">{p.tagline}</p>
              <div className="mt-4">
                <span className="text-3xl font-bold text-ink">₹{annual ? p.annual : p.monthly}</span>
                <span className="text-sm text-muted">/{annual ? 'year' : 'month'}</span>
              </div>
              <Link to="/register" className={`mt-5 w-full ${p.featured ? 'btn-primary' : 'btn-secondary'}`}>{p.cta}</Link>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="mt-16 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-3 text-left font-medium text-muted">Features</th>
                {PLANS.map((p) => <th key={p.id} className="p-3 text-center font-semibold text-ink">{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, vals]) => (
                <tr key={label} className="border-t border-line">
                  <td className="p-3 text-muted">{label}</td>
                  {vals.map((v, i) => (
                    <td key={i} className="p-3 text-center">
                      {v === true ? <Check className="mx-auto h-4 w-4 text-success" />
                        : v === false ? <Minus className="mx-auto h-4 w-4 text-muted/40" />
                        : <span className="text-ink">{v}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
