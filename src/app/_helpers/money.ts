/**
 * Currency helpers.
 *
 * The design mock used the Bangladeshi taka (৳). This app is PKR-oriented, so
 * the symbol lives here as a single constant — change it in one place if the
 * account currency differs.
 */
export const CURRENCY_SYMBOL = '₨';

const numberFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const decimalFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `₨46,657` — no decimals, matching the design's headline figures. */
export function money(value: number | null | undefined): string {
  const n = Number(value);
  if (!isFinite(n)) return `${CURRENCY_SYMBOL}0`;
  return `${CURRENCY_SYMBOL}${numberFormat.format(Math.round(n))}`;
}

/** `₨570.00` — used where unit prices need precision. */
export function moneyExact(value: number | null | undefined): string {
  const n = Number(value);
  if (!isFinite(n)) return `${CURRENCY_SYMBOL}0.00`;
  return `${CURRENCY_SYMBOL}${decimalFormat.format(n)}`;
}

/** `−₨46,657` — the design marks overspend with a true minus sign. */
export function moneyNegative(value: number | null | undefined): string {
  const n = Number(value) || 0;
  return `${n < 0 ? '−' : ''}${money(Math.abs(n))}`;
}

/** `39.5%` */
export function percent(value: number, digits = 1): string {
  if (!isFinite(value)) return '0%';
  return `${value.toFixed(digits)}%`;
}

/** `18 Oct` */
export function shortDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
}

/** `18 Oct 2026` */
export function longDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${d.toLocaleString('en-US', {
    month: 'short',
  })} ${d.getFullYear()}`;
}

/** `yyyy-MM-dd` for <input type="date"> */
export function isoDate(value: Date | string | null | undefined): string {
  const d = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (isNaN(d.getTime())) return '';
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * `yyyy-MM-ddT00:00:00.000Z` — the wire format for a calendar date.
 *
 * A bare `yyyy-MM-dd` is rejected by the API: it deserialises to a DateTime with
 * Kind=Unspecified, and Npgsql refuses to write that into a `timestamp with
 * time zone` column, so the insert fails with a 500. Pinning the date to UTC
 * midnight keeps the stored calendar day the same while giving the server an
 * unambiguous instant.
 */
export function isoUtcDate(value: Date | string | null | undefined): string {
  const day = isoDate(value);
  return day ? `${day}T00:00:00.000Z` : '';
}

/** Greeting used by the dashboard headline. */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
