import {
  BookOpen,
  CalendarCheck,
  Cake,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Landmark,
  ListChecks,
  Megaphone,
  PartyPopper,
  Timer,
  Trophy,
  User,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { categoryColorVar } from '@/domain/categories'
import type { EventCategory } from '@/domain/records'
import { cn } from '@/lib/utils'

const categoryIcons: Record<EventCategory, LucideIcon> = {
  class: BookOpen,
  exam: ClipboardCheck,
  assignment: FileText,
  project: FolderKanban,
  meeting: Users,
  personal: User,
  task: ListChecks,
  focus: Timer,
  booking: CalendarCheck,
  administration: Landmark,
  holiday: PartyPopper,
  birthday: Cake,
  club: UsersRound,
  campusEvent: Megaphone,
  sports: Trophy,
}

/** Category mark: icon in the category colour. Meaning is never carried by colour alone (a label always accompanies it). */
export function CategoryIcon({
  category,
  className,
}: {
  category: EventCategory
  className?: string
}) {
  const Icon = categoryIcons[category]
  return (
    <Icon
      aria-hidden="true"
      className={cn('size-4 shrink-0', className)}
      style={{ color: `var(${categoryColorVar[category]})` }}
    />
  )
}
