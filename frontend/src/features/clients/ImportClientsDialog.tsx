import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, FileSpreadsheet, Loader2, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';

import { clientsApi } from '@/shared/api/endpoints';
import { errorMessage } from '@/shared/api/errors';
import type { ClientImportResult } from '@/shared/api/types';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { formatBytes } from '@/shared/ui/file-input';
import { toast } from '@/shared/ui/sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

function Summary({ r }: { r: ClientImportResult }) {
  const items = [
    ['Clientes nuevos', r.clients_created],
    ['Clientes actualizados', r.clients_updated],
    ['Puestos nuevos', r.sites_created],
    ['Puestos actualizados', r.sites_updated],
    ['Metas de visitas', r.quotas_set],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map(([label, n]) => (
        <div key={label} className="rounded-md border p-2 text-center">
          <p className="text-xl font-semibold tabular-nums">{n}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

/** Importación por Excel en dos pasos: validar (no guarda) e importar (todo o nada). */
export function ImportClientsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ClientImportResult | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
  };
  const run = useMutation({
    mutationFn: (dryRun: boolean) => clientsApi.importExcel(file!, dryRun),
    onSuccess: (r) => {
      setResult(r);
      if (r.saved) {
        void qc.invalidateQueries({ queryKey: ['clients'] });
        void qc.invalidateQueries({ queryKey: ['sites'] });
        void qc.invalidateQueries({ queryKey: ['visits'] });
        toast.success('Importación completada');
      }
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const validated = result && result.dry_run && result.errors.length === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar clientes, puestos y metas de visitas</DialogTitle>
          <DialogDescription>
            Usa la plantilla (hojas Clientes y Puestos). Primero se valida el archivo; si todo está bien, confirmas la importación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={() => clientsApi.importTemplate().catch((e) => toast.error(errorMessage(e)))}>
            <Download />
            Descargar plantilla Excel
          </Button>

          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed p-4 text-left hover:bg-muted/50"
          >
            <FileSpreadsheet className="h-8 w-8 shrink-0 text-success" />
            <span className="min-w-0">
              {file ? (
                <>
                  <span className="block truncate font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(file.size)} · clic para cambiar</span>
                </>
              ) : (
                <>
                  <span className="block font-medium">Seleccionar archivo .xlsx</span>
                  <span className="text-xs text-muted-foreground">Máximo 10 MB y 5.000 filas por hoja</span>
                </>
              )}
            </span>
          </button>
          <input
            ref={ref}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) {
                setFile(f);
                setResult(null);
              }
            }}
          />

          {result && result.errors.length > 0 && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>El archivo tiene {result.errors.length} error(es): no se guardó nada</AlertTitle>
              <AlertDescription>Corrige las filas indicadas en el Excel y vuelve a validar.</AlertDescription>
            </Alert>
          )}
          {validated && (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Archivo válido</AlertTitle>
              <AlertDescription>Esto es lo que se va a guardar. Confirma para importar.</AlertDescription>
            </Alert>
          )}
          {result?.saved && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertTitle>Importación completada</AlertTitle>
            </Alert>
          )}
          {result && <Summary r={result} />}
          {result && result.errors.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Hoja</TableHead>
                    <TableHead className="w-16">Fila</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.errors.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{e.sheet}</TableCell>
                      <TableCell className="tabular-nums">{e.row}</TableCell>
                      <TableCell className="text-sm">{e.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          {result?.saved ? (
            <Button onClick={() => { onOpenChange(false); reset(); }}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => run.mutate(true)} disabled={!file || run.isPending}>
                {run.isPending && run.variables === true ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                Validar
              </Button>
              <Button onClick={() => run.mutate(false)} disabled={!validated || run.isPending}>
                {run.isPending && run.variables === false ? <Loader2 className="animate-spin" /> : <Upload />}
                Importar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
