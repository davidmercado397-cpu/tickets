import { z } from 'zod';

export const employeeSchema = z.object({
  document: z.string().min(1, 'Requerido'),
  fullName: z.string().min(2, 'Mínimo 2 caracteres'),
  position: z.string(),
  hireDate: z.string(),
  contractType: z.string(),
  status: z.string(),
});

export type EmployeeValues = z.infer<typeof employeeSchema>;
