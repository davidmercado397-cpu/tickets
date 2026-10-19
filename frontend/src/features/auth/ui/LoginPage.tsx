import { useTranslation } from 'react-i18next';

import { LoginForm } from './LoginForm';

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  return (
    <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('common:appName')}</h1>
        <p className="text-sm text-muted-foreground">{t('auth:loginTitle')}</p>
      </div>
      <LoginForm />
    </div>
  );
}
