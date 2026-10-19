import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { authApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import { useSessionStore } from '@/shared/session/session.store';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

const schema = z.object({
  email: z.string().min(1, 'Ingresa tu correo').email('Correo inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const { token, setToken, setUser } = useSessionStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  if (token && useSessionStore.getState().user) return <Navigate to="/" replace />;

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const t = await authApi.login(v.email, v.password);
      setToken(t.access_token);
      setUser(await authApi.me());
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Card className="w-full max-w-sm shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Ingresar</CardTitle>
        <CardDescription>Usa el correo y la contraseña que te asignó tu empresa.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field label="Correo" htmlFor="email" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="username" autoFocus {...form.register('email')} />
          </Field>
          <Field label="Contraseña" htmlFor="password" error={form.formState.errors.password?.message}>
            <div className="relative">
              <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" className="pr-10" {...form.register('password')} />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
                aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />}
            Ingresar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
