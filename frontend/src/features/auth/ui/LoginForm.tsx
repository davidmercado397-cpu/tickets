import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { useLogin } from '@/features/auth/hooks/useLogin';
import { loginSchema, type LoginValues } from '@/features/auth/model/login.schema';
import { isUnauthorized } from '@/shared/api/errors';
import { Button } from '@/shared/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';

interface LocationState {
  from?: { pathname?: string };
}

export function LoginForm() {
  const { t } = useTranslation(['auth', 'errors']);
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: LoginValues) => {
    login.mutate(values, {
      onSuccess: () => {
        const from = (location.state as LocationState | null)?.from?.pathname ?? '/tickets';
        navigate(from, { replace: true });
      },
    });
  };

  const errorMessage = login.isError
    ? isUnauthorized(login.error)
      ? t('auth:invalidCredentials')
      : t('errors:generic')
    : null;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth:email')}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth:password')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {errorMessage && (
          <p className="text-sm font-medium text-destructive" role="alert">
            {errorMessage}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? t('auth:signingIn') : t('auth:signIn')}
        </Button>
      </form>
    </Form>
  );
}
