import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { cn } from '@/shared/lib/cn';
import { formatMonth } from '@/shared/lib/date';

/** Barras horizontales en HTML (un solo tono): desgloses por categoría, con valor visible. */
export function HBarList({
  items,
  max,
  suffix,
  empty = 'Sin datos',
  extra,
}: {
  items: { name: string; value: number; hint?: string }[];
  max?: number;
  suffix?: string;
  empty?: string;
  extra?: (i: number) => React.ReactNode;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={`${it.name}-${i}`} title={`${it.name}: ${it.value}${suffix ?? ''}${it.hint ? ` · ${it.hint}` : ''}`} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{it.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {it.value}
              {suffix}
              {extra?.(i)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full transition-[width] group-hover:opacity-80"
              style={{ width: `${Math.max(2, (it.value / top) * 100)}%`, background: 'var(--series-1)' }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tendencia mensual: radicadas vs respondidas (barras agrupadas, un solo eje). */
export function MonthlyTrend({
  data,
  className,
}: {
  data: { month: string; created: number; responded: number }[];
  className?: string;
}) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Sin datos en el periodo</p>;
  const rows = data.map((d) => ({ ...d, label: formatMonth(d.month).replace(/ de \d{4}$/, '').slice(0, 3) }));
  return (
    <div className={cn('h-64 w-full', className)}>
      <ResponsiveContainer>
        <BarChart data={rows} barGap={2} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))' }}
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              color: 'hsl(var(--popover-foreground))',
              fontSize: 12,
            }}
            labelFormatter={(_, p) => (p?.[0]?.payload?.month ? formatMonth(p[0].payload.month as string) : '')}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }} />
          <Bar dataKey="created" name="Radicadas" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="responded" name="Respondidas" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
