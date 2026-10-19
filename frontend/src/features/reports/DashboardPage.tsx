import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, CheckCircle2, ClipboardCheck, Clock, Inbox, ListChecks, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { reportsApi } from '@/shared/api/endpoints';
import { formatMonth } from '@/shared/lib/date';
import { useSessionUser } from '@/shared/session/session.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { HBarList, MonthlyTrend } from '@/shared/ui/charts';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatCard } from '@/shared/ui/stat-card';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { LoadingState } from '@/shared/ui/states/LoadingState';

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useSessionUser();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: reportsApi.dashboard, refetchInterval: 120_000 });
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const { pqrs, visits, tasks } = q.data;

  return (
    <div className="space-y-5">
      <PageHeader title={`Hola, ${user?.full_name.split(' ')[0] ?? ''}`} description="Resumen de los últimos seis meses de PQRS y de la operación del mes." />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="PQRS abiertas" value={pqrs.open} icon={Inbox} onClick={() => navigate('/pqrs?tab=open')} />
        <StatCard
          label="Vencidas"
          value={pqrs.sla.overdue}
          icon={AlertOctagon}
          tone={pqrs.sla.overdue > 0 ? 'danger' : 'success'}
          hint={`${pqrs.sla.at_risk} por vencer`}
          onClick={() => navigate('/pqrs?tab=overdue')}
        />
        <StatCard
          label="Respuesta oportuna"
          value={pqrs.compliance === null ? '—' : `${pqrs.compliance}%`}
          icon={CheckCircle2}
          tone={pqrs.compliance === null ? 'default' : pqrs.compliance >= 90 ? 'success' : pqrs.compliance >= 75 ? 'warning' : 'danger'}
          hint={`${pqrs.sla.met} a tiempo · ${pqrs.sla.missed} fuera de término`}
        />
        <StatCard
          label="Tiempo promedio de respuesta"
          value={pqrs.avg_resolution_hours === null ? '—' : `${(pqrs.avg_resolution_hours / 24).toFixed(1)} d`}
          icon={Timer}
          hint="Días calendario desde la radicación"
        />
        <StatCard
          label={`Visitas · ${formatMonth(visits.month)}`}
          value={`${visits.percent}%`}
          icon={ClipboardCheck}
          tone={visits.required === 0 ? 'default' : visits.percent >= 100 ? 'success' : visits.percent >= 60 ? 'warning' : 'danger'}
          hint={`${visits.done} de ${visits.required} obligatorias`}
          onClick={() => navigate('/visitas/cumplimiento')}
        />
        <StatCard label="Tareas abiertas" value={tasks.open} icon={ListChecks} onClick={() => navigate('/tareas?tab=open')} />
        <StatCard label="Tareas vencidas" value={tasks.overdue} icon={Clock} tone={tasks.overdue > 0 ? 'danger' : 'success'} onClick={() => navigate('/tareas?tab=overdue')} />
        <StatCard
          label="Tareas a tiempo"
          value={tasks.on_time_percent === null ? '—' : `${tasks.on_time_percent}%`}
          icon={CheckCircle2}
          hint="Cumplidas antes de su fecha límite"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">PQRS radicadas y respondidas por mes</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyTrend data={pqrs.monthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <HBarList items={pqrs.by_type.map((g) => ({ name: g.name, value: g.count }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Abiertas por área</CardTitle>
          </CardHeader>
          <CardContent>
            <HBarList items={pqrs.by_area.filter((g) => g.open > 0).map((g) => ({ name: g.name, value: g.open, hint: `${g.overdue} vencidas` }))} empty="Sin casos abiertos" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por canal</CardTitle>
          </CardHeader>
          <CardContent>
            <HBarList items={pqrs.by_channel.map((g) => ({ name: g.name, value: g.count }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Puestos con menor cumplimiento de visitas</CardTitle>
          </CardHeader>
          <CardContent>
            <HBarList
              max={100}
              suffix="%"
              items={visits.worst.map((r) => ({ name: r.site?.name ?? r.client?.name ?? '—', value: r.percent, hint: `${r.done}/${r.required}` }))}
              empty="Sin metas configuradas"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
