import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { platformApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { Tenant } from '@/shared/api/types';
import { formatDate } from '@/shared/lib/date';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Pill } from '@/shared/ui/pill';
import { toast } from '@/shared/ui/sonner';
import { LoadingState } from '@/shared/ui/states/LoadingState';

import { finalSlug, typingSlug } from './portalSlug';
import { TenantEditDialog } from './TenantEditDialog';

const EMPTY = { name: '', slug: '', nit: '', radicado_prefix: 'PQRS', city: '', admin_email: '', admin_full_name: '', admin_password: '' };

export function TenantsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['platform-tenants'], queryFn: platformApi.tenants });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const slugPreview = finalSlug(f.slug || f.name);
  const create = useMutation({
    mutationFn: () => platformApi.createTenant({ ...f, slug: finalSlug(f.slug) || null, nit: f.nit || null, city: f.city || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-tenants'] });
      toast.success('Empresa creada con su configuración inicial');
      setOpen(false);
      setF(EMPTY);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => platformApi.updateTenant(v.id, { active: v.active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['platform-tenants'] }),
  });
  const set = (k: keyof typeof EMPTY, v: string) => setF((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Empresas"
        description="Empresas de seguridad que usan la plataforma. Cada una tiene sus datos aislados."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Nueva empresa
          </Button>
        }
      />
      {q.isLoading && <LoadingState rows={3} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((t) => (
          <Card key={t.id}>
            <CardContent className="space-y-2 pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border" style={{ background: t.primary_color }} />
                  <p className="font-semibold">{t.name}</p>
                </div>
                {t.active ? <Pill tone="bg-success/15 text-success border-success/30">Activa</Pill> : <Pill>Suspendida</Pill>}
              </div>
              <p className="text-xs text-muted-foreground">
                {t.nit ? `NIT ${t.nit} · ` : ''}Prefijo {t.radicado_prefix} · desde {formatDate(t.created_at)}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setEditing(t)}>
                  <Pencil />
                  Editar
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/portal/${t.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Portal
                  </a>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggle.mutate({ id: t.id, active: !t.active })}>
                  {t.active ? 'Suspender' : 'Reactivar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nueva empresa</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se crea con roles, áreas, tipos y categorías de PQRS, SLA de 15 días hábiles y un formulario de visita de ejemplo.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" required>
              <Input value={f.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field
              label="Identificador del portal"
              hint={slugPreview ? `Enlace: /portal/${slugPreview}` : 'Vacío = se genera a partir del nombre.'}
            >
              <Input value={f.slug} placeholder="seguridad-andina" onChange={(e) => set('slug', typingSlug(e.target.value))} />
            </Field>
            <Field label="NIT">
              <Input value={f.nit} onChange={(e) => set('nit', e.target.value)} />
            </Field>
            <Field label="Prefijo de radicado">
              <Input
                value={f.radicado_prefix}
                onChange={(e) => set('radicado_prefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={10}
              />
            </Field>
            <Field label="Ciudad">
              <Input value={f.city} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <div />
            <p className="text-sm font-medium sm:col-span-2">Administrador de la empresa</p>
            <Field label="Nombre" required>
              <Input value={f.admin_full_name} onChange={(e) => set('admin_full_name', e.target.value)} />
            </Field>
            <Field label="Correo" required>
              <Input type="email" value={f.admin_email} onChange={(e) => set('admin_email', e.target.value)} />
            </Field>
            <Field label="Contraseña inicial" required hint="Mínimo 8 caracteres.">
              <Input type="password" autoComplete="new-password" value={f.admin_password} onChange={(e) => set('admin_password', e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={!f.name || !f.admin_email || f.admin_password.length < 8 || !f.admin_full_name || create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}
              Crear empresa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TenantEditDialog tenant={editing} onOpenChange={(v) => !v && setEditing(null)} />
    </div>
  );
}
