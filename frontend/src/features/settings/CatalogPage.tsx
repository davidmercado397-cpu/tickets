import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { catalogApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { Category, Priority, RequestType, Segment, Subcategory } from '@/shared/api/types';
import { useAreas, useCategories, useRequestTypes } from '@/shared/hooks/queries';
import { cn } from '@/shared/lib/cn';
import { PRIORITIES, PRIORITY_LABEL, SEGMENT_LABEL } from '@/shared/lib/labels';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, NativeSelect, Switch } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Pill } from '@/shared/ui/pill';
import { toast } from '@/shared/ui/sonner';
import { LoadingState } from '@/shared/ui/states/LoadingState';

type Editing =
  | { kind: 'type'; item?: RequestType }
  | { kind: 'category'; item?: Category; segment: Segment }
  | { kind: 'sub'; item?: Subcategory; category: Category };

function EditDialog({ editing, onClose }: { editing: Editing | null; onClose: () => void }) {
  const qc = useQueryClient();
  const types = useRequestTypes();
  const areas = useAreas();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [typeId, setTypeId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [active, setActive] = useState(true);
  const [rcaSegments, setRcaSegments] = useState<Segment[]>([]);
  useEffect(() => {
    if (!editing) return;
    const it = editing.item as (Partial<Category> & Partial<RequestType>) | undefined;
    setName(it?.name ?? '');
    setDescription(it?.description ?? '');
    setTypeId(it?.request_type_id ?? '');
    setAreaId(it?.default_area_id ?? '');
    setPriority(it?.default_priority ?? '');
    setActive(it?.active ?? true);
    setRcaSegments((editing.kind === 'type' && editing.item?.rca_segments) || []);
  }, [editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (editing.kind === 'type') {
        const body = { name, description: description || null, rca_segments: rcaSegments };
        return editing.item ? catalogApi.updateType(editing.item.id, { ...body, active }) : catalogApi.createType(body);
      }
      const rules = { default_area_id: areaId || null, default_priority: priority || null };
      if (editing.kind === 'category') {
        const body = { name, description: description || null, request_type_id: typeId || null, ...rules };
        return editing.item ? catalogApi.updateCategory(editing.item.id, { ...body, active }) : catalogApi.createCategory({ ...body, segment: editing.segment });
      }
      return editing.item ? catalogApi.updateSub(editing.item.id, { name, ...rules, active }) : catalogApi.createSub(editing.category.id, { name, ...rules });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
      void qc.invalidateQueries({ queryKey: ['request-types'] });
      toast.success('Guardado');
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const title = editing?.kind === 'type' ? 'Tipo de solicitud' : editing?.kind === 'category' ? `Categoría · ${SEGMENT_LABEL[editing.segment]}` : `Subcategoría de ${editing?.kind === 'sub' ? editing.category.name : ''}`;
  return (
    <Dialog open={!!editing} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {editing?.kind !== 'sub' && (
            <Field label="Descripción" hint={editing?.kind === 'type' ? 'Se muestra en el portal para orientar al ciudadano.' : undefined}>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          )}
          {editing?.kind === 'type' && (
            <Field label="Exige análisis de causa raíz para" hint="Al radicarse, el caso va primero a Calidad y no puede responderse hasta cerrar el análisis.">
              <div className="flex flex-wrap gap-4">
                {(['external', 'internal'] as Segment[]).map((s) => (
                  <Switch
                    key={s}
                    checked={rcaSegments.includes(s)}
                    onChange={(v) => setRcaSegments((cur) => (v ? [...cur, s] : cur.filter((x) => x !== s)))}
                    label={SEGMENT_LABEL[s]}
                  />
                ))}
              </div>
            </Field>
          )}
          {editing?.kind === 'category' && (
            <Field label="Aplica a" hint="Déjalo en 'Todos los tipos' si la categoría sirve para peticiones, quejas y reclamos.">
              <NativeSelect value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                <option value="">Todos los tipos</option>
                {(types.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          {editing?.kind !== 'type' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Área responsable sugerida">
                <NativeSelect value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                  <option value="">{editing?.kind === 'sub' ? 'La de la categoría' : 'Ninguna'}</option>
                  {(areas.data ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Prioridad sugerida" hint="Define el SLA del caso.">
                <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
                  <option value="">{editing?.kind === 'sub' ? 'La de la categoría' : 'Media (por defecto)'}</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          )}
          {editing?.item && <Switch checked={active} onChange={setActive} label="Activo" />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={name.trim().length < 2 || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryList({ segment, onEdit }: { segment: Segment; onEdit: (e: Editing) => void }) {
  const cats = useCategories(segment);
  const types = useRequestTypes();
  const areas = useAreas();
  const [openIds, setOpenIds] = useState<string[]>([]);
  const typeName = (id: string | null) => (id ? types.data?.find((t) => t.id === id)?.name : 'Todos los tipos');
  const areaName = (id: string | null) => areas.data?.find((a) => a.id === id)?.name;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Categorías · {SEGMENT_LABEL[segment]}</CardTitle>
        <Button size="sm" onClick={() => onEdit({ kind: 'category', segment })}>
          <Plus />
          Categoría
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {cats.isLoading && <LoadingState rows={3} />}
        {(cats.data ?? []).map((c) => {
          const isOpen = openIds.includes(c.id);
          return (
            <div key={c.id} className={cn('rounded-md border', !c.active && 'opacity-60')}>
              <div className="flex items-center gap-2 p-2.5">
                <button className="rounded p-1 hover:bg-muted" onClick={() => setOpenIds((o) => (isOpen ? o.filter((x) => x !== c.id) : [...o, c.id]))} aria-label="Ver subcategorías">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {c.name} {!c.active && <Pill className="ml-1">Inactiva</Pill>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {typeName(c.request_type_id)} · {areaName(c.default_area_id) ?? 'Sin área'} · Prioridad {PRIORITY_LABEL[c.default_priority ?? 'medium'].toLowerCase()} · {c.subcategories.length} subcategorías
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit({ kind: 'category', segment, item: c })} aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              {isOpen && (
                <div className="space-y-1 border-t bg-muted/30 p-2 pl-10">
                  {c.subcategories.map((s) => (
                    <div key={s.id} className={cn('flex items-center justify-between gap-2 rounded px-2 py-1 text-sm', !s.active && 'opacity-60')}>
                      <span>
                        {s.name}
                        {(s.default_area_id || s.default_priority) && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {[areaName(s.default_area_id), s.default_priority && PRIORITY_LABEL[s.default_priority]].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit({ kind: 'sub', category: c, item: s })} aria-label="Editar subcategoría">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => onEdit({ kind: 'sub', category: c })}>
                    <Plus />
                    Subcategoría
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function CatalogPage() {
  const types = useRequestTypes();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [segment, setSegment] = useState<Segment>('external');
  return (
    <div className="space-y-4">
      <PageHeader title="Tipos y categorías" description="Clasificación de las PQRS: tipo de solicitud, categoría y subcategoría por tipo de cliente." />
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Tipos de solicitud</CardTitle>
          <Button size="sm" onClick={() => setEditing({ kind: 'type' })}>
            <Plus />
            Tipo
          </Button>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(types.data ?? []).map((t) => (
            <button key={t.id} onClick={() => setEditing({ kind: 'type', item: t })} className={cn('rounded-full border px-3 py-1.5 text-sm hover:bg-muted', !t.active && 'opacity-50 line-through')}>
              {t.name}
              {t.rca_segments.length > 0 && <span className="ml-1.5 text-xs text-warning">· causa raíz</span>}
            </button>
          ))}
        </CardContent>
      </Card>
      <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {(['external', 'internal'] as Segment[]).map((s) => (
          <button key={s} onClick={() => setSegment(s)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', segment === s ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
            {SEGMENT_LABEL[s]}
          </button>
        ))}
      </div>
      <CategoryList segment={segment} onEdit={setEditing} />
      <EditDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
