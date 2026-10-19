import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { identityApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { Permission, Role } from '@/shared/api/types';
import { keys, usePermissions, useRoles } from '@/shared/hooks/queries';
import { cn } from '@/shared/lib/cn';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { toast } from '@/shared/ui/sonner';
import { LoadingState } from '@/shared/ui/states/LoadingState';

export function RolesPage() {
  const qc = useQueryClient();
  const roles = useRoles();
  const perms = usePermissions();
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const role = roles.data?.find((r) => r.id === selectedId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedId && roles.data?.[0]) setSelectedId(roles.data[0].id);
  }, [roles.data, selectedId]);
  useEffect(() => {
    if (selectedId === 'new') {
      setName('');
      setDescription('');
      setChosen([]);
    } else if (role) {
      setName(role.name);
      setDescription(role.description ?? '');
      setChosen(role.permissions);
    }
  }, [selectedId, role]);

  const groups = useMemo(() => {
    const m = new Map<string, Permission[]>();
    for (const p of perms.data ?? []) m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return [...m.entries()];
  }, [perms.data]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.roles });
    void qc.invalidateQueries({ queryKey: ['users'] });
  };
  const save = useMutation({
    mutationFn: () =>
      selectedId === 'new'
        ? identityApi.createRole({ name, description: description || null, permissions: chosen })
        : identityApi.updateRole(role!.id, { name, description: description || null, ...(role!.all_permissions ? {} : { permissions: chosen }) }),
    onSuccess: (r: Role) => {
      refresh();
      setSelectedId(r.id);
      toast.success('Rol guardado');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => identityApi.deleteRole(role!.id),
    onSuccess: () => {
      refresh();
      setSelectedId(null);
      toast.success('Rol eliminado');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (roles.isLoading || perms.isLoading) return <LoadingState />;
  const locked = !!role?.all_permissions;
  const toggle = (code: string) => setChosen((c) => (c.includes(code) ? c.filter((x) => x !== code) : [...c, code]));

  return (
    <div className="space-y-4">
      <PageHeader title="Roles y permisos" description="Crea roles a la medida combinando permisos. Los cambios aplican de inmediato." />
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="self-start">
          <CardContent className="space-y-1 p-2">
            {(roles.data ?? []).map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={cn('flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm', selectedId === r.id ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted')}
              >
                {r.name}
                {r.is_system && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            ))}
            <Button variant="ghost" className="w-full justify-start" onClick={() => setSelectedId('new')}>
              <Plus />
              Nuevo rol
            </Button>
          </CardContent>
        </Card>
        {(role || selectedId === 'new') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{selectedId === 'new' ? 'Nuevo rol' : role?.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {locked && (
                <Alert>
                  <AlertDescription>El Administrador tiene siempre todos los permisos, incluidos los de módulos futuros.</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Descripción">
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
              </div>
              <div className="space-y-4">
                {groups.map(([group, items]) => (
                  <div key={group} className="space-y-2">
                    <p className="text-sm font-semibold">{group}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((p) => (
                        <label key={p.code} className={cn('flex items-start gap-2 rounded-md border p-2.5 text-sm', locked && 'opacity-70')}>
                          <Checkbox checked={locked || chosen.includes(p.code)} disabled={locked} onCheckedChange={() => toggle(p.code)} className="mt-0.5" />
                          <span>
                            {p.label}
                            <span className="block font-mono text-[11px] text-muted-foreground">{p.code}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between gap-2">
                {role && !role.is_system ? (
                  <Button variant="ghost" className="text-destructive" onClick={() => confirm(`¿Eliminar el rol ${role.name}?`) && remove.mutate()}>
                    <Trash2 />
                    Eliminar
                  </Button>
                ) : (
                  <span />
                )}
                <Button onClick={() => save.mutate()} disabled={name.trim().length < 2 || save.isPending}>
                  {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                  Guardar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
