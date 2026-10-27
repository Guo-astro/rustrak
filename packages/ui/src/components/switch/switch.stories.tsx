import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Text } from '../text/text';
import { Switch } from './switch';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  args: { 'aria-label': 'Store logs', onCheckedChange: fn() },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every state side by side, which is what reveals a drifted track or thumb. */
export const States: Story = {
  parameters: { controls: { disable: true }, layout: 'padded' },
  render: () => (
    <div className="flex items-center gap-6">
      {(
        [
          ['off', {}],
          ['on', { defaultChecked: true }],
          ['disabled', { disabled: true }],
          ['locked on', { disabled: true, defaultChecked: true }],
        ] as const
      ).map(([label, props]) => (
        <div key={label} className="flex items-center gap-2">
          <Switch aria-label={label} {...props} />
          <Text variant="meta">{label}</Text>
        </div>
      ))}
    </div>
  ),
};

/** Space flips it from the keyboard, and it says so to a screen reader. */
export const FlipsFromTheKeyboard: Story = {
  play: async ({ args, canvasElement }) => {
    const control = within(canvasElement).getByRole('switch', {
      name: 'Store logs',
    });
    await expect(control).toHaveAttribute('aria-checked', 'false');

    await userEvent.tab();
    await userEvent.keyboard(' ');

    await expect(control).toHaveAttribute('aria-checked', 'true');
    await expect(args.onCheckedChange).toHaveBeenCalledOnce();
  },
};

/** A locked switch cannot be flipped: Issues is always on. */
export const LockedStaysPut: Story = {
  args: { disabled: true, defaultChecked: true, 'aria-label': 'Issues' },
  play: async ({ args, canvasElement }) => {
    const control = within(canvasElement).getByRole('switch', {
      name: 'Issues',
    });

    await userEvent.click(control);

    await expect(control).toHaveAttribute('aria-checked', 'true');
    await expect(args.onCheckedChange).not.toHaveBeenCalled();
  },
};
