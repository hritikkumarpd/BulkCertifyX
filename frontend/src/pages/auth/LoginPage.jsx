import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AuthShell from './AuthShell.jsx';
import { Input, Button } from '../../components/ui.jsx';
import { useAuth } from '../../store/AuthContext.jsx';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    try {
      await signIn(values);
      navigate('/app');
    } catch (err) {
      toast.error(err.message || 'Unable to sign in.');
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your BulkCertifyX account."
      footer={<>Don't have an account? <Link to="/register" className="font-medium text-brand-600 hover:underline">Create one</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
        <div>
          <Input label="Password" type="password" autoComplete="current-password" {...register('password')} error={errors.password?.message} />
          <div className="mt-1.5 text-right">
            <Link to="/forgot-password" className="text-xs text-brand-600 hover:underline">Forgot password?</Link>
          </div>
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full">Sign in</Button>
      </form>
    </AuthShell>
  );
}
