import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { pqrsApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { PqrsDetail, Priority } from '@/shared/api/types';
import { useAreas, useCategories, useClients, useRequestTypes } from '@/shared/hooks/queries';
import { PRIORITIES, PRIORITY_LABEL } from '@/shared/lib/labels';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, NativeSelect } from '@/shared/ui/field';
import { toast } from '@/shared/ui/sonner';
import { Textarea } from '@/shared/ui/textarea';

export function ClassifyDialog({
  pqrs,
  open,
  onOpenChange,
  onSaved,
}: {
  pqrs: PqrsDetail;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (p: PqrsDetail) => void;
}) {
  const types = useRequestTypes();
  const cats = useCategories(pqrs.segment);
  const areas = useAreas();
  const clients = useClients(undefined, open && pqrs.segment === 'external');
  const [typeId, setTypeId] = useState('');
  const [catId, setCatId] = useState('');
  const [subId, setSubId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setTypeId(pqrs.request_type?.id ?? '');
    setCatId(pqrs.category?.id ?? '');
    setSubId(pqrs.subcategory?.id ?? '');
    setAreaId(pqrs.area?.id ?? '');
    setPriority(pqrs.priority);
    setClientId(pqrs.client?.id ?? '');
    setSiteId(pqrs.site?.id ?? '');
    setNote('');
  }, [open, pqrs]);

  const categories = (cats.data ?? []).filter((c) => c.active && (!c.request_type_id || c.request_type_id === typeId));
  const category = categories.find((c) => c.id === catId);
  const sites = clients.data?.find((c) => c.id === clientId)?.sites ?? [];

  const onCategory = (id: string) => {
    setCatId(id);
    setSubId('');
    const c = categories.find((x) => x.id === id);
    if (c?.default_area_id) setAreaId(c.default_area_id);
    if (c?.default_priority) setPriority(c.default_priority);
  };

  const save = useMutation({
    mutationFn: () =>
      pqrsApi.classify(pqrs.id, {
        request_type_id: typeId,
        category_id: catId || null,
        subcategory_id: subId || null,
        area_id: areaId || null,
        priority,
        ...(pqrs.segment === 'external' ? { client_id: clientId || null, site_id: siteId || null } : {}),
        note: note || null,
      }),
    onSuccess: (p) => {
      toast.success('Clasificación guardada');
      onSaved(p);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Clasificar PQRS</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de solicitud">
            <NativeSelect value={typeId} onChange={(e) => { setTypeId(e.target.value); setCatId(''); setSubId(''); }}>
              {(types.data ?? []).filter((t) => t.active).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Prioridad" hint="Cambiarla recalcula el vencimiento (SLA).">
            <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Categoría">
            <NativeSelect value={catId} onChange={(e) => onCategory(e.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Subcategoría">
            <NativeSelect value={subId} onChange={(e) => setSubId(e.target.value)} disabled={!category}>
              <option value="">—</option>
              {(category?.subcategories ?? []).filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Área responsable" className="sm:col-span-2">
            <NativeSelect value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Sin área</option>
              {(areas.data ?? []).filter((a) => a.active).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {pqrs.segment === 'external' && (
            <>
              <Field label="Cliente corporativo">
                <NativeSelect value={clientId} onChange={(e) => { setClientId(e.target.value); setSiteId(''); }}>
                  <option value="">—</option>
                  {(clients.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Sede / puesto">
                <NativeSelect value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!clientId}>
                  <option value="">—</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </>
          )}
          <Field label="Nota (opcional)" className="sm:col-span-2">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!typeId || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
