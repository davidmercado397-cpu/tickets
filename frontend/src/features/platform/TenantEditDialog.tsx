import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, Pencil, Save, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { platformApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { PlatformUser, Tenant } from '@/shared/api/types';
import { formatRelative } from '@/shared/lib/date';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, Switch } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Pill } from '@/shared/ui/pill';
import { toast } from '@/shared/ui/sonner';
import { LoadingState } from '@/shared/ui/states/LoadingState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

const FIELDS: [keyof Tenant, string][] = [
  ['name', 'Nombre'],
  ['legal_name', 'Razón social'],
  ['nit', 'NIT'],
  ['city', 'Ciudad'],
  ['address', 'Dirección'],
  ['phone', 'Teléfono'],
  ['email', 'Correo de contacto'],
  ['website', 'Sitio web'],
];

function DataTab({ tenant, onSaved }: { tenant: Tenant; onSaved: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    setF(Object.fromEntries([...FIELDS.map(([k]) => [k, (tenant[k] as string) ?? '']), ['radicado_prefix', tenant.radicado_prefix]]));
  }, [tenant]);
  const save = useMutation({
    mutationFn: () => platformApi.updateTenant(tenant.id, f),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-tenants'] });
      toast.success('Datos de la empresa actualizados');
      onSaved();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([k, label]) => (
          <Field key={k} label={label} required={k === 'name'}>
            <Input value={f[k] ?? ''} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))} />
          </Field>
        ))}
        <Field label="Prefijo de radicado" hint="Solo letras y números. Aplica a los radicados nuevos.">
          <Input
            value={f.radicado_prefix ?? ''}
            maxLength={10}
            onChange={(e) => setF((s) => ({ ...s, radicado_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
          />
        </Field>
        <Field label="Identificador del portal" hint="No se puede cambiar: los solicitantes ya tienen enlaces con él.">
          <Input value={`/portal/${tenant.slug}`} disabled />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={(f.name ?? '').trim().length < 2 || save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar datos
        </Button>
      </div>
    </div>
  );
}

function UserRow({ tenantId, user }: { tenantId: string; user: PlatformUser }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.full_name);
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(user.active);
  const save = useMutation({
    mutationFn: () =>
      platformApi.updateUser(tenantId, user.id, {
        email: email !== user.email ? email : undefined,
        full_name: name !== user.full_name ? name : undefined,
        password: password || undefined,
        active: active !== user.active ? active : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-users', tenantId] });
      toast.success('Usuario actualizado');
      setPassword('');
      setEditing(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {user.full_name} {user.is_admin && <Pill tone="bg-primary/10 text-primary border-primary/25">Administrador</Pill>}{' '}
            {!user.active && <Pill>Inactivo</Pill>}
          </p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            {user.roles.join(', ') || 'Sin roles'} · último ingreso {user.last_login_at ? formatRelative(user.last_login_at) : 'nunca'}
          </p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            Editar
          </Button>
        )}
      </div>
      {editing && (
        <div className="space-y-3 border-t pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Correo (usuario de ingreso)">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Nueva contraseña" hint="Vacío = no se cambia. Mínimo 8 caracteres.">
              <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <div className="flex items-end pb-2">
              <Switch checked={active} onChange={setActive} label="Activo" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEmail(user.email); setName(user.full_name); setPassword(''); setActive(user.active); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || (password.length > 0 && password.length < 8) || !/\S+@\S+\.\S+/.test(email)}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersTab({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['platform-users', tenantId], queryFn: () => platformApi.users(tenantId) });
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState({ full_name: '', email: '', password: '' });
  const create = useMutation({
    mutationFn: () => platformApi.createAdmin(tenantId, n),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-users', tenantId] });
      toast.success('Administrador agregado');
      setN({ full_name: '', email: '', password: '' });
      setAdding(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (q.isLoading) return <LoadingState rows={3} />;
  return (
    <div className="space-y-3">
      {(q.data ?? []).map((u) => (
        <UserRow key={u.id} tenantId={tenantId} user={u} />
      ))}
      {adding ? (
        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <p className="text-sm font-medium">Nuevo administrador</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Nombre" value={n.full_name} onChange={(e) => setN({ ...n, full_name: e.target.value })} />
            <Input placeholder="Correo" type="email" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} />
            <Input placeholder="Contraseña (mín. 8)" type="password" autoComplete="new-password" value={n.password} onChange={(e) => setN({ ...n, password: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => create.mutate()} disabled={n.full_name.length < 2 || !/\S+@\S+\.\S+/.test(n.email) || n.password.length < 8 || create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}
              Agregar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <UserPlus />
          Agregar administrador
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Los demás usuarios (gestores, jefes de operación, etc.) los crea el administrador de la empresa en Configuración → Usuarios.
      </p>
    </div>
  );
}

export function TenantEditDialog({ tenant, onOpenChange }: { tenant: Tenant | null; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={!!tenant} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {tenant && (
          <>
            <DialogHeader>
              <DialogTitle>{tenant.name}</DialogTitle>
              <DialogDescription>Datos de la empresa y sus usuarios de acceso.</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="datos">
              <TabsList>
                <TabsTrigger value="datos">Datos</TabsTrigger>
                <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
              </TabsList>
              <TabsContent value="datos">
                <DataTab tenant={tenant} onSaved={() => onOpenChange(false)} />
              </TabsContent>
              <TabsContent value="usuarios">
                <UsersTab tenantId={tenant.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
