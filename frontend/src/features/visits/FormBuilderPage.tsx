import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Eye, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { visitsApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { FieldType, FindingRule, FormField, Priority } from '@/shared/api/types';
import { keys } from '@/shared/hooks/queries';
import { cn } from '@/shared/lib/cn';
import { PRIORITIES, PRIORITY_LABEL } from '@/shared/lib/labels';
import { slugify } from '@/shared/lib/slugify';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, NativeSelect, Switch } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { toast } from '@/shared/ui/sonner';
import { LoadingState } from '@/shared/ui/states/LoadingState';
import { Textarea } from '@/shared/ui/textarea';

import { FieldRenderer } from './FieldRenderer';

const TYPES: { v: FieldType; l: string }[] = [
  { v: 'section', l: 'Sección / título' },
  { v: 'yesno', l: 'Sí / No / No aplica' },
  { v: 'rating', l: 'Calificación (estrellas)' },
  { v: 'select', l: 'Selección única' },
  { v: 'multiselect', l: 'Selección múltiple' },
  { v: 'text', l: 'Texto corto' },
  { v: 'textarea', l: 'Texto largo' },
  { v: 'number', l: 'Número' },
  { v: 'date', l: 'Fecha' },
  { v: 'photo', l: 'Foto' },
  { v: 'signature', l: 'Firma' },
];

const OPS: Record<string, { v: FindingRule['op']; l: string }[]> = {
  yesno: [{ v: 'equals', l: 'Si responde' }],
  rating: [
    { v: 'lte', l: 'Si es menor o igual a' },
    { v: 'gte', l: 'Si es mayor o igual a' },
  ],
  number: [
    { v: 'lte', l: 'Si es menor o igual a' },
    { v: 'gte', l: 'Si es mayor o igual a' },
  ],
  select: [{ v: 'in', l: 'Si elige alguna de' }],
  multiselect: [{ v: 'in', l: 'Si marca alguna de' }],
};

function uniqueId(label: string, fields: FormField[], self?: number): string {
  const base = slugify(label).replace(/-/g, '_').slice(0, 34) || 'campo';
  let id = base;
  let n = 1;
  while (fields.some((f, i) => f.id === id && i !== self)) id = `${base}_${++n}`;
  return id;
}

function defaultFinding(f: FormField): FindingRule {
  if (f.type === 'yesno') return { op: 'equals', value: 'no', task_title: '', priority: 'medium' };
  if (f.type === 'rating') return { op: 'lte', value: 2, task_title: '', priority: 'medium' };
  if (f.type === 'number') return { op: 'lte', value: 0, task_title: '', priority: 'medium' };
  return { op: 'in', value: [], task_title: '', priority: 'medium' };
}

