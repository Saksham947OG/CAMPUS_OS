import { z } from 'zod'
import { provenanceSchema } from './provenance'

/**
 * Chill Spot domain (COS-CHILL-001 §11). Provenance uses the project vocabulary (DEC-016/DEC-052):
 * the spec's `verificationStatus` is our `verification`, and every record carries `authority`.
 */

const id = z.string().min(1).max(120)
const iso = z.iso.datetime({ offset: true })

export const ORDER_STATUSES = [
  'pending',
  'queued',
  'preparing',
  'ready',
  'collected',
  'rejected',
  'cancelled',
] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const orderChannelSchema = z.enum(['digital', 'walkInRecorded'])
export type OrderChannel = z.infer<typeof orderChannelSchema>

export const queueCoverageSchema = z.enum(['recordedOnly', 'reportedComplete', 'unknown'])
export type QueueCoverage = z.infer<typeof queueCoverageSchema>

/** Manually reported, qualitative. Paused is separate (see `ChillStore.pause`): Busy alone never blocks orders. */
export const reportedStateSchema = z.enum(['quiet', 'moderate', 'busy', 'unknown'])
export type ReportedState = z.infer<typeof reportedStateSchema>

export const menuOptionSchema = z.object({
  id,
  label: z.string().trim().min(1).max(60),
  priceDeltaMinor: z.number().int().min(-1_000_000).max(1_000_000),
})

export const menuCategorySchema = z.object({ id, label: z.string().trim().min(1).max(60) })
export type MenuCategory = z.infer<typeof menuCategorySchema>

export const menuItemSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  categoryId: id,
  /** INR paise, or null when no valid price was supplied (then the item cannot be ordered). */
  priceMinor: z.number().int().min(0).max(10_000_000).nullable(),
  availability: z.enum(['available', 'unavailable', 'unknown']),
  description: z.string().trim().max(300).optional(),
  options: z.array(menuOptionSchema).max(20).optional(),
  /** No image data is supplied: items render an accessible placeholder. */
  imageRef: z.string().optional(),
  visible: z.boolean(),
  updatedAt: iso.optional(),
  provenance: provenanceSchema,
})
export type MenuItem = z.infer<typeof menuItemSchema>

export const orderLineSnapshotSchema = z.object({
  menuItemId: id,
  nameAtOrder: z.string().min(1),
  selectedOptionIds: z.array(id),
  optionLabelsAtOrder: z.array(z.string()),
  unitPriceMinorAtOrder: z.number().int().min(0),
  quantity: z.number().int().min(1).max(20),
  lineSubtotalMinor: z.number().int().min(0),
})
export type OrderLineSnapshot = z.infer<typeof orderLineSnapshotSchema>

/**
 * Why a later-accepted order was started while an older one was still waiting (COS-CHILL-V2-001 §3.4).
 * It explains an entry in the simulated log. It is never proof of what the real café does.
 */
export const HANDLING_KINDS = [
  'parallel_station',
  'item_ready_in_batch',
  'operator_exception',
  'other',
] as const
export const handlingNoteSchema = z.object({
  kind: z.enum(HANDLING_KINDS),
  text: z.string().trim().max(200).optional(),
})
export type HandlingNote = z.infer<typeof handlingNoteSchema>
export const handlingLabel: Record<(typeof HANDLING_KINDS)[number], string> = {
  parallel_station: 'Prepared on a separate station',
  item_ready_in_batch: 'Item was ready in a batch',
  operator_exception: 'Operator exception',
  other: 'Other reason',
}

/** An annotation, never a state: the order stays in the backlog until a valid transition moves it. */
export const exceptionFlagSchema = z.object({
  kind: z.literal('needsAttention'),
  recordedAt: iso,
  note: z.string().trim().min(1).max(200),
  source: z.literal('simulated'),
})
export type ExceptionFlag = z.infer<typeof exceptionFlagSchema>

export const orderTransitionSchema = z.object({
  transitionId: id,
  from: z.union([orderStatusSchema, z.literal('cart')]),
  to: orderStatusSchema,
  actor: z.enum(['student', 'demoOperator']),
  occurredAt: iso,
  version: z.number().int().min(1),
  dataMode: z.enum(['userCreated', 'simulated']),
  reason: z.string().trim().max(200).optional(),
  handlingNote: handlingNoteSchema.optional(),
})
export type OrderTransition = z.infer<typeof orderTransitionSchema>

