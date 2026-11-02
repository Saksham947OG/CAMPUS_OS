import { MEALS, type Meal, type MessMeal, type ProfileData } from '@/domain/records'
import { timeToMinutes, type DateOnly } from '@/lib/time'
import type { Now } from './now'

export const mealLabel: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

/** Meals for a date in service order. Contextual information only: never calendar events (C-D02). */
export function messForDate(data: ProfileData, date: DateOnly): MessMeal[] {
  return data.mess
    .filter((m) => m.date === date)
    .sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal))
}

/** Known serving windows for the optional overlay. Meals without a supplied window are omitted. */
export function diningWindows(data: ProfileData, date: DateOnly) {
  return messForDate(data, date).flatMap((m) =>
    m.start && m.end ? [{ meal: m.meal, start: m.start, end: m.end }] : [],
  )
}

export type MessPreview =
  | { kind: 'next'; meal: MessMeal }
  /** Menu exists today but no serving windows: show the menu with no time-based claim. */
  | { kind: 'menuOnly'; meals: MessMeal[] }
  | { kind: 'none' }

export function messPreview(data: ProfileData, now: Now): MessPreview {
  const meals = messForDate(data, now.today)
  if (meals.length === 0) return { kind: 'none' }
  const windowed = meals.filter((m) => m.start && m.end)
  if (windowed.length === 0) return { kind: 'menuOnly', meals }
  const next = windowed.find((m) => timeToMinutes(m.end!) > now.minutes)
  return next ? { kind: 'next', meal: next } : { kind: 'menuOnly', meals }
}
