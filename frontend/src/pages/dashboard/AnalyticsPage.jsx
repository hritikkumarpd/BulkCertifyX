import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiGet } from '../../lib/api.js';
import { StatTile, Skeleton, EmptyState } from '../../components/ui.jsx';
import { BarChart3 } from 'lucide-react';

const shortDate = (d) => d.slice(5); // MM-DD

export default function AnalyticsPage() {
  const { data: overview, isLoading } = useQuery({ queryKey: ['analytics', 'overview'], queryFn: () => apiGet('/analytics/overview') });
  const { data: trends } = useQuery({ queryKey: ['analytics', 'trends'], queryFn: () => apiGet('/analytics/trends') });
  const { data: events } = useQuery({ queryKey: ['analytics', 'events'], queryFn: () => apiGet('/analytics/events') });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-40" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-5">{[0,1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Analytics</h1>
      <p className="text-sm text-muted">Insight into issuance and verification.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Certificates issued" value={overview.certificatesIssued} />
        <StatTile label="Verifications" value={overview.verifications} />
        <StatTile label="Verification rate" value={`${overview.verificationRate}%`} />
        <StatTile label="Emails sent" value={overview.emailsSent} />
        <StatTile label="Revoked" value={overview.certificatesRevoked} accent={overview.certificatesRevoked ? 'text-danger' : 'text-muted'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Certificates over time" data={trends?.certificates} />
        <ChartCard title="Verifications over time" data={trends?.verifications} />
      </div>

      <div className="mt-6 card p-5">
        <p className="mb-3 text-sm font-medium text-ink">By event</p>
        {!events?.length ? (
          <EmptyState icon={BarChart3} title="No event data yet" description="Analytics will appear once you issue certificates under events." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-b border-line text-left text-muted"><th className="p-2">Event</th><th className="p-2">Certificates</th><th className="p-2">Verifications</th><th className="p-2">Rate</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-line">
                    <td className="p-2 text-ink">{e.name}</td><td className="p-2 text-muted">{e.certificates}</td>
                    <td className="p-2 text-muted">{e.verifications}</td><td className="p-2 text-muted">{e.verificationRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, data }) {
  const rows = data || [];
  return (
    <div className="card p-5">
      <p className="mb-3 text-sm font-medium text-ink">{title}</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={rows} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
          <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
