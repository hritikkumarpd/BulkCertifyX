import { Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.jsx';

export default function MarketingNav() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between px-4 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">B</span>
          <span className="font-bold tracking-tight">BulkCertifyX</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          <a href="/#features" className="hover:text-ink">Features</a>
          <a href="/#how" className="hover:text-ink">How it works</a>
          <Link to="/pricing" className="hover:text-ink">Pricing</Link>
          <Link to="/verify" className="hover:text-ink">Verify</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/app" className="btn-primary">Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn-ghost hidden sm:inline-flex">Sign in</Link>
              <Link to="/register" className="btn-primary">Start free</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
