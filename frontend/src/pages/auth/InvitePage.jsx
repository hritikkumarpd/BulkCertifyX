import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import AuthShell from './AuthShell.jsx';
import { Button } from '../../components/ui.jsx';
import { apiPost } from '../../lib/api.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { useOrg } from '../../store/OrgContext.jsx';

export default function InvitePage() {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const { refresh } = useOrg();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function accept() {
    try {
      setBusy(true);
      await apiPost('/team/accept', { token });
      await refresh();
      toast.success('Invitation accepted. Welcome aboard.');
      navigate('/app');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Team invitation" subtitle="You've been invited to collaborate on BulkCertifyX.">
      {loading ? null : !user ? (
        <div className="space-y-3 text-sm text-muted">
          <p>Sign in or create an account with the invited email address to accept this invitation.</p>
          <div className="flex gap-2">
            <Link to="/login" className="btn-primary flex-1">Sign in</Link>
            <Link to="/register" className="btn-secondary flex-1">Create account</Link>
          </div>
        </div>
      ) : (
        <Button className="w-full" onClick={accept} loading={busy}>Accept invitation</Button>
      )}
    </AuthShell>
  );
}