export const chillOrderSchema = z.object({
  id,
  displayNumber: z.string().min(1),
  /** null for an anonymous, recorded demo walk-in. */
  ownerProfileId: id.nullable(),
  channel: orderChannelSchema,
  status: orderStatusSchema,
  items: z.array(orderLineSnapshotSchema).min(1),
  currency: z.literal('INR'),
  listedSubtotalMinor: z.number().int().min(0),
  paymentMethod: z.literal('payAtPickup'),
  /** Payment happens at the counter, outside CampusOS, and is never verified here. */
  paymentVerification: z.literal('notHandledInApp'),
  submittedAt: iso.optional(),
  acceptedAt: iso.optional(),
  startedPreparingAt: iso.optional(),
  readyAt: iso.optional(),
  collectedAt: iso.optional(),
  /** Assigned at acceptance and never changed. */
  queueSequence: z.number().int().min(1).optional(),
  idempotencyKey: z.string().optional(),
  rejectionReason: z.string().optional(),
  exceptionFlag: exceptionFlagSchema.optional(),
  /** A student's own button press. It proves nothing about where they were and changes no status. */
  studentReportedArrivalAt: iso.optional(),
  arrivalSource: z.literal('selfReportedDemo').optional(),
  provenance: provenanceSchema,
  version: z.number().int().min(1),
  history: z.array(orderTransitionSchema).min(1),
})
export type ChillOrder = z.infer<typeof chillOrderSchema>

export const queueObservationSchema = z.object({
  metric: z.enum(['counterPeople', 'busyState']),
  /** null = unknown. Zero is only ever an explicit report. */
  numericValue: z.number().int().min(0).max(500).nullable(),
  reportedState: reportedStateSchema.optional(),
  asOf: iso,
  sourceLabel: z.string().min(1),
  coverage: queueCoverageSchema,
  provenance: provenanceSchema,
  note: z.string().max(200).optional(),
})
export type QueueObservation = z.infer<typeof queueObservationSchema>

export const chillStoreSchema = z.object({
  schemaVersion: z.literal(1),
  orders: z.array(chillOrderSchema),
  counter: queueObservationSchema.nullable(),
  busy: queueObservationSchema.nullable(),
  /** When set, NEW requests are blocked; accepted and pending orders continue. */
  pause: z.object({ reason: z.string().min(1).max(200), at: iso }).nullable(),
  /** V2 option (off unless the presenter switches it on): starting out of sequence needs a logged reason. */
  requireHandlingNote: z.boolean().optional(),
  nextQueueSequence: z.number().int().min(1),
  nextOrderNumber: z.number().int().min(1),
})
export type ChillStore = z.infer<typeof chillStoreSchema>

export const cartLineSchema = z.object({
  lineId: id,
  menuItemId: id,
  optionIds: z.array(id),
  quantity: z.number().int(),
})
export type CartLine = z.infer<typeof cartLineSchema>

export const cartSchema = z.object({
  schemaVersion: z.literal(1),
  lines: z.array(cartLineSchema).max(50),
})
export type Cart = z.infer<typeof cartSchema>
export const emptyCart = (): Cart => ({ schemaVersion: 1, lines: [] })

export const ACTIVE_STATUSES: readonly OrderStatus[] = ['pending', 'queued', 'preparing', 'ready']
export const TERMINAL_STATUSES: readonly OrderStatus[] = ['collected', 'rejected', 'cancelled']
export const isTerminal = (s: OrderStatus) => TERMINAL_STATUSES.includes(s)
export const isActive = (s: OrderStatus) => ACTIVE_STATUSES.includes(s)

/** Student-facing labels (COS-CHILL-001 §1 non-negotiable wording, DEC-047). */
export const statusLabel: Record<OrderStatus, string> = {
  pending: 'Awaiting café acceptance',
  queued: 'Accepted · In preparation queue',
  preparing: 'Being prepared',
  ready: 'Ready for pickup · Pay at café counter',
  collected: 'Collected',
  rejected: 'Not accepted',
  cancelled: 'Cancelled',
}

/** Shorter chip wording for lists. */
export const statusChip: Record<OrderStatus, string> = {
  pending: 'Awaiting café acceptance',
  queued: 'Accepted · In preparation queue',
  preparing: 'Being prepared',
  ready: 'Ready for pickup',
  collected: 'Collected',
  rejected: 'Not accepted',
  cancelled: 'Cancelled',
}
