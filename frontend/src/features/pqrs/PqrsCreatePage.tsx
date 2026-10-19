import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { employeesApi, pqrsApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { Channel, DocType, Priority, Segment } from '@/shared/api/types';
import { useAreas, useCategories, useClients, useRequestTypes, useUserLookup } from '@/shared/hooks/queries';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { cn } from '@/shared/lib/cn';
import { PRIORITIES, PRIORITY_LABEL, SEGMENT_LABEL } from '@/shared/lib/labels';
import { useCan } from '@/shared/session/session.store';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, NativeSelect, Switch } from '@/shared/ui/field';
import { FileInput } from '@/shared/ui/file-input';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { toast } from '@/shared/ui/sonner';
import { Textarea } from '@/shared/ui/textarea';

const CHANNELS: { v: Channel; l: string }[] = [
  { v: 'manual', l: 'Presencial / ventanilla' },
  { v: 'email', l: 'Correo electrónico' },
  { v: 'whatsapp', l: 'WhatsApp' },
  { v: 'web', l: 'Teléfono / otro' },
];

export function PqrsCreatePage() {
  const navigate = useNavigate();
  const can = useCan();
  const [segment, setSegment] = useState<Segment>('external');
  const [channel, setChannel] = useState<Channel>('manual');
  const [typeId, setTypeId] = useState('');
  const [catId, setCatId] = useState('');
  const [subId, setSubId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [employeeQ, setEmployeeQ] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [req, setReq] = useState({ name: '', doc_type: 'CC' as DocType, document: '', email: '', phone: '', company: '', address: '' });
  const [assignee, setAssignee] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const types = useRequestTypes();
  const cats = useCategories(segment);
  const areas = useAreas();
  const clients = useClients(undefined, segment === 'external');
  const debouncedEmp = useDebouncedValue(employeeQ, 300);
  const employees = useQuery({
    queryKey: ['employees', 'search', debouncedEmp],
    queryFn: () => employeesApi.list(debouncedEmp, 1, 10),
    enabled: segment === 'internal' && debouncedEmp.length >= 3 && can(['employees.view', 'employees.manage']),
  });
  const users = useUserLookup('pqrs.manage', areaId || null, can('pqrs.assign'));

  const categories = useMemo(
    () => (cats.data ?? []).filter((c) => c.active && (!c.request_type_id || c.request_type_id === typeId)),
    [cats.data, typeId],
  );
  const category = categories.find((c) => c.id === catId);
  const sites = clients.data?.find((c) => c.id === clientId)?.sites.filter((s) => s.active) ?? [];
  // Sin tipo preseleccionado: elegirlo es una decisión explícita (la queja externa exige causa raíz).
  const selectedType = types.data?.find((t) => t.id === typeId);
  const requiresRca = !!selectedType?.rca_segments.includes(segment);

  const save = useMutation({
    mutationFn: () =>
      pqrsApi.create(
        {
          segment,
          channel,
          request_type_id: typeId,
          category_id: catId || null,
          subcategory_id: subId || null,
          area_id: areaId || null,
          priority: priority || null,
          subject,
          description,
          is_anonymous: anonymous,
          client_id: segment === 'external' ? clientId || null : null,
          site_id: segment === 'external' ? siteId || null : null,
          employee_id: segment === 'internal' ? employeeId || null : null,
          assignee_id: assignee || null,
          consent: true,
          requester: {
            name: req.name || null,
            doc_type: req.document ? req.doc_type : null,
            document: req.document || null,
            email: req.email || null,
            phone: req.phone || null,
            company: req.company || null,
            address: req.address || null,
          },
        },
        files,
      ),
    onSuccess: (p) => {
      toast.success(`PQRS radicada: ${p.radicado}`);
      navigate(`/pqrs/${p.id}`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const onCategory = (id: string) => {
    setCatId(id);
    setSubId('');
    const c = categories.find((x) => x.id === id);
    if (c?.default_area_id) setAreaId(c.default_area_id);
    if (c?.default_priority) setPriority(c.default_priority);
  };

  const valid = typeId && subject.trim().length >= 3 && description.trim().length >= 5;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to="/pqrs">
          <ArrowLeft />
          Bandeja
        </Link>
      </Button>
      <PageHeader title="Radicar PQRS" description="Registro de solicitudes recibidas en ventanilla, por teléfono, correo o WhatsApp." />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clasificación</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de cliente" className="sm:col-span-2">
            <div className="grid grid-cols-2 gap-2">
              {(['external', 'internal'] as Segment[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSegment(s); setCatId(''); setSubId(''); }}
                  className={cn('rounded-md border px-3 py-2 text-sm font-medium', segment === s ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}
                >
                  {SEGMENT_LABEL[s]}
                </button>
              ))}
            </div>
          </Field>
          <Field
            label="Tipo de solicitud"
            required
            hint={requiresRca ? 'Exige análisis de causa raíz: el caso se enviará primero a Calidad.' : undefined}
          >
            <NativeSelect
              value={typeId}
              onChange={(e) => { setTypeId(e.target.value); setCatId(''); }}
              className={cn(!typeId && 'text-muted-foreground', requiresRca && 'border-warning')}
            >
              <option value="">Selecciona el tipo…</option>
              {(types.data ?? []).filter((t) => t.active).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Canal de recepción">
            <NativeSelect value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {CHANNELS.map((c) => (
                <option key={c.v} value={c.v}>
                  {c.l}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Categoría">
            <NativeSelect value={catId} onChange={(e) => onCategory(e.target.value)}>
              <option value="">Sin clasificar</option>
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
          <Field label="Área responsable">
            <NativeSelect value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Según la categoría</option>
              {(areas.data ?? []).filter((a) => a.active).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Prioridad">
            <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
              <option value="">Según la categoría</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {can('pqrs.assign') && (
            <Field label="Asignar a (opcional)" className="sm:col-span-2">
              <NativeSelect value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Sin asignar</option>
                {(users.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solicitante</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {segment === 'external' ? (
            <>
              <Field label="Cliente corporativo">
                <NativeSelect value={clientId} onChange={(e) => { setClientId(e.target.value); setSiteId(''); }}>
                  <option value="">Particular / no registrado</option>
                  {(clients.data ?? []).filter((c) => c.active).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.nit}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Sede / puesto">
                <NativeSelect value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!clientId}>
                  <option value="">General</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {!clientId && (
                <Field label="Empresa (texto)" className="sm:col-span-2">
                  <Input value={req.company} onChange={(e) => setReq({ ...req, company: e.target.value })} />
                </Field>
              )}
              <div className="sm:col-span-2">
                <Switch checked={anonymous} onChange={setAnonymous} label="Solicitud anónima" />
              </div>
            </>
          ) : (
            <Field label="Buscar empleado" className="sm:col-span-2" hint="Por nombre o cédula (mínimo 3 caracteres). También puedes escribir solo el documento abajo.">
              <Input value={employeeQ} onChange={(e) => setEmployeeQ(e.target.value)} placeholder="Nombre o documento" />
              {(employees.data?.items.length ?? 0) > 0 && (
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
                  {employees.data!.items.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => {
                        setEmployeeId(emp.id);
                        setReq({ ...req, name: emp.full_name, document: emp.document, email: emp.email ?? '', phone: emp.phone ?? '' });
                      }}
                      className={cn('block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted', employeeId === emp.id && 'bg-primary/10')}
                    >
                      {emp.full_name} · {emp.document} {emp.position ? `· ${emp.position}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </Field>
          )}
          {!anonymous && (
            <>
              <Field label="Nombre">
                <Input value={req.name} onChange={(e) => setReq({ ...req, name: e.target.value })} />
              </Field>
              <Field label="Documento">
                <div className="flex gap-2">
                  <NativeSelect className="w-24" value={req.doc_type} onChange={(e) => setReq({ ...req, doc_type: e.target.value as DocType })}>
                    {['CC', 'CE', 'NIT', 'PA', 'PPT', 'TI'].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </NativeSelect>
                  <Input value={req.document} onChange={(e) => setReq({ ...req, document: e.target.value })} />
                </div>
              </Field>
              <Field label="Correo" hint="Se usa para enviar el acuse y la respuesta.">
                <Input type="email" value={req.email} onChange={(e) => setReq({ ...req, email: e.target.value })} />
              </Field>
              <Field label="Teléfono">
                <Input value={req.phone} onChange={(e) => setReq({ ...req, phone: e.target.value })} />
              </Field>
              <Field label="Dirección (para respuesta física)" className="sm:col-span-2">
                <Input value={req.address} onChange={(e) => setReq({ ...req, address: e.target.value })} />
              </Field>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solicitud</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Asunto" required>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={250} />
          </Field>
          <Field label="Descripción" required>
            <Textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Soportes">
            <FileInput files={files} onChange={setFiles} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pb-6">
        <Button variant="outline" asChild>
          <Link to="/pqrs">Cancelar</Link>
        </Button>
        <Button onClick={() => { setError(null); save.mutate(); }} disabled={!valid || save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Radicar
        </Button>
      </div>
    </div>
  );
}