function FieldEditor({
  field,
  index,
  total,
  onChange,
  onMove,
  onRemove,
  onDuplicate,
}: {
  field: FormField;
  index: number;
  total: number;
  onChange: (f: FormField) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const supportsFinding = ['yesno', 'rating', 'number', 'select', 'multiselect'].includes(field.type);
  const set = (patch: Partial<FormField>) => onChange({ ...field, ...patch });
  const finding = field.finding;
  return (
    <div className={cn('space-y-3 rounded-lg border bg-card p-3', field.type === 'section' && 'border-primary/40 bg-primary/5')}>
      <div className="flex items-center gap-2">
        <span className="w-6 text-center text-xs font-semibold text-muted-foreground">{index + 1}</span>
        <NativeSelect
          className="h-9 w-48"
          value={field.type}
          onChange={(e) => {
            const type = e.target.value as FieldType;
            onChange({ ...field, type, finding: null, options: ['select', 'multiselect'].includes(type) ? field.options?.length ? field.options : ['Opción 1', 'Opción 2'] : [], min: type === 'rating' ? 1 : null, max: type === 'rating' ? 5 : null });
          }}
        >
          {TYPES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.l}
            </option>
          ))}
        </NativeSelect>
        <div className="ml-auto flex">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Subir">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Bajar">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate} aria-label="Duplicar">
            <Copy className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove} aria-label="Eliminar">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Input value={field.label} onChange={(e) => set({ label: e.target.value })} placeholder={field.type === 'section' ? 'Título de la sección' : 'Pregunta'} />
      {field.type !== 'section' && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <Switch checked={!!field.required} onChange={(v) => set({ required: v })} label="Obligatoria" />
            {['yesno', 'rating'].includes(field.type) && (
              <Switch checked={field.scored !== false} onChange={(v) => set({ scored: v })} label="Cuenta para el puntaje" />
            )}
          </div>
          <Input value={field.help ?? ''} onChange={(e) => set({ help: e.target.value || null })} placeholder="Ayuda (opcional)" />
          {['select', 'multiselect'].includes(field.type) && (
            <Field label="Opciones (una por línea)">
              <Textarea
                rows={3}
                value={(field.options ?? []).join('\n')}
                onChange={(e) => set({ options: e.target.value.split('\n').map((o) => o.trimStart()).filter((o, i, a) => o !== '' || i === a.length - 1) })}
              />
            </Field>
          )}
          {['rating', 'number'].includes(field.type) && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Mínimo">
                <Input type="number" value={field.min ?? ''} onChange={(e) => set({ min: e.target.value === '' ? null : Number(e.target.value) })} />
              </Field>
              <Field label="Máximo">
                <Input type="number" value={field.max ?? ''} onChange={(e) => set({ max: e.target.value === '' ? null : Number(e.target.value) })} />
              </Field>
            </div>
          )}
          {supportsFinding && (
            <div className="space-y-2 rounded-md border border-dashed p-2">
              <Switch checked={!!finding} onChange={(v) => set({ finding: v ? defaultFinding(field) : null })} label="Generar hallazgo y sugerir tarea" />
              {finding && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <NativeSelect value={finding.op} onChange={(e) => set({ finding: { ...finding, op: e.target.value as FindingRule['op'] } })}>
                    {(OPS[field.type] ?? []).map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </NativeSelect>
                  {field.type === 'yesno' ? (
                    <NativeSelect value={String(finding.value)} onChange={(e) => set({ finding: { ...finding, value: e.target.value } })}>
                      <option value="no">No</option>
                      <option value="yes">Sí</option>
                    </NativeSelect>
                  ) : ['select', 'multiselect'].includes(field.type) ? (
                    <div className="flex flex-wrap gap-1">
                      {(field.options ?? []).filter(Boolean).map((o) => {
                        const vals = Array.isArray(finding.value) ? (finding.value as string[]) : [];
                        const on = vals.includes(o);
                        return (
                          <button
                            type="button"
                            key={o}
                            onClick={() => set({ finding: { ...finding, value: on ? vals.filter((x) => x !== o) : [...vals, o] } })}
                            className={cn('rounded-full border px-2 py-0.5 text-xs', on ? 'border-destructive bg-destructive/10 text-destructive' : 'text-muted-foreground')}
                          >
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <Input type="number" value={String(finding.value ?? '')} onChange={(e) => set({ finding: { ...finding, value: Number(e.target.value) } })} />
                  )}
                  <Input
                    className="sm:col-span-2"
                    value={finding.task_title ?? ''}
                    onChange={(e) => set({ finding: { ...finding, task_title: e.target.value } })}
                    placeholder="Tarea sugerida (ej. Reponer uniforme)"
                  />
                  <NativeSelect value={finding.priority ?? 'medium'} onChange={(e) => set({ finding: { ...finding, priority: e.target.value as Priority } })}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        Prioridad {PRIORITY_LABEL[p].toLowerCase()}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function FormBuilderPage() {
  const { id } = useParams();
  const isNew = !id || id === 'nuevo';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...keys.visits, 'form', id], queryFn: () => visitsApi.form(id!), enabled: !isNew });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [fields, setFields] = useState<FormField[]>([]);
  const [preview, setPreview] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (q.data) {
      setName(q.data.name);
      setDescription(q.data.description ?? '');
      setActive(q.data.active);
      setFields(q.data.fields);
    } else if (isNew) {
      setFields([{ id: 'seccion_1', type: 'section', label: 'Sección 1' }]);
    }
  }, [q.data, isNew]);

  const add = (type: FieldType) => {
    const label = type === 'section' ? 'Nueva sección' : 'Nueva pregunta';
    setFields((fs) => [
      ...fs,
      { id: uniqueId(label, fs), type, label, required: false, options: ['select', 'multiselect'].includes(type) ? ['Opción 1', 'Opción 2'] : [], min: type === 'rating' ? 1 : null, max: type === 'rating' ? 5 : null, finding: null },
    ]);
  };

  const save = useMutation({
    mutationFn: () => {
      // Los id se derivan de la etiqueta en campos nuevos; se conservan en los existentes (respuestas previas).
      const existing = new Set((q.data?.fields ?? []).map((f) => f.id));
      const clean = fields.map((f, i, all) => ({
        ...f,
        id: existing.has(f.id) ? f.id : uniqueId(f.label, all, i),
        options: (f.options ?? []).map((o) => o.trim()).filter(Boolean),
        finding: f.finding ? { ...f.finding, task_title: f.finding.task_title || null } : null,
      }));
      const body = { name, description: description || null, active, fields: clean };
      return isNew ? visitsApi.createForm(body) : visitsApi.updateForm(id!, body);
    },
    onSuccess: (f) => {
      void qc.invalidateQueries({ queryKey: keys.visits });
      toast.success(`Formulario guardado (versión ${f.version})`);
      if (isNew) navigate(`/visitas/formularios/${f.id}`, { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!isNew && q.isLoading) return <LoadingState />;
  const questions = fields.filter((f) => f.type !== 'section').length;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to="/visitas/formularios">
          <ArrowLeft />
          Formularios
        </Link>
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">{isNew ? 'Nuevo formulario' : name}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreview((p) => !p)}>
            <Eye />
            {preview ? 'Editar' : 'Vista previa'}
          </Button>
          <Button onClick={() => save.mutate()} disabled={name.trim().length < 3 || questions === 0 || save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar
          </Button>
        </div>
      </div>
      {!isNew && <p className="text-xs text-muted-foreground">Si cambias las preguntas se crea una nueva versión; las visitas ya realizadas conservan la versión con que se hicieron.</p>}

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{name || 'Formulario'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {fields.map((f) => (
              <FieldRenderer key={f.id} field={f} value={answers[f.id]} onChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))} />
            ))}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <Field label="Nombre" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Visita de supervisión a puesto" />
              </Field>
              <div className="flex items-end pb-2">
                <Switch checked={active} onChange={setActive} label="Disponible para nuevas visitas" />
              </div>
              <Field label="Descripción" className="sm:col-span-2">
                <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </CardContent>
          </Card>
          <div className="space-y-3">
            {fields.map((f, i) => (
              <FieldEditor
                key={`${f.id}-${i}`}
                field={f}
                index={i}
                total={fields.length}
                onChange={(nf) => setFields((fs) => fs.map((x, j) => (j === i ? nf : x)))}
                onMove={(dir) =>
                  setFields((fs) => {
                    const next = [...fs];
                    const a = next[i];
                    const b = next[i + dir];
                    if (!a || !b) return fs;
                    next[i] = b;
                    next[i + dir] = a;
                    return next;
                  })
                }
                onRemove={() => setFields((fs) => fs.filter((_, j) => j !== i))}
                onDuplicate={() =>
                  setFields((fs) => {
                    const copy = { ...f, id: uniqueId(f.label, fs), label: `${f.label} (copia)` };
                    return [...fs.slice(0, i + 1), copy, ...fs.slice(i + 1)];
                  })
                }
              />
            ))}
          </div>
          <Card>
            <CardContent className="pt-6">
              <p className="mb-2 text-sm font-medium">Agregar campo</p>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <Button key={t.v} type="button" variant="outline" size="sm" onClick={() => add(t.v)}>
                    <Plus />
                    {t.l}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
