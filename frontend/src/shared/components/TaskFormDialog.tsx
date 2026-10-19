import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { tasksApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { Priority, Task } from '@/shared/api/types';
import { keys, useClients, useUserLookup } from '@/shared/hooks/queries';
import { PRIORITIES, PRIORITY_LABEL } from '@/shared/lib/labels';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, NativeSelect } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { toast } from '@/shared/ui/sonner';
import { Textarea } from '@/shared/ui/textarea';

export interface TaskDefaults {
  title?: string;
  description?: string;
  client_id?: string | null;
  site_id?: string | null;
  source_type?: string;
  source_id?: string;
  source_label?: string;
  priority?: Priority;
}

/** Crear o editar una tarea (se usa desde Tareas, PQRS y Visitas). */
export function TaskFormDialog({
  open,
  onOpenChange,
  defaults,
  task,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaults?: TaskDefaults;
  task?: Task;
  onSaved?: (t: Task) => void;
}) {
  const qc = useQueryClient();
  const users = useUserLookup('tasks.manage', null, open);
  const performers = useUserLookup('visits.perform', null, open);
  const clients = useClients(undefined, open && !task);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? defaults?.title ?? '');
    setDescription(task?.description ?? defaults?.description ?? '');
    setAssignee(task?.assignee?.id ?? '');
    setDue(task?.due_date ?? '');
    setPriority(task?.priority ?? defaults?.priority ?? 'medium');
    setClientId(defaults?.client_id ?? '');
    setSiteId(defaults?.site_id ?? '');
  }, [open, task, defaults]);

  const people = [...(users.data ?? []), ...(performers.data ?? [])].filter(
    (u, i, arr) => arr.findIndex((x) => x.id === u.id) === i,
  );
  const sites = clients.data?.find((c) => c.id === clientId)?.sites ?? [];

  const save = useMutation({
    mutationFn: () => {
      const base = { title, description: description || null, assignee_id: assignee || null, due_date: due || null, priority };
      if (task) return tasksApi.update(task.id, base);
      return tasksApi.create({
        ...base,
        client_id: clientId || null,
        site_id: siteId || null,
        source_type: defaults?.source_type ?? 'manual',
        source_id: defaults?.source_id ?? null,
        source_label: defaults?.source_label ?? null,
      });
    },
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: keys.tasks });
      toast.success(task ? 'Tarea actualizada' : 'Tarea creada');
      onSaved?.(t);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {defaults?.source_label && <p className="rounded-md bg-muted px-3 py-2 text-xs">Origen: {defaults.source_label}</p>}
          <Field label="Título" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={250} />
          </Field>
          <Field label="Descripción">
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Responsable">
              <NativeSelect value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Sin asignar</option>
                {people.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Fecha límite">
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field label="Prioridad">
              <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          {!task && !defaults?.client_id && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cliente (opcional)">
                <NativeSelect value={clientId} onChange={(e) => { setClientId(e.target.value); setSiteId(''); }}>
                  <option value="">—</option>
                  {(clients.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Sede">
                <NativeSelect value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!clientId}>
                  <option value="">—</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={title.trim().length < 3 || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
