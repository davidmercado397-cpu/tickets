import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Loader2, Plus, Search, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { employeesApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { Employee } from '@/shared/api/types';
import { useSites } from '@/shared/hooks/queries';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { formatDate } from '@/shared/lib/date';
import { useCan } from '@/shared/session/session.store';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, NativeSelect } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Pagination } from '@/shared/ui/pagination';
import { Pill } from '@/shared/ui/pill';
import { ResponsiveList } from '@/shared/ui/responsive-list';
import { toast } from '@/shared/ui/sonner';
import { EmptyState } from '@/shared/ui/states/EmptyState';

function EmployeeDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (v: boolean) => void; employee?: Employee }) {
  const qc = useQueryClient();
  const sites = useSites(undefined, open);
  const [f, setF] = useState<Partial<Employee>>({});
  useEffect(() => {
    if (open) setF(employee ? { ...employee } : { document_type: 'CC', status: 'active' });
  }, [open, employee]);
  const set = (k: keyof Employee, v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body = {
        full_name: f.full_name, email: f.email || null, phone: f.phone || null, position: f.position || null,
        site_id: f.site_id || null, hire_date: f.hire_date || null, contract_type: f.contract_type || null, status: f.status,
      };
      return employee ? employeesApi.update(employee.id, body) : employeesApi.create({ ...body, document: f.document, document_type: f.document_type });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Empleado guardado');
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de documento">
            <NativeSelect value={f.document_type ?? 'CC'} onChange={(e) => set('document_type', e.target.value)} disabled={!!employee}>
              {['CC', 'CE', 'PPT', 'PA', 'TI'].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Documento" required>
            <Input value={f.document ?? ''} onChange={(e) => set('document', e.target.value)} disabled={!!employee} />
          </Field>
          <Field label="Nombre completo" required className="sm:col-span-2">
            <Input value={f.full_name ?? ''} onChange={(e) => set('full_name', e.target.value)} />
          </Field>
          <Field label="Cargo">
            <Input value={f.position ?? ''} onChange={(e) => set('position', e.target.value)} />
          </Field>
          <Field label="Puesto asignado">
            <NativeSelect value={f.site_id ?? ''} onChange={(e) => set('site_id', e.target.value)}>
              <option value="">—</option>
              {(sites.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Correo">
            <Input type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Celular">
            <Input value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Fecha de ingreso">
            <Input type="date" value={f.hire_date ?? ''} onChange={(e) => set('hire_date', e.target.value)} />
          </Field>
          <Field label="Tipo de contrato">
            <Input value={f.contract_type ?? ''} onChange={(e) => set('contract_type', e.target.value)} />
          </Field>
          <Field label="Estado">
            <NativeSelect value={f.status ?? 'active'} onChange={(e) => set('status', e.target.value)}>
              <option value="active">Activo</option>
              <option value="retired">Retirado</option>
            </NativeSelect>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!f.document || !f.full_name || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeesPage() {
  const can = useCan();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebouncedValue(q, 300);
  const list = useQuery({ queryKey: ['employees', dq, page], queryFn: () => employeesApi.list(dq || undefined, page) });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);
  const importCsv = useMutation({
    mutationFn: employeesApi.importCsv,
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(`Importación: ${r.created} creados, ${r.updated} actualizados`, {
        description: r.errors.length ? r.errors.slice(0, 3).join(' · ') : undefined,
      });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const manage = can('employees.manage');

  const columns: ColumnDef<Employee, unknown>[] = [
    {
      header: 'Empleado',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.document_type} {row.original.document}
          </p>
        </div>
      ),
    },
    { header: 'Cargo', cell: ({ row }) => row.original.position ?? '—' },
    { header: 'Ingreso', cell: ({ row }) => formatDate(row.original.hire_date) },
    { header: 'Correo', cell: ({ row }) => <span className="text-sm">{row.original.email ?? '—'}</span> },
    { header: 'Estado', cell: ({ row }) => (row.original.status === 'active' ? <Pill tone="bg-success/15 text-success border-success/30">Activo</Pill> : <Pill>Retirado</Pill>) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Empleados"
        description="Colaboradores de la empresa (cliente interno de las PQRS)."
        actions={manage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => employeesApi.template()}>
              <Download />
              Plantilla CSV
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importCsv.isPending}>
              {importCsv.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
              Importar
            </Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importCsv.mutate(f); }} />
            <Button onClick={() => { setEditing(undefined); setOpen(true); }}>
              <Plus />
              Nuevo
            </Button>
          </div>
        )}
      />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar por nombre o documento" className="pl-9" />
      </div>
      <ResponsiveList
        data={list.data?.items ?? []}
        columns={columns}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        onRowClick={manage ? (e) => { setEditing(e); setOpen(true); } : undefined}
        empty={<EmptyState title="Sin empleados" description="Créalos uno a uno o importa un CSV." />}
        renderCard={(e) => (
          <div>
            <p className="font-medium">{e.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {e.document_type} {e.document} · {e.position ?? 'Sin cargo'} · {e.status === 'active' ? 'Activo' : 'Retirado'}
            </p>
          </div>
        )}
      />
      {list.data && <Pagination page={page} pageSize={25} total={list.data.total} onPage={setPage} />}
      <EmployeeDialog open={open} onOpenChange={setOpen} employee={editing} />
    </div>
  );
}
