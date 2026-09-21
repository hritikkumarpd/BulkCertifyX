import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import {
  LayoutGrid, Award, UploadCloud, LayoutTemplate, CalendarDays, BarChart3,
  Users, KeyRound, Globe, CreditCard, Settings, Menu, X, Search, Bell, LogOut, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../store/AuthContext.jsx';
import { useOrg } from '../store/OrgContext.jsx';
import { cn } from '../lib/cn.js';
import NotificationBell from '../components/NotificationBell.jsx';
import GlobalSearch from '../components/GlobalSearch.jsx';

const NAV = [
  { section: null, items: [{ to: '/app', label: 'Overview', icon: LayoutGrid, end: true }] },
  {
    section: 'Certificates',
    items: [
      { to: '/app/certificates', label: 'Certificates', icon: Award },
      { to: '/app/bulk', label: 'Bulk Generate', icon: UploadCloud },
      { to: '/app/templates', label: 'Templates', icon: LayoutTemplate },
      { to: '/app/events', label: 'Events', icon: CalendarDays },
    ],
  },
  { section: 'Insights', items: [{ to: '/app/analytics', label: 'Analytics', icon: BarChart3 }] },
  { section: 'Organization', items: [
    { to: '/app/team', label: 'Team', icon: Users },
    { to: '/app/api', label: 'API', icon: KeyRound },
    { to: '/app/domains', label: 'Domains', icon: Globe },
    { to: '/app/billing', label: 'Billing', icon: CreditCard },
    { to: '/app/settings', label: 'Settings', icon: Settings },
  ] },
];

function SidebarContent({ onNavigate }) {
  const { current, orgs, switchOrg } = useOrg();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-4">
        <Link to="/app" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">B</span>
          <span className="font-bold tracking-tight text-ink">BulkCertifyX</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {NAV.map((group, i) => (
          <div key={i}>
            {group.section && <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted/70">{group.section}</p>}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-surface hover:text-ink',
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <div className="rounded-lg bg-surface p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted/70">Organization</p>
          {orgs.length > 1 ? (
            <select
              value={current?.id}
              onChange={(e) => switchOrg(e.target.value)}
              className="mt-1 w-full bg-transparent text-sm font-semibold text-ink focus:outline-none"
            >
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          ) : (
            <p className="mt-1 truncate text-sm font-semibold text-ink">{current?.name}</p>
          )}
          <p className="mt-0.5 text-xs capitalize text-muted">{current?.plan} plan</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white">
            <button className="absolute right-3 top-3 text-muted" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:px-8">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5 text-muted" /></button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted hover:bg-white lg:max-w-md"
          >
            <Search className="h-4 w-4" />
            <span>Search certificates, events, templates…</span>
          </button>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <div className="group relative">
              <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {(user?.user_metadata?.full_name || user?.email || 'U')[0].toUpperCase()}
                </span>
                <ChevronDown className="h-4 w-4 text-muted" />
              </button>
              <div className="invisible absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-line bg-white p-1 opacity-0 shadow-pop transition-all group-hover:visible group-hover:opacity-100">
                <div className="px-3 py-2 text-xs text-muted">{user?.email}</div>
                <button onClick={() => navigate('/app/settings')} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-ink hover:bg-surface">
                  <Settings className="h-4 w-4" /> Settings
                </button>
                <button onClick={async () => { await signOut(); navigate('/login'); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger hover:bg-surface">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-content px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
