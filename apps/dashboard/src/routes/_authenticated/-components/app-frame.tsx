import type { UserResponse } from '@rustrak/client';
import {
  AgentsIcon,
  Breadcrumbs,
  CronsIcon,
  type Crumb,
  cn,
  DocsIcon,
  FeedbackIcon,
  type IconComponent,
  IssuesIcon,
  LogsIcon,
  Menu,
  type MenuAction,
  NewIcon,
  NotificationIcon,
  OverviewIcon,
  PerformanceIcon,
  ProjectsIcon,
  ReleasesIcon,
  SettingsIcon,
  Sidebar,
  SidebarBrand,
  SidebarGroup,
  SidebarItem,
  SidebarProject,
  SidebarScope,
  SidebarSearch,
  SidebarUser,
  SignOutIcon,
  scopeEnter,
  TeamIcon,
} from '@rustrak/ui';
import { useMatch } from '@tanstack/react-router';
import { PlatformIcon } from 'platformicons';
import { useTransition } from 'react';
import { useTranslations } from 'use-intl';
import { getProjects } from '@/features/project/api/queries';
import { toCommandProjects } from '@/features/project/lib/command-items';
import { logout } from '@/features/user/api/mutations';
import { COMMAND_BAR_PROJECT_LIMIT } from '@/shared/config/commands';
import { CommandBar } from '@/shared/ui/components/command-bar/command-bar';
import { Link } from '@/shared/ui/components/link';
import { useAsync } from '@/shared/ui/hooks/use-async';
import { usePathname } from '@/shared/ui/hooks/use-pathname';
import { useRouter } from '@/shared/ui/hooks/use-router';

/**
 * The frame every authenticated screen sits in: the sidebar, and the trail at
 * the top of the sheet.
 *
 * It is assembled here rather than in a feature because it spans several: the
 * project switcher is `project`, the account is `user`, and the command bar is
 * both plus the static settings routes.
 *
 * The sidebar has two modes and the URL picks between them. Inside a project
 * (`/projects/$id/**`) it holds that project's routes; anywhere else it holds
 * the workspace, which is the list of projects and settings.
 */

const DOCS_URL = 'https://rustrak.dev';

/** How many projects the workspace sidebar lists under its heading. */
const SIDEBAR_PROJECTS = 5;

interface FrameProject {
  id: number;
  name: string;
  slug: string;
  platform: string | null;
}

type NavKey =
  | 'overview'
  | 'issues'
  | 'feedback'
  | 'releases'
  | 'performance'
  | 'logs'
  | 'crons'
  | 'alerts'
  | 'agents';

interface NavRoute {
  key: NavKey;
  icon: IconComponent;
  /** Appended to `/projects/$id`. */
  path: string;
}

const OVERVIEW: NavRoute = { key: 'overview', icon: OverviewIcon, path: '' };

const GROUPS: { label: 'groupTriage' | 'groupMonitor'; routes: NavRoute[] }[] =
  [
    {
      label: 'groupTriage',
      routes: [
        { key: 'issues', icon: IssuesIcon, path: '/issues' },
        { key: 'feedback', icon: FeedbackIcon, path: '/feedback' },
        { key: 'releases', icon: ReleasesIcon, path: '/releases' },
      ],
    },
    {
      label: 'groupMonitor',
      routes: [
        { key: 'performance', icon: PerformanceIcon, path: '/performance' },
        { key: 'logs', icon: LogsIcon, path: '/logs' },
        { key: 'crons', icon: CronsIcon, path: '/crons' },
        // Rules live with the project's settings for now; the route is here
        // because alerts are something you monitor, not something you set once.
        { key: 'alerts', icon: NotificationIcon, path: '/settings/alerts' },
        { key: 'agents', icon: AgentsIcon, path: '/agents' },
      ],
    },
  ];

const ROUTES = [OVERVIEW, ...GROUPS.flatMap((group) => group.routes)];

