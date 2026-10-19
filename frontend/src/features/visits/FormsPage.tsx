import { useQuery } from '@tanstack/react-query';
import { FileStack, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { visitsApi } from '@/shared/api/endpoints';
import { keys } from '@/shared/hooks/queries';
import { formatDate } from '@/shared/lib/date';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Pill } from '@/shared/ui/pill';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { LoadingState } from '@/shared/ui/states/LoadingState';

export function FormsPage() {
  const forms = useQuery({ queryKey: [...keys.visits, 'forms', 'all'], queryFn: () => visitsApi.forms() });
  return (
    <div className="space-y-4">
      <PageHeader
        title="Formularios de visita"
        description="Construye las encuestas que diligencian los jefes de operación al visitar el puesto."
        actions={
          <Button asChild>
            <Link to="/visitas/formularios/nuevo">
              <Plus />
              Nuevo formulario
            </Link>
          </Button>
        }
      />
      {forms.isLoading && <LoadingState rows={3} />}
      {forms.data?.length === 0 && <EmptyState title="Sin formularios" />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(forms.data ?? []).map((f) => (
          <Link key={f.id} to={`/visitas/formularios/${f.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <FileStack className="h-6 w-6 text-primary" />
                  {f.active ? <Pill tone="bg-success/15 text-success border-success/30">Activo</Pill> : <Pill>Inactivo</Pill>}
                </div>
                <p className="font-semibold">{f.name}</p>
                {f.description && <p className="line-clamp-2 text-sm text-muted-foreground">{f.description}</p>}
                <p className="text-xs text-muted-foreground">
                  {f.fields.filter((x) => x.type !== 'section').length} preguntas · {f.fields.filter((x) => x.finding).length} con regla de hallazgo · v{f.version} · {formatDate(f.updated_at)}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
