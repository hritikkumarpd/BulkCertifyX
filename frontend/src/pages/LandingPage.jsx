import { Link } from 'react-router-dom';
import {
  ArrowRight, FileSpreadsheet, Sparkles, QrCode, Mail, BarChart3, Users, KeyRound, Globe,
  CheckCircle2, ShieldCheck,
} from 'lucide-react';
import MarketingNav from '../components/MarketingNav.jsx';
import MarketingFooter from '../components/MarketingFooter.jsx';
import CertificatePreview from '../components/CertificatePreview.jsx';

const USE_CASES = ['Universities', 'Coaching institutes', 'Ed-tech', 'Corporations', 'Bootcamps', 'NGOs', 'Event organizers'];

const FEATURES = [
  { icon: Sparkles, title: 'Template builder', body: 'Design certificates with a visual editor — text, logos, signatures, backgrounds, and dynamic variables.' },
  { icon: FileSpreadsheet, title: 'Bulk generation', body: 'Upload a CSV, map columns, and generate thousands of certificates in the background.' },
  { icon: QrCode, title: 'QR verification', body: 'Every certificate gets a unique code and QR that anyone can scan to verify authenticity.' },
  { icon: Mail, title: 'Email delivery', body: 'Deliver certificates straight to recipients with your branding and track delivery.' },
  { icon: BarChart3, title: 'Analytics', body: 'See certificates issued, verification rates, and trends across every event.' },
  { icon: Users, title: 'Team collaboration', body: 'Invite teammates with roles and permissions. Owner, admin, and member.' },
  { icon: KeyRound, title: 'Developer API', body: 'Issue and verify certificates programmatically with scoped API keys.' },
  { icon: Globe, title: 'Custom domains', body: 'Verify certificates on your own branded domain with white-label pages.' },
];

const STEPS = [
  ['01', 'Create your template', 'Design once with dynamic fields like {{recipient_name}} and {{event_name}}.'],
  ['02', 'Upload your recipients', 'Drag in a CSV. We auto-map columns and flag errors before you generate.'],
  ['03', 'Generate certificates', 'Thousands render in the background with a live progress view.'],
  ['04', 'Deliver and verify', 'Email recipients and let anyone verify with a QR code.'],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-content items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <span className="eyebrow">Certificate automation platform</span>
            <h1 className="mt-3 font-serif text-4xl font-bold leading-[1.1] text-ink sm:text-5xl lg:text-[3.4rem]">
              Generate Certificates.<br />In Bulk. Instantly.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
              Create beautiful certificates, automate bulk issuance, deliver them to recipients, and let anyone verify authenticity with a QR code.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register" className="btn-primary px-5 py-2.5 text-base">Start free <ArrowRight className="h-4 w-4" /></Link>
              <a href="#features" className="btn-secondary px-5 py-2.5 text-base">Explore features</a>
            </div>
            <div className="mt-6 flex items-center gap-4 text-sm text-muted">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> 25 free certificates/mo</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" /> No card required</span>
            </div>
          </div>

          {/* Hero visual: real certificate + pipeline */}
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-brand-50 to-transparent" />
            <div className="rotate-1 rounded-xl border border-line bg-white p-2 shadow-pop">
              <CertificatePreview />
            </div>
            <div className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-muted">
              <Pill>CSV</Pill> <Arrow /> <Pill>100 certificates</Pill> <Arrow /> <Pill>Generated</Pill> <Arrow /> <Pill className="border-success/40 text-success">Verified</Pill>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-content px-4 py-8 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted/70">Built for teams that issue certificates at scale</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-muted">
            {USE_CASES.map((u) => <span key={u}>{u}</span>)}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-content px-4 py-20 lg:px-8">
        <div className="max-w-2xl">
          <span className="eyebrow">How it works</span>
          <h2 className="mt-2 text-3xl font-bold text-ink">From spreadsheet to verified certificate in four steps</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([num, title, body]) => (
            <div key={num} className="relative rounded-xl border border-line bg-white p-6">
              <span className="font-serif text-2xl font-bold text-brand-200">{num}</span>
              <h3 className="mt-3 font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-content px-4 py-20 lg:px-8">
          <div className="max-w-2xl">
            <span className="eyebrow">Everything you need</span>
            <h2 className="mt-2 text-3xl font-bold text-ink">A complete platform, not just a generator</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-line bg-white p-6">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50"><f.icon className="h-5 w-5 text-brand-600" /></div>
                <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-content px-4 py-20 lg:px-8">
        <div className="rounded-2xl border border-line bg-brand-600 px-8 py-14 text-center">
          <h2 className="text-3xl font-bold text-white">Start issuing certificates today</h2>
          <p className="mx-auto mt-3 max-w-md text-brand-100">Free to start. Upgrade when you need more volume, custom domains, or API access.</p>
          <Link to="/register" className="mt-7 inline-flex btn bg-white px-6 py-3 text-base text-brand-700 hover:bg-brand-50">
            Create your account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function Pill({ children, className = '' }) {
  return <span className={`rounded-full border border-line bg-white px-3 py-1 ${className}`}>{children}</span>;
}
function Arrow() { return <ArrowRight className="h-3.5 w-3.5 text-muted/50" />; }
