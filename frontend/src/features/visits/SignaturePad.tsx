import { Eraser } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '@/shared/ui/button';

/** Firma con el dedo o el mouse. Devuelve un data URL PNG. */
export function SignaturePad({ value, onChange, disabled }: { value?: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.offsetWidth, c.offsetHeight);
      img.src = value;
    }
    // solo al montar: el valor posterior lo produce este mismo componente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvas}
        className="h-40 w-full touch-none rounded-md border bg-white"
        onPointerDown={(e) => {
          if (disabled) return;
          drawing.current = true;
          const ctx = e.currentTarget.getContext('2d')!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d')!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={(e) => {
          if (!drawing.current) return;
          drawing.current = false;
          if (dirty.current) onChange(e.currentTarget.toDataURL('image/png'));
        }}
      />
      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const c = canvas.current!;
            c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
            dirty.current = false;
            onChange(null);
          }}
        >
          <Eraser />
          Borrar firma
        </Button>
      )}
    </div>
  );
}
