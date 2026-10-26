import { zodResolver } from '@hookform/resolvers/zod';
import type { UserRole } from '@rustrak/client';
import { Button, Input, NewIcon } from '@rustrak/ui';
import { useId, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import { z } from 'zod';
import { createInvitation } from '@/features/user/api/mutations';
import { copyToClipboard } from '@/shared/lib/clipboard';
import { applyServerFieldErrors } from '@/shared/lib/form-errors';
import { SettingRow, SettingSection } from '@/shared/ui/components/setting-row';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from '@/shared/ui/components/shadcn/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/components/shadcn/select';
import { useRouter } from '@/shared/ui/hooks/use-router';

const inviteSchema = z.object({
  email: z.email('Please enter a valid email address'),
  role: z.enum(['admin', 'member']),
});

type InviteFormData = z.infer<typeof inviteSchema>;

/**
 * A section of two rows, with the submit button beside its heading. The
 * button sits outside the `<form>` and joins it through the `form`
 * attribute, so Enter in the email field still submits.
 */
export function InviteForm() {
  const router = useRouter();
  const t = useTranslations('user');
  const formId = useId();

  const globalT = useTranslations();
  const [isPending, startTransition] = useTransition();

  const onSubmit = (data: InviteFormData) => {
    startTransition(async () => {
      const result = await createInvitation({
        email: data.email,
        role: data.role as UserRole,
      });

      if (!result.success) {
        // An address that already has an account, or already has a pending
        // invite, comes back as a `conflict` naming `email`. That belongs on
        // the email input, where the fix is.
        const applied = applyServerFieldErrors(form, result.error, {
          labels: {
            email: t('invite.fieldEmail'),
            role: t('invite.roleLabel'),
          },
          t: globalT,
        });

        if (applied.formLevel) {
          toast.error(t('toast.createFailed'), {
            description: applied.formLevel,
          });
        }
        return;
      }

      const link = `${window.location.origin}/invite/${result.data.token}`;
      form.reset({ email: '', role: 'member' });
      router.refresh();

      const copied = await copyToClipboard(link);
      if (copied) {
        toast.success(t('toast.created'), {
          description: t('toast.createdHint'),
        });
      } else {
        // Couldn't auto-copy (e.g. plain HTTP). Surface the link so it isn't lost;
        // it's also re-copyable from the pending invitations list below.
        toast.success(t('toast.created'), {
          description: t('toast.copyInviteLink', { link }),
        });
      }
    });
  };

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'member',
    },
  });

  return (
    <SettingSection
      title={t('invite.title')}
      description={t('invite.description')}
      actions={
        <Button
          type="submit"
          form={formId}
          variant="primary"
          icon={NewIcon}
          loading={isPending}
        >
          {isPending ? t('invite.inviting') : t('invite.submit')}
        </Button>
      }
    >
      <Form {...form}>
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
          <SettingRow title={t('invite.emailLabel')}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">
                    {t('invite.emailLabel')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@company.com"
                      autoComplete="off"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingRow>

          <SettingRow title={t('invite.roleLabel')}>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      if (value) field.onChange(value);
                    }}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger
                        className="w-full"
                        aria-label={t('invite.roleAria')}
                      >
                        <SelectValue>
                          {(value) =>
                            t(
                              value === 'admin'
                                ? 'roles.admin'
                                : 'roles.member',
                            )
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="member">
                        {t('roles.member')}
                      </SelectItem>
                      <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingRow>
        </form>
        {/* Where a failure that named no field of this form lands. */}
        <FormRootError className="px-5 pb-4" />
      </Form>
    </SettingSection>
  );
}
