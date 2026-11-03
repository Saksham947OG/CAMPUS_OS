import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { ProfileData } from '@/domain/records'
import { useMediaQuery } from '@/hooks/use-media-query'
import type { DateOnly } from '@/lib/time'
import type { PlanningPrefs } from '@/selectors/free-pockets'
import type { CalendarItem } from '@/selectors/items'
import { editorTitle, type EditorRequest } from './editor-types'
import { EventEditor } from './event-editor'
import { OccurrenceEditor } from './occurrence-editor'
import { BirthdayEditor, FocusEditor, TaskEditor } from './personal-editors'

interface Props {
  request: EditorRequest | null
  data: ProfileData
  planning: PlanningPrefs
  getItemsOn: (date: DateOnly) => CalendarItem[]
  onClose: () => void
}

/**
 * One modal editor for every personal record: right drawer on desktop, bottom sheet on mobile.
 * The form remounts per request, so each opening gets a fresh draft id (no accidental duplicates).
 */
export function EditorHost({ request, data, planning, getItemsOn, onClose }: Props) {
  const isMd = useMediaQuery('(min-width: 768px)')
  return (
    <Sheet open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMd ? 'right' : 'bottom'}
        className={
          isMd
            ? 'w-[min(28rem,100vw)] overflow-y-auto p-4'
            : 'max-h-[92dvh] overflow-y-auto rounded-t-lg p-4'
        }
      >
        <SheetHeader className="p-0 pb-3">
          <SheetTitle>{request ? editorTitle(request) : 'Editor'}</SheetTitle>
          <SheetDescription>
            Saved on this device only. Supplied and illustrative records can never be edited here.
          </SheetDescription>
        </SheetHeader>
        {request?.kind === 'event' ? (
          <EventEditor
            key={JSON.stringify(request)}
            request={request}
            planning={planning}
            getItemsOn={getItemsOn}
            onClose={onClose}
          />
        ) : null}
        {request?.kind === 'occurrence' ? (
          <OccurrenceEditor
            key={`${request.series.id}@${request.originalDate}`}
            request={request}
            data={data}
            onClose={onClose}
          />
        ) : null}
        {request?.kind === 'task' ? (
          <TaskEditor
            key={JSON.stringify(request)}
            request={request}
            data={data}
            onClose={onClose}
          />
        ) : null}
        {request?.kind === 'focus' ? (
          <FocusEditor
            key={JSON.stringify(request)}
            request={request}
            data={data}
            planning={planning}
            getItemsOn={getItemsOn}
            onClose={onClose}
          />
        ) : null}
        {request?.kind === 'birthday' ? (
          <BirthdayEditor key={JSON.stringify(request)} request={request} onClose={onClose} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
