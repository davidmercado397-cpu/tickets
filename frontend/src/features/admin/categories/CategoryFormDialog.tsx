import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useCategoryMutations } from '@/features/admin/hooks/useCategoryMutations';
import { categorySchema, type CategoryValues } from '@/features/admin/model/schemas';
import type { Category } from '@/shared/api/types';
import { useAreas } from '@/shared/hooks/useCatalog';
import { applyServerFieldErrors } from '@/shared/lib/formErrors';
import { slugify } from '@/shared/lib/slugify';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { toast } from '@/shared/ui/sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
}

export function CategoryFormDialog({ open, onOpenChange, category }: Props) {
  const { t } = useTranslation(['admin', 'common', 'tickets']);
  const isEdit = !!category;
  const areas = useAreas(true);
  const { create, update } = useCategoryMutations();
  const [codeEdited, setCodeEdited] = useState(isEdit);

  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', code: '', areaCode: '' },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: category?.name ?? '',
        code: category?.code ?? '',
        areaCode: category?.areaCode ?? '',
      });
      setCodeEdited(isEdit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

  const name = form.watch('name');
  useEffect(() => {
    if (!isEdit && !codeEdited) form.setValue('code', slugify(name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, codeEdited, isEdit]);

  const pending = create.isPending || update.isPending;

  const onSubmit = (values: CategoryValues) => {
    const handlers = {
      onSuccess: () => {
        toast.success(t('common:save'));
        onOpenChange(false);
      },
      onError: (e: unknown) => {
        if (!applyServerFieldErrors(e, form.setError, { area: 'areaCode' })) {
          toast.error(t('common:save'));
        }
      },
    };
    if (isEdit) update.mutate({ id: category.id, input: { name: values.name } }, handlers);
    else
      create.mutate({ name: values.name, code: values.code, areaCode: values.areaCode }, handlers);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('common:edit') : t('admin:newCategory')}</DialogTitle>
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
            <FormField
              control={form.control}
              name="areaCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('tickets:area')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(areas.data ?? []).map((a) => (
                        <SelectItem key={a.code} value={a.code}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
