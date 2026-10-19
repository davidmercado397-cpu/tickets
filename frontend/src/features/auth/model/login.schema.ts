import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Requerido').email('Correo inválido'),
  password: z.string().min(1, 'Requerido'),
});

export type LoginValues = z.infer<typeof loginSchema>;
