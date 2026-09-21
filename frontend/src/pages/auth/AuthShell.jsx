import { Link } from 'react-router-dom';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">B</span>
            <span className="font-bold tracking-tight">BulkCertifyX</span>
          </Link>
          <h1 className="mt-8 text-2xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
        </div>
      </div>

      {/* Brand side */}
      <div className="relative hidden bg-brand-600 lg:block">
        <div className="absolute inset-0 flex flex-col justify-center px-16 text-white">
          <blockquote className="max-w-md font-serif text-2xl leading-snug">
            "We issued 4,000 workshop certificates in an afternoon — and every one is verifiable by QR."
          </blockquote>
          <p className="mt-4 text-sm text-brand-100">Certificate automation, done properly.</p>
          <div className="mt-10 flex items-center gap-6 text-sm text-brand-100">
            <span>✓ Bulk generation</span><span>✓ QR verification</span><span>✓ Email delivery</span>
          </div>
        </div>
      </div>
    </div>
  );
}
