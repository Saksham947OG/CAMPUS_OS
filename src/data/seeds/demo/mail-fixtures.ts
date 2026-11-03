import type { Incoming } from '@/domain/mail-logic'

export const SCENARIOS = [
  'seat-v1',
  'seat-v2',
  'seat-other-student',
  'seat-no-room',
  'unlisted-sender',
  'urgent-promo',
  'attachment-only',
  'room-wide',
] as const
export type Scenario = (typeof SCENARIOS)[number]

export const scenarioLabel: Record<Scenario, string> = {
  'seat-v1': 'Receive Revised Quiz Seating Email',
  'seat-v2': 'Receive Correction Email (Column changes)',
  'seat-other-student': 'Receive notice with no row for this student',
  'seat-no-room': 'Receive notice with the room missing',
  'unlisted-sender': 'Receive notice from an unlisted sender',
  'urgent-promo': 'Receive an “URGENT!!!” promotion',
  'attachment-only': 'Receive notice with an unreadable attachment',
  'room-wide': 'Receive a room-wide notice',
}

const EXAM = 'DEMO-OPS101 Quiz 1'
const trusted = 'exams@bms.invalid'

/** Synthetic messages with stable fake ids, so replaying one is a true duplicate. */
export function fixture(s: Scenario, studentKey: string | undefined): Incoming {
  const row = (key: string, room: string | null, col: string, rowNo: string) =>
    [`Student: ${key}`, room ? `Room: ${room}` : null, `Column: ${col}`, `Row: ${rowNo}`]
      .filter(Boolean)
      .join('\n')
  const head = (rev: number) => `Exam: ${EXAM}\nStart: 15:00\nRevision: ${rev}\n`
  const key = studentKey ?? 'DEMO-BMS-000'
  switch (s) {
    case 'seat-v1':
      return {
        messageId: 'demo-msg-seat-v1',
        from: trusted,
        subject: 'Quiz Seating — Revised',
        providerRevision: '1',
        body: `${head(1)}\n${row(key, 'CR5', '2', '3')}\n`,
      }
    case 'seat-v2':
      return {
        messageId: 'demo-msg-seat-v2',
        from: trusted,
        subject: 'Quiz Seating — Correction',
        providerRevision: '2',
        body: `${head(2)}\n${row(key, 'CR5', '4', '3')}\n`,
      }
    case 'seat-other-student':
      return {
        messageId: 'demo-msg-seat-other',
        from: trusted,
        subject: 'Quiz Seating',
        body: `${head(1)}\n${row('DEMO-BMS-099', 'CR5', '1', '1')}\n`,
      }
    case 'seat-no-room':
      return {
        messageId: 'demo-msg-seat-noroom',
        from: trusted,
        subject: 'Quiz Seating — Partial',
        body: `${head(1)}\n${row(key, null, '2', '3')}\n`,
      }
    case 'unlisted-sender':
      return {
        messageId: 'demo-msg-seat-unlisted',
        from: 'someone.else@example.invalid',
        subject: 'Quiz Seating',
        body: `${head(1)}\n${row(key, 'CR9', '1', '1')}\n`,
      }
    case 'urgent-promo':
      return {
        messageId: 'demo-msg-promo',
        from: 'promo@example.invalid',
        subject: 'URGENT!!! Win a free coffee',
        body: 'Click now to win. This is a made-up promotion.',
      }
    case 'attachment-only':
      return {
        messageId: 'demo-msg-attach',
        from: trusted,
        subject: 'Quiz seating list attached',
        body: 'Please see the attached seating list for the quiz.',
        attachments: [{ name: 'seating-list.pdf', readable: false }],
      }
    case 'room-wide':
      return {
        messageId: 'demo-msg-roomwide',
        from: trusted,
        subject: 'Quiz seating by section',
        body: 'Seating for the quiz: Everyone in BMS Section B goes to CR5.',
      }
  }
}
