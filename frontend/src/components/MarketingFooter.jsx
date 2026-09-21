import { Link } from 'react-router-dom';

export default function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-content gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">B</span>
            <span className="font-bold">BulkCertifyX</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">Generate certificates in bulk, deliver them, and let anyone verify authenticity with a QR code.</p>
        </div>
        <FooterCol title="Product" links={[['Features', '/#features'], ['How it works', '/#how'], ['Pricing', '/pricing'], ['Verify a certificate', '/verify']]} />
        <FooterCol title="Company" links={[['Contact', '/contact'], ['Terms', '/terms'], ['Privacy', '/privacy'], ['Refund policy', '/refund']]} />
        <FooterCol title="Get started" links={[['Create account', '/register'], ['Sign in', '/login']]} />
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} BulkCertifyX. All rights reserved.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        {links.map(([label, to]) => (
          <li key={label}>
            {to.startsWith('/#') ? <a href={to} className="hover:text-ink">{label}</a> : <Link to={to} className="hover:text-ink">{label}</Link>}
          </li>
        ))}
      </ul>
    </div>
  );
}
