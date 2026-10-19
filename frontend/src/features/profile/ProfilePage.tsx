import { useMutation } from '@tanstack/react-query';
import { Loader2, PenLine, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { authApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import { useSessionStore } from '@/shared/session/session.store';
import { AuthImage } from '@/shared/ui/auth-image';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { toast } from '@/shared/ui/sonner';

export function ProfilePage() {
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const [f, setF] = useState({ full_name: '', phone: '', position: '' });
  const [pw, setPw] = useState({ current: '', next: '' });
  const [sigV, setSigV] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (user) setF({ full_name: user.full_name, phone: user.phone ?? '', position: user.position ?? '' });
  }, [user]);
  const save = useMutation({
    mutationFn: () => authApi.updateMe({ full_name: f.full_name, phone: f.phone || null, position: f.position || null }),
    onSuccess: (me) => {
      setUser(me);
      toast.success('Perfil actualizado');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const changePw = useMutation({
    mutationFn: () => authApi.updateMe({ current_password: pw.current, new_password: pw.next }),
    onSuccess: () => {
      setPw({ current: '', next: '' });
      toast.success('Contraseña actualizada');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const sig = useMutation({
    mutationFn: authApi.uploadSignature,
    onSuccess: async () => {
      setUser(await authApi.me());
      setSigV(Date.now());
      toast.success('Firma actualizada');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!user) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Mi perfil" description={user.email} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos personales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo">
            <Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          </Field>
          <Field label="Cargo" hint="Se imprime bajo tu firma en las cartas.">
            <Input value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} />
          </Field>
          <Field label="Celular">
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <div className="flex items-end justify-end">
            <Button onClick={() => save.mutate()} disabled={f.full_name.length < 2 || save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>
      {user.tenant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Firma</CardTitle>
            <CardDescription>Imagen de tu firma (PNG transparente idealmente). Se usa en las respuestas que apruebas.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            {user.has_signature ? (
              <AuthImage key={sigV} path={`/users/${user.id}/signature`} alt="Firma" className="h-20 w-48 rounded-md border bg-white object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground">Aún no has cargado tu firma.</p>
            )}
            <Button variant="outline" onClick={() => ref.current?.click()} disabled={sig.isPending}>
              {sig.isPending ? <Loader2 className="animate-spin" /> : <PenLine />}
              {user.has_signature ? 'Reemplazar' : 'Cargar firma'}
            </Button>
            <input ref={ref} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) sig.mutate(file); }} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Contraseña actual">
            <Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Field>
          <Field label="Nueva contraseña" hint="Mínimo 8 caracteres.">
            <Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Field>
          <div className="flex justify-end sm:col-span-2">
            <Button variant="outline" onClick={() => changePw.mutate()} disabled={!pw.current || pw.next.length < 8 || changePw.isPending}>
              Actualizar contraseña
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
