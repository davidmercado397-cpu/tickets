import { ClipboardCheck, Inbox, ShieldCheck, Timer } from 'lucide-react';
import { Outlet } from 'react-router-dom';

const FEATURES = [
  { icon: Inbox, text: 'PQRS de clientes corporativos y empleados, por portal, correo, WhatsApp o ventanilla.' },
  { icon: Timer, text: 'Tiempos de respuesta en días hábiles con semáforo de cumplimiento.' },
  { icon: ClipboardCheck, text: 'Visitas a puesto con formularios dinámicos, hallazgos y tareas.' },
];

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sidebar-accent/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-accent text-white shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <span className="text-lg font-semibold">NextByte Seguimientos</span>
        </div>
        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Atención al cliente y control de la operación en un solo lugar.
          </h2>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-sidebar-foreground/85">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-sidebar-accent" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-muted">© {new Date().getFullYear()} NextByte</p>
      </div>
      <div className="flex items-center justify-center bg-muted/30 p-4 sm:p-6">
        <Outlet />
      </div>
    </div>
  );
}
