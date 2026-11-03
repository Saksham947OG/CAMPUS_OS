import { FileText, FlaskConical, TestTube, User, type LucideIcon } from 'lucide-react'
import type { DataMode } from '@/domain/provenance'

export type ShownMode = Exclude<DataMode, 'connected'>

export const dataModeInfo: Record<
  ShownMode,
  { label: string; icon: LucideIcon; tone: string; meaning: string }
> = {
  provided: {
    label: 'Supplied',
    icon: FileText,
    tone: 'bg-surface',
    meaning:
      'Taken from a document the project owner supplied. Supplied does not mean official: it can still be tentative or out of date.',
  },
  demoSeed: {
    label: 'Illustrative',
    icon: FlaskConical,
    tone: 'bg-terracotta-tint',
    meaning:
      'An illustrative entry fills a missing detail or supports a planning scenario. It is not a verified campus fact.',
  },
  userCreated: {
    label: 'Personal',
    icon: User,
    tone: 'bg-teal-tint',
    meaning: 'Created by you in this browser. It exists on this device only.',
  },
  simulated: {
    label: 'Local activity',
    icon: TestTube,
    tone: 'bg-mist',
    meaning: 'The result of a visible action. Nothing outside this app acted on it.',
  },
}
