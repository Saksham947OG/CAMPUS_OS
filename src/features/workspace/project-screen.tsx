import { Link, useParams, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Tabs } from '@/components/tabs'
import { roleOf } from '@/domain/workspace-access'
import { ActivityTab, DecisionsTab, DocsTab, FilesTab, OverviewTab } from './project-tabs'
import { TasksTab } from './task-board'
import { CalendarTab } from './team-calendar'
import { useWorkspace } from './use-workspace'
import { WorkspaceShell } from './workspace-shell'
import { Pill, RolePill } from './ws-ui'

const TAB_IDS = ['overview', 'tasks', 'calendar', 'docs', 'decisions', 'files', 'activity'] as const
type TabId = (typeof TAB_IDS)[number]

export function ProjectScreen() {
  const { projectId: id = '' } = useParams()
  return (
    <WorkspaceShell>
      <Project id={id} />
    </WorkspaceShell>
  )
}

function Project({ id }: { id: string }) {
  const w = useWorkspace()
  const [params, setParams] = useSearchParams()
  const project = w.ws.projects.find((p) => p.id === id)
  const role = project ? roleOf(w.ws, project.spaceId, w.actor) : null
  if (!project || !role)
    return (
      <article>
        <PageHeader
          title="Project not available"
          description="This project does not exist, or you are not in its space."
        />
        <Link to="/workspace" className="font-medium underline">
          Back to Workspace
        </Link>
      </article>
    )
  const asked = params.get('tab')
  const tab: TabId = (TAB_IDS as readonly string[]).includes(asked ?? '')
    ? (asked as TabId)
    : 'overview'
  const space = w.ws.spaces.find((s) => s.id === project.spaceId)
  return (
    <article className="max-w-6xl">
      <PageHeader
        title={project.title}
        description={project.purpose}
        badge={
          <span className="flex items-center gap-2">
            <RolePill role={role} />
            {w.ws.members.some(
              (m) => m.spaceId === project.spaceId && w.ws.people.some((p) => p.id === m.userId),
            ) ? (
              <Pill tone="warn">Fictional team</Pill>
            ) : null}
          </span>
        }
      />
      <p className="-mt-4 mb-4 text-sm text-ink-muted">
        In space{' '}
        <Link to={`/workspace/spaces/${project.spaceId}`} className="underline">
          {space?.title}
        </Link>
      </p>
      <Tabs
        label="Project"
        idPrefix="prj"
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { id: 'overview', label: 'Overview', content: <OverviewTab w={w} project={project} /> },
          { id: 'tasks', label: 'Tasks', content: <TasksTab w={w} project={project} /> },
          { id: 'calendar', label: 'Calendar', content: <CalendarTab w={w} project={project} /> },
          { id: 'docs', label: 'Docs & Notes', content: <DocsTab w={w} project={project} /> },
          {
            id: 'decisions',
            label: 'Decisions',
            content: <DecisionsTab w={w} project={project} />,
          },
          { id: 'files', label: 'Files', content: <FilesTab w={w} project={project} /> },
          { id: 'activity', label: 'Activity', content: <ActivityTab w={w} project={project} /> },
        ]}
      />
    </article>
  )
}
