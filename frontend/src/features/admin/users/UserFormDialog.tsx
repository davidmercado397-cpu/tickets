import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useUserMutations } from '@/features/admin/hooks/useUsers';
import { makeUserSchema, type UserFormValues } from '@/features/admin/model/schemas';
import { AreaCodesMultiSelect } from '@/features/admin/users/AreaCodesMultiSelect';
import type { User } from '@/shared/api/types';
import { applyServerFieldErrors } from '@/shared/lib/formErrors';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
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
  user?: User;
}

const FIELD_MAP = { display_name: 'displayName', area_codes: 'areaCodes' };

export function UserFormDialog({ open, onOpenChange, user }: Props) {
  const { t } = useTranslation(['admin', 'common', 'auth']);
  const isEdit = !!user;
  const { create, update } = useUserMutations();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(makeUserSchema(isEdit)),
    defaultValues: {
      email: '',
      password: '',
      role: 'agent',
      displayName: '',
      phone: '',
      active: true,
      areaCodes: [],
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        email: user?.email ?? '',
        password: '',
        role: user?.role ?? 'agent',
        displayName: user?.displayName ?? '',
        phone: user?.phone ?? '',
        active: user?.active ?? true,
        areaCodes: user?.areaCodes ?? [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const role = form.watch('role');
  const pending = create.isPending || update.isPending;

  const onSubmit = (v: UserFormValues) => {
    const handlers = {
      onSuccess: () => {
        toast.success(t('common:save'));
        onOpenChange(false);
      },
      onError: (e: unknown) => {
        if (!applyServerFieldErrors(e, form.setError, FIELD_MAP)) toast.error(t('common:save'));
      },
    };
    if (isEdit) {
      update.mutate(
        {
          id: user.id,
          input: {
            role: v.role,
            active: v.active,
            displayName: v.displayName || undefined,
            phone: v.phone || undefined,
            areaCodes: v.areaCodes,
            password: v.password || undefined,
          },
        },
        handlers,
      );
    } else {
      create.mutate(
        {
          email: v.email,
          password: v.password,
          role: v.role,
          displayName: v.displayName || undefined,
          phone: v.phone || undefined,
          areaCodes: v.areaCodes,
        },
        handlers,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('common:edit') : t('admin:newUser')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth:email')}</FormLabel>
                  <FormControl>
                    <Input type="email" disabled={isEdit} readOnly={isEdit} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth:password')}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  {isEdit && <FormDescription>{t('admin:passwordKeep')}</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin:role')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">{t('admin:roles.admin')}</SelectItem>
                      <SelectItem value="agent">{t('admin:roles.agent')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin:name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {role === 'agent' && (
              <FormField
                control={form.control}
                name="areaCodes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin:areaCodes')}</FormLabel>
                    <AreaCodesMultiSelect value={field.value} onChange={field.onChange} />
                    <FormDescription>{t('admin:areaCodesReplace')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isEdit && (
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(c) => field.onChange(c === true)}
                      />
                      {t('common:active')}
                    </label>
                  </FormItem>
                )}
              />
            )}

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
