import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import AuthShell from './AuthShell.jsx';
import { Input, Button } from '../../components/ui.jsx';
import { useAuth } from '../../store/AuthContext.jsx';

const schema = z.object({ email: z.string().email('Enter a valid email') });

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }) => {
    try { await resetPassword(email); setSent(true); }
    catch (err) { toast.error(err.message || 'Unable to send reset link.'); }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to set a new password."
      footer={<Link to="/login" className="font-medium text-brand-600 hover:underline">Back to sign in</Link>}
    >
      {sent ? (
        <div className="rounded-lg border border-success/30 bg-green-50 p-4 text-sm text-ink">
          If an account exists for that email, a reset link is on its way. Check your inbox.
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
          <Button type="submit" loading={isSubmitting} className="w-full">Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}