/** The route the URL is in. Overview only on its exact path. */
function activeRoute(pathname: string, base: string): NavRoute | undefined {
  return ROUTES.find((route) =>
    route.path === ''
      ? pathname === base || pathname === `${base}/`
      : pathname.startsWith(`${base}${route.path}`),
  );
}

/** The project the URL is in, from the project layout's loader. */
function useCurrentProject(): FrameProject | null {
  const t = useTranslations('projects');
  const match = useMatch({
    from: '/_authenticated/projects/$id',
    shouldThrow: false,
  });

  if (!match) return null;

  const read = match.loaderData?.project;
  if (read?.success) return read.data;

  // The layout renders the chrome around whatever the page does with its own
  // failure, so an unreadable project is an honest placeholder, not an error.
  return {
    id: Number.parseInt(match.params.id, 10),
    name: t('switcher.fallback'),
    slug: '',
    platform: null,
  };
}

/** The project's platform logo, the same one the projects list shows. */
function ProjectLogo({
  project,
  size,
}: {
  project: FrameProject;
  size: 18 | 26;
}) {
  return (
    <PlatformIcon
      platform={project.platform ?? 'other'}
      size={size}
      format="lg"
      // An 18 px logo in a row built for 16 px icons: without `max-w-none`
      // the collapsed rail's 16 px content box squeezes it, and the negative
      // margin keeps its footprint at 16 so it lines up with the icons.
      className={cn('shrink-0 rounded-md', size === 18 && 'max-w-none -mx-px')}
    />
  );
}

