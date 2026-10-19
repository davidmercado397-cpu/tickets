import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useAreaMutations } from '@/features/admin/hooks/useAreaMutations';
import { areaSchema, type AreaValues } from '@/features/admin/model/schemas';
import type { Area } from '@/shared/api/types';
import { applyServerFieldErrors } from '@/shared/lib/formErrors';
import { slugify } from '@/shared/lib/slugify';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  area?: Area;
}

export function AreaFormDialog({ open, onOpenChange, area }: Props) {
  const { t } = useTranslation(['admin', 'common']);
  const isEdit = !!area;
  const { create, update } = useAreaMutations();
  const [codeEdited, setCodeEdited] = useState(isEdit);

  const form = useForm<AreaValues>({
    resolver: zodResolver(areaSchema),
    defaultValues: { name: '', code: '' },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: area?.name ?? '', code: area?.code ?? '' });
      setCodeEdited(isEdit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, area]);

  // En crear, el code se autollena por slug del name hasta que el usuario lo edite.
  const name = form.watch('name');
  useEffect(() => {
    if (!isEdit && !codeEdited) form.setValue('code', slugify(name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, codeEdited, isEdit]);

  const pending = create.isPending || update.isPending;

  const onSubmit = (values: AreaValues) => {
    const handlers = {
      onSuccess: () => {
        toast.success(t('common:save'));
        onOpenChange(false);
      },
      onError: (e: unknown) => {
        if (!applyServerFieldErrors(e, form.setError)) toast.error(t('common:save'));
      },
    };
    if (isEdit) update.mutate({ id: area.id, input: { name: values.name } }, handlers);
    else create.mutate({ name: values.name, code: values.code }, handlers);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('common:edit') : t('admin:newArea')}</DialogTitle>
          <DialogDescription>{t('admin:codeImmutable')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin:name')}</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin:code')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      readOnly={isEdit}
                      disabled={isEdit}
                      onChange={(e) => {
                        setCodeEdited(true);
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  {isEdit && <FormDescription>{t('admin:codeImmutable')}</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
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
