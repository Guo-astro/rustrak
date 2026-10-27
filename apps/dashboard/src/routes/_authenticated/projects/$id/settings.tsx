import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { ProjectSettingsMobileNav } from './settings/-components/settings-mobile-nav';
import { ProjectSettingsNav } from './settings/-components/settings-nav';

export const Route = createFileRoute('/_authenticated/projects/$id/settings')({
  component: ProjectSettingsLayout,
});

function ProjectSettingsLayout() {
  const t = useTranslations('settings');
  const { id } = Route.useParams();
  const projectId = Number.parseInt(id, 10);

  return (
    // Same shape as `/settings`: the nav stays put, the content column scrolls.
    <div className="flex h-full w-full flex-col">
      <div className="z-30 flex items-center gap-3 border-b bg-background px-4 py-3 md:hidden">
        <ProjectSettingsMobileNav projectId={projectId} />
        <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          {t('nav.projectSettingsTitle')}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-border p-6 md:flex">
          <h2 className="mb-4 px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('nav.projectSettingsTitle')}
          </h2>
          <ProjectSettingsNav projectId={projectId} />
        </aside>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
