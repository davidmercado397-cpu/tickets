import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Inbox, Loader2, MapPin, Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { clientsApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { Site } from '@/shared/api/types';
import { keys } from '@/shared/hooks/queries';
import { formatDate } from '@/shared/lib/date';
import { useCan } from '@/shared/session/session.store';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, Switch } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Pill } from '@/shared/ui/pill';
import { toast } from '@/shared/ui/sonner';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { LoadingState } from '@/shared/ui/states/LoadingState';

import { ClientDialog } from './ClientsPage';

function SiteDialog({ clientId, site, open, onOpenChange }: { clientId: string; site?: Site; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<Partial<Site>>({});
  useEffect(() => {
    if (open) setF(site ? { ...site } : { name: '', active: true });
  }, [open, site]);
  const set = (k: keyof Site, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name, address: f.address || null, city: f.city || null, contact_name: f.contact_name || null,
        contact_phone: f.contact_phone || null, latitude: f.latitude ?? null, longitude: f.longitude ?? null,
      };
      return site ? clientsApi.updateSite(site.id, { ...body, active: f.active }) : clientsApi.createSite(clientId, { ...body, code: f.code || null });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.client(clientId) });
      void qc.invalidateQueries({ queryKey: ['clients'] });
      void qc.invalidateQueries({ queryKey: ['sites'] });
      toast.success('Sede guardada');
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{site ? 'Editar sede' : 'Nueva sede / puesto'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" required className="sm:col-span-2">
            <Input value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Portería principal" />
          </Field>
          {!site && (
            <Field label="Código (opcional)" hint="Se genera del nombre si lo dejas vacío.">
              <Input value={f.code ?? ''} onChange={(e) => set('code', e.target.value)} />
            </Field>
          )}
          <Field label="Ciudad">
            <Input value={f.city ?? ''} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="Dirección" className="sm:col-span-2">
            <Input value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label="Contacto en sitio">
            <Input value={f.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <Input value={f.contact_phone ?? ''} onChange={(e) => set('contact_phone', e.target.value)} />
          </Field>
          <Field label="Latitud">
            <Input type="number" step="any" value={f.latitude ?? ''} onChange={(e) => set('latitude', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
          <Field label="Longitud">
            <Input type="number" step="any" value={f.longitude ?? ''} onChange={(e) => set('longitude', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
          {site && <Switch checked={!!f.active} onChange={(v) => set('active', v)} label="Activa" />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!f.name || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClientDetailPage() {
  const { id = '' } = useParams();
  const can = useCan();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: keys.client(id), queryFn: () => clientsApi.get(id) });
  const [edit, setEdit] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const [site, setSite] = useState<Site | undefined>();
  const toggle = useMutation({
    mutationFn: (active: boolean) => clientsApi.update(id, { active }),
    onSuccess: (c) => qc.setQueryData(keys.client(id), c),
  });
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const c = q.data;
  const manage = can('clients.manage');

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to="/clientes">
          <ArrowLeft />
          Clientes
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">NIT {c.nit}</p>
          <h1 className="text-xl font-semibold sm:text-2xl">{c.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/pqrs?tab=all&client_id=${c.id}`}>
              <Inbox />
              Ver PQRS
            </Link>
          </Button>
          {manage && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
                <Pencil />
                Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => toggle.mutate(!c.active)}>
                {c.active ? 'Desactivar' : 'Activar'}
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="self-start">
          <CardContent className="space-y-3 pt-6 text-sm">
            {[
              ['Contacto', c.contact_name],
              ['Correo', c.contact_email],
              ['Teléfono', c.contact_phone],
              ['Dirección', [c.address, c.city].filter(Boolean).join(', ')],
              ['Contrato', c.contract_start ? `${formatDate(c.contract_start)} – ${c.contract_end ? formatDate(c.contract_end) : 'vigente'}` : null],
              ['Notas', c.notes],
            ].map(([k, v]) => (
              <div key={k as string}>
                <p className="text-muted-foreground">{k}</p>
                <p className="font-medium">{v || '—'}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Sedes / puestos ({c.sites.length})</CardTitle>
            {manage && (
              <Button size="sm" onClick={() => { setSite(undefined); setSiteOpen(true); }}>
                <Plus />
                Sede
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {c.sites.length === 0 && <p className="text-sm text-muted-foreground">Sin sedes registradas.</p>}
            {c.sites.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {s.name} {!s.active && <Pill className="ml-1">Inactiva</Pill>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.code} · {[s.address, s.city].filter(Boolean).join(', ') || 'Sin dirección'}
                    {s.contact_name ? ` · ${s.contact_name}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {s.latitude !== null && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`} target="_blank" rel="noreferrer" aria-label="Ver mapa">
                        <MapPin className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {manage && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSite(s); setSiteOpen(true); }} aria-label="Editar sede">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <ClientDialog open={edit} onOpenChange={setEdit} client={c} onSaved={(nc) => qc.setQueryData(keys.client(id), nc)} />
      <SiteDialog clientId={c.id} site={site} open={siteOpen} onOpenChange={setSiteOpen} />
    </div>
  );
}
