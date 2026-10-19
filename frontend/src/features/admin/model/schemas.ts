import { z } from 'zod';

import type { Role } from '@/shared/api/types';

const codeRegex = /^[a-z0-9_-]{2,40}$/;

export const areaSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  code: z.string().regex(codeRegex, 'Código inválido (a-z, 0-9, guiones; 2-40)'),
});
export type AreaValues = z.infer<typeof areaSchema>;

export const categorySchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  code: z.string().regex(codeRegex, 'Código inválido (a-z, 0-9, guiones; 2-40)'),
  areaCode: z.string().min(1, 'Requerido'),
});
export type CategoryValues = z.infer<typeof categorySchema>;

const roleEnum = z.enum(['admin', 'agent']);

function requireAreaForAgent(
  v: { role: 'admin' | 'agent'; areaCodes: string[] },
  ctx: z.RefinementCtx,
) {
  if (v.role === 'agent' && v.areaCodes.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['areaCodes'],
      message: 'Un agente debe tener al menos un área.',
    });
  }
}

/** Un único shape de formulario para crear/editar usuario (evita fricción de tipos).
 *  En edición el email no se envía; la contraseña vacía = no cambiar. */
export interface UserFormValues {
  email: string;
  password: string;
  role: Role;
  displayName: string;
  phone: string;
  active: boolean;
  areaCodes: string[];
}

export function makeUserSchema(isEdit: boolean) {
  return z
    .object({
      email: isEdit ? z.string() : z.string().min(1, 'Requerido').email('Correo inválido'),
      password: isEdit
        ? z.string().refine((v) => v === '' || v.length >= 8, 'Mínimo 8 caracteres')
        : z.string().min(8, 'Mínimo 8 caracteres'),
      role: roleEnum,
      displayName: z.string(),
      phone: z.string(),
      active: z.boolean(),
      areaCodes: z.array(z.string()),
    })
    .superRefine(requireAreaForAgent);
}
