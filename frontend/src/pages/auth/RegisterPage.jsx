import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AuthShell from './AuthShell.jsx';
import { Input, Button } from '../../components/ui.jsx';
import { useAuth } from '../../store/AuthContext.jsx';

const schema = z.object({
  fullName: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    try {
      const data = await signUp(values);
      if (data.session) {
        navigate('/onboarding');
      } else {
        toast.success('Check your email to verify your account, then sign in.');
        navigate('/login');
      }
    } catch (err) {
      toast.error(err.message || 'Unable to create account.');
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start issuing verifiable certificates in minutes."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Full name" {...register('fullName')} error={errors.fullName?.message} />
        <Input label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
        <Input label="Password" type="password" autoComplete="new-password" {...register('password')} error={errors.password?.message} />
        <Button type="submit" loading={isSubmitting} className="w-full">Create account</Button>
        <p className="text-xs text-muted">By creating an account you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
      </form>
    </AuthShell>
  );
}
