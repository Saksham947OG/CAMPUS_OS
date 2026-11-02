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
    label: 'Sample data',
    icon: FlaskConical,
    tone: 'bg-terracotta-tint',
    meaning: 'Fictional data made for demonstration. It is never an institutional record.',
  },
  userCreated: {
    label: 'Personal',
    icon: User,
    tone: 'bg-teal-tint',
    meaning: 'Created by you in this browser. It exists on this device only.',
  },
  simulated: {
    label: 'Simulated',
    icon: TestTube,
    tone: 'bg-mist',
    meaning: 'The result of a visible demonstration action. Nothing outside this app acted on it.',
  },
}
