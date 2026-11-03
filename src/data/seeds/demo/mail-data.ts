import type { MailStore, SourceEmail } from '@/domain/mail'
import { isoFromMs } from '@/lib/time'

const FROM = 'bulletin@bms.invalid'

/**
 * The starting Campus Mail scenario. Every address is on a reserved `.invalid` domain, so nothing
 * here can be a real person or reach one. Each persona has its own simulated mailbox; the
 * broadcast feed stands for an authorized announcement mailbox and carries two sample notices.
 * Student keys are made up (DEMO-BMS-001/002); the third profile has none, so no seat can match it.
 */
export function initialMailStore(nowMs: number): MailStore {
  const at = (minutesAgo: number) => isoFromMs(nowMs - minutesAgo * 60_000)
  const seed = (
    id: string,
    subject: string,
    body: string,
    category: SourceEmail['category'],
    minutesAgo: number,
  ): SourceEmail => ({
    id,
    connectionId: 'conn-broadcast',
    messageId: `seed-${id}`,
    from: FROM,
    subject,
    receivedAt: at(minutesAgo),
    body,
    attachments: [],
    category,
    provenance: 'DEMO_SIMULATED',
    syncState: 'IMPORTED',
    stages: [
      {
        stage: 'received',
        status: 'done',
        note: 'Sample notice from the simulated broadcast feed.',
        at: at(minutesAgo),
      },
      {
        stage: 'classified',
        status: 'done',
        note: `Rule-based category: ${category}.`,
        at: at(minutesAgo),
      },
    ],
  })
  return {
    schemaVersion: 1,
    config: {
      trustedSenders: ['exams@bms.invalid', 'office@bms.invalid', FROM],
      urgentWithinHours: 24,
    },
    studentKeys: { 'demo-student-a': 'DEMO-BMS-001', 'demo-student-b': 'DEMO-BMS-002' },
    examIndex: { 'DEMO-OPS101 QUIZ 1': 'exam-4' },
    connections: [
      {
        id: 'conn-demo-student-a',
        ownerProfileId: 'demo-student-a',
        mode: 'PERSONAL',
        accountAlias: 'student.a@bms.invalid',
        state: 'DEMO',
      },
      {
        id: 'conn-demo-student-b',
        ownerProfileId: 'demo-student-b',
        mode: 'PERSONAL',
        accountAlias: 'demo.student.b@bms.invalid',
        state: 'DEMO',
      },
      {
        id: 'conn-demo-student-empty',
        ownerProfileId: 'demo-student-empty',
        mode: 'PERSONAL',
        accountAlias: 'demo.student.c@bms.invalid',
        state: 'DEMO',
      },
      {
        id: 'conn-broadcast',
        ownerProfileId: null,
        mode: 'AUTHORIZED_BROADCAST',
        accountAlias: 'bulletin@bms.invalid',
        state: 'DEMO',
      },
    ],
    emails: [
      seed(
        'seed-weekly',
        'BMS Weekly Update',
        'A sample weekly bulletin. Nothing in it is real.\n\nThis week: sample lecture notes, a sample reading list.',
        'ACADEMIC',
        100,
      ),
      seed(
        'seed-clubs',
        'Club Applications Open',
        'A sample announcement that club applications are open. No link is provided on this device.',
        'CLUB',
        1500,
      ),
    ],
    notices: [],
    seen: [],
    provenance: {
      dataMode: 'demoSeed',
      verification: 'unknown',
      authority: 'demoIllustration',
      sourceLabel: 'Simulated mailbox (no real account is connected)',
      updatedAt: at(0),
    },
  }
}
