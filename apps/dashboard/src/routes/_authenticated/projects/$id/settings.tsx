import { Page } from '@rustrak/ui';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * A project's settings pages. Like the instance's, they are listed in the
 * sidebar's settings mode -- under the project, in the Projects group -- so
 * this is only the scroller.
 */
export const Route = createFileRoute('/_authenticated/projects/$id/settings')({
  component: ProjectSettingsLayout,
});

function ProjectSettingsLayout() {
  return (
    <div className="flex h-full flex-col">
      <Page>
        <Outlet />
      </Page>
    </div>
  );
}
