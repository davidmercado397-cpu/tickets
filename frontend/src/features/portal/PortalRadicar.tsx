import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Loader2, Search, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { publicApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { DocType, PublicCreated, Segment } from '@/shared/api/types';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/date';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Field, NativeSelect, Switch } from '@/shared/ui/field';
import { FileInput } from '@/shared/ui/file-input';
import { Input } from '@/shared/ui/input';
import { toast } from '@/shared/ui/sonner';
import { Textarea } from '@/shared/ui/textarea';

import { usePortalTenant } from './usePortalTenant';

const DOC_TYPES: DocType[] = ['CC', 'CE', 'NIT', 'PA', 'PPT', 'TI'];

interface FormState {
  requestTypeId: string;
  categoryId: string;
  subcategoryId: string;
  subject: string;
  description: string;
  anonymous: boolean;
  nit: string;
  clientId: string;
  siteId: string;
  company: string;
  name: string;
  docType: DocType;
  document: string;
  email: string;
  phone: string;
  address: string;
  consent: boolean;
  website: string;
}

const EMPTY: FormState = {
  requestTypeId: '', categoryId: '', subcategoryId: '', subject: '', description: '', anonymous: false,
  nit: '', clientId: '', siteId: '', company: '', name: '', docType: 'CC', document: '', email: '', phone: '',
  address: '', consent: false, website: '',
};

export function PortalRadicar() {
  const t = usePortalTenant();
  const [params] = useSearchParams();
  const segment: Segment = params.get('segmento') === 'internal' ? 'internal' : 'external';
  const [step, setStep] = useState(1);
  const [f, setF] = useState<FormState>(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PublicCreated | null>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const catalog = useQuery({ queryKey: ['public-catalog', t.slug], queryFn: () => publicApi.catalog(t.slug) });
  const categories = useMemo(
    () => (catalog.data?.categories ?? []).filter((c) => c.segment === segment && (!c.request_type_id || c.request_type_id === f.requestTypeId)),
    [catalog.data, segment, f.requestTypeId],
  );
  const category = categories.find((c) => c.id === f.categoryId);

  const lookup = useMutation({
    mutationFn: () => publicApi.lookupClient(t.slug, f.nit),
    onSuccess: (c) => setF((s) => ({ ...s, clientId: c.id, company: c.name, siteId: c.sites.length === 1 ? c.sites[0]?.id ?? '' : '' })),
    onError: () => setF((s) => ({ ...s, clientId: '', siteId: '' })),
  });

  const submit = useMutation({
    mutationFn: () =>
      publicApi.create(
        t.slug,
        {
          segment,
          request_type_id: f.requestTypeId,
          category_id: f.categoryId || null,
          subcategory_id: f.subcategoryId || null,
          subject: f.subject,
          description: f.description,
          is_anonymous: f.anonymous,
          client_id: segment === 'external' ? f.clientId || null : null,
          site_id: segment === 'external' ? f.siteId || null : null,
          consent: f.consent,
          website: f.website,
          requester: {
            name: f.name || null,
            doc_type: f.document ? f.docType : null,
            document: f.document || null,
            email: f.email || null,
            phone: f.phone || null,
            company: segment === 'external' ? f.company || null : null,
            address: f.address || null,
          },
        },
        files,
      ),
    onSuccess: (r) => {
      setDone(r);
      window.scrollTo({ top: 0 });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  if (done) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-5 pt-6 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">¡Solicitud radicada!</h1>
            <p className="text-sm text-muted-foreground">
              {f.email ? 'Te enviamos una copia a tu correo. ' : ''}Guarda estos datos para consultar el estado.
            </p>
          </div>
          <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 text-left sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Radicado</p>
              <p className="font-mono text-lg font-semibold">{done.radicado}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Código de consulta</p>
              <p className="font-mono text-lg font-semibold">{done.public_code}</p>
            </div>
            {done.sla_due_at && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Fecha estimada de respuesta</p>
                <p className="font-medium">{formatDate(done.sla_due_at)}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(`Radicado ${done.radicado} · Código ${done.public_code}`);
                toast.success('Copiado');
              }}
            >
              <Copy />
              Copiar datos
            </Button>
            <Button asChild>
              <Link to={`/portal/${t.slug}/consulta?radicado=${done.radicado}&code=${done.public_code}`}>Ver estado</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const step1Ok = !!f.requestTypeId;
  const step2Ok = f.subject.trim().length >= 3 && f.description.trim().length >= 10;
  const identOk =
    f.anonymous ||
    (f.name.trim() && /\S+@\S+\.\S+/.test(f.email) && (segment === 'external' || f.document.trim()));
  const canSubmit = step1Ok && step2Ok && identOk && f.consent;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/portal/${t.slug}`}>
            <ArrowLeft />
            Volver
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">{segment === 'external' ? 'Radicar como cliente' : 'Radicar como colaborador'}</h1>
      </div>

      <ol className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
        {['Tipo de solicitud', 'Detalle', 'Tus datos'].map((label, i) => (
          <li
            key={label}
            className={cn(
              'rounded-md border px-2 py-2 text-center font-medium',
              step === i + 1 ? 'border-primary bg-primary/10 text-primary' : step > i + 1 ? 'bg-muted text-foreground' : 'text-muted-foreground',
            )}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">¿Qué deseas radicar?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(catalog.data?.request_types ?? []).map((rt) => (
              <button
                key={rt.id}
                type="button"
                onClick={() => setF((s) => ({ ...s, requestTypeId: rt.id, categoryId: '', subcategoryId: '' }))}
                className={cn(
                  'rounded-lg border p-4 text-left transition-colors hover:bg-muted/50',
                  f.requestTypeId === rt.id && 'border-primary bg-primary/5 ring-1 ring-primary',
                )}
              >
                <p className="font-medium">{rt.name}</p>
                {rt.description && <p className="mt-1 text-sm text-muted-foreground">{rt.description}</p>}
              </button>
            ))}
            {catalog.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cuéntanos qué pasó</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoría" hint="Nos ayuda a enviarla al área correcta.">
                <NativeSelect value={f.categoryId} onChange={(e) => setF((s) => ({ ...s, categoryId: e.target.value, subcategoryId: '' }))}>
                  <option value="">No estoy seguro</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {category && category.subcategories.length > 0 && (
                <Field label="Subcategoría">
                  <NativeSelect value={f.subcategoryId} onChange={(e) => set('subcategoryId', e.target.value)}>
                    <option value="">—</option>
                    {category.subcategories.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
            </div>
            <Field label="Asunto" required>
              <Input value={f.subject} maxLength={250} onChange={(e) => set('subject', e.target.value)} placeholder="Resumen en una frase" />
            </Field>
            <Field label="Descripción" required hint="Incluye fechas, lugar y personas involucradas si aplica (mínimo 10 caracteres).">
              <Textarea rows={6} value={f.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <Field label="Evidencias (opcional)" hint="Fotos, PDF o documentos. Máximo 10 archivos.">
              <FileInput files={files} onChange={setFiles} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,audio/*,video/*" />
            </Field>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tus datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {t.portal.allow_anonymous && segment === 'external' && (
              <Switch checked={f.anonymous} onChange={(v) => set('anonymous', v)} label="Quiero radicar de forma anónima" />
            )}
            {segment === 'external' && !f.anonymous && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">Si eres cliente corporativo, identifica tu empresa (opcional)</p>
                <div className="flex gap-2">
                  <Input value={f.nit} onChange={(e) => set('nit', e.target.value)} placeholder="NIT de la empresa" />
                  <Button type="button" variant="outline" onClick={() => lookup.mutate()} disabled={f.nit.length < 5 || lookup.isPending}>
                    {lookup.isPending ? <Loader2 className="animate-spin" /> : <Search />}
                    Buscar
                  </Button>
                </div>
                {lookup.isError && <p className="text-xs text-muted-foreground">No encontramos el NIT; escribe el nombre de tu empresa.</p>}
                {lookup.data ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Empresa">
                      <Input value={lookup.data.name} disabled />
                    </Field>
                    <Field label="Sede o puesto">
                      <NativeSelect value={f.siteId} onChange={(e) => set('siteId', e.target.value)}>
                        <option value="">General / no aplica</option>
                        {lookup.data.sites.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                  </div>
                ) : (
                  <Field label="Nombre de la empresa (si aplica)">
                    <Input value={f.company} onChange={(e) => set('company', e.target.value)} />
                  </Field>
                )}
              </div>
            )}
            {!f.anonymous && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre completo" required className="sm:col-span-2">
                  <Input value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />
                </Field>
                <Field label="Tipo de documento">
                  <NativeSelect value={f.docType} onChange={(e) => set('docType', e.target.value as DocType)}>
                    {DOC_TYPES.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Número de documento" required={segment === 'internal'}>
                  <Input value={f.document} onChange={(e) => set('document', e.target.value)} inputMode="numeric" />
                </Field>
                <Field label="Correo electrónico" required hint="Allí te enviaremos la respuesta.">
                  <Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
                </Field>
                <Field label="Celular">
                  <Input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" />
                </Field>
              </div>
            )}
            {f.anonymous && (
              <Field label="Correo para recibir la respuesta (opcional)" hint="No se mostrará a quien gestiona el caso como dato de identificación.">
                <Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
              </Field>
            )}
            <input
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
              value={f.website}
              onChange={(e) => set('website', e.target.value)}
              name="website"
            />
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <Checkbox checked={f.consent} onCheckedChange={(v) => set('consent', v === true)} className="mt-0.5" />
              <span className="text-muted-foreground">{t.portal.habeas_data}</span>
            </label>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 1}>
          <ArrowLeft />
          Anterior
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={(step === 1 && !step1Ok) || (step === 2 && !step2Ok)}>
            Siguiente
            <ArrowRight />
          </Button>
        ) : (
          <Button onClick={() => { setError(null); submit.mutate(); }} disabled={!canSubmit || submit.isPending}>
            {submit.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            Radicar
          </Button>
        )}
      </div>
    </div>
  );
}
