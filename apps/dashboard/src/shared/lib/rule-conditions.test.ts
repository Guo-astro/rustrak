import { describe, expect, it } from 'vitest';
import {
  conditionsFromForm,
  environmentsOf,
  formFromConditions,
} from './rule-conditions';

describe('conditionsFromForm', () => {
  it('saves no level for feedback, which has no level to filter on', () => {
    // A rule switched from new issues to feedback keeps the level it had in
    // the form, hidden; saved, it would reject feedback at its default `info`.
    expect(
      conditionsFromForm({
        alert_type: 'new_feedback',
        min_level: 'error',
        environments: '',
        min_events: 1,
      }),
    ).toEqual({});
  });

  it('sends nothing for filters left at their defaults', () => {
    expect(
      conditionsFromForm({
        alert_type: 'new_issue',
        min_level: 'any',
        environments: ' ',
        min_events: 1,
      }),
    ).toEqual({});
  });

  it('splits environments and keeps the count only for new issues', () => {
    const filled = {
      min_level: 'error',
      environments: 'production, staging,,',
      min_events: 10,
    } as const;
    expect(conditionsFromForm({ alert_type: 'new_issue', ...filled })).toEqual({
      min_level: 'error',
      environments: ['production', 'staging'],
      min_events: 10,
    });
    expect(conditionsFromForm({ alert_type: 'regression', ...filled })).toEqual(
      { min_level: 'error', environments: ['production', 'staging'] },
    );
  });

  it('keeps a picked environment whole, commas and all', () => {
    // The alert editor picks names rather than typing a line; a name with a
    // comma is one environment, not two.
    expect(
      conditionsFromForm({
        alert_type: 'regression',
        min_level: 'any',
        environments: ['eu,west', ' prod '],
        min_events: 1,
      }),
    ).toEqual({ environments: ['eu,west', 'prod'] });
  });
});

describe('environmentsOf', () => {
  it('reads the stored list, or none', () => {
    expect(environmentsOf({ environments: ['eu,west'] })).toEqual(['eu,west']);
    expect(environmentsOf({})).toEqual([]);
  });
});

describe('formFromConditions', () => {
  it('reads stored conditions back into the form', () => {
    expect(
      formFromConditions({
        min_level: 'warning',
        environments: ['production'],
        min_events: 5,
      }),
    ).toEqual({
      min_level: 'warning',
      environments: 'production',
      min_events: 5,
    });
    expect(formFromConditions({})).toEqual({
      min_level: 'any',
      environments: '',
      min_events: 1,
    });
  });
});
