import { Building2, HardHat, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

import { usePortalTenant } from './usePortalTenant';

export function PortalHome() {
  const t = usePortalTenant();
  const navigate = useNavigate();
  const [radicado, setRadicado] = useState('');
  const [code, setCode] = useState('');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">¿En qué podemos ayudarte?</h1>
        <p className="text-muted-foreground">{t.portal.welcome}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to={`/portal/${t.slug}/radicar?segmento=external`} className="group">
          <Card className="h-full transition-shadow group-hover:shadow-md">
            <CardHeader>
              <Building2 className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>Soy cliente</CardTitle>
              <CardDescription>
                Empresas, conjuntos y entidades que reciben nuestro servicio de vigilancia, y la comunidad en general.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link to={`/portal/${t.slug}/radicar?segmento=internal`} className="group">
          <Card className="h-full transition-shadow group-hover:shadow-md">
            <CardHeader>
              <HardHat className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>Soy colaborador</CardTitle>
              <CardDescription>
                Personal de la empresa: nómina, certificados, dotación, turnos, permisos, seguridad y salud en el trabajo.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5" />
            Consultar una solicitud
          </CardTitle>
          <CardDescription>Usa el número de radicado y el código que recibiste al radicar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/portal/${t.slug}/consulta?radicado=${encodeURIComponent(radicado.trim())}&code=${encodeURIComponent(code.trim())}`);
            }}
          >
            <Field label="Radicado">
              <Input value={radicado} onChange={(e) => setRadicado(e.target.value.toUpperCase())} placeholder="SGP-2026-000123" required />
            </Field>
            <Field label="Código de consulta">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD2345" required />
            </Field>
            <Button type="submit">Consultar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
