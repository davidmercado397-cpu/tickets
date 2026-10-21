import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { FileSpreadsheet, Loader2, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { clientsApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { Client } from '@/shared/api/types';
import { useClients } from '@/shared/hooks/queries';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useCan } from '@/shared/session/session.store';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Pill } from '@/shared/ui/pill';
import { ResponsiveList } from '@/shared/ui/responsive-list';
import { toast } from '@/shared/ui/sonner';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { Textarea } from '@/shared/ui/textarea';

import { ImportClientsDialog } from './ImportClientsDialog';

type ClientForm = Partial<Omit<Client, 'sites' | 'id'>>;

export function ClientDialog({ open, onOpenChange, client, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; client?: Client; onSaved?: (c: Client) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<ClientForm>({});
  useEffect(() => {
    if (open) setF(client ? { ...client } : { nit: '', name: '' });
  }, [open, client]);
  const set = (k: keyof ClientForm, v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' ? null : v]));
      delete body.active;
      return client ? clientsApi.update(client.id, body) : clientsApi.create(body);
    },
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      void qc.invalidateQueries({ queryKey: ['sites'] });
      toast.success('Cliente guardado');
      onSaved?.(c);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar cliente' : 'Nuevo cliente corporativo'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="NIT" required>
            <Input value={f.nit ?? ''} onChange={(e) => set('nit', e.target.value)} />
          </Field>
          <Field label="Razón social / nombre" required>
            <Input value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Contacto">
            <Input value={f.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value)} />
          </Field>
          <Field label="Correo del contacto">
            <Input type="email" value={f.contact_email ?? ''} onChange={(e) => set('contact_email', e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <Input value={f.contact_phone ?? ''} onChange={(e) => set('contact_phone', e.target.value)} />
          </Field>
          <Field label="Ciudad">
            <Input value={f.city ?? ''} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="Dirección" className="sm:col-span-2">
            <Input value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label="Inicio de contrato">
            <Input type="date" value={f.contract_start ?? ''} onChange={(e) => set('contract_start', e.target.value)} />
          </Field>
          <Field label="Fin de contrato">
            <Input type="date" value={f.contract_end ?? ''} onChange={(e) => set('contract_end', e.target.value)} />
          </Field>
          <Field label="Notas" className="sm:col-span-2">
            <Textarea rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!f.nit || !f.name || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClientsPage() {
  const navigate = useNavigate();
  const can = useCan();
  const [q, setQ] = useState('');
  const dq = useDebouncedValue(q, 300);
  const list = useClients(dq || undefined);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const columns: ColumnDef<Client, unknown>[] = [
    {
      header: 'Cliente',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">NIT {row.original.nit}</p>
        </div>
      ),
    },
    { header: 'Ciudad', cell: ({ row }) => row.original.city ?? '—' },
    { header: 'Contacto', cell: ({ row }) => <span className="text-sm">{row.original.contact_name ?? '—'}</span> },
    { header: 'Sedes', cell: ({ row }) => row.original.sites.filter((s) => s.active).length },
    { header: 'Estado', cell: ({ row }) => (row.original.active ? <Pill tone="bg-success/15 text-success border-success/30">Activo</Pill> : <Pill>Inactivo</Pill>) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clientes y sedes"
        description="Clientes corporativos y sus puestos de servicio."
        actions={can('clients.manage') && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet />
              Importar Excel
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus />
              Nuevo cliente
            </Button>
          </div>
        )}
      />
      <ImportClientsDialog open={importOpen} onOpenChange={setImportOpen} />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o NIT" className="pl-9" />
      </div>
      <ResponsiveList
        data={list.data ?? []}
        columns={columns}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        onRowClick={(c) => navigate(`/clientes/${c.id}`)}
        empty={<EmptyState title="Sin clientes" description="Registra tus clientes corporativos y sus sedes." />}
        renderCard={(c) => (
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                NIT {c.nit} · {c.sites.length} sede(s) {c.city ? `· ${c.city}` : ''}
              </p>
            </div>
            {!c.active && <Pill>Inactivo</Pill>}
          </div>
        )}
      />
      <ClientDialog open={open} onOpenChange={setOpen} onSaved={(c) => navigate(`/clientes/${c.id}`)} />
    </div>
  );
}
