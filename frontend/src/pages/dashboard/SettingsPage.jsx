import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Building2, Palette, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPatch } from '../../lib/api.js';
import { useOrg } from '../../store/OrgContext.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import { Button, Input, Textarea, Skeleton } from '../../components/ui.jsx';
import { cn } from '../../lib/cn.js';

const TABS = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'danger', label: 'Danger zone', icon: AlertTriangle },
];

export default function SettingsPage() {
  const { current, refresh } = useOrg();
  const qc = useQueryClient();
  const [tab, setTab] = useState('general');
  const canEdit = ['owner', 'admin'].includes(current?.role);
  const isOwner = current?.role === 'owner';
  const whiteLabelAllowed = ['pro', 'enterprise'].includes(current?.plan);

  const { data: org, isLoading } = useQuery({ queryKey: ['organization'], queryFn: () => apiGet('/organization') });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['organization'] });
    refresh();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Settings</h1>
      <p className="text-sm text-muted">Manage your organization profile, branding, and account security.</p>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium -mb-px',
              tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-muted hover:text-ink'
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 max-w-2xl">
        {isLoading ? (
          <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /></div>
        ) : (
          <>
            {tab === 'general' && <GeneralTab org={org} canEdit={canEdit} onSaved={invalidate} />}
            {tab === 'branding' && <BrandingTab org={org} canEdit={canEdit} whiteLabelAllowed={whiteLabelAllowed} onSaved={invalidate} />}
            {tab === 'security' && <SecurityTab />}
            {tab === 'danger' && <DangerTab isOwner={isOwner} orgName={org?.name} />}
          </>
        )}
      </div>
    </div>
  );
}

function GeneralTab({ org, canEdit, onSaved }) {
  const { register, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm();
  useEffect(() => {
    reset({
      name: org?.name || '',
      website: org?.website || '',
      contact_email: org?.contact_email || '',
      address: org?.address || '',
    });
  }, [org, reset]);

  const submit = async (v) => {
    try {
      await apiPatch('/organization', {
        name: v.name,
        website: v.website || null,
        contact_email: v.contact_email || null,
        address: v.address || null,
      });
      toast.success('Organization updated.');
      onSaved();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="card space-y-4 p-5">
      <Input label="Organization name" {...register('name', { required: true })} disabled={!canEdit} />
      <Input label="Website" placeholder="https://yourorg.com" {...register('website')} disabled={!canEdit} />
      <Input label="Contact email" type="email" {...register('contact_email')} disabled={!canEdit} />
      <Textarea label="Address" {...register('address')} disabled={!canEdit} />
      {canEdit ? (
        <div className="flex justify-end"><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button></div>
      ) : (
        <p className="text-xs text-muted">Only owners and admins can edit organization details.</p>
      )}
    </form>
  );
}

function BrandingTab({ org, canEdit, whiteLabelAllowed, onSaved }) {
  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting, isDirty } } = useForm();
  useEffect(() => {
    reset({
      brand_name: org?.brand_name || '',
      brand_color: org?.brand_color || '#4F46E5',
      logo_url: org?.logo_url || '',
      footer_text: org?.footer_text || '',
      white_label: !!org?.white_label,
    });
  }, [org, reset]);

  const color = watch('brand_color');
  const whiteLabel = watch('white_label');

  const submit = async (v) => {
    try {
      await apiPatch('/organization', {
        brand_name: v.brand_name || null,
        brand_color: v.brand_color,
        logo_url: v.logo_url || null,
        footer_text: v.footer_text || null,
        white_label: whiteLabelAllowed ? !!v.white_label : false,
      });
      toast.success('Branding updated.');
      onSaved();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="card space-y-4 p-5">
      <Input label="Brand name" placeholder="Shown on certificates and emails" {...register('brand_name')} disabled={!canEdit} />
      <Input label="Logo URL" placeholder="https://.../logo.png" {...register('logo_url')} disabled={!canEdit} />
      <div>
        <label className="label">Brand color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color || '#4F46E5'}
            onChange={(e) => setValue('brand_color', e.target.value.toUpperCase(), { shouldDirty: true })}
            disabled={!canEdit}
            className="h-10 w-14 cursor-pointer rounded-md border border-line bg-white"
          />
          <Input {...register('brand_color', { pattern: /^#[0-9a-fA-F]{6}$/ })} disabled={!canEdit} className="max-w-[140px] font-mono" />
        </div>
      </div>
      <Textarea label="Certificate footer text" {...register('footer_text')} disabled={!canEdit} />

      <div className="rounded-lg border border-line bg-surface p-4">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-ink">White-label mode</span>
            <span className="block text-xs text-muted">Remove BulkCertifyX branding from certificates and verification pages.</span>
          </span>
          <input
            type="checkbox"
            checked={!!whiteLabel}
            onChange={(e) => setValue('white_label', e.target.checked, { shouldDirty: true })}
            disabled={!canEdit || !whiteLabelAllowed}
            className="h-4 w-4 rounded border-line"
          />
        </label>
        {!whiteLabelAllowed && <p className="mt-2 text-xs text-muted">White-label is available on Pro and Enterprise plans.</p>}
      </div>

      {canEdit ? (
        <div className="flex justify-end"><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save branding</Button></div>
      ) : (
        <p className="text-xs text-muted">Only owners and admins can edit branding.</p>
      )}
    </form>
  );
}

function SecurityTab() {
  const { updatePassword } = useAuth();
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const submit = async (v) => {
    if (v.password.length < 8) return toast.error('Password must be at least 8 characters.');
    if (v.password !== v.confirm) return toast.error('Passwords do not match.');
    try {
      await updatePassword(v.password);
      toast.success('Password updated.');
      reset({ password: '', confirm: '' });
    } catch (e) { toast.error(e.message); }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="card space-y-4 p-5">
      <p className="text-sm font-medium text-ink">Change password</p>
      <Input label="New password" type="password" autoComplete="new-password" {...register('password', { required: true })} />
      <Input label="Confirm new password" type="password" autoComplete="new-password" {...register('confirm', { required: true })} />
      <div className="flex justify-end"><Button type="submit" loading={isSubmitting}>Update password</Button></div>
    </form>
  );
}

function DangerTab({ isOwner, orgName }) {
  const [confirm, setConfirm] = useState('');

  const requestDeletion = () => {
    if (confirm !== orgName) return toast.error('Type the organization name to confirm.');
    toast('Contact support to complete deletion', {
      description: 'Organization deletion is handled manually to protect issued certificates. Email support@bulkcertifyx.com from your account address.',
    });
  };

  if (!isOwner) {
    return <div className="card p-5"><p className="text-sm text-muted">Only the organization owner can access the danger zone.</p></div>;
  }

  return (
    <div className="rounded-xl border border-danger/30 bg-red-50/50 p-5">
      <p className="flex items-center gap-2 font-semibold text-danger"><AlertTriangle className="h-4 w-4" /> Delete organization</p>
      <p className="mt-1 text-sm text-muted">
        This permanently removes the organization, its templates, and dashboard access. Issued certificates remain verifiable by design.
        Deletion is processed manually to prevent accidental loss.
      </p>
      <div className="mt-4 max-w-sm">
        <Input label={`Type "${orgName}" to confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <Button variant="danger" className="mt-3" onClick={requestDeletion} disabled={confirm !== orgName}>Request deletion</Button>
    </div>
  );
}