export function AppSidebar({ user }: { user: UserResponse }) {
  const t = useTranslations('projects');
  const tUser = useTranslations('user');
  const tCommands = useTranslations('commands');
  const tSettings = useTranslations('settings');
  const pathname = usePathname();
  const router = useRouter();
  const project = useCurrentProject();
  const [signingOut, startSignOut] = useTransition();

  // One read for the switcher and the command bar. A failed or pending read
  // still renders both: the static commands are the bulk of the bar, and an
  // empty switcher still leads to "All projects".
  const read = useAsync(
    () => getProjects({ per_page: COMMAND_BAR_PROJECT_LIMIT }),
    [],
  );
  const projects =
    read.state === 'ready' && read.data.success ? read.data.data.items : [];

  const base = project ? `/projects/${project.id}` : '';
  const active = project ? activeRoute(pathname, base) : undefined;
  const settingsHref = project ? `${base}/settings` : '/settings';
  const inSettings =
    pathname.startsWith(settingsHref) &&
    active == null &&
    !pathname.startsWith('/settings/team');
  const scope = project ? `project:${project.id}` : 'workspace';
  const depth = project ? 1 : 0;

  const switcher: MenuAction[] = [
    {
      id: 'all',
      label: t('switcher.all'),
      icon: ProjectsIcon,
      onSelect: () => router.push('/projects'),
    },
    ...projects.map((option, index) => ({
      id: String(option.id),
      label: option.name,
      leading: <ProjectLogo project={option} size={18} />,
      selected: option.id === project?.id,
      separated: index === 0,
      onSelect: () => router.push(`/projects/${option.id}`),
    })),
    {
      id: 'new',
      label: t('switcher.new'),
      icon: NewIcon,
      separated: true,
      onSelect: () => router.push('/projects/new'),
    },
  ];

  const signOut = () =>
    startSignOut(async () => {
      await logout();
      router.push('/login');
    });

  return (
    <Sidebar
      header={
        <>
          <SidebarBrand render={<Link href="/projects" />} />
          {/* The project card exists only inside a project: above them all
              there is nothing to switch, and "All projects" in a card would
              be a second way of saying the page you are on. It arrives with
              the routes, as the first row of the same entrance. */}
          <SidebarScope scope={scope} depth={depth}>
            {project ? (
              <Menu
                trigger={
                  <SidebarProject
                    name={project.name}
                    detail={project.slug}
                    tile={<ProjectLogo project={project} size={26} />}
                    className={scopeEnter}
                  />
                }
                actions={switcher}
                popupClassName="w-64"
              />
            ) : null}
          </SidebarScope>
          <CommandBar
            projects={toCommandProjects(projects)}
            trigger={(open, shortcut) => (
              <SidebarSearch
                label={tCommands('triggerSearch')}
                shortcut={shortcut}
                onClick={open}
              />
            )}
          />
        </>
      }
      footer={
        <>
          <SidebarItem
            icon={SettingsIcon}
            label={t('nav.settings')}
            active={inSettings}
            render={<Link href={settingsHref} />}
          />
          <SidebarItem
            icon={DocsIcon}
            label={t('nav.docs')}
            render={
              <Link href={DOCS_URL} target="_blank" rel="noopener noreferrer" />
            }
          />
          <SidebarUser
            name={user.email}
            detail={tUser(`roles.${user.role}`)}
            actions={[
              {
                id: 'settings',
                label: tUser('header.settings'),
                icon: SettingsIcon,
                onSelect: () => router.push('/settings'),
              },
              {
                id: 'sign-out',
                label: signingOut
                  ? tUser('header.signingOut')
                  : tUser('header.signOut'),
                icon: SignOutIcon,
                tone: 'danger',
                separated: true,
                disabled: signingOut,
                onSelect: signOut,
              },
            ]}
          />
        </>
      }
    >
      {/* Workspace and project are two depths of one list: going into a
          project slides its routes in from the right, leaving it slides the
          workspace back in from the left. */}
      <SidebarScope scope={scope} depth={depth}>
        {project ? (
          <>
            <SidebarItem
              icon={OVERVIEW.icon}
              label={t('nav.overview')}
              active={active === OVERVIEW}
              render={<Link href={base} />}
            />
            {GROUPS.map((group) => (
              <SidebarGroup key={group.label} label={t(`nav.${group.label}`)}>
                {group.routes.map((route) => (
                  <SidebarItem
                    key={route.key}
                    icon={route.icon}
                    label={t(`nav.${route.key}`)}
                    active={active === route}
                    render={<Link href={`${base}${route.path}`} />}
                  />
                ))}
              </SidebarGroup>
            ))}
          </>
        ) : (
          <>
            <SidebarItem
              icon={ProjectsIcon}
              label={t('switcher.all')}
              active={pathname === '/projects'}
              render={<Link href="/projects" />}
            />
            <SidebarItem
              icon={TeamIcon}
              label={tSettings('nav.team')}
              active={pathname.startsWith('/settings/team')}
              render={<Link href="/settings/team" />}
            />
            {projects.length > 0 ? (
              <SidebarGroup label={t('switcher.projects')}>
                {/* ponytail: the first few, until settings lets the reader
                    choose which ones are pinned here. */}
                {projects.slice(0, SIDEBAR_PROJECTS).map((option) => (
                  <SidebarItem
                    key={option.id}
                    leading={<ProjectLogo project={option} size={18} />}
                    label={option.name}
                    render={<Link href={`/projects/${option.id}`} />}
                  />
                ))}
              </SidebarGroup>
            ) : null}
          </>
        )}
      </SidebarScope>
    </Sidebar>
  );
}

/** Where you are, at the top of the sheet. */
export function AppBreadcrumbs() {
  const t = useTranslations('projects');
  const tSettings = useTranslations('settings');
  const pathname = usePathname();
  const project = useCurrentProject();

  let items: Crumb[];

  if (project) {
    const base = `/projects/${project.id}`;
    const route = activeRoute(pathname, base);
    items = [
      {
        label: project.name,
        icon: <ProjectLogo project={project} size={18} />,
        render: <Link href={base} />,
      },
      {
        label: route
          ? t(`nav.${route.key}`)
          : tSettings('nav.projectSettingsTitle'),
      },
    ];
  } else if (pathname.startsWith('/settings')) {
    items = [{ label: tSettings('nav.settingsTitle') }];
  } else if (pathname.startsWith('/projects/new')) {
    items = [
      { label: t('switcher.projects'), render: <Link href="/projects" /> },
      { label: t('switcher.new') },
    ];
  } else {
    items = [{ label: t('switcher.projects') }];
  }

  return <Breadcrumbs items={items} />;
}
