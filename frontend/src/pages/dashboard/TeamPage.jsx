import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Mail, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api.js';
import { useOrg } from '../../store/OrgContext.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import { Button, Input, Select, Badge, Skeleton, Modal } from '../../components/ui.jsx';

export default function TeamPage() {
  const { current } = useOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toRemove, setToRemove] = useState(null);
  const canManage = ['owner', 'admin'].includes(current?.role);

  const { data, isLoading } = useQuery({ queryKey: ['team'], queryFn: () => apiGet('/team') });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['team'] });

  const changeRole = useMutation({
    mutationFn: ({ id, role }) => apiPatch(`/team/${id}/role`, { role }),
    onSuccess: () => { invalidate(); toast.success('Role updated.'); }, onError: (e) => toast.error(e.message),
  });
  const resend = useMutation({
    mutationFn: (id) => apiPost(`/team/${id}/resend`),
    onSuccess: () => toast.success('Invitation resent.'), onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => apiDelete(`/team/${id}`),
    onSuccess: () => { invalidate(); toast.success('Member removed.'); setToRemove(null); }, onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Team</h1>
          <p className="text-sm text-muted">Invite teammates and manage their access.</p>
        </div>
        {canManage && <Button onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" /> Invite member</Button>}
      </div>

      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-line bg-surface text-left text-muted">
                <th className="p-3">Member</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Joined</th><th className="p-3"></th>
              </tr></thead>
              <tbody>
                {(data || []).map((m) => {
                  const isSelf = m.user_id === user?.id;
                  const isOwner = m.role === 'owner';
                  const editable = canManage && !isOwner && !isSelf;
                  return (
                    <tr key={m.id} className="border-b border-line">
                      <td className="p-3 font-medium text-ink">{m.email}{isSelf && <span className="ml-1 text-xs text-muted">(you)</span>}</td>
                      <td className="p-3">
                        {editable ? (
                          <Select value={m.role} onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })} className="max-w-[130px]">
                            {current.role === 'owner' && <option value="owner">Owner</option>}
                            <option value="admin">Admin</option><option value="member">Member</option>
                          </Select>
                        ) : <span className="capitalize text-ink">{m.role}</span>}
                      </td>
                      <td className="p-3"><Badge tone={m.status === 'active' ? 'success' : 'warning'}>{m.status}</Badge></td>
                      <td className="p-3 text-muted">{m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}</td>
                      <td className="p-3 text-right">
                        {canManage && (
                          <div className="flex justify-end gap-1">
                            {m.status === 'invited' && <button onClick={() => resend.mutate(m.id)} className="btn-ghost px-2 py-1 text-xs"><Mail className="h-3.5 w-3.5" /> Resend</button>}
                            {!isOwner && !isSelf && <button onClick={() => setToRemove(m)} className="btn-ghost px-2 py-1 text-xs text-danger"><Trash2 className="h-3.5 w-3.5" /> Remove</button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onDone={() => { invalidate(); setInviteOpen(false); }} />}

      <Modal open={!!toRemove} onClose={() => setToRemove(null)} title="Remove member?"
        footer={<><Button variant="secondary" onClick={() => setToRemove(null)}>Cancel</Button><Button variant="danger" onClick={() => remove.mutate(toRemove.id)} loading={remove.isPending}>Remove</Button></>}>
        <p className="text-sm text-muted">{toRemove?.email} will lose access to this organization.</p>
      </Modal>
    </div>
  );
}

function InviteModal({ onClose, onDone }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({ defaultValues: { role: 'member' } });
  const submit = async (v) => {
    try { await apiPost('/team/invite', v); toast.success('Invitation sent.'); onDone(); }
    catch (e) { toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} title="Invite a teammate"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit(submit)} loading={isSubmitting}>Send invite</Button></>}>
      <div className="space-y-3">
        <Input label="Email" type="email" {...register('email', { required: true })} />
        <Select label="Role" {...register('role')}><option value="admin">Admin</option><option value="member">Member</option></Select>
      </div>
    </Modal>
  );
}
