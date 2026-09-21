import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AuthShell from './AuthShell.jsx';
import { Input, Button } from '../../components/ui.jsx';
import { useAuth } from '../../store/AuthContext.jsx';

const schema = z.object({
  password: z.string().min(8, 'Use at least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }) => {
    try {
      await updatePassword(password);
      toast.success('Password updated. You can now use it to sign in.');
      navigate('/app');
    } catch (err) {
      toast.error(err.message || 'Unable to update password. Your reset link may have expired.');
    }
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password for your account.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="New password" type="password" {...register('password')} error={errors.password?.message} />
        <Input label="Confirm password" type="password" {...register('confirm')} error={errors.confirm?.message} />
        <Button type="submit" loading={isSubmitting} className="w-full">Update password</Button>
      </form>
    </AuthShell>
  );
}
