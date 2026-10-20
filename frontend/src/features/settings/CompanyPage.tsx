import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, KeyRound, Loader2, MailCheck, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { authApi, tenantApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { Tenant } from '@/shared/api/types';
import { keys, useAreas, useUserLookup } from '@/shared/hooks/queries';
import { applyBrand } from '@/shared/lib/brand';
import { formatDateTime } from '@/shared/lib/date';
import { useCan, useSessionStore } from '@/shared/session/session.store';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, NativeSelect, Switch } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { toast } from '@/shared/ui/sonner';
import { LoadingState } from '@/shared/ui/states/LoadingState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Textarea } from '@/shared/ui/textarea';

function useTenantSave() {
  const qc = useQueryClient();
  const setUser = useSessionStore((s) => s.setUser);
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => tenantApi.update(body),
    onSuccess: async (t) => {
      qc.setQueryData(keys.tenant, t);
      applyBrand(t.primary_color, t.secondary_color);
      setUser(await authApi.me());
      toast.success('Cambios guardados');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

function GeneralTab({ t }: { t: Tenant }) {
  const save = useTenantSave();
  const setUser = useSessionStore((s) => s.setUser);
  const [f, setF] = useState(t);
  const [logoV, setLogoV] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setF(t), [t]);
  const set = (k: keyof Tenant, v: string) => setF((s) => ({ ...s, [k]: v }));
  const logo = useMutation({
    mutationFn: tenantApi.uploadLogo,
    onSuccess: async () => {
      setLogoV(Date.now());
      setUser(await authApi.me());
      toast.success('Logo actualizado');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const fields: [keyof Tenant, string][] = [
    ['name', 'Nombre comercial'],
    ['legal_name', 'Razón social'],
    ['nit', 'NIT'],
    ['phone', 'Teléfono'],
    ['email', 'Correo de contacto'],
    ['website', 'Sitio web'],
    ['address', 'Dirección'],
    ['city', 'Ciudad'],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la empresa</CardTitle>
          <CardDescription>Aparecen en el portal, los correos y las cartas de respuesta.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {fields.map(([k, l]) => (
            <Field key={k} label={l}>
              <Input value={(f[k] as string) ?? ''} onChange={(e) => set(k, e.target.value)} />
            </Field>
          ))}
          <Field label="Prefijo del radicado" hint="Ej. ABC → ABC-2026-000123">
            <Input value={f.radicado_prefix} onChange={(e) => set('radicado_prefix', e.target.value.toUpperCase())} maxLength={10} />
          </Field>
          <div className="flex items-end justify-end sm:col-span-2">
            <Button
              onClick={() =>
                save.mutate({
                  name: f.name, legal_name: f.legal_name || null, nit: f.nit || null, phone: f.phone || null, email: f.email || null,
                  website: f.website || null, address: f.address || null, city: f.city || null, radicado_prefix: f.radicado_prefix,
                })
              }
              disabled={save.isPending}
            >
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="self-start">
        <CardHeader>
          <CardTitle className="text-base">Marca</CardTitle>
          <CardDescription>Logo y colores de la plataforma, el portal y las cartas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-white">
              {t.has_logo || logoV ? <img src={`${tenantApi.logoUrl(t.slug)}?v=${logoV}`} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">Sin logo</span>}
            </div>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={logo.isPending}>
              {logo.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
              Subir logo
            </Button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) logo.mutate(file); }} />
          </div>
          <p className="text-xs text-muted-foreground">PNG con fondo transparente, máximo 2 MB. Para las cartas PDF usa PNG o JPG.</p>
          {(['primary_color', 'secondary_color'] as const).map((k) => (
            <Field key={k} label={k === 'primary_color' ? 'Color principal' : 'Color de acento'}>
              <div className="flex gap-2">
                <input type="color" value={f[k]} onChange={(e) => set(k, e.target.value)} className="h-10 w-14 cursor-pointer rounded-md border bg-background p-1" />
                <Input value={f[k]} onChange={(e) => set(k, e.target.value)} className="font-mono" />
              </div>
            </Field>
          ))}
          <Button className="w-full" onClick={() => save.mutate({ primary_color: f.primary_color, secondary_color: f.secondary_color })} disabled={save.isPending}>
            Aplicar colores
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PortalTab({ t }: { t: Tenant }) {
  const save = useTenantSave();
  const signers = useUserLookup('pqrs.approve');
  const [portal, setPortal] = useState(t.portal);
  const [letter, setLetter] = useState(t.letter);
  const [notif, setNotif] = useState(t.notifications);
  const [qualityArea, setQualityArea] = useState(t.quality.area_id ?? '');
  const areas = useAreas();
  useEffect(() => {
    setPortal(t.portal);
    setLetter(t.letter);
    setNotif(t.notifications);
    setQualityArea(t.quality.area_id ?? '');
  }, [t]);
  const url = `${window.location.origin}/portal/${t.slug}`;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portal público de PQRS</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-primary hover:underline">
              {url}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => { void navigator.clipboard?.writeText(url); toast.success('Enlace copiado'); }}>
              <Copy />
              Copiar
            </Button>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <Switch checked={portal.enabled} onChange={(v) => setPortal({ ...portal, enabled: v })} label="Portal habilitado" />
            <Switch checked={portal.allow_anonymous} onChange={(v) => setPortal({ ...portal, allow_anonymous: v })} label="Permitir solicitudes anónimas" />
          </div>
          <Field label="Mensaje de bienvenida">
            <Textarea rows={2} value={portal.welcome} onChange={(e) => setPortal({ ...portal, welcome: e.target.value })} />
          </Field>
          <Field label="Texto de autorización de tratamiento de datos (Ley 1581 de 2012)">
            <Textarea rows={3} value={portal.habeas_data} onChange={(e) => setPortal({ ...portal, habeas_data: e.target.value })} />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carta de respuesta (PDF)</CardTitle>
          <CardDescription>La firma es la de quien aprueba; si no tiene firma cargada se usa la del firmante por defecto.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Ciudad de expedición">
            <Input value={letter.city} onChange={(e) => setLetter({ ...letter, city: e.target.value })} />
          </Field>
          <Field label="Despedida">
            <Input value={letter.closing} onChange={(e) => setLetter({ ...letter, closing: e.target.value })} />
          </Field>
          <Field label="Firmante por defecto">
            <NativeSelect value={letter.signer_user_id ?? ''} onChange={(e) => setLetter({ ...letter, signer_user_id: e.target.value || null })}>
              <option value="">Quien aprueba</option>
              {(signers.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Pie de página adicional" className="sm:col-span-2">
            <Textarea rows={2} value={letter.footer} onChange={(e) => setLetter({ ...letter, footer: e.target.value })} placeholder="Ej. Licencia de funcionamiento Supervigilancia No. ..." />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calidad y análisis de causa raíz</CardTitle>
          <CardDescription>
            Las PQRS que exigen análisis de causa raíz (por defecto, las quejas de clientes externos) llegan primero a esta área.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field label="Área de Calidad">
            <NativeSelect value={qualityArea} onChange={(e) => setQualityArea(e.target.value)}>
              <option value="">Área con código &quot;calidad&quot; (por defecto)</option>
              {(areas.data ?? []).filter((a) => a.active).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificaciones por correo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Switch checked={notif.email_requester_on_create} onChange={(v) => setNotif({ ...notif, email_requester_on_create: v })} label="Enviar acuse de recibo al solicitante" />
          <Switch checked={notif.email_staff} onChange={(v) => setNotif({ ...notif, email_staff: v })} label="Enviar correos al personal (asignaciones, aprobaciones, vencimientos)" />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button
          onClick={() => save.mutate({ portal, letter, notifications: notif, quality: { area_id: qualityArea || null } })}
          disabled={save.isPending}
        >
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar
        </Button>
      </div>
    </div>
  );
}

function EmailTab({ t }: { t: Tenant }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ ...t.email_inbound, password: '' });
  useEffect(() => setF({ ...t.email_inbound, password: '' }), [t]);
  const save = useMutation({
    mutationFn: () => tenantApi.updateEmailInbound({ enabled: f.enabled, host: f.host, port: f.port, username: f.username, folder: f.folder, use_ssl: f.use_ssl, password: f.password || null }),
    onSuccess: (nt) => {
      qc.setQueryData(keys.tenant, nt);
      toast.success('Buzón guardado');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const test = useMutation({ mutationFn: tenantApi.testEmail, onSuccess: (r) => (r.ok ? toast.success(r.detail) : toast.error(r.detail)), onError: (e) => toast.error(errorMessage(e)) });
  const poll = useMutation({ mutationFn: tenantApi.pollEmail, onSuccess: (r) => toast.success(r.detail), onError: (e) => toast.error(errorMessage(e)) });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Correo entrante (IMAP)</CardTitle>
        <CardDescription>Cada correo no leído del buzón se radica automáticamente como PQRS (tipo Petición, por clasificar).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Switch checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label="Leer este buzón automáticamente" />
        </div>
        <Field label="Servidor IMAP">
          <Input value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} placeholder="imap.gmail.com" />
        </Field>
        <Field label="Puerto">
          <Input type="number" value={f.port} onChange={(e) => setF({ ...f, port: Number(e.target.value) })} />
        </Field>
        <Field label="Usuario">
          <Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="pqrs@empresa.com" />
        </Field>
        <Field label="Contraseña de aplicación" hint={t.email_inbound.has_password ? 'Ya hay una guardada (cifrada). Déjalo vacío para conservarla.' : 'Se guarda cifrada.'}>
          <Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
        </Field>
        <Field label="Carpeta">
          <Input value={f.folder} onChange={(e) => setF({ ...f, folder: e.target.value })} />
        </Field>
        <div className="flex items-end pb-2">
          <Switch checked={f.use_ssl} onChange={(v) => setF({ ...f, use_ssl: v })} label="SSL" />
        </div>
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending || !t.email_inbound.has_password}>
            {test.isPending ? <Loader2 className="animate-spin" /> : <MailCheck />}
            Probar conexión
          </Button>
          <Button variant="outline" onClick={() => poll.mutate()} disabled={poll.isPending || !t.email_inbound.has_password}>
            {poll.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Leer ahora
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save />
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function KeysTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['integration-keys'], queryFn: tenantApi.keys });
  const [name, setName] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => tenantApi.createKey(name),
    onSuccess: (k) => {
      setCreated(k.key ?? null);
      setName('');
      void qc.invalidateQueries({ queryKey: ['integration-keys'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const revoke = useMutation({ mutationFn: tenantApi.revokeKey, onSuccess: () => void qc.invalidateQueries({ queryKey: ['integration-keys'] }) });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">API keys de integración</CardTitle>
        <CardDescription>
          Para el bot de WhatsApp y el módulo de minutas: envían la cabecera <code>X-Api-Key</code> a <code>/api/integrations/…</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {created && (
          <Alert>
            <AlertDescription className="space-y-2">
              <p>Copia la clave ahora; no se volverá a mostrar.</p>
              <div className="flex gap-2">
                <code className="flex-1 break-all rounded bg-muted px-2 py-1 text-xs">{created}</code>
                <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(created); toast.success('Copiada'); }}>
                  <Copy />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej. Bot WhatsApp)" />
          <Button onClick={() => create.mutate()} disabled={name.trim().length < 2 || create.isPending}>
            <KeyRound />
            Generar
          </Button>
        </div>
        <div className="divide-y rounded-md border">
          {(q.data ?? []).map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div>
                <p className="font-medium">
                  {k.name} {!k.active && <span className="text-xs text-destructive">(revocada)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {k.prefix}… · último uso {k.last_used_at ? formatDateTime(k.last_used_at) : 'nunca'}
                </p>
              </div>
              {k.active && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => revoke.mutate(k.id)} aria-label="Revocar">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {(q.data ?? []).length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">Sin API keys.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function CompanyPage() {
  const can = useCan();
  const q = useQuery({ queryKey: keys.tenant, queryFn: tenantApi.get });
  if (q.isLoading || !q.data) return <LoadingState />;
  const settings = can('tenant.settings');
  return (
    <div className="space-y-4">
      <PageHeader title="Configuración de la empresa" description={q.data.legal_name ?? q.data.name} />
      <Tabs defaultValue={settings ? 'general' : 'keys'}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          {settings && <TabsTrigger value="general">Datos y marca</TabsTrigger>}
          {settings && <TabsTrigger value="portal">Portal y cartas</TabsTrigger>}
          {settings && <TabsTrigger value="email">Correo entrante</TabsTrigger>}
          {can('integrations.manage') && <TabsTrigger value="keys">Integraciones</TabsTrigger>}
        </TabsList>
        {settings && (
          <>
            <TabsContent value="general">
              <GeneralTab t={q.data} />
            </TabsContent>
            <TabsContent value="portal">
              <PortalTab t={q.data} />
            </TabsContent>
            <TabsContent value="email">
              <EmailTab t={q.data} />
            </TabsContent>
          </>
        )}
        <TabsContent value="keys">
          <KeysTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
