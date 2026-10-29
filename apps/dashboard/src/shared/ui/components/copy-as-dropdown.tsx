import { Button, CopyIcon, Menu, ResolveIcon } from '@rustrak/ui';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import { copyToClipboard } from '@/shared/lib/clipboard';

interface CopyAsFormat {
  label: string;
  /** Precomputed text, not a function — this component may be rendered from
   * a Server Component, and functions can't cross that boundary as props. */
  value: string;
}

interface CopyAsDropdownProps {
  formats: CopyAsFormat[];
}

/** "Copy as ..." dropdown for section headers (Stack Trace, Breadcrumbs). */
export function CopyAsDropdown({ formats }: CopyAsDropdownProps) {
  const t = useTranslations('common');
  const [copied, setCopied] = useState(false);

  const handleCopy = async (format: CopyAsFormat) => {
    if (!(await copyToClipboard(format.value))) {
      toast.info(t('clipboardUnavailable'), {
        description: t('clipboardUnavailableHint'),
      });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Menu
      align="end"
      actions={formats.map((format) => ({
        id: format.label,
        label: format.label,
        onSelect: () => handleCopy(format),
      }))}
      trigger={
        <Button
          variant="ghost"
          size="sm"
          icon={copied ? ResolveIcon : CopyIcon}
          menu
        >
          {t('copyAs')}
        </Button>
      }
    />
  );
}
