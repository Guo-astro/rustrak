import { zodResolver } from '@hookform/resolvers/zod';
import type {
  AlertIntegration,
  AlertRuleResponse,
  AlertType,
} from '@rustrak/client';
import { Button, cn, Input, TestIcon, Text } from '@rustrak/ui';
import { type ReactNode, useMemo, useTransition } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';
import {
  createAlertRule,
  testIntegration,
  updateAlertRule,
} from '@/features/alert/api/mutations';
import { buildChannelsPayload } from '@/features/alert/lib/routing';
import {
  type AlertRuleFormData,
  alertRuleFormSchema,
} from '@/features/alert/model/alert-rule-form';
import { alertTypes } from '@/features/alert/model/alert-types';
import {
  COOLDOWN_PRESETS,
  cooldownUnit,
  DEFAULT_COOLDOWN,
} from '@/features/alert/model/rule-summary';
import { useChannelRouting } from '@/features/alert/ui/hooks/use-channel-routing';
import { applyServerFieldErrors } from '@/shared/lib/form-errors';
import {
  conditionsFromForm,
  formFromConditions,
  levels,
} from '@/shared/lib/rule-conditions';
import { Link } from '@/shared/ui/components/link';
import { RuleSentence } from '../rule-sentence';
import { ChannelPicker } from './channel-picker/channel-picker';

/**
 * One alert's form, the whole screen: a line per question -- what it is
 * called, what it fires on, which environments and levels count, whom it
 * tells, how often at most -- and in the rail the sentence it adds up to,
 * beside the save button, so what is saved is never a surprise.
 */
