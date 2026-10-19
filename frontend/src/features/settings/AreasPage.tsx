import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { identityApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { Area } from '@/shared/api/types';
import { keys, useAreas } from '@/shared/hooks/queries';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, Switch } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Pill } from '@/shared/ui/pill';
import { toast } from '@/shared/ui/sonner';
import { LoadingState } from '@/shared/ui/states/LoadingState';

export function AreasPage() {
  const qc = useQueryClient();
  const areas = useAreas();
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState<Area | undefined>();
  const [f, setF] = useState({ name: '', email: '', active: true });
  useEffect(() => {
    if (open) setF({ name: area?.name ?? '', email: area?.email ?? '', active: area?.active ?? true });
  }, [open, area]);
  const save = useMutation({
    mutationFn: () => (area ? identityApi.updateArea(area.id, { name: f.name, email: f.email || null, active: f.active }) : identityApi.createArea({ name: f.name, email: f.email || null })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.areas });
      toast.success('Área guardada');
      setOpen(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (areas.isLoading) return <LoadingState />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Áreas"
        description="Dependencias responsables de atender las PQRS."
        actions={
          <Button onClick={() => { setArea(undefined); setOpen(true); }}>
            <Plus />
            Nueva área
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(areas.data ?? []).map((a) => (
          <Card key={a.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => { setArea(a); setOpen(true); }}>
            <CardContent className="space-y-1 pt-6">
              <div className="flex items-center justify-between">
                <p className="font-medium">{a.name}</p>
                {!a.active && <Pill>Inactiva</Pill>}
              </div>
              <p className="font-mono text-xs text-muted-foreground">{a.code}</p>
              {a.email && <p className="text-xs text-muted-foreground">{a.email}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{area ? 'Editar área' : 'Nueva área'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Nombre">
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Correo del área (opcional)">
              <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </Field>
            {area && <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Activa" />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={f.name.trim().length < 2 || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
