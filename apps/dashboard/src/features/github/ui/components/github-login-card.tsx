import { Button, Input } from '@rustrak/ui';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import { setMyGitHubLogin } from '@/features/github/api/mutations';
import { SettingRow, SettingSection } from '@/shared/ui/components/setting-row';

/** The person's GitHub username, which is how assignees cross over. */
export function GitHubLoginCard({ login }: { login: string | null }) {
  const t = useTranslations('github');
  const [value, setValue] = useState(login ?? '');
  const [saved, setSaved] = useState(login ?? '');
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await setMyGitHubLogin(value.trim() || null);
      if (!result.success) {
        toast.error(t('account.saveFailed'), {
          description: result.error.message,
        });
        return;
      }
      setValue(result.data.login ?? '');
      setSaved(result.data.login ?? '');
      toast.success(t('account.saved'));
    });
  };

  return (
    <SettingSection title={t('setup.you')}>
      <SettingRow
        title={t('account.title')}
        description={t('account.description')}
        htmlFor="github-login"
      >
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input
            id="github-login"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="octocat"
            disabled={isPending}
            leading={<span className="text-fg-subtle">@</span>}
            boxClassName="min-w-0 flex-1"
          />
          <Button
            type="submit"
            variant="secondary"
            loading={isPending}
            disabled={value.trim() === saved}
          >
            {t('save')}
          </Button>
        </form>
      </SettingRow>
    </SettingSection>
  );
}
