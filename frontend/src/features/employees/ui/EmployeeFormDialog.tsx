import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useEmployeeMutations } from '@/features/employees/hooks/useEmployees';
import { employeeSchema, type EmployeeValues } from '@/features/employees/model/schema';
import type { Employee } from '@/shared/api/types';
import { applyServerFieldErrors } from '@/shared/lib/formErrors';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { toast } from '@/shared/ui/sonner';

const FIELD_MAP = {
  full_name: 'fullName',
  hire_date: 'hireDate',
  contract_type: 'contractType',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee;
}

export function EmployeeFormDialog({ open, onOpenChange, employee }: Props) {
  const { t } = useTranslation(['employees', 'common']);
  const isEdit = !!employee;
  const { create, update } = useEmployeeMutations();

  const form = useForm<EmployeeValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      document: '',
      fullName: '',
      position: '',
      hireDate: '',
      contractType: '',
      status: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        document: employee?.document ?? '',
        fullName: employee?.fullName ?? '',
        position: employee?.position ?? '',
        hireDate: employee?.hireDate ?? '',
        contractType: employee?.contractType ?? '',
        status: employee?.status ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee]);

  const pending = create.isPending || update.isPending;

  const onSubmit = (v: EmployeeValues) => {
    const handlers = {
      onSuccess: () => {
        toast.success(t('common:save'));
        onOpenChange(false);
      },
      onError: (e: unknown) => {
        if (!applyServerFieldErrors(e, form.setError, FIELD_MAP)) toast.error(t('common:save'));
      },
    };
    const shared = {
      fullName: v.fullName,
      position: v.position || undefined,
      hireDate: v.hireDate || undefined,
      contractType: v.contractType || undefined,
      status: v.status || undefined,
    };
    if (isEdit) update.mutate({ document: employee.document, input: shared }, handlers);
    else create.mutate({ document: v.document, ...shared }, handlers);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('common:edit') : t('employees:newEmployee')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="document"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('employees:document')}</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly={isEdit} disabled={isEdit} autoFocus={!isEdit} />
                  </FormControl>
                  {isEdit && <FormDescription>{t('employees:documentImmutable')}</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('employees:fullName')}</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus={isEdit} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees:position')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hireDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees:hireDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contractType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees:contractType')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('employees:status')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t('common:cancel')}
              </Button>
              <Button type="submit" disabled={pending}>
                {t('common:save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
