import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { useState } from 'react';

import { reportsApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { ReportGroup } from '@/shared/api/types';
import { useAreas } from '@/shared/hooks/queries';
import { currentMonth, isoDay } from '@/shared/lib/date';
import { SEGMENT_LABEL, SLA_LABEL } from '@/shared/lib/labels';
import { useCan } from '@/shared/session/session.store';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { HBarList, MonthlyTrend } from '@/shared/ui/charts';
import { Field, NativeSelect } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { toast } from '@/shared/ui/sonner';
import { StatCard } from '@/shared/ui/stat-card';
import { LoadingState } from '@/shared/ui/states/LoadingState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

function GroupTable({ title, groups }: { title: string; groups: ReportGroup[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Casos</TableHead>
              <TableHead className="text-right">Abiertas</TableHead>
              <TableHead className="text-right">Vencidas</TableHead>
              <TableHead className="text-right">A tiempo</TableHead>
              <TableHead className="text-right">Fuera de término</TableHead>
              <TableHead className="text-right">% oportunidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <TableRow key={`${g.key}-${g.name}`}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell className="text-right tabular-nums">{g.count}</TableCell>
                <TableCell className="text-right tabular-nums">{g.open}</TableCell>
                <TableCell className="text-right tabular-nums">{g.overdue}</TableCell>
                <TableCell className="text-right tabular-nums">{g.met}</TableCell>
                <TableCell className="text-right tabular-nums">{g.missed}</TableCell>
                <TableCell className="text-right tabular-nums">{g.compliance === null ? '—' : `${g.compliance}%`}</TableCell>
              </TableRow>
            ))}
            {groups.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Sin datos
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PqrsReport() {
  const can = useCan();
  const areas = useAreas();
  const start = new Date();
  start.setMonth(start.getMonth() - 2, 1);
  const [from, setFrom] = useState(isoDay(start));
  const [to, setTo] = useState(isoDay());
  const [segment, setSegment] = useState('');
  const [area, setArea] = useState('');
  const query = { from: `${from}T00:00:00`, to: `${to}T23:59:59`, segment: segment || undefined, area_id: area || undefined };
  const q = useQuery({ queryKey: ['report-pqrs', query], queryFn: () => reportsApi.pqrs(query) });
  const r = q.data;
  const exp = (fn: () => Promise<void>) => fn().catch((e) => toast.error(errorMessage(e)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Desde">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Cliente">
          <NativeSelect value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option value="">Todos</option>
            <option value="external">{SEGMENT_LABEL.external}</option>
            <option value="internal">{SEGMENT_LABEL.internal}</option>
          </NativeSelect>
        </Field>
        <Field label="Área">
          <NativeSelect value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Todas</option>
            {(areas.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {can('reports.export') && (
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={() => exp(() => reportsApi.pqrsXlsx(query))}>
              <Download />
              Excel
            </Button>
            <Button variant="outline" onClick={() => exp(() => reportsApi.pqrsPdf(query))}>
              <FileText />
              PDF
            </Button>
          </div>
        )}
      </div>
      {q.isLoading && <LoadingState rows={4} />}
      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Total radicadas" value={r.total} />
            <StatCard label="Abiertas" value={r.open} />
            <StatCard label="Respondidas" value={r.responded} />
            <StatCard label="Respuesta oportuna" value={r.compliance === null ? '—' : `${r.compliance}%`} tone={r.compliance === null ? 'default' : r.compliance >= 90 ? 'success' : 'warning'} />
            <StatCard label="Primera gestión (prom.)" value={r.avg_first_response_hours === null ? '—' : `${r.avg_first_response_hours} h`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Tendencia mensual</CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyTrend data={r.monthly} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Semáforo de tiempos</CardTitle>
              </CardHeader>
              <CardContent>
                <HBarList items={(Object.keys(SLA_LABEL) as (keyof typeof SLA_LABEL)[]).map((k) => ({ name: SLA_LABEL[k], value: r.sla[k] ?? 0 }))} />
              </CardContent>
            </Card>
          </div>
          <GroupTable title="Por tipo de solicitud" groups={r.by_type} />
          <GroupTable title="Por área" groups={r.by_area} />
          <GroupTable title="Por categoría" groups={r.by_category} />
          <GroupTable title="Por responsable" groups={r.by_assignee} />
          <GroupTable title="Por cliente corporativo" groups={r.by_client} />
          <div className="grid gap-4 lg:grid-cols-2">
            <GroupTable title="Por canal" groups={r.by_channel} />
            <GroupTable title="Por prioridad" groups={r.by_priority} />
          </div>
        </>
      )}
    </div>
  );
}

function VisitsReport() {
  const can = useCan();
  const [month, setMonth] = useState(currentMonth());
  const q = useQuery({ queryKey: ['report-visits', month], queryFn: () => reportsApi.visits(month) });
  const r = q.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Mes">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        {can('reports.export') && (
          <Button variant="outline" className="sm:ml-auto" onClick={() => reportsApi.visitsXlsx(month)}>
            <Download />
            Excel
          </Button>
        )}
      </div>
      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Cumplimiento de metas" value={`${r.compliance.percent}%`} />
            <StatCard label="Visitas realizadas" value={r.total_visits} />
            <StatCard label="Hallazgos" value={r.total_findings} />
            <StatCard label="Puntaje promedio" value={r.avg_score === null ? '—' : `${r.avg_score}%`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cumplimiento por puesto</CardTitle>
              </CardHeader>
              <CardContent>
                <HBarList max={100} suffix="%" items={r.compliance.rows.map((x) => ({ name: x.site?.name ?? x.client?.name ?? '—', value: x.percent, hint: `${x.done}/${x.required}` }))} empty="Sin metas" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por jefe de operación</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="text-right">Visitas</TableHead>
                      <TableHead className="text-right">Hallazgos</TableHead>
                      <TableHead className="text-right">Puntaje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.by_visitor.map((v) => (
                      <TableRow key={v.name}>
                        <TableCell>{v.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{v.visits}</TableCell>
                        <TableCell className="text-right tabular-nums">{v.findings}</TableCell>
                        <TableCell className="text-right tabular-nums">{v.avg_score === null ? '—' : `${v.avg_score}%`}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function TasksReport() {
  const q = useQuery({ queryKey: ['report-tasks'], queryFn: reportsApi.tasks });
  const r = q.data;
  if (!r) return <LoadingState rows={3} />;
  const SOURCE: Record<string, string> = { manual: 'Manual', visit: 'Visitas', pqrs: 'PQRS', minuta: 'Minutas', integration: 'Integración' };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tareas" value={r.total} />
        <StatCard label="Abiertas" value={(r.by_status.open ?? 0) + (r.by_status.in_progress ?? 0)} />
        <StatCard label="Vencidas" value={r.overdue} tone={r.overdue ? 'danger' : 'success'} />
        <StatCard label="Cumplidas a tiempo" value={r.on_time_percent === null ? '—' : `${r.on_time_percent}%`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por origen</CardTitle>
          </CardHeader>
          <CardContent>
            <HBarList items={Object.entries(r.by_source).map(([k, v]) => ({ name: SOURCE[k] ?? k, value: v }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por responsable</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Abiertas</TableHead>
                  <TableHead className="text-right">Vencidas</TableHead>
                  <TableHead className="text-right">Cumplidas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.by_assignee.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell>{a.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.open}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.overdue}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.done}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ReportsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Reportes e indicadores" description="Oportunidad de respuesta, volumen de casos, visitas a puesto y tareas." />
      <Tabs defaultValue="pqrs">
        <TabsList>
          <TabsTrigger value="pqrs">PQRS</TabsTrigger>
          <TabsTrigger value="visitas">Visitas</TabsTrigger>
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
        </TabsList>
        <TabsContent value="pqrs">
          <PqrsReport />
        </TabsContent>
        <TabsContent value="visitas">
          <VisitsReport />
        </TabsContent>
        <TabsContent value="tareas">
          <TasksReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
