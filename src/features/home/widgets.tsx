import type { ReactNode } from 'react'
import type { HomeWidgetId } from '@/data/prefs/home-prefs'
import { DeadlineWidget, QuickActionsWidget, UpNextWidget } from './core-widgets'
import {
  ActivityWidget,
  CampusPulseWidget,
  FreePocketsWidget,
  MessPreviewWidget,
  MyTasksWidget,
  TimeTaxWidget,
} from './more-widgets'
import type { HomeCtx } from './home-context'
import { ScheduleWidget } from './schedule-widget'

export interface WidgetDef {
  /** Human name used by the customize panel and live announcements. */
  title: string
  render: (ctx: HomeCtx) => ReactNode
}

/** Stable widget IDs (COS-HOME-001 §5) mapped to their implementation. */
export const homeWidgets: Partial<Record<HomeWidgetId, WidgetDef>> = {
  schedule: { title: 'Your schedule', render: (ctx) => <ScheduleWidget ctx={ctx} /> },
  upNext: { title: 'Up next', render: (ctx) => <UpNextWidget ctx={ctx} /> },
  deadlines: { title: 'Deadline focus', render: (ctx) => <DeadlineWidget ctx={ctx} /> },
  quickActions: { title: 'Quick actions', render: (ctx) => <QuickActionsWidget ctx={ctx} /> },
  activity: { title: 'My activity', render: (ctx) => <ActivityWidget ctx={ctx} /> },
  messPreview: { title: 'Mess preview', render: (ctx) => <MessPreviewWidget ctx={ctx} /> },
  myTasks: { title: 'My tasks', render: (ctx) => <MyTasksWidget ctx={ctx} /> },
  freePockets: { title: 'My Free Pockets', render: (ctx) => <FreePocketsWidget ctx={ctx} /> },
  campusPulse: { title: 'Campus Pulse', render: (ctx) => <CampusPulseWidget ctx={ctx} /> },
  timeTax: { title: 'Time Tax snapshot', render: (ctx) => <TimeTaxWidget ctx={ctx} /> },
}
