import type { AlertType } from '@rustrak/client';
import type { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { cooldownUnit } from '@/features/alert/model/rule-summary';
import { levels } from '@/shared/lib/rule-conditions';

export interface RuleShape {
  type: AlertType;
  environments: string[];
  minLevel: (typeof levels)[number] | 'any';
  /** New issues only: the event count that fires instead of the first. */
  minEvents: number;
  cooldownMinutes: number;
  channels: string[];
}

/**
 * A rule said in one sentence, the way a reader would: "When a new issue
 * appears in production, of level error or higher, notify #alerts-prod, at
 * most once an hour." The parts a reader set are emphasised, so the sentence
 * doubles as a summary of the choices behind it.
 */
export function RuleSentence({ rule }: { rule: RuleShape }) {
  const t = useTranslations('alerts.sentence');
  const format = useFormatter();
  const strong = (chunks: ReactNode) => (
    <strong className="font-medium text-fg">{chunks}</strong>
  );
  const list = (items: string[]) => format.list(items, { type: 'conjunction' });
  const cooldown = cooldownUnit(rule.cooldownMinutes);

  return (
    <span>
      {t.rich(`when.${rule.type}`, { strong })}
      {rule.environments.length
        ? t.rich('inEnvironments', { envs: list(rule.environments), strong })
        : null}
      {rule.minLevel !== 'any'
        ? t.rich('atLevel', { level: rule.minLevel, strong })
        : null}
      {rule.type === 'new_issue' && rule.minEvents > 1
        ? t.rich('afterEvents', { count: rule.minEvents, strong })
        : null}
      {rule.channels.length
        ? t.rich('notify', { channels: list(rule.channels), strong })
        : t.rich('notifyNobody', { strong })}
      {cooldown
        ? t.rich(`atMostOnce.${cooldown.unit}`, {
            count: cooldown.value,
            strong,
          })
        : t('everyTime')}
    </span>
  );
}
