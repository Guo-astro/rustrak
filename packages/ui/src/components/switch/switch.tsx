import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { focusRing } from '../../lib/focus';
import { interactiveTransition, pressScaleSmall } from '../../lib/motion';
import { tv } from '../../lib/tv';

/**
 * An on/off setting that takes effect the moment it is flipped.
 *
 * Not a checkbox. A checkbox is a choice collected for a form that is
 * submitted later; a switch is the setting itself, already applied. The
 * product uses it where the change is live -- a project's products, an alert
 * rule -- and nowhere a Save button follows.
 *
 * On is the lime track with an ink thumb, the same pair as the primary button.
 * The thumb slides with `translate`, which Tailwind 4 writes as the individual
 * property, so that is the property named in the transition.
 */
const switchStyles = tv({
  slots: {
    root: [
      'relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-pill',
      'bg-border-strong',
      'data-checked:bg-surface-brand',
      'data-disabled:opacity-50',
      interactiveTransition,
      pressScaleSmall,
      focusRing,
    ],
    thumb: [
      'block size-3.5 translate-x-0.5 rounded-pill bg-fg-secondary shadow-raised',
      'data-checked:translate-x-4 data-checked:bg-fg-on-brand',
      'transition-[translate,background-color] duration-fast ease-standard',
      'motion-reduce:transition-none',
    ],
  },
});

const styles = switchStyles();

export interface SwitchProps extends Omit<BaseSwitch.Root.Props, 'className'> {
  /**
   * What it turns on. Required unless a visible `<label>` names it: the
   * switch carries no text of its own.
   */
  'aria-label'?: string;
  className?: string;
}

export function Switch({ className, ...props }: SwitchProps) {
  return (
    <BaseSwitch.Root className={styles.root({ className })} {...props}>
      <BaseSwitch.Thumb className={styles.thumb()} />
    </BaseSwitch.Root>
  );
}

Switch.displayName = 'Switch';
