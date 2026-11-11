import { Navigate, useLocation, useNavigate } from 'react-router';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { appConfig } from '@/config/app.config';
import { useAuth } from '@/platform';
import { useSignIn } from '../api/auth.mutations';
import { SignInForm } from '../forms/SignInForm';

export function LoginPage() {
  const { status } = useAuth();
  const signIn = useSignIn();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';

  if (status === 'authenticated') return <Navigate to={from} replace />;

  return (
    <div className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm p-6">
        <div>
          <CardTitle className="text-xl">Sign in to {appConfig.name}</CardTitle>
          <CardDescription className="mt-1">Use the email your administrator registered for you.</CardDescription>
        </div>
        <SignInForm
          onSubmit={async (values) => {
            await signIn.mutateAsync(values);
            navigate(from, { replace: true });
          }}
        />
      </Card>
    </div>
  );
}