export function RuleEditor({
  projectId,
  rule,
  initialType,
  integrations,
  environments,
  onSaved,
  onCancel,
}: {
  projectId: number;
  rule: AlertRuleResponse | null;
  /** The trigger a new alert starts on. */
  initialType: AlertType;
  integrations: AlertIntegration[];
  /** The project's environments, offered as choices. */
  environments: string[];
  onSaved: (rule: AlertRuleResponse) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('alerts');
  const globalT = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [isTesting, startTest] = useTransition();
  const routing = useChannelRouting(rule, integrations);
  const schema = useMemo(() => alertRuleFormSchema(t), [t]);
  const form = useForm<AlertRuleFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: rule?.name ?? '',
      alert_type: rule?.alert_type ?? initialType,
      selected_integration_ids: rule?.integration_ids ?? [],
      is_enabled: rule?.is_enabled ?? true,
      cooldown_minutes: rule?.cooldown_minutes ?? DEFAULT_COOLDOWN,
      ...formFromConditions(rule?.conditions ?? {}),
    },
  });

  const values = form.watch();
  const chosenEnvs = values.environments
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  const envOptions = [...new Set([...environments, ...chosenEnvs])];
  const channelNames = integrations
    .filter((i) => values.selected_integration_ids.includes(i.id))
    .map((i) => i.name);
  const dirty = { shouldDirty: true } as const;
  const setEnvs = (next: string[]) =>
    form.setValue('environments', next.join(', '), dirty);

  const onSubmit = (data: AlertRuleFormData) => {
    if (!routing.validate(data.selected_integration_ids)) return;
    if (data.selected_integration_ids.length === 0) {
      form.setError('selected_integration_ids', {
        message: t('ruleDialog.selectAtLeastOne'),
      });
      return;
    }
    startTransition(async () => {
      const body = {
        name: data.name,
        alert_type: data.alert_type,
        channels: buildChannelsPayload(
          data.selected_integration_ids,
          routing.routingMap,
          integrations,
        ),
        cooldown_minutes: data.cooldown_minutes,
        conditions: conditionsFromForm(data),
      };
      const result = rule
        ? await updateAlertRule(projectId, rule.id, body)
        : await createAlertRule(projectId, body);
      if (!result.success) {
        const applied = applyServerFieldErrors(form, result.error, {
          labels: { name: t('common.fieldName') },
          t: globalT,
        });
        if (applied.formLevel) {
          toast.error(t('ruleDialog.saveFailed'), {
            description: applied.formLevel,
          });
        }
        return;
      }
      toast.success(t(rule ? 'ruleDialog.updated' : 'ruleDialog.created'));
      onSaved(result.data);
    });
  };

  // A test sends through every chosen channel, routed as the rule would.
  const sendTest = () =>
    startTest(async () => {
      const chosen = integrations.filter((i) =>
        values.selected_integration_ids.includes(i.id),
      );
      for (const integration of chosen) {
        const result = await testIntegration(
          integration.id,
          routing.routingMap[integration.id],
        );
        if (result.success && result.data.success) {
          toast.success(t('editor.testSent', { channel: integration.name }));
        } else {
          toast.error(t('editor.testFailed', { channel: integration.name }), {
            description: result.success
              ? result.data.message
              : result.error.message,
          });
        }
      }
    });

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 max-lg:flex-col max-lg:overflow-y-auto"
      >
        <div className="flex min-w-0 flex-1 flex-col divide-y divide-border-divider lg:overflow-y-auto">
          <Row label={t('editor.name')}>
            <Input
              placeholder={t('editor.namePlaceholder')}
              invalid={Boolean(form.formState.errors.name)}
              {...form.register('name')}
            />
            {form.formState.errors.name ? (
              <span className="text-sev-error-fg text-meta">
                {form.formState.errors.name.message}
              </span>
            ) : null}
          </Row>

          <Row label={t('editor.when')}>
            <div className="grid gap-2 sm:grid-cols-2">
              {alertTypes.map(({ type }) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={values.alert_type === type}
                  onClick={() => form.setValue('alert_type', type, dirty)}
                  className={cn(
                    'flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-surface-hover',
                    values.alert_type === type
                      ? 'border-border-brand bg-success-surface'
                      : 'border-border',
                  )}
                >
                  <span className="font-medium text-body text-fg">
                    {t(`types.${type}.name`)}
                  </span>
                  <span className="text-fg-subtle text-hint">
                    {t(`types.${type}.description`)}
                  </span>
                </button>
              ))}
            </div>
          </Row>

          <Row
            label={t('editor.environments')}
            hint={t('editor.environmentsHint')}
          >
            <div className="flex flex-wrap gap-1.5">
              <Chip
                selected={chosenEnvs.length === 0}
                onClick={() => setEnvs([])}
              >
                {t('editor.allEnvironments')}
              </Chip>
              {envOptions.map((env) => (
                <Chip
                  key={env}
                  mono
                  selected={chosenEnvs.includes(env)}
                  onClick={() =>
                    setEnvs(
                      chosenEnvs.includes(env)
                        ? chosenEnvs.filter((e) => e !== env)
                        : [...chosenEnvs, env],
                    )
                  }
                >
                  {env}
                </Chip>
              ))}
            </div>
          </Row>

          {values.alert_type === 'new_feedback' ? null : (
            <Row label={t('editor.level')}>
              <div className="flex flex-wrap gap-1.5">
                {(['any', ...levels] as const).map((level) => (
                  <Chip
                    key={level}
                    selected={values.min_level === level}
                    onClick={() => form.setValue('min_level', level, dirty)}
                  >
                    {level === 'any'
                      ? t('editor.anyLevel')
                      : t('editor.levelOrHigher', { level })}
                  </Chip>
                ))}
              </div>
            </Row>
          )}

          {values.alert_type === 'new_issue' ? (
            <Row label={t('editor.minEvents')} hint={t('editor.minEventsHint')}>
              <Input
                type="number"
                min={1}
                boxClassName="w-28"
                {...form.register('min_events', { valueAsNumber: true })}
              />
            </Row>
          ) : null}

          <Row
            label={t('editor.notify')}
            hint={t.rich('editor.notifyHint', {
              link: (chunks) => (
                <Link
                  href={`/settings/integrations?projectId=${projectId}`}
                  className="text-fg-secondary underline hover:text-fg"
                >
                  {chunks}
                </Link>
              ),
            })}
          >
            {integrations.length === 0 ? (
              <Text variant="meta" tone="subtle">
                {t('editor.noChannels')}
              </Text>
            ) : (
              <ChannelPicker
                integrations={integrations}
                routing={routing}
                disabled={isPending}
              />
            )}
          </Row>

          <Row label={t('editor.frequency')} hint={t('editor.frequencyHint')}>
            <div className="flex flex-wrap items-center gap-1.5">
              {COOLDOWN_PRESETS.map((minutes) => {
                const unit = cooldownUnit(minutes);
                return (
                  <Chip
                    key={minutes}
                    selected={values.cooldown_minutes === minutes}
                    onClick={() =>
                      form.setValue('cooldown_minutes', minutes, dirty)
                    }
                  >
                    {unit
                      ? t(`editor.every.${unit.unit}`, { count: unit.value })
                      : t('editor.everyTime')}
                  </Chip>
                );
              })}
              <Input
                type="number"
                min={0}
                aria-label={t('editor.customMinutes')}
                boxClassName="w-28"
                action={
                  <span className="pe-2 text-fg-subtle text-meta">min</span>
                }
                {...form.register('cooldown_minutes', { valueAsNumber: true })}
              />
            </div>
          </Row>
        </div>

        {/* The rail: the sentence the form adds up to, and what to do with it. */}
        <aside className="flex flex-col gap-4 border-border-divider bg-panel px-5 py-5 max-lg:border-t lg:w-88 lg:shrink-0 lg:border-l xl:w-96">
          <h2 className="font-mono text-column text-fg-meta uppercase">
            {t('editor.summary')}
          </h2>
          <p className="text-body text-fg-secondary leading-relaxed">
            <RuleSentence
              rule={{
                type: values.alert_type,
                environments: chosenEnvs,
                minLevel: values.min_level,
                minEvents: values.min_events,
                cooldownMinutes: values.cooldown_minutes,
                channels: channelNames,
              }}
            />
          </p>
          <div className="flex flex-col gap-2 border-border-divider border-t pt-4">
            <Button type="submit" variant="primary" loading={isPending}>
              {t(rule ? 'ruleDialog.saveChanges' : 'editor.create')}
            </Button>
            <Button
              icon={TestIcon}
              loading={isTesting}
              disabled={values.selected_integration_ids.length === 0}
              onClick={sendTest}
            >
              {t('editor.test')}
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
          </div>
        </aside>
      </form>
    </FormProvider>
  );
}

/** One question of the form: its label on the left, its answer on the right. */
function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 px-page-gutter py-5 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8">
      <div className="flex flex-col gap-0.5 pt-1">
        <span className="font-medium text-body text-fg">{label}</span>
        {hint ? <span className="text-fg-subtle text-hint">{hint}</span> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </div>
  );
}

/** One option of a choice, pressed or not. */
function Chip({
  selected,
  mono,
  onClick,
  children,
}: {
  selected: boolean;
  mono?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      size="sm"
      variant={selected ? 'secondary' : 'ghost'}
      selected={selected}
      onClick={onClick}
      className={cn(mono && 'font-mono', !selected && 'border border-border')}
    >
      {children}
    </Button>
  );
}
