import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, PenLine, Plus, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { identityApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { User } from '@/shared/api/types';
import { keys, useAreas, useRoles } from '@/shared/hooks/queries';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { cn } from '@/shared/lib/cn';
import { formatRelative } from '@/shared/lib/date';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, Switch } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Pill } from '@/shared/ui/pill';
import { ResponsiveList } from '@/shared/ui/responsive-list';
import { toast } from '@/shared/ui/sonner';

function Chips<T extends { id: string; name: string }>({ items, selected, onChange }: { items: T[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => {
        const on = selected.includes(i.id);
        return (
          <button
            type="button"
            key={i.id}
            onClick={() => onChange(on ? selected.filter((x) => x !== i.id) : [...selected, i.id])}
            className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >
            {i.name}
          </button>
        );
      })}
    </div>
  );
}

function UserDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (v: boolean) => void; user?: User }) {
  const qc = useQueryClient();
  const roles = useRoles();
  const areas = useAreas();
  const [f, setF] = useState({ email: '', full_name: '', phone: '', position: '', password: '', active: true });
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const sigRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setF({ email: user?.email ?? '', full_name: user?.full_name ?? '', phone: user?.phone ?? '', position: user?.position ?? '', password: '', active: user?.active ?? true });
    setRoleIds(user?.roles.map((r) => r.id) ?? []);
    setAreaIds(user?.areas.map((a) => a.id) ?? []);
  }, [open, user]);
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['users'] });
    void qc.invalidateQueries({ queryKey: ['users-lookup'] });
  };
  const save = useMutation({
    mutationFn: () => {
      const base = { full_name: f.full_name, phone: f.phone || null, position: f.position || null, role_ids: roleIds, area_ids: areaIds };
      return user
        ? identityApi.updateUser(user.id, { ...base, active: f.active, ...(f.password ? { password: f.password } : {}) })
        : identityApi.createUser({ ...base, email: f.email, password: f.password });
    },
    onSuccess: () => {
      done();
      toast.success('Usuario guardado');
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const sig = useMutation({
    mutationFn: (file: File) => identityApi.uploadUserSignature(user!.id, file),
    onSuccess: () => {
      done();
      toast.success('Firma cargada');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const valid = f.full_name.length >= 2 && (user || (/\S+@\S+/.test(f.email) && f.password.length >= 8)) && (!f.password || f.password.length >= 8);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{user ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Correo" required>
            <Input type="email" value={f.email} disabled={!!user} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Nombre completo" required>
            <Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          </Field>
          <Field label="Cargo" hint="Aparece bajo la firma en las cartas.">
            <Input value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} />
          </Field>
          <Field label="Celular">
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label={user ? 'Nueva contraseña (opcional)' : 'Contraseña'} required={!user} hint="Mínimo 8 caracteres.">
            <Input type="password" value={f.password} autoComplete="new-password" onChange={(e) => setF({ ...f, password: e.target.value })} />
          </Field>
          {user && (
            <div className="flex items-end pb-2">
              <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Activo" />
            </div>
          )}
          <Field label="Roles" className="sm:col-span-2" hint="Los permisos del usuario son la suma de sus roles.">
            <Chips items={roles.data ?? []} selected={roleIds} onChange={setRoleIds} />
          </Field>
          <Field label="Áreas" className="sm:col-span-2" hint="Define qué PQRS ve con el permiso 'Ver las PQRS de mis áreas'.">
            <Chips items={(areas.data ?? []).filter((a) => a.active)} selected={areaIds} onChange={setAreaIds} />
          </Field>
          {user && (
            <Field label="Firma (imagen)" className="sm:col-span-2" hint="PNG con fondo transparente. Se usa en las cartas que este usuario aprueba.">
              <Button type="button" variant="outline" size="sm" onClick={() => sigRef.current?.click()} disabled={sig.isPending}>
                <PenLine />
                {user.has_signature ? 'Reemplazar firma' : 'Cargar firma'}
              </Button>
              <input ref={sigRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) sig.mutate(file); }} />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersPage() {
  const [q, setQ] = useState('');
  const dq = useDebouncedValue(q, 300);
  const list = useQuery({ queryKey: keys.users(dq), queryFn: () => identityApi.users(dq || undefined) });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | undefined>();
  const columns: ColumnDef<User, unknown>[] = [
    {
      header: 'Usuario',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.full_name}</p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    { header: 'Roles', cell: ({ row }) => <span className="text-sm">{row.original.roles.map((r) => r.name).join(', ') || '—'}</span> },
    { header: 'Áreas', cell: ({ row }) => <span className="text-sm">{row.original.areas.map((a) => a.name).join(', ') || '—'}</span> },
    { header: 'Último ingreso', cell: ({ row }) => <span className="text-sm">{row.original.last_login_at ? formatRelative(row.original.last_login_at) : 'Nunca'}</span> },
    { header: 'Estado', cell: ({ row }) => (row.original.active ? <Pill tone="bg-success/15 text-success border-success/30">Activo</Pill> : <Pill>Inactivo</Pill>) },
  ];
  return (
    <div className="space-y-4">
      <PageHeader
        title="Usuarios"
        description="Personas que acceden a la plataforma, con sus roles y áreas."
        actions={
          <Button onClick={() => { setEditing(undefined); setOpen(true); }}>
            <Plus />
            Nuevo usuario
          </Button>
        }
      />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo" className="pl-9" />
      </div>
      <ResponsiveList
        data={list.data ?? []}
        columns={columns}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        onRowClick={(u) => { setEditing(u); setOpen(true); }}
        renderCard={(u) => (
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{u.full_name}</p>
              {!u.active && <Pill>Inactivo</Pill>}
            </div>
            <p className="text-xs text-muted-foreground">{u.email}</p>
            <p className="text-xs text-muted-foreground">{u.roles.map((r) => r.name).join(', ')}</p>
          </div>
        )}
      />
      <UserDialog open={open} onOpenChange={setOpen} user={editing} />
    </div>
  );
}
