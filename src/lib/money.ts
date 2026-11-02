/**
 * Money is always an integer number of INR paise (COS-CHILL-001 §4.1). Floats never carry amounts,
 * so totals cannot drift. Display uses the Indian locale.
 */
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
})

export const isPaise = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0

export function formatPaise(paise: number): string {
  return inr.format(paise / 100)
}
