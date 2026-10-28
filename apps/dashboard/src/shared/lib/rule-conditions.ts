import type { AlertRuleResponse, AlertType } from '@rustrak/client';

type Conditions = AlertRuleResponse['conditions'];

/**
 * What the server stores in `conditions`. The spec types the column as an open
 * map (a `serde_json::Value` on the server), so the known keys are named here.
 */
interface KnownConditions {
  min_level?: (typeof levels)[number];
  environments?: string[];
  min_events?: number;
}

export const levels = ['debug', 'info', 'warning', 'error', 'fatal'] as const;

/** The filters as the rule dialog edits them: plain values, no absences. */
export interface FilterFields {
  min_level: (typeof levels)[number] | 'any';
  /** Comma-separated. */
  environments: string;
  min_events: number;
}

/**
 * The conditions a rule is saved with. A filter left at its default is not
 * sent, the event count only means something for new issues, and the level
 * nothing for feedback.
 */
export function conditionsFromForm(
  form: Omit<FilterFields, 'environments'> & {
    alert_type: AlertType;
    /** A typed line splits on commas; a picked list is taken name by name. */
    environments: string | string[];
  },
): Conditions {
  const names =
    typeof form.environments === 'string'
      ? form.environments.split(',')
      : form.environments;
  const environments = names.map((e) => e.trim()).filter(Boolean);
  return {
    ...(form.min_level !== 'any' &&
      form.alert_type !== 'new_feedback' && { min_level: form.min_level }),
    ...(environments.length > 0 && { environments }),
    ...(form.alert_type === 'new_issue' &&
      form.min_events > 1 && { min_events: form.min_events }),
  };
}

/** The environments a rule is narrowed to, as stored. */
export function environmentsOf(conditions: Conditions): string[] {
  return (conditions as KnownConditions).environments ?? [];
}

export function formFromConditions(conditions: Conditions): FilterFields {
  const known = conditions as KnownConditions;
  return {
    min_level: known.min_level ?? 'any',
    environments: environmentsOf(conditions).join(', '),
    min_events: known.min_events ?? 1,
  };
}
